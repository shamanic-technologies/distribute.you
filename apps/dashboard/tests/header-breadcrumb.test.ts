import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("the offer and the campaign marks share one tile size", () => {
  // Every tile on one line is the SAME size, and it holds by construction.
  // `OfferMark`'s "sm" is 18px while the leg and channel marks' "sm" is a
  // 32px table tile, so the campaign half asks for "xs", which those two
  // marks define as the same 18px `rounded` tile the offer wears.
  it("draws the offer and the campaign at one tile size", () => {
    const offer = read("src/components/marks/offer-mark.tsx");
    expect(offer).toContain('size === "sm" ? "h-[18px] w-[18px] rounded"');

    for (const rel of [
      "src/components/marks/acquisition-channel-mark.tsx",
      "src/components/marks/leg-mark.tsx",
    ]) {
      const mark = read(rel);
      expect(mark).toContain('type MarkSize = "xs" | "sm" | "md";');
      expect(mark).toContain('xs: "h-[18px] w-[18px] rounded"');
      expect(mark).toContain("xs: 12");
    }
  });
});
