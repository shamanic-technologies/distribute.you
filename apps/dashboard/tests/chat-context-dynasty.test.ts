import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: workflow chat context must include complete identity fields
 * (id, slug, dynastySlug, dynastyName, version) for workflows.
 * Features only have id, slug, name — no dynasty concept.
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

  it("should pass feature.id, slug, name (no dynasty fields) in context", () => {
    expect(content).toContain("id: feature.id");
    expect(content).toContain("slug: feature.slug");
    expect(content).toContain("name: feature.name");
    expect(content).not.toContain("dynastySlug: feature.dynastySlug");
    expect(content).not.toContain("dynastyName: feature.dynastyName");
    expect(content).not.toContain("version: feature.version");
  });

  it("should include dynasty slug and version in instructions text for workflow", () => {
    expect(content).toContain("Dynasty Slug: ${workflow.dynastySlug}");
    expect(content).toContain("Version: ${workflow.version}");
    expect(content).toContain("Slug: ${workflow.slug}");
  });
});
