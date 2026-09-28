import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");
const PAGE = read("src/components/v2/brand-settings-page.tsx");

describe("v2 Brand settings reads as a v2 settings page", () => {
  it("the route renders the v2-native page", () => {
    expect(read("src/app/(authed)/v2/orgs/[orgId]/brands/[brandId]/settings/page.tsx")).toContain(
      "@/components/v2/brand-settings-page",
    );
  });

  it("a section rail beside one row per section: title and purpose on the left, the form in a k-card", () => {
    expect(PAGE).toContain('aria-label="Settings sections"');
    expect(PAGE).toContain("md:grid-cols-[220px_minmax(0,1fr)]");
    expect(PAGE).toContain('<div className="k-card overflow-hidden">{s.body}</div>');
  });

  it("the v1 cards that carried their own heading render bare, so nothing is stated twice", () => {
    for (const card of ["BrandDomainCard", "BrandSalesRepCard", "BrandIntegrationsCard", "BrandConversionTrackingCard"]) {
      expect(PAGE).toContain(`<${card} brandId={brandId} bare />`);
    }
  });

  it("the page itself uses Keel tokens, never v1 greys or v1 card frames", () => {
    expect(PAGE).not.toMatch(/text-gray-|bg-brand-50|rounded-lg border|rounded-xl border/);
    expect(PAGE).not.toContain("—");
  });

  it("the rail follows the shell's scrolling <main>, not the window", () => {
    expect(PAGE).toContain('document.addEventListener("scroll", onScroll, { capture: true, passive: true })');
  });
});
