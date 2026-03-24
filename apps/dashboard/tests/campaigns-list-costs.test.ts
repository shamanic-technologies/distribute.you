import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Campaigns list page shows costs", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should aggregate totalCostCents across all campaigns", () => {
    expect(content).toContain("totalCostCents");
    expect(content).toContain("totalCostInUsdCents");
  });

  it("should display total cost aligned right in the page header", () => {
    expect(content).toContain("Total cost:");
    // Header uses justify-between to push cost to the right
    expect(content).toContain("justify-between");
  });

  it("should display cost per campaign row aligned right", () => {
    // Each campaign row shows formatted cost with font-semibold
    expect(content).toContain("formatCost(stats.totalCostInUsdCents)");
    expect(content).toContain("font-semibold");
  });
});
