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
      /Link\s+href=\{(?:explicitHierarchyHref\()?`\/orgs\/\$\{orgId\}\/brands\/\$\{brandId\}`\)?\}\s+className="([^"]*)"/;
    const match = content.match(brandLinkRegex);
    expect(match, "brand Link element should exist in breadcrumb").toBeTruthy();
    const className = match![1];
    expect(className).not.toContain("truncate");
    expect(className).not.toMatch(/max-w-/);
  });

  it("carries no workflow crumb — the workflow routes are deleted", () => {
    // Those pages were `useFeatureFlag`-gated, i.e. rendered for nobody in this app.
    expect(content).not.toContain("workflowName");
    expect(content).not.toContain("workflowId");
  });

  // The campaign breadcrumb link was removed with the campaign concept — the
  // breadcrumb is Org → Brand (→ Feature at the app-feature level) only.
});
