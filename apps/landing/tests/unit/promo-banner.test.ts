import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { lastDayOfMonthLabel, withPromoUntil } from "../../src/lib/promo-banner";

describe("the offer banner's deadline", () => {
  it("is always the last day of the current month", () => {
    // Owner 2026-10-06: the match is ongoing; the banner date is urgency, never an end.
    expect(lastDayOfMonthLabel(new Date("2026-10-06T08:00:00Z"))).toBe("October 31");
    expect(lastDayOfMonthLabel(new Date("2026-11-01T00:00:00Z"))).toBe("November 30");
    expect(lastDayOfMonthLabel(new Date("2027-02-14T12:00:00Z"))).toBe("February 28");
    expect(lastDayOfMonthLabel(new Date("2028-02-29T23:59:59Z"))).toBe("February 29");
    expect(lastDayOfMonthLabel(new Date("2026-12-31T23:59:59Z"))).toBe("December 31");
  });

  it("rewrites the homepage banner on every request, and never removes it", () => {
    const html = readFileSync(path.join(__dirname, "../../public/landing/index-v2.html"), "utf8");
    const nov = withPromoUntil(html, new Date("2026-11-15T00:00:00Z"));
    expect(nov).toContain("Until <span data-promo-until>November 30</span>, we match your first $100.");
    expect(nov).not.toContain("October 31");
    const route = readFileSync(path.join(__dirname, "../../src/app/route.ts"), "utf8");
    expect(route).toContain("withPromoUntil(readFileSync(");
  });

  it("fails loud when the banner lost its date slot", () => {
    expect(() => withPromoUntil("<body></body>", new Date())).toThrow(/data-promo-until/);
  });
});
