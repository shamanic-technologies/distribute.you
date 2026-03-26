import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Provider Keys page (redirect to unified keys)", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/provider-keys/page.tsx"
  );

  it("should exist", () => {
    expect(fs.existsSync(pagePath)).toBe(true);
  });

  it("should be a client component", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain('"use client"');
  });

  it("should redirect to unified api-keys page", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).toContain("router.replace");
    expect(content).toContain("api-keys");
  });
});

describe("API Keys page capitalize handles non-string input", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/api-keys/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should guard capitalize against non-string values", () => {
    expect(content).toContain("String(s ?? \"\")");
  });

  it("should filter non-string values from requiredProviders", () => {
    expect(content).toContain('typeof p === "string"');
  });
});

describe("Unified API Keys page has provider keys section", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/api-keys/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should import BYOK key functions from api", () => {
    expect(content).toContain("listByokKeys");
    expect(content).toContain("setByokKey");
    expect(content).toContain("deleteByokKey");
  });

  it("should import key source functions from api", () => {
    expect(content).toContain("listKeySources");
    expect(content).toContain("setKeySource");
    expect(content).toContain("KeySourcePreference");
  });

  it("should fetch workflows to discover known providers", () => {
    expect(content).toContain("listWorkflows");
    expect(content).toContain("requiredProviders");
  });

  it("should fetch key source preferences", () => {
    expect(content).toContain("keySources");
    expect(content).toContain("keySourcesLoading");
  });

  it("should show configured vs not-configured status", () => {
    expect(content).toContain("configured");
    expect(content).toContain("Not configured");
    expect(content).toContain("bg-green-500");
    expect(content).toContain("bg-gray-300");
  });

  it("should have add/rotate and remove actions", () => {
    expect(content).toContain("Add Key");
    expect(content).toContain("Rotate");
    expect(content).toContain("Remove");
  });

  it("should have key source toggle button", () => {
    expect(content).toContain("handleToggleSource");
    expect(content).toContain("Use own key");
    expect(content).toContain("Use platform");
  });

  it("should show platform key status", () => {
    expect(content).toContain("Using platform key");
  });

  it("should have inline edit form with password input", () => {
    expect(content).toContain('type="password"');
    expect(content).toContain("handleSaveProvider");
    expect(content).toContain("cancelEditingProvider");
  });

  it("should use useAuthQuery for data fetching", () => {
    expect(content).toContain("useAuthQuery");
  });

  it("should have Platform API Key section", () => {
    expect(content).toContain("Platform API Key");
    expect(content).toContain("Create New API Key");
  });

  it("should have Provider Keys section", () => {
    expect(content).toContain("Provider Keys");
    expect(content).toContain("BYOK");
  });

  it("should show error and success messages for providers", () => {
    expect(content).toContain("providerError");
    expect(content).toContain("providerSuccess");
    expect(content).toContain("bg-red-50");
    expect(content).toContain("bg-green-50");
  });

  it("should use delete confirmation dialog", () => {
    expect(content).toContain("confirm(");
  });
});

describe("Serper.dev provider key support", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/api-keys/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should include serper-dev in always-visible providers", () => {
    expect(content).toContain("ALWAYS_VISIBLE_PROVIDERS");
    expect(content).toContain('"serper-dev"');
  });

  it("should have provider metadata with label and description for serper-dev", () => {
    expect(content).toContain("Serper.dev API Key");
    expect(content).toContain("web and news search via Google");
  });

  it("should use providerLabel for display names", () => {
    expect(content).toContain("providerLabel(row.provider)");
  });
});

describe("API registry includes serper-dev domain", () => {
  const registryPath = path.join(__dirname, "../src/lib/api-registry.ts");
  const content = fs.readFileSync(registryPath, "utf-8");

  it("should map serper-dev to serper.dev domain", () => {
    expect(content).toContain('"serper-dev": "serper.dev"');
  });
});
