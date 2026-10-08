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

  it("the Crew page passes the mission campaign ids", () => {
    expect(src("components/v2/crew-page.tsx")).toContain("useRecentRuns(brandId, settled ? missionCampaignIds(missions, missionByCampaignId) : null");
  });

  it("Today lists the ON campaigns, not Missions or Crew activity (owner 2026-10-05)", () => {
    const today = src("components/v2/today-page.tsx");
    expect(today).not.toContain("useRecentRuns(");
    expect(today).not.toContain("Crew activity");
    expect(today).toContain("useOngoingCampaigns(orgId, brandId, selectedOfferId)");
    expect(today).toContain(">Campaigns</SectionTitle>");
    // A step no ON campaign works is not stated on Today.
    expect(today).toContain('const showReplies = works("positive_reply");');
    expect(today).toContain('const showVisits = works("website_visit");');
    expect(today).toContain('const showMeetings = works("meeting_booked");');
    expect(today).toContain("{showReplies && (");
    expect(today).toContain("{showVisits && (");
    expect(today).toContain("{showMeetings && (");
    // Each row states the campaign's full definition, the Sales path page's own leg, then its
    // type, budget and what it spent (owner 2026-10-08, reversing 10-05's "no spend": "combien
    // on dépense en proactive ... et en réactif, avec le split des max budgets").
    const line = today.slice(today.indexOf("function CampaignLine("));
    expect(line).toContain("<CampaignLeg campaign={campaign}");
    expect(line).toContain("campaignTag(campaign)");
    expect(line).toContain("m.row.revenue?.committedCostUsd");
    // Name and status on the top line, the definition alone on one line below (owner 2026-10-05).
    expect(line).toContain("<CampaignLeg campaign={campaign} compact />");
    // The stat row spans the full width whatever tiles remain (owner 2026-10-05).
    expect(today).toContain("const statTiles = (4 + (showReplies ? 1 : 0) + (showVisits ? 1 : 0))");
    expect(today).toContain("${STAT_GRID_COLS[statTiles]}");
    expect(today).not.toContain("xl:grid-cols-6\">");
    // Meetings sits above Campaigns.
    expect(today.indexOf("{showMeetings && (")).toBeLessThan(today.indexOf(">Campaigns</SectionTitle>"));
    expect(src("components/v2/offer-campaigns.tsx")).toContain("<CampaignLeg campaign={campaign} showFedBy />");
    // The sidebar reads the same list.
    expect(src("components/v2/v2-shell.tsx")).toContain("useOngoingCampaigns(orgId, brandId, offerId)");
  });

  it("the crew hash pre-selects that crew's runs", () => {
    const page = src("components/v2/crew-page.tsx");
    const fn = page.slice(page.indexOf("function RecentRuns("));
    expect(fn).toContain("window.location.hash");
    expect(fn).toContain('addEventListener("hashchange"');
  });
});
