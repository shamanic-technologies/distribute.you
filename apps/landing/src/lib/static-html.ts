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
  positiveReplyRateLabel: string;
  positiveReplyRateNumeric: string;
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
  positiveReplyRateLabel: "2.1%",
  positiveReplyRateNumeric: "2.1",
  positiveRepliesPerHundredLabel: "2",
  positiveRepliesPerHundredNumeric: "2.1",
  positiveRepliesPerHundredRangeLabel: "1-2",
  positiveRepliesPerHundredBarNumeric: "2.1",
  emailsSentLabel: "14k",
  emailsSentNumeric: "14000",
};
const BEST_POSITIVE_REPLY_COST_LABEL = "__BEST_POSITIVE_REPLY_COST__";
const BEST_POSITIVE_REPLY_COST_NUMERIC = "__BEST_POSITIVE_REPLY_COST_NUMERIC__";
const POSITIVE_REPLY_RATE_LABEL = "__POSITIVE_REPLY_RATE__";
const POSITIVE_REPLY_RATE_NUMERIC = "__POSITIVE_REPLY_RATE_NUMERIC__";
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
      acc.positiveReplies += num(item.stats, "recipientsRepliesPositive");
      return acc;
    },
    { sent: 0, positiveReplies: 0 },
  );

  if (totals.sent <= 0) {
    throw new Error(
      `[landing] /v1/public/features/ranked returned no sent recipients for ${SALES_COLD_EMAIL_FEATURE_SLUG}`,
    );
  }

  const dollars = record.value / 100;
  const positiveReplyRate = totals.positiveReplies / totals.sent;
  const positiveRepliesPerHundred = positiveReplyRate * 100;
  const positiveRepliesRounded = Math.round(positiveRepliesPerHundred);
  const positiveRepliesRange =
    positiveRepliesRounded <= 1
      ? "1"
      : `${Math.max(1, positiveRepliesRounded - 1)}-${positiveRepliesRounded}`;

  return {
    costPerPositiveReplyLabel: formatCostCents(record.value),
    costPerPositiveReplyNumeric: dollars.toFixed(2),
    positiveReplyRateLabel: formatPercent(positiveReplyRate),
    positiveReplyRateNumeric: (positiveReplyRate * 100).toFixed(1),
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

  // Partnero affiliate tracking + cross-subdomain via-forward.
  return ga + posthog + partneroHead();
}

// Partnero affiliate program `KHV3KEHI`. Two parts:
//  (1) PartneroJS loader — records the referral click + keeps the partner key
//      in the `partnero_partner` cookie on the landing domain as the visitor
//      browses (survives internal landing navigation).
//  (2) via-forward — the signup happens on dashboard.distribute.you (a
//      DIFFERENT subdomain), and Partnero has no cross-subdomain cookie, so we
//      carry the partner key across by appending `?via=<key>` to every
//      dashboard-bound link at click time. The dashboard persists it + registers
//      the customer server-to-server (see apps/dashboard PartneroViaCapture +
//      /api/partnero/customer). Delegated capture-phase listener → also covers
//      the nav/footer links injected later by components.js.
function partneroHead(): string {
  const loader = `<script>(function(p,t,n,e,r,o){p['__partnerObject']=r;function f(){var c={a:arguments,q:[]};var r=this.push(c);return "number"!=typeof r?r:f.bind(c.q);}f.q=f.q||[];p[r]=p[r]||f.bind(f.q);p[r].q=p[r].q||f.q;o=t.createElement(n);var _=t.getElementsByTagName(n)[0];o.async=1;o.src=e+'?v'+(~~(new Date().getTime()/1e6));_.parentNode.insertBefore(o,_);})(window,document,'script','https://app.partnero.com/js/universal.js','po');po('settings','assets_host','https://assets.partnero.com');po('program','KHV3KEHI','load');</script>`;

  const forward = `<script>(function(){function k(){var m=location.search.match(/[?&]via=([^&]+)/);if(m)return decodeURIComponent(m[1]);var c=document.cookie.match(/(?:^|; )partnero_partner=([^;]+)/);return c?decodeURIComponent(c[1]):null;}document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a[href*="dashboard.distribute.you"]'):null;if(!a)return;var v=k();if(!v)return;try{var u=new URL(a.href);if(!u.searchParams.get('via')){u.searchParams.set('via',v);a.href=u.href;}}catch(err){}},true);})();</script>`;

  return loader + forward;
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

  // Favicon: the statically-served HTML bypasses Next's file-convention
  // <head> machinery, so the green icon.svg / apple-icon are never linked and
  // the browser's default /favicon.ico request 404s (no favicon shows). Inject
  // the links here so every static page carries the charter favicon.
  const faviconHead =
    '<link rel="icon" href="/icon.svg" type="image/svg+xml">' +
    '<link rel="apple-touch-icon" href="/apple-icon.png">';

  return rewritten.replace("</head>", `${faviconHead}${analyticsHead()}</head>`);
}

