import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("ErrorSummary type definition", () => {
  const apiPath = path.resolve(__dirname, "../src/lib/api.ts");
  const content = fs.readFileSync(apiPath, "utf-8");

  it("should define ErrorSummary interface with failedStep, message, rootCause", () => {
    expect(content).toContain("export interface ErrorSummary");
    expect(content).toContain("failedStep: string");
    expect(content).toContain("message: string");
    expect(content).toContain("rootCause: string");
  });

  it("should include error and errorSummary in BrandRun", () => {
    // Extract BrandRun interface
    const brandRunMatch = content.match(/export interface BrandRun \{[\s\S]*?\n\}/);
    expect(brandRunMatch).not.toBeNull();
    const brandRun = brandRunMatch![0];
    expect(brandRun).toContain("error?: string");
    expect(brandRun).toContain("errorSummary?: ErrorSummary");
  });

  it("should include error and errorSummary in generationRun", () => {
    // The generationRun nested type in Email
    const emailMatch = content.match(/generationRun: \{[\s\S]*?\} \| null/);
    expect(emailMatch).not.toBeNull();
    const generationRun = emailMatch![0];
    expect(generationRun).toContain("error?: string");
    expect(generationRun).toContain("errorSummary?: ErrorSummary");
  });
});

describe("Brand info page — failed run error display", () => {
  const pagePath = path.resolve(
    __dirname,
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/brand-info/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should display rootCause from errorSummary for failed runs", () => {
    expect(content).toContain("run.errorSummary.rootCause");
  });

  it("should display failedStep from errorSummary for failed runs", () => {
    expect(content).toContain("run.errorSummary.failedStep");
  });

  it("should only show error details when status is failed and errorSummary exists", () => {
    expect(content).toContain('run.status === "failed" && run.errorSummary');
  });
});
