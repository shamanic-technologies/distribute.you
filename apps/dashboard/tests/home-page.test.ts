import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Home page", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should be a client component", () => {
    expect(content).toContain('"use client"');
  });

  it("should redirect to /orgs/{orgId}", () => {
    expect(content).toContain("useOrganization");
    expect(content).toContain("router.replace(`/orgs/${organization.id}`)");
  });

  it("should NOT contain old content page elements", () => {
    expect(content).not.toContain("WORKFLOW_DEFINITIONS");
    expect(content).not.toContain("ApiKeyPreview");
    expect(content).not.toContain("features-grid");
    expect(content).not.toContain("feature-card");
  });
});

describe("Brand overview page", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should NOT link to /workflows", () => {
    expect(content).not.toContain('href="/workflows"');
  });

  it("should have Features section header", () => {
    expect(content).toContain("Features");
  });

  it("should link to Explore Features", () => {
    expect(content).toContain("Explore Features");
  });
});
