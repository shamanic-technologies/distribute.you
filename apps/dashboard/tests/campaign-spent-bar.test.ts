import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Owner 2026-11-17: on Campaigns > Overview the $ Spent bar reads the campaign's spend against
// its OWN cap this period ($4.59 of "Up to $10/month" = about half), never against the biggest row.
const src = readFileSync(join(__dirname, "../src/components/v2/campaigns-overview-page.tsx"), "utf8");

describe("Campaigns overview $ Spent bar", () => {
  it("scales on the campaign's own period cap", () => {
    expect(src).toContain("const periodCapUsd = centsToUsd(periodBudget?.amountCents);");
    expect(src).toContain("<ShareBar value={periodSpent} max={periodCapUsd}");
  });
  it("no longer scales on the biggest spend in view", () => {
    expect(src).not.toContain("spentMax");
  });
});
