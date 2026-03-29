import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: the feature builder must support saving features to
 * features-service via POST /features, and the draft type must include
 * all fields required by the API (icon, charts, entities).
 */
describe("Feature save button", () => {
  const panelPath = path.join(
    __dirname,
    "../src/components/features/feature-builder-panel.tsx"
  );
  const panelContent = fs.readFileSync(panelPath, "utf-8");

  const newPagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/new/page.tsx"
  );
  const newPageContent = fs.readFileSync(newPagePath, "utf-8");

  const apiPath = path.join(__dirname, "../src/lib/api.ts");
  const apiContent = fs.readFileSync(apiPath, "utf-8");

  describe("FeatureDraft type completeness", () => {
    it("should include icon field", () => {
      expect(panelContent).toContain("icon: string");
    });

    it("should include charts field", () => {
      expect(panelContent).toContain("charts: FeatureChart[]");
    });

    it("should include entities field", () => {
      expect(panelContent).toContain("entities: Array<{ name: string; countKey?: string }>");
    });

    it("EMPTY_DRAFT should initialize all new fields", () => {
      expect(panelContent).toContain('icon: ""');
      expect(panelContent).toContain("charts: []");
      expect(panelContent).toContain("entities: []");
    });
  });

  describe("Builder panel save support", () => {
    it("should accept onSave prop", () => {
      expect(panelContent).toContain("onSave?:");
    });

    it("should render Save Feature button", () => {
      expect(panelContent).toContain("Save Feature");
    });

    it("should show saving state", () => {
      expect(panelContent).toContain("isSaving");
      expect(panelContent).toContain("Saving...");
    });

    it("should display save errors", () => {
      expect(panelContent).toContain("saveError");
    });
  });

  describe("New feature page wiring", () => {
    it("should import createFeature from api", () => {
      expect(newPageContent).toContain("createFeature");
    });

    it("should pass onSave to FeatureBuilderPanel", () => {
      expect(newPageContent).toContain("onSave={handleSave}");
    });

    it("should invalidate features cache after save", () => {
      expect(newPageContent).toContain('queryKey: ["features"]');
    });

    it("should transition to settings page in-place after save", () => {
      expect(newPageContent).toContain("window.history.replaceState");
      expect(newPageContent).toContain("setCreatedFeature(result.feature)");
    });
  });

  describe("API functions", () => {
    it("should export createFeature function", () => {
      expect(apiContent).toContain("export async function createFeature");
    });

    it("should export updateFeature function", () => {
      expect(apiContent).toContain("export async function updateFeature");
    });

    it("createFeature should POST to /features", () => {
      const match = apiContent.match(
        /function createFeature[\s\S]*?method:\s*"POST"[\s\S]*?\/features/
      );
      expect(match).not.toBeNull();
    });

    it("updateFeature should PUT to /features/:slug", () => {
      const match = apiContent.match(
        /function updateFeature[\s\S]*?method:\s*"PUT"[\s\S]*?\/features\/\$/
      );
      expect(match).not.toBeNull();
    });
  });
});
