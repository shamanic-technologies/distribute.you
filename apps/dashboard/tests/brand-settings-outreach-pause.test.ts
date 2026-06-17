import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "..");
const settingsPage = readFileSync(
  resolve(ROOT, "src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/settings/page.tsx"),
  "utf8",
);

describe("Brand Settings outreach pause card", () => {
  it("uses the same brand-level pause API as the overview control", () => {
    expect(settingsPage).toContain("getBrandPause");
    expect(settingsPage).toContain("setBrandPause");
    expect(settingsPage).toContain('["brandPause", brandId]');
    expect(settingsPage).toContain("setBrandPause(brandId, true)");
  });

  it("does not derive brand pause state from campaign stop/list state", () => {
    expect(settingsPage).not.toContain("useStopCampaign");
    expect(settingsPage).not.toContain("listCampaignsByBrand");
    expect(settingsPage).not.toContain('status !== "stopped"');
  });

  it("renders an already-paused state instead of another active pause CTA", () => {
    expect(settingsPage).toContain("Your outreach is already paused.");
    expect(settingsPage).toContain('paused ? "Paused" :');
    expect(settingsPage).toContain("disabled={paused || saving}");
  });
});
