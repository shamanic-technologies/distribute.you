import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const apiPath = path.resolve(__dirname, "../src/lib/api.ts");
const apiContent = fs.readFileSync(apiPath, "utf-8");

const brandInfoPath = path.resolve(
  __dirname,
  "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/brand-info/page.tsx"
);
const brandInfoContent = fs.readFileSync(brandInfoPath, "utf-8");

const brandOverviewPath = path.resolve(
  __dirname,
  "../src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx"
);
const brandOverviewContent = fs.readFileSync(brandOverviewPath, "utf-8");

describe("getBrand handles 404/500 gracefully", () => {
  it("should catch ApiError and return null on 404 or 500", () => {
    expect(apiContent).toMatch(/getBrand.*Promise<.*\| null>/);
    expect(apiContent).toContain("err.status === 404 || err.status === 500");
  });

  it("should return null instead of throwing", () => {
    // The function must have a try/catch that returns null
    const fnMatch = apiContent.match(
      /export async function getBrand\(brandId[\s\S]*?^}/m
    );
    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch![0];
    expect(fnBody).toContain("return null");
  });
});

describe("listBrandRuns handles 404/500 gracefully", () => {
  it("should catch ApiError and return empty runs on 404 or 500", () => {
    const fnMatch = apiContent.match(
      /export async function listBrandRuns[\s\S]*?^}/m
    );
    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch![0];
    expect(fnBody).toContain("err.status === 404 || err.status === 500");
    expect(fnBody).toContain("{ runs: [] }");
  });
});

describe("Brand overview page handles missing brand", () => {
  it("should track loading state from the brand query", () => {
    // The page reads the React Query loading flag (brandLoading) and uses it
    // alongside `brand` to drive both the inline header skeleton and the
    // not-found empty state. The exact gate shape changed when the full-page
    // skeleton block was inlined; verify the underlying state is still wired.
    expect(brandOverviewContent).toMatch(/isLoading:\s*brandLoading/);
    expect(brandOverviewContent).toMatch(/!brandLoading\s*&&\s*!brand/);
    expect(brandOverviewContent).not.toMatch(/if\s*\(\s*!brandData\s*\)/);
  });

  it("should show 'Brand not found' when brand resolved to null", () => {
    // Guard must distinguish loading from genuinely-missing brand to avoid
    // flashing the empty state during the initial fetch.
    expect(brandOverviewContent).toContain("Brand not found");
    expect(brandOverviewContent).toMatch(/!brandLoading\s*&&\s*!brand/);
  });
});

describe("Brand info page handles missing brand", () => {
  it("should use brandLoading in skeleton guard", () => {
    expect(brandInfoContent).toMatch(/isLoading:\s*brandLoading/);
    expect(brandInfoContent).toContain("brandLoading || fieldsLoading");
  });

  it("should show 'Brand not found' when brand is null", () => {
    expect(brandInfoContent).toContain("Brand not found");
    expect(brandInfoContent).toMatch(/if\s*\(\s*!brand\s*\)/);
  });

  it("should use brand (not brandUrl) for Generate button guard", () => {
    // Generate button and handler should depend on brand existing, not brandUrl
    expect(brandInfoContent).not.toMatch(/brandUrl\s*&&\s*\(/);
    expect(brandInfoContent).toContain("brand && (");
  });
});
