import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  join(__dirname, "../src/components/settings/brand-offer-card.tsx"),
  "utf8",
);

describe("offer card: a failed save is stated, social proof is one textarea", () => {
  it("renders the save failure instead of swallowing it", () => {
    expect(SRC).toContain("saveOfferMut.isError");
    expect(SRC).toContain('role="alert"');
    expect(SRC).toContain("ORG_DESYNC_STATUS");
  });

  it("writes the saved response to the cache the card reads", () => {
    expect(SRC).toContain('setQueryData(["offerUserFields", brandId, offerId], res)');
  });

  it("edits social proof in one textarea, one item per line, stored as a list", () => {
    expect(SRC).toContain('TEXTAREA_LIST_KEYS: ReadonlySet<string> = new Set(["socialProof"])');
    expect(SRC).toContain("TEXTAREA_LIST_KEYS.has(lever.key) ? (");
    expect(SRC).toContain("? linesToList(v)");
  });
});
