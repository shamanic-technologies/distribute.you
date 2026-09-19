import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  startOutcomes,
  channelsForOutcomes,
  funnelsForChannels,
  funnelReachesOutcome,
  funnelInternalRungKeys,
  funnelRungKeys,
  funnelRungs,
  pairKeysFromSelection,
  START_OUTCOME_KEYS,
  PURCHASE_STEP_KEY,
  DEFAULT_CHANNEL_SLUG,
  type CatalogueChannel,
  type CatalogueStep,
  type CatalogueFunnelDef,
  type CatalogueLegDef,
  type StartCatalogue,
} from "../src/lib/start-catalogue";

// The steps production publishes, in the producer's own words.
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
const MEETING: CatalogueStep = { key: "meeting_booked", label: "Meeting booked", description: "They book time with you." };
const ATTENDED: CatalogueStep = { key: "meeting_attended", label: "Meeting attended", description: "" };
const SIGNUP: CatalogueStep = { key: "signup", label: "Signup", description: "They create an account." };
const FORM: CatalogueStep = { key: "form_submitted", label: "Form submitted", description: "They fill in a form." };
const PAID: CatalogueStep = { key: "paid_client", label: "Paid client", description: "" };

const funnel = (
  key: string,
  name: string,
  steps: readonly string[],
  days = 30,
) => ({
  key,
  name,
  steps,
  funnelMinimumCommitmentDays: null,
  effectiveMinimumCommitmentDays: days,
  governedBy: "channel",
});

// The six funnels cold email sells in production on 2026-09-18, verbatim.
const F_CONVO_MEETING = funnel("sales_meetings_from_conversation", "Sales Meeting from Positive Reply", ["Positive reply", "Meeting booked", "Meeting attended", "Paid client"]);
const F_WEB_MEETING = funnel("sales_meetings_from_website", "Sales Meeting from Website", ["Website visit", "Meeting booked", "Meeting attended", "Paid client"]);
const F_SIGNUPS = funnel("website_purchases", "Signups", ["Website visit", "Signup", "Paid client"]);
const F_FORM_MAGNET = funnel("form_magnet", "Form Magnet", ["Website visit", "Form submitted", "Paid client"]);
const F_SALE_CONVO = funnel("sales_from_conversation", "Sale from Positive Reply", ["Positive reply", "Paid client"]);
const F_SALE_WEB = funnel("sales_from_website", "Website Purchase", ["Website visit", "Paid client"]);

/**
 * The funnels as the PRODUCER describes them, keyed, entry step included.
 *
 * Verbatim from `GET /public/channels` in production on 2026-09-18, all EIGHT --
 * including the two this app's own catalogue cannot name. That is the point of
 * the fixture: the ones it cannot name are what took the screen down once.
 */
const WIRE_FUNNELS: CatalogueFunnelDef[] = [
  { key: "sales_meetings_from_conversation", name: "Sales Meeting from Positive Reply", steps: F_CONVO_MEETING.steps, entryStep: CONVO, entryLegKey: "start_to_conversation" },
  { key: "sales_meetings_from_website", name: "Sales Meeting from Website", steps: F_WEB_MEETING.steps, entryStep: VISIT, entryLegKey: "start_to_website_visit" },
  { key: "website_purchases", name: "Signups", steps: F_SIGNUPS.steps, entryStep: VISIT, entryLegKey: "start_to_website_visit" },
  { key: "form_magnet", name: "Form Magnet", steps: F_FORM_MAGNET.steps, entryStep: VISIT, entryLegKey: "start_to_website_visit" },
  { key: "sales_from_conversation", name: "Sale from Positive Reply", steps: F_SALE_CONVO.steps, entryStep: CONVO, entryLegKey: "start_to_conversation" },
  { key: "sales_meetings_from_ads", name: "Sales Meeting from Ads", steps: ["Meeting booked", "Meeting attended", "Paid client"], entryStep: MEETING, entryLegKey: "start_to_meeting_booked" },
  { key: "lead_forms_from_ads", name: "Lead Form from Ads", steps: ["Form submitted", "Paid client"], entryStep: FORM, entryLegKey: "start_to_form_submitted" },
  { key: "sales_from_website", name: "Website Purchase", steps: F_SALE_WEB.steps, entryStep: VISIT, entryLegKey: "start_to_website_visit" },
];

