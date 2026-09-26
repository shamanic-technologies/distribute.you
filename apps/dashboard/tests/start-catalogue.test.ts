import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  startOutcomes,
  legsTo,
  pairsForOutcomes,
  startPairKey,
  parsePairKey,
  DEFAULT_CHANNEL_SLUG,
  type CatalogueChannel,
  type CatalogueLeg,
  type CatalogueStep,
  type StartCatalogue,
} from "../src/lib/start-catalogue";

// The steps production publishes, in the producer's own words.
const VISIT: CatalogueStep = { key: "website_visit", label: "Website visit", description: "A buyer lands on the site." };
const CONVO: CatalogueStep = { key: "conversation", label: "Positive reply", description: "A buyer answers." };
const MEETING: CatalogueStep = { key: "meeting_booked", label: "Meeting booked", description: "They book time with you." };
const PAID: CatalogueStep = { key: "paid_client", label: "Paid client", description: "" };

const leg = (legKey: string, from: CatalogueStep | null, to: CatalogueStep): CatalogueLeg => ({ legKey, from, to });

const channel = (over: Partial<CatalogueChannel> & { slug: string }): CatalogueChannel => ({
  name: over.slug,
  description: "",
  displayOrder: 1,
  family: "outbound_one_to_one",
  operatedBy: "platform",
  terms: { dailyOperatingCostCents: 100, minimumCommitmentDays: 30, maxDaysToFirstProduction: 14 },
  stepTransitions: [],
  ...over,
});

/** Cold email: it puts a buyer on BOTH entry steps from nothing. */
const COLD_EMAIL = channel({
  slug: DEFAULT_CHANNEL_SLUG,
  name: "Sales Cold Email Outreach",
  displayOrder: 5,
  stepTransitions: [leg("start_to_conversation", null, CONVO), leg("start_to_website_visit", null, VISIT)],
});
/** The booker: it converts a reply into a meeting, an INTERNAL leg. */
const BOOKER = channel({
  slug: "sales-crm-email-outreach",
  name: "Booker",
  displayOrder: 1,
  terms: { dailyOperatingCostCents: 300, minimumCommitmentDays: 0, maxDaysToFirstProduction: 1 },
  stepTransitions: [leg("conversation_to_meeting_booked", CONVO, MEETING)],
});
/** A channel we do not run: never an outcome we offer. */
const GOOGLE_ADS = channel({
  slug: "google-ads",
  stepTransitions: [leg("start_to_website_visit", null, VISIT)],
});
/** A customer-operated channel: their own team's work, not ours. */
const CLOSER = channel({
  slug: "feedback-request-cold-email-outreach",
  operatedBy: "customer",
  stepTransitions: [leg("meeting_booked_to_paid_client", MEETING, PAID)],
});

const cat = (channels: CatalogueChannel[] = [COLD_EMAIL, BOOKER, GOOGLE_ADS, CLOSER]): StartCatalogue => ({
  channels,
  steps: [CONVO, VISIT, MEETING, PAID],
});

describe("startOutcomes", () => {
  it("offers every step one of our channels lands a leg on, the deepest first", () => {
    expect(startOutcomes(cat()).map((o) => o.key)).toEqual(["meeting_booked", "conversation", "website_visit"]);
  });

  it("offers nothing a channel we do not run, or a customer-operated one, produces", () => {
    const keys = startOutcomes(cat()).map((o) => o.key);
    expect(keys).not.toContain("paid_client");
    expect(startOutcomes(cat([GOOGLE_ADS, CLOSER]))).toEqual([]);
  });

  it("reads the producer's own words for a step it publishes", () => {
    const byKey = new Map(startOutcomes(cat()).map((o) => [o.key, o]));
    expect(byKey.get("meeting_booked")?.label).toBe("Meeting booked");
    expect(byKey.get("meeting_booked")?.description).toBe("They book time with you.");
  });
});

describe("legsTo", () => {
  // A booked meeting needs the cold email that produces the reply AND the booker that
  // turns it into a meeting: one leg alone would be a campaign with nothing to work on.
  it("walks back from the outcome to a leg that starts from nothing, entry leg first", () => {
    expect(legsTo("meeting_booked", cat()).map((p) => p.key)).toEqual([
      startPairKey("start_to_conversation", DEFAULT_CHANNEL_SLUG),
      startPairKey("conversation_to_meeting_booked", "sales-crm-email-outreach"),
    ]);
  });

  it("runs a leg several channels perform through the default one", () => {
    const [pair] = legsTo("website_visit", cat());
    expect(pair.channelSlug).toBe(DEFAULT_CHANNEL_SLUG);
    expect(pair.fromKey).toBeNull();
    expect(pair.toKey).toBe("website_visit");
    expect(pair.dailyOperatingCostCents).toBe(100);
  });

  it("answers nothing when the legs cannot be walked back to an entry leg", () => {
    expect(legsTo("meeting_booked", cat([BOOKER]))).toEqual([]);
    expect(legsTo("paid_client", cat())).toEqual([]);
  });
});

describe("pairsForOutcomes", () => {
  it("dedupes the campaigns several outcomes share", () => {
    expect(pairsForOutcomes(["meeting_booked", "conversation"], cat()).map((p) => p.legKey)).toEqual([
      "start_to_conversation",
      "conversation_to_meeting_booked",
    ]);
  });

  it("offers nothing when nothing is picked", () => {
    expect(pairsForOutcomes([], cat())).toEqual([]);
  });
});

describe("pair keys", () => {
  it("round-trips a (leg x channel) identity", () => {
    const key = startPairKey("start_to_conversation", DEFAULT_CHANNEL_SLUG);
    expect(parsePairKey(key)).toEqual({ legKey: "start_to_conversation", channelSlug: DEFAULT_CHANNEL_SLUG });
  });

  it("reads anything that is not a pair key as null", () => {
    for (const bad of ["", "no-separator", "::x", "x::"]) expect(parsePairKey(bad), bad).toBeNull();
  });
});

describe("the outcome list is wire-driven", () => {
  const SRC = readFileSync(new URL("../src/lib/start-catalogue.ts", import.meta.url), "utf8");

  it("keeps no local list of outcomes or funnels", () => {
    for (const gone of ["SALES_FUNNELS", "START_OUTCOME_KEYS", "funnelsForChannels", "channelGroups"]) {
      expect(SRC, gone).not.toContain(gone);
    }
  });
});
