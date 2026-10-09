import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  canonicalLegKey,
  featureLegId,
  isProactiveFrom,
  legKeyTwin,
  outboundRenameDrift,
  sameLegKey,
} from "../src/lib/outbound-leg-key";
import { campaignNameFor, crewNameFor, legCatalogueFromWire, legFor } from "../src/lib/legs";
import { campaignKey, campaignsOfOffer } from "../src/lib/offer-campaigns";
import { campaignSavedCents } from "../src/lib/campaign-budget";
import { buildControlRows, type ControlCampaign } from "../src/lib/campaign-controls";
import { acquisitionChannelsFromFeatures } from "../src/lib/acquisition-channels";
import { legCampaignId } from "../src/lib/v2/leg-campaign";
import { legRateFor, validatedLegSections } from "../src/lib/offer-channel-settings";
import { plannedKey } from "../src/lib/v2/get-started";
import { NEW_ORG_LEGS } from "../src/lib/v2/new-org-wizard";
import { OFFERED_CREWS, crewTrigger } from "../src/lib/v2/crews";

// The outbound leg rename (owner 2026-10-09): every backend migrates on its own day, so
// one join may read the legacy spelling on one side and the new one on the other. Every
// fixture below is run in BOTH directions.

const COLD = "sales-cold-email-outreach";
const ADS = "google-ads";
const LEGACY_REPLY = "start_to_conversation";
const NEW_REPLY = "lead_found_to_conversation";
const LEGACY_VISIT = "start_to_website_visit";
const NEW_VISIT = "lead_found_to_website_visit";
const BOTH = [
  ["legacy producer, new consumer", LEGACY_REPLY, NEW_REPLY],
  ["new producer, legacy consumer", NEW_REPLY, LEGACY_REPLY],
] as const;

describe("the helper", () => {
  it("canonicalizes an outbound leg to the new spelling, any other feature verbatim", () => {
    expect(canonicalLegKey(COLD, LEGACY_REPLY)).toBe(NEW_REPLY);
    expect(canonicalLegKey(COLD, LEGACY_VISIT)).toBe(NEW_VISIT);
    expect(canonicalLegKey(COLD, NEW_VISIT)).toBe(NEW_VISIT);
    expect(canonicalLegKey("cold-linkedin-outreach", LEGACY_REPLY)).toBe(NEW_REPLY);
    // google-ads keeps start_to_website_visit; sourcing keeps start_to_lead_found.
    expect(canonicalLegKey(ADS, LEGACY_VISIT)).toBe(LEGACY_VISIT);
    expect(canonicalLegKey("apollo-cold-filters", "start_to_lead_found")).toBe("start_to_lead_found");
    expect(canonicalLegKey(COLD, "conversation_to_meeting_booked")).toBe("conversation_to_meeting_booked");
    expect(canonicalLegKey(null, LEGACY_REPLY)).toBe(LEGACY_REPLY);
    expect(canonicalLegKey(COLD, null)).toBeNull();
  });
  it("pairs the two spellings and nothing else", () => {
    expect(legKeyTwin(LEGACY_VISIT)).toBe(NEW_VISIT);
    expect(legKeyTwin(NEW_REPLY)).toBe(LEGACY_REPLY);
    expect(legKeyTwin("start_to_lead_found")).toBeNull();
    expect(sameLegKey(LEGACY_REPLY, NEW_REPLY)).toBe(true);
    expect(sameLegKey(NEW_REPLY, LEGACY_REPLY)).toBe(true);
    expect(sameLegKey(LEGACY_REPLY, NEW_VISIT)).toBe(false);
    expect(sameLegKey(null, NEW_VISIT)).toBe(false);
    expect(featureLegId(COLD, LEGACY_REPLY)).toBe(featureLegId(COLD, NEW_REPLY));
    expect(featureLegId(ADS, LEGACY_VISIT)).not.toBe(featureLegId(ADS, NEW_VISIT));
  });
  it("reads a leg starting on a found lead as proactive, like features-service", () => {
    expect(isProactiveFrom(null)).toBe(true);
    expect(isProactiveFrom("lead_found")).toBe(true);
    expect(isProactiveFrom("conversation")).toBe(false);
  });
  it("reports drift from the served correspondence and channel types, and none when in step", () => {
    const served = [
      { legacyLegKey: LEGACY_REPLY, legKey: NEW_REPLY },
      { legacyLegKey: LEGACY_VISIT, legKey: NEW_VISIT },
    ];
    expect(outboundRenameDrift(served, new Map([[COLD, "outbound"], [ADS, "paid"]]))).toEqual([]);
    expect(outboundRenameDrift([served[0]], null)).toHaveLength(1);
    expect(outboundRenameDrift(served, new Map([["cold-tiktok-outreach", "outbound"]]))).toHaveLength(1);
    expect(outboundRenameDrift(undefined, null)).toEqual([]);
  });
});

