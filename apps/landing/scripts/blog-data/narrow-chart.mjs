// Re-lays one of an article's bar charts onto the newsletter's narrow box.
//
// WHY THIS EXISTS. The article's chart is an 800-unit viewBox laid out for a page: a label
// gutter on the left, then the bar. A mail client shows that same chart at about 324 CSS px
// on a phone, so every unit renders at 0.4px and the whole thing reads as a grey smudge:
// title 6.5px, row label 5.7px, the line of counts 4.5px, against 16px body copy beside it.
// Widening the column cannot fix it, because the ratio is set by the viewBox and not by the
// PNG: the phone is 390px and the chart's own proportions are what have to change.
//
// WHY IT READS THE SVG RATHER THAN THE FACTS. The obvious shape is a second render from
// facts.json, and it is the wrong one: it is a second data path, so the two charts could
// state different numbers for one chart. This takes the article's emitted bytes as its only
// input, recovers the rows from them, and re-emits on a 420-unit box. Every figure, every
// label, every count line and the aria-label are carried across VERBATIM, so a chart the
// newsletter draws is the article's chart by construction, and a re-derivation that moves a
// figure moves the newsletter's too on the next run of render-newsletter-charts.mjs.
//
// The parse is exact rather than heuristic: barChart() in render-articles.mjs emits a fixed
// shape, and each element carries a font-size + fill signature that no other element has.

import {
  NARROW_VIEW_W,
  NARROW_TITLE_SIZE,
  NARROW_LABEL_SIZE,
  NARROW_VALUE_SIZE,
  NARROW_COUNT_SIZE,
  NARROW_NOTE_SIZE,
  NARROW_TITLE_LINE,
  NARROW_ROW,
  NARROW_LABEL_DY,
  NARROW_BAR_DY,
  NARROW_BAR_H,
  NARROW_COUNT_DY,
  NARROW_VALUE_PAD,
  NARROW_NOTE_LINE,
  NARROW_WRAP_W,
  narrowBarEnd,
  narrowChartHeight,
  narrowHead,
  wrapText,
} from "./chart-geometry.mjs";

const unesc = (s) =>
  String(s)
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Reads one article chart's SVG into the parts a chart is made of. Throws rather than
 * guessing: a chart this cannot read is a chart whose emitter changed, and re-laying it on
 * a shape we no longer understand is how a newsletter comes to draw the wrong figures.
 */
export function parseArticleChart(svg) {
  const view = svg.match(/<svg viewBox="0 0 (\d+) (\d+)"/);
  if (!view) throw new Error("[narrow-chart] chart has no 800-unit viewBox");
  // Carried as the ESCAPED attribute value, and re-emitted as-is: this string is the join
  // the newsletter's figure-parity guard rests on, so it has to come out byte for byte.
  const ariaLabel = svg.match(/aria-label="([^"]*)"/)?.[1];
  if (ariaLabel === undefined) throw new Error("[narrow-chart] chart has no aria-label");

  const title = svg.match(/<text x="0" y="22" font-size="16" font-weight="600"[^>]*>([\s\S]*?)<\/text>/)?.[1];
  if (title === undefined) throw new Error("[narrow-chart] chart has no title");

  const labels = [...svg.matchAll(/<text x="0" y="\d+" font-size="14" fill="#475569">([\s\S]*?)<\/text>/g)].map(
    (m) => unesc(m[1]),
  );
  const bars = [...svg.matchAll(/<rect x="\d+" y="\d+" width="(\d+)" height="26" rx="5" fill="([^"]+)"\/>/g)].map(
    (m) => ({ width: Number(m[1]), fill: m[2] }),
  );
  const values = [
    ...svg.matchAll(/<text x="\d+" y="\d+" font-size="16" font-weight="700"[^>]*>([\s\S]*?)<\/text>/g),
  ].map((m) => unesc(m[1]));
  const counts = [...svg.matchAll(/<text x="\d+" y="\d+" font-size="11" fill="#94a3b8">([\s\S]*?)<\/text>/g)].map(
    (m) => unesc(m[1]),
  );
  const note = svg.match(/<text x="0" y="\d+" font-size="13" fill="#64748b">([\s\S]*?)<\/text>/)?.[1];

  const n = labels.length;
  if (!n) throw new Error("[narrow-chart] chart has no rows");
  if (bars.length !== n || values.length !== n || counts.length !== n) {
    throw new Error(
      `[narrow-chart] chart parts disagree: ${n} labels, ${bars.length} bars, ${values.length} values, ${counts.length} counts`,
    );
  }

  return {
    ariaLabel,
    title: unesc(title),
    note: note === undefined ? null : unesc(note),
    rows: labels.map((label, i) => ({ label, value: values[i], count: counts[i], ...bars[i] })),
  };
}

/**
 * Emits the same chart on the newsletter's narrow box. Bar LENGTHS are carried across as a
 * fraction of the widest bar, which is exactly the ratio the article drew (`v / max`), so a
 * bar keeps its proportion without this module ever seeing a value as a number.
 */
export function narrowChartSvg(chart) {
  const { rows, title, note, ariaLabel } = chart;
  const widest = Math.max(...rows.map((r) => r.width));
  const barEnd = narrowBarEnd(rows.map((r) => r.value));
  const titleLines = wrapText(title, NARROW_TITLE_SIZE, NARROW_WRAP_W);
  const noteLines = note ? wrapText(note, NARROW_NOTE_SIZE, NARROW_WRAP_W) : [];
  const height = narrowChartHeight(rows.length, titleLines.length, noteLines.length);
  const head = narrowHead(titleLines.length);

  const parts = [
    `<svg viewBox="0 0 ${NARROW_VIEW_W} ${height}" width="100%" role="img" aria-label="${ariaLabel}" font-family="Inter, system-ui, sans-serif">`,
  ];
  titleLines.forEach((line, i) => {
    parts.push(
      `<text x="0" y="${8 + i * NARROW_TITLE_LINE + NARROW_TITLE_SIZE}" font-size="${NARROW_TITLE_SIZE}" font-weight="600" fill="#0f172a">${esc(line)}</text>`,
    );
  });
  rows.forEach((r, i) => {
    const y = head + i * NARROW_ROW;
    const w = Math.max(6, Math.round((r.width / widest) * barEnd));
    parts.push(
      `<text x="0" y="${y + NARROW_LABEL_DY}" font-size="${NARROW_LABEL_SIZE}" fill="#475569">${esc(r.label)}</text>`,
    );
    parts.push(
      `<rect x="0" y="${y + NARROW_BAR_DY}" width="${w}" height="${NARROW_BAR_H}" rx="5" fill="${r.fill}"/>`,
    );
    parts.push(
      `<text x="${w + NARROW_VALUE_PAD}" y="${y + NARROW_BAR_DY + 19}" font-size="${NARROW_VALUE_SIZE}" font-weight="700" fill="#0f172a">${esc(r.value)}</text>`,
    );
    parts.push(
      `<text x="0" y="${y + NARROW_COUNT_DY}" font-size="${NARROW_COUNT_SIZE}" fill="#94a3b8">${esc(r.count)}</text>`,
    );
  });
  noteLines.forEach((line, i) => {
    parts.push(
      `<text x="0" y="${head + rows.length * NARROW_ROW + 4 + i * NARROW_NOTE_LINE + NARROW_NOTE_SIZE}" font-size="${NARROW_NOTE_SIZE}" fill="#64748b">${esc(line)}</text>`,
    );
  });
  parts.push("</svg>");
  return parts.join("\n");
}

export const narrowChartFrom = (svg) => narrowChartSvg(parseArticleChart(svg));
