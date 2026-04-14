import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

describe("Brands page auto-creates brand from onboarding", () => {
  const pagePath = path.join(
    __dirname,
    "../src/app/(dashboard)/orgs/[orgId]/brands/page.tsx"
  );
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should read autoCreate query param from searchParams", () => {
    expect(content).toContain("useSearchParams");
    expect(content).toContain('searchParams.get("autoCreate")');
  });

  it("should call upsertBrand when autoCreate param is present", () => {
    expect(content).toContain("autoCreateUrl");
    expect(content).toContain("createBrandAndRedirect");
    expect(content).toContain("upsertBrand");
  });

  it("should redirect to brand page after auto-creation", () => {
    expect(content).toContain("router.replace");
    expect(content).toContain(`/orgs/\${orgId}/brands/\${newBrandId}`);
  });

  it("should only trigger auto-create once (useRef guard)", () => {
    expect(content).toContain("autoCreateTriggered");
    expect(content).toContain("useRef(false)");
  });
});

describe("Onboarding page asks for URL and creates brand", () => {
  const pagePath = path.join(__dirname, "../src/app/onboarding/page.tsx");
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should ask for website URL, not a name", () => {
    expect(content).toContain("website");
    expect(content).not.toContain("What's your agency name?");
    expect(content).not.toContain("What's your company name?");
  });

  it("should validate URL has a valid domain", () => {
    expect(content).toContain("extractDomain");
    expect(content).toContain("Please enter a valid URL");
  });

  it("should redirect to brands page with autoCreate after org creation", () => {
    expect(content).toContain("/brands?autoCreate=");
    expect(content).toContain("encodeURIComponent");
  });
});
