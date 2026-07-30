import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");
const exists = (rel: string) => fs.existsSync(path.join(SRC, rel));

/**
 * The Organizations / Leads conversion tabs never rendered. Both callers of
 * `RevenueOverviewSection` (the brand Overview and the campaign Overview) passed
 * `conversions={null}`, so the tabs branch was unreachable — a whole cluster of
 * tables, a detail panel and a pager sitting behind a prop nobody set.
 *
 * The live leads surface is `components/audiences/engaged-leads-page.tsx`.
 */
describe("Conversion tabs cluster — retired", () => {
  it("no longer ships the tabs, the tables, the detail panel or their pager", () => {
    expect(exists("components/revenue/conversions-tabs.tsx")).toBe(false);
    expect(exists("components/revenue/conversions-table.tsx")).toBe(false);
    expect(exists("components/revenue/conversion-detail-panel.tsx")).toBe(false);
    // Its only consumer was the deleted table.
    expect(exists("components/table-pagination.tsx")).toBe(false);
  });

  it("drops the prop that gated them from the section and both call sites", () => {
    const section = read("components/revenue/revenue-overview-section.tsx");
    expect(section).not.toContain("ConversionsTabs");
    // The prop itself, not the word — the section still headlines "Outreach &
    // Conversions" and describes the clicks and conversions it renders.
    expect(section).not.toContain("conversions?: ReactNode");
    expect(section).not.toContain("conversions === undefined");

    for (const rel of [
      "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
      "components/campaigns/campaign-overview-page.tsx",
    ]) {
      expect(read(rel)).not.toContain("conversions={null}");
    }
  });
});
