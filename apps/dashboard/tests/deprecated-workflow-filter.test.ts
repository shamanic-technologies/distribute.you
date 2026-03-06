import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Workflow type includes deprecation fields", () => {
  const apiPath = path.join(__dirname, "../src/lib/api.ts");

  it("should have status field with active/deprecated union", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain('status: "active" | "deprecated"');
  });

  it("should have upgradedTo field", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("upgradedTo: string | null");
  });
});

describe("Campaign creation pages filter deprecated workflows", () => {
  const pages = [
    {
      name: "brand campaign page",
      path: path.join(
        __dirname,
        "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/campaigns/new/page.tsx"
      ),
    },
    {
      name: "feature section campaign page",
      path: path.join(
        __dirname,
        "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[sectionKey]/campaigns/new/page.tsx"
      ),
    },
    {
      name: "feature campaign page",
      path: path.join(
        __dirname,
        "../src/app/(dashboard)/features/[featureId]/new/page.tsx"
      ),
    },
  ];

  for (const page of pages) {
    it(`${page.name}: should filter deprecated workflows from display`, () => {
      const content = fs.readFileSync(page.path, "utf-8");
      expect(content).toContain('status !== "deprecated"');
    });

    it(`${page.name}: should build deprecatedNames set for leaderboard filtering`, () => {
      const content = fs.readFileSync(page.path, "utf-8");
      expect(content).toContain("deprecatedNames");
    });
  }
});

describe("Workflow listing pages filter deprecated workflows", () => {
  it("brand workflows page should filter deprecated", () => {
    const content = fs.readFileSync(
      path.join(
        __dirname,
        "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/workflows/page.tsx"
      ),
      "utf-8"
    );
    expect(content).toContain('status !== "deprecated"');
  });

  it("feature workflows page should filter deprecated", () => {
    const content = fs.readFileSync(
      path.join(
        __dirname,
        "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[sectionKey]/workflows/page.tsx"
      ),
      "utf-8"
    );
    expect(content).toContain("deprecatedNames");
  });

  it("feature-level workflows page should filter deprecated", () => {
    const content = fs.readFileSync(
      path.join(
        __dirname,
        "../src/app/(dashboard)/features/[featureId]/workflows/page.tsx"
      ),
      "utf-8"
    );
    expect(content).toContain('status === "deprecated"');
  });

  it("workflow selection table should filter deprecated", () => {
    const content = fs.readFileSync(
      path.join(
        __dirname,
        "../src/components/workflow-selection-table.tsx"
      ),
      "utf-8"
    );
    expect(content).toContain('status === "deprecated"');
  });
});

describe("Provider keys page filters deprecated workflows", () => {
  it("should skip deprecated workflows when building provider list", () => {
    const content = fs.readFileSync(
      path.join(
        __dirname,
        "../src/app/(dashboard)/orgs/[orgId]/api-keys/page.tsx"
      ),
      "utf-8"
    );
    expect(content).toContain('status === "deprecated"');
  });
});
