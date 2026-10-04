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
    expect(src).toContain("w.recipientsRepliesPositive.total");
    expect(src).toContain("w.recipientsClicked.total");
    expect(src).toContain("pct(emails.deliveryRatePct)");
    // Owner 2026-10-03: "spent il faut mettre le total". Charged plus held, no detail note.
    expect(src).toContain("winSpend.totalSpentCents");
    expect(src).not.toContain("winSpend.actualSpentCents");
    expect(src).not.toContain("costPerEmailSentCents");
  });

  it("never sums a series in the browser, never mixes today with all time", () => {
    expect(src).not.toContain("dailyWindow(");
    expect(src).not.toContain("actualSpentTodayCents");
    expect(src).not.toContain("provisionedSpentTodayCents");
    expect(src).not.toContain('note="all time"');
  });

  it("draws the pipeline curve on the expected basis, never the realized one", () => {
    expect(src).toContain("w.expectedPipeline.daily.map((d) => d.cumulativePipelineUsd)");
    expect(src).not.toContain("roiHistory.daily");
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
    expectedPipeline: { totalPipelineUsd: 243, undatedPipelineUsd: 0, daily: [{ date: "2026-10-03", cumulativePipelineUsd: 243 }] },
  };

  it("parses the served block", () => {
    expect(RevenueWindowResponseSchema.safeParse({ window }).success).toBe(true);
  });

  it("keeps a failed email read as null, never a zero", () => {
    const parsed = RevenueWindowResponseSchema.parse({ window: { ...window, emails: null, spend: null, expectedPipeline: null } });
    expect(parsed.window.emails).toBeNull();
  });
});
