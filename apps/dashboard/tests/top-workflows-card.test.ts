import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

const CAMPAIGNS_PAGE =
  "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/page.tsx";

/**
 * The feature Campaigns page's cost/efficiency column shows a Top-3 workflows-by-ROI
 * list (replacing the brand-wide "Top cost sources" list, which stays on... nowhere
 * else now — only the component default keeps it). ROI is PROJECTED (per-workflow
 * realized revenue is not a stat): features-service `workflow-projection`, ROI =
 * 100 / cacPct (budget-invariant). Dynasty-first display.
 */
describe("TopWorkflowsCard — top-3 workflows by ROI", () => {
  const card = read("components/revenue/top-workflows-card.tsx");

  it("named-exports TopWorkflowsCard", () => {
    expect(card).toMatch(/export function TopWorkflowsCard\b/);
  });

  it("reads the workflow projection (objective-agnostic, budget-invariant ROI)", () => {
    expect(card).toContain("getWorkflowProjection");
    // ROI = 100 / cacPct (budget-invariant), so the ranking needs no budget choice.
    expect(card).toContain("100 / cacPct");
  });

  it("ranks by ROI desc, drops null-ROI workflows, caps at 3", () => {
    expect(card).toContain("b.roi - a.roi");
    expect(card).toContain(".slice(0, 3)");
    expect(card).toMatch(/cacPct != null/);
  });

  it("displays dynasty name (dynasty-first), falling back to the slug", () => {
    expect(card).toContain("w.workflowDynastyName ?? w.workflowDynastySlug");
  });

  it("static-shell: title outside the pending gate, rows skeleton while loading", () => {
    expect(card).toContain("Top workflows by ROI");
    expect(card).toContain("Skeleton");
  });
});

describe("Campaigns page — wires TopWorkflowsCard as the bottom card", () => {
  const page = read(CAMPAIGNS_PAGE);

  it("passes TopWorkflowsCard into RevenueCostSummary's bottomCard slot", () => {
    expect(page).toContain("bottomCard={<TopWorkflowsCard");
  });
});
