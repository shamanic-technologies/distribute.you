import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

// 2026-10-06 (Legistai, campaign "jubilation"): the campaign page read "Spent $67" over 185
// emails. $67 was COMMITTED: billed spend plus the follow-ups reserved when the first email
// went out and not sent yet. "Spent" now states the billed figure (features-service
// costEconomics.actualCostUsd) and the committed total stands under it on its own line.
// Both are served; nothing is subtracted in the browser.
const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
const api = read("src/lib/api.ts");
const page = read("src/components/v2/campaign-page.tsx");
const table = read("src/components/v2/offer-campaigns-page.tsx");

describe("campaign money: Spent is billed, reserved follow-ups stated apart", () => {
  it("reads the served billed-only figure off the campaign group", () => {
    expect(api).toContain("actualCostUsd: z.number().nullish(),");
    expect(api).toContain("actualCostUsd: g.costEconomics.actualCostUsd ?? null,");
  });

  it("the Spent tile states actual, the committed total on its own line", () => {
    const tile = page.slice(page.indexOf("export function SpentTile("), page.indexOf("function CampaignOverview("));
    expect(tile).toContain('<StatTile label="Spent">');
    expect(tile).toContain('formatUsdAdaptive(actualUsd)');
    expect(tile).toContain("{formatUsdAdaptive(committedUsd)} with follow-ups reserved");
    expect(tile).not.toContain("committedUsd - actualUsd");
    // Both overviews (cold email and conversation campaigns) use it, never committed under "Spent".
    expect(page.match(/<SpentTile actualUsd=\{g\?\.actualCostUsd \?\? null\} committedUsd=\{g\?\.committedCostUsd \?\? null\} \/>/g)?.length).toBe(2);
    expect(page).not.toMatch(/label="Spent">\s*<Figure value=\{g\?\.committedCostUsd/);
  });

  it("the campaigns table keeps $ Invested (committed) and states the billed part under it", () => {
    expect(table).toContain("{formatUsdAdaptive(g.actualCostUsd)} spent");
  });
});
