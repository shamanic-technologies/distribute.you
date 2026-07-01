import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { parseFeatureRevenue } from "../src/lib/revenue-parse";
import { keepLastGoodFeatureRevenue } from "../src/lib/api";
import type { RevenueOverview } from "../src/lib/revenue-view";

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, rel), "utf-8");

// A minimal-but-valid /revenue overview payload, optionally with actual signal series.
function rawRevenue(series?: Partial<Record<"outreachContacted" | "clicked" | "meetingsBooked" | "purchased", unknown>>) {
  return {
    featureSlug: "sales-cold-email-outreach",
    ...(series ?? {}),
    headline: { totalPipelineUsd: 1000 },
    costEconomics: { actualCostUsd: 10, costOfAcquisitionPct: null, roiMultiple: null },
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
        outreachContacted: {
          total: 5,
          daily: [
            { date: "2026-06-21", count: 2 },
            { date: "2026-06-22", count: 2 },
          ],
          undatedCount: 1,
        },
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
        outreachContacted: {
          total: "7",
          daily: [{ date: "2026-06-22", count: "7" }],
          undatedCount: "0",
        },
      }),
      "test",
    );
    expect(view.outreachContacted?.total).toBe(7);
    expect(view.outreachContacted?.daily[0].count).toBe(7);
    expect(view.outreachContacted?.undatedCount).toBe(0);
  });

  it("tolerates an absent outreachContacted (optional during rollout)", () => {
    const view = parseFeatureRevenue(rawRevenue(), "test");
    expect(view.outreachContacted).toBeUndefined();
    // the rest of the overview still parses
    expect(view.totalPipelineUsd).toBe(1000);
  });

  it("parses clicked/goal-outcome series from the same signal-series schema", () => {
    const view = parseFeatureRevenue(
      rawRevenue({
        clicked: { total: 1, daily: [{ date: "2026-06-24", count: 1 }], undatedCount: 0 },
        meetingsBooked: { total: 1, daily: [{ date: "2026-06-25", count: 1 }], undatedCount: 0 },
        purchased: { total: 0, daily: [], undatedCount: 0 },
      }),
      "test",
    );
    expect(view.clicked?.total).toBe(1);
    expect(view.meetingsBooked?.daily).toEqual([{ date: "2026-06-25", count: 1 }]);
    expect(view.purchased?.total).toBe(0);
  });
});

describe("keepLastGoodFeatureRevenue (cache-write boundary)", () => {
  const withContacted = parseFeatureRevenue(
    rawRevenue({
      outreachContacted: { total: 9, daily: [{ date: "2026-06-22", count: 9 }], undatedCount: 0 },
    }),
    "test",
  );
  const withoutContacted = parseFeatureRevenue(rawRevenue(), "test");

  it("keeps last-good actual series when a refetch drops them on a valid 200", () => {
    const merged = keepLastGoodFeatureRevenue(withContacted, withoutContacted);
    expect(merged.outreachContacted?.total).toBe(9);
  });

  it("adopts a fresh non-null outreachContacted (no stale pinning)", () => {
    const next = parseFeatureRevenue(
      rawRevenue({ outreachContacted: { total: 11, daily: [], undatedCount: 11 } }),
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

  it("revenue-parse declares optional, coercing signal-series schemas", () => {
    expect(parse).toContain("outreachContacted: SignalSeriesSchema.optional()");
    expect(parse).toContain("clicked: SignalSeriesSchema.optional()");
    expect(parse).toContain("meetingsBooked: SignalSeriesSchema.optional()");
    expect(parse).toContain("purchased: SignalSeriesSchema.optional()");
    expect(parse).toContain("total: z.coerce.number()");
    expect(parse).toContain("count: z.coerce.number()");
    expect(parse).toContain("undatedCount: z.coerce.number()");
    expect(view).toContain("outreachContacted?: OutreachContacted");
    expect(view).toContain("clicked?: SignalSeries");
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

  it("graph actuals are mapped from /revenue series, expected untouched", () => {
    expect(page).toContain("const contactedByDay = countByDay(data?.outreachContacted)");
    expect(page).toContain("const clickedByDay = countByDay(data?.clicked)");
    expect(page).toContain("const meetingsByDay = countByDay(data?.meetingsBooked)");
    expect(page).toContain("clicks: withActual(");
    expect(page).toContain("signups: withActual(");
    expect(page).toContain("salesMeetings: withActual(");
    expect(page).toContain("pipelineActivity={activityRevealed ? mergedPipelineActivity : undefined}");
  });

  it("featureRevenue query keeps last-good actual series via structuralSharing", () => {
    expect(page).toContain("keepLastGoodFeatureRevenue");
    expect(page).toContain("structuralSharing");
    expect(parse).toContain("meetingsBooked: d.meetingsBooked");
  });
});
