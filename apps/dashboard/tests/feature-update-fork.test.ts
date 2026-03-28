import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * PUT /v1/features/:slug returns 200 for metadata-only updates and 201 when
 * inputs/outputs changed (fork). The dashboard must handle both responses.
 */
describe("Feature update fork handling", () => {
  const apiPath = path.join(__dirname, "../src/lib/api.ts");
  const apiContent = fs.readFileSync(apiPath, "utf-8");

  describe("Feature interface", () => {
    it("should include dynastyName field", () => {
      expect(apiContent).toMatch(/dynastyName\??:\s*string/);
    });

    it("should include dynastySlug field", () => {
      expect(apiContent).toMatch(/dynastySlug\??:\s*string/);
    });

    it("should include version field", () => {
      expect(apiContent).toMatch(/version\??:\s*number/);
    });

    it("should include forkedFrom field", () => {
      expect(apiContent).toMatch(/forkedFrom\??:\s*FeatureRef/);
    });

    it("should include upgradedTo field", () => {
      expect(apiContent).toMatch(/upgradedTo\??:\s*FeatureRef/);
    });
  });

  describe("FeatureRef interface", () => {
    it("should define FeatureRef with id, slug, and status", () => {
      expect(apiContent).toContain("interface FeatureRef");
      expect(apiContent).toMatch(/FeatureRef[\s\S]*?id:\s*string/);
      expect(apiContent).toMatch(/FeatureRef[\s\S]*?slug:\s*string/);
      expect(apiContent).toMatch(/FeatureRef[\s\S]*?status:/);
    });
  });

  describe("UpdateFeatureResult type", () => {
    it("should export UpdateFeatureResult union type", () => {
      expect(apiContent).toContain("export type UpdateFeatureResult");
    });

    it("should include forkedFrom in the fork variant", () => {
      expect(apiContent).toMatch(
        /UpdateFeatureResult[\s\S]*?forkedFrom:\s*FeatureRef/
      );
    });
  });

  describe("updateFeature function", () => {
    it("should return UpdateFeatureResult", () => {
      expect(apiContent).toMatch(
        /function updateFeature[\s\S]*?Promise<UpdateFeatureResult>/
      );
    });
  });
});
