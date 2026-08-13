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

describe("Brand Settings — the run-status section is retired", () => {
  it("no longer renders the brand status control on Settings", () => {
    // The "Outreach · Maximising X · Active · $N/day · Pause" bar was removed
    // from Brand Settings (and the brand Overview). The control still lives on
    // the campaign overview, where a campaign's spend is operated on.
    expect(settingsPage).not.toContain("BrandStatusControl");
    expect(settingsPage).not.toContain('"Outreach"');
    expect(brandStatusControl).toContain("getBrandPause");
    expect(brandStatusControl).toContain("setBrandPause");
    expect(brandStatusControl).toContain('["brandPause", brandId]');
  });

  it("does not derive brand pause state from campaign stop/list state", () => {
    expect(settingsPage).not.toContain("useStopCampaign");
    expect(settingsPage).not.toContain("listCampaignsByBrand");
    expect(settingsPage).not.toContain('status !== "stopped"');
  });

  it("the shared control still shows active/paused status and a Pause/Restart toggle", () => {
    expect(brandStatusControl).toContain("Paused");
    expect(brandStatusControl).toContain("Active");
    expect(brandStatusControl).toContain('paused ? "Restart" : "Pause"');
    expect(brandStatusControl).toContain("setPaused(!paused)");
  });

  it("the shared control states the spend and the goal beside the run status, editing neither", () => {
    // The pill STATES the daily budget; it no longer edits it. Money is funded
    // per sales funnel now, and the funnel is where the customer sets it — a
    // second editor here would write a brand-level number that contradicts the
    // ceilings it is supposed to be the sum of.
    expect(brandStatusControl).toContain("budgetLabel");
    expect(brandStatusControl).not.toContain("openBudgetDialog");
    // Same reasoning for the goal: it is the retired vocabulary features-service no
    // longer reads, and what a brand sells through is its declared funnels. Stated, not edited.
    expect(brandStatusControl).toContain("GOAL_LABEL[goal]");
    expect(brandStatusControl).not.toContain("Optimization goal");
  });
});
