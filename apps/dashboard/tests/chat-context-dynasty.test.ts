import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: all chat contexts must include complete identity fields
 * (id, slug, dynastySlug, dynastyName, version) for both workflows and features.
 */

describe("Workflow chat context — dynasty identity fields", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/workflows/[workflowId]/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should pass workflow.id, slug, dynastySlug, dynastyName, version in context", () => {
    expect(content).toContain("id: workflow.id");
    expect(content).toContain("slug: workflow.slug");
    expect(content).toContain("dynastySlug: workflow.dynastySlug");
    expect(content).toContain("dynastyName: workflow.dynastyName");
    expect(content).toContain("version: workflow.version");
  });

  it("should pass feature.id, slug, dynastySlug, dynastyName, version in context", () => {
    expect(content).toContain("id: feature.id");
    expect(content).toContain("slug: feature.slug");
    expect(content).toContain("dynastySlug: feature.dynastySlug");
    expect(content).toContain("dynastyName: feature.dynastyName");
    expect(content).toContain("version: feature.version");
  });

  it("should include dynasty slug and version in instructions text", () => {
    expect(content).toContain("Dynasty Slug: ${workflow.dynastySlug}");
    expect(content).toContain("Version: ${workflow.version}");
    expect(content).toContain("Slug: ${workflow.slug}");
  });
});

describe("Feature settings chat context — dynasty identity fields", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/settings/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should pass feature.id, slug, dynastySlug, dynastyName, version in context", () => {
    expect(content).toContain("id: feature.id");
    expect(content).toContain("slug: feature.slug");
    expect(content).toContain("dynastySlug: feature.dynastySlug");
    expect(content).toContain("dynastyName: feature.dynastyName");
    expect(content).toContain("version: feature.version");
  });

  it("should include dynasty identity in instructions text", () => {
    expect(content).toContain("Dynasty Slug: ${feature.dynastySlug}");
    expect(content).toContain("Dynasty Name: ${feature.dynastyName}");
    expect(content).toContain("Version: ${feature.version}");
    expect(content).toContain("ID: ${feature.id}");
  });

  it("should NOT have redundant top-level featureSlug (identity lives inside feature object)", () => {
    // The context object should not have a standalone featureSlug at the top level
    expect(content).not.toMatch(/featureSlug:\s*feature\.slug/);
  });
});

describe("Feature creator page — post-creation transition includes dynasty fields", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/new/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should include all identity fields in post-creation context", () => {
    expect(content).toContain("id: createdFeature.id");
    expect(content).toContain("slug: createdFeature.slug");
    expect(content).toContain("dynastySlug: createdFeature.dynastySlug");
    expect(content).toContain("dynastyName: createdFeature.dynastyName");
    expect(content).toContain("version: createdFeature.version");
  });

  it("should transition URL in-place after creation (no router.push)", () => {
    expect(content).toContain("window.history.replaceState");
    expect(content).toContain("setCreatedFeature");
  });

  it("should include dynasty identity in post-creation instructions text", () => {
    expect(content).toContain("Dynasty Slug: ${createdFeature.dynastySlug}");
    expect(content).toContain("Dynasty Name: ${createdFeature.dynastyName}");
    expect(content).toContain("Version: ${createdFeature.version}");
  });
});
