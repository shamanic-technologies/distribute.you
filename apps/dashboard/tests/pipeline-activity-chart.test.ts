import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

describe("outcome + return-on-spend charts and the pipeline-activity reader", () => {
  const api = read("lib/api.ts");
  const outcome = read("components/revenue/outcome-trend-card.tsx");
  const roiTrend = read("components/revenue/roi-trend-card.tsx");
  const revenueView = read("lib/revenue-view.ts");
  const revenueParse = read("lib/revenue-parse.ts");

  // A percentage height resolves against nothing on the first layout pass of a
  // stretched grid item, so the two cards whose chart wrapper is `flex-1` measure 0
  // and recharts logs `width(-1) and height(-1) ... should be greater than 0`. The
  // floor it asks for in that same message is the fix, and it is the wrapper's own
  // `min-h-[180px]`, so the settled layout is unchanged.
  it("floors the two percentage-height charts so recharts can measure them", () => {
    for (const src of [outcome, roiTrend]) {
      expect(src).toContain('<ResponsiveContainer width="100%" height="100%" minHeight={180}>');
    }
  });

  it("Outcome card is a single all-time cumulative line with no window picker", () => {
    expect(outcome).toContain("OutcomeTrendCard");
    expect(outcome).toContain("buildCumulative");
    expect(outcome).toContain("since launch");
    expect(outcome).toContain("AreaChart");
    // No range selector on the Outcome card — cumulative from the very beginning.
    expect(outcome).not.toContain("RANGES");
    expect(outcome).not.toContain("setRangeDays");
    expect(outcome).not.toContain("BarChart");
  });

  // features-service buckets a day only when a lead first carried the signal on it,
  // so a quiet week is ABSENT from `daily`. On a category x-axis every present day
  // takes the same width, so two consecutive days and a three-week gap render
  // identically and the dates read as unevenly spaced — and the cumulative line
  // climbs diagonally across days on which nothing happened.
  it("fills the missing days at zero so one day is one step on the x-axis", () => {
    expect(outcome).toContain("fillMissingDays");
    expect(outcome).toContain("count: 0");
    const at = outcome.indexOf("function buildCumulative");
    expect(outcome.slice(at, at + 300)).toContain("fillMissingDays(");
    // The quiet stretch between the last outcome and the first forecast day is a gap
    // like any other, so the fill runs up to the day before the dashed segment starts.
    expect(outcome).toContain("previousDay(firstFuture)");
  });

  it("Outcome line extends past today with a dashed expected projection", () => {
    expect(outcome).toContain("projectedValue");
    expect(outcome).toContain('strokeDasharray="4 4"');
    expect(outcome).toContain("buildChartPoints");
  });

  it("wires the repliedPositive series through view-model, parser, and reader", () => {
    expect(revenueView).toContain("repliedPositive?: SignalSeries");
    expect(revenueParse).toContain("repliedPositive: SignalSeriesSchema.optional()");
    // features-service#416 rename: flatten prefers the new name, falls back to legacy.
    expect(revenueParse).toContain("repliedPositive: d.recipientsRepliesPositive ?? d.repliedPositive");
    expect(api).toContain('"repliedPositive"');
  });
});

describe("the campaign Outcome chart reads the brand's tertiary", () => {
  const outcome = read("components/revenue/outcome-trend-card.tsx");
  const css = read("app/globals.css");

  it("draws its line, its fill and its hovered dot in orange, never the primary", () => {
    // This card only ever renders at CAMPAIGN grain (the brand and offer Overviews
    // draw Return-on-spend instead), and a campaign's surfaces read in the charter's
    // tertiary. `text-brand-600` here would put the primary on a page whose tag,
    // band and marks are all tertiary.
    expect(outcome).not.toContain("text-brand-600");
    expect(outcome).toContain("text-orange-600");
  });

  it("opts into the brand-hue rotation, or it stays OUR orange on a tinted brand", () => {
    // An SVG `stroke`/`fill` attribute is not reached by any utility remap, so the
    // colour rides `currentColor` off a class — and that class only rotates under a
    // `tone-tile` ancestor. Scoped to the chart wrapper, not the card, so the white
    // surface and the grey chrome above it are untouched.
    expect(outcome).toContain('className="tone-tile flex-1 min-h-[180px]"');
    expect(outcome).toContain('stroke="currentColor"');
    expect(css).toContain(":root[data-brand-tint] .tone-tile .text-orange-600");
  });
});