const WIRE_LEGS: CatalogueLegDef[] = [
  { legKey: "start_to_conversation", fromStep: null, toStep: CONVO, funnelKeys: ["sales_meetings_from_conversation", "sales_from_conversation"] },
  { legKey: "conversation_to_meeting_booked", fromStep: CONVO, toStep: MEETING, funnelKeys: ["sales_meetings_from_conversation"] },
  { legKey: "meeting_booked_to_meeting_attended", fromStep: MEETING, toStep: ATTENDED, funnelKeys: ["sales_meetings_from_conversation", "sales_meetings_from_website", "sales_meetings_from_ads"] },
  { legKey: "meeting_attended_to_paid_client", fromStep: ATTENDED, toStep: PAID, funnelKeys: ["sales_meetings_from_conversation", "sales_meetings_from_website", "sales_meetings_from_ads"] },
  { legKey: "start_to_website_visit", fromStep: null, toStep: VISIT, funnelKeys: ["sales_meetings_from_website", "website_purchases", "form_magnet", "sales_from_website"] },
  { legKey: "website_visit_to_meeting_booked", fromStep: VISIT, toStep: MEETING, funnelKeys: ["sales_meetings_from_website"] },
  { legKey: "website_visit_to_signup", fromStep: VISIT, toStep: SIGNUP, funnelKeys: ["website_purchases"] },
  { legKey: "signup_to_paid_client", fromStep: SIGNUP, toStep: PAID, funnelKeys: ["website_purchases"] },
  { legKey: "website_visit_to_form_submitted", fromStep: VISIT, toStep: FORM, funnelKeys: ["form_magnet"] },
  { legKey: "form_submitted_to_paid_client", fromStep: FORM, toStep: PAID, funnelKeys: ["form_magnet", "lead_forms_from_ads"] },
  { legKey: "conversation_to_paid_client", fromStep: CONVO, toStep: PAID, funnelKeys: ["sales_from_conversation"] },
  { legKey: "start_to_meeting_booked", fromStep: null, toStep: MEETING, funnelKeys: ["sales_meetings_from_ads"] },
  { legKey: "start_to_form_submitted", fromStep: null, toStep: FORM, funnelKeys: ["lead_forms_from_ads"] },
  { legKey: "website_visit_to_paid_client", fromStep: VISIT, toStep: PAID, funnelKeys: ["sales_from_website"] },
];

/** The seven root steps the producer publishes today, in its own order. */
const WIRE_STEPS: CatalogueStep[] = [CONVO, VISIT, MEETING, ATTENDED, SIGNUP, FORM, PAID];

const channel = (over: Partial<CatalogueChannel> & { slug: string }): CatalogueChannel => ({
  name: over.slug,
  description: "",
  displayOrder: 1,
  family: "outbound_one_to_one",
  operatedBy: "platform",
  terms: { dailyOperatingCostCents: 100, minimumCommitmentDays: 30, maxDaysToFirstProduction: 14 },
  stepTransitions: [],
  producibleSteps: [],
  salesFunnels: [],
  ...over,
});

/** Cold email as production publishes it: it produces BOTH entry steps and sells six. */
const COLD_EMAIL = channel({
  slug: DEFAULT_CHANNEL_SLUG,
  name: "Sales Cold Email Outreach",
  producibleSteps: [CONVO, VISIT],
  salesFunnels: [F_CONVO_MEETING, F_WEB_MEETING, F_SIGNUPS, F_FORM_MAGNET, F_SALE_CONVO, F_SALE_WEB],
});
const GOOGLE_ADS = channel({
  slug: "google-ads",
  displayOrder: 2,
  family: "paid_reach",
  terms: { dailyOperatingCostCents: 500, minimumCommitmentDays: 30, maxDaysToFirstProduction: 1 },
  producibleSteps: [VISIT],
  salesFunnels: [F_WEB_MEETING, F_SIGNUPS, F_SALE_WEB],
});

