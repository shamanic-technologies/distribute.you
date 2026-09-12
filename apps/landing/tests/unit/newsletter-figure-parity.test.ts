import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The newsletter states figures the ARTICLE's charts draw, and it is hand-authored
 * beside a GENERATED article, so every re-derivation moves the article and leaves
 * this page publishing the retired numbers. The sibling guard already pins the
 * headline literals; what it could not see is a figure SPLIT ACROSS TWO ELEMENTS
 * (`4.9<span> vs 1.6</span>`), which no source-substring sweep matches and which
 * shipped a stale twist figure while the chart directly beneath it said 1.5.
 *
 * So this reads the newsletter the way a person does: tags stripped, section by
 * section, each stated number checked against the chart in that same section.
 * Nothing here pins a literal, so a re-derivation that moves a figure turns a test
 * red instead of landing in forty inboxes.
 *
 * The join is the renderer's own: scripts/render-newsletter-charts.mjs writes
 * `chart-<N>.png` from the Nth <svg> of article.html, 1-based, so a newsletter
 * image named chart-N carries the figures of the article's Nth chart and its
 * aria-label is the authority on what that chart prints.
 */
const ROOT = join(__dirname, "..", "..");
const NEWSLETTER = join(ROOT, "content", "newsletters", "flash-vs-pro");
const html = readFileSync(join(NEWSLETTER, "index.html"), "utf8");
const text = readFileSync(join(NEWSLETTER, "index.txt"), "utf8");
const article = readFileSync(
  join(ROOT, "content", "blog", "flash-vs-pro-llm-cold-email", "article.html"),
  "utf8",
);

/** The article's charts, in the order the renderer indexes them (1-based). */
const chartLabels = (article.match(/<svg[\s\S]*?<\/svg>/g) ?? []).map(
  (svg) => svg.match(/aria-label="([^"]+)"/)?.[1] ?? "",
);

/** Strip tags so a figure split across elements reads as one string, as a person sees it. */
const stripTags = (markup: string) =>
  markup
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Every figure a string states, thousands separators NORMALISED away: the alt text is
 * written for a screen reader and spells a bucket bound in its own words ("over 1,000
 * people" for the chart's "1000+"), which is rewording rather than drift. What must
 * agree is the VALUE, so 1,000 and 1000 are one figure and $1,461 still is itself.
 */
const figuresIn = (s: string): string[] =>
  [...s.matchAll(/\$?\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0].replace(/,/g, ""));

/** The newsletter's sections, split on the HTML comments that head each one. */
const sections = html
  .split(/<!--\s/)
  .slice(1)
  .map((chunk) => ({
    name: chunk.slice(0, chunk.indexOf(" -->")),
    markup: chunk,
  }));

describe("newsletter figures match the charts they sit beside", () => {
  it("reads the article's charts", () => {
    expect(chartLabels.length).toBeGreaterThan(30);
    expect(chartLabels.every((l) => l.length > 0)).toBe(true);
  });

  /**
   * A chart's ALT is written for this surface (lowercased, "(thin)" moved after the
   * value) so it is never byte-equal to the article's aria-label. What must be equal
   * is the set of FIGURES: same bars, same values, same order.
   */
  it("every chart's alt text states the figures its article chart draws", () => {
    const images = [...html.matchAll(/<img[^>]+src="[^"]*\/newsletter\/chart-(\d+)\.png[^"]*"[^>]*>/g)];
    expect(images.length).toBeGreaterThanOrEqual(9);

    for (const [tag, indexRaw] of images) {
      const index = Number(indexRaw);
      const label = chartLabels[index - 1];
      expect(label, `chart-${index}.png has no chart at article index ${index}`).toBeTruthy();

      const alt = tag.match(/alt="([^"]*)"/)?.[1] ?? "";
      expect(alt, `chart-${index}.png has no alt text`).not.toBe("");

      expect(figuresIn(alt), `chart-${index}.png alt does not state its chart's figures`).toEqual(
        figuresIn(label),
      );
    }
  });

  /**
   * THE ONE THIS EXISTS FOR, and it is the repo's own rule for a paragraph beside a
   * chart: a section states what its charts print and nothing else. Every figure in a
   * charted section, whether it is the 64px stat or a sentence, must be a figure one of
   * that section's charts draws. Tags are stripped first, so `4.9<span> vs 1.6</span>`
   * reads as "4.9 vs 1.6" and the stale half fails here, which is exactly what a
   * source-substring sweep of the newsletter could never see.
   *
   * Two things are deliberately not figures: the section's own pill number (01, 02) and
   * the alt text of the images, which the test above already checks against the charts.
   */
  it("every charted section states only figures its own charts print", () => {
    const checked: string[] = [];

    for (const section of sections) {
      const indexes = [...section.markup.matchAll(/\/newsletter\/chart-(\d+)\.png/g)].map((m) =>
        Number(m[1]),
      );
      if (indexes.length === 0) continue;

      const drawn = new Set(indexes.flatMap((i) => figuresIn(chartLabels[i - 1] ?? "")));
      const prose = stripTags(
        section.markup
          .replace(/<img[^>]*>/g, " ") // the images' own alt text is checked above
          .replace(/<td[^>]*border-radius:100px[^>]*>[\s\S]*?<\/td>/g, " "), // the section's pill number
      );

      for (const figure of figuresIn(prose)) {
        expect(
          drawn.has(figure),
          `section "${section.name}" states ${figure}, its charts draw ${[...drawn].join(", ")}`,
        ).toBe(true);
      }
      checked.push(section.name);
    }

    // a guard that silently matched nothing is the bug it exists to catch
    expect(checked.length).toBeGreaterThanOrEqual(4);
  });

  /**
   * The plain-text part is a second copy of the same claims, and it drifts on its own:
   * it is what a client rendering no HTML shows and what a spam filter reads. Every
   * figure it states must be one the HTML states, so the two halves move together.
   */
  it("the plain-text part states no figure the HTML does not", () => {
    const stated = new Set(figuresIn(stripTags(html)));
    const missing = [...new Set(figuresIn(text))].filter((figure) => !stated.has(figure));
    expect(missing, `plain-text figures absent from the HTML: ${missing.join(", ")}`).toEqual([]);
  });

  /**
   * The images changed twice under one `?v=3` while the discipline exists precisely so a
   * reader's client cannot serve a cached chart beside refreshed copy. One token, all images.
   */
  it("every image carries the same cache-buster", () => {
    const versions = new Set([...html.matchAll(/\?v=(\d+)/g)].map((m) => m[1]));
    expect(versions.size, `images carry several cache-busters: ${[...versions].join(", ")}`).toBe(1);
  });
});
