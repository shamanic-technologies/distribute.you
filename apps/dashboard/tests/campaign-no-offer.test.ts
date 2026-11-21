/**
 * DISTRY-CALL-IS-CAMPAIGN-1121 (owner 2026-11-21): a campaign is Target + start + budget + brief; the offer is
 * optional. A campaign naming NO offer parses, lists and opens like any other; one naming an offer is unchanged.
 * Its caps are never asked at `/offers/null/...` (billing serves no offer-less caps route yet).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SalesFunnelCampaignListSchema, SalesFunnelCampaignOneSchema, capsOfferId, LIMITS_NOT_AVAILABLE } from "../src/lib/sales-funnel-campaigns";
import { CampaignTargetsSchema, targetsOfOffer } from "../src/lib/campaign-targets";
import { FunnelCampaignSpendChartsSchema } from "../src/lib/spend-charts";

const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

const campaign = (id: string, offerId: string | null) => ({
  id,
  orgId: "org",
  brandId: "brand",
  offerId,
  salesFunnelId: "backlink_earned",
  salesFunnelName: "Backlink earned",
  status: "ongoing",
  stopReason: null,
  target: "backlink_earned",
  createdAt: "2026-11-21T10:00:00.000Z",
  updatedAt: "2026-11-21T10:00:00.000Z",
  units: [{ campaignId: `${id}-u`, pipeId: null, featureSlug: null, legKey: null, status: "ongoing", workflowSlug: null, name: "Backlink earned" }],
});

describe("a sales funnel campaign naming no offer", () => {
  it("parses beside one naming an offer: one no-offer row never fails the list", () => {
    const list = SalesFunnelCampaignListSchema.parse({ salesFunnelCampaigns: [campaign("a", "offer-1"), campaign("b", null)] }).salesFunnelCampaigns;
    expect(list.map((c) => c.offerId)).toEqual(["offer-1", null]);
    expect(SalesFunnelCampaignOneSchema.parse({ salesFunnelCampaign: campaign("b", null) }).salesFunnelCampaign.offerId).toBeNull();
  });
  it("still refuses a row with no offerId field at all (fail loud, no placeholder)", () => {
    const { offerId: _o, ...noField } = campaign("c", null);
    expect(SalesFunnelCampaignListSchema.safeParse({ salesFunnelCampaigns: [noField] }).success).toBe(false);
  });
  it("asks caps under its offer when it names one, never when it names none", () => {
    expect(capsOfferId({ offerId: "offer-1" })).toBe("offer-1");
    expect(capsOfferId({ offerId: null })).toBeNull();
    expect(LIMITS_NOT_AVAILABLE).toBe("Limits not available yet");
  });
});

describe("features-service reads echoing a campaign's offerId", () => {
  const targetRow = (id: string, offerId: string | null) => ({
    salesFunnelCampaignId: id,
    name: "Backlinks",
    offerId,
    target: null,
    outcomesToDate: 0,
    outcomesUnavailableReason: null,
    spentUsd: 0,
    costPerOutcomeUsd: null,
    costPerOutcomeUnavailableReason: null,
    measuredReturn: { roiMultiple: null, valueUsd: null, spentUsd: 0, unavailableReason: null },
    past: [],
    pastUnavailableReason: null,
    projection: {
      planComputedAt: null,
      planFunnelId: null,
      costPerTargetUsd: null,
      costPerTargetBasis: null,
      spendPerDayUsd: null,
      spendPerDaySource: null,
      outcomesPerDay: null,
      daily: [],
      nextExpectedAt: null,
      nextExpectedInHours: null,
      unavailableReason: "no_plan",
    },
  });
  it("campaign targets: a no-offer row parses, the brand view keeps it, an offer's view does not", () => {
    const body = CampaignTargetsSchema.parse({ brandId: "b", pricing: "net", computedAt: "x", targets: [targetRow("a", "o1"), targetRow("b", null)], offerTargets: [] });
    expect(targetsOfOffer(body.targets, null).map((r) => r.salesFunnelCampaignId)).toEqual(["a", "b"]);
    expect(targetsOfOffer(body.targets, "o1").map((r) => r.salesFunnelCampaignId)).toEqual(["a"]);
  });
  it("campaign spend charts: offerId null parses", () => {
    expect(FunnelCampaignSpendChartsSchema.shape.offerId.safeParse(null).success).toBe(true);
    expect(FunnelCampaignSpendChartsSchema.shape.offerId.safeParse("o1").success).toBe(true);
  });
});

describe("no caps URL is ever built with a null offer", () => {
  it("every caps reader is disabled for a campaign naming no offer", () => {
    const funnel = src("src/components/v2/funnel-campaigns.tsx");
    expect(funnel).toContain("{ ...pollOptions, enabled: offerId !== null }");
    expect(funnel).toContain("enabled: !!campaign && capsOfferId(campaign) !== null");
    expect(funnel).toContain("if (limitsDirty && capsOffer !== null)");
    expect(src("src/components/v2/campaigns-overview-page.tsx")).toContain("enabled: gate && capsOfferId(c) !== null");
    expect(src("src/components/v2/campaign-page-next.tsx")).toContain("{ ...pollOptions, enabled: capsOfferId(campaign) !== null }");
  });
  it("a no-offer campaign shows its limits as not available yet, never a shimmer that never settles", () => {
    const funnel = src("src/components/v2/funnel-campaigns.tsx");
    expect(funnel).toContain("const capsSettled = noCaps || caps.data !== undefined");
    expect(funnel).toContain("capsOfferId(campaign) === null || caps.data !== undefined");
    expect(src("src/components/v2/campaigns-overview-page.tsx")).toContain("capsOfferId(c) === null || capsQs[i]?.data !== undefined");
  });
  it("unit campaigns naming no offer are listed like any other", () => {
    const uc = src("src/components/v2/use-campaigns.ts");
    expect(uc).not.toContain("if (!c.offerId || !c.featureSlug) return [];");
    expect(uc).toContain("offerId: string | null;");
  });
});
