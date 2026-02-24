import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Campaign detail page uses time-ago with tooltip", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/brands/[brandId]/mcp/sales-outreach/campaigns/[id]/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should have a timeAgo utility function", () => {
    expect(content).toContain("function timeAgo(");
  });

  it("should use timeAgo for campaign creation date", () => {
    expect(content).toContain("timeAgo(campaign.createdAt)");
  });

  it("should not use toLocaleDateString for the creation date", () => {
    // The creation date line should no longer use toLocaleDateString
    expect(content).not.toMatch(/Created.*toLocaleDateString/);
  });

  it("should have an InfoTooltip component", () => {
    expect(content).toContain("function InfoTooltip(");
    expect(content).toContain("onMouseEnter");
    expect(content).toContain("onMouseLeave");
  });

  it("should render InfoTooltip next to the time-ago text", () => {
    expect(content).toContain("<InfoTooltip text={formatExactDate(campaign.createdAt)}");
  });

  it("should have formatExactDate with timezone and human-readable format", () => {
    expect(content).toContain("function formatExactDate(");
    expect(content).toContain("timeZoneName");
    expect(content).toContain("weekday");
    expect(content).toContain("hour");
    expect(content).toContain("minute");
    expect(content).toContain("second");
  });
});
