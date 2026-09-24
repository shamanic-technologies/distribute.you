import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  BEST_FOR_PAGES,
  BEST_UPDATED_ON,
  bestForLinkLabel,
  bestForPaths,
} from "../../src/lib/best-for";
import { bestForHeading, renderBestForHub, renderBestForPage } from "../../src/lib/best-for-page";
import { COMPETITORS, competitorBySlug } from "../../src/lib/competitors";
import { renderComparePage } from "../../src/lib/compare-page";
import { V2_STYLES_VERSION } from "../../src/lib/v2-shell";

/**
 * The "best X for Y" cluster: `/best/<slug>` and `/best`.
 *
 * Built for answer engines, which keep the H1 and the first paragraph and run no
 * JavaScript. These guards pin that the answer, the date and the ranking are in the raw
 * HTML, that no figure about a competitor is written anywhere but `competitors.ts`, and
 * that every list naming the cluster (sitemap, llms.txt, both footers) equals the catalogue.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

const prose = (html: string) =>
  html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
const text = (html: string) => prose(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("the best-for catalogue", () => {
  it("carries 5 to 8 pages with distinct slugs and distinct audiences", () => {
    expect(BEST_FOR_PAGES.length).toBeGreaterThanOrEqual(5);
    expect(BEST_FOR_PAGES.length).toBeLessThanOrEqual(8);
    expect(new Set(BEST_FOR_PAGES.map((p) => p.slug)).size).toBe(BEST_FOR_PAGES.length);
    expect(new Set(BEST_FOR_PAGES.map((p) => p.audience)).size).toBe(BEST_FOR_PAGES.length);
  });

  it("is no doorway: each page's argument is its own", () => {
    const seen = new Set<string>();
    for (const p of BEST_FOR_PAGES) {
      for (const line of [p.answer, ...p.whyUs, ...p.howToChoose, ...p.faq.map((f) => f.a)]) {
        expect(seen.has(line), `${p.slug}: ${line}`).toBe(false);
        seen.add(line);
      }
      expect(p.whyUs.length, p.slug).toBeGreaterThanOrEqual(3);
      expect(p.ranked.length, p.slug).toBeGreaterThanOrEqual(3);
      expect(p.faq.length, p.slug).toBe(3);
      expect(p.answer.toLowerCase(), p.slug).toContain(p.audience.toLowerCase().slice(0, 5));
    }
  });

  it("ranks only competitors the compare catalogue carries, each once", () => {
    for (const p of BEST_FOR_PAGES) {
      const slugs = p.ranked.map((r) => r.slug);
      expect(new Set(slugs).size, p.slug).toBe(slugs.length);
      for (const s of slugs) expect(competitorBySlug(s), `${p.slug} ${s}`).toBeDefined();
    }
  });

  it("states no figure about a competitor: those live only in competitors.ts", () => {
    const src = read("src/lib/best-for.ts") + read("src/lib/best-for-page.ts");
    for (const c of COMPETITORS) {
      for (const pr of c.prices) {
        if (/\d/.test(pr.price)) expect(src, `${c.slug} ${pr.price}`).not.toContain(pr.price);
      }
      expect(src, c.slug).not.toContain(c.sourceUrl);
    }
    // The only dollar figures in the judgement are the homepage's own offer.
    const dollars = [...read("src/lib/best-for.ts").matchAll(/\$\d+(?:,\d{3})*/g)].map((m) => m[0]);
    for (const d of dollars) expect(["$1", "$30"], d).toContain(d);
  });
});

