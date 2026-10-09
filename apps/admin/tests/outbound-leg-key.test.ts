import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { legCatalogueFromWire, legFor } from "../src/lib/legs";

describe("the outbound leg rename (wave 2)", () => {
  it("keeps the helper byte-equal with the dashboard's", () => {
    const here = readFileSync(join(__dirname, "..", "src", "lib", "outbound-leg-key.ts"), "utf8");
    const twin = readFileSync(join(__dirname, "..", "..", "dashboard", "src", "lib", "outbound-leg-key.ts"), "utf8");
    expect(here).toBe(twin);
  });
  for (const [served, asked] of [
    ["start_to_conversation", "lead_found_to_conversation"],
    ["lead_found_to_conversation", "start_to_conversation"],
  ]) {
    it(`finds a campaign's leg whichever spelling each side holds (${served} served, ${asked} asked)`, () => {
      const cat = legCatalogueFromWire({ legs: [{ legKey: served, fromStep: null, toStep: { key: "conversation", label: "Positive reply" } }] });
      expect(legFor(cat, asked)?.toKey).toBe("conversation");
    });
  }
});
