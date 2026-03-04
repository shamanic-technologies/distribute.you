import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const pagePath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/features/[featureId]/new/page.tsx"
);
const content = fs.readFileSync(pagePath, "utf-8");

describe("Go button enabled when using new brand URL (regression)", () => {
  it("should treat __new__ sentinel the same as null in resolvedBrandUrl", () => {
    // When selectedBrandId is "__new__", resolvedBrandUrl must fall back to
    // newBrandUrl instead of trying to look up a brand with id "__new__".
    // Without this check, the Go button stays disabled because
    // brands.find(b => b.id === "__new__") returns undefined → empty string.
    expect(content).toContain('selectedBrandId !== "__new__"');
    // The resolvedBrandUrl memo must exclude "__new__" from the brand lookup
    expect(content).toMatch(
      /selectedBrandId\s*&&\s*selectedBrandId\s*!==\s*"__new__"/
    );
  });

  it("should use newBrandUrl when selectedBrandId is __new__", () => {
    // The fallback branch (: newBrandUrl) must be reached when __new__ is set
    expect(content).toContain(": newBrandUrl");
  });
});
