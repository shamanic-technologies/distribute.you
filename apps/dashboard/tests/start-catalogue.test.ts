import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  startOutcomes,
  channelsForOutcomes,
  funnelsForChannels,
  funnelReachesOutcome,
  channelGroups,
  type CatalogueChannel,
  type CatalogueStep,
  type CatalogueFunnelDef,
} from "../src/lib/start-catalogue";

// The four entry steps production publishes today, in the producer's own words.
const VISIT: CatalogueStep = {
  key: "website_visit",
  label: "Website visit",
  description: "A buyer lands on the brand's own website.",
};
const CONVO: CatalogueStep = {
  key: "conversation",
  label: "Conversation",
  description: "A buyer answers and a conversation opens.",
};
const AD_FORM: CatalogueStep = {
  key: "in_ad_form_submission",
  label: "Form filled in the ad",
  description: "A buyer fills a form inside the ad itself.",
};
const AD_MEETING: CatalogueStep = {
  key: "in_ad_booked_meeting",
  label: "Meeting booked from an ad",
  description: "A buyer books a meeting straight from the ad.",
};
const REPLY: CatalogueStep = { key: "conversation", label: "Positive reply", description: "" };
const MEETING: CatalogueStep = { key: "meeting_booked", label: "Meeting booked", description: "" };
const LEAD_FORM: CatalogueStep = { key: "lead_form_submitted", label: "Lead form submitted", description: "" };

// The four funnels production publishes, verbatim.
const F_CONVO = {
  key: "sales_meetings_from_conversation",
  name: "Sales Meeting from Positive Reply",
  steps: ["Positive reply", "Meeting booked", "Meeting attended", "Paid client"] as const,
  funnelMinimumCommitmentDays: null,
  effectiveMinimumCommitmentDays: 30,
  governedBy: "channel",
};
const F_WEB_MEETING = {
  key: "sales_meetings_from_website",
  name: "Sales Meeting from Website",
  steps: ["Website visit", "Meeting booked", "Meeting attended", "Paid client"] as const,
  funnelMinimumCommitmentDays: null,
  effectiveMinimumCommitmentDays: 30,
  governedBy: "channel",
};
const F_PURCHASE = {
  key: "website_purchases",
  name: "Website Purchase",
  steps: ["Website visit", "Signup", "Paid client"] as const,
  funnelMinimumCommitmentDays: null,
  effectiveMinimumCommitmentDays: 60,
  governedBy: "funnel",
};

/**
 * The funnels as the PRODUCER describes them, keyed, entry step included.
 *
 * Verbatim from `GET /public/channels` in production on 2026-09-17, all EIGHT —
 * including the four this app's own catalogue cannot name. That is the point of
 * the fixture: the four were what took the screen down.
 */
const WIRE_FUNNELS: CatalogueFunnelDef[] = [
  { key: "sales_meetings_from_conversation", name: "Sales Meeting from Positive Reply", steps: ["Positive reply", "Meeting booked", "Meeting attended", "Paid client"], entryStep: CONVO, entryLegKey: "start_to_conversation" },
  { key: "sales_meetings_from_website", name: "Sales Meeting from Website", steps: ["Website visit", "Meeting booked", "Meeting attended", "Paid client"], entryStep: VISIT, entryLegKey: "start_to_website_visit" },
  { key: "website_purchases", name: "Signups", steps: ["Website visit", "Signup", "Paid client"], entryStep: VISIT, entryLegKey: "start_to_website_visit" },
  { key: "form_magnet", name: "Form Magnet", steps: ["Website visit", "Form filled", "Paid client"], entryStep: VISIT, entryLegKey: "start_to_website_visit" },
  // The four features-service added on 2026-09-17. This app's catalogue names none
  // of them, and its key normalizer throws on each — which is exactly why the
  // filter may not go through it.
  { key: "sales_from_conversation", name: "Sale from Positive Reply", steps: ["Positive reply", "Paid client"], entryStep: CONVO, entryLegKey: "start_to_conversation" },
  { key: "sales_meetings_from_ads", name: "Sales Meeting from Ads", steps: ["Meeting booked", "Meeting attended", "Paid client"], entryStep: MEETING, entryLegKey: "start_to_meeting_booked" },
  { key: "lead_forms_from_ads", name: "Lead Form from Ads", steps: ["Lead form submitted", "Paid client"], entryStep: LEAD_FORM, entryLegKey: "start_to_lead_form_submitted" },
  { key: "sales_from_website", name: "Website Purchase", steps: ["Website visit", "Paid client"], entryStep: VISIT, entryLegKey: "start_to_website_visit" },
];

