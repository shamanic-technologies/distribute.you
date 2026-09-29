import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(join(__dirname, "../src/components/v2/crew-page.tsx"), "utf8");

describe("crew card", () => {
  it("carries no Paused / Running toggle: pausing lives in the card's ⋯ menu", () => {
    expect(src).not.toContain('(["Paused", "Running"] as const)');
    expect(src).toContain("Pause or change budget");
  });
});
