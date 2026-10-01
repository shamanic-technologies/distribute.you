import { describe, it, expect } from "vitest";
import { MATURITY_STYLES } from "../src/lib/feature-gates";

describe("alpha badge contrast", () => {
  it("alpha uses a saturated amber fill, not the pale amber-100", () => {
    expect(MATURITY_STYLES.alpha).toContain("amber-400");
    expect(MATURITY_STYLES.alpha).not.toContain("amber-100");
  });
});