describe("every page", () => {
  for (const p of BEST_FOR_PAGES) {
    const html = renderBestForPage(p);
    const visible = text(html);

    it(`${p.slug}: the H1 states the answer and the first paragraph answers directly`, () => {
      const h1 = html.match(/<h1>([\s\S]*?)<\/h1>/)![1];
      expect(h1).toContain(`best ${p.category} for ${p.audience}`);
      expect(h1).toContain("distribute.you");
      const sub = html.indexOf('<p class="hero-sub">');
      expect(sub).toBeGreaterThan(html.indexOf("<h1>"));
      expect(html.slice(sub, sub + 400)).toContain("the best");
      expect(bestForHeading(p)).toMatch(/: distribute\.you$/);
    });

    it(`${p.slug}: carries a visible date and author near the top`, () => {
      const meta = html.indexOf('class="best-meta"');
      expect(meta).toBeGreaterThan(0);
      expect(meta).toBeLessThan(html.indexOf('id="ranking"'));
      expect(html).toContain(`<time datetime="${BEST_UPDATED_ON}">`);
      expect(visible).toMatch(/Updated \w+ \d+, \d{4}/);
      expect(visible).toContain("By the distribute.you team");
    });

    it(`${p.slug}: the whole ranking is in the raw HTML, us first, figures from the catalogue`, () => {
      const list = html.slice(html.indexOf('<ol class="best-list">'), html.indexOf("</ol>"));
      expect(list.indexOf("<b>distribute.you</b>")).toBeGreaterThan(0);
      let at = list.indexOf("<b>distribute.you</b>");
      p.ranked.forEach((r, i) => {
        const c = competitorBySlug(r.slug)!;
        const idx = list.indexOf(`<b>${c.name.replaceAll("&", "&amp;")}</b>`);
        expect(idx, `${p.slug} ${c.slug}`).toBeGreaterThan(at);
        at = idx;
        expect(list).toContain(`<span class="best-rank">${i + 2}</span>`);
        expect(list).toContain(c.entryPrice);
        expect(list).toContain(`href="${c.sourceUrl}"`);
        expect(list).toContain(`href="/compare/${c.slug}"`);
      });
    });

    it(`${p.slug}: FAQPage, ItemList and Article JSON-LD`, () => {
      expect(html).toContain('"@type":"FAQPage"');
      expect(html).toContain('"@type":"ItemList"');
      expect(html).toContain(`"dateModified":"${BEST_UPDATED_ON}"`);
    });

    it(`${p.slug}: obeys the homepage copy rules`, () => {
      expect(prose(html)).not.toContain("—");
      expect(visible).not.toMatch(/\bat cost\b|pass-through|no markup|guaranteed? meetings|costs? us\b|our cost per/i);
      expect(visible).not.toMatch(/cold email (tool|software|platform) (is|called) distribute/i);
      expect(html).toContain("__HOT_LEAD_BAND__");
      expect(html.replace("__HOT_LEAD_BAND__", "")).not.toMatch(/__[A-Z_]+__/);
      expect(html).toContain(`<link rel="canonical" href="https://distribute.you/best/${p.slug}">`);
    });
  }

  it("the hub links every page in raw HTML", () => {
    const hub = renderBestForHub();
    expect(prose(hub)).not.toContain("—");
    for (const p of BEST_FOR_PAGES) expect(hub).toContain(`href="/best/${p.slug}"`);
  });
});

describe("the lists that name the cluster equal the catalogue", () => {
  it("the sitemap carries every path", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((e) => e.url);
    for (const p of bestForPaths()) expect(urls).toContain(`https://distribute.you${p}`);
  });

  it("llms.txt lists every page with its label", () => {
    const llms = read("public/llms.txt");
    expect(llms).toContain("(https://distribute.you/best)");
    for (const p of BEST_FOR_PAGES) {
      expect(llms).toContain(`[${bestForLinkLabel(p)}](https://distribute.you/best/${p.slug})`);
    }
  });

  it("the homepage footer and the rendered footer carry a Best for column in raw HTML", () => {
    const home = read("public/landing/index-v2.html");
    const rendered = renderComparePage(COMPETITORS[0]);
    for (const html of [home, rendered]) {
      const footer = html.slice(html.indexOf("<footer>"));
      expect(footer).toContain("<h4>Best for</h4>");
      expect(footer).toContain('href="/best">All rankings</a>');
      for (const p of BEST_FOR_PAGES) {
        expect(footer).toContain(`href="/best/${p.slug}">${bestForLinkLabel(p)}</a>`);
      }
    }
    expect(home).toContain(`href="/landing/v2/styles.css?v=${V2_STYLES_VERSION}"`);
  });

  it("the React footer reads the catalogue", () => {
    const f = read("src/components/footer.tsx");
    expect(f).toContain("BEST_FOR_PAGES.map(");
    expect(f).toContain('title="Best for"');
  });

  it("the routes exist", () => {
    expect(read("src/app/best/route.ts")).toContain("renderBestForHub");
    const slug = read("src/app/best/[slug]/route.ts");
    expect(slug).toContain("bestForBySlug");
    expect(slug).toContain('staticResponse("404.html", request, { status: 404');
  });
});

describe("served through the pipeline", () => {
  it("resolves every token and answers markdown", async () => {
    const { renderedResponse } = await import("@/lib/static-html");
    const p = BEST_FOR_PAGES[0];
    const res = await renderedResponse(renderBestForPage(p), new Request("https://distribute.you/best/x"), {
      canonicalPath: `/best/${p.slug}`,
    });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).not.toMatch(/__[A-Z_]+__/);
    expect((body.match(/"@type":"Organization"/g) ?? []).length).toBeGreaterThanOrEqual(1);
    const md = await renderedResponse(
      renderBestForPage(p),
      new Request("https://distribute.you/best/x", { headers: { accept: "text/markdown" } }),
      { canonicalPath: `/best/${p.slug}` },
    );
    expect(md.headers.get("content-type")).toContain("text/markdown");
    expect(await md.text()).toContain(bestForHeading(p));
  });
});
