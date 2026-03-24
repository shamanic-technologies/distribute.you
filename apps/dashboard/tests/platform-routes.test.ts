import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const routesDir = path.resolve(__dirname, "../src/app/api/v1");
const apiPath = path.resolve(__dirname, "../src/lib/api.ts");
const registryPath = path.resolve(__dirname, "../src/lib/api-registry.ts");

describe("api-registry helper", () => {
  it("should exist at lib/api-registry.ts", () => {
    expect(fs.existsSync(registryPath)).toBe(true);
  });

  it("should export registryFetch and PROVIDER_DOMAINS", () => {
    const content = fs.readFileSync(registryPath, "utf-8");
    expect(content).toContain("export async function registryFetch");
    expect(content).toContain("export const PROVIDER_DOMAINS");
  });

  it("should use API_REGISTRY_SERVICE_URL env var", () => {
    const content = fs.readFileSync(registryPath, "utf-8");
    expect(content).toContain("API_REGISTRY_SERVICE_URL");
    expect(content).toContain("api-registry.distribute.you");
  });

  it("should include common provider domain mappings", () => {
    const content = fs.readFileSync(registryPath, "utf-8");
    expect(content).toContain("anthropic.com");
    expect(content).toContain("openai.com");
    expect(content).toContain("apollo.io");
    expect(content).toContain("instantly.ai");
  });
});

describe("GET /api/v1/platform/llm-context", () => {
  const routePath = path.join(routesDir, "platform/llm-context/route.ts");

  it("should exist", () => {
    expect(fs.existsSync(routePath)).toBe(true);
  });

  it("should require Clerk auth", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("@clerk/nextjs/server");
    expect(content).toContain("await auth()");
  });

  it("should call api-registry /llm-context", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain('registryFetch("/llm-context")');
  });

  it("should set cache headers", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("Cache-Control");
  });

  it("should export GET handler", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("export async function GET");
  });
});

describe("GET /api/v1/platform/services", () => {
  const routePath = path.join(routesDir, "platform/services/route.ts");

  it("should exist", () => {
    expect(fs.existsSync(routePath)).toBe(true);
  });

  it("should call api-registry /services", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain('registryFetch("/services")');
  });

  it("should require Clerk auth", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("await auth()");
  });
});

describe("GET /api/v1/platform/services/[service]", () => {
  const routePath = path.join(routesDir, "platform/services/[service]/route.ts");

  it("should exist", () => {
    expect(fs.existsSync(routePath)).toBe(true);
  });

  it("should call api-registry /openapi/:service", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("registryFetch(`/openapi/");
  });

  it("should encode the service parameter", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("encodeURIComponent(service)");
  });
});

describe("GET /api/v1/workflows/[id]/required-providers", () => {
  const routePath = path.join(routesDir, "workflows/[id]/required-providers/route.ts");

  it("should exist", () => {
    expect(fs.existsSync(routePath)).toBe(true);
  });

  it("should require Clerk auth with org", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("await auth()");
    expect(content).toContain("orgId");
  });

  it("should fetch workflow from api-service with Bearer auth", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("/v1/workflows/");
    expect(content).toContain("Authorization");
    expect(content).toContain("Bearer");
  });

  it("should map providers to domains using PROVIDER_DOMAINS", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("PROVIDER_DOMAINS");
    expect(content).toContain("provider.toLowerCase()");
  });

  it("should return workflowId, workflowName, and providers array", () => {
    const content = fs.readFileSync(routePath, "utf-8");
    expect(content).toContain("workflowId:");
    expect(content).toContain("workflowName:");
    expect(content).toContain("providers:");
  });
});

describe("api.ts platform client functions", () => {
  it("should export getPlatformLlmContext", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("export async function getPlatformLlmContext");
    expect(content).toContain("/platform/llm-context");
  });

  it("should export getPlatformServices", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("export async function getPlatformServices");
    expect(content).toContain("/platform/services");
  });

  it("should export getPlatformServiceSpec", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("export async function getPlatformServiceSpec");
  });

  it("should export getWorkflowRequiredProviders", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("export async function getWorkflowRequiredProviders");
    expect(content).toContain("/required-providers");
  });

  it("should define WorkflowProvider and WorkflowRequiredProviders types", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("export interface WorkflowProvider");
    expect(content).toContain("export interface WorkflowRequiredProviders");
  });

  it("should define LlmContextResponse type", () => {
    const content = fs.readFileSync(apiPath, "utf-8");
    expect(content).toContain("export interface LlmContextResponse");
    expect(content).toContain("export interface LlmServiceSummary");
  });
});
