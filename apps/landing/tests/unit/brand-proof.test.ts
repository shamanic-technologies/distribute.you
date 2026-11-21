import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BRAND_PROOF_PRESS_LIMIT, BRAND_PROOF_TOKEN, BRAND_PROOF_WALL_LIMIT, brandProofHtml, type BrandProof } from "../../src/lib/brand-proof";

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
    const html = brandProofHtml(proof());
    expect(html.indexOf("Google")).toBeLessThan(html.indexOf("Bain"));
    expect(html).toContain('data-brand-proof="employers"');
    expect(html).toContain('href="https://techbullion.com/a"');
    expect(html).toContain("As featured in");
  });

  it("renders no section when nothing drawable is served", () => {
    expect(brandProofHtml(null)).toBe("");
    expect(brandProofHtml(proof({ employers: [], press: [] }))).toBe("");
    expect(brandProofHtml(proof({ employers: [company("X", { logoUrl: null })], press: [] }))).toBe("");
  });

  it("drops the wall heading when only press is served", () => {
    const html = brandProofHtml(proof({ employers: [] }));
    expect(html).not.toContain("<h2>");
    expect(html).toContain("As featured in");
  });

  it("escapes served strings and refuses non-http URLs", () => {
    const base = proof();
    const html = brandProofHtml(
      proof({
        employers: [...base.employers, company('<b>"Evil"</b>'), company("Js", { logoUrl: "javascript:alert(1)" })],
        press: [...base.press, { ...company("P"), article: { url: "javascript:alert(1)", title: null, publishedAt: null } }],
      }),
    );
    expect(html).not.toContain("<b>");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("&lt;b&gt;");
  });

  it("draws the top 24 employers and the top 3 outlets, whatever the score (owner 2026-11-21)", () => {
    const many = Array.from({ length: 30 }, (_, i) => company(`Co${i}`, { notorietyScore: 1 }));
    const outlets = Array.from({ length: 6 }, (_, i) => ({ ...company(`Out${i}`, { notorietyScore: 2 }), article: { url: `https://o${i}.com/a`, title: null, publishedAt: null } }));
    const html = brandProofHtml(proof({ employers: many, press: outlets }));
    expect((html.match(/<li>/g) ?? []).length).toBe(BRAND_PROOF_WALL_LIMIT + BRAND_PROOF_PRESS_LIMIT);
    expect(html).toContain("Co0");
    expect(html).not.toContain("Co24");
    expect(html).toContain("Out2");
    expect(html).not.toContain("Out3");
    expect(brandProofHtml(proof({ employers: [company("Solo", { notorietyScore: 3 })], press: [] }))).toContain("Solo");
  });

  it("the homepage carries the token once, between proof and quotes", () => {
    const home = readFileSync(join(__dirname, "../../public/landing/index-v2.html"), "utf8");
    expect(home.split(BRAND_PROOF_TOKEN).length).toBe(2);
    expect(home.indexOf('id="proof"')).toBeLessThan(home.indexOf(BRAND_PROOF_TOKEN));
    expect(home.indexOf(BRAND_PROOF_TOKEN)).toBeLessThan(home.indexOf('id="quotes"'));
  });

  it("static-html resolves the token through the gateway's public brand proof", () => {
    const src = readFileSync(join(__dirname, "../../src/lib/static-html.ts"), "utf8");
    expect(src).toContain("/v1/public/brand-proof?${query}");
    expect(src).toContain("domain=${encodeURIComponent(BRAND_PROOF_DOMAIN)}");
    expect(src).toContain("&minScore=0&minMonthlyTraffic=0&limit=${BRAND_PROOF_WALL_LIMIT}");
    expect(src).toContain("await withBrandProof(");
  });
});
