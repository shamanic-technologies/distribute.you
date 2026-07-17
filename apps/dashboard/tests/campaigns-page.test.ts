import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

/**
 * Campaigns page (v2, campaign-centered) — a staff/god-mode PREVIEW that
 * re-introduces the campaign concept. Guards the load-bearing invariants:
 *  - gated on the STAFF allowlist (isAdmin), both the nav entry and the page body;
 *  - every displayed stat is a READY features-service field (pipeline / $CAC / ROI
 *    / %CAC) — the page renders, never computes a cost metric client-side
 *    (CLAUDE.md: a displayed stat is features-service-owned);
 *  - reveal-on-settle so a failed gate query can't eternal-skeleton.
 */
describe("Campaigns page (staff-gated v2 preview)", () => {
  const page = read("components/campaigns/campaigns-page.tsx");
  const sidebar = read("components/context-sidebar.tsx");
  const api = read("lib/api.ts");
  const hook = read("lib/use-admin-user.ts");

  it("has a staff (god-mode) gate hook backed by isAdminEmail", () => {
    expect(hook).toContain("isAdminEmail");
    expect(hook).toContain("export function useIsAdminUser");
  });

  it("sidebar gates the Campaigns entry on isAdmin + carries a beta badge", () => {
    expect(sidebar).toContain("useIsAdminUser");
    expect(sidebar).toContain("const isAdmin = useIsAdminUser()");
    expect(sidebar).toContain("campaignsOk");
    // The nav entry + its beta badge.
    expect(sidebar).toContain('id: "campaigns"');
    expect(sidebar).toContain("/campaigns`");
  });

  it("page body gates on isAdmin (staff-only preview)", () => {
    expect(page).toContain("useIsAdminUser");
    expect(page).toContain("if (!isAdmin)");
    expect(page).toContain("Not available");
  });

  it("reads per-campaign stats from the features-service grouped reader", () => {
    expect(page).toContain("getFeatureRevenueByCampaign");
    expect(api).toContain("export async function getFeatureRevenueByCampaign");
    expect(api).toContain("groupBy: \"campaignId\"");
  });

  it("renders all four campaign stats from server fields, no client cost math", () => {
    // Fields come straight off the features-service group.
    expect(page).toContain("totalPipelineUsd");
    expect(page).toContain("costPerConversionUsd");
    expect(page).toContain("roiMultiple");
    expect(page).toContain("costOfAcquisitionPct");
    // No client-side cost derivation (the CPC-incident rule): no dividing a cost
    // by a count, no reduce-summing a cost breakdown.
    expect(page).not.toMatch(/actualCostUsd\s*\/\s*/);
    expect(page).not.toMatch(/\.reduce\(/);
  });

  it("global header blended pipeline + CAC read the brand-level revenue field, not a client sum", () => {
    expect(page).toContain("brandRevenueQ.data?.totalPipelineUsd");
    expect(page).toContain("brandRevenueQ.data?.costEconomics.costPerConversionUsd");
  });

  it("reveals on settle (resolved OR errored) so a failed query can't eternal-skeleton", () => {
    expect(page).toContain("brandRevenueQ.isError");
    expect(page).toContain("campaignsQ.isError");
    expect(page).toContain("groupsQ.isError");
    expect(page).toContain("headerSettled");
    expect(page).toContain("tableSettled");
  });
});
