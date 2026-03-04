import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

function findPages(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findPages(full));
    else if (entry.name === "page.tsx") results.push(full);
  }
  return results;
}

/**
 * Regression: skeleton loaders must only show on the very first load.
 * Background refetches (window focus, stale data) must NOT trigger skeletons.
 *
 * Rules enforced:
 * 1. Pages must use `isLoading` (= isPending && isFetching, first load only)
 *    — never `isPending` alone or `isFetching` for skeleton guards.
 * 2. Skeleton guards must never check `!data` directly (data can be undefined
 *    during re-mount before cache is read synchronously).
 * 3. staleTime must be >= 60s to avoid overly aggressive refetches.
 */
describe("Skeleton loaders only appear on first load", () => {
  const pagesDir = path.resolve(__dirname, "../src/app/(dashboard)");
  const pageFiles = findPages(pagesDir);

  describe("No page should use isPending for skeleton display", () => {
    for (const file of pageFiles) {
      const rel = path.relative(pagesDir, file);
      it(`${rel} should not destructure isPending from useAuthQuery`, () => {
        const content = fs.readFileSync(file, "utf-8");
        // isPending should not be extracted from useAuthQuery calls
        expect(content).not.toMatch(/useAuthQuery\([^)]*\)[\s\S]*?isPending/);
      });
    }
  });

  describe("Brand info page uses isLoading for skeleton guards", () => {
    const brandInfoPath = path.resolve(
      pagesDir,
      "orgs/[orgId]/brands/[brandId]/brand-info/page.tsx"
    );
    const content = fs.readFileSync(brandInfoPath, "utf-8");

    it("should use isLoading (not isPending) for profile loading state", () => {
      expect(content).toMatch(/isLoading:\s*profileLoading/);
      expect(content).not.toMatch(/isPending/);
    });

    it("should use isLoading for runs skeleton, not !runsData", () => {
      // The history tab skeleton must use a loading flag, not !data
      expect(content).not.toMatch(/\{\s*!runsData\s/);
      expect(content).toMatch(/runsLoading/);
    });
  });

  describe("QueryProvider staleTime is not too aggressive", () => {
    const queryProviderPath = path.resolve(
      __dirname,
      "../src/lib/query-provider.tsx"
    );
    const content = fs.readFileSync(queryProviderPath, "utf-8");

    it("staleTime should be at least 60 seconds", () => {
      const match = content.match(/staleTime:\s*(\d[\d_]*)/);
      expect(match).toBeTruthy();
      const value = parseInt(match![1].replace(/_/g, ""), 10);
      expect(value).toBeGreaterThanOrEqual(60_000);
    });
  });
});
