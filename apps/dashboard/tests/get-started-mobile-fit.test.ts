import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Owner 2026-11-27: onboarding steps cut at the right edge of a phone (the found-so-far chips,
// the step-9 company table). Both now fit a 390px screen.
const read = (f: string) => readFileSync(path.join(__dirname, "..", f), "utf8");

describe("the sign-up walk fits a phone", () => {
  it("wraps the phone journal chips instead of a sideways strip", () => {
    const src = read("src/components/v2/get-started/journal.tsx");
    const strip = src.slice(src.indexOf("export function JournalStrip("));
    expect(strip).not.toContain("overflow-x-auto");
    expect(strip).toContain('className="flex flex-wrap gap-2"');
  });

  it("folds the company description under the name on a phone, no 660px floor", () => {
    const src = read("src/components/v2/get-started/get-started.tsx");
    expect(src).not.toContain("min-w-[660px] text-[13px]");
    expect(src).toContain('<table className="w-full text-[13px] md:min-w-[660px]">');
    expect(src).toContain('font-normal md:table-cell">Description</th>');
    expect(src).toContain("line-clamp-2 text-[12.5px] leading-5 md:hidden");
  });
});
