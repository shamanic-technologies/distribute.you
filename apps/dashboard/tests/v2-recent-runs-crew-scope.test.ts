import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");

/**
 * A brand's run ledger also holds runs no crew made (CRM page reads, gateway
 * requests). The Crew page's "Recent runs" and Today's "Crew activity" list crew
 * work only, so the read is narrowed SERVER-side to the missions' campaigns:
 * filtering a bounded page in the browser lets 60 CRM reads fill it.
 */
describe("v2 recent runs are crew runs", () => {
  const runs = src("components/v2/runs.ts");
  const api = src("lib/api.ts");

  it("the ledger reader forwards campaignIds to runs-service", () => {
    const fn = api.slice(api.indexOf("export async function listBrandRunLedger("));
    expect(fn).toContain('query.set("campaignIds", opts.campaignIds.join(","))');
  });

  it("useRecentRuns asks for the missions' campaigns and waits until they are known", () => {
    const fn = runs.slice(runs.indexOf("export function useRecentRuns("), runs.indexOf("export function missionCampaignIds("));
    expect(fn).toContain("campaignIds: ids");
    expect(fn).toContain("ids !== null");
    expect(fn).not.toMatch(/listBrandRunLedger\(brandId, \{ limit \}\)/);
  });

  it("both surfaces pass the mission campaign ids", () => {
    expect(src("components/v2/crew-page.tsx")).toContain("useRecentRuns(brandId, settled ? missionCampaignIds(missions, missionByCampaignId) : null");
    expect(src("components/v2/today-page.tsx")).toContain("useRecentRuns(brandId, missionsSettled ? missionCampaignIds(missions, missionByCampaignId) : null");
  });

  it("the crew hash pre-selects that crew's runs", () => {
    const page = src("components/v2/crew-page.tsx");
    const fn = page.slice(page.indexOf("function RecentRuns("));
    expect(fn).toContain("window.location.hash");
    expect(fn).toContain('addEventListener("hashchange"');
  });
});
