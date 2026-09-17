import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  startOutcomes,
  channelsForOutcomes,
  funnelsForChannels,
  funnelReachesOutcome,
  funnelRungKeys,
  funnelRungs,
  unsoldBoughtFunnels,
  entryStepsFor,
  pairKeysFromSelection,
  channelGroups,
  type CatalogueChannel,
  type CatalogueStep,
  type CatalogueFunnelDef,
  type CatalogueLegDef,
  type StartCatalogue,
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
// What the ad DELIVERS is a filled form and a booked meeting; nothing of ours happened
// first, which is the LEG (`from: null`) rather than a step of its own.
const AD_FORM = { key: "lead_form_submitted", label: "Lead form submitted", description: "" };
const AD_MEETING = { key: "meeting_booked", label: "Meeting booked", description: "" };
const REPLY: CatalogueStep = { key: "conversation", label: "Positive reply", description: "" };
const MEETING: CatalogueStep = { key: "meeting_booked", label: "Meeting booked", description: "" };
const LEAD_FORM: CatalogueStep = { key: "lead_form_submitted", label: "Lead form submitted", description: "" };
const ATTENDED: CatalogueStep = { key: "meeting_attended", label: "Meeting attended", description: "" };
const SIGNUP: CatalogueStep = { key: "signup", label: "Signup", description: "" };
const FORM: CatalogueStep = { key: "form_filled", label: "Form filled", description: "" };
const PAID: CatalogueStep = { key: "paid_client", label: "Paid client", description: "" };

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
const F_LEAD_FORM_ADS = {
  key: "lead_forms_from_ads",
  name: "Lead Form from Ads",
  steps: ["Lead form submitted", "Paid client"] as const,
  funnelMinimumCommitmentDays: null,
  effectiveMinimumCommitmentDays: 30,
  governedBy: "channel",
};
const F_MEETING_ADS = {
  key: "sales_meetings_from_ads",
  name: "Sales Meeting from Ads",
  steps: ["Meeting booked", "Meeting attended", "Paid client"] as const,
  funnelMinimumCommitmentDays: null,
  effectiveMinimumCommitmentDays: 30,
  governedBy: "channel",
};
const F_SALE_CONVO = {
  key: "sales_from_conversation",
  name: "Sale from Positive Reply",
  steps: ["Positive reply", "Paid client"] as const,
  funnelMinimumCommitmentDays: null,
  effectiveMinimumCommitmentDays: 30,
  governedBy: "channel",
};
const F_SALE_WEB = {
  key: "sales_from_website",
  name: "Website Purchase",
  steps: ["Website visit", "Paid client"] as const,
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
  salesFunnels: [F_WEB_MEETING, F_PURCHASE, F_SALE_WEB],
});
const META_LEAD_ADS = channel({
  slug: "meta-lead-ads",
  displayOrder: 3,
  producibleSteps: [AD_FORM],
  stepTransitions: [{ legKey: "to_ad_form", from: null, to: AD_FORM }],
  salesFunnels: [F_LEAD_FORM_ADS],
});
const AD_BOOKER = channel({
  slug: "meta-meeting-ads",
  displayOrder: 4,
  producibleSteps: [AD_MEETING],
  stepTransitions: [{ legKey: "to_ad_meeting", from: null, to: AD_MEETING }],
  salesFunnels: [F_MEETING_ADS],
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

/**
 * The producer's LEGS, verbatim in shape: each names the step it leaves, the step it
 * reaches, and the funnels it belongs to. The outcome screen is derived from this —
 * which steps exist, and what can lead to each of them.
 */
const WIRE_LEGS: CatalogueLegDef[] = [
  { legKey: "start_to_conversation", fromStep: null, toStep: CONVO, funnelKeys: ["sales_meetings_from_conversation", "sales_from_conversation"] },
  { legKey: "conversation_to_meeting_booked", fromStep: CONVO, toStep: MEETING, funnelKeys: ["sales_meetings_from_conversation"] },
  { legKey: "meeting_booked_to_meeting_attended", fromStep: MEETING, toStep: ATTENDED, funnelKeys: ["sales_meetings_from_conversation", "sales_meetings_from_website", "sales_meetings_from_ads"] },
  { legKey: "meeting_attended_to_paid_client", fromStep: ATTENDED, toStep: PAID, funnelKeys: ["sales_meetings_from_conversation", "sales_meetings_from_website", "sales_meetings_from_ads"] },
  { legKey: "start_to_website_visit", fromStep: null, toStep: VISIT, funnelKeys: ["sales_meetings_from_website", "website_purchases", "form_magnet", "sales_from_website"] },
  { legKey: "website_visit_to_meeting_booked", fromStep: VISIT, toStep: MEETING, funnelKeys: ["sales_meetings_from_website"] },
  { legKey: "website_visit_to_signup", fromStep: VISIT, toStep: SIGNUP, funnelKeys: ["website_purchases"] },
  { legKey: "signup_to_paid_client", fromStep: SIGNUP, toStep: PAID, funnelKeys: ["website_purchases"] },
  { legKey: "website_visit_to_form_filled", fromStep: VISIT, toStep: FORM, funnelKeys: ["form_magnet"] },
  { legKey: "form_filled_to_paid_client", fromStep: FORM, toStep: PAID, funnelKeys: ["form_magnet"] },
  { legKey: "conversation_to_paid_client", fromStep: CONVO, toStep: PAID, funnelKeys: ["sales_from_conversation"] },
  { legKey: "start_to_meeting_booked", fromStep: null, toStep: MEETING, funnelKeys: ["sales_meetings_from_ads"] },
  { legKey: "start_to_lead_form_submitted", fromStep: null, toStep: LEAD_FORM, funnelKeys: ["lead_forms_from_ads"] },
  { legKey: "lead_form_submitted_to_paid_client", fromStep: LEAD_FORM, toStep: PAID, funnelKeys: ["lead_forms_from_ads"] },
  { legKey: "website_visit_to_paid_client", fromStep: VISIT, toStep: PAID, funnelKeys: ["sales_from_website"] },
];

/** The eight root steps the producer publishes, in its own order. */
const WIRE_STEPS: CatalogueStep[] = [CONVO, VISIT, MEETING, ATTENDED, SIGNUP, FORM, LEAD_FORM, PAID];

const cat = (channels: CatalogueChannel[] = FLEET): StartCatalogue => ({
  channels,
  funnels: WIRE_FUNNELS,
  legs: WIRE_LEGS,
  steps: WIRE_STEPS,
});
const FLEET_CAT = cat();

describe("startOutcomes", () => {
  it("offers every rung a funnel we sell contains, not only the entry steps", () => {
    const keys = startOutcomes(FLEET_CAT).map((o) => o.key);
    expect(keys).toEqual([
      "conversation",
      "website_visit",
      "meeting_booked",
      "meeting_attended",
      "signup",
      "form_filled",
      "lead_form_submitted",
      "paid_client",
    ]);
  });

  // The producer's own step order reads as a journey; sorting by how many channels
  // reach each one scatters that journey across the screen.
  it("keeps the producer's step order rather than ranking by reach", () => {
    const keys = startOutcomes(FLEET_CAT).map((o) => o.key);
    expect(keys).toEqual(WIRE_STEPS.map((s) => s.key));
  });

  it("offers nothing for a step no channel can lead to", () => {
    // A catalogue whose only channel produces a conversation cannot lead anybody to a
    // signup, so the signup is not offered rather than offered and then followed by an
    // empty channel screen.
    const keys = startOutcomes(cat([COLD_EMAIL])).map((o) => o.key);
    expect(keys).not.toContain("signup");
    expect(keys).toContain("conversation");
    expect(keys).toContain("paid_client");
  });
});

describe("entryStepsFor", () => {
  // The owner's own table, and it is DERIVED rather than maintained: the entry rung of
  // every funnel that contains the step. A funnel published upstream updates it with
  // nothing to remember here.
  it("derives what can lead to each outcome, funnel by funnel", () => {
    const at = (k: string) => entryStepsFor(k, FLEET_CAT).sort();
    expect(at("website_visit")).toEqual(["website_visit"]);
    expect(at("signup")).toEqual(["website_visit"]);
    expect(at("form_filled")).toEqual(["website_visit"]);
    expect(at("conversation")).toEqual(["conversation"]);
    expect(at("lead_form_submitted")).toEqual(["lead_form_submitted"]);
    // A meeting is reached through a visit or a reply — AND delivered straight from an
    // ad, which is what makes it its own entry step too. No special case needed for it:
    // a step is among its own entry steps whenever a funnel STARTS on it.
    expect(at("meeting_booked")).toEqual(["conversation", "meeting_booked", "website_visit"]);
    expect(at("meeting_attended")).toEqual(["conversation", "meeting_booked", "website_visit"]);
    expect(at("paid_client")).toEqual([
      "conversation",
      "lead_form_submitted",
      "meeting_booked",
      "website_visit",
    ]);
  });
});

describe("channelsForOutcomes", () => {
  it("offers the channels that LEAD to a picked outcome, not only those producing it", () => {
    // Nothing produces a signup from nothing, so matching the outcome against what a
    // channel produces would empty this screen.
    const slugs = channelsForOutcomes(FLEET_CAT, ["signup"]).map((c) => c.slug);
    expect(slugs).toEqual(["google-ads"]);
  });

  it("excludes a channel that cannot lead there", () => {
    // Cold email produces a conversation; no funnel containing a signup starts on one.
    expect(channelsForOutcomes(FLEET_CAT, ["signup"]).map((c) => c.slug)).not.toContain(
      "sales-cold-email-outreach",
    );
  });

  it("unions across picks, because either outcome is worth the money", () => {
    const slugs = channelsForOutcomes(FLEET_CAT, ["signup", "conversation"]).map((c) => c.slug);
    expect(slugs).toContain("google-ads");
    expect(slugs).toContain("sales-cold-email-outreach");
  });

  it("offers nothing when nothing is picked", () => {
    expect(channelsForOutcomes(FLEET_CAT, [])).toEqual([]);
  });
});

describe("funnelsForChannels", () => {
  const pairsFor = (channels: CatalogueChannel[], picks: string[]) =>
    funnelsForChannels(channels, picks, FLEET_CAT).map((p) => p.key);

  // THE OWNER'S RULE. A funnel is bought only when every one of its rungs was picked,
  // the sale implicit — asking a visitor to tick "paid client" is asking them to
  // confirm they would like to be paid.
  it("offers a funnel only when EVERY rung was picked", () => {
    const coldEmail = channel({
      slug: "sales-cold-email-outreach",
      producibleSteps: [CONVO],
      salesFunnels: [F_CONVO, F_SALE_CONVO],
    });
    // A reply alone buys the funnel that goes straight from it to the sale.
    expect(pairsFor([coldEmail], ["conversation"])).toEqual([
      "sales_from_conversation::sales-cold-email-outreach",
    ]);
    // The meeting funnel needs its own two middle rungs as well.
    expect(pairsFor([coldEmail], ["conversation", "meeting_booked"])).toEqual([
      "sales_from_conversation::sales-cold-email-outreach",
    ]);
    expect(
      pairsFor([coldEmail], ["conversation", "meeting_booked", "meeting_attended"]).sort(),
    ).toEqual([
      "sales_from_conversation::sales-cold-email-outreach",
      "sales_meetings_from_conversation::sales-cold-email-outreach",
    ]);
  });

  // The pick the whole rule was written for: until `sales_from_website` existed, a lone
  // website visit bought NOTHING, because every website funnel inserted a rung.
  it("buys the direct funnel on a lone website visit, and only that one", () => {
    expect(pairsFor([GOOGLE_ADS], ["website_visit"])).toEqual([
      "sales_from_website::google-ads",
    ]);
    expect(pairsFor([GOOGLE_ADS], ["website_visit", "signup"]).sort()).toEqual([
      "sales_from_website::google-ads",
      "website_purchases::google-ads",
    ]);
  });

  it("states ONE ROW PER PAIR, never one per funnel with its channels folded in", () => {
    // Two channels selling one funnel is two rows, each with its OWN day rate: a row is
    // what billing keys a ceiling on, and a summed rate funds channels nobody chose.
    const rows = funnelsForChannels([GOOGLE_ADS, CLOSER], ["website_visit", "meeting_booked", "meeting_attended"], FLEET_CAT)
      .filter((p) => p.funnelKey === "sales_meetings_from_website");
    expect(rows.map((r) => r.channelSlug)).toEqual(["founder-led-closing", "google-ads"]);
    expect(rows.map((r) => r.dailyOperatingCostCents)).toEqual([0, 500]);
    expect(rows[0].name).toBe("Sales Meeting from Website via founder-led-closing");
  });

  it("orders by funnel, then cheapest day rate", () => {
    const rows = funnelsForChannels([GOOGLE_ADS, CLOSER], ["website_visit", "meeting_booked", "meeting_attended"], FLEET_CAT);
    expect(rows[0].dailyOperatingCostCents).toBeLessThanOrEqual(
      rows[rows.length - 1].dailyOperatingCostCents,
    );
  });

  it("offers nothing when no picked channel sells a funnel the picks buy", () => {
    expect(pairsFor([GOOGLE_ADS], ["conversation"])).toEqual([]);
  });
});

describe("unsoldBoughtFunnels", () => {
  // The screen this exists for: a reply plus an ad-platform form, cold email kept, and
  // the form funnel never appears. Now it is named, with the channels that would run it.
  it("names a funnel the picks buy that no kept channel sells, with its sellers", () => {
    const coldEmail = channel({
      slug: "sales-cold-email-outreach",
      name: "Cold email",
      producibleSteps: [CONVO],
      salesFunnels: [F_CONVO, F_SALE_CONVO],
    });
    const cat = { ...FLEET_CAT, channels: [coldEmail, META_LEAD_ADS] };
    const gaps = unsoldBoughtFunnels(cat, ["conversation", "lead_form_submitted"], [coldEmail]);
    expect(gaps.map((g) => g.funnelKey)).toEqual(["lead_forms_from_ads"]);
    expect(gaps[0].sellerNames).toEqual([META_LEAD_ADS.name]);
  });

  it("is empty when every bought funnel is sold, or nothing is picked", () => {
    expect(unsoldBoughtFunnels(FLEET_CAT, ["lead_form_submitted"], [META_LEAD_ADS])).toEqual([]);
    expect(unsoldBoughtFunnels(FLEET_CAT, [], [])).toEqual([]);
  });

  it("does not name a funnel whose rungs were not all picked", () => {
    const gaps = unsoldBoughtFunnels(FLEET_CAT, ["conversation", "meeting_booked"], []);
    expect(gaps.map((g) => g.funnelKey)).not.toContain("sales_meetings_from_conversation");
  });
});

describe("funnelRungs", () => {
  it("returns each rung as a step with the producer's words, in order", () => {
    expect(funnelRungs("sales_meetings_from_conversation", FLEET_CAT).map((s) => s.key)).toEqual(
      funnelRungKeys("sales_meetings_from_conversation", FLEET_CAT),
    );
    expect(funnelRungs("lead_forms_from_ads", FLEET_CAT).map((s) => s.label)).toEqual([
      "Lead form submitted",
      "Paid client",
    ]);
  });
});

describe("funnelRungKeys", () => {
  it("walks a funnel's rungs in order, off the producer's legs", () => {
    expect(funnelRungKeys("form_magnet", FLEET_CAT)).toEqual([
      "website_visit",
      "form_filled",
      "paid_client",
    ]);
    expect(funnelRungKeys("sales_meetings_from_ads", FLEET_CAT)).toEqual([
      "meeting_booked",
      "meeting_attended",
      "paid_client",
    ]);
  });

  it("throws on a funnel the catalogue itself does not describe", () => {
    expect(() => funnelRungKeys("brand_new_funnel", FLEET_CAT)).toThrow();
  });
});

describe("pairKeysFromSelection", () => {
  const pairs = [
    { funnelKey: "form_magnet", channelSlug: "google-ads" },
    { funnelKey: "form_magnet", channelSlug: "meta-lead-ads" },
    { funnelKey: "website_purchases", channelSlug: "google-ads" },
  ];

  it("passes a pair key through untouched", () => {
    expect(pairKeysFromSelection(["form_magnet::google-ads"], pairs)).toEqual([
      "form_magnet::google-ads",
    ]);
  });

  // The cookie is NOT version-bumped for the pair reshape: a bump drops every stored
  // selection, and one field it carries is `paid` — the only record that money was taken
  // between the charge and the brand's creation. Dropping it asks somebody to pay twice.
  it("reads a FUNNEL-keyed selection as every pair of that funnel", () => {
    expect(pairKeysFromSelection(["form_magnet"], pairs).sort()).toEqual([
      "form_magnet::google-ads",
      "form_magnet::meta-lead-ads",
    ]);
  });

  it("drops a funnel key nothing offers rather than inventing a pair", () => {
    expect(pairKeysFromSelection(["nonesuch"], pairs)).toEqual([]);
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
