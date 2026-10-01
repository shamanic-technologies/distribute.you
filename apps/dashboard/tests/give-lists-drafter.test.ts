import { describe, expect, it } from "vitest";
import { GIVE_DRAFT_FIELDS } from "../src/lib/v2/get-started";

// The two field descriptions ARE the instructions of the LLM that drafts an offer's give
// lists in onboarding (brand-service extract-fields, suggest mode). content-generation then
// writes every cold email under these lists, so a list item the company never stated
// becomes a promise in a real email (Living Vital, 2026-10-01: invented free sample boxes).
const byKey = Object.fromEntries(GIVE_DRAFT_FIELDS.map((f) => [f.key, f.description]));

describe("give lists drafter: only what the company states, never a bound", () => {
  it("free items come from what the company states, with no example list to copy", () => {
    expect(byKey.giveForFree).toContain("as its site or offer states it");
    expect(byKey.giveForFree).toContain("None stated means no bullet");
    for (const example of ["free audit", "trial", "mockup", "consultation"]) {
      expect(byKey.giveForFree).not.toContain(example);
    }
  });

  it("never-give items are whole things, never a limit whose opposite reads as a promise", () => {
    expect(byKey.neverGive).toContain("explicitly says it does not give or do");
    expect(byKey.neverGive).toContain("Most sites say none: then return no bullet, never a guess");
    expect(byKey.neverGive).toContain("never a limit on something it gives");
    for (const word of ["full-scale", "permanent", "unlimited", "unbounded", "long-term"]) {
      expect(byKey.neverGive).toContain(word);
    }
    expect(byKey.neverGive).not.toContain("unlimited revisions");
    expect(byKey.neverGive).not.toContain("discounts,");
  });
});
