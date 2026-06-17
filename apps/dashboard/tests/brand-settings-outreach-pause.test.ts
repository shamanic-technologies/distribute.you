import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..");
const settingsPage = readFileSync(
  resolve(ROOT, "src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/settings/page.tsx"),
  "utf8",
);
const brandStatusControl = readFileSync(
  resolve(ROOT, "src/components/brand/brand-status-control.tsx"),
  "utf8",
);

describe("Brand Settings outreach status control", () => {
  it("reuses the same brand-level status control as Overview", () => {
    expect(settingsPage).toContain("BrandStatusControl");
    expect(settingsPage).toContain("<BrandStatusControl brandId={brandId} />");
    expect(brandStatusControl).toContain("getBrandPause");
    expect(brandStatusControl).toContain("setBrandPause");
    expect(brandStatusControl).toContain('["brandPause", brandId]');
  });

  it("does not derive brand pause state from campaign stop/list state", () => {
    expect(settingsPage).not.toContain("useStopCampaign");
    expect(settingsPage).not.toContain("listCampaignsByBrand");
    expect(settingsPage).not.toContain('status !== "stopped"');
  });

  it("shows active/paused status and a Pause/Restart toggle from the shared control", () => {
    expect(brandStatusControl).toContain("Paused");
    expect(brandStatusControl).toContain("Active");
    expect(brandStatusControl).toContain('paused ? "Restart" : "Pause"');
    expect(brandStatusControl).toContain("setPaused(!paused)");
  });

  it("keeps budget and goal controls visible beside the run status", () => {
    expect(brandStatusControl).toContain("budgetLabel");
    expect(brandStatusControl).toContain("openBudgetDialog");
    expect(brandStatusControl).toContain("Optimization goal");
  });
});
