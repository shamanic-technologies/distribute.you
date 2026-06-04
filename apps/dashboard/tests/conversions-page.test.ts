import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const pagePath = path.resolve(
  __dirname,
  "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/conversions/page.tsx",
);
const sidebarPath = path.resolve(
  __dirname,
  "../src/components/context-sidebar.tsx",
);
const gatesPath = path.resolve(__dirname, "../src/lib/feature-gates.ts");

const page = fs.readFileSync(pagePath, "utf-8");
const sidebar = fs.readFileSync(sidebarPath, "utf-8");
const gates = fs.readFileSync(gatesPath, "utf-8");

describe("conversions surface is alpha-gated (staff-only)", () => {
  it("registers the `conversions` gate", () => {
    expect(gates).toMatch(/conversions:\s*\{\s*flag:\s*"alpha-conversions"/);
  });

  it("page gates its body on the conversions flag", () => {
    expect(page).toContain('FEATURE_GATES["conversions"]');
    expect(page).toContain("useFeatureFlag");
  });

  it("sidebar only adds the Conversions link when the flag is on", () => {
    expect(sidebar).toContain('FEATURE_GATES["conversions"]');
    expect(sidebar).toContain("conversionsOk");
  });
});

describe("conversions page keeps all three tabs", () => {
  it("renders Organizations / Leads / Events", () => {
    for (const id of ["organizations", "leads", "events"]) {
      expect(page).toContain(`"${id}"`);
    }
  });

  it("wires each tab to its table component", () => {
    expect(page).toContain("OrgConversionsTable");
    expect(page).toContain("LeadConversionsTable");
    expect(page).toContain("EventConversionsTable");
  });
});
