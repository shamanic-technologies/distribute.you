import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { narrowChartFrom, parseArticleChart } from "../../scripts/blog-data/narrow-chart.mjs";
import {
  NARROW_COUNT_SIZE,
  NARROW_LABEL_SIZE,
  NARROW_TITLE_SIZE,
  NARROW_VALUE_SIZE,
  NARROW_VIEW_W,
  NARROW_WRAP_SLACK,
  textWidth,
} from "../../scripts/blog-data/chart-geometry.mjs";

/**
 * The newsletter's charts, read as GEOMETRY on the box a phone actually shows them at.
 *
 * The sibling guards on this page read VALUES: the figures, the copy, the ordering, the
 * parity between what the email states and what its charts draw. None of them can see
 * whether a chart is READABLE, and for several days that gap shipped an email whose every
 * chart was a grey smudge: the article's chart is an 800-unit viewBox built for a page, the
 * email showed it at 324 CSS px on a phone, and that put the row labels at 5.7px and the
 * count lines at 4.5px beside 16px body copy. Nothing was red. The layout did not overflow,
 * the figures were right, the alt text was right, and the charts were unreadable.
 *
 * So this asserts the two things a value guard cannot: every glyph lands inside the narrow
 * box, and every glyph is big enough to read at the width the email renders it.
 */

const ROOT = join(__dirname, "..", "..");
const ARTICLE = join(ROOT, "content", "blog", "flash-vs-pro-llm-cold-email", "article.html");
const NEWSLETTER = join(ROOT, "content", "newsletters", "flash-vs-pro", "index.html");

const article = readFileSync(ARTICLE, "utf8");
const newsletter = readFileSync(NEWSLETTER, "utf8");
const articleCharts = article.match(/<svg[\s\S]*?<\/svg>/g) ?? [];

/**
 * The width one of these charts is rendered at on a 390px phone: the card is padded 20px a
 * side inside a body padded 12px a side, plus the card's own 1px border. Every size below
 * is measured against THIS, not against the desktop column, because the phone is the case
 * that broke.
 */
const PHONE_CHART_PX = 324;
/** Under this a line of type is decoration, not something a reader can read on a phone. */
const MIN_READABLE_PX = 9;

const unesc = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&");

/** The charts the newsletter actually carries, by the index the renderer names them with. */
const referenced = [...newsletter.matchAll(/newsletter\/chart-(\d+)\.png/g)].map((m) => Number(m[1]));

describe("the newsletter's charts are legible on a phone", () => {
  it("references at least one chart, each of which the article has", () => {
    expect(referenced.length).toBeGreaterThan(0);
    for (const n of referenced) expect(articleCharts[n - 1], `article has no chart #${n}`).toBeTruthy();
  });

  it.each(referenced)("chart-%i keeps every glyph inside the narrow box", (n) => {
    const svg = narrowChartFrom(articleCharts[n - 1]);
    const width = Number(svg.match(/viewBox="0 0 (\d+)/)![1]);
    expect(width).toBe(NARROW_VIEW_W);

    for (const m of svg.matchAll(/<text x="(\d+)"[^>]*font-size="(\d+)"[^>]*>([\s\S]*?)<\/text>/g)) {
      const right = Number(m[1]) + textWidth(unesc(m[3]), Number(m[2])) * NARROW_WRAP_SLACK;
      expect(Math.round(right), `"${unesc(m[3])}" runs past the box`).toBeLessThanOrEqual(width);
    }
    for (const m of svg.matchAll(/<rect x="0" y="\d+" width="(\d+)"/g)) {
      expect(Number(m[1])).toBeLessThanOrEqual(width);
    }
  });

  it.each(referenced)("chart-%i reads at 9px or more on a 390px phone", (n) => {
    const svg = narrowChartFrom(articleCharts[n - 1]);
    const scale = PHONE_CHART_PX / NARROW_VIEW_W;
    const sizes = [...svg.matchAll(/font-size="(\d+)"/g)].map((m) => Number(m[1]) * scale);
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(MIN_READABLE_PX);
  });

  it("the type scale that makes it legible is the one the geometry declares", () => {
    const scale = PHONE_CHART_PX / NARROW_VIEW_W;
    for (const size of [NARROW_TITLE_SIZE, NARROW_LABEL_SIZE, NARROW_VALUE_SIZE, NARROW_COUNT_SIZE]) {
      expect(size * scale).toBeGreaterThanOrEqual(MIN_READABLE_PX);
    }
  });
});

describe("a narrow chart is the article's chart, not a second one", () => {
  it.each(referenced)("chart-%i carries the article's aria-label verbatim", (n) => {
    const source = articleCharts[n - 1];
    const label = source.match(/aria-label="([^"]+)"/)![1];
    // The parity guard joins a chart-N.png to the article's Nth chart on this string. A
    // re-lay that reworded it would break that join silently.
    expect(narrowChartFrom(source)).toContain(`aria-label="${label}"`);
  });

  it.each(referenced)("chart-%i states the article's own labels, values and counts", (n) => {
    const source = articleCharts[n - 1];
    const parsed = parseArticleChart(source);
    const svg = narrowChartFrom(source);
    for (const row of parsed.rows) {
      expect(svg).toContain(`>${row.value}<`);
      expect(svg).toContain(`>${row.count}<`);
    }
    // Nothing is dropped: a chart that quietly lost a row would still look fine.
    expect([...svg.matchAll(/<rect /g)].length).toBe(parsed.rows.length);
  });
});

describe("the newsletter's chart images", () => {
  it("carry no rounded corner, which clips the chart's own title", () => {
    // chart-4 shipped with a 12px radius no other chart had. At 324px wide that corner ate
    // the first letter of the chart's own title.
    for (const m of newsletter.matchAll(/<img[^>]*newsletter\/chart-\d+\.png[^>]*>/g)) {
      expect(m[0]).not.toMatch(/border-radius/);
    }
  });

  it("share one cache-buster, since their bytes move with every re-render", () => {
    const busters = new Set([...newsletter.matchAll(/\.png\?v=(\d+)/g)].map((m) => m[1]));
    expect(busters.size).toBe(1);
  });
});
