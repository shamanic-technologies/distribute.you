import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Onboarding flow", () => {
  const pagePath = path.join(__dirname, "../src/app/onboarding/page.tsx");

  it("should have an onboarding page", () => {
    expect(fs.existsSync(pagePath)).toBe(true);
  });

  it("should be a client component", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain('"use client"');
  });

  it("should have a value proposition step", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("Welcome to Distribute");
    expect(content).toContain("value-prop");
  });

  it("should have agency and company type selection", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("Agency");
    expect(content).toContain("Company");
    expect(content).toContain("type-selection");
  });

  it("should have a name input step", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("name-input");
    expect(content).toContain("Create Workspace");
  });

  it("should call the app registration endpoint", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("/v1/apps/register");
  });

  it("should show API key on success", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("apiKey");
    expect(content).toContain("Copy");
  });
});

describe("Onboarding layout", () => {
  const layoutPath = path.join(__dirname, "../src/app/onboarding/layout.tsx");

  it("should have an onboarding layout", () => {
    expect(fs.existsSync(layoutPath)).toBe(true);
  });

  it("should use QueryProvider", () => {
    const content = fs.readFileSync(layoutPath, "utf-8");
    expect(content).toContain("QueryProvider");
  });
});
