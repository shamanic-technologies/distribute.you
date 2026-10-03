import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

// Today's stat row read "$31 spent today, $19 on hold" beside "$37 taken from credit,
// all time" on a one-day-old org (2026-10-03): three figures on three bases. The row
// now copies Explee's: Delivered, then Spent, both all time.
const src = readFileSync(join(__dirname, "../src/components/v2/today-page.tsx"), "utf8");

describe("Today: one basis per stat row", () => {
  it("no longer prints a today spend or open holds beside the all-time spend", () => {
    expect(src).not.toContain("actualSpentTodayCents");
    expect(src).not.toContain("provisionedSpentTodayCents");
    expect(src).not.toContain('label="Crew today"');
  });

  it("states the delivery rate and the bounces off the served sending block", () => {
    expect(src).toContain("const sending = data?.sending ?? null;");
    expect(src).toContain("pct(sending.deliveryRatePct)");
    expect(src).toContain("formatCount(sending.recipientsBounced)} bounced");
  });

  it("draws no pipeline curve under the expected headline", () => {
    expect(src).not.toContain("cumulativePipelineUsd");
  });

  it("labels the counts all time, never a window they do not cover", () => {
    expect(src).not.toContain("note={`${SPARK_DAYS} days`}");
  });
});
