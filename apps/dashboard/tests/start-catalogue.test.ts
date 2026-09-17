import { describe, it, expect } from "vitest";
import {
  startOutcomes,
  channelsForOutcomes,
  funnelsForChannels,
  type CatalogueChannel,
  type CatalogueStep,
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

// The four funnels production publishes, verbatim.
const F_CONVO = {
  key: "sales_meetings_from_conversation",
  name: "Sales Meeting from Conversation",
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

describe("funnelsForChannels", () => {
  it("offers only funnels a picked channel can actually sell", () => {
    const keys = funnelsForChannels([COLD_EMAIL]).map((f) => f.key);
    expect(keys).toEqual(["sales_meetings_from_conversation"]);
  });

  it("offers nothing when no picked channel sells a funnel", () => {
    expect(funnelsForChannels([META_LEAD_ADS])).toEqual([]);
  });

  it("takes the LONGEST run length across the channels selling it", () => {
    // Google Ads sells the purchase funnel at 60 and the meeting funnel at 30.
    const purchase = funnelsForChannels([GOOGLE_ADS]).find((f) => f.key === "website_purchases");
    expect(purchase!.effectiveMinimumCommitmentDays).toBe(60);
  });

  it("sums the day rate, because funding a funnel funds every channel picked for it", () => {
    const meeting = funnelsForChannels([GOOGLE_ADS, CLOSER]).find(
      (f) => f.key === "sales_meetings_from_website",
    );
    // 500 for the ads plus a stated zero for the leg their own team works.
    expect(meeting!.dailyOperatingCostCents).toBe(500);
    expect(meeting!.channelSlugs).toEqual(["founder-led-closing", "google-ads"]);
  });

  it("lists the cheapest day rate first", () => {
    const f = funnelsForChannels([GOOGLE_ADS, CLOSER]).find((x) => x.key === "sales_meetings_from_website");
    expect(f!.channelSlugs[0]).toBe("founder-led-closing");
  });
});
