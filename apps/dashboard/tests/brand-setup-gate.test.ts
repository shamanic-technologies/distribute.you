import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const onboarding = fs.readFileSync(
  path.join(__dirname, "../src/components/onboarding/onboarding.tsx"),
  "utf-8",
);

describe("Onboarding — cross-session brand resume via ?brandId=", () => {
  it("reads the brandId param and re-hydrates the brand from backend", () => {
    expect(onboarding).toContain('searchParams.get("brandId")');
    expect(onboarding).toContain("getBrand(resumeBrandIdParam)");
    // v2 has no single-goal step, so the landing point is variant-dependent.
    expect(onboarding).toContain('runResume("outcome", seededUrl)');
  });

  it("only uses the param path when there is no snapshot / checkout return to restore", () => {
    expect(onboarding).toContain(
      "if (!resumeBrandIdParam || restored || searchParams.get(\"launch_checkout\")) return;",
    );
  });
});