const channel = (over: Partial<CatalogueChannel> & { slug: string }): CatalogueChannel => ({
  name: over.slug,
  description: "",
  displayOrder: 1,
  family: "paid_reach",
  operatedBy: "platform",
  terms: { dailyOperatingCostCents: 800, minimumCommitmentDays: 30, maxDaysToFirstProduction: 14 },
  stepTransitions: [],
  producibleSteps: [],
  salesFunnels: [],
  ...over,
});

const COLD_EMAIL = channel({
  slug: "sales-cold-email-outreach",
  displayOrder: 1,
  producibleSteps: [CONVO],
  stepTransitions: [{ legKey: "to_conversation", from: null, to: REPLY }],
  salesFunnels: [F_CONVO],
});
const GOOGLE_ADS = channel({
  slug: "google-ads",
  displayOrder: 2,
  terms: { dailyOperatingCostCents: 500, minimumCommitmentDays: 30, maxDaysToFirstProduction: 1 },
  producibleSteps: [VISIT],
  stepTransitions: [{ legKey: "to_visit", from: null, to: VISIT }],
  salesFunnels: [F_WEB_MEETING, F_PURCHASE],
});
const META_LEAD_ADS = channel({
  slug: "meta-lead-ads",
  displayOrder: 3,
  producibleSteps: [AD_FORM],
  stepTransitions: [{ legKey: "to_ad_form", from: null, to: AD_FORM }],
  salesFunnels: [],
});
const AD_BOOKER = channel({
  slug: "meta-meeting-ads",
  displayOrder: 4,
  producibleSteps: [AD_MEETING],
  stepTransitions: [{ legKey: "to_ad_meeting", from: null, to: AD_MEETING }],
  salesFunnels: [],
});
const CLOSER = channel({
  slug: "founder-led-closing",
  displayOrder: 5,
  operatedBy: "customer",
  terms: { dailyOperatingCostCents: 0, minimumCommitmentDays: 30, maxDaysToFirstProduction: 1 },
  producibleSteps: [],
  stepTransitions: [{ legKey: "meeting_to_paid", from: MEETING, to: { key: "paid_client", label: "Paid client", description: "" } }],
  salesFunnels: [F_CONVO, F_WEB_MEETING],
});

const FLEET = [COLD_EMAIL, GOOGLE_ADS, META_LEAD_ADS, AD_BOOKER, CLOSER];

describe("startOutcomes", () => {
  it("offers every entry step the producer publishes, not a remembered three", () => {
    const keys = startOutcomes(FLEET).map((o) => o.key);
    expect(keys).toContain("website_visit");
    expect(keys).toContain("conversation");
    // The one a hardcoded WV/SI/MB list would have made unreachable.
    expect(keys).toContain("in_ad_form_submission");
    expect(keys).toContain("in_ad_booked_meeting");
  });

  it("offers ONLY what a channel produces from nothing, so no two options are the same screen", () => {
    const outcomes = startOutcomes(FLEET);
    // A funnel rung nothing produces directly is not an entry step, so it is not
    // an outcome. Offering those is what made six options resolve to one screen
    // against the real catalogue.
    expect(outcomes.map((o) => o.key)).not.toContain("meeting_booked");
    expect(outcomes.map((o) => o.key)).not.toContain("paid_client");

    // And every option that IS offered narrows to a distinct set.
    const sets = outcomes.map((o) => [...o.channelSlugs].sort().join(","));
    expect(new Set(sets).size).toBe(sets.length);
  });

  it("drops an outcome nothing can serve rather than offering a dead option", () => {
    expect(startOutcomes([]).length).toBe(0);
    expect(startOutcomes(FLEET).every((o) => o.channelSlugs.length > 0)).toBe(true);
  });

  it("orders widest first so the least narrowing choice reads first", () => {
    const counts = startOutcomes(FLEET).map((o) => o.channelSlugs.length);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });
});

