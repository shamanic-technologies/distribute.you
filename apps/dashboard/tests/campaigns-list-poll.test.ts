import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * All data-display pages must poll every 5s so stats update in real time,
 * but must NOT flash skeletons on each refetch.
 */

const PAGES_DIR = path.resolve(__dirname, "../src/app/(dashboard)");

// Pages that display live data and must poll
const DATA_PAGES = [
  "orgs/[orgId]/page.tsx",
  "orgs/[orgId]/api-keys/page.tsx",
  "orgs/[orgId]/brands/page.tsx",
  "orgs/[orgId]/brands/[brandId]/page.tsx",
  "orgs/[orgId]/brands/[brandId]/brand-info/page.tsx",
  "orgs/[orgId]/brands/[brandId]/campaigns/page.tsx",
  "orgs/[orgId]/brands/[brandId]/campaigns/new/page.tsx",
  "orgs/[orgId]/brands/[brandId]/workflows/page.tsx",
  "orgs/[orgId]/brands/[brandId]/features/[featureSlug]/page.tsx",
  "orgs/[orgId]/brands/[brandId]/features/[featureSlug]/workflows/page.tsx",
  "orgs/[orgId]/brands/[brandId]/features/[featureSlug]/campaigns/new/page.tsx",
  "features/[featureId]/page.tsx",
  "features/[featureId]/new/page.tsx",
  "features/[featureId]/workflows/page.tsx",
];

describe.each(DATA_PAGES)("Polling on %s", (relPath) => {
  const filePath = path.resolve(PAGES_DIR, relPath);
  const content = fs.readFileSync(filePath, "utf-8");

  it("should set refetchInterval on queries", () => {
    expect(content).toMatch(/refetchInterval/);
  });

  it("should disable polling when tab is in background", () => {
    expect(content).toMatch(/refetchIntervalInBackground:\s*false/);
  });

  it("should not use isPending for skeleton display", () => {
    expect(content).not.toMatch(/isPending/);
  });

  it("should not use isFetching for skeleton display", () => {
    expect(content).not.toMatch(/isFetching/);
  });
});
