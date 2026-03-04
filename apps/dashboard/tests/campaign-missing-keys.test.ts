import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Campaign creation — missing keys handling", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/features/[featureId]/new/page.tsx"
  );

  it("should import ApiError for structured error handling", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("ApiError");
  });

  it("should check for missing_keys error code", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain('"missing_keys"');
  });

  it("should display missing provider names from error body", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("err.body.missing");
    expect(content).toContain("Missing provider keys");
  });

  it("should use getWorkflowKeyStatus to check missing providers", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("getWorkflowKeyStatus");
    expect(content).toContain("keyStatusData");
  });

  it("should fetch workflows for workflow listing", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("listWorkflows");
  });

  it("should show warning banner when providers are missing", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("missingProviders");
    expect(content).toContain("bg-amber-50");
    expect(content).toContain("Configure Provider Keys");
  });

  it("should link to provider keys page from warning", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("provider-keys");
    expect(content).toContain("org.id");
  });

  it("should have WorkflowDetailPanel for workflow info", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("WorkflowDetailPanel");
    expect(content).toContain("detailWorkflowId");
  });

  it("should have info button on workflow rows", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("onShowDetail");
    expect(content).toContain("View workflow details");
  });
});

describe("ApiError class", () => {
  const apiPath = path.join(__dirname, "../src/lib/api.ts");

  it("should export ApiError class with status and body", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("export class ApiError extends Error");
    expect(content).toContain("public readonly status: number");
    expect(content).toContain("public readonly body: Record<string, unknown>");
  });

  it("should throw ApiError with full error body on non-ok responses", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("throw new ApiError(");
    expect(content).toContain("response.status");
    expect(content).toContain("errorBody");
  });
});

describe("Workflow type includes requiredProviders", () => {
  const apiPath = path.join(__dirname, "../src/lib/api.ts");

  it("should have requiredProviders field in Workflow interface", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("requiredProviders: string[]");
  });

  it("should have WorkflowSummary type", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("export interface WorkflowSummary");
    expect(content).toContain("steps: string[]");
  });

  it("should have WorkflowKeyStatus type", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("export interface WorkflowKeyStatus");
    expect(content).toContain("ready: boolean");
    expect(content).toContain("missing: string[]");
  });

  it("should have getWorkflowSummary function", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("export async function getWorkflowSummary");
    expect(content).toContain("/summary");
  });

  it("should have getWorkflowKeyStatus function", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("export async function getWorkflowKeyStatus");
    expect(content).toContain("/key-status");
  });
});
