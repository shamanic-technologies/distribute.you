// The bar charts' geometry, in one place so the renderer and the guard read the same
// arithmetic. A chart is an inline SVG on a 800-unit viewBox: a label gutter on the left,
// a bar, its value to the right of the bar, and a line of counts under the bar.
//
// Both numbers here were once hardcoded and both were wrong: the box stopped 9px above the
// last row's count line (32 of 36 charts sliced it in half) and the gutter was a flat 150
// units, so a long bucket name ran under the bars. Neither is visible to a test that reads
// values, which is why this module exists and `blog-chart-geometry.test.ts` reads it.

// Advance widths for Inter, in em. Calibrated against the rendered page (Playwright getBBox
// on the live article) and accurate to about 2%, which is what lets a chart size its own
// gutter instead of hoping a fixed one is wide enough.
export const EM = {
  " ": 0.26, ".": 0.28, ",": 0.28, ":": 0.28, ";": 0.28, "'": 0.2, "’": 0.2,
  "(": 0.34, ")": 0.34, "-": 0.33, "+": 0.57, "&": 0.68, "$": 0.57, "/": 0.36, "%": 0.8,
  0: 0.57, 1: 0.57, 2: 0.57, 3: 0.57, 4: 0.57, 5: 0.57, 6: 0.57, 7: 0.57, 8: 0.57, 9: 0.57,
  a: 0.54, b: 0.57, c: 0.51, d: 0.57, e: 0.55, f: 0.33, g: 0.56, h: 0.56, i: 0.26,
  j: 0.26, k: 0.52, l: 0.26, m: 0.87, n: 0.57, o: 0.57, p: 0.57, q: 0.57, r: 0.38,
  s: 0.48, t: 0.36, u: 0.57, v: 0.51, w: 0.77, x: 0.51, y: 0.51, z: 0.47,
  A: 0.66, B: 0.65, C: 0.68, D: 0.7, E: 0.6, F: 0.58, G: 0.71, H: 0.72, I: 0.3,
  J: 0.52, K: 0.65, L: 0.56, M: 0.86, N: 0.73, O: 0.74, P: 0.64, Q: 0.74, R: 0.64,
  S: 0.63, T: 0.6, U: 0.71, V: 0.65, W: 0.97, X: 0.63, Y: 0.61, Z: 0.6,
};
const FALLBACK_EM = 0.56;
export const textWidth = (str, size) =>
  [...String(str)].reduce((w, ch) => w + (EM[ch] ?? FALLBACK_EM), 0) * size;

export const LABEL_SIZE = 14;   // the bucket name left of the bar
export const COUNT_SIZE = 11;   // the line of counts under the bar
export const ROW = 52;          // one bar plus its count line
export const HEAD = 56;         // the chart title, above the first row
export const COUNT_DY = 39;     // a count line's baseline, from its row's top
export const DESCENDER = 0.25;  // of the font size, how far a 'p' reaches under the baseline
export const NOTE_BLOCK = 26;   // the note under the last row, when the chart carries one
export const GUTTER_MIN = 150;
export const GUTTER_MAX = 300;
export const GUTTER_PAD = 14;
export const GUTTER_SLACK = 1.04; // the width table reads ~2% under; this covers it
export const BAR_END = 700;     // bars stop here so the value that follows lands inside 800
export const VIEW_W = 800;

// The gutter is measured from THIS chart's own labels: a fixed one lets a long bucket name
// run under the bars, which reads on the page as truncated text.
export const gutterFor = (labels) =>
  Math.min(
    GUTTER_MAX,
    Math.max(
      GUTTER_MIN,
      Math.ceil(Math.max(...labels.map((l) => textWidth(l, LABEL_SIZE))) * GUTTER_SLACK) + GUTTER_PAD,
    ),
  );

// The last row's count line sits at its row top + COUNT_DY and its descenders reach under
// that, so the box has to clear it. A height that stops at the bar slices the line in half.
export const chartHeight = (rowCount, hasNote) =>
  HEAD + (rowCount - 1) * ROW + COUNT_DY + Math.ceil(COUNT_SIZE * DESCENDER) + 4 + (hasNote ? NOTE_BLOCK : 0);
