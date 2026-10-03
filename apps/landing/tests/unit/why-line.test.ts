import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { renderAlternativesPage, renderCompareHub, renderComparePage } from "../../src/lib/compare-page";
import { renderBestForHub, renderBestForPage } from "../../src/lib/best-for-page";
import { BEST_FOR_PAGES } from "../../src/lib/best-for";
import { COMPETITORS } from "../../src/lib/competitors";
import { renderAboutPage } from "../../src/lib/pages/about";
import { WHY, ctaBox, footer } from "../../src/lib/v2-shell";

/**
 * Owner 2026-10-03: the why is one frozen sentence, "Revenue made easy.", stated on
 * every public surface. The H1s keep saying WHAT we are (a cold email agency); the why
 * frames them. These guards pin the wording and the template-level placements, so a
 * page added to a template inherits it and a rewrite of one surface cannot drop it.
 */
const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

describe("the why", () => {
  it("is spelled once, with its period", () => {
    expect(WHY).toBe("Revenue made easy.");
  });

  it("frames the homepage hero without touching the H1", () => {
    const html = read("public/landing/index-v2.html");
    const h1At = html.indexOf("<h1>");
    const whyAt = html.indexOf('<span class="eyebrow why-eyebrow">Revenue made easy.</span>');
    expect(whyAt).toBeGreaterThan(-1);
    expect(whyAt).toBeLessThan(h1At);
    expect(html).toContain("<h1>Get <span class=\"accent\">revenue in 24h</span><br>From $99/month");
    // Footer tag, closing CTA box and the meta description.
    expect(html).toContain('<p class="tag">Revenue made easy.</p>');
    expect(html).toContain('<p class="why">Revenue made easy.</p>');
    expect(html).toContain('<meta name="description" content="Revenue made easy. ');
  });

  it("closes and signs every page rendered through the shell", () => {
    expect(footer()).toContain(`<p class="tag">${WHY}</p>`);
    expect(ctaBox()).toContain(`<p class="why">${WHY}</p>`);
  });

  it("sits under the hero lead of the compare, best-for and About templates", () => {
    const pages = [
      renderComparePage(COMPETITORS[0]),
      renderCompareHub(),
      renderAlternativesPage(),
      renderBestForPage(BEST_FOR_PAGES[0]),
      renderBestForHub(),
      renderAboutPage(),
    ];
    for (const html of pages) {
      const hero = html.slice(html.indexOf('<section class="hero'), html.indexOf("</section>"));
      expect(hero).toContain(`<p class="why">${WHY}</p>`);
    }
  });

  it("signs the React footer and closes every blog article on the CTA wording", () => {
    expect(read("src/components/footer.tsx")).toContain("{WHY}");
    const article = read("src/app/blog/[slug]/page.tsx");
    const close = article.slice(article.indexOf("<aside"), article.indexOf("</aside>"));
    expect(close).toContain("{WHY}");
    expect(close).toContain("Get started: distribute.you");
    expect(read("src/app/blog/page.tsx")).toContain("{WHY}");
  });

  it("opens llms.txt and the site description", () => {
    expect(read("public/llms.txt")).toContain("> Revenue made easy.");
    expect(read("src/lib/seo.ts")).toContain('"Revenue made easy. ');
  });
});
