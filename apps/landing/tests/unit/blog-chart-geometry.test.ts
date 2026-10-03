import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BAR_END,
  COUNT_SIZE,
  DESCENDER,
  GUTTER_MAX,
  GUTTER_MIN,
  LABEL_SIZE,
  VIEW_W,
  chartHeight,
  gutterFor,
  textWidth,
} from "../../scripts/blog-data/chart-geometry.mjs";

/**
 * Geometry guards for the two data articles' bar charts.
 *
 * Every other guard on these pages reads VALUES: the figures, the copy, the ordering, the
 * dataset's coherence. None of them can see whether the chart drawing those values is the
 * right SHAPE, and for a day in September 2026 that gap shipped two defects to production
 * at once. The box stopped nine units above the last row's line of counts, so 32 of the 36
 * charts sliced it in half; and the label gutter was a flat 150 units, so eleven bucket
 * names ran under the bars. The suite was green throughout, because both are arithmetic
 * about a rendered picture and nothing was asserting the arithmetic.
 *
 * So these read the emitted SVG as geometry rather than as text: does every glyph land
 * inside the box, does every label stop before the bars start, does every value stop before
 * the right edge. A chart is an 800-unit viewBox, and everything below is in those units.
 */

const CHART = /<svg viewBox="0 0 800 (\d+)"[\s\S]*?<\/svg>/g;
const ARTICLES = ["cold-email-unsubscribe-link-spam", "cold-email-follow-up"] as const;

type Chart = {
  slug: string;
  title: string;
  height: number;
  body: string;
  gutter: number;
  labels: string[];
};

/** The bars are the 26-unit rects; their x IS the gutter the labels have to fit inside. */
function chartsOf(slug: string): Chart[] {
  const html = readFileSync(join(__dirname, "..", "..", "content", "blog", slug, "article.html"), "utf8");
  return [...html.matchAll(CHART)].map((m) => {
    const body = m[0];
    const bars = [...body.matchAll(/<rect x="(\d+)" y="\d+" width="(\d+)" height="26"/g)];
    const labels = [...body.matchAll(/<text x="0" y="\d+" font-size="14"[^>]*>([^<]*)<\/text>/g)].map((l) =>
      // the emitted label is escaped; measure the characters a reader sees
      l[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"'),
    );
    return {
      slug,
      title: /aria-label="([^":]*)/.exec(body)?.[1] ?? "",
      height: Number(m[1]),
      body,
      gutter: bars.length ? Number(bars[0][1]) : GUTTER_MIN,
      labels,
    };
  });
}

const charts = ARTICLES.flatMap(chartsOf);
const drawn = charts.filter((c) => c.labels.length > 0 && /<rect[^>]*height="26"/.test(c.body));
const generated = drawn.filter((c) => /font-size="11"/.test(c.body));

describe("blog chart geometry", () => {
  it("reads every data article", () => {
    expect(charts.length).toBeGreaterThanOrEqual(5);
    expect(generated.length).toBeGreaterThanOrEqual(1);
    expect(drawn.length).toBe(generated.length);
  });

  it("nothing is clipped: every glyph lands inside its own viewBox", () => {
    // This is the exact defect that shipped: the last row's count line sat below the box.
    const clipped: string[] = [];
    for (const c of drawn) {
      for (const t of c.body.matchAll(/<text [^>]*y="(\d+)" font-size="(\d+)"/g)) {
        const bottom = Number(t[1]) + Number(t[2]) * DESCENDER;
        if (bottom > c.height) clipped.push(`${c.slug} "${c.title}" ${bottom.toFixed(1)} > ${c.height}`);
      }
    }
    expect(clipped).toEqual([]);
  });

  it("no label runs under the bars: the gutter carries the longest one it draws", () => {
    const overrun: string[] = [];
    for (const c of drawn) {
      for (const l of c.labels) {
        const end = textWidth(l, LABEL_SIZE);
        if (end > c.gutter - 4) overrun.push(`${c.slug} "${l}" ends at ${Math.round(end)} in a ${c.gutter} gutter`);
      }
    }
    expect(overrun).toEqual([]);
  });

  it("every value lands inside the 800-unit box, to the right of its bar", () => {
    const outside: string[] = [];
    for (const c of drawn) {
      for (const t of c.body.matchAll(/<text x="(\d+)" y="\d+" font-size="16" font-weight="700"[^>]*>([^<]*)</g)) {
        const end = Number(t[1]) + textWidth(t[2], 16);
        if (end > VIEW_W) outside.push(`${c.slug} "${t[2]}" ends at ${Math.round(end)}`);
      }
    }
    expect(outside).toEqual([]);
    for (const c of generated) {
      for (const bar of c.body.matchAll(/<rect x="(\d+)" y="\d+" width="(\d+)" height="26"/g)) {
        expect(Number(bar[1]) + Number(bar[2])).toBeLessThanOrEqual(BAR_END);
      }
    }
  });

  it("the gutter is MEASURED per chart, never one hardcoded number for all of them", () => {
    // A single gutter across every chart is what let the long industry names overrun.
    const gutters = new Set(generated.map((c) => c.gutter));
    expect(gutters.size).toBeGreaterThan(1);
    for (const g of gutters) {
      expect(g).toBeGreaterThanOrEqual(GUTTER_MIN);
      expect(g).toBeLessThanOrEqual(GUTTER_MAX);
    }
  });

  it("each chart's height and gutter are the ones the shared geometry computes", () => {
    for (const c of generated) {
      const rows = c.labels.length;
      const hasNote = /font-size="13" fill="#64748b"/.test(c.body);
      expect(`${c.title}: ${c.height}`).toBe(`${c.title}: ${chartHeight(rows, hasNote)}`);
      expect(`${c.title}: ${c.gutter}`).toBe(`${c.title}: ${gutterFor(c.labels)}`);
    }
  });

  it("a count line is drawn for every bar, inside the gutter's right-hand side", () => {
    for (const c of generated) {
      const counts = [...c.body.matchAll(/<text x="(\d+)" y="\d+" font-size="11"/g)];
      expect(`${c.title}: ${counts.length}`).toBe(`${c.title}: ${c.labels.length}`);
      for (const n of counts) expect(Number(n[1])).toBe(c.gutter);
      expect(Number(COUNT_SIZE)).toBe(11);
    }
  });
});
