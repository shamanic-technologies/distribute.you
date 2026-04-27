import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const brandOutletPagePath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/outlets/page.tsx",
);
const featureOutletPagePath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/orgs/[orgId]/brands/[brandId]/features/[featureSlug]/outlets/page.tsx",
);
const apiPath = path.resolve(__dirname, "../src/lib/api.ts");

describe("outlet pages use backend byOutreachStatus for tab counts", () => {
  for (const [label, pagePath] of [
    ["brand-level", brandOutletPagePath],
    ["feature-level", featureOutletPagePath],
  ] as const) {
    describe(label, () => {
      const content = fs.readFileSync(pagePath, "utf-8");

      it("should reference byOutreachStatus from backend data", () => {
        expect(content).toContain("byOutreachStatus");
      });

      it("should use data?.total for the All tab count instead of outlets.length", () => {
        expect(content).toMatch(/data\?\.total/);
      });

      it("should use data?.total for header outlet count", () => {
        // Header line should use total, not outlets.length
        expect(content).toMatch(/data\?\.total.*outlet/);
      });

      it("should fall back to client-side for replied-* statuses (classification split)", () => {
        expect(content).toContain('status.startsWith("replied-")');
      });
    });
  }
});

describe("listBrandOutlets return type includes byOutreachStatus", () => {
  const apiContent = fs.readFileSync(apiPath, "utf-8");

  it("should include byOutreachStatus in the return type", () => {
    expect(apiContent).toContain("byOutreachStatus");
  });
});
