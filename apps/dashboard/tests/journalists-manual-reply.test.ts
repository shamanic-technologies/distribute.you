import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const genericModalPath = path.resolve(
  __dirname,
  "../src/components/manual-qualification/edit-manual-qualification-modal.tsx",
);
const journalistsPagePath = path.resolve(
  __dirname,
  "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/journalists/page.tsx",
);

describe("Generic EditManualQualificationModal — decoupled from Lead", () => {
  const src = fs.readFileSync(genericModalPath, "utf-8");

  it("exports EditManualQualificationModal", () => {
    expect(src).toMatch(/export function EditManualQualificationModal/);
  });

  it("takes campaignId/email/brandId/currentStatus/onClose props (no `lead`)", () => {
    expect(src).toMatch(/campaignId:\s*string/);
    expect(src).toMatch(/email:\s*string/);
    expect(src).toMatch(/brandId:\s*string/);
    expect(src).toMatch(/currentStatus:\s*ManualQualificationStatus\s*\|\s*null/);
    expect(src).toMatch(/onClose:\s*\(\)\s*=>\s*void/);
    expect(src).not.toMatch(/\blead:\s*Lead\b/);
  });

  it("calls setManualQualification with the props (not lead.campaignId)", () => {
    expect(src).toMatch(/campaignId(?:,|\s*})/);
    expect(src).toMatch(/email(?:,|\s*})/);
    expect(src).not.toMatch(/lead\.campaignId/);
  });
});

describe("Journalists feature page — manual reply qualification wired", () => {
  const src = fs.readFileSync(journalistsPagePath, "utf-8");

  it("imports the generic modal", () => {
    expect(src).toContain("EditManualQualificationModal");
  });

  it("fetches qualifications via useManualQualifications", () => {
    expect(src).toContain("useManualQualifications(brandId)");
  });

  it("builds the qualificationByKey lookup", () => {
    expect(src).toContain("qualificationKey");
    expect(src).toContain("buildLatestQualificationMap");
  });

  it("renders Edit status trigger inside the CampaignEntryCard loop", () => {
    // The trigger and the per-campaign loop must coexist
    expect(src).toMatch(/j\.campaigns\.map/);
    expect(src).toContain('data-testid="open-edit-status-modal"');
  });

  it("shows the ManualQualificationBadge for existing qualifications", () => {
    expect(src).toContain("ManualQualificationBadge");
  });
});
