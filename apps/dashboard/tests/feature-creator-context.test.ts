import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: the feature creator page must pass the stats registry
 * and full feature schema (charts, entities) to the chat context so the AI
 * can create features that pass validation.
 */
describe("Feature creator page passes complete context to chat", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/new/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should pass statsRegistry to the chat context", () => {
    expect(content).toContain("statsRegistry");
    expect(content).toContain("registry");
  });

  it("should include charts and entities in existing features reference", () => {
    expect(content).toContain("charts: f.charts");
    expect(content).toContain("entities: f.entities");
  });

  it("should instruct the AI that output keys must come from the stats registry", () => {
    expect(content).toContain("statsRegistry");
    expect(content).toContain("MUST be one of the allowed stats keys");
  });

  it("should instruct the AI about required charts field", () => {
    expect(content).toContain("CHARTS: Required");
    expect(content).toContain("funnel-bar");
    expect(content).toContain("breakdown-bar");
  });

  it("should instruct the AI about required entities field", () => {
    expect(content).toContain("ENTITIES: Required");
  });

  it("should instruct the AI about input field schema including extractKey", () => {
    expect(content).toContain("extractKey");
    expect(content).toContain("placeholder");
  });

  it("should include dynasty identity fields in post-creation context", () => {
    // After creation, the page transitions to settings mode with full identity
    expect(content).toContain("createdFeature.id");
    expect(content).toContain("createdFeature.slug");
    expect(content).toContain("createdFeature.dynastySlug");
    expect(content).toContain("createdFeature.dynastyName");
    expect(content).toContain("createdFeature.version");
  });
});
