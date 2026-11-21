/**
 * The two charts of the owner's morning SaaS revenue Telegram (owner 2026-11-21):
 *   1. one bar per ISO week since inception, the current (partial) week dashed;
 *   2. the cumulative line since inception, one point per UTC day, the segment
 *      into today (partial) dashed.
 *
 * Pure SVG strings built from SERVED points: nothing here sums, rates or fills a
 * gap. The cumulative points are features-service's own running totals, never a
 * client-side accumulation of the weekly bars.
 *
 * Alias-free on purpose (no runtime `@/` import) so it gets real unit tests.
 */

export interface RevenuePoint {
  /** Period start, `YYYY-MM-DD` (the week's Monday, or the UTC day). */
  start: string;
  /** USD for the bar (weekly) or the running total as of this day (cumulative). */
  usd: number;
  /** True only for the current, still incomplete period. */
  current: boolean;
}

// Keel tokens (brand-charts skill): the same hand as dashboard v2.
const BG = "#ffffff";
const FG1 = "#101012";
const FG3 = "#74747c";
const LINE = "#e6e6e8";
const ACCENT = "#2a6cc9";
const ACCENT_SOFT = "#d7edff";

export const CHART_WIDTH = 1000;
export const CHART_HEIGHT = 560;

const PAD = { top: 96, right: 40, bottom: 56, left: 84 };

