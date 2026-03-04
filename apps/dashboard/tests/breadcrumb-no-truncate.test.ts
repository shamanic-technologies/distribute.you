import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const BREADCRUMB_PATH = path.join(
  __dirname,
  "../src/components/breadcrumb-nav.tsx"
);

describe("BreadcrumbNav truncation", () => {
  const content = fs.readFileSync(BREADCRUMB_PATH, "utf-8");

  it("should not truncate the brand name link in the breadcrumb", () => {
    // Find the brand Link element (contains /brands/${brandId})
    // Regex captures the className of the Link whose href includes /brands/
    const brandLinkRegex =
      /Link\s+href=\{`\/orgs\/\$\{orgId\}\/brands\/\$\{brandId\}`\}\s+className="([^"]*)"/;
    const match = content.match(brandLinkRegex);
    expect(match, "brand Link element should exist in breadcrumb").toBeTruthy();
    const className = match![1];
    expect(className).not.toContain("truncate");
    expect(className).not.toMatch(/max-w-/);
  });

  it("should not truncate the campaign name link in the breadcrumb", () => {
    // Find the campaign Link element (contains /campaigns/${campaignId})
    const campaignLinkRegex =
      /Link\s+href=\{`\/orgs\/\$\{orgId\}\/brands\/\$\{brandId\}\/outcomes\/\$\{sectionKey\}\/campaigns\/\$\{campaignId\}`\}\s+className="([^"]*)"/;
    const match = content.match(campaignLinkRegex);
    expect(
      match,
      "campaign Link element should exist in breadcrumb"
    ).toBeTruthy();
    const className = match![1];
    expect(className).not.toContain("truncate");
    expect(className).not.toMatch(/max-w-/);
  });
});
