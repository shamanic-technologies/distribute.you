import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BRAND_PROOF_ROW, BRAND_PROOF_TOKEN, BRAND_PROOF_WALL_LIMIT, PRESS_PROOF_TOKEN, brandProofHtml, pressProofHtml, type BrandProof } from "../../src/lib/brand-proof";

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
  employers: ["Google", "Bain", "EY", "Accor", "IBM", "Visa", "Uber", "Meta"].map((n) => company(n)),
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
      employers: [company('<b>"Evil"</b>'), company("Js", { logoUrl: "javascript:alert(1)" }), ...base.employers],
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
  });

  it("draws only FULL rows of 8, never a logo alone on the last line (owner 2026-11-25)", () => {
    expect(BRAND_PROOF_ROW).toBe(8);
    expect(BRAND_PROOF_WALL_LIMIT % BRAND_PROOF_ROW).toBe(0);
    const n = (count: number) => (brandProofHtml(proof({ employers: Array.from({ length: count }, (_, i) => company(`C${i}`)) })).match(/<li>/g) ?? []).length;
    expect(n(11)).toBe(8);
    expect(n(23)).toBe(16);
    expect(n(45)).toBe(24);
    expect(n(7)).toBe(0);
    const css = readFileSync(join(__dirname, "../../public/landing/v2/styles.css"), "utf8");
    expect(css).toContain("grid-template-columns: repeat(8, minmax(0, 1fr))");
    expect(css).toContain("grid-template-columns: repeat(4, minmax(0, 1fr))");
  });

  describe("wide wordmarks (owner 2026-11-25, BRANDMARK-WALL-1125)", () => {
    const WM = "https://assets.distribute.you/wordmarks/ibm.png";
    const lis = (html: string) => html.match(/<li>[\s\S]*?<\/li>/g) ?? [];

    it("a company with a wordmark shows it alone: its name in the alt, no name typed beside it", () => {
      const employers = proof().employers.map((c) => (c.name === "IBM" ? { ...c, wordmarkUrl: WM, wordmarkDarkUrl: null } : c));
      const ibm = lis(brandProofHtml(proof({ employers }))).find((li) => li.includes(WM))!;
      expect(ibm).toContain(`<img class="wordmark" src="${WM}" alt="IBM"`);
      expect(ibm).not.toContain("<span");
      expect(ibm).not.toContain("img.logo.dev");
      const press = proof().press.map((p) => (p.name === "Forbes" ? { ...p, wordmarkUrl: WM } : p));
      const forbes = lis(pressProofHtml(proof({ press }))).find((li) => li.includes(WM))!;
      expect(forbes).toContain('href="https://forbes.com/a"');
      expect(forbes).toContain('alt="Forbes"');
      expect(forbes).not.toContain("<span");
    });

    it("a company without one yet keeps its square mark and its name, in the same wall", () => {
      const employers = proof().employers.map((c, i) => ({ ...c, wordmarkUrl: i === 0 ? WM : null }));
      const wall = lis(brandProofHtml(proof({ employers })));
      expect(wall.length).toBe(8);
      expect(wall.filter((li) => li.includes('class="wordmark"')).length).toBe(1);
      expect(wall[1]).toContain('<img src="https://img.logo.dev/bain.com?token=pk_x" alt=""');
      expect(wall[1]).toContain('<span title="Bain">Bain</span>');
      // The fields absent altogether (a producer not deployed yet) reads the same as null.
      expect(brandProofHtml(proof())).not.toContain("wordmark");
    });

    it("a wordmark alone is enough to draw a company, an unsafe one is ignored", () => {
      const only = proof().employers.map((c) => ({ ...c, logoUrl: null, wordmarkUrl: WM }));
      expect(lis(brandProofHtml(proof({ employers: only }))).length).toBe(8);
      const unsafe = proof().employers.map((c) => ({ ...c, wordmarkUrl: "javascript:alert(1)" }));
      const wall = brandProofHtml(proof({ employers: unsafe }));
      expect(wall).not.toContain("javascript:");
      expect(wall).not.toContain('class="wordmark"');
      expect(wall).toContain('<span title="Google">Google</span>');
      const neither = proof().employers.map((c) => ({ ...c, logoUrl: null, wordmarkUrl: "data:image/png;base64,AAAA" }));
      expect(brandProofHtml(proof({ employers: neither }))).toBe("");
      const quoted = proof().employers.map((c, i) => (i === 0 ? { ...c, name: 'A "B" <c>', wordmarkUrl: WM } : c));
      expect(brandProofHtml(proof({ employers: quoted }))).toContain('alt="A &quot;B&quot; &lt;c&gt;"');
    });

    it("both stylesheets size the wordmark by height, grey until hovered", () => {
      for (const file of ["v2/styles.css", "distry/home.css"]) {
        const css = readFileSync(join(__dirname, "../../public/landing", file), "utf8");
        const rule = (selector: string) => css.slice(css.indexOf(`${selector} {`), css.indexOf("}", css.indexOf(`${selector} {`)));
        expect(css, file).toContain(".logo-wall img.wordmark {");
        expect(rule(".logo-wall img.wordmark"), file).toContain("height: 40px");
        expect(rule(".logo-wall img.wordmark"), file).toContain("width: auto");
        expect(rule(".logo-wall img.wordmark"), file).toContain("max-width: 100%");
        expect(rule(".press-track img.wordmark"), file).toContain("height: 30px");
        expect(rule(".logo-wall img"), file).toContain("filter: grayscale(1)");
        expect(css, file).toContain(".logo-wall li:hover img, .press-track a:hover img { filter: none; opacity: 1; }");
      }
    });
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
