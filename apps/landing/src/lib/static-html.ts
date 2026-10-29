import { readFileSync } from "node:fs";
import { join } from "node:path";
import { URLS } from "@distribute/content";
import {
  HTML_CONTENT_TYPE,
  MARKDOWN_CONTENT_TYPE,
  VARY_HEADER,
  negotiateContentType,
  notAcceptableBody,
} from "@/lib/content-negotiation";
import { htmlToMarkdown } from "@/lib/html-to-markdown";
import { FIRST_TOUCH_CAPTURE_SCRIPT } from "@/lib/first-touch-script";
import { SUBSCRIBER_LINK_CAPTURE_SCRIPT } from "@/lib/subscriber-link";
import { BEFORE_SEND_JS } from "@/lib/posthog-before-send";
import { HEADLESS_SCANNER_JS } from "@/lib/posthog-replay";
import { SITE_URL, organizationJsonLd } from "@/lib/seo";
import { formatReturnMultiple } from "@/lib/landing-format";
import { reseedFounderCount } from "@/lib/founder-count";
import { INDEX_LINKS_TOKEN, fetchIndexDetail, fetchIndexList, indexLinksHtml, isExpected, type IndexDetail } from "@/lib/fleet-indexes";
import {
  renderProofSelection,
  renderShowcaseSelection,
  reseedProofCards,
  reseedShowcaseCards,
  pickedBrands,
  type ShowcaseOutcomes,
} from "@/lib/showcase-outcomes";
import { hasHeroOutcome } from "@/lib/showcase-cards";

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
  // Same exception capture as the React surfaces (instrumentation-client.ts), and the
  // same release tag, so a crash on a static page lands in PostHog too. Same replay
  // skip for email-link scanners (lib/posthog-replay.ts).
  const release = process.env.NEXT_PUBLIC_RELEASE;
  const phRelease = release ? `;posthog.register({release:${JSON.stringify(release)}})` : "";
  const posthog = phToken
    ? `<script>!function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId captureTraceFeedback captureTraceMetric".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);posthog.init('${phToken}',{api_host:'${phHost}',defaults:'2026-01-30',capture_exceptions:{capture_unhandled_errors:true,capture_unhandled_rejections:true,capture_console_errors:false},before_send:${BEFORE_SEND_JS},disable_session_recording:${HEADLESS_SCANNER_JS}})${phRelease};</script>`
    : "";

  // Ahrefs Web Analytics — first-party page-view + traffic tracking (data-key
  // = the distribute.you Ahrefs project). Mirrors app/layout.tsx. `crossorigin`: Ahrefs
  // serves CORS (`ACAO: *`), so its errors reach PostHog with file and line instead of
  // an opaque "Script error." (lib/posthog-before-send.ts lists every vendor).
  const ahrefs = `<script src="https://analytics.ahrefs.com/analytics.js" data-key="6jqRRazbkHBZRDiWAmampA" crossorigin="anonymous" async></script>`;

  // Partnero affiliate tracking + cross-subdomain via-forward, then the customer
  // referral code on the same journey.
  // First touch: which channel brought this visitor, recorded once on the
  // registrable domain for the dashboard to hand over at org creation.
  const firstTouch = `<script>${FIRST_TOUCH_CAPTURE_SCRIPT}</script>`;
  // A newsletter link's opaque `dy_sub` id: parked for the visit on `.distribute.you`
  // (so /get-started still carries it), stripped from the address bar, handed to our
  // server, which tells PostHog who this reader is (lib/subscriber-link.ts).
  const subscriberLink = `<script>${SUBSCRIBER_LINK_CAPTURE_SCRIPT}</script>`;
  return firstTouch + subscriberLink + ga + posthog + ahrefs + partneroHead() + inviteHead();
}

