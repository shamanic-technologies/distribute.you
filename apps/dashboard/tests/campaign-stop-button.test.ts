import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const pagePath = path.join(
  __dirname,
  "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/campaigns/page.tsx"
);
const content = fs.readFileSync(pagePath, "utf-8");

describe("Campaign list stop button", () => {
  it("should import stopCampaign from api", () => {
    expect(content).toContain("stopCampaign");
    expect(content).toMatch(/import\s*\{[^}]*stopCampaign[^}]*\}\s*from\s*["']@\/lib\/api["']/);
  });

  it("should show stop button only for ongoing campaigns", () => {
    expect(content).toMatch(/campaign\.status\s*===\s*["']ongoing["']/);
  });

  it("should prevent Link navigation when clicking stop", () => {
    expect(content).toContain("e.preventDefault()");
    expect(content).toContain("e.stopPropagation()");
  });

  it("should show loading state while stopping", () => {
    expect(content).toContain("Stopping");
    expect(content).toContain("stoppingId");
  });

  it("should refetch campaigns after stopping", () => {
    expect(content).toContain("refetchCampaigns");
  });
});
