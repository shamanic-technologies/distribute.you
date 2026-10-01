import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: features-context and all feature links must use f.slug
 * directly. Features use slug/name — no dynasty concept.
 */
describe("Feature slug resolution in features-context", () => {
  const contextPath = path.join(
    __dirname,
    "../src/lib/features-context.tsx",
  );

  it("getFeature should match by slug", () => {
    const content = fs.readFileSync(contextPath, "utf-8");
    expect(content).toContain("f.slug === slug");
    expect(content).not.toMatch(/\bdynasty(Slug|Name)\b/);
  });
});
