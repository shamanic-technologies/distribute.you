import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");

/**
 * Owner 2026-10-04: every reload of Today flashed "This view isn't available yet."
 * The revenue gate is false while the offer and its campaigns load, so a page that
 * read `!enabled` as "no offer" showed its no-data note until they answered.
 */
describe("a v2 page never flashes its no-data note while the offer loads", () => {
  it("the selected offer says when both reads behind the gate have answered", () => {
    const src = read("components/v2/selected-offer.tsx");
    expect(src).toContain("scopeSettled: (offersQ.data !== undefined || offersQ.isError) && (campaigns !== null || campaignsQ.isError)");
  });

  it("the revenue reads stay pending until the gate has settled", () => {
    const src = read("components/v2/data.ts");
    const pending = src.match(/pending: enabled \? q\.data === undefined && !q\.isError : !scopeSettled/g) ?? [];
    // Revenue, the revenue window, and the offer's outcomes (Today's pipeline by step).
    expect(pending.length).toBe(3);
  });

  it("Today shows the note only once the gate settled with no offer", () => {
    const src = read("components/v2/today-page.tsx");
    expect(src).toContain("{!rev.enabled && !rev.pending ? (");
  });
});
