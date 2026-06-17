import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

/**
 * The campaign-level revenue surface (CampaignRevenueSection + CampaignBudgetCard
 * + the campaign detail page) was removed with the campaign concept. The brand
 * Overview is the surviving revenue surface. The shared ConversionsTabs +
 * RevenueCostSummary primitives below still back it — those guards remain.
 */
describe("ConversionsTabs — extracted + reused (single source for the tabs)", () => {
  const tabs = read("components/revenue/conversions-tabs.tsx");
  const section = read("components/revenue/revenue-overview-section.tsx");

  it("named-exports ConversionsTabs and wires the two tab ids + tables", () => {
    expect(tabs).toMatch(/export function ConversionsTabs\b/);
    for (const id of ["organizations", "leads"]) {
      expect(tabs).toContain(`"${id}"`);
    }
    expect(tabs).toContain("OrgConversionsTable");
    expect(tabs).toContain("LeadConversionsTable");
  });

  it("no longer wires the Events tab", () => {
    expect(tabs).not.toContain('"events"');
    expect(tabs).not.toContain("EventConversionsTable");
  });

  it("the feature Overview renders ConversionsTabs (single source for the tabs)", () => {
    expect(section).toContain("ConversionsTabs");
    // The inline tab state + tables moved into the shared component.
    expect(section).not.toContain("OrgConversionsTable");
  });
});

describe("RevenueCostSummary — default Top cost sources bottom card", () => {
  const card = read("components/revenue/revenue-cost-summary.tsx");
  it("accepts a bottomCard prop and renders it when provided", () => {
    expect(card).toContain("bottomCard");
    expect(card).toContain("bottomCard !== undefined ? bottomCard");
  });
  it("keeps the default Top cost sources path for the Overview", () => {
    expect(card).toContain("Top cost sources");
  });
});
