import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { formatUsdUnit } from "../src/lib/format-number";
import { SalesFunnelCampaignListSchema, orderPipesByFunnel } from "../src/lib/sales-funnel-campaigns";
import { OfferOutcomeCostSeriesSchema, unlistedLedgerOutcomes } from "../src/lib/v2/outcome-cost-series";

// BACKLINK-ENGINE-1109: a campaign launched on its TARGET alone (campaign-service #883) has one part run by the
// target's Engine, with no feature slug, no step pair and no catalogue id (all null). Before, the dashboard refused
// the brand's whole campaign list over that one part, and the outcome never showed. Keyed on what is served, never
// on an outcome, brand or campaign.

const BASE = {
  orgId: "o1",
  brandId: "b1",
  offerId: "of1",
  status: "ongoing",
  stopReason: null,
  createdAt: "2026-11-09T20:23:23.504Z",
  updatedAt: "2026-11-09T20:23:48.204Z",
};

// The served body (2026-11-09), trimmed: a target-only campaign beside a campaign of the usual shape.
const BODY = {
  salesFunnelCampaigns: [
    {
      ...BASE,
      id: "f-target",
      salesFunnelId: "backlink_earned",
      salesFunnelName: "Backlink earned",
      target: "backlink_earned",
      mode: "proactive",
      units: [
        { campaignId: "u-target", pipeId: null, featureSlug: null, legKey: null, status: "ongoing", workflowSlug: "engine:backlink_earned", name: "Backlink earned", salesFunnelId: "backlink_earned", planRole: null },
      ],
    },
    {
      ...BASE,
      id: "f-email",
      salesFunnelId: "cold-email",
      salesFunnelName: "Cold email to meetings",
      target: "meeting_booked",
      mode: "proactive",
      units: [
        { campaignId: "u-email", pipeId: "p1", featureSlug: "sales-cold-email-outreach", legKey: "start_to_conversation", status: "ongoing", workflowSlug: "cold-email-v3", name: "Cold email" },
      ],
    },
  ],
};

describe("a campaign launched on its target alone", () => {
  it("parses beside a campaign of the usual shape, every field as served", () => {
    const parsed = SalesFunnelCampaignListSchema.parse(BODY).salesFunnelCampaigns;
    expect(parsed).toHaveLength(2);
    const target = parsed[0].units[0];
    expect([target.pipeId, target.featureSlug, target.legKey]).toEqual([null, null, null]);
    expect(target.workflowSlug).toBe("engine:backlink_earned");
    expect(parsed[0].target).toBe("backlink_earned");
    expect(parsed[0].salesFunnelName).toBe("Backlink earned");
    expect(parsed[1].units[0].legKey).toBe("start_to_conversation");
  });

  it("keeps its part when the parts are put in order", () => {
    const parsed = SalesFunnelCampaignListSchema.parse(BODY).salesFunnelCampaigns;
    const units = [...parsed[0].units, ...parsed[1].units];
    const legs: Record<string, { fromKey: string | null; toKey: string }> = { start_to_conversation: { fromKey: null, toKey: "conversation" } };
    const ordered = orderPipesByFunnel(units, (u) => (u.legKey ? legs[u.legKey] ?? null : null));
    expect(ordered.map((u) => u.campaignId).sort()).toEqual(["u-email", "u-target"]);
  });

  it("its outcome shows from the brand ledger next to an outcome a usual campaign lands on", () => {
    const series = OfferOutcomeCostSeriesSchema.parse({
      brandId: "b1",
      pricing: "net",
      firstSpendDay: "2026-11-09",
      steps: [],
      ledgerOutcomes: [
        { outcomeKey: "backlink_earned", units: 29, ourUnits: 29, costPerUnitUsd: 0.0018, costPerUnitUnavailableReason: null, productionCostUsd: 0.0527, daily: [{ date: "2026-11-09", units: 29, ourUnits: 29 }] },
        { outcomeKey: "lead_conversation", units: 4, ourUnits: 4, costPerUnitUsd: 2, costPerUnitUnavailableReason: null, productionCostUsd: 8, daily: [] },
      ],
    });
    // The usual campaign's outcome (Positive replies) is its own row; its Units' lead state is not listed twice.
    const out = unlistedLedgerOutcomes(series, new Set(["conversation"]), (k) => (k === "conversation" ? "lead_conversation" : null));
    expect(out.map((o) => [o.outcomeKey, o.units, o.productionCostUsd])).toEqual([["backlink_earned", 29, 0.0527]]);
  });
});

describe("what the prod render of Distribute.you's Outcomes showed (BACKLINK-ENGINE-1109)", () => {
  const read = (rel: string) => readFileSync(join(__dirname, "..", "src", rel), "utf8");

  it("every step icon the public catalogue serves today is drawn, never the blank circle", () => {
    const mark = read("components/v2/catalogue-mark.tsx");
    for (const icon of ["link", "chat-circle-dots", "queue", "envelope-open", "newspaper", "check-circle", "whatsapp-logo", "x-logo"]) {
      expect(mark, icon).toContain(`"${icon}": `);
    }
  });

  it("a sub-cent price per Unit keeps its digits ($0.0018 per backlink, never $0.00)", () => {
    expect(formatUsdUnit(0.0018)).toBe("$0.0018");
    expect(read("components/v2/outcomes-page.tsx")).toContain("formatUsdUnit(lo.costPerUnitUsd)");
    expect(read("components/v2/outcome-stats.tsx")).toContain("formatUsdUnit(lo.costPerUnitUsd)");
  });

  it("the sidebar lists a published outcome once, as the Overview does", () => {
    expect(read("components/v2/v2-shell.tsx")).toContain("if (published.withRows.some((p) => p.key === outcome.key)) return null;");
  });
});
