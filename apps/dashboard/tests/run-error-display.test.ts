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

  it("should include error and errorSummary in enrichmentRun", () => {
    // The enrichmentRun nested type in Lead
    const leadMatch = content.match(/enrichmentRun: \{[\s\S]*?\} \| null/);
    expect(leadMatch).not.toBeNull();
    const enrichmentRun = leadMatch![0];
    expect(enrichmentRun).toContain("error?: string");
    expect(enrichmentRun).toContain("errorSummary?: ErrorSummary");
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
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/brand-info/page.tsx"
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

describe("Leads page — enrichment run error display", () => {
  const pagePath = path.resolve(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[sectionKey]/campaigns/[id]/leads/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should display rootCause for failed enrichment runs", () => {
    expect(content).toContain("selectedLead.enrichmentRun.errorSummary.rootCause");
  });

  it("should display failedStep for failed enrichment runs", () => {
    expect(content).toContain("selectedLead.enrichmentRun.errorSummary.failedStep");
  });

  it("should guard with status check and errorSummary presence", () => {
    expect(content).toContain('enrichmentRun.status === "failed" && selectedLead.enrichmentRun.errorSummary');
  });
});

describe("Emails page — generation run error display", () => {
  const pagePath = path.resolve(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[sectionKey]/campaigns/[id]/emails/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should display rootCause for failed generation runs", () => {
    expect(content).toContain("selectedEmail.generationRun.errorSummary.rootCause");
  });

  it("should display failedStep for failed generation runs", () => {
    expect(content).toContain("selectedEmail.generationRun.errorSummary.failedStep");
  });

  it("should guard with status check and errorSummary presence", () => {
    expect(content).toContain('generationRun.status === "failed" && selectedEmail.generationRun.errorSummary');
  });
});
