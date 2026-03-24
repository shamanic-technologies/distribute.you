import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Campaign overview page shows total cost", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/[id]/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should display total cost aligned right in the header", () => {
    expect(content).toContain("justify-between");
    expect(content).toContain("totalCostInUsdCents");
    expect(content).toContain("Total cost:");
  });

  it("should format cost from cents to USD", () => {
    expect(content).toContain("formatTotalCost");
    expect(content).toContain("/ 100");
    expect(content).toContain(".toFixed(2)");
  });
});
