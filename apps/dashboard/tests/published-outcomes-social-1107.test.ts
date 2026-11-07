import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PublishedUnitsSchema, costPerSignupReasonWords, publishedRoiToShow, visitsReasonWords } from "../src/lib/v2/published-units";

/**
 * SOCIAL-OUTCOMES-1107 (owner 2026-11-07: « engagements (comments, reposts, clicks, etc) … Le $ ? Le yield ? Le ROI ? »):
 * the published outcome page shows the served engagement breakdown, value produced and ROI, never computed here.
 */
const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
const breakdown = { likes: 3, replies: 1, reposts: 0, quotes: null, shares: null, bookmarks: 2, clicks: null };
const totals = { rows: 1, units: 1, views: 120, engagements: 6, visits: 0, signups: 0, spentUsd: 0.01, viewsReportedRows: 1, engagementBreakdown: breakdown, rowsEngagementsAboveViews: 0, valueUsd: 0.4, unvaluedRows: 0 };
const measured = (learning: boolean, roiMultiple: number | null) => ({ roiMultiple, valueUsd: 0.4, spentUsd: 0.01, learning, unavailableReason: null });
const body = (m: ReturnType<typeof measured>) => ({
  brandId: "b1",
  pricing: "net",
  outcomeKey: "x_post_published",
  computedAt: "2026-11-07T08:00:00.000Z",
  rows: [
    {
      id: "p1", publishedAt: "2026-11-05T10:00:00.000Z", account: "DistributeYou", performedBy: "ours", text: "Hi", url: null, units: 1, views: 120, engagements: 6,
      spentUsd: 0.01, visits: null, signups: null, ledgerUnavailableReason: null, kind: "post", visitsUnavailableReason: "no_visit_attribution_on_outcome",
      engagementBreakdown: breakdown, metricsWarning: null, valuePerUnitUsd: 0.4, valueUsd: 0.4,
      value: { valuePerUnitUsd: 0.4, step: "x_post_published", offerId: null, lifetimeRevenueSource: "fleet_median", unavailableReason: null }, measuredReturn: m,
    },
  ],
  totals: { all: totals, ours: totals },
  costPerSignupUsd: null,
  costPerSignupUnavailableReason: "no_visit_attribution_on_outcome",
  learning: true,
  daily: [{ date: "2026-11-05", units: 1, oursUnits: 1, views: 120, visits: 0, signups: 0, spentUsd: 0.01, engagements: 6, engagementBreakdown: breakdown, valueUsd: 0.4, oursSpentUsd: 0.01, oursValueUsd: 0.4, measuredReturn: m }],
  repostsExcluded: { rows: 2, engagements: 9 },
  visitsMeasured: false,
  visitsUnavailableReason: "no_visit_attribution_on_outcome",
  measuredReturn: m,
  expectedReturn: { roiMultiple: 12, valuePerUnitUsd: 0.4, costPerUnitUsd: 0.03, costSource: "catalogue", basis: "fleet", pipeId: null, unavailableReason: null },
});

describe("published outcomes: breakdown, value, ROI (SOCIAL-OUTCOMES-1107)", () => {
  it("parses the producer's new body", () => {
    const p = PublishedUnitsSchema.parse(body(measured(false, 40)));
    expect(p.rows[0]!.engagementBreakdown?.replies).toBe(1);
    expect(p.totals.all.valueUsd).toBe(0.4);
    expect(p.repostsExcluded?.rows).toBe(2);
  });

  it("ROI = measured when mature, measured greyed + expected while Learning, expected when nothing measured", () => {
    expect(publishedRoiToShow(PublishedUnitsSchema.parse(body(measured(false, 40))))).toEqual({ value: 40, expected: false, reason: null });
    expect(publishedRoiToShow(PublishedUnitsSchema.parse(body(measured(true, 40))))).toMatchObject({ value: 40, learning: true, expectedValue: 12 });
    expect(publishedRoiToShow(PublishedUnitsSchema.parse(body(measured(true, null))))).toEqual({ value: 12, expected: true, reason: null });
  });

  it("an older body (no return blocks) shows no ROI tile", () => {
    const { measuredReturn: _m, expectedReturn: _e, ...old } = body(measured(false, 1));
    expect(publishedRoiToShow(PublishedUnitsSchema.parse(old))).toBeUndefined();
  });

  it("names why visits or a $ per signup are absent", () => {
    expect(visitsReasonWords("no_visit_attribution_on_outcome")).toBe("Not tracked");
    expect(costPerSignupReasonWords("nothing_spent_yet")).toBe("Nothing spent yet");
    expect(costPerSignupReasonWords(null)).toBe("Learning");
  });

  it("the page renders the served fields: breakdown columns, value, ROI with its label, reposts excluded", () => {
    const page = src("src/components/v2/published-outcome-page.tsx");
    for (const lit of ["<Kind n={r.engagementBreakdown?.likes} />", "<Kind n={r.engagementBreakdown?.replies} />", "<Kind n={r.engagementBreakdown?.reposts} />", "<Kind n={r.engagementBreakdown?.clicks} />"]) {
      expect(page).toContain(lit);
    }
    expect(page).toContain("<StatTile label={<RoiLabel />}");
    expect(page).toContain("<RoiValue roi={roi}");
    expect(page).toContain('<StatTile label="Value produced">');
    expect(page).toContain("repostsExcluded={data.repostsExcluded?.rows ?? 0}");
    expect(page).toContain("const visitsTracked = data.visitsMeasured !== false;");
  });
});