describe("channelsForOutcomes", () => {
  it("unions the picks, so a visit plus a conversation is not an empty screen", () => {
    const slugs = channelsForOutcomes(FLEET, ["website_visit", "conversation"]).map((c) => c.slug);
    expect(slugs).toContain("google-ads");
    expect(slugs).toContain("sales-cold-email-outreach");
  });

  it("offers nothing before an outcome is picked", () => {
    expect(channelsForOutcomes(FLEET, [])).toEqual([]);
  });

  it("ignores an outcome key the catalogue does not carry", () => {
    expect(channelsForOutcomes(FLEET, ["nonsense_step"])).toEqual([]);
    // A funnel rung is not an entry step, so asking for one selects nothing
    // rather than quietly widening onto every visit-producing channel.
    expect(channelsForOutcomes(FLEET, ["meeting_booked"])).toEqual([]);
  });

  it("orders by the producer's own display order", () => {
    const order = channelsForOutcomes(FLEET, ["website_visit", "conversation", "in_ad_form_submission"]).map(
      (c) => c.displayOrder,
    );
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});

const VISIT_PICK = ["website_visit"];
const CONVO_PICK = ["conversation"];

describe("funnelsForChannels", () => {
  it("offers only funnels a picked channel can actually sell", () => {
    const keys = funnelsForChannels([COLD_EMAIL], CONVO_PICK, WIRE_FUNNELS).map((f) => f.key);
    expect(keys).toEqual(["sales_meetings_from_conversation"]);
  });

  it("offers nothing when no picked channel sells a funnel", () => {
    expect(funnelsForChannels([META_LEAD_ADS], ["in_ad_form_submission"], WIRE_FUNNELS)).toEqual([]);
  });

  // THE BUG THIS FILTER EXISTS FOR. Production's cold email produces a conversation
  // AND a website visit, so it sells the reply funnel and the three website funnels
  // alike; a visitor who picked "a conversation" was offered Website Purchase.
  it("offers only the funnels that START on a picked outcome, not every funnel a channel sells", () => {
    const coldEmailProd = channel({
      slug: "sales-cold-email-outreach",
      producibleSteps: [CONVO, VISIT],
      salesFunnels: [F_CONVO, F_WEB_MEETING, F_PURCHASE],
    });
    expect(funnelsForChannels([coldEmailProd], CONVO_PICK, WIRE_FUNNELS).map((f) => f.key)).toEqual([
      "sales_meetings_from_conversation",
    ]);
    expect(funnelsForChannels([coldEmailProd], VISIT_PICK, WIRE_FUNNELS).map((f) => f.key).sort()).toEqual([
      "sales_meetings_from_website",
      "website_purchases",
    ]);
    expect(funnelsForChannels([coldEmailProd], [...CONVO_PICK, ...VISIT_PICK], WIRE_FUNNELS)).toHaveLength(3);
  });

  it("offers nothing on an outcome no funnel starts on, rather than a funnel that starts elsewhere", () => {
    expect(funnelsForChannels([GOOGLE_ADS], CONVO_PICK, WIRE_FUNNELS)).toEqual([]);
  });

  it("takes the LONGEST run length across the channels selling it", () => {
    // Google Ads sells the purchase funnel at 60 and the meeting funnel at 30.
    const purchase = funnelsForChannels([GOOGLE_ADS], VISIT_PICK, WIRE_FUNNELS).find((f) => f.key === "website_purchases");
    expect(purchase!.effectiveMinimumCommitmentDays).toBe(60);
  });

  it("sums the day rate, because funding a funnel funds every channel picked for it", () => {
    const meeting = funnelsForChannels([GOOGLE_ADS, CLOSER], VISIT_PICK, WIRE_FUNNELS).find(
      (f) => f.key === "sales_meetings_from_website",
    );
    // 500 for the ads plus a stated zero for the leg their own team works.
    expect(meeting!.dailyOperatingCostCents).toBe(500);
    expect(meeting!.channelSlugs).toEqual(["founder-led-closing", "google-ads"]);
  });

  it("lists the cheapest day rate first", () => {
    const f = funnelsForChannels([GOOGLE_ADS, CLOSER], VISIT_PICK, WIRE_FUNNELS).find((x) => x.key === "sales_meetings_from_website");
    expect(f!.channelSlugs[0]).toBe("founder-led-closing");
  });
});

describe("funnelReachesOutcome", () => {
  it("matches a funnel on the step the PRODUCER says it starts on", () => {
    expect(funnelReachesOutcome("sales_meetings_from_conversation", CONVO_PICK, WIRE_FUNNELS)).toBe(true);
    expect(funnelReachesOutcome("sales_meetings_from_conversation", VISIT_PICK, WIRE_FUNNELS)).toBe(false);
    expect(funnelReachesOutcome("form_magnet", VISIT_PICK, WIRE_FUNNELS)).toBe(true);
  });

  // THE BREAK. features-service went from four published funnels to eight at
  // 17:40 UTC on 2026-09-17; 37 of the 42 channels sell one of the four added.
  // Resolving a funnel through this app's own catalogue threw on every one of
  // them, inside a useMemo with no error boundary under `app/start`, so the
  // visitor's FIRST channel click blanked the page.
  it("resolves a funnel this app's own catalogue cannot name", () => {
    for (const key of ["sales_from_conversation", "sales_meetings_from_ads", "lead_forms_from_ads", "sales_from_website"]) {
      expect(() => funnelReachesOutcome(key, VISIT_PICK, WIRE_FUNNELS)).not.toThrow();
    }
    expect(funnelReachesOutcome("sales_from_website", VISIT_PICK, WIRE_FUNNELS)).toBe(true);
    expect(funnelReachesOutcome("sales_from_conversation", CONVO_PICK, WIRE_FUNNELS)).toBe(true);
    expect(funnelReachesOutcome("sales_from_conversation", VISIT_PICK, WIRE_FUNNELS)).toBe(false);
    expect(funnelReachesOutcome("sales_meetings_from_ads", ["meeting_booked"], WIRE_FUNNELS)).toBe(true);
    expect(funnelReachesOutcome("lead_forms_from_ads", ["lead_form_submitted"], WIRE_FUNNELS)).toBe(true);
  });

  it("still reads the pre-rename spelling, because the producer publishes it", () => {
    const legacy: CatalogueFunnelDef[] = [
      { key: "reply_meeting", name: "Sales Meeting from Positive Reply", steps: [], entryStep: CONVO, entryLegKey: "start_to_conversation" },
    ];
    expect(funnelReachesOutcome("reply_meeting", CONVO_PICK, legacy)).toBe(true);
  });

  // A channel selling a funnel the producer's own funnel list omits is a genuine
  // drift, and the screen must not guess a funnel the visitor would be charged
  // for. Distinct from the case above: there the key is UNKNOWN TO US and known
  // to the producer; here it is known to NOBODY.
  it("throws on a funnel the catalogue itself does not describe", () => {
    expect(() => funnelReachesOutcome("brand_new_funnel", VISIT_PICK, WIRE_FUNNELS)).toThrow();
  });
});

describe("the funnel filter is wire-driven", () => {
  const SRC = readFileSync(new URL("../src/lib/start-catalogue.ts", import.meta.url), "utf8");

  // The join that broke it. This module may not name a funnel at all: it offers
  // what the producer publishes and carries the key through signup untouched.
  it("never joins a funnel key against this app's own catalogue", () => {
    expect(SRC).not.toContain("SALES_FUNNELS");
    expect(SRC).not.toContain("normalizeSalesFunnelKey");
  });

  // The two in-ad steps were collapsed into plain `form_filled` / `meeting_booked`
  // upstream, so the special case they needed is gone rather than left unused.
  it("carries no in-ad special case", () => {
    expect(SRC).not.toContain("IN_AD_LANDS_ON");
  });
});

describe("channelGroups", () => {
  it("groups by the producer's family in a fixed order, with words a visitor reads", () => {
    const groups = channelGroups([
      channel({ slug: "c", family: "conversion" }),
      channel({ slug: "e", family: "earned" }),
      channel({ slug: "o", family: "outbound_one_to_one" }),
      channel({ slug: "p", family: "paid_reach" }),
    ]);
    expect(groups.map((g) => g.family)).toEqual(["outbound_one_to_one", "paid_reach", "earned", "conversion"]);
    expect(groups.map((g) => g.label)).toEqual([
      "Direct outreach",
      "Ads and sponsorships",
      "Content and press",
      "Closing the sale",
    ]);
  });

  it("keeps a family it has no words for rather than dropping its channels", () => {
    const groups = channelGroups([channel({ slug: "n", family: "new_family" })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("New Family");
    expect(groups[0].channels[0].slug).toBe("n");
  });

  it("keeps the producer's own order inside a group", () => {
    const groups = channelGroups([
      channel({ slug: "b", displayOrder: 2, family: "earned" }),
      channel({ slug: "a", displayOrder: 1, family: "earned" }),
    ]);
    expect(groups[0].channels.map((c) => c.slug)).toEqual(["b", "a"]);
  });
});
