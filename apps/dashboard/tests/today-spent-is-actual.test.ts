import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

// Today's "spent today" sits beside "Taken from credit". Both must read what was
// actually taken: counting open holds as spent printed "$44 spent today" next to
// "$34 taken from credit, all time" (2026-10-03).
const src = readFileSync(join(__dirname, "../src/components/v2/today-page.tsx"), "utf8");

describe("Today: spent today is the actual spend", () => {
  it("reads the actual field, never the total with holds", () => {
    expect(src).toContain("const spentToday = data?.spend?.actualSpentTodayCents ?? null;");
    expect(src).not.toContain("totalSpentTodayCents");
  });

  it("shows open holds on their own line", () => {
    expect(src).toContain("provisionedSpentTodayCents");
    expect(src).toContain("} on hold</p>");
  });
});
