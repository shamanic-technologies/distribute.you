import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { RevenueWindowResponseSchema } from "../src/lib/revenue-window";

// Today's stat row read "$31 spent today, $19 on hold" beside "$37 taken from credit,
// all time" on a one-day-old org, and "14 days" over all-time counts (2026-10-03): figures
// on different bases side by side. The row now copies Explee's: one window for every
// tile, each figure served whole with its own daily values.
const src = readFileSync(join(__dirname, "../src/components/v2/today-page.tsx"), "utf8");

describe("Today: one window for the whole stat row", () => {
  it("reads every windowed tile off the served window block", () => {
    expect(src).toContain("const win = useBrandRevenueWindow(brandId, SINCE_INCEPTION);");
    // Owner 2026-10-04: since inception, no 7 / 30 day toggle.
    expect(src).not.toContain("TODAY_WINDOWS");
    // Replies / visits / delivered tiles left Today: each outcome is its campaign's Target row (LEAD-GENERIC-1106).
    expect(src).not.toContain("recipientsRepliesPositive");
    // 2026-10-06 (Legistai read "$67 spent" over 185 emails): "Spent" is the BILLED figure;
    // the total with follow-ups reserved and not sent yet is served beside it on its own
    // line. Supersedes 2026-10-03 "spent il faut mettre le total" under the Spent label.
    expect(src).toContain("formatCentsAsUsdAdaptive(winSpend.actualSpentCents)");
    // Owner 2026-11-07: "provisioned costs", never the per-case "follow-ups reserved".
    expect(src).toContain("formatCentsAsUsdAdaptive(winSpend.totalSpentCents)} with provisioned costs");
    expect(src).not.toContain("follow-ups reserved");
    // Owner 2026-11-07: the top row's chart is pipeline generated, never a cost curve.
    expect(src).not.toContain("winSpend.daily.map(");
    expect(src).not.toContain("costPerEmailSentCents");
  });

  it("the $ Spent chart card prints the SAME billed figure as the Spent tile (owner 2026-11-07)", () => {
    const charts = readFileSync(join(__dirname, "../src/components/v2/spend-charts.tsx"), "utf8");
    expect(src).toContain("billed={{ pending: win.pending, spend: winSpend }}");
    expect(charts).toContain("<SpendChartsBlock {...state} billed={billed} />");
    expect(charts).toContain("formatCentsAsUsdAdaptive(billed.spend.actualSpentCents)");
    expect(charts).toContain("formatCentsAsUsdAdaptive(billed.spend.totalSpentCents)} with provisioned costs");
  });

  it("never sums a series in the browser, never mixes today with all time", () => {
    expect(src).not.toContain("dailyWindow(");
    expect(src).not.toContain("actualSpentTodayCents");
    expect(src).not.toContain("provisionedSpentTodayCents");
    expect(src).not.toContain('note="all time"');
  });

  it("the main chart is REAL REVENUE generated, expected beside it, solid then dotted (owner 2026-11-07, REVENUE-GENERATED-1107)", () => {
    const tile = readFileSync(join(__dirname, "../src/components/v2/revenue-generated-tile.tsx"), "utf8");
    expect(src).toContain("<RevenueGeneratedTile pending={rev.pending} data={data?.revenueGenerated ?? null}");
    expect(tile).toContain('label="Revenue generated"');
    expect(tile).toContain("<Figure value={formatUsdAdaptive(data.realUsd)} />");
    expect(tile).toContain("{formatUsdAdaptive(data.expectedToDateUsd)} expected");
    expect(tile).toContain('strokeDasharray="3 4"');
    // Served figures only: nothing summed, multiplied or projected here.
    expect(tile).not.toMatch(/\.reduce\(|roiMultiple|spentUsd \*/);
    // The pipeline is the Deals board's figure, never this tile's headline (ROI-CONSISTENCY-1103).
    expect(src).not.toContain("PipelineGeneratedTile");
  });

  // The old pipeline-based RETURN fields stay gone (ROI-CONSISTENCY-1103); the pipeline generated
  // chart above is features-service's own served figure, not a return.
  it("draws none of the deleted pipeline-based return fields (ROI-CONSISTENCY-1103)", () => {
    expect(src).not.toContain("expectedPipeline");
    expect(src).not.toContain("totalPipelineUsd");
    expect(src).not.toContain("roiHistory");
  });
});

describe("the window reader", () => {
  const window = {
    days: 7,
    startDate: "2026-09-27",
    endDate: "2026-10-03",
    emails: {
      sent: 10,
      delivered: 9,
      bounced: 1,
      deliveryRatePct: 90,
      daily: [{ date: "2026-10-03", sent: 10, delivered: 9, bounced: 1, deliveryRatePct: 90 }],
    },
    spend: {
      actualSpentCents: 3707,
      totalSpentCents: 5593,
      brandLevelActualSpentCents: 585,
      costPerEmailSentCents: 370.7,
      daily: [{ date: "2026-10-03", actualSpentCents: 3707, totalSpentCents: 5593 }],
    },
    recipientsRepliesPositive: { total: 0, daily: [] },
    recipientsClicked: { total: 0, daily: [] },
  };

  it("parses the served block", () => {
    expect(RevenueWindowResponseSchema.safeParse({ window }).success).toBe(true);
  });

  it("keeps a failed email read as null, never a zero", () => {
    const parsed = RevenueWindowResponseSchema.parse({ window: { ...window, emails: null, spend: null } });
    expect(parsed.window.emails).toBeNull();
  });
});