function assertPoints(points: RevenuePoint[], context: string): void {
  if (points.length === 0) throw new Error(`[saas-revenue-charts] ${context}: no points to draw`);
  for (const p of points) {
    if (!Number.isFinite(p.usd)) throw new Error(`[saas-revenue-charts] ${context}: non-numeric usd on ${p.start}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.start)) throw new Error(`[saas-revenue-charts] ${context}: bad period start ${JSON.stringify(p.start)}`);
  }
  const currents = points.filter((p) => p.current).length;
  if (currents > 1) throw new Error(`[saas-revenue-charts] ${context}: ${currents} points flagged current`);
}

/** `$1,234` from $10 up, `$9.50` below (repo money format). */
export function formatUsd(usd: number): string {
  if (Math.abs(usd) >= 10) return `$${Math.round(usd).toLocaleString("en-US")}`;
  return `$${usd.toFixed(2)}`;
}

/** Short axis money: `$0`, `$800`, `$1.2k`, `$15k`. */
function axisUsd(usd: number): string {
  if (usd >= 10_000) return `$${Math.round(usd / 1000)}k`;
  if (usd >= 1_000) return `$${(usd / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return `$${Math.round(usd)}`;
}

/** A round axis ceiling with 4 ticks (1, 2, 2.5, 5 × 10^n per step). */
export function niceCeiling(max: number): { ceiling: number; step: number } {
  if (max <= 0) return { ceiling: 100, step: 25 };
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough) as number;
  return { ceiling: step * 4, step };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function shortDate(start: string): string {
  const [, m, d] = start.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function frame(title: string, headline: string, body: string, ceiling: number, step: number): string {
  const plotH = CHART_HEIGHT - PAD.top - PAD.bottom;
  let grid = "";
  for (let v = 0; v <= ceiling + 1e-9; v += step) {
    const y = PAD.top + plotH - (v / ceiling) * plotH;
    grid += `<line x1="${PAD.left}" x2="${CHART_WIDTH - PAD.right}" y1="${y}" y2="${y}" stroke="${LINE}" stroke-width="1"/>`;
    grid += `<text x="${PAD.left - 12}" y="${y + 5}" text-anchor="end" font-size="15" fill="${FG3}">${axisUsd(v)}</text>`;
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CHART_WIDTH}" height="${CHART_HEIGHT}" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" font-family="Helvetica, Arial, sans-serif">` +
    `<rect width="100%" height="100%" fill="${BG}"/>` +
    `<text x="${PAD.left - 44}" y="40" font-size="18" fill="${FG3}">${esc(title)}</text>` +
    `<text x="${PAD.left - 44}" y="74" font-size="30" font-weight="700" fill="${FG1}">${esc(headline)}</text>` +
    grid +
    body +
    `</svg>`
  );
}

/** Up to ~8 evenly spaced x labels, always including the last one. */
function labelIndexes(n: number): Set<number> {
  const every = Math.max(1, Math.ceil(n / 8));
  const out = new Set<number>();
  for (let i = n - 1; i >= 0; i -= every) out.add(i);
  return out;
}

/** Chart 1: weekly bars since inception, the current week dashed. */
export function weeklyBarsSvg(points: RevenuePoint[], title: string, headline: string): string {
  assertPoints(points, "weekly");
  const { ceiling, step } = niceCeiling(Math.max(...points.map((p) => p.usd)));
  const plotW = CHART_WIDTH - PAD.left - PAD.right;
  const plotH = CHART_HEIGHT - PAD.top - PAD.bottom;
  const slot = plotW / points.length;
  const barW = Math.max(2, slot * 0.72);
  const labels = labelIndexes(points.length);
  let body = "";
  points.forEach((p, i) => {
    const h = (Math.max(0, p.usd) / ceiling) * plotH;
    const x = PAD.left + i * slot + (slot - barW) / 2;
    const y = PAD.top + plotH - h;
    body += p.current
      ? `<rect x="${x}" y="${y}" width="${barW}" height="${Math.max(h, 1)}" rx="3" fill="${ACCENT_SOFT}" stroke="${ACCENT}" stroke-width="2" stroke-dasharray="6 4"/>`
      : `<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="3" fill="${ACCENT}"/>`;
    if (labels.has(i)) {
      body += `<text x="${x + barW / 2}" y="${CHART_HEIGHT - PAD.bottom + 26}" text-anchor="middle" font-size="14" fill="${FG3}">${shortDate(p.start)}</text>`;
    }
  });
  return frame(title, headline, body, ceiling, step);
}

/** Chart 2: cumulative line since inception, the segment into today dashed. */
export function cumulativeLineSvg(points: RevenuePoint[], title: string, headline: string): string {
  assertPoints(points, "cumulative");
  const { ceiling, step } = niceCeiling(Math.max(...points.map((p) => p.usd)));
  const plotW = CHART_WIDTH - PAD.left - PAD.right;
  const plotH = CHART_HEIGHT - PAD.top - PAD.bottom;
  const xAt = (i: number) => PAD.left + (points.length === 1 ? plotW : (i / (points.length - 1)) * plotW);
  const yAt = (usd: number) => PAD.top + plotH - (Math.max(0, usd) / ceiling) * plotH;
  const lastIdx = points.length - 1;
  const solidEnd = points[lastIdx].current ? lastIdx - 1 : lastIdx;
  let body = "";
  if (solidEnd >= 0) {
    const solid = points.slice(0, solidEnd + 1).map((p, i) => `${xAt(i)},${yAt(p.usd)}`).join(" ");
    body += `<polygon points="${xAt(0)},${PAD.top + plotH} ${solid} ${xAt(solidEnd)},${PAD.top + plotH}" fill="${ACCENT}" fill-opacity="0.08"/>`;
    body += `<polyline points="${solid}" fill="none" stroke="${ACCENT}" stroke-width="3" stroke-linejoin="round"/>`;
  }
  if (points[lastIdx].current && lastIdx >= 1) {
    body += `<line x1="${xAt(lastIdx - 1)}" y1="${yAt(points[lastIdx - 1].usd)}" x2="${xAt(lastIdx)}" y2="${yAt(points[lastIdx].usd)}" stroke="${ACCENT}" stroke-width="3" stroke-dasharray="7 5"/>`;
  }
  body += `<circle cx="${xAt(lastIdx)}" cy="${yAt(points[lastIdx].usd)}" r="5" fill="${BG}" stroke="${ACCENT}" stroke-width="3"/>`;
  for (const i of labelIndexes(points.length)) {
    body += `<text x="${xAt(i)}" y="${CHART_HEIGHT - PAD.bottom + 26}" text-anchor="middle" font-size="14" fill="${FG3}">${shortDate(points[i].start)}</text>`;
  }
  return frame(title, headline, body, ceiling, step);
}
