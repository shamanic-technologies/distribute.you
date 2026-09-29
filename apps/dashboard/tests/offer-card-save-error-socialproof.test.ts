import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  join(__dirname, "../src/components/settings/brand-offer-card.tsx"),
  "utf8",
);

describe("offer card: a failed save is stated, a save survives a reload, list levers are one textarea", () => {
  it("renders the save failure instead of swallowing it", () => {
    expect(SRC).toContain("saveOfferMut.isError");
    expect(SRC).toContain('role="alert"');
    expect(SRC).toContain("ORG_DESYNC_STATUS");
  });

  it("writes the saved response to the cache the card reads", () => {
    expect(SRC).toContain('setQueryData(["offerUserFields", brandId, offerId], res)');
  });

  it("re-reads through the query function after a save, so a reload does not paint the pre-save disk copy", () => {
    const at = SRC.indexOf('setQueryData(["offerUserFields", brandId, offerId], res)');
    const inv = SRC.indexOf('return queryClient.invalidateQueries({ queryKey: ["offerUserFields", brandId, offerId] })');
    expect(at).toBeGreaterThan(-1);
    expect(inv).toBeGreaterThan(at);
  });

  it("edits BOTH list levers (services, social proof) in one textarea, one item per line, stored as a list", () => {
    expect(SRC).toContain('TEXTAREA_LIST_KEYS: ReadonlySet<string> = new Set(["services", "socialProof"])');
    expect(SRC).toContain("TEXTAREA_LIST_KEYS.has(lever.key) ? (");
    expect(SRC).toContain("? linesToList(v)");
  });

  it("has no chip input left: typed text can no longer be dropped on save", () => {
    expect(SRC).not.toContain("<ListEditor");
    expect(SRC).not.toContain("onAdd=");
  });
});