const cat = (
  channels: CatalogueChannel[] = [COLD_EMAIL, GOOGLE_ADS],
  steps: CatalogueStep[] = WIRE_STEPS,
): StartCatalogue => ({ channels, funnels: WIRE_FUNNELS, legs: WIRE_LEGS, steps });
const FLEET_CAT = cat();

describe("startOutcomes", () => {
  // THE OWNER'S FOUR. Every rung used to be offered, which was eight options and
  // three of them nobody buys: a visit and a reply are how a funnel STARTS, an
  // attended meeting is a step of a booked one, and the sale is where all of them end.
  it("offers exactly the four things a visitor can ask us for, in order", () => {
    expect(startOutcomes(FLEET_CAT).map((o) => o.key)).toEqual([
      "meeting_booked",
      "signup",
      "form_submitted",
      "purchase",
    ]);
    expect(START_OUTCOME_KEYS).toEqual(["meeting_booked", "signup", "form_submitted", "purchase"]);
  });

  it("offers none of the rungs that are not outcomes", () => {
    const keys = startOutcomes(FLEET_CAT).map((o) => o.key);
    for (const gone of ["website_visit", "conversation", "meeting_attended", "paid_client"]) {
      expect(keys, gone).not.toContain(gone);
    }
  });

  it("reads the producer's own words for a step it publishes", () => {
    const byKey = new Map(startOutcomes(FLEET_CAT).map((o) => [o.key, o]));
    expect(byKey.get("signup")?.label).toBe("Signup");
    expect(byKey.get("signup")?.description).toBe("They create an account.");
    expect(byKey.get("form_submitted")?.label).toBe("Form submitted");
  });

  // A buyer paying on the website is named here while the producer ships the rung.
  // Once it publishes one, the wire's own words win with nothing to change.
  it("names the purchase itself until the producer publishes the step, then reads the wire", () => {
    const local = startOutcomes(FLEET_CAT).find((o) => o.key === PURCHASE_STEP_KEY);
    expect(local?.label).toBe("Direct purchase");
    const PURCHASE: CatalogueStep = { key: "purchase", label: "Purchase made", description: "From the wire." };
    const published = startOutcomes(cat(undefined, [...WIRE_STEPS, PURCHASE]));
    const fromWire = published.find((o) => o.key === PURCHASE_STEP_KEY);
    expect(fromWire?.label).toBe("Purchase made");
    expect(fromWire?.description).toBe("From the wire.");
  });

  it("drops a producer step that stopped being published rather than naming it from memory", () => {
    const withoutSignup = cat(undefined, WIRE_STEPS.filter((s) => s.key !== "signup"));
    expect(startOutcomes(withoutSignup).map((o) => o.key)).toEqual([
      "meeting_booked",
      "form_submitted",
      "purchase",
    ]);
  });
});

describe("channelsForOutcomes", () => {
  // The channel screen is gone: we run one channel, so this answers with it.
  it("answers with the one channel we run, whatever was picked", () => {
    expect(channelsForOutcomes(FLEET_CAT, ["signup"]).map((c) => c.slug)).toEqual([
      DEFAULT_CHANNEL_SLUG,
    ]);
    expect(channelsForOutcomes(FLEET_CAT, ["meeting_booked", "purchase"]).map((c) => c.slug)).toEqual([
      DEFAULT_CHANNEL_SLUG,
    ]);
  });

  it("offers nothing when nothing is picked", () => {
    expect(channelsForOutcomes(FLEET_CAT, [])).toEqual([]);
  });

  it("offers nothing when the catalogue stops publishing the channel we run", () => {
    expect(channelsForOutcomes(cat([GOOGLE_ADS]), ["signup"])).toEqual([]);
  });
});