/**
 * Customer referral code (`?invite=CODE`) carried across to the dashboard.
 *
 * Distinct from Partnero above: that is the AFFILIATE program (partners, paid
 * commission); this is a CUSTOMER inviting another customer, where both sides
 * earn $500 in free credits once the invitee's payments unlock theirs. The two
 * ride the same road for the same reason and neither replaces the other, so a
 * link can legitimately carry both parameters.
 *
 * Two parts, mirroring the Partnero pair:
 *  (1) remember — park the code in a first-party cookie on the LANDING domain, so
 *      a visitor who arrives on `distribute.you?invite=X`, reads the pricing page,
 *      and only then clicks Sign up still carries it. Without this the code
 *      survives exactly one page view.
 *  (2) forward — the signup happens on `dashboard.distribute.you`, a DIFFERENT
 *      subdomain no landing cookie reaches, so the code is appended to every
 *      dashboard-bound link at click time. The dashboard stores it and claims it
 *      once an org exists (see apps/dashboard InviteCapture + InviteClaimer).
 *
 * Exported as a string so the React landing layout renders the SAME source
 * instead of keeping a second copy that drifts.
 *
 * No banner: a referred visitor sees the ordinary page (owner 2026-10-06).
 */
export const INVITE_FORWARD_SCRIPT = `(function(){var N='distribute_invite';function ok(v){return !!v&&v.length<=128&&/^[A-Za-z0-9._~-]+$/.test(v);}function read(){var m=location.search.match(/[?&]invite=([^&]+)/);if(m){try{var d=decodeURIComponent(m[1]);if(ok(d))return d;}catch(e){}}var c=document.cookie.match(new RegExp('(?:^|; )'+N+'=([^;]*)'));if(c){try{var v=decodeURIComponent(c[1]);if(ok(v))return v;}catch(e){}}return null;}var code=read();if(code){document.cookie=N+'='+encodeURIComponent(code)+'; path=/; max-age=7776000; SameSite=Lax';}document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a[href*="dashboard.distribute.you"]'):null;if(!a)return;var v=read();if(!v)return;try{var u=new URL(a.href);if(!u.searchParams.get('invite')){u.searchParams.set('invite',v);a.href=u.href;}}catch(err){}},true);})();`;

function inviteHead(): string {
  return `<script>${INVITE_FORWARD_SCRIPT}</script>`;
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
  return decorateHtml(html);
}

/**
 * Everything a served document gets on top of its own bytes: the path rewrites, the
 * charter favicon, the analytics head and the one Organization JSON-LD. Shared by the
 * hand-written pages under `public/landing` and the pages rendered from a catalogue
 * (`compare-page.ts`), so a rendered page is indistinguishable from a static one.
 */
export function decorateHtml(html: string) {
  const rewritten = html
    .replaceAll('href="css/', 'href="/landing/css/')
    .replaceAll('src="js/', 'src="/landing/js/')
    .replaceAll('src="logo/', 'src="/landing/logo/')
    .replaceAll('href="index.html"', 'href="/"')
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

  const withHead = rewritten.replace(
    "</head>",
    `${faviconHead}${analyticsHead()}</head>`,
  );

  return withCanonicalOrganization(withHead);
}

const LD_JSON_BLOCK = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

/**
 * Every statically-served page states the same company, from the one helper the
 * React tree already renders (`organizationJsonLd`). Several of these documents
 * carried a hand-written Organization node inside their own `@graph`, which is
 * how the static and React surfaces came to describe the company differently
 * (the hand-written copies carry no address and no description, and the
 * homepage carried none at all). Those nodes are removed and replaced with the
 * shared one, so there is exactly one Organization per page and one source for
 * what it says.
 *
 * A block that does not parse is left ALONE rather than dropped: an unparseable
 * script is a bug to fix at its source, and deleting structured data because we
 * could not read it is strictly worse than leaving it.
 */
