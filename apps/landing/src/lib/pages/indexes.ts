import { SITE, breadcrumb, shell, whyLine } from "../v2-shell";
import {
  EXPECTED_LABEL,
  STATUS_LABEL,
  UNIT_TEXT,
  esc,
  formatDay,
  formatIndexValue,
  formatTick,
  isExpected,
  statusLegend,
  statusLine,
  unavailableLine,
  type BasisRule,
  type IndexDetail,
  type IndexUnit,
  type IndexList,
  type IndexPoint,
  type IndexStatus,
  type IndexSummary,
  type ValueKind,
} from "../fleet-indexes";

/**
 * `/indexes/<slug>` and `/indexes` (owner 2026-10-18, FLEET-INDEXES-1018): the page we
 * send when someone asks what our numbers look like today. The hero IS the index:
 * today's value, large, and the daily series drawn across the page, so the reader sees
 * the number and that we publish it day after day.
 *
 * Everything is read from the served list and series (`lib/fleet-indexes.ts`); the
 * chart is drawn server-side as SVG, so crawlers and agents read the same page a
 * browser shows. Alias-free so the unit tests render it directly.
 */

const DAY_MS = 86_400_000;

function dayNumber(day: string): number {
  return Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
}

function dayFromNumber(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

function badge(status: IndexStatus): string {
  return `<span class="ix-badge ix-${status}"><span class="ix-dot" aria-hidden="true"></span>${STATUS_LABEL[status]}</span>`;
}

/** The "Expected" chip beside a value the producer served as expected; nothing for a measured one. */
export function expectedTag(x: { valueKind?: ValueKind } | null | undefined): string {
  return isExpected(x) ? `<span class="ix-expected">${EXPECTED_LABEL}</span>` : "";
}

/** A value as text, with the word "expected" after it when it is one ($794 expected). */
function valueText(value: number, unit: IndexUnit, x: { valueKind?: ValueKind }): string {
  return `${formatIndexValue(value, unit)}${isExpected(x) ? " expected" : ""}`;
}

// ---------------------------------------------------------------------------
// The chart
// ---------------------------------------------------------------------------

const W = 1000;
const H = 300;

type Domain = { lo: number; hi: number };

/** Room above and below the line, so a flat series sits mid-height, never on an edge. */
export function chartDomain(values: number[]): Domain {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (hi === lo) {
    const pad = Math.abs(lo) * 0.5 || 1;
    return { lo: Math.max(0, lo - pad), hi: hi + pad };
  }
  const pad = (hi - lo) * 0.35;
  return { lo: Math.max(0, lo - pad), hi: hi + pad };
}

function pct(n: number): string {
  return `${Math.round(n * 100) / 100}%`;
}

/**
 * The daily series as a line over the page width. One recorded day draws a level line
 * that fades in from the left and ends on today's dot: the chart reads as "this is
 * where it starts", and every new day pushes the history leftwards.
 */
export function chartHtml(points: IndexPoint[], unit: IndexUnit, ariaName: string): string {
  const measured = points.filter((p) => p.value !== null) as (IndexPoint & { value: number })[];
  if (measured.length === 0) {
    return `<div class="ix-chart ix-chart-empty" role="img" aria-label="${esc(ariaName)}: no value recorded yet">
<div class="ix-empty-line" aria-hidden="true"></div>
</div>`;
  }
  const { lo, hi } = chartDomain(measured.map((p) => p.value));
  const first = dayNumber(points[0].day);
  const last = dayNumber(points[points.length - 1].day);
  const span = last - first;
  const yOf = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const xOf = (day: string) => (span === 0 ? W : ((dayNumber(day) - first) / span) * W);

  // Segments break on a day with no value: the gap shows, nothing is invented across it.
  // They also break where rebuilt days meet live ones (rebuilt = dashed), joined at the seam.
  type Seg = { rebuilt: boolean; pts: { x: number; y: number }[] };
  const segments: Seg[] = [];
  let current: Seg | null = null;
  for (const p of points) {
    if (p.value === null) {
      if (current) segments.push(current);
      current = null;
      continue;
    }
    const q = { x: xOf(p.day), y: yOf(p.value) };
    const rebuilt = p.basis === "recomputed";
    if (current && current.rebuilt !== rebuilt) {
      segments.push(current);
      current = { rebuilt, pts: [current.pts[current.pts.length - 1]] };
    }
    if (!current) current = { rebuilt, pts: [] };
    current.pts.push(q);
  }
  if (current) segments.push(current);

  const single = span === 0;
  const paths = segments
    .map((seg) => {
      const pts = single ? [{ x: 0, y: seg.pts[0].y }, seg.pts[0]] : seg.pts;
      const line = pts.map((q, i) => `${i ? "L" : "M"}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(" ");
      const area = `${line} L${pts[pts.length - 1].x.toFixed(1)} ${H} L${pts[0].x.toFixed(1)} ${H} Z`;
      return `<path class="ix-area" d="${area}" fill="url(#ix-fill)"/>
<path class="ix-line${seg.rebuilt ? " ix-line-re" : ""}" d="${line}" stroke="${single ? "url(#ix-fade)" : "currentColor"}" vector-effect="non-scaling-stroke"/>`;
    })
    .join("\n");

  // A scale around one level would be invented numbers: ticks appear once the series moves.
  const flat = measured.every((p) => p.value === measured[0].value);
  const ticks = flat ? [] : [0.2, 0.5, 0.8].map((k) => lo + (hi - lo) * k);
  const grid = ticks
    .map((t) => `<div class="ix-grid" style="top:${pct((yOf(t) / H) * 100)}"><span>${esc(formatTick(t, unit))}</span></div>`)
    .join("");

  const lastMeasured = measured[measured.length - 1];
  // A dot marks a day we published live; rebuilt days are the dashed line alone.
  const dots = measured
    .filter((p) => p.basis !== "recomputed" || p === lastMeasured)
    .map((p) => {
      const isLast = p === lastMeasured;
      const label = `${formatDay(p.day, true)}: ${valueText(p.value, unit, p)}`;
      return `<span class="ix-pt${isLast ? " ix-pt-now" : ""}" style="left:${pct((xOf(p.day) / W) * 100)};top:${pct((yOf(p.value) / H) * 100)}" title="${esc(label)}"></span>`;
    })
    .join("");

  const firstLabel = single ? `First recorded ${formatDay(points[0].day, true)}` : formatDay(points[0].day, true);
  const summary = measured.slice(-30).map((p) => `${formatDay(p.day)} ${valueText(p.value, unit, p)}`).join(", ");
  return `<figure class="ix-chart-wrap">
<div class="ix-chart" role="img" aria-label="${esc(`${ariaName}, daily: ${summary}`)}">
${grid}
<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false">
<defs>
<linearGradient id="ix-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2563eb" stop-opacity="0.16"/><stop offset="1" stop-color="#2563eb" stop-opacity="0"/></linearGradient>
<linearGradient id="ix-fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2563eb" stop-opacity="0"/><stop offset="0.55" stop-color="#2563eb" stop-opacity="0.55"/><stop offset="1" stop-color="#2563eb" stop-opacity="1"/></linearGradient>
</defs>
${paths}
</svg>
${dots}
</div>
<figcaption class="ix-axis"><span>${esc(firstLabel)}</span><span>${esc(formatDay(points[points.length - 1].day, true))}</span></figcaption>
</figure>`;
}

/** One square per calendar day since the first record: the habit made visible. */
export function ribbonHtml(points: IndexPoint[]): string {
  if (points.length === 0) return "";
  const byDay = new Map(points.map((p) => [p.day, p]));
  const first = dayNumber(points[0].day);
  const last = dayNumber(points[points.length - 1].day);
  const total = last - first + 1;
  const shown = Math.min(total, 90);
  const cells: string[] = [];
  for (let n = last - shown + 1; n <= last; n++) {
    const day = dayFromNumber(n);
    const p = byDay.get(day);
    const rebuilt = p?.basis === "recomputed";
    const cls = !p ? "ix-day-missed" : p.value === null ? "ix-day-open" : `ix-day-${p.status}${rebuilt ? " ix-day-re" : ""}`;
    const what = !p ? "not recorded" : p.value === null ? "recorded, no value" : `${STATUS_LABEL[p.status]}${rebuilt ? ", rebuilt" : ""}`;
    cells.push(`<span class="ix-day ${cls}" title="${esc(`${formatDay(day, true)}: ${what}`)}"></span>`);
  }
  // A rebuilt day was not published that day: the line counts the days we published live.
  const live = points.filter((p) => p.basis !== "recomputed");
  const rebuilt = points.length - live.length;
  const liveFirst = live.length ? dayNumber(live[0].day) : last + 1;
  const liveTotal = last - liveFirst + 1;
  const since = live.length ? formatDay(live[0].day, true) : "";
  const published = !live.length
    ? ""
    : live.length === liveTotal
      ? `Published every day since ${since}.`
      : `Published on ${live.length} of the ${liveTotal} days since ${since}.`;
  const earlier = rebuilt ? `${rebuilt} earlier ${rebuilt === 1 ? "day" : "days"} rebuilt, back to ${formatDay(points[0].day, true)}.` : "";
  const line =
    rebuilt === 0 && points.length === total
      ? `Published every day since ${since}. ${total} ${total === 1 ? "day" : "days"} so far.`
      : [published, earlier].filter(Boolean).join(" ");
  return `<div class="ix-ribbon"><div class="ix-days" aria-hidden="true">${cells.join("")}</div><p>${esc(line)}</p></div>`;
}

/** A small line for the list page; nothing when fewer than two days carry a value. */
export function sparklineHtml(points: IndexPoint[]): string {
  const measured = points.filter((p) => p.value !== null) as (IndexPoint & { value: number })[];
  if (measured.length < 2) return "";
  const { lo, hi } = chartDomain(measured.map((p) => p.value));
  const first = dayNumber(measured[0].day);
  const span = dayNumber(measured[measured.length - 1].day) - first || 1;
  const d = measured
    .map((p, i) => `${i ? "L" : "M"}${(((dayNumber(p.day) - first) / span) * 120).toFixed(1)} ${(36 - ((p.value - lo) / (hi - lo)) * 36).toFixed(1)}`)
    .join(" ");
  return `<svg class="ix-spark" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true"><path d="${d}" vector-effect="non-scaling-stroke"/></svg>`;
}

// ---------------------------------------------------------------------------
// Styles (page-level, like /catalog: the shared stylesheet stays the homepage's)
// ---------------------------------------------------------------------------

const STYLE = `<style>
.ix-hero { padding: 132px 0 72px; position: relative; overflow: hidden; }
.ix-hero .wrap { position: relative; z-index: 1; }
.ix-crumb { font-size: 14px; color: var(--muted); }
.ix-crumb a { color: var(--muted); text-decoration: underline; text-underline-offset: 3px; }
.ix-crumb a:hover { color: var(--text); }
.ix-hero h1 { margin-top: 18px; font-size: clamp(26px, 3.4vw, 40px); line-height: 1.1; letter-spacing: -0.035em; color: var(--text); max-width: 760px; }
.ix-figure { margin-top: 28px; display: flex; flex-wrap: wrap; align-items: flex-end; column-gap: 40px; row-gap: 16px; }
.ix-value { font-family: var(--font-display); font-weight: 300; font-size: clamp(84px, 15vw, 212px); line-height: .82; letter-spacing: -0.06em; color: var(--text); margin-left: -0.04em; white-space: nowrap; }
.ix-value-none { font-size: clamp(28px, 3.6vw, 44px); line-height: 1.15; letter-spacing: -0.03em; max-width: 620px; color: var(--text); font-weight: 300; }
.ix-side { padding-bottom: 12px; display: grid; gap: 10px; justify-items: start; }
.ix-per { font-size: clamp(18px, 1.8vw, 22px); color: var(--text); letter-spacing: -0.01em; }
.ix-when { font-size: 14px; color: var(--muted); }
.ix-badge { display: inline-flex; align-items: center; gap: 8px; padding: 5px 12px 5px 10px; border-radius: 999px; font-size: 14px; border: 1px solid var(--hair-2); background: #fff; color: var(--text); }
.ix-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted-2); }
.ix-robust .ix-dot { background: var(--good); }
.ix-signal .ix-dot { background: var(--accent); }
.ix-noise .ix-dot { background: #93b4f5; }
.ix-expected { display: inline-flex; align-items: center; padding: 5px 12px; border-radius: 999px; font-size: 14px; border: 1px solid #c7d7fb; background: #eef3fe; color: var(--accent); }
.ix-row .ix-expected { font-size: 13px; padding: 3px 10px; }
.ix-rule { font-size: 14px; color: var(--muted); max-width: 520px; }

.ix-chart-wrap { margin-top: 44px; }
.ix-chart { position: relative; margin-right: 10px; height: clamp(220px, 30vw, 360px); color: var(--accent); border-bottom: 1px solid var(--hair-2); }
.ix-chart svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; clip-path: inset(-10px 100% -10px 0); animation: ix-reveal 1.4s cubic-bezier(.2,.7,.2,1) .15s forwards; }
.ix-line { fill: none; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
.ix-grid { position: absolute; left: 0; right: 0; border-top: 1px dashed var(--hair-2); }
.ix-grid span { position: absolute; left: 0; top: -22px; font-size: 12px; color: var(--muted-2); font-variant-numeric: tabular-nums; background: rgba(255,255,255,.85); padding: 0 6px 0 0; }
.ix-pt { position: absolute; opacity: 0; animation: ix-fadein .4s ease 1.2s forwards; width: 10px; height: 10px; margin: -5px 0 0 -5px; border-radius: 50%; background: #fff; border: 2px solid var(--accent); z-index: 2; }
.ix-pt-now { width: 16px; height: 16px; margin: -8px 0 0 -8px; background: var(--accent); border: 3px solid #fff; box-shadow: 0 0 0 1px var(--accent), 0 6px 18px -4px rgba(37,99,235,.5); }
.ix-pt-now::after { content: ""; position: absolute; inset: -9px; border-radius: 50%; border: 2px solid var(--accent); opacity: 0; animation: ix-ping 2.6s ease-out 1.6s infinite; }
.ix-axis { display: flex; justify-content: space-between; margin-top: 10px; font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
.ix-chart-empty { display: flex; align-items: center; }
.ix-empty-line { width: 100%; border-top: 2px dashed var(--accent-100); }

.ix-ribbon { margin-top: 28px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; }
.ix-days { display: flex; flex-wrap: wrap; gap: 4px; }
.ix-day { width: 14px; height: 14px; border-radius: 4px; background: var(--accent-100); }
.ix-day-robust { background: var(--accent); }
.ix-day-signal { background: #6c95f0; }
.ix-day-noise { background: var(--accent-100); }
.ix-day-open { background: #fff; border: 1px solid var(--accent-100); }
.ix-day-re { opacity: .45; }
.ix-older { margin-top: 18px; max-width: 880px; }
.ix-older summary { cursor: pointer; font-size: 14px; color: var(--muted); padding: 8px 0; }
.ix-line-re { stroke-dasharray: 6 6; opacity: .6; }
.ix-basis { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 8px 24px; font-size: 14px; color: var(--muted); list-style: none; padding: 0; }
.ix-basis li { display: flex; align-items: center; gap: 8px; }
.ix-key { width: 22px; height: 0; border-top: 3px solid var(--accent); }
.ix-key-re { border-top-style: dashed; opacity: .6; }
.ix-day-missed { background: #fff; border: 1px dashed var(--hair-2); }
.ix-ribbon p { font-size: 14px; color: var(--muted); }

.ix-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0; max-width: 880px; border-top: 1px solid var(--hair); }
.ix-facts > div { padding: 22px 24px 22px 0; border-bottom: 1px solid var(--hair); }
.ix-facts dt { font-size: 14px; color: var(--muted); }
.ix-facts dd { margin-top: 6px; font-size: 18px; line-height: 1.45; color: var(--text); }
.ix-method { font-family: var(--font-display); font-size: clamp(22px, 2.4vw, 30px); line-height: 1.3; letter-spacing: -0.02em; color: var(--text); max-width: 760px; margin-bottom: 36px; }

.ix-list { display: grid; max-width: 1000px; border-top: 1px solid var(--hair); }
.ix-row { display: grid; grid-template-columns: minmax(0, 1fr) 140px minmax(150px, auto); align-items: center; gap: 24px; padding: 22px 4px; border-bottom: 1px solid var(--hair); color: var(--text); transition: background .2s; }
.ix-row:hover { background: var(--surface); }
.ix-row:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 8px; }
.ix-row-name { font-family: var(--font-display); font-size: 20px; letter-spacing: -0.02em; }
.ix-row-meta { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; font-size: 14px; color: var(--muted); }
.ix-row .ix-badge { font-size: 13px; padding: 3px 10px 3px 8px; }
.ix-row-value { text-align: right; font-family: var(--font-display); font-weight: 300; font-size: clamp(30px, 3.6vw, 44px); letter-spacing: -0.04em; white-space: nowrap; }
.ix-row-value.ix-none { font-family: var(--font-body); font-size: 14px; letter-spacing: 0; color: var(--muted); }
.ix-spark { width: 140px; height: 40px; overflow: visible; }
.ix-spark path { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.ix-sub { margin-top: 10px; font-size: 16px; color: var(--muted); max-width: 640px; }
.ix-table-wrap { overflow-x: auto; max-width: 880px; }
.ix-table { width: 100%; border-collapse: collapse; font-size: 16px; font-variant-numeric: tabular-nums; }
.ix-table th { text-align: left; font-weight: 500; font-size: 14px; color: var(--muted); padding: 0 24px 12px 0; border-bottom: 1px solid var(--hair); }
.ix-table td { padding: 14px 24px 14px 0; border-bottom: 1px solid var(--hair); color: var(--text); }
.ix-error { max-width: 680px; padding: 16px 20px; border: 1px solid var(--hair); border-radius: 14px; color: var(--text); background: #fff; }

@keyframes ix-reveal { to { clip-path: inset(-10px -10px -10px 0); } }
@keyframes ix-fadein { to { opacity: 1; } }
@keyframes ix-ping { 0% { opacity: .6; transform: scale(.6); } 100% { opacity: 0; transform: scale(1.6); } }
@media (prefers-reduced-motion: reduce) {
  .ix-chart svg { animation: none; clip-path: none; }
  .ix-pt-now::after { animation: none; }
  .ix-pt { animation: none; opacity: 1; }
}
@media (max-width: 720px) {
  .ix-hero { padding: 104px 0 48px; }
  .ix-side { padding-bottom: 0; }
  .ix-facts { grid-template-columns: 1fr; }
  .ix-row { grid-template-columns: minmax(0, 1fr) auto; }
  .ix-row-spark { display: none; }
}
</style>`;

function withStyle(html: string): string {
  return html.replace("</head>", `${STYLE}\n</head>`);
}

// ---------------------------------------------------------------------------
// One index
// ---------------------------------------------------------------------------

/** What a lighter dot means, in the service's own sentences; nothing when no day was rebuilt. */
export function basisLegendHtml(points: IndexPoint[], rule: BasisRule | undefined): string {
  if (!rule || !points.some((p) => p.basis === "recomputed")) return "";
  return `<ul class="ix-basis">
<li><span class="ix-key" aria-hidden="true"></span>${esc(rule.recorded)}</li>
<li><span class="ix-key ix-key-re" aria-hidden="true"></span>${esc(rule.recomputed)}</li>
</ul>`;
}

/**
 * Every recorded day as a plain table, newest first: the chart's numbers in text, so a
 * search engine or an agent quoting the index reads the series, not only today's value.
 */
export function historyTableHtml(points: IndexPoint[], unit: IndexUnit, valuePer: string): string {
  if (points.length === 0) return "";
  const row = (p: IndexPoint) =>
        `<tr><td>${esc(formatDay(p.day, true))}</td><td>${p.value !== null ? esc(valueText(p.value, unit, p)) : "Not stated"}</td><td>${esc(STATUS_LABEL[p.status])}</td><td>${p.basis === "recomputed" ? "Rebuilt later" : "Recorded live"}</td></tr>`;
  const head = (label: string) =>
    `<thead><tr><th scope="col">Day</th><th scope="col">${esc(label)}</th><th scope="col">Status</th><th scope="col">Source</th></tr></thead>`;
  // The newest month in view; older days fold away, still in the HTML for crawlers.
  const newest = [...points].reverse();
  const recent = newest.slice(0, 30);
  const older = newest.slice(30);
  return `<section class="framed" id="history">
  <div class="wrap">
    <div class="section-head"><h2>Every day so far</h2></div>
    <div class="ix-table-wrap"><table class="ix-table">
${head(`Value (${valuePer})`)}
<tbody>${recent.map(row).join("")}</tbody>
</table></div>
    ${older.length ? `<details class="ix-older"><summary>${older.length} earlier ${older.length === 1 ? "day" : "days"}</summary><div class="ix-table-wrap"><table class="ix-table">${head(`Value (${valuePer})`)}<tbody>${older.map(row).join("")}</tbody></table></div></details>` : ""}
  </div>
</section>`;
}

function otherIndexes(list: IndexList | null, slug: string): string {
  if (!list) return "";
  const rows = list.indexes.filter((i) => i.slug !== slug);
  if (rows.length === 0) return "";
  return `<section class="framed" id="more">
  <div class="wrap">
    <div class="section-head"><h2>Every index we publish</h2></div>
    ${listHtml(rows, new Map())}
  </div>
</section>`;
}

/** `detail` null = the read failed: the page says so instead of drawing nothing. */
export function renderIndexPage(slug: string, detail: IndexDetail | null, list: IndexList | null): string {
  if (!detail) {
    return withStyle(
      shell({
        title: "Our indexes | distribute.you",
        description: "Our cold email numbers, published every day.",
        path: `/indexes/${slug}`,
        jsonLd: [],
        body: `<section class="ix-hero"><div class="hero-glow" aria-hidden="true"></div><div class="wrap">
<p class="ix-crumb"><a href="/indexes">All indexes</a></p>
<h1>This index could not be read just now.</h1>
<p class="ix-rule" style="margin-top:16px">Reload the page in a minute, or read every index as JSON at <a href="https://api.distribute.you/v1/public/indexes">api.distribute.you/v1/public/indexes</a>.</p>
</div></section>
${otherIndexes(list, slug)}`,
      }),
    );
  }
  const { index: i, points, statusRule } = detail;
  const value = i.value !== null ? valueText(i.value, i.unit, i) : null;
  const shown = i.value !== null ? formatIndexValue(i.value, i.unit) : null;
  const description =
    value !== null
      ? `${i.name}: ${value} ${i.valuePer} today. ${i.method}`
      : `${i.name}, published every day. ${i.method}`;
  const figure =
    value !== null
      ? `<div class="ix-figure">
  <div class="ix-value" data-motion="count-up">${esc(shown ?? "")}</div>
  <div class="ix-side">
    <div class="ix-per">${esc(i.valuePer)}</div>
    ${expectedTag(i)}${badge(i.status)}
    ${i.day ? `<div class="ix-when">Recorded ${esc(formatDay(i.day, true))}</div>` : ""}
  </div>
</div>`
      : `<div class="ix-figure">
  <p class="ix-value-none">${esc(unavailableLine(i.unavailableReason))}</p>
</div>`;

  const body = `<section class="ix-hero">
  <div class="wrap">
    <p class="ix-crumb"><a href="/indexes">Indexes</a> / ${esc(i.channelName)}</p>
    <h1>${esc(i.name)}</h1>
    <p class="ix-sub">A cold email benchmark from our live campaigns, recorded every day.</p>
    ${figure}
    ${chartHtml(points, i.unit, i.name)}
    ${basisLegendHtml(points, detail.basisRule)}
    ${ribbonHtml(points)}
  </div>
</section>
<section class="framed tint" id="measures">
  <div class="wrap">
    <div class="section-head"><h2>What it measures</h2></div>
    <p class="ix-method">${esc(i.method)}</p>
    <dl class="ix-facts">
      <div><dt>Status</dt><dd>${esc(statusLine(i.status, statusRule))}</dd></div>
      <div><dt>Last recorded</dt><dd>${i.day ? esc(formatDay(i.day, true)) : "Not recorded yet."}</dd></div>
    </dl>
  </div>
</section>
${historyTableHtml(points, i.unit, i.valuePer)}
<section class="framed" id="why">
  <div class="wrap">
    <div class="section-head"><h2>Why we publish it</h2></div>
    <div class="doc" data-motion="reveal" data-motion-stagger>
      <p>Anyone can quote a good number once. We record ours every day and keep every day on this page, early ones included.</p>
      <p>Each value carries a status, so you know how far to lean on it. The same series is public as JSON at <a href="https://api.distribute.you/v1/public/indexes/${esc(i.slug)}">api.distribute.you/v1/public/indexes/${esc(i.slug)}</a>.</p>
    </div>
  </div>
</section>
${otherIndexes(list, i.slug)}`;

  return withStyle(
    shell({
      title: value !== null ? `${i.name}: ${value} ${i.valuePer} | Cold email benchmark` : `${i.name} | Cold email benchmark`,
      description,
      path: `/indexes/${i.slug}`,
      body,
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "Dataset",
          name: i.name,
          description: `${i.method} Recorded every day.`,
          url: `${SITE}/indexes/${i.slug}`,
          keywords: ["cold email", "cold email benchmark", i.name, i.valuePer],
          creator: { "@type": "Organization", name: "distribute.you", url: SITE },
          publisher: { "@type": "Organization", name: "distribute.you", url: SITE },
          isAccessibleForFree: true,
          includedInDataCatalog: { "@type": "DataCatalog", name: "distribute.you indexes", url: `${SITE}/indexes` },
          measurementTechnique: i.method,
          ...(points.length
            ? {
                temporalCoverage: `${points[0].day}/${points[points.length - 1].day}`,
                datePublished: (points.find((p) => p.basis !== "recomputed") ?? points[0]).day,
                dateModified: points[points.length - 1].day,
              }
            : {}),
          variableMeasured: {
            "@type": "PropertyValue",
            name: i.name,
            description: isExpected(i) ? `${i.valuePer}, expected` : i.valuePer,
            unitText: UNIT_TEXT[i.unit],
            ...(i.value !== null ? { value: i.value } : {}),
          },
          distribution: {
            "@type": "DataDownload",
            encodingFormat: "application/json",
            contentUrl: `https://api.distribute.you/v1/public/indexes/${i.slug}`,
          },
        },
        breadcrumb([
          { name: "distribute.you", path: "/" },
          { name: "Indexes", path: "/indexes" },
          { name: i.name, path: `/indexes/${i.slug}` },
        ]),
      ],
    }),
  );
}

// ---------------------------------------------------------------------------
// The list
// ---------------------------------------------------------------------------

function listHtml(indexes: IndexSummary[], series: Map<string, IndexPoint[]>): string {
  const rows = indexes
    .map((i) => {
      const value =
        i.value !== null
          ? `<div class="ix-row-value">${esc(formatIndexValue(i.value, i.unit))}</div>`
          : `<div class="ix-row-value ix-none">Not available today</div>`;
      return `<a class="ix-row" href="/indexes/${i.slug}">
  <div>
    <div class="ix-row-name">${esc(i.name)}</div>
    <div class="ix-row-meta"><span>${esc(i.valuePer)}</span>${expectedTag(i)}${badge(i.status)}</div>
  </div>
  <div class="ix-row-spark">${sparklineHtml(series.get(i.slug) ?? [])}</div>
  ${value}
</a>`;
    })
    .join("\n");
  return `<div class="ix-list">${rows}</div>`;
}

/** `list` null = the read failed. `series` carries each index's days for its sparkline. */
export function renderIndexListPage(list: IndexList | null, series: Map<string, IndexPoint[]>): string {
  const content = list
    ? `${listHtml(list.indexes, series)}
<p class="ix-rule" style="margin-top:20px">${esc(statusLegend(list.statusRule))}</p>`
    : `<div class="ix-error" role="alert">The indexes could not be read just now. Reload the page in a minute, or read them as JSON at <a href="https://api.distribute.you/v1/public/indexes">api.distribute.you/v1/public/indexes</a>.</div>`;
  const body = `<section class="ix-hero">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap">
    <h1 style="font-size:clamp(38px,5.2vw,64px);letter-spacing:-0.05em">Our numbers, published every day</h1>
    <p class="hero-sub" style="margin-top:20px;max-width:640px">Each index is one number from our cold email campaigns, recorded every day and kept on its own page. Each value says how far you can lean on it.</p>
    ${whyLine()}
  </div>
</section>
<section class="framed" id="indexes">
  <div class="wrap">
    ${content}
  </div>
</section>`;
  return withStyle(
    shell({
      title: "Indexes: our cold email numbers, every day | distribute.you",
      description: "What a click, a positive reply and a meeting cost on our cold email campaigns today, recorded every day.",
      path: "/indexes",
      body,
      jsonLd: [
        {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "distribute.you indexes",
          url: `${SITE}/indexes`,
          ...(list
            ? {
                hasPart: list.indexes.map((i) => ({ "@type": "Dataset", name: i.name, url: `${SITE}/indexes/${i.slug}` })),
              }
            : {}),
        },
        breadcrumb([
          { name: "distribute.you", path: "/" },
          { name: "Indexes", path: "/indexes" },
        ]),
      ],
    }),
  );
}