describe("funnelInternalRungKeys", () => {
  // What a funnel CONVERTS: the entry is what the channel delivers and the sale is
  // where every funnel ends, so neither is something a visitor asks for.
  it("drops the entry rung and the sale", () => {
    expect(funnelInternalRungKeys("sales_meetings_from_conversation", FLEET_CAT)).toEqual([
      "meeting_booked",
      "meeting_attended",
    ]);
    expect(funnelInternalRungKeys("website_purchases", FLEET_CAT)).toEqual(["signup"]);
    expect(funnelInternalRungKeys("form_magnet", FLEET_CAT)).toEqual(["form_submitted"]);
    expect(funnelInternalRungKeys("sales_from_conversation", FLEET_CAT)).toEqual([]);
    expect(funnelInternalRungKeys("sales_from_website", FLEET_CAT)).toEqual([]);
  });
});

describe("funnelsForChannels", () => {
  const pathsFor = (picks: string[]) =>
    funnelsForChannels([COLD_EMAIL], picks, FLEET_CAT).map((p) => p.funnelKey);

  // THE OWNER'S OWN TABLE, verbatim. A funnel is offered when a picked outcome is a
  // rung of it strictly between the entry and the sale.
  it("offers a funnel when a pick is a rung between its entry and the sale", () => {
    expect(pathsFor(["meeting_booked"])).toEqual([
      "sales_meetings_from_conversation",
      "sales_meetings_from_website",
    ]);
    expect(pathsFor(["meeting_booked", "signup"])).toEqual([
      "sales_meetings_from_conversation",
      "sales_meetings_from_website",
      "website_purchases",
    ]);
    expect(pathsFor(["signup"])).toEqual(["website_purchases"]);
    expect(pathsFor(["form_submitted"])).toEqual(["form_magnet"]);
  });

  // Until the producer publishes the rung, the direct visit-to-sale funnel IS the
  // purchase; once it does, the same funnel matches on its own internal rung.
  it("matches the purchase on the direct visit-to-sale funnel, wire or no wire", () => {
    expect(pathsFor(["purchase"])).toEqual(["sales_from_website"]);
    expect(pathsFor(["signup", "purchase"])).toEqual(["website_purchases", "sales_from_website"]);

    const PURCHASE: CatalogueStep = { key: "purchase", label: "Purchase", description: "" };
    const published: StartCatalogue = {
      ...FLEET_CAT,
      steps: [...WIRE_STEPS, PURCHASE],
      funnels: FLEET_CAT.funnels.map((f) =>
        f.key === "sales_from_website"
          ? { ...f, steps: ["Website visit", "Purchase", "Paid client"] }
          : f,
      ),
      legs: [
        ...FLEET_CAT.legs.filter((l) => l.legKey !== "website_visit_to_paid_client"),
        { legKey: "website_visit_to_purchase", fromStep: VISIT, toStep: PURCHASE, funnelKeys: ["sales_from_website"] },
        { legKey: "purchase_to_paid_client", fromStep: PURCHASE, toStep: PAID, funnelKeys: ["sales_from_website"] },
      ],
    };
    expect(funnelInternalRungKeys("sales_from_website", published)).toEqual(["purchase"]);
    expect(
      funnelsForChannels([COLD_EMAIL], ["purchase"], published).map((p) => p.funnelKey),
    ).toEqual(["sales_from_website"]);
  });

  // A funnel with nothing between its entry and the sale converts nothing a visitor
  // can name, so no pick reaches it.
  it("never offers the reply-to-sale funnel, whatever is picked", () => {
    for (const picks of [["meeting_booked"], ["signup"], ["form_submitted"], ["purchase"], [...START_OUTCOME_KEYS]]) {
      expect(pathsFor(picks), picks.join("+")).not.toContain("sales_from_conversation");
    }
  });

  // A funnel whose ENTRY is the picked step is not offered by it: the channel would
  // have to deliver that step from nothing, and ours does not.
  it("does not offer a funnel whose ENTRY is the pick", () => {
    const adBooker = channel({ slug: "ads", salesFunnels: [funnel("sales_meetings_from_ads", "Sales Meeting from Ads", ["Meeting booked", "Meeting attended", "Paid client"])] });
    const keys = funnelsForChannels([adBooker], ["meeting_booked"], FLEET_CAT).map((p) => p.funnelKey);
    expect(keys).toEqual([]);
  });

  it("carries the (funnel x channel) identity in the key, so the pair is what is bought", () => {
    const rows = funnelsForChannels([COLD_EMAIL], ["signup"], FLEET_CAT);
    expect(rows.map((r) => r.key)).toEqual([`website_purchases::${DEFAULT_CHANNEL_SLUG}`]);
    expect(rows[0].channelSlug).toBe(DEFAULT_CHANNEL_SLUG);
    expect(rows[0].funnelName).toBe("Signups");
    expect(rows[0].dailyOperatingCostCents).toBe(100);
    expect(rows[0].effectiveMinimumCommitmentDays).toBe(30);
  });

  it("offers nothing when nothing is picked", () => {
    expect(pathsFor([])).toEqual([]);
  });
});

