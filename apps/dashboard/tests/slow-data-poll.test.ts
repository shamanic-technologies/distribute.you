import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LEAD_READ_REFRESH_MS,
  PEOPLE_OUTCOMES_REFRESH_MS,
  SLOW_SERVER_READ_REFRESH_MS,
  leadReadOptions,
  peopleOutcomesReadOptions,
  slowServerReadOptions,
} from "../src/lib/query-options";

// Owner 2026-11-08 (PAGE-SPEED-1107, option A): data whose producer moves on minutes is re-asked
// every 30 s (lead-service) / 60 s (crm-service people per outcome), everything else stays at 5 s.
const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("slow-moving reads poll at their producer's pace", () => {
  it("30 s for lead reads, 60 s for people per outcome, and a failed empty read stops polling", () => {
    expect(LEAD_READ_REFRESH_MS).toBe(30_000);
    expect(PEOPLE_OUTCOMES_REFRESH_MS).toBe(60_000);
    expect(leadReadOptions.refetchInterval({ state: { status: "success", data: [] } })).toBe(30_000);
    expect(peopleOutcomesReadOptions.refetchInterval({ state: { status: "success", data: [] } })).toBe(60_000);
    expect(leadReadOptions.refetchInterval({ state: { status: "error", data: undefined } })).toBe(false);
  });
  it("each lead reader uses it", () => {
    const sites: [string, string][] = [
      ["src/components/v2/data.ts", "() => getBrandOutcomes(brandId), { ...peopleOutcomesReadOptions"],
      ["src/components/v2/data.ts", "getUniboxLifecycleCounts(brandId, filters, { campaignId }),\n    { ...leadReadOptions"],
      ["src/components/v2/data.ts", "return { total: awaiting.total, leads, waiting };\n    },\n    { ...leadReadOptions"],
      ["src/components/v2/integrations-conversations.tsx", "enabled: gate && !!brandId,\n    ...leadReadOptions,"],
      ["src/components/v2/deals-page.tsx", "{ ...leadReadOptions, enabled: !!brandId && (total === null || total > 0) }"],
      ["src/components/v2/people-page.tsx", "{ ...leadReadOptions, enabled: !!brandId }"],
      ["src/components/v2/team-work-page.tsx", "getPipeQueue(brandId, outcome.fromKey, outcome.toKey), { ...leadReadOptions"],
      ["src/components/v2/person-page.tsx", "getLeadTimeline(leadRowId, { brandId }),\n    { ...leadReadOptions"],
    ];
    for (const [file, literal] of sites) expect(read(file), file).toContain(literal);
  });
  // DASH-SPEED-1110 (owner 2026-11-09): the brand's 15-40 s server reads (money, deals and company boards, the list
  // snapshot) were re-asked every 5 s, a new ask before the last one answered. Once a minute now.
  it("60 s for the brand's heavy server reads, and each reader uses it", () => {
    expect(SLOW_SERVER_READ_REFRESH_MS).toBe(60_000);
    expect(slowServerReadOptions.refetchInterval({ state: { status: "success", data: {} } })).toBe(60_000);
    expect(slowServerReadOptions.refetchInterval({ state: { status: "error", data: undefined } })).toBe(false);
    const sites: [string, string][] = [
      ["src/components/v2/data.ts", "() => getBrandRevenue(brandId), {\n    enabled,\n    ...slowServerReadOptions,"],
      ["src/components/v2/data.ts", "getBrandRevenueWindow(brandId, days), {\n    enabled,\n    ...slowServerReadOptions,"],
      ["src/components/v2/data.ts", "getBrandCompanyLifecycle(brandId), {\n    ...slowServerReadOptions,"],
      ["src/components/v2/deals-page.tsx", "{ ...slowServerReadOptions, enabled: !!brandId && (!campaignFilter || !!valueOfferId) }"],
      ["src/components/campaigns/campaigns-table.tsx", "getBrandCampaignRevenue(brandId), {\n    enabled: orgConsistent && !!brandId && moneyChannelSlugs.length > 0,\n    ...slowServerReadOptions,"],
      ["src/components/campaigns/campaigns-table.tsx", "{ enabled: revenueEnabled, ...slowServerReadOptions }"],
      ["src/components/v2/brand-outcomes.ts", "getAudienceSnapshot(brandId, staff), { ...slowServerReadOptions, enabled }"],
    ];
    for (const [file, literal] of sites) expect(read(file), file).toContain(literal);
  });
});
