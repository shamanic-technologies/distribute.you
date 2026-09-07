import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  comparePageDescription,
  renderAlternativesPage,
  renderCompareHub,
  renderComparePage,
  V2_STYLES_VERSION,
} from "../../src/lib/compare-page";
import { COMPETITORS, comparePaths, competitorBySlug } from "../../src/lib/competitors";

/**
 * The comparison cluster: `/compare/<slug>`, `/compare`, `/alternatives`.
 *
 * Every page is rendered from ONE catalogue, so these guards pin the catalogue's
 * discipline (a source URL and a date on every competitor figure) and the copy rules the
 * homepage already lives by, then check that every list in the repo that names the
 * cluster (sitemap, llms.txt, the homepage footer) is read from or equal to that catalogue.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

const prose = (html: string) =>
  html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");

describe("the competitor catalogue", () => {
  it("names the eleven competitors the owner picked, and not Amplemarket", () => {
    expect(COMPETITORS.map((c) => c.slug).sort()).toEqual(
      ["11x", "aisdr", "apollo", "artisan", "clay", "explee", "gojiberry", "instantly", "lemlist", "salesforge", "smartlead"],
    );
    expect(COMPETITORS.some((c) => /amplemarket/i.test(c.name))).toBe(false);
  });

  it("sources every figure from the competitor's own site, with a date this month", () => {
    for (const c of COMPETITORS) {
      expect(c.sourceUrl, c.slug).toMatch(/^https:\/\//);
      expect(new URL(c.sourceUrl).hostname.replace(/^www\./, ""), c.slug).toBe(c.domain);
      expect(c.verifiedOn, c.slug).toMatch(/^2026-09-\d\d$/);
      expect(c.prices.length, c.slug).toBeGreaterThan(0);
      for (const p of c.prices) expect(p.price, `${c.slug} ${p.plan}`).toMatch(/\$|On request/);
    }
  });

  it("gives every competitor the same shape of argument", () => {
    for (const c of COMPETITORS) {
      expect(c.whereTheyWin.length, c.slug).toBeGreaterThanOrEqual(2);
      expect(c.whereWeWin.length, c.slug).toBeGreaterThanOrEqual(2);
      expect(c.chooseThemIf.length, c.slug).toBeGreaterThanOrEqual(1);
      expect(c.chooseUsIf.length, c.slug).toBeGreaterThanOrEqual(1);
      expect(c.faq.length, c.slug).toBe(3);
    }
  });

  it("never claims a competitor publishes a cost per meeting, which none does", () => {
    for (const c of COMPETITORS) expect(c.costPerMeetingPublished, c.slug).toBe(false);
  });

  it("resolves a slug and refuses an unknown one", () => {
    expect(competitorBySlug("instantly")?.name).toBe("Instantly");
    expect(competitorBySlug("amplemarket")).toBeUndefined();
  });
});

describe("a comparison page", () => {
  for (const c of COMPETITORS) {
    describe(c.slug, () => {
      const html = renderComparePage(c);
      const copy = prose(html);

      it("states who it compares, canonically, with the verification date", () => {
        expect(html).toContain(`<h1>distribute.you <span class="accent">vs</span> ${c.name}</h1>`);
        expect(html).toContain(`<link rel="canonical" href="https://distribute.you/compare/${c.slug}">`);
        expect(html).toContain("Verified September 2026");
        expect(html).toContain(`href="${c.sourceUrl}" rel="nofollow noopener"`);
        expect(html).not.toContain("noindex");
      });

      it("carries the live figures as tokens the pipeline resolves", () => {
        for (const token of ["__BEST_POSITIVE_REPLY_COST__", "__POSITIVE_REPLY_RATE__", "__EMAILS_SENT__"]) {
          expect(html).toContain(token);
        }
        // And no token the pipeline does not know.
        const known = new Set(["__BEST_POSITIVE_REPLY_COST__", "__POSITIVE_REPLY_RATE__", "__EMAILS_SENT__"]);
        for (const [tok] of html.matchAll(/__[A-Z_]+__/g)) expect(known.has(tok), tok).toBe(true);
      });

      it("prints every plan and price from the catalogue", () => {
        for (const p of c.prices) {
          expect(html).toContain(p.plan.replaceAll("&", "&amp;"));
          expect(html).toContain(p.price.replaceAll("&", "&amp;"));
        }
      });

      it("obeys the copy rules the homepage lives by", () => {
        expect(copy).not.toContain("—");
        expect(copy).not.toMatch(/costs? us\b/i);
        expect(copy).not.toMatch(/\bour (?:live )?cost per\b/i);
        expect(copy).not.toMatch(/\bat cost\b/i);
        expect(copy).not.toMatch(/\bpass-?through\b/i);
        expect(copy).not.toMatch(/\bno mark-?up\b/i);
        expect(copy).not.toMatch(/\bguaranteed? (?:sales )?meetings\b/i);
        expect(copy).not.toMatch(/\bwe guarantee results\b/i);
        // Opens are a dead metric.
        expect(copy).not.toMatch(/\bopen rate/i);
      });

      it("ships FAQPage and BreadcrumbList JSON-LD that parse", () => {
        const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) =>
          JSON.parse(m[1]),
        );
        const types = blocks.map((b) => b["@type"]);
        expect(types).toContain("FAQPage");
        expect(types).toContain("BreadcrumbList");
        const faq = blocks.find((b) => b["@type"] === "FAQPage");
        expect(faq.mainEntity).toHaveLength(3);
      });

      it("links the whole cluster in raw HTML, so a crawler sees the graph", () => {
        for (const other of COMPETITORS) {
          if (other.slug === c.slug) continue;
          expect(html).toContain(`href="/compare/${other.slug}"`);
        }
        expect(html).toContain('href="/compare"');
        expect(html).toContain('href="/alternatives"');
      });

      it("uses the homepage stylesheet at the current version", () => {
        expect(html).toContain(`href="/landing/v2/styles.css?v=${V2_STYLES_VERSION}"`);
      });

      it("lets an existing customer log in", () => {
        expect(html).toContain('href="https://dashboard.distribute.you/sign-in">Log in');
      });

      it("keeps the meta description under a search snippet's length", () => {
        expect(comparePageDescription(c).length).toBeLessThan(230);
      });
    });
  }
});

describe("the hub and the alternatives page", () => {
  const hub = renderCompareHub();
  const alt = renderAlternativesPage();

  it("list every competitor", () => {
    for (const c of COMPETITORS) {
      expect(hub).toContain(`href="/compare/${c.slug}"`);
      expect(alt).toContain(`href="/compare/${c.slug}"`);
    }
  });

  it("are canonical and indexable", () => {
    expect(hub).toContain('<link rel="canonical" href="https://distribute.you/compare">');
    expect(alt).toContain('<link rel="canonical" href="https://distribute.you/alternatives">');
    expect(hub).not.toContain("noindex");
    expect(alt).not.toContain("noindex");
  });

  it("ship no em-dash", () => {
    expect(prose(hub)).not.toContain("—");
    expect(prose(alt)).not.toContain("—");
  });
});

describe("every list that names the cluster reads the catalogue", () => {
  it("the sitemap carries every path", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((e) => e.url);
    for (const p of comparePaths()) expect(urls).toContain(`https://distribute.you${p}`);
  });

  it("llms.txt lists every page", () => {
    const llms = read("public/llms.txt");
    for (const p of comparePaths()) expect(llms).toContain(`https://distribute.you${p}`);
  });

  it("the homepage footer carries a Compare column with every page, in raw HTML", () => {
    const home = read("public/landing/index-v2.html");
    const footer = home.slice(home.indexOf("<footer>"));
    expect(footer).toContain("<h4>Compare</h4>");
    for (const p of comparePaths()) expect(footer).toContain(`href="${p}"`);
    // The stylesheet gained the compare rules and a fifth footer column, so its key moved.
    expect(home).toContain(`href="/landing/v2/styles.css?v=${V2_STYLES_VERSION}"`);
  });

  it("the routes exist for the hub, the alternatives page and the slug", () => {
    expect(read("src/app/compare/route.ts")).toContain("renderCompareHub");
    expect(read("src/app/alternatives/route.ts")).toContain("renderAlternativesPage");
    const slug = read("src/app/compare/[slug]/route.ts");
    expect(slug).toContain("competitorBySlug");
    expect(slug).toContain('staticResponse("404.html", request, { status: 404');
  });

  it("the stylesheet carries the compare rules and the five-column footer", () => {
    const css = read("public/landing/v2/styles.css");
    expect(css).toContain(".cmp-table {");
    expect(css).toContain(".foot { display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr 1fr;");
  });
});

describe("served through the pipeline", () => {
  it("resolves every token and answers markdown", async () => {
    const { renderedResponse } = await import("@/lib/static-html");
    const c = COMPETITORS[0];
    const res = await renderedResponse(renderComparePage(c), new Request("https://distribute.you/compare/x"), {
      canonicalPath: `/compare/${c.slug}`,
    });
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).not.toMatch(/__[A-Z_]+__/);
    expect(body).toContain("googletagmanager");
    expect((body.match(/"@type":"Organization"/g) ?? []).length).toBe(1);

    const md = await renderedResponse(
      renderComparePage(c),
      new Request("https://distribute.you/compare/x", { headers: { accept: "text/markdown" } }),
      { canonicalPath: `/compare/${c.slug}` },
    );
    expect(md.headers.get("content-type")).toContain("text/markdown");
    expect(await md.text()).toContain(`distribute.you vs ${c.name}`);
  });
});