describe("funnelReachesOutcome", () => {
  it("is the rule the funnel screen filters on", () => {
    expect(funnelReachesOutcome("website_purchases", ["signup"], FLEET_CAT)).toBe(true);
    expect(funnelReachesOutcome("website_purchases", ["meeting_booked"], FLEET_CAT)).toBe(false);
    expect(funnelReachesOutcome("sales_from_website", ["purchase"], FLEET_CAT)).toBe(true);
    expect(funnelReachesOutcome("sales_from_conversation", ["purchase"], FLEET_CAT)).toBe(false);
  });
});

describe("funnelRungs", () => {
  it("returns each rung as a step with the producer's words, in order", () => {
    expect(funnelRungs("sales_meetings_from_conversation", FLEET_CAT).map((s) => s.key)).toEqual(
      funnelRungKeys("sales_meetings_from_conversation", FLEET_CAT),
    );
    expect(funnelRungs("form_magnet", FLEET_CAT).map((s) => s.label)).toEqual([
      "Website visit",
      "Form submitted",
      "Paid client",
    ]);
  });
});

describe("funnelRungKeys", () => {
  it("walks a funnel's rungs in order, off the producer's legs", () => {
    expect(funnelRungKeys("form_magnet", FLEET_CAT)).toEqual([
      "website_visit",
      "form_submitted",
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
    { funnelKey: "form_magnet", channelSlug: DEFAULT_CHANNEL_SLUG },
    { funnelKey: "form_magnet", channelSlug: "google-ads" },
    { funnelKey: "website_purchases", channelSlug: DEFAULT_CHANNEL_SLUG },
  ];

  it("passes a pair key through untouched", () => {
    expect(pairKeysFromSelection([`form_magnet::${DEFAULT_CHANNEL_SLUG}`], pairs)).toEqual([
      `form_magnet::${DEFAULT_CHANNEL_SLUG}`,
    ]);
  });

  // The cookie is NOT version-bumped for the pair reshape: a bump drops every stored
  // selection, and one field it carries is `paid` -- the only record that money was taken
  // between the charge and the brand's creation. Dropping it asks somebody to pay twice.
  it("reads a FUNNEL-keyed selection as every pair of that funnel", () => {
    expect(pairKeysFromSelection(["form_magnet"], pairs).sort()).toEqual([
      "form_magnet::google-ads",
      `form_magnet::${DEFAULT_CHANNEL_SLUG}`,
    ].sort());
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

  // The purchase mapping is derived from a funnel's RUNGS, never from its key: the
  // producer is reshaping that funnel, and a key would have to be edited when it does.
  it("names no funnel key for the purchase case", () => {
    for (const key of WIRE_FUNNELS.map((f) => f.key)) expect(SRC, key).not.toContain(key);
  });

  // The channel screen is gone, and so are the helpers that only it reached.
  it("carries nothing left over from the channel screen", () => {
    for (const gone of ["channelGroups", "FAMILY_LABEL", "unsoldBoughtFunnels", "entryStepsFor"]) {
      expect(SRC, gone).not.toContain(gone);
    }
  });
});
