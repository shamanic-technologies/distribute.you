import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => fs.readFileSync(path.join(__dirname, "../src", rel), "utf-8");

const settingsPage = read("app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/settings/page.tsx");
const card = read("components/settings/brand-conversion-rates-card.tsx");
const editor = read("components/settings/funnel-rates-editor.tsx");
const modal = read("components/settings/funnel-activation-modal.tsx");
const funnelsCard = read("components/settings/brand-sales-funnels-card.tsx");
const persist = read("lib/persist-cache.ts");

describe("brand conversion rates", () => {
  it("renders a Conversion rates section on Brand Settings", () => {
    expect(settingsPage).toContain('id="conversion-rates"');
    expect(settingsPage).toContain("<BrandConversionRatesCard brandId={brandId} />");
  });

  it("reads the EFFECTIVE rate from features-service and renders one editor per funnel", () => {
    expect(card).toContain('useAuthQuery(["brandConversionRates", brandId]');
    expect(card).toContain("getBrandConversionRates(brandId)");
    expect(card).toContain("<FunnelRatesEditor");
  });

  it("writes the brand's own value through brand-service and re-reads every money grain", () => {
    expect(editor).toContain("stateBrandFunnelRates(brandId, funnel.funnelKey, patch)");
    expect(editor).toContain("invalidateConversionRates(queryClient)");
    // Only touched arrows are sent, so a median prefill is never stored as a statement.
    expect(editor).toContain("arrowRatePatch(stated, drafts)");
    expect(editor).toContain("rateSourceLabel(arrow)");
  });

  it("the activation modal reuses the one editor and closes itself when nothing is unmeasured", () => {
    expect(modal).toContain("<FunnelRatesEditor");
    expect(modal).toContain("unmeasuredArrows(funnel.arrows).length === 0");
  });

  it("the offer funnel card opens the modal on a FIRST declaration only", () => {
    expect(funnelsCard).toContain("const firstDeclaration = !states[vars.def.key].declared;");
    expect(funnelsCard).toContain("<FunnelActivationModal");
  });

  it("the rates read paints from disk", () => {
    expect(persist).toContain('"brandConversionRates"');
  });
});
