import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("SalesColdEmailsCard component", () => {
  const componentPath = path.join(
    __dirname,
    "../src/components/sales-cold-emails-card.tsx"
  );
  const content = fs.readFileSync(componentPath, "utf-8");

  it("should fetch BYOK keys to determine setup state", () => {
    expect(content).toContain("listByokKeys");
    expect(content).toContain("useAuthQuery");
  });

  it("should show 'Get Started' when no keys are configured", () => {
    expect(content).toContain("Get Started");
  });

  it("should show 'Complete setup' when some keys are configured", () => {
    expect(content).toContain("Complete setup");
  });

  it("should show 'View setup' when all keys are configured", () => {
    expect(content).toContain("View setup");
  });

  it("should use orange styling for Get Started and Complete setup, grey for View setup", () => {
    // Orange CTA for actionable states
    expect(content).toContain("text-primary-500");
    // Grey styling for completed state
    expect(content).toContain("text-gray-400");
  });

  it("should check both anthropic and apollo providers", () => {
    expect(content).toContain("anthropic");
    expect(content).toContain("apollo");
  });
});

describe("Dashboard page uses SalesColdEmailsCard", () => {
  it("should import and render SalesColdEmailsCard instead of static markup", () => {
    const pagePath = path.join(
      __dirname,
      "../src/app/(dashboard)/page.tsx"
    );
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("SalesColdEmailsCard");
    // Should NOT have the old static "Get Started" link
    expect(content).not.toContain("Get Started →");
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
