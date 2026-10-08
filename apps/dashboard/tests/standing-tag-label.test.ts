import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { standingTagLabel } from "../src/lib/lead-standing";

describe("a conversation reads lead-service's standing TAG, never its state (owner 2026-10-08)", () => {
  it("a clear no reads Not interested while the state stays engaged", () => {
    expect(standingTagLabel({ state: "engaged", signal: "reply", tag: "not_interested" })).toBe("Not interested");
  });
  it("a site visit reads Website visit while the state stays sales_interest", () => {
    expect(standingTagLabel({ state: "sales_interest", signal: "measured_visit", tag: "website_visit" })).toBe("Website visit");
  });
  it("names every state the tag can carry", () => {
    expect(standingTagLabel({ state: "engaged", tag: "engaged" })).toBe("Engaged");
    expect(standingTagLabel({ state: "customer", tag: "customer" })).toBe("Won");
    expect(standingTagLabel({ state: "sales_interest", tag: "sales_interest" })).toBe("Interested");
  });
  it("falls back to the state on a payload that predates the tag", () => {
    expect(standingTagLabel({ state: "engaged", signal: "reply" })).toBe("Engaged");
    expect(standingTagLabel({ state: "engaged", tag: null })).toBe("Engaged");
  });
  it("keeps an unknown producer word, re-cased, and nothing for no standing", () => {
    expect(standingTagLabel({ state: "engaged", tag: "gone_quiet" })).toBe("Gone quiet");
    expect(standingTagLabel(null)).toBeNull();
    expect(standingTagLabel(undefined)).toBeNull();
  });
  it("the person page chip renders the tag label", () => {
    const page = readFileSync(join(__dirname, "../src/components/v2/person-page.tsx"), "utf8");
    expect(page).toContain("standingTagLabel(");
    expect(page).not.toMatch(/STANDING_LABEL\[state\]/);
  });
});
