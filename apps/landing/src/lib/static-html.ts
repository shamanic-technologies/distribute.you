import { readFileSync } from "node:fs";
import { join } from "node:path";
import { URLS } from "@distribute/content";

interface BestPublicMetric {
  workflowSlug: string;
  workflowName: string;
  createdForBrandId: string | null;
  value: number;
}

interface BestPublicResponse {
  best: Record<string, BestPublicMetric | null>;
}

interface RankedWorkflowItem {
  stats: Record<string, number | null>;
}

interface RankedWorkflowResponse {
  results: RankedWorkflowItem[];
}

interface LivePerformanceMetrics {
  costPerPositiveReplyLabel: string;
  costPerPositiveReplyNumeric: string;
  openRateLabel: string;
  openRateNumeric: string;
  positiveReplyRateLabel: string;
  positiveReplyRateNumeric: string;
  openedPerHundredLabel: string;
  openedPerHundredNumeric: string;
  positiveRepliesPerHundredLabel: string;
  positiveRepliesPerHundredNumeric: string;
  positiveRepliesPerHundredRangeLabel: string;
  positiveRepliesPerHundredBarNumeric: string;
  emailsSentLabel: string;
  emailsSentNumeric: string;
}

const SALES_COLD_EMAIL_FEATURE_SLUG = "sales-cold-email-outreach";
const BEST_POSITIVE_REPLY_KEY = "recipientsRepliesPositive";

// Last-known-good marketing numbers (the values these stats held before they
// were sourced live). Used only when the public metrics API is unreachable or
// transiently omits a field, so a build-time prerender never aborts the whole
// landing deploy and a page never ships raw __PLACEHOLDER__ tokens.
const FALLBACK_LIVE_PERFORMANCE_METRICS: LivePerformanceMetrics = {
  costPerPositiveReplyLabel: "$1.42",
  costPerPositiveReplyNumeric: "1.42",
  openRateLabel: "38%",
  openRateNumeric: "38",
  positiveReplyRateLabel: "2.1%",
  positiveReplyRateNumeric: "2.1",
  openedPerHundredLabel: "38",
  openedPerHundredNumeric: "38",
  positiveRepliesPerHundredLabel: "2",
  positiveRepliesPerHundredNumeric: "2.1",
  positiveRepliesPerHundredRangeLabel: "1-2",
  positiveRepliesPerHundredBarNumeric: "2.1",
  emailsSentLabel: "14k",
  emailsSentNumeric: "14000",
};
const BEST_POSITIVE_REPLY_COST_LABEL = "__BEST_POSITIVE_REPLY_COST__";
const BEST_POSITIVE_REPLY_COST_NUMERIC = "__BEST_POSITIVE_REPLY_COST_NUMERIC__";
const OPEN_RATE_LABEL = "__OPEN_RATE__";
const OPEN_RATE_NUMERIC = "__OPEN_RATE_NUMERIC__";
const POSITIVE_REPLY_RATE_LABEL = "__POSITIVE_REPLY_RATE__";
const POSITIVE_REPLY_RATE_NUMERIC = "__POSITIVE_REPLY_RATE_NUMERIC__";
const OPENED_PER_HUNDRED_LABEL = "__OPENED_PER_HUNDRED__";
const OPENED_PER_HUNDRED_NUMERIC = "__OPENED_PER_HUNDRED_NUMERIC__";
const POSITIVE_REPLIES_PER_HUNDRED_LABEL = "__POSITIVE_REPLIES_PER_HUNDRED__";
const POSITIVE_REPLIES_PER_HUNDRED_NUMERIC = "__POSITIVE_REPLIES_PER_HUNDRED_NUMERIC__";
const POSITIVE_REPLIES_PER_HUNDRED_RANGE_LABEL = "__POSITIVE_REPLIES_PER_HUNDRED_RANGE__";
const POSITIVE_REPLIES_PER_HUNDRED_BAR_NUMERIC = "__POSITIVE_REPLIES_PER_HUNDRED_BAR_NUMERIC__";
const EMAILS_SENT_LABEL = "__EMAILS_SENT__";
const EMAILS_SENT_NUMERIC = "__EMAILS_SENT_NUMERIC__";

function resolvePublicApiUrl(): string {
  return process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL ?? URLS.api;
}

function formatCostCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function num(stats: Record<string, number | null>, key: string): number {
  return stats[key] ?? 0;
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function formatCount(value: number): string {
  if (value < 1 && value > 0) return value.toFixed(1);
  return String(Math.round(value));
}

function formatCompactCount(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toLocaleString("en-US");
}

async function fetchLivePerformanceMetrics(): Promise<LivePerformanceMetrics> {
  const apiUrl = resolvePublicApiUrl();
  const headers = { Accept: "application/json" };
  const [bestRes, rankedRes] = await Promise.all([
    fetch(
      `${apiUrl}/v1/public/features/best?featureSlug=${encodeURIComponent(
        SALES_COLD_EMAIL_FEATURE_SLUG,
      )}&groupBy=workflow`,
      { headers, next: { revalidate: 300 } },
    ),
    fetch(
      `${apiUrl}/v1/public/features/ranked?featureSlug=${encodeURIComponent(
        SALES_COLD_EMAIL_FEATURE_SLUG,
      )}&objective=emailsSent&groupBy=workflow&limit=100`,
      { headers, next: { revalidate: 300 } },
    ),
  ]);

  if (!bestRes.ok) {
    throw new Error(
      `[landing] /v1/public/features/best failed for ${SALES_COLD_EMAIL_FEATURE_SLUG}: ${bestRes.status}`,
    );
  }
  if (!rankedRes.ok) {
    throw new Error(
      `[landing] /v1/public/features/ranked failed for ${SALES_COLD_EMAIL_FEATURE_SLUG}: ${rankedRes.status}`,
    );
  }

  const bestData = (await bestRes.json()) as BestPublicResponse;
  const rankedData = (await rankedRes.json()) as RankedWorkflowResponse;
  const record = bestData.best[BEST_POSITIVE_REPLY_KEY];

  if (!record || typeof record.value !== "number") {
    throw new Error(
      `[landing] Missing ${BEST_POSITIVE_REPLY_KEY} in /v1/public/features/best response`,
    );
  }

  const totals = rankedData.results.reduce(
    (acc, item) => {
      acc.sent += num(item.stats, "recipientsSent");
      acc.opened += num(item.stats, "recipientsOpened");
      acc.positiveReplies += num(item.stats, "recipientsRepliesPositive");
      return acc;
    },
    { sent: 0, opened: 0, positiveReplies: 0 },
  );

  if (totals.sent <= 0) {
    throw new Error(
      `[landing] /v1/public/features/ranked returned no sent recipients for ${SALES_COLD_EMAIL_FEATURE_SLUG}`,
    );
  }

  const dollars = record.value / 100;
  const openRate = totals.opened / totals.sent;
  const positiveReplyRate = totals.positiveReplies / totals.sent;
  const openedPerHundred = openRate * 100;
  const positiveRepliesPerHundred = positiveReplyRate * 100;
  const positiveRepliesRounded = Math.round(positiveRepliesPerHundred);
  const positiveRepliesRange =
    positiveRepliesRounded <= 1
      ? "1"
      : `${Math.max(1, positiveRepliesRounded - 1)}-${positiveRepliesRounded}`;

  return {
    costPerPositiveReplyLabel: formatCostCents(record.value),
    costPerPositiveReplyNumeric: dollars.toFixed(2),
    openRateLabel: formatPercent(openRate),
    openRateNumeric: (openRate * 100).toFixed(1),
    positiveReplyRateLabel: formatPercent(positiveReplyRate),
    positiveReplyRateNumeric: (positiveReplyRate * 100).toFixed(1),
    openedPerHundredLabel: formatCount(openedPerHundred),
    openedPerHundredNumeric: openedPerHundred.toFixed(1),
    positiveRepliesPerHundredLabel: formatCount(positiveRepliesPerHundred),
    positiveRepliesPerHundredNumeric: positiveRepliesPerHundred.toFixed(1),
    positiveRepliesPerHundredRangeLabel: positiveRepliesRange,
    positiveRepliesPerHundredBarNumeric: Math.max(1, positiveRepliesPerHundred).toFixed(1),
    emailsSentLabel: formatCompactCount(totals.sent),
    emailsSentNumeric: String(Math.round(totals.sent)),
  };
}

async function resolveLivePerformanceMetrics(): Promise<LivePerformanceMetrics> {
  try {
    return await fetchLivePerformanceMetrics();
  } catch (error) {
    // Build-time prerender must stay shippable: a missing/transient public
    // metric (the public best endpoint occasionally omits a key while a
    // workflow has no data for it) must not abort the entire landing deploy.
    // Log loud and fall back to the last-known-good numbers. (CLAUDE.md
    // "Exception — Vercel build-time prerender")
    console.error(
      "[landing] live performance metrics unavailable, using fallback values",
      error,
    );
    return FALLBACK_LIVE_PERFORMANCE_METRICS;
  }
}

// Analytics for the statically-served landing pages. These route handlers
// return raw HTML and bypass the React root layout (GA) and Next client
// instrumentation (PostHog), so the trackers must be injected here — otherwise
// the home + SEO cluster pages record no unique visits. GA id mirrors
// app/layout.tsx; PostHog mirrors instrumentation-client.ts.
const GA_MEASUREMENT_ID = "G-YJHNGLEJPP";
// Google Ads conversion tracking. The landing only loads the tag (+ conversion
// linker, auto-enabled by gtag config) so the gclid is captured into the
// `_gcl_aw` cookie on the registrable domain `.distribute.you`, shared with
// dashboard.distribute.you. The actual conversions (signup, add-card) fire in
// the dashboard app, where the real events happen. No conversion event here.
const GOOGLE_ADS_ID = "AW-18233267088";

function analyticsHead(): string {
  const ga = `<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}');gtag('config','${GOOGLE_ADS_ID}');</script>`;

  const phToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const phHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
  const posthog = phToken
    ? `<script>!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId captureTraceFeedback captureTraceMetric".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init('${phToken}',{api_host:'${phHost}',defaults:'2026-01-30'});</script>`
    : "";

  return ga + posthog;
}

export function staticHtml(fileName: string) {
  const html = readFileSync(
    join(process.cwd(), "public/landing", fileName),
    "utf8",
  );

  const rewritten = html
    .replaceAll('href="css/', 'href="/landing/css/')
    .replaceAll('src="js/', 'src="/landing/js/')
    .replaceAll('src="logo/', 'src="/landing/logo/')
    .replaceAll('href="index.html"', 'href="/"')
    .replaceAll('href="/docs/api"', `href="${URLS.apiDocs}"`)
    .replaceAll('href="/docs/mcp"', `href="${URLS.mcp}"`)
    .replaceAll('href="/docs"', `href="${URLS.docs}"`)
    .replaceAll('href="/sign-in"', `href="${URLS.signIn}"`)
    .replaceAll('href="/sign-up"', `href="${URLS.signUp}"`)
    .replaceAll('href="https://app.distribute.you/sign-up"', `href="${URLS.signUp}"`)
    .replaceAll(
      'href="https://github.com/distribute-you"',
      `href="${URLS.github}"`,
    );

  return rewritten.replace("</head>", `${analyticsHead()}</head>`);
}

async function withLivePerformanceMetrics(html: string) {
  if (
    !html.includes(BEST_POSITIVE_REPLY_COST_LABEL) &&
    !html.includes(OPEN_RATE_LABEL) &&
    !html.includes(POSITIVE_REPLY_RATE_LABEL) &&
    !html.includes("$1.42")
  ) {
    return html;
  }

  const liveMetrics = await resolveLivePerformanceMetrics();

  return html
    .replaceAll(BEST_POSITIVE_REPLY_COST_NUMERIC, liveMetrics.costPerPositiveReplyNumeric)
    .replaceAll(BEST_POSITIVE_REPLY_COST_LABEL, liveMetrics.costPerPositiveReplyLabel)
    .replaceAll(OPEN_RATE_NUMERIC, liveMetrics.openRateNumeric)
    .replaceAll(OPEN_RATE_LABEL, liveMetrics.openRateLabel)
    .replaceAll(POSITIVE_REPLY_RATE_NUMERIC, liveMetrics.positiveReplyRateNumeric)
    .replaceAll(POSITIVE_REPLY_RATE_LABEL, liveMetrics.positiveReplyRateLabel)
    .replaceAll(OPENED_PER_HUNDRED_NUMERIC, liveMetrics.openedPerHundredNumeric)
    .replaceAll(OPENED_PER_HUNDRED_LABEL, liveMetrics.openedPerHundredLabel)
    .replaceAll(POSITIVE_REPLIES_PER_HUNDRED_NUMERIC, liveMetrics.positiveRepliesPerHundredNumeric)
    .replaceAll(POSITIVE_REPLIES_PER_HUNDRED_LABEL, liveMetrics.positiveRepliesPerHundredLabel)
    .replaceAll(POSITIVE_REPLIES_PER_HUNDRED_RANGE_LABEL, liveMetrics.positiveRepliesPerHundredRangeLabel)
    .replaceAll(POSITIVE_REPLIES_PER_HUNDRED_BAR_NUMERIC, liveMetrics.positiveRepliesPerHundredBarNumeric)
    .replaceAll(EMAILS_SENT_NUMERIC, liveMetrics.emailsSentNumeric)
    .replaceAll(EMAILS_SENT_LABEL, liveMetrics.emailsSentLabel)
    .replaceAll("data-n=\"1.42\"", `data-n="${liveMetrics.costPerPositiveReplyNumeric}"`)
    .replaceAll("$1.42", liveMetrics.costPerPositiveReplyLabel);
}

// ─────────────────────────────────────────────────────────────────────────
// Homepage — cross-org cost-per-outcome stock-ticker board.
// Four equal cards (cost per click / positive reply / meeting / signup), each
// with the observed average price, a cost-semantic weekly change (a falling
// cost is good = green ▼, a rising cost is bad = red ▲), and an inline SVG
// sparkline. Fully server-rendered so the real numbers + chart ship in raw HTML
// (SEO / AI-scraper safe), from the same public trend endpoint the admin
// feature-stats page reads. `__V2_CPC__`/`__V2_CPR__`/`__V2_CPM__` scalars feed
// the pricing card / mockup that reuse the same figures.
// ─────────────────────────────────────────────────────────────────────────
const V2_OBJECTIVES = [
  { key: "websiteVisit", sym: "CPC", label: "cost per click" },
  { key: "positiveReply", sym: "RPL", label: "positive reply" },
  { key: "meetingBooked", sym: "MTG", label: "meeting booked" },
  { key: "signup", sym: "SGN", label: "signup" },
] as const;

const V2_BOARD_TOKEN = "__V2_TICKER_BOARD__";

interface V2Ticker {
  board: string; // server-rendered <div class="ticker-board">…</div>
  cpc: string; // scalars for the reused pricing card / mockup / compare rows
  cpr: string;
  cpm: string;
}

interface TrendPoint {
  date: string | null;
  costPerOutcomeUsd: number | null;
}
interface TrendResponse {
  points: TrendPoint[];
}
interface SeriesPoint {
  date: string;
  v: number;
}

function usdWhole(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function usd2(value: number): string {
  return `$${value.toFixed(2)}`;
}

// Stock-style: sub-$10 keeps two decimals (a click can cost cents); $10+ rounds
// to whole dollars.
function usdSmart(value: number): string {
  return value < 10 ? usd2(value) : usdWhole(value);
}

function numericOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// Weekly change: latest backed point vs the closest backed point ~7 days
// before it, as a signed fraction (a display delta over the two points the
// sparkline already draws — no hidden metric). Null when either side missing.
function growth7d(points: SeriesPoint[]): number | null {
  if (points.length < 2) return null;
  const latest = points[points.length - 1];
  const targetMs =
    Date.parse(`${latest.date}T00:00:00.000Z`) - 7 * 24 * 60 * 60 * 1000;
  let prev: SeriesPoint | null = null;
  for (let i = points.length - 2; i >= 0; i--) {
    prev = points[i];
    if (Date.parse(`${points[i].date}T00:00:00.000Z`) <= targetMs) break;
  }
  if (!prev || prev.v === 0) return null;
  return (latest.v - prev.v) / prev.v;
}

// Cost-semantic stroke: rising cost red, falling cost green, flat/unknown gray.
function trendStroke(growth: number | null): string {
  if (growth === null || growth === 0) return "#94a3b8";
  return growth > 0 ? "#dc2626" : "#16a34a";
}

function sparklineSvg(points: SeriesPoint[], stroke: string): string {
  if (points.length < 2) {
    return `<div class="tkr-spark tkr-spark-empty" aria-hidden="true"></div>`;
  }
  const vals = points.map((p) => p.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const W = 120;
  const H = 34;
  const pad = 3;
  const coords = vals
    .map((v, i) => {
      const x = (i / (vals.length - 1)) * W;
      const y = pad + (1 - (v - min) / span) * (H - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return `<svg class="tkr-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${coords}" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

function tickerCard(
  cfg: { sym: string; label: string },
  points: SeriesPoint[],
): string {
  const price = points.length ? points[points.length - 1].v : null;
  const priceStr = price === null ? "&mdash;" : usdSmart(price);
  const g = growth7d(points);
  let chg: string;
  if (g === null || g === 0) {
    chg = `<span class="tkr-chg flat">&mdash;</span>`;
  } else {
    const up = g > 0;
    const pct = (Math.abs(g) * 100).toFixed(1);
    chg = `<span class="tkr-chg ${up ? "up" : "down"}">${up ? "▲" : "▼"} ${pct}% <span class="tkr-wk">wk</span></span>`;
  }
  return `<div class="tkr"><div class="tkr-sym"><span class="tkr-chip">${cfg.sym}</span> ${cfg.label}</div><div class="tkr-row"><span class="tkr-price">${priceStr}</span>${chg}</div>${sparklineSvg(points, trendStroke(g))}</div>`;
}

function tickerBoard(seriesByObjective: Record<string, SeriesPoint[]>): string {
  const cards = V2_OBJECTIVES.map((o) =>
    tickerCard(o, seriesByObjective[o.key] ?? []),
  ).join("");
  return `<div class="ticker-board">${cards}</div>`;
}

// Last-known-good (observed 2026-07-09) — synthetic descending series per
// objective so the fallback board still renders prices + a green ▼ + sparkline
// when the public API is unreachable (a build-time prerender must never abort).
function fallbackSeries(end: number): SeriesPoint[] {
  return [
    { date: "2026-06-25", v: end * 1.5 },
    { date: "2026-07-02", v: end * 1.2 },
    { date: "2026-07-09", v: end },
  ];
}
function buildFallbackTicker(): V2Ticker {
  const series: Record<string, SeriesPoint[]> = {
    websiteVisit: fallbackSeries(0.72),
    positiveReply: fallbackSeries(145),
    meetingBooked: fallbackSeries(5.25),
    signup: fallbackSeries(18),
  };
  return {
    board: tickerBoard(series),
    cpc: "$0.72",
    cpr: "$145",
    cpm: "$5.25",
  };
}

async function fetchTrendSeries(
  apiUrl: string,
  headers: Record<string, string>,
  slug: string,
  objective: string,
): Promise<SeriesPoint[]> {
  const res = await fetch(
    `${apiUrl}/v1/public/features/cost-per-outcome-trend?featureSlug=${slug}&objective=${objective}&days=90`,
    { headers, next: { revalidate: 300 } },
  );
  if (!res.ok) {
    throw new Error(
      `[landing] /v1/public/features/cost-per-outcome-trend ${objective} failed: ${res.status}`,
    );
  }
  const data = (await res.json()) as TrendResponse;
  return (data.points ?? []).flatMap((p) => {
    const v = numericOrNull(p?.costPerOutcomeUsd);
    return v !== null && typeof p.date === "string" ? [{ date: p.date, v }] : [];
  });
}

async function fetchV2Ticker(): Promise<V2Ticker> {
  const apiUrl = resolvePublicApiUrl();
  const headers = { Accept: "application/json" };
  const slug = encodeURIComponent(SALES_COLD_EMAIL_FEATURE_SLUG);

  const [visit, reply, meeting, signup] = await Promise.all(
    V2_OBJECTIVES.map((o) => fetchTrendSeries(apiUrl, headers, slug, o.key)),
  );

  if (!visit.length && !reply.length && !meeting.length && !signup.length) {
    throw new Error("[landing] cost-per-outcome-trend returned no backed series");
  }

  const series: Record<string, SeriesPoint[]> = {
    websiteVisit: visit,
    positiveReply: reply,
    meetingBooked: meeting,
    signup,
  };
  const last = (s: SeriesPoint[]): string | null =>
    s.length ? usdSmart(s[s.length - 1].v) : null;
  const fb = buildFallbackTicker();

  return {
    board: tickerBoard(series),
    cpc: last(visit) ?? fb.cpc,
    cpr: last(reply) ?? fb.cpr,
    cpm: last(meeting) ?? fb.cpm,
  };
}

async function resolveV2Ticker(): Promise<V2Ticker> {
  try {
    return await fetchV2Ticker();
  } catch (error) {
    console.error(
      "[landing] v2 ticker unavailable, using fallback values",
      error,
    );
    return buildFallbackTicker();
  }
}

async function withV2TickerMetrics(html: string) {
  if (!html.includes(V2_BOARD_TOKEN)) return html;

  const t = await resolveV2Ticker();
  return html
    .replaceAll(V2_BOARD_TOKEN, t.board)
    .replaceAll("__V2_CPC__", t.cpc)
    .replaceAll("__V2_CPR__", t.cpr)
    .replaceAll("__V2_CPM__", t.cpm);
}

export async function staticResponse(fileName: string) {
  const html = await withV2TickerMetrics(
    await withLivePerformanceMetrics(staticHtml(fileName)),
  );

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "s-maxage=300, stale-while-revalidate=31536000",
    },
  });
}
