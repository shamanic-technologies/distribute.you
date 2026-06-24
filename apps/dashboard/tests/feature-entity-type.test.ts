import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: entities in the Feature type must be objects with
 * { name, countKey? } — not plain strings. This ensures the frontend
 * uses the backend-provided countKey for stat lookups instead of
 * fragile heuristic matching.
 */
describe("Feature.entities uses FeatureEntity objects, not strings", () => {
  const apiPath = path.join(__dirname, "../src/lib/api.ts");
  const content = fs.readFileSync(apiPath, "utf-8");

  it("should define FeatureEntity interface with name and optional countKey", () => {
    expect(content).toContain("interface FeatureEntity");
    expect(content).toMatch(/name:\s*string/);
    expect(content).toMatch(/countKey\?:\s*string/);
  });

  it("should use FeatureEntity[] for entities in Feature interface", () => {
    expect(content).toContain("entities: FeatureEntity[]");
  });

  it("should NOT use string[] for entities", () => {
    expect(content).not.toMatch(/entities:\s*string\[\]/);
  });

  // (The context-sidebar `e.name` consumer check was dropped — the sidebar no
  // longer renders the entity Database section; the FeatureEntity type guards
  // above are the real invariant.)
});
