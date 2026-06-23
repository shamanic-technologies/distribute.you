import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { parseFeatureRevenue } from "../src/lib/revenue-parse";
import { keepLastGoodFeatureRevenue } from "../src/lib/api";
import type { RevenueOverview } from "../src/lib/revenue-view";

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

// A minimal-but-valid /revenue overview payload, optionally with outreachContacted.
function rawRevenue(outreachContacted?: unknown) {
  return {
    featureSlug: "sales-cold-email-outreach",
    ...(outreachContacted !== undefined ? { outreachContacted } : {}),
    headline: { totalPipelineUsd: 1000 },
    costEconomics: { totalCostUsd: 10, costOfAcquisitionPct: null, roiMultiple: null },
    timeSeries: [],
    organizations: [],
    leads: [],
    events: [],
  };
}

describe("parseFeatureRevenue → outreachContacted (server-computed, render-only)", () => {
  it("parses the server outreachContacted aggregate (total / daily / undatedCount)", () => {
    const view = parseFeatureRevenue(
      rawRevenue({
        total: 5,
        daily: [
          { date: "2026-06-21", count: 2 },
          { date: "2026-06-22", count: 2 },
        ],
        undatedCount: 1,
      }),
      "test",
    );
    expect(view.outreachContacted?.total).toBe(5);
    expect(view.outreachContacted?.daily).toEqual([
      { date: "2026-06-21", count: 2 },
      { date: "2026-06-22", count: 2 },
    ]);
    expect(view.outreachContacted?.undatedCount).toBe(1);
  });

  it("coerces string integers on the wire (Postgres numeric/bigint serialize as string)", () => {
    const view = parseFeatureRevenue(
      rawRevenue({
        total: "7",
        daily: [{ date: "2026-06-22", count: "7" }],
        undatedCount: "0",
      }),
      "test",
    );
    expect(view.outreachContacted?.total).toBe(7);
    expect(view.outreachContacted?.daily[0].count).toBe(7);
    expect(view.outreachContacted?.undatedCount).toBe(0);
  });

  it("tolerates an absent outreachContacted (optional during rollout)", () => {
    const view = parseFeatureRevenue(rawRevenue(undefined), "test");
    expect(view.outreachContacted).toBeUndefined();
    // the rest of the overview still parses
    expect(view.totalPipelineUsd).toBe(1000);
  });
});

describe("keepLastGoodFeatureRevenue (cache-write boundary)", () => {
  const withContacted = parseFeatureRevenue(
    rawRevenue({ total: 9, daily: [{ date: "2026-06-22", count: 9 }], undatedCount: 0 }),
    "test",
  );
  const withoutContacted = parseFeatureRevenue(rawRevenue(undefined), "test");

  it("keeps last-good outreachContacted when a refetch drops it on a valid 200", () => {
    const merged = keepLastGoodFeatureRevenue(withContacted, withoutContacted);
    expect(merged.outreachContacted?.total).toBe(9);
  });

  it("adopts a fresh non-null outreachContacted (no stale pinning)", () => {
    const next = parseFeatureRevenue(
      rawRevenue({ total: 11, daily: [], undatedCount: 11 }),
      "test",
    );
    const merged = keepLastGoodFeatureRevenue(withContacted, next);
    expect(merged.outreachContacted?.total).toBe(11);
  });

  it("returns next unchanged when there is no previous value", () => {
    const merged = keepLastGoodFeatureRevenue(undefined as unknown as RevenueOverview, withContacted);
    expect(merged.outreachContacted?.total).toBe(9);
  });
});

describe("single-source wiring (Overview card + graph read /revenue outreachContacted)", () => {
  const page = read(
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
  );
  const parse = read("../src/lib/revenue-parse.ts");
  const view = read("../src/lib/revenue-view.ts");
  const cards = read("../src/components/revenue/outreach-stat-cards.tsx");

  it("revenue-parse declares the optional, coercing outreachContacted schema", () => {
    expect(parse).toContain("outreachContacted: OutreachContactedSchema.optional()");
    expect(parse).toContain("total: z.coerce.number()");
    expect(parse).toContain("count: z.coerce.number()");
    expect(parse).toContain("undatedCount: z.coerce.number()");
    expect(view).toContain("outreachContacted?: OutreachContacted");
  });

  it("Outreach card count comes from the server outreachContacted.total", () => {
    expect(page).toContain("data?.outreachContacted?.total ?? null");
    expect(page).toContain("outreachOverride={contactedTotal}");
    expect(cards).toContain("outreachOverride?: number | null");
    // legacy /stats fallback kept for entity pages that don't fetch /revenue
    expect(cards).toContain(
      "outreachOverride ?? stats.leadsContacted ?? stats.recipientsContacted ?? 0",
    );
  });

  it("graph actual outreach is mapped from outreachContacted.daily, expected untouched", () => {
    expect(page).toContain("data?.outreachContacted?.daily");
    expect(page).toContain(
      "outreach: { ...day.metrics.outreach, actual: countByDay.get(day.date) ?? 0 }",
    );
    expect(page).toContain("pipelineActivity={activityRevealed ? mergedPipelineActivity : undefined}");
  });

  it("featureRevenue query keeps last-good outreachContacted via structuralSharing", () => {
    expect(page).toContain("keepLastGoodFeatureRevenue");
    expect(page).toContain("structuralSharing");
  });
});
