import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Owner 2026-10-07: every campaign page shows a line chart of the campaign's ROI since
 * inception, ABOVE the outcome steps chart. The curve is features-service's `roiHistory`
 * on the campaign-scoped `/revenue`; nothing is divided in the browser.
 */
const page = fs.readFileSync(path.join(__dirname, "../src/components/v2/campaign-page.tsx"), "utf-8");
const chart = fs.readFileSync(path.join(__dirname, "../src/components/v2/campaign-roi-chart.tsx"), "utf-8");

function slice(anchor: string, next: string): string {
  const at = page.indexOf(anchor);
  expect(at, anchor).toBeGreaterThan(-1);
  return page.slice(at, page.indexOf(next, at + anchor.length));
}

describe("campaign ROI chart", () => {
  it("sits above the steps on the cold-email overview", () => {
    const body = slice("function CampaignOverview(", "function ConversationOverview(");
    const at = body.indexOf("<CampaignRoiChart");
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(body.indexOf("<LegSteps"));
  });

  it("sits above the steps on the conversation overview", () => {
    const at = page.indexOf("function ConversationOverview(");
    const body = page.slice(at);
    const chartAt = body.indexOf("<CampaignRoiChart");
    expect(chartAt).toBeGreaterThan(-1);
    expect(chartAt).toBeLessThan(body.indexOf("<StepBar"));
  });

  it("plots the served roiMultiple and computes no ratio", () => {
    expect(chart).toContain("getCampaignRoiHistory(");
    expect(chart).toContain("d.roiMultiple");
    expect(chart).not.toMatch(/cumulativePipelineUsd\s*\//);
  });
});
