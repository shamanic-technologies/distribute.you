import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression: the campaigns list page must poll every 5s so stats update
 * in real time, but must NOT flash skeletons on each refetch.
 */
describe("Campaigns list page polls without skeleton flash", () => {
  const campaignsPagePath = path.resolve(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/campaigns/page.tsx"
  );
  const content = fs.readFileSync(campaignsPagePath, "utf-8");

  it("should set refetchInterval on queries", () => {
    expect(content).toMatch(/refetchInterval/);
  });

  it("should disable polling when tab is in background", () => {
    expect(content).toMatch(/refetchIntervalInBackground:\s*false/);
  });

  it("should use isLoading (not isFetching) for skeleton guard", () => {
    // isLoading only fires on initial load, not background refetches
    expect(content).toMatch(/isLoading/);
    expect(content).not.toMatch(/isFetching/);
  });

  it("should not use isPending for skeleton display", () => {
    expect(content).not.toMatch(/isPending/);
  });
});
