/**
 * DISTRY-CALL-IS-CAMPAIGN-1121 (owner 2026-11-21): a campaign is Target + start + budget + brief; the offer is
 * optional. A campaign naming NO offer parses, lists and opens like any other; one naming an offer is unchanged.
 * Its caps are read and written through billing's offer-less campaign route, never `/offers/null/...`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SalesFunnelCampaignListSchema, SalesFunnelCampaignOneSchema, campaignCapsPath, campaignCapsKey } from "../src/lib/sales-funnel-campaigns";
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
  it("reads its caps through the offer-less campaign route; an offer campaign keeps its exact path and key", () => {
    const base = { id: "sfc-1", brandId: "brand-1", salesFunnelId: "backlink_earned" };
    expect(campaignCapsPath({ ...base, offerId: null })).toBe("/brands/brand-1/sales-funnels/backlink_earned/campaigns/sfc-1/caps");
    expect(campaignCapsPath({ ...base, offerId: "offer-1" })).toBe("/brands/brand-1/offers/offer-1/sales-funnels/backlink_earned/caps");
    expect(campaignCapsPath({ ...base, offerId: null })).not.toContain("/offers/");
    expect(campaignCapsKey({ ...base, offerId: "offer-1" })).toEqual(["salesFunnelCaps", "brand-1", "offer-1", "backlink_earned"]);
    expect(campaignCapsKey({ ...base, offerId: null })).toEqual(["salesFunnelCaps", "brand-1", null, "backlink_earned", "sfc-1"]);
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

describe("every campaign reads and writes its caps, offer or not", () => {
  it("the caps API reads and writes at the campaign's caps path", () => {
    const api = src("src/lib/api.ts");
    const get = api.slice(api.indexOf("export async function getCampaignCaps("), api.indexOf("export async function saveCampaignCaps("));
    expect(get).toContain("apiCall<unknown>(campaignCapsPath(c))");
    const save = api.slice(api.indexOf("export async function saveCampaignCaps("), api.indexOf("// ─── Copilot skill tree"));
    expect(save).toContain("apiCall<unknown>(campaignCapsPath(c), {");
    expect(save).toContain('method: "PUT"');
  });
  it("every caps reader asks the campaign's caps with no offer gate, and the modal saves them", () => {
    const funnel = src("src/components/v2/funnel-campaigns.tsx");
    expect(funnel).toContain("useAuthQuery(campaignCapsKey(c), () => getCampaignCaps(c), pollOptions)");
    expect(funnel).toContain("await saveCampaignCaps(campaign, {");
    expect(funnel).toContain("qc.setQueryData(campaignCapsKey(campaign), data)");
    expect(src("src/components/v2/campaigns-overview-page.tsx")).toContain("queryFn: () => getCampaignCaps(c),");
    expect(src("src/components/v2/campaign-page-next.tsx")).toContain("useAuthQuery(campaignCapsKey(campaign), () => getCampaignCaps(campaign), pollOptions)");
    expect(src("src/components/v2/staff-campaign-pages.tsx")).toContain("() => getCampaignCaps(c!)");
  });
  it("no surface keeps the 'Limits not available yet' state", () => {
    for (const f of ["src/components/v2/funnel-campaigns.tsx", "src/components/v2/campaigns-overview-page.tsx", "src/components/v2/campaign-page-next.tsx", "src/lib/sales-funnel-campaigns.ts"]) {
      expect(src(f)).not.toContain("LIMITS_NOT_AVAILABLE");
      expect(src(f)).not.toContain("capsOfferId");
    }
  });
  it("unit campaigns naming no offer are listed like any other", () => {
    const uc = src("src/components/v2/use-campaigns.ts");
    expect(uc).not.toContain("if (!c.offerId || !c.featureSlug) return [];");
    expect(uc).toContain("offerId: string | null;");
  });
});
