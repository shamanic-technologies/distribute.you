import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BRAND_PROOF_TOKEN, BRAND_PROOF_WALL_LIMIT, PRESS_PROOF_TOKEN, brandProofHtml, pressProofHtml, type BrandProof } from "../../src/lib/brand-proof";

const company = (name: string, extra: Partial<BrandProof["employers"][number]> = {}) => ({
  companyId: "00000000-0000-4000-8000-000000000001",
  name,
  domain: `${name.toLowerCase()}.com`,
  logoUrl: `https://img.logo.dev/${name.toLowerCase()}.com?token=pk_x`,
  notorietyScore: 95,
  monthlyTraffic: 1_000_000,
  ...extra,
});

const proof = (over: Partial<BrandProof> = {}): BrandProof => ({
  brandId: "00000000-0000-4000-8000-0000000000aa",
  domain: "distribute.you",
  employers: ["Google", "Bain", "EY", "Accor", "IBM", "Visa"].map((n) => company(n)),
  press: ["TechBullion", "Forbes", "Wired"].map((n) => ({ ...company(n), article: { url: `https://${n.toLowerCase()}.com/a`, title: "A", publishedAt: null } })),
  ...over,
});

describe("brand proof logos (BRAND-PROOF-LOGOS-1121)", () => {
  it("draws the producer's order, nothing re-ranked", () => {
    const wall = brandProofHtml(proof());
    expect(wall.indexOf("Google")).toBeLessThan(wall.indexOf("Bain"));
    expect(wall).toContain('data-brand-proof="employers"');
    expect(wall).toContain("Our team and clients have worked at great companies");
    expect(wall).not.toContain("As featured in");
    const band = pressProofHtml(proof());
    expect(band).toContain('href="https://techbullion.com/a"');
    expect(band).toContain("As featured in");
    expect(band).not.toContain('data-brand-proof="employers"');
  });

  it("renders nothing when nothing drawable is served", () => {
    expect(brandProofHtml(null)).toBe("");
    expect(pressProofHtml(null)).toBe("");
    expect(brandProofHtml(proof({ employers: [company("X", { logoUrl: null })] }))).toBe("");
    expect(pressProofHtml(proof({ press: [] }))).toBe("");
  });

  it("escapes served strings and refuses non-http URLs", () => {
    const base = proof();
    const evil = proof({
      employers: [...base.employers, company('<b>"Evil"</b>'), company("Js", { logoUrl: "javascript:alert(1)" })],
      press: [...base.press, { ...company("P"), article: { url: "javascript:alert(1)", title: null, publishedAt: null } }],
    });
    for (const html of [brandProofHtml(evil), pressProofHtml(evil)]) {
      expect(html).not.toContain("<b>");
      expect(html).not.toContain("javascript:");
    }
    expect(brandProofHtml(evil)).toContain("&lt;b&gt;");
  });

  it("draws the top 24 employers and EVERY outlet, twice for a seamless loop (owner 2026-11-21, 2026-11-25)", () => {
    const many = Array.from({ length: 30 }, (_, i) => company(`Co${i}`, { notorietyScore: 1 }));
    const outlets = Array.from({ length: 51 }, (_, i) => ({ ...company(`Out${i}`, { notorietyScore: 2 }), article: { url: `https://o${i}.com/a`, title: null, publishedAt: null } }));
    const wall = brandProofHtml(proof({ employers: many }));
    expect((wall.match(/<li>/g) ?? []).length).toBe(BRAND_PROOF_WALL_LIMIT);
    expect(wall).toContain("Co0");
    expect(wall).not.toContain("Co24");
    const band = pressProofHtml(proof({ press: outlets }));
    expect((band.match(/<li>/g) ?? []).length).toBe(51);
    expect((band.match(/<li aria-hidden="true">/g) ?? []).length).toBe(51);
    expect((band.match(/tabindex="-1"/g) ?? []).length).toBe(51);
    expect(band).toContain("Out50");
    expect(brandProofHtml(proof({ employers: [company("Solo", { notorietyScore: 3 })] }))).toContain("Solo");
  });

  it("the homepage carries the wall between proof and quotes, and the press band apart, before pricing", () => {
    const home = readFileSync(join(__dirname, "../../public/landing/index-v2.html"), "utf8");
    expect(home.split(BRAND_PROOF_TOKEN).length).toBe(2);
    expect(home.split(PRESS_PROOF_TOKEN).length).toBe(2);
    expect(home.indexOf('id="proof"')).toBeLessThan(home.indexOf(BRAND_PROOF_TOKEN));
    expect(home.indexOf(BRAND_PROOF_TOKEN)).toBeLessThan(home.indexOf('id="quotes"'));
    expect(home.indexOf('id="quotes"')).toBeLessThan(home.indexOf(PRESS_PROOF_TOKEN));
    expect(home.indexOf(PRESS_PROOF_TOKEN)).toBeLessThan(home.indexOf('id="pricing"'));
  });

  it("static-html resolves the token through the gateway's public brand proof", () => {
    const src = readFileSync(join(__dirname, "../../src/lib/static-html.ts"), "utf8");
    expect(src).toContain("/v1/public/brand-proof?${query}");
    expect(src).toContain("domain=${encodeURIComponent(BRAND_PROOF_DOMAIN)}");
    expect(src).toContain("&minScore=0&minMonthlyTraffic=0&limit=${BRAND_PROOF_FETCH_LIMIT}");
    expect(src).toContain("await withBrandProof(");
  });
});
