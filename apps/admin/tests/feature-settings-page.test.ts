import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

// Feature Settings landing. GA, no alpha gate. Lifetime revenue and rates live on
// the offer now, so neither settings page edits brand-level economics.
describe("Feature Settings page", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/settings/page.tsx",
  );
  const brandSettingsPath = path.join(
    __dirname,
    "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/settings/page.tsx",
  );

  it("exists at the feature /settings route", () => {
    expect(fs.existsSync(pagePath)).toBe(true);
  });

  it("is a client component", () => {
    expect(fs.readFileSync(pagePath, "utf-8")).toContain('"use client"');
  });

  it("renders no brand economics editor on either settings page (retired 2026-10-05)", () => {
    for (const p of [pagePath, brandSettingsPath]) {
      const content = fs.readFileSync(p, "utf-8");
      expect(content).not.toContain("SalesEconomics");
      expect(content).not.toContain("Sales Economics");
    }
  });

  it("is GA — no feature-flag gate on the page", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    expect(content).not.toContain("useFeatureFlag");
    expect(content).not.toContain("FEATURE_GATES");
  });
});
