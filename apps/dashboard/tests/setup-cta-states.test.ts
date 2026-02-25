import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Dashboard page uses WORKFLOW_DEFINITIONS", () => {
  it("should import and render workflow cards from @mcpfactory/content", () => {
    const pagePath = path.join(
      __dirname,
      "../src/app/(dashboard)/page.tsx"
    );
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("WORKFLOW_DEFINITIONS");
    expect(content).toContain("WORKFLOW_DEFINITIONS.map");
    // Should NOT have the old SalesColdEmailsCard component
    expect(content).not.toContain("SalesColdEmailsCard");
  });
});

describe("BrandsList shows 'View campaigns' CTA", () => {
  it("should display a 'View campaigns' link on each brand card", () => {
    const componentPath = path.join(
      __dirname,
      "../src/components/brands-list.tsx"
    );
    const content = fs.readFileSync(componentPath, "utf-8");
    expect(content).toContain("View campaigns");
    expect(content).toContain("text-primary-500");
  });
});
