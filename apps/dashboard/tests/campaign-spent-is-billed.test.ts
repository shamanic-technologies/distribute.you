import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

// 2026-10-06 (Legistai, campaign "jubilation"): the campaign page read "Spent $67" over 185
// emails. $67 was COMMITTED: billed spend plus the follow-ups reserved when the first email
// went out and not sent yet. "Spent" states the billed figure and the provisioned follow-ups
// stand under it ("+$22 provisioned for follow-ups", owner), both served by features-service's
// campaign window (#1363). Nothing is subtracted in the browser.
const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
const api = read("src/lib/api.ts");
const win = read("src/lib/revenue-window.ts");
const page = read("src/components/v2/campaign-page.tsx");
const channel = read("src/components/v2/offer-channel-page.tsx");
const table = read("src/components/v2/offer-campaigns-page.tsx");

describe("campaign money: Spent is billed, provisioned follow-ups stated apart", () => {
  it("reads the campaign window, net, since inception", () => {
    const reader = api.slice(api.indexOf("export async function getCampaignRevenueWindow("), api.indexOf("export function keepLastGoodFeatureRevenue("));
    expect(reader).toContain('new URLSearchParams({ brandId, campaignId, pricing: "net", windowDays: String(days) })');
    expect(win).toContain("provisionedSpentCents: z.number().optional(),");
    expect(channel).toContain("getCampaignRevenueWindow(slug, brandId, campaignId, SINCE_INCEPTION)");
  });

  it("the Spent tile states actual, the provisioned follow-ups on their own line", () => {
    const tile = page.slice(page.indexOf("export function SpentTile("), page.indexOf("const CAMPAIGN_ROI_TIP"));
    expect(tile).toContain('<StatTile label="Spent">');
    expect(tile).toContain("formatCentsAsUsdAdaptive(spend.actualSpentCents)");
    expect(tile).toContain("+{formatCentsAsUsdAdaptive(provisioned)} provisioned for follow-ups");
    expect(tile).not.toMatch(/totalSpentCents\s*-|-\s*spend\.actualSpentCents/);
    // Both overviews (cold email and conversation campaigns) use it.
    expect(page.match(/<SpentTile win=\{win\} \/>/g)?.length).toBe(2);
  });

  it("the campaigns table keeps $ Invested (committed) and states the billed part under it", () => {
    expect(table).toContain("{formatUsdAdaptive(g.actualCostUsd)} spent");
  });
});