function withCanonicalOrganization(html: string): string {
  const stripped = html.replace(LD_JSON_BLOCK, (match, json: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (err) {
      console.error("[landing] unparseable ld+json block left untouched", err);
      return match;
    }

    const node = parsed as Record<string, unknown>;
    const graph = node["@graph"];
    if (Array.isArray(graph)) {
      const kept = graph.filter(
        (entry) => (entry as Record<string, unknown>)?.["@type"] !== "Organization",
      );
      if (kept.length === graph.length) return match;
      if (kept.length === 0) return "";
      return `<script type="application/ld+json">${JSON.stringify({
        ...node,
        "@graph": kept,
      })}</script>`;
    }

    if (node["@type"] === "Organization") return "";
    return match;
  });

  return stripped.replace(
    "</head>",
    `<script type="application/ld+json">${JSON.stringify(
      organizationJsonLd(),
    )}</script></head>`,
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Homepage hero — the fleet's engaged-lead proof row.
//
// An "engaged lead" is a person who acted on our outreach: a positive reply OR a
// visit to the brand's site. Named "engaged", not "hot": a site visit is an
// Engaged step in the lead vocabulary, and Hot means someone who wants to buy. Both are first steps of a sales funnel, so the sum
// is the count of people the fleet actually put in front of a customer.
//
// All figures describe ONE set of brands (at least one engaged lead AND recorded
// spend), as the engaged-lead index states it: price = index value, count and
// companies = its inputs. `distribute.you` is in the fleet on purpose: we ran the
// product on ourselves.

function resolvePublicApiUrl(): string {
  const base = process.env.API_SERVICE_URL || URLS.api;
  return base.replace(/\/$/, "");
}

const HOT_LEAD_ROW_TOKEN = "__HOT_LEAD_ROW__";
const STEP_MEETING_COST_TOKEN = "__STEP_MEETING_COST__";
const STEP_RETURN_TOKEN = "__STEP_RETURN__";
// The comparison cluster states the SAME two figures as a full dark band (compare-page.ts).
// One token for the whole section, so an unmeasurable fleet drops the band rather than
// leaving a heading over nothing.
const HOT_LEAD_BAND_TOKEN = "__HOT_LEAD_BAND__";

// The hero row and the comparison band state two of the public fleet indexes
// (owner 2026-10-19: the engaged-lead price "la valeur qu'on donne en haut de la hero"
// and "le ROI median de nos clients" are indexes). Read from the index, never recomputed
// here, so the homepage and /indexes/<slug> can never quote two numbers for one figure.
// features-service owns the population, the 2-client floor and the $100 spend floor.
export const ENGAGED_LEAD_INDEX_SLUG = "cold-email-cost-per-engaged-lead";
export const ROI_INDEX_SLUG = "cold-email-roi";
// Owner 2026-10-19: the hero's price is what a booked meeting costs, read off the meeting
// index (« $457 <- real number from the research »), no longer the engaged-lead price.
// The index is our best workflow's figure, not a median, so the label says neither.
export const MEETING_INDEX_SLUG = "cold-email-cost-per-meeting";

export interface HotLeadStats {
  hotLeads: number;
  companies: number;
  medianCostUsd: number;
}

/** The fleet's median return on spend, as the ROI index states it today. */
export interface FleetReturnStats {
  medianReturnPerDollar: number;
  brandCount: number;
}

function latestInputs(detail: IndexDetail): Record<string, unknown> {
  const point = detail.points.find((p) => p.day === detail.index.day) ?? detail.points[detail.points.length - 1];
  return ((point as { inputs?: Record<string, unknown> } | undefined)?.inputs ?? {}) as Record<string, unknown>;
}

function positive(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

/**
 * The engaged-lead index as the hero states it, or null when it cannot be stated:
 * no value today, or the counts behind it missing (logged, the row is dropped).
 */
export function hotLeadStatsFromIndex(detail: IndexDetail | null): HotLeadStats | null {
  if (!detail || detail.index.value === null) return null;
  const inputs = latestInputs(detail);
  if (!positive(inputs.engagedLeads) || !positive(inputs.clients) || !positive(detail.index.value)) {
    console.error(`[landing] ${ENGAGED_LEAD_INDEX_SLUG} has no usable inputs`, JSON.stringify(inputs));
    return null;
  }
  return { hotLeads: inputs.engagedLeads, companies: inputs.clients, medianCostUsd: detail.index.value };
}

/**
 * The meeting index as the hero states it; null drops the price stat alone.
 * A point the producer flags as a FLOOR (`inputs.floor: "yes"`: ledger coverage short or
 * days still being computed) is a lower bound, not a price: it once read $0.013 and the
 * hero printed "$0 cost per booked meeting" (2026-10-25). Dropped, and logged.
 */
export function meetingCostFromIndex(detail: IndexDetail | null): number | null {
  if (!detail || !positive(detail.index.value)) return null;
  // The floor flag describes the LEDGER reading; an expected value is not that reading.
  if (isExpected(detail.index)) return detail.index.value;
  const inputs = latestInputs(detail);
  if (inputs.floor === "yes") {
    console.error(`[landing] ${MEETING_INDEX_SLUG} is a floor today, meeting price not stated`, JSON.stringify(inputs));
    return null;
  }
  return detail.index.value;
}

/**
 * Whether the meeting price the hero states is the producer's EXPECTED price (owner
 * 2026-10-25: shown labelled while the ledger is rebuilt). Every surface printing the
 * price says so; an absent `valueKind` is a measured price, no label.
 */
export function meetingCostIsExpected(detail: IndexDetail | null): boolean {
  return isExpected(detail?.index);
}

/** The ROI index as the hero states it; null drops the third stat alone. */
export function fleetReturnFromIndex(detail: IndexDetail | null): FleetReturnStats | null {
  if (!detail || !positive(detail.index.value)) return null;
  const clients = latestInputs(detail).clients;
  return { medianReturnPerDollar: detail.index.value, brandCount: positive(clients) ? clients : detail.index.outcomes };
}

// The landing renders while a build waits on it, so every live read is bounded and
// drops its figure rather than holding the page.
const FLEET_READ_TIMEOUT_MS = 8_000;

/**
 * The row's markup. It lives here rather than in the HTML because each figure must
 * DISAPPEAR when it cannot be read — a hardcoded fallback would state numbers nobody
 * measured, and "we could not measure this" is not "zero".
 *
 * Owner 2026-10-21: the engaged-lead count left the hero row; it states the meeting
 * price and the return only (the comparison band still carries the count). Neither
 * figure read = no row at all, never an empty strip.
 */
export function hotLeadRowHtml(
  meetingCostUsd: number | null,
  fleetReturn: FleetReturnStats | null = null,
  meetingCostExpected = false,
): string {
  const cost = meetingCostUsd === null ? null : formatMeetingCost(meetingCostUsd);
  const returnFigure = fleetReturn ? formatReturnMultiple(fleetReturn.medianReturnPerDollar) : null;
  if (!cost && !returnFigure) return "";
  return (
    '<div class="hero-stats">' +
    (cost
      ? '<span class="hstat">' +
        `<span class="hstat-n"><b>${cost}</b></span>` +
        `<span class="hstat-l">${meetingCostExpected ? "expected cost per booked meeting" : "cost per booked meeting"}</span></span>`
      : "") +
    (returnFigure
      ? '<span class="hstat">' +
        `<span class="hstat-n"><b>${returnFigure.text}x</b></span>` +
        '<span class="hstat-l">median ROI reported</span></span>'
      : "") +
    "</div>"
  );
}

// Whole dollars: this is a headline price, and cents on a figure that moves with
// every outcome read as precision we do not have.
function formatMeetingCost(usd: number): string {
  return `$${Math.round(usd).toLocaleString("en-US")}`;
}

/**
 * Step 03 of "How it works" prices a meeting and states a return with the SAME
 * figures the hero states (owner 2026-10-21), so the page never quotes two prices
 * for one meeting. No read = that tile drops; its neighbours stay.
 */
export function stepMeetingCostHtml(meetingCostUsd: number | null, expected = false): string {
  if (meetingCostUsd === null) return "";
  // The "from" price is an illustrative trend, kept on purpose by the owner
  // (2026-10-21): the live price over the ratio the mock shipped with ($600 from $740).
  const from = formatMeetingCost(meetingCostUsd * STEP_FROM_RATIO);
  return stepTileHtml(expected ? "Expected cost / meeting" : "Cost / meeting booked", formatMeetingCost(meetingCostUsd), `↓ from ${from}`);
}

const STEP_FROM_RATIO = 740 / 600;

export function stepReturnHtml(fleetReturn: FleetReturnStats | null): string {
  if (!fleetReturn) return "";
  return stepTileHtml("ROI", `${formatReturnMultiple(fleetReturn.medianReturnPerDollar).text}x`);
}

function stepTileHtml(label: string, value: string, note = "measured"): string {
  return `<div class="control"><div class="k">${label}</div><div class="v">${value}</div><span class="ok">${note}</span></div>`;
}

/**
 * A return multiple reads with one decimal under 10x and whole from 10x up — `3.7x` is
 * a different answer from `2.9x`, `41x` and `42x` are not, and a decimal there is
 * precision we do not have on a figure that moves with every outcome. Same shape as the
 * dashboard's own ROI formatter, so a client meets one convention in both places.
 */
/**
 * The dark stat band the comparison pages close on: the hero row's two figures, plus
 * the fleet's median return when features-service can state one.
 *
 * The hot-lead pair rides the SAME `HotLeadStats` the homepage hero states, so a compare
 * page and the homepage cannot describe two different fleets. The return is a separate
 * read and therefore a separate argument: it is `null` whenever the producer says the
 * figure is unmeasurable or the read failed, and then the band renders exactly as it did
 * before — two figures, never a third slot holding a dash.
 *
 * The numerals ride `data-count` (+ `data-decimals` for the return) so main.js counts
 * them up like the homepage's own band. `stats two` centres a 2-up band; a 3-up one is
 * the base `.stats` grid, which already collapses to one column at 960px.
 */
export function hotLeadBandHtml(
  stats: HotLeadStats,
  fleetReturn: FleetReturnStats | null = null,
  meetingCostUsd: number | null = null,
  meetingCostExpected = false,
): string {
  const companies = stats.companies.toLocaleString("en-US");
  const returnFigure = fleetReturn ? formatReturnMultiple(fleetReturn.medianReturnPerDollar) : null;
  const statCount = 1 + (meetingCostUsd === null ? 0 : 1) + (returnFigure ? 1 : 0);
  return (
    '<section class="framed dark">' +
    '<div class="wrap">' +
    '<div class="section-head center"><span class="eyebrow">Measured, not quoted</span>' +
    "<h2>What the fleet has produced, read off every campaign we run</h2>" +
    "<p>An engaged lead is a buyer who replied with interest or came to the site. No competitor on this page publishes this figure.</p></div>" +
    `<div class="stats${statCount === 3 ? "" : " two"}">` +
    `<div class="stat rv"><div class="n"><span data-count="${stats.hotLeads}">0</span></div><div class="l">engaged leads for ${companies} companies</div></div>` +
    (meetingCostUsd === null
      ? ""
      : `<div class="stat rv"><div class="n"><span class="u">$</span><span data-count="${Math.round(meetingCostUsd)}">0</span></div><div class="l">${meetingCostExpected ? "expected cost per booked meeting" : "cost per booked meeting"}</div></div>`) +
    (returnFigure
      ? `<div class="stat rv"><div class="n"><span data-count="${returnFigure.text}" data-decimals="${returnFigure.decimals}">0</span><span class="u">x</span></div><div class="l">median ROI of our clients</div></div>`
      : "") +
    "</div></div></section>"
  );
}

/**
 * The named clients' outcome counts, read at render.
 *
 * Through the gateway rather than the producer directly: features-service's CORS
 * allowlist still names a retired brand's domains, and the gateway is the one public
 * surface this landing talks to. Bounded like every other build-time read here — a
 * cold endpoint must never hold the prerender.
 */
async function fetchShowcaseOutcomes(): Promise<ShowcaseOutcomes | null> {
  const apiUrl = resolvePublicApiUrl();
  const res = await fetch(`${apiUrl}/v1/public/features/showcase-outcomes`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(FLEET_READ_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`[landing] /v1/public/features/showcase-outcomes failed: ${res.status}`);
  }
  const data = (await res.json()) as ShowcaseOutcomes;
  if (!Array.isArray(data?.brands) || data.brands.length === 0) return null;
  for (const brand of data.brands) {
    if (!brand.measured) {
      console.warn(
        `[landing] showcase outcomes not measurable for ${brand?.brand?.domain ?? "an unnamed brand"} (${brand.unmeasuredReason ?? "no reason given"}), keeping the shipped figures`,
      );
    }
  }
  return data;
}

/**
 * Reseed the homepage's showcase cards, leaving the page untouched when it carries
 * none and when the read fails.
 *
 * A failed read keeps the figures the page ships with — the last read we know landed
 * — because blanking a client's card, or standing a zero in for a number nobody told
 * us, is worse than showing a figure a few hours old. It is logged loud either way.
 */
async function withShowcaseOutcomes(html: string): Promise<string> {
  // The homepage states the same clients' counts on TWO surfaces — the live cards in
  // the hero and the named proof cards further down — so both ride ONE read. A second
  // fetch would be a second answer, and the page would be free to state two different
  // contacted counts for one client on one screen (it did, until #3976 fixed only the
  // first of them).
  const wanted = html.includes('data-brand="') || html.includes("data-proof-brand=");
  if (!wanted) return html;
  try {
    const data = await fetchShowcaseOutcomes();
    if (!data) return html;
    // The producer PICKS which clients the page names — the most recently begun ones carrying an
    // outcome for the hero, the highest-returning ones for the proof section. Each group answers its
    // own question and carries its own verdict, so they are read INDEPENDENTLY: in production today
    // the return group is measured over ten qualifying clients while the recent one answers
    // `no_qualifying_clients`, and holding one back for the other would ship the podium as dead code.
    //
    // A group the producer declined to answer leaves ITS section on the three clients the page ships
    // with, reseeded — which is what this page did before the pick existed. Nothing here ranks,
    // floors or divides; the only decision on this side is where each of the top three sits.
    const recent = pickedBrands(data.groups?.recentlyStarted, "recentlyStarted", hasHeroOutcome);
    const topReturn = pickedBrands(data.groups?.highestReturn, "highestReturn");
    let out = html;
    if (recent) out = renderShowcaseSelection(out, recent);
    if (topReturn) out = renderProofSelection(out, topReturn);
    // Whatever the pick did not cover keeps its shipped clients and has their figures refreshed.
    if (!recent) out = reseedShowcaseCards(out, data);
    if (!topReturn) out = reseedProofCards(out, data);
    return out;
  } catch (error) {
    console.error("[landing] showcase outcome counts unavailable, keeping the shipped figures", error);
    return html;
  }
}

/**
 * How many people have signed up, as client-service counts them.
 *
 * A different read from every other live figure on this page — the fleet reads answer
 * for campaigns, this one answers for the platform — and the cheapest one here: it is
 * the same public endpoint `/investors` already prints, no auth, no org scope, one
 * small body. Bounded like the rest, because the landing renders while a build waits
 * on it.
 */
async function fetchFounderCount(): Promise<number | null> {
  const apiUrl = resolvePublicApiUrl();
  const res = await fetch(`${apiUrl}/public/stats/users`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(FLEET_READ_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`[landing] /public/stats/users failed: ${res.status}`);
  }
  const data = (await res.json()) as { totalUsers?: number | null };
  const total = data.totalUsers;
  return typeof total === "number" && Number.isFinite(total) ? total : null;
}

/**
 * Restate the trust rows, or leave the page exactly as it shipped.
 *
 * Nothing is fetched for a page that carries no such row. A failed read keeps the
 * shipped figure and is logged loud: the line is a lower bound, so the figure on disk
 * is the last one we know landed and understating ourselves for a few hours costs
 * nothing, while a blank where a count was reads as the product having lost its users.
 */
async function withFounderCount(html: string): Promise<string> {
  if (!html.includes("data-founder-count")) return html;
  try {
    const total = await fetchFounderCount();
    if (total === null) {
      console.warn("[landing] user count unreadable, keeping the shipped founder figure");
      return html;
    }
    return reseedFounderCount(html, total);
  } catch (error) {
    console.error("[landing] user count unavailable, keeping the shipped founder figure", error);
    return html;
  }
}

/**
 * The footer's Indexes column: one link per index the service serves, read live so a
 * new index is linked on every page without an edit here. A failed read leaves only
 * the "All indexes" link the markup carries, logged loud by the reader.
 */
// Short: every page waits on this read, and a footer link is not worth a slow page.
const INDEX_LINKS_TIMEOUT_MS = 3_000;

async function withIndexLinks(html: string): Promise<string> {
  if (!html.includes(INDEX_LINKS_TOKEN)) return html;
  return html.replaceAll(INDEX_LINKS_TOKEN, indexLinksHtml(await fetchIndexList(INDEX_LINKS_TIMEOUT_MS)));
}

async function withHotLeadStats(html: string) {
  const wantsRow = html.includes(HOT_LEAD_ROW_TOKEN);
  const wantsBand = html.includes(HOT_LEAD_BAND_TOKEN);
  const wantsStep = html.includes(STEP_MEETING_COST_TOKEN) || html.includes(STEP_RETURN_TOKEN);
  if (!wantsRow && !wantsBand && !wantsStep) return html;

  // ONE read per index, shared by both surfaces: the hero and a compare page cannot
  // quote two medians. A failed read is logged by the reader and drops its figure.
  const [engaged, roi, meeting] = await Promise.all([
    fetchIndexDetail(ENGAGED_LEAD_INDEX_SLUG),
    fetchIndexDetail(ROI_INDEX_SLUG),
    fetchIndexDetail(MEETING_INDEX_SLUG),
  ]);
  const stats = hotLeadStatsFromIndex(engaged === "not_found" ? null : engaged);
  const fleetReturn = fleetReturnFromIndex(roi === "not_found" ? null : roi);
  const meetingCost = meetingCostFromIndex(meeting === "not_found" ? null : meeting);
  const meetingExpected = meetingCostIsExpected(meeting === "not_found" ? null : meeting);
  if (engaged === "not_found" || roi === "not_found" || meeting === "not_found") {
    console.error(
      `[landing] hero index missing: ${ENGAGED_LEAD_INDEX_SLUG}=${engaged === "not_found"} ${ROI_INDEX_SLUG}=${roi === "not_found"} ${MEETING_INDEX_SLUG}=${meeting === "not_found"}`,
    );
  }

  return html
    .replaceAll(HOT_LEAD_ROW_TOKEN, hotLeadRowHtml(meetingCost, fleetReturn, meetingExpected))
    .replaceAll(STEP_MEETING_COST_TOKEN, stepMeetingCostHtml(meetingCost, meetingExpected))
    .replaceAll(STEP_RETURN_TOKEN, stepReturnHtml(fleetReturn))
    // The band states the count beside the two figures: no count, no band.
    .replaceAll(HOT_LEAD_BAND_TOKEN, stats ? hotLeadBandHtml(stats, fleetReturn, meetingCost, meetingExpected) : "");
}

function canonicalUrlFrom(html: string, fallbackPath?: string): string | undefined {
  const match = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  if (match) return match[1];
  return fallbackPath ? `${SITE_URL}${fallbackPath}` : undefined;
}

export interface StaticResponseOptions {
  /** HTTP status. Only the catch-all 404 handler passes anything but 200. */
  status?: number;
  /** Canonical path, used for the markdown header when the page states none. */
  canonicalPath?: string;
  /**
   * Edge cache in seconds, for a page whose figure moves faster than the day the
   * rest of the site uses (the fleet indexes record a new day every hour).
   */
  sMaxAge?: number;
}

/**
 * Serve one of the hand-authored landing documents, negotiated on `Accept`.
 *
 * A browser (and anything sending no `Accept` at all) gets exactly the bytes it
 * got before negotiation existed. An agent asking for `text/markdown` gets the
 * same page as markdown. Anything asking for neither gets a 406 rather than a
 * document it said it could not read.
 *
 * `Vary: Accept` is on EVERY branch, including the 406, or a shared cache keyed
 * on the URL alone would hand one variant to the other kind of client.
 */
export async function staticResponse(
  fileName: string,
  request?: Request,
  options: StaticResponseOptions = {},
) {
  return negotiatedResponse(staticHtml(fileName), request, options);
}

/**
 * Serve a document rendered at request time (the comparison cluster) exactly as a
 * hand-written one is served: decorated, token-resolved, negotiated, cached.
 */
export async function renderedResponse(
  html: string,
  request?: Request,
  options: StaticResponseOptions = {},
) {
  return negotiatedResponse(decorateHtml(html), request, options);
}

async function negotiatedResponse(
  decorated: string,
  request: Request | undefined,
  options: StaticResponseOptions,
) {
  const status = options.status ?? 200;
  const negotiated = negotiateContentType(request?.headers.get("accept"));

  if (negotiated === "unsupported") {
    return new Response(notAcceptableBody(), {
      status: 406,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        vary: VARY_HEADER,
        "cache-control": "no-store",
      },
    });
  }

  const html = await withIndexLinks(
    await withFounderCount(await withShowcaseOutcomes(await withHotLeadStats(decorated))),
  );

  if (negotiated === "markdown") {
    const markdown = htmlToMarkdown(html, {
      baseUrl: SITE_URL,
      canonicalUrl: canonicalUrlFrom(html, options.canonicalPath),
    });
    return new Response(markdown, {
      status,
      headers: {
        "content-type": MARKDOWN_CONTENT_TYPE,
        vary: VARY_HEADER,
        // Deliberately not shared-cacheable. Cloudflare honours `Vary` only for
        // `Accept-Encoding`, so a cacheable markdown body could be handed to a
        // browser asking the same URL for HTML. Agent traffic is low volume and
        // the upstream figures this page interpolates are already behind the
        // Next data cache, so the origin work here is a string rewrite.
        "cache-control": "no-store",
      },
    });
  }

  return new Response(html, {
    status,
    headers: {
      "content-type": HTML_CONTENT_TYPE,
      vary: VARY_HEADER,
      // This header, not the route's `revalidate` export, is what decides how
      // often the edge comes back to the function for these pages. `revalidate`
      // governs Next's own data cache; an explicit `cache-control` on the Response
      // is what the CDN obeys. At `s-maxage=300` every SEO page re-rendered a
      // ~127KB document and pushed it origin -> edge every 5 minutes around the
      // clock, which is what Fast Origin Transfer bills for ($15/month, 459K ISR
      // writes over 3 months) - crawlers keep every page warm enough to hit that
      // window continuously, so the traffic-driven cost was effectively a timer.
      //
      // A day matches the routes' `revalidate` and the figures these pages carry:
      // the fleet's hot-lead figures move over weeks. The long
      // `stale-while-revalidate` is unchanged and is what keeps the swap invisible
      // - a reader is always served instantly from the edge, never waiting on a
      // revalidation. Raising this without raising `revalidate` (or vice versa)
      // fixes nothing: both have to move together.
      "cache-control":
        options.sMaxAge !== undefined
          ? `s-maxage=${options.sMaxAge}, stale-while-revalidate=${options.sMaxAge * 2}`
          : "s-maxage=86400, stale-while-revalidate=31536000",
    },
  });
}
