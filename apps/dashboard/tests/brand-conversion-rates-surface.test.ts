import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => fs.readFileSync(path.join(__dirname, "../src", rel), "utf-8");

const settingsPage = read("app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/settings/page.tsx");
const card = read("components/settings/brand-conversion-rates-card.tsx");
const editor = read("components/settings/leg-rates-editor.tsx");
const persist = read("lib/persist-cache.ts");

describe("brand conversion rates", () => {
  it("renders a Conversion rates section on Brand Settings", () => {
    expect(settingsPage).toContain('id="conversion-rates"');
    expect(settingsPage).toContain("<BrandConversionRatesCard brandId={brandId} />");
  });

  it("reads the EFFECTIVE rate from features-service and renders one editor over the legs", () => {
    expect(card).toContain('useAuthQuery(["brandConversionRates", brandId]');
    expect(card).toContain("getBrandConversionRates(brandId)");
    expect(card).toContain("<LegRatesEditor");
  });

  it("writes the brand's own value through brand-service and re-reads every money grain", () => {
    expect(editor).toContain("stateBrandLegRates(brandId, patch)");
    expect(editor).toContain("invalidateConversionRates(queryClient)");
    // Only touched legs are sent, so a median prefill is never stored as a statement.
    expect(editor).toContain("legRatePatch(stated, drafts)");
    expect(editor).toContain("rateSourceLabel(leg)");
  });

  it("the rates read paints from disk", () => {
    expect(persist).toContain('"brandConversionRates"');
  });
});