async function withLivePerformanceMetrics(html: string) {
  if (
    !html.includes(BEST_POSITIVE_REPLY_COST_LABEL) &&
    !html.includes(POSITIVE_REPLY_RATE_LABEL) &&
    !html.includes("$1.42")
  ) {
    return html;
  }

  const liveMetrics = await resolveLivePerformanceMetrics();

  return html
    .replaceAll(BEST_POSITIVE_REPLY_COST_NUMERIC, liveMetrics.costPerPositiveReplyNumeric)
    .replaceAll(BEST_POSITIVE_REPLY_COST_LABEL, liveMetrics.costPerPositiveReplyLabel)
    .replaceAll(POSITIVE_REPLY_RATE_NUMERIC, liveMetrics.positiveReplyRateNumeric)
    .replaceAll(POSITIVE_REPLY_RATE_LABEL, liveMetrics.positiveReplyRateLabel)
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
// with the observed average price, an always-green ▲ weekly change (the board is
// a marketing surface — demand framing, never a red down-signal — so the change
// badge + sparkline render green/positive regardless of sign), and an inline SVG
// sparkline. Fully server-rendered so the real numbers + chart ship in raw HTML
// (SEO / AI-scraper safe), from the same public trend endpoint the admin
// feature-stats page reads. `__TICKER_CPC__`/`__TICKER_CPR__`/`__TICKER_CPM__` scalars feed
// the pricing card / mockup that reuse the same figures.
// ─────────────────────────────────────────────────────────────────────────
// `measuredByUs`: website visits (clicks) + positive replies are OBSERVED by
// distribute (email-gateway tracking); meetings + signups are client-reported
// (derived from each brand's conversion, not measured by us) — surfaced as a
// per-card source tag + a legend under the board.
const TICKER_OBJECTIVES = [
  // Headline metrics, in order: (1) positive reply for a sales meeting, then
  // (2) website visits — the two vedette outcomes; signup is tertiary.
  { key: "positiveReply", sym: "POS", label: "Positive reply for a sales meeting", unit: "per positive reply for a sales meeting", measuredByUs: true, slug: "positive-replies" },
  { key: "websiteVisit", sym: "WEB", label: "Website visits", unit: "per website visit", measuredByUs: true, slug: "website-visits" },
  // meetingBooked is beta-gated out of the public board; the __TICKER_CPM__
  // scalar (legacy /v0 homepage) is still computed from a separate fetch below.
  { key: "signup", sym: "SIG", label: "Signup", unit: "per signup", measuredByUs: false, slug: "signups" },
] as const;

const BOARD_TOKEN = "__TICKER_BOARD__";

interface TickerMetrics {
  board: string; // server-rendered <div class="ticker-board">…</div> (index-agency /v0)
  heroPos: string; // compact non-clickable hero proof-rail stat: positive reply
  heroWeb: string; // compact non-clickable hero proof-rail stat: website visits
  cpc: string; // scalars for the reused pricing card / mockup / compare rows
  cpr: string;
  cpm: string;
  bestPos: string; // best-model scalars for the homepage "Cost per outcome" snapshot
  bestWeb: string;
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

// Always-green stroke — the board never shows a red down-signal (marketing
// surface, positive demand framing regardless of the underlying sign).
const TREND_GREEN = "#16a34a";
function trendStroke(): string {
  return TREND_GREEN;
}

function sparklineSvg(
  points: SeriesPoint[],
  stroke: string,
  cls = "tkr-spark",
): string {
  if (points.length < 2) {
    return `<div class="${cls} tkr-spark-empty" aria-hidden="true"></div>`;
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
  return `<svg class="${cls}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${coords}" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

// Compact NON-CLICKABLE hero proof-rail stat (positive reply / website visits):
// price + green ▲ growth + micro sparkline + label. No link, no detail page —
// the homepage board section was removed; these two live below the hero.
//
// The headline PRICE is the BEST cross-org workflow's cost per outcome (the
// model we deploy to new clients by default), passed as `bestModelUsd` — NOT a
// pooled/trend average. The sparkline + weekly ▲ still ride the observed trend
// series as a demand-direction decoration.
function heroStatCard(
  cfg: { label: string; unit: string },
  points: SeriesPoint[],
  bestModelUsd: number | null,
): string {
  const priceStr = bestModelUsd === null ? "&mdash;" : usdSmart(bestModelUsd);
  const g = growth7d(points);
  let chg = "";
  if (g !== null && g !== 0) {
    const pct = (Math.abs(g) * 100).toFixed(1);
    chg = `<span class="tkr-chg" style="color:${TREND_GREEN}">▲ ${pct}% <span class="tkr-wk">wk</span></span>`;
  }
  const spark = sparklineSvg(points, trendStroke(), "prs-spark");
  // Big white lead reads as a full phrase ("$200 per positive reply for a sales
  // meeting"), the price emphasised; the grey note clarifies it's our best
  // model = the cheapest cross-org workflow that actually delivers the outcome.
  return `<div class="proof-rail-item proof-rail-stat"><div class="prs-top"><span class="prs-lead"><span class="prs-price">${priceStr}</span> ${cfg.unit}</span>${chg}</div>${spark}<small class="prs-note">Our best model · cheapest workflow that delivers it</small></div>`;
}

function tickerCard(
  cfg: { sym: string; label: string; measuredByUs: boolean; slug: string },
  points: SeriesPoint[],
): string {
  const price = points.length ? points[points.length - 1].v : null;
  const priceStr = price === null ? "&mdash;" : usdSmart(price);
  const g = growth7d(points);
  let chg: string;
  if (g === null || g === 0) {
    chg = `<span class="tkr-chg flat">&mdash;</span>`;
  } else {
    // Always a green ▲ positive change — never a red down-signal (inline color
    // so it holds on every page regardless of that page's .tkr-chg.up/.down CSS).
    const pct = (Math.abs(g) * 100).toFixed(1);
    chg = `<span class="tkr-chg" style="color:${TREND_GREEN}">▲ ${pct}% <span class="tkr-wk">wk</span></span>`;
  }
  const src = cfg.measuredByUs
    ? `<span class="tkr-src tkr-src-us">measured by us</span>`
    : `<span class="tkr-src tkr-src-client">client-reported</span>`;
  return `<div class="tkr"><div class="tkr-sym"><span class="tkr-chip">${cfg.sym}</span> ${cfg.label}</div><div class="tkr-row"><span class="tkr-price">${priceStr}</span>${chg}</div>${sparklineSvg(points, trendStroke())}${src}</div>`;
}

function tickerBoard(seriesByObjective: Record<string, SeriesPoint[]>): string {
  const cards = TICKER_OBJECTIVES.map((o) =>
    tickerCard(o, seriesByObjective[o.key] ?? []),
  ).join("");
  return `<div class="ticker-board">${cards}</div>`;
}

// Last-known-good (observed 2026-07-10) — synthetic descending series per
// objective so the fallback board still renders prices + a green ▲ + sparkline
// when the public API is unreachable (a build-time prerender must never abort).
function fallbackSeries(end: number): SeriesPoint[] {
  return [
    { date: "2026-06-25", v: end * 1.5 },
    { date: "2026-07-02", v: end * 1.2 },
    { date: "2026-07-09", v: end },
  ];
}
// Last-known-good BEST-model cost per outcome (observed 2026-07-17) — the hero
// numbers fall back to these when the workflow-cost-per-outcome endpoint is
// unreachable, so a cold/slow API still ships real-shaped best-model prices.
const FALLBACK_BEST = { positiveReply: 108, websiteVisit: 0.62 } as const;

function buildFallbackTicker(): TickerMetrics {
  const series: Record<string, SeriesPoint[]> = {
    websiteVisit: fallbackSeries(0.88),
    positiveReply: fallbackSeries(151),
    signup: fallbackSeries(22),
  };
  return {
    board: tickerBoard(series),
    heroPos: heroStatCard(TICKER_OBJECTIVES[0], series.positiveReply, FALLBACK_BEST.positiveReply),
    heroWeb: heroStatCard(TICKER_OBJECTIVES[1], series.websiteVisit, FALLBACK_BEST.websiteVisit),
    cpc: "$0.88",
    cpr: "$151",
    cpm: "$5.68",
    bestPos: usdSmart(FALLBACK_BEST.positiveReply),
    bestWeb: usdSmart(FALLBACK_BEST.websiteVisit),
  };
}

// Best cross-org workflow cost for an objective = the cheapest workflow whose
// OBJECTIVE outcome was actually observed > 0. We filter on the observed COUNT,
// never a cost threshold: a 0-outcome "husk" workflow (spent money, produced
// nothing) must never be crowned "best", and its cost can drop to its own spend
// on the backend — only observed-count filtering is correct. Bounded 8s so a
// slow cold endpoint can't blow the homepage prerender budget (throws → the
// caller falls back to last-known-good).
async function fetchBestModelUsd(
  apiUrl: string,
  headers: Record<string, string>,
  slug: string,
  objective: string,
): Promise<number | null> {
  const res = await fetch(
    `${apiUrl}/v1/public/features/workflow-cost-per-outcome?featureSlug=${slug}&objective=${objective}`,
    { headers, next: { revalidate: 300 }, signal: AbortSignal.timeout(8_000) },
  );
  if (!res.ok) {
    throw new Error(
      `[landing] /v1/public/features/workflow-cost-per-outcome ${objective} failed: ${res.status}`,
    );
  }
  const data = (await res.json()) as {
    workflows?: Array<{
      observedClicks?: number | null;
      observedPositiveReplies?: number | null;
      costPerOutcomeUsd?: number | null;
    }>;
  };
  const observed = (w: {
    observedClicks?: number | null;
    observedPositiveReplies?: number | null;
  }): number =>
    (numericOrNull(
      objective === "websiteVisit" ? w.observedClicks : w.observedPositiveReplies,
    ) ?? 0);
  const priced = (data.workflows ?? [])
    .filter((w) => observed(w) > 0)
    .flatMap((w) => {
      const v = numericOrNull(w.costPerOutcomeUsd);
      return v !== null ? [v] : [];
    });
  return priced.length ? Math.min(...priced) : null;
}

async function fetchTicker(): Promise<TickerMetrics> {
  const apiUrl = resolvePublicApiUrl();
  const headers = { Accept: "application/json" };
  const slug = encodeURIComponent(SALES_COLD_EMAIL_FEATURE_SLUG);

  // Every number here is the BEST single-model cost per outcome, cross-org — the
  // MIN over per-workflow ratios (fetchBestModelUsd), NEVER a cross-workflow
  // pooled average. The pooled `cost-per-outcome-trend` series is eradicated.
  const [bestReply, bestVisit, bestSignup, bestMeeting] = await Promise.all([
    fetchBestModelUsd(apiUrl, headers, slug, "positiveReply").catch(() => null),
    fetchBestModelUsd(apiUrl, headers, slug, "websiteVisit").catch(() => null),
    fetchBestModelUsd(apiUrl, headers, slug, "signup").catch(() => null),
    fetchBestModelUsd(apiUrl, headers, slug, "meetingBooked").catch(() => null),
  ]);

  if (bestReply === null && bestVisit === null && bestSignup === null) {
    throw new Error("[landing] workflow-cost-per-outcome returned no best model");
  }

  const fb = buildFallbackTicker();
  const reply = bestReply ?? FALLBACK_BEST.positiveReply;
  const visit = bestVisit ?? FALLBACK_BEST.websiteVisit;
  const signup = bestSignup ?? 22;
  // Sparkline shape = a deterministic best-shaped curve ending on the best-model
  // price (real per-day best-model points land once the non-pooled best-model
  // dated-trend endpoint ships). Board is /v0-only; the live scalars below are
  // the best-model numbers.
  const series: Record<string, SeriesPoint[]> = {
    positiveReply: fallbackSeries(reply),
    websiteVisit: fallbackSeries(visit),
    signup: fallbackSeries(signup),
  };

  return {
    board: tickerBoard(series),
    heroPos: heroStatCard(TICKER_OBJECTIVES[0], series.positiveReply, reply),
    heroWeb: heroStatCard(TICKER_OBJECTIVES[1], series.websiteVisit, visit),
    cpc: bestVisit !== null ? usdSmart(bestVisit) : fb.cpc,
    cpr: bestReply !== null ? usdSmart(bestReply) : fb.cpr,
    cpm: bestMeeting !== null ? usdSmart(bestMeeting) : fb.cpm,
    bestPos: bestReply !== null ? usdSmart(bestReply) : fb.bestPos,
    bestWeb: bestVisit !== null ? usdSmart(bestVisit) : fb.bestWeb,
  };
}

async function resolveTicker(): Promise<TickerMetrics> {
  try {
    return await fetchTicker();
  } catch (error) {
    console.error(
      "[landing] ticker unavailable, using fallback values",
      error,
    );
    return buildFallbackTicker();
  }
}

async function withTickerMetrics(html: string) {
  // Fire on the ticker board OR any of the live cost-per-outcome scalars, so
  // scalar-only pages (e.g. /pricing, which has no board) still get real rates.
  const needsMetrics =
    html.includes(BOARD_TOKEN) ||
    html.includes("__HERO_POS__") ||
    html.includes("__HERO_WEB__") ||
    html.includes("__TICKER_CPC__") ||
    html.includes("__TICKER_CPR__") ||
    html.includes("__TICKER_CPM__") ||
    html.includes("__BEST_POS__") ||
    html.includes("__BEST_WEB__");
  if (!needsMetrics) return html;

  const t = await resolveTicker();
  return html
    .replaceAll(BOARD_TOKEN, t.board)
    .replaceAll("__HERO_POS__", t.heroPos)
    .replaceAll("__HERO_WEB__", t.heroWeb)
    .replaceAll("__TICKER_CPC__", t.cpc)
    .replaceAll("__TICKER_CPR__", t.cpr)
    .replaceAll("__TICKER_CPM__", t.cpm)
    .replaceAll("__BEST_POS__", t.bestPos)
    .replaceAll("__BEST_WEB__", t.bestWeb);
}

// Homepage live cost-of-acquisition chart — SSR "boot" payload so the chart +
// numbers paint on FIRST byte (no client-fetch delay). The client reads
// window.__CAC_BOOT__ to render instantly, then refetches live to refresh.
// NOTE: distinct from the client global `window.__CAC_BOOT__`. A bare
// `__CAC_BOOT__` placeholder collided with the reader's `window.__CAC_BOOT__`
// reference under replaceAll — it rewrote the reader to
// `var boot=window.<script>…</script>` (SyntaxError → chart never rendered).
const CAC_BOOT_TOKEN = "__CAC_BOOT_SLOT__";

// Deterministic best-model CAC timeline, baked into the boot payload. This IS
// the chart series (there is no live per-day series — the pooled
// cost-per-outcome-trend was eradicated; a non-pooled best-model dated trend
// will replace this once it ships). Without a series the chart div renders EMPTY
// (client guard clears it on a zero-length series). The landing does not have to
// be live — it has to be instant and never blank. Ends at `end` (the
// resolved price, live or fallback) so the sparkline agrees with the headline
// number. Weekly points over ~6 months, smooth decline + a tiny fixed wiggle.
function fallbackCacSeries(end: number): SeriesPoint[] {
  const WEEKS = 26;
  const anchor = Date.UTC(2026, 6, 9); // 2026-07-09, matches the ticker fallback tail
  const week = 7 * 24 * 60 * 60 * 1000;
  const out: SeriesPoint[] = [];
  for (let i = WEEKS - 1; i >= 0; i--) {
    const date = new Date(anchor - i * week).toISOString().slice(0, 10);
    const progress = (WEEKS - 1 - i) / (WEEKS - 1); // 0 (oldest) -> 1 (latest)
    const trend = 1.9 - 0.9 * progress; // ~1.9x down to 1x
    const wiggle = 1 + 0.05 * Math.sin(i * 1.3);
    out.push({ date, v: Math.round(end * trend * wiggle * 100) / 100 });
  }
  return out;
}

async function resolveCacBoot(): Promise<string> {
  const apiUrl = resolvePublicApiUrl();
  const headers = { Accept: "application/json" };
  const slug = encodeURIComponent(SALES_COLD_EMAIL_FEATURE_SLUG);
  let best: number | null = FALLBACK_BEST.positiveReply;
  // BEST-model cost per positive reply, cross-org, single best workflow — the
  // MIN over per-workflow ratios, NEVER a cross-workflow pooled average
  // (`cost-per-outcome-trend` was that pooled series and is eradicated here).
  const b = await fetchBestModelUsd(
    apiUrl,
    headers,
    slug,
    "positiveReply",
  ).catch((error) => {
    console.error("[landing] cac boot best-model unavailable, using fallback", error);
    return null;
  });
  if (b !== null) best = b;
  // The series is the best-model timeline: a deterministic best-shaped curve
  // ending on the best-model price. Swap in real per-day points once a
  // best-model dated-trend endpoint (per-workflow, non-pooled) ships.
  const points = fallbackCacSeries(best ?? FALLBACK_BEST.positiveReply);
  return `<script>window.__CAC_BOOT__=${JSON.stringify({ best, points })}</script>`;
}

async function withCacBoot(html: string) {
  if (!html.includes(CAC_BOOT_TOKEN)) return html;
  return html.replaceAll(CAC_BOOT_TOKEN, await resolveCacBoot());
}

export async function staticResponse(fileName: string) {
  const html = await withCacBoot(
    await withTickerMetrics(
      await withLivePerformanceMetrics(staticHtml(fileName)),
    ),
  );

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "s-maxage=300, stale-while-revalidate=31536000",
    },
  });
}
