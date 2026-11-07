/**
 * LEDGER-P2-CONFORM-1107 (admin twin): features-service LEDGER-ONLY-1107-P2 serves every count
 * on the cost-accounting ledger, null where the ledger has no figure. The fixture is the REAL
 * prod body (brand Distribute.you, captured in-container, arrays trimmed); each goes through the
 * admin reader's schema and a null must never come out as 0.
 */
import { readFileSync } from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";
import { FeatureRevenueByCampaignSchema, FeatureRevenueByWorkflowSchema } from "../src/lib/api";
import { FeatureRevenueResponseSchema } from "../src/lib/revenue-parse";
import { formatStatValue } from "../src/lib/format-stat";

const bodies = JSON.parse(readFileSync(path.resolve(__dirname, "fixtures/ledger-p2-prod-1107.json"), "utf8")).bodies;

function fakeZeros(raw: unknown, parsed: unknown, at = ""): string[] {
  if (raw === null && typeof parsed === "number") return [at];
  if (Array.isArray(raw) && Array.isArray(parsed)) return raw.flatMap((r, i) => fakeZeros(r, parsed[i], `${at}[${i}]`));
  if (raw && typeof raw === "object" && parsed && typeof parsed === "object")
    return Object.keys(parsed).flatMap((k) => fakeZeros((raw as Record<string, unknown>)[k], (parsed as Record<string, unknown>)[k], `${at}.${k}`));
  return [];
}

describe("admin readers parse the CURRENT prod body, nulls stay null", () => {
  const cases: Array<[string, { safeParse: (v: unknown) => { success: boolean; data?: unknown } }]> = [
    ["campaignRevenueWindow", FeatureRevenueResponseSchema],
    ["featureRevenueByCampaign", FeatureRevenueByCampaignSchema],
    ["featureRevenueByWorkflow", FeatureRevenueByWorkflowSchema],
  ];
  for (const [key, schema] of cases) {
    it(key, () => {
      const r = schema.safeParse(bodies[key]);
      expect(r.success).toBe(true);
      expect(fakeZeros(bodies[key], r.data)).toEqual([]);
    });
  }

  it("/stats: a count with no ledger figure is null on the wire and prints a dash", () => {
    const stats = bodies.featureStats.stats as Record<string, number | null>;
    expect(stats.recipientsContacted).toBeNull();
    expect(formatStatValue(stats.recipientsContacted, { type: "count", label: "Contacted" } as never)).toBe("—");
  });
});

describe("no admin stats surface turns a null into 0", () => {
  const read = (rel: string) => readFileSync(path.resolve(__dirname, "..", rel), "utf8");
  it("funnel, reply breakdown, campaigns table and public report keep null", () => {
    expect(read("src/components/campaign/funnel-metrics.tsx")).not.toContain("stats[step.key] ?? 0");
    expect(read("src/components/campaign/reply-breakdown.tsx")).not.toContain("stats?.[seg.key] ?? 0");
    expect(read("src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/page.tsx")).not.toContain("cStats?.[o.key] ?? 0");
    expect(read("src/app/report/[orgId]/[brandId]/[featureSlug]/page.tsx")).not.toContain('typeof v === "number" ? v : 0');
    expect(read("src/app/report/[orgId]/[brandId]/[featureSlug]/workflows/page.tsx")).not.toContain("stats.leadsSent : 0");
  });
});