describe("the leg catalogue joins either spelling", () => {
  const wire = (legKey: string) => ({
    legs: [{ legKey, fromStep: null, toStep: { key: "conversation", label: "Positive reply" } }],
    channels: [
      { slug: COLD, stepTransitions: [{ legKey, from: null, to: { key: "conversation" }, crewName: "Herald", campaignName: "Jubilation" }] },
      { slug: ADS, stepTransitions: [{ legKey: LEGACY_VISIT, from: null, to: { key: "website_visit" }, campaignName: "Beacon" }] },
    ],
  });
  for (const [label, served, asked] of BOTH) {
    it(`names, crews and finds the leg (${label})`, () => {
      const cat = legCatalogueFromWire(wire(served));
      expect(campaignNameFor(cat, COLD, asked)).toBe("Jubilation");
      expect(crewNameFor(cat, COLD, asked)).toBe("Herald");
      expect(legFor(cat, asked)?.toKey).toBe("conversation");
    });
  }
  it("never renames a non-outbound leg", () => {
    const cat = legCatalogueFromWire(wire(LEGACY_REPLY));
    expect(campaignNameFor(cat, ADS, LEGACY_VISIT)).toBe("Beacon");
    expect(campaignNameFor(cat, ADS, NEW_VISIT)).toBeNull();
  });
  it("logs when the served rename drifts from the locked copy", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    legCatalogueFromWire({ ...wire(LEGACY_REPLY), legKeyCorrespondence: [{ legacyLegKey: LEGACY_REPLY, legKey: "x" }] });
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe("offer campaigns, budgets and controls join either spelling", () => {
  for (const [label, campaignSide, otherSide] of BOTH) {
    it(`campaignKey and the offer's campaigns (${label})`, () => {
      expect(campaignKey(COLD, campaignSide)).toBe(campaignKey(COLD, otherSide));
      const list = campaignsOfOffer(
        [{ channelSlug: COLD, channelName: "Cold email", legKey: campaignSide, campaignName: "Jubilation", reactive: false, managed: true, operatedBy: "platform", selectedPathCount: 1, roi: null, roiUnavailableReason: null }],
        [{ legs: [{ legKey: otherSide, fromStep: null, toStep: { label: "Positive reply" } }] }],
        (r) => r,
      );
      expect(list.map((c) => c.name)).toEqual(["Jubilation"]);
    });
    it(`a billing ceiling reaches its campaign (${label})`, () => {
      const budgets = { campaigns: [{ offerId: "o1", legKey: otherSide, featureSlug: COLD, dailyBudgetCents: 2500 }] };
      expect(campaignSavedCents({ offerId: "o1", legKey: campaignSide, featureSlug: COLD }, budgets)).toBe(2500);
      const channels = acquisitionChannelsFromFeatures([
        { slug: COLD, name: "Cold email", description: "x", displayOrder: 1, channelType: "outbound", acquisitionChannel: { operatedBy: "platform", stepTransitions: [{ from: null, to: "conversation" }] } },
      ]);
      const campaign: ControlCampaign = { id: "c1", status: "ongoing", legKey: campaignSide, featureSlug: COLD, offerId: "o1", createdAt: "2026-10-01T00:00:00.000Z" };
      const offerable = [{ legKey: otherSide, featureSlug: COLD, channelName: "Cold email", offerId: "o1" }];
      const rows = buildControlRows([campaign], budgets, channels, {}, offerable);
      // One row: the offered channel is the campaign already there, never a second line.
      expect(rows).toHaveLength(1);
      expect(rows[0].savedCents).toBe(2500);
      expect(buildControlRows([campaign], budgets, channels, { legKey: otherSide })).toHaveLength(1);
    });
    it(`the leg's campaign, rate and saved legs (${label})`, () => {
      expect(legCampaignId([{ id: "c1", offerId: "o1", legKey: campaignSide, status: "ongoing", createdAt: "x" }], "o1", otherSide)).toBe("c1");
      expect(legRateFor([{ legKey: campaignSide, effectiveRatePct: 3 }], otherSide)?.effectiveRatePct).toBe(3);
      const catalogue = legCatalogueFromWire({
        legs: [{ legKey: campaignSide, fromStep: null, toStep: { key: "conversation", label: "Positive reply" } }],
        channels: [{ slug: COLD, stepTransitions: [{ legKey: campaignSide, from: null, to: { key: "conversation" } }] }],
      });
      const { sections, unknown } = validatedLegSections(catalogue, [otherSide], [COLD]);
      expect(sections).toHaveLength(1);
      expect(unknown).toEqual([]);
    });
  }
  it("keeps a non-outbound campaign apart from the new spelling", () => {
    expect(campaignKey(ADS, LEGACY_VISIT)).not.toBe(campaignKey(ADS, NEW_VISIT));
    expect(plannedKey({ featureSlug: COLD, legKey: LEGACY_VISIT })).toBe(plannedKey({ featureSlug: COLD, legKey: NEW_VISIT }));
  });
});

describe("what the dashboard writes", () => {
  it("states outbound legs in the new spelling (wizard, crews)", () => {
    expect(NEW_ORG_LEGS.map((l) => l.key)).toEqual([NEW_VISIT, NEW_REPLY]);
    expect(OFFERED_CREWS.filter((c) => c.featureSlug === COLD).map((c) => c.legKey)).toEqual([NEW_REPLY, NEW_VISIT]);
  });
  it("the get-started launch sends the canonical spelling on every write", () => {
    const src = readFileSync(join(__dirname, "..", "src", "components", "v2", "get-started", "launch.ts"), "utf8");
    expect(src).toContain("const legKey = canonicalLegKey(c.featureSlug, c.legKey);");
    expect(src).toContain("{ featureSlug: c.featureSlug, legKey, budgetCents: c.budgetUsd * 100 }");
    expect(src).toContain("startReactiveCampaign({ brandId: input.brandId, offerId, featureSlug: c.featureSlug, legKey })");
    expect(src).toContain("leg: legKey })");
    expect(src).not.toContain("legKey: c.legKey");
  });
  it("a renamed outbound leg still works daily once it starts on a found lead", () => {
    expect(crewTrigger({ fromKey: "lead_found", fromLabel: "Lead found", toKey: "conversation", toLabel: "Positive reply" })?.kind).toBe("daily");
    expect(crewTrigger({ fromKey: "conversation", fromLabel: "Positive reply", toKey: "meeting_booked", toLabel: "Meeting booked" })?.kind).toBe("event");
  });
});
