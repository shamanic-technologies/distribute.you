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
import { SITE_URL, organizationJsonLd } from "@/lib/seo";
import { reseedShowcaseCards, type ShowcaseFunnels } from "@/lib/showcase-funnels";

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

  // Ahrefs Web Analytics — first-party page-view + traffic tracking (data-key
  // = the distribute.you Ahrefs project). Mirrors app/layout.tsx.
  const ahrefs = `<script src="https://analytics.ahrefs.com/analytics.js" data-key="6jqRRazbkHBZRDiWAmampA" async></script>`;

  // Partnero affiliate tracking + cross-subdomain via-forward, then the customer
  // referral code on the same journey.
  return ga + posthog + ahrefs + partneroHead() + inviteHead();
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
 * A third part, (3) acknowledge: a visitor who arrives on a referral link is TOLD
 * what it is worth. Without this the link lands on an ordinary homepage that says
 * $400 while the person is actually being offered $900, so the whole thing reads
 * as a plain link and the referrer's pitch is contradicted by the first page
 * their friend sees. The banner is injected rather than written into each page's
 * markup because a referral link can be shared pointing at any of the twenty-odd
 * static pages, and it carries its own inline styles so it cannot depend on which
 * of them loaded. It appears only when a code is actually present.
 */
export const INVITE_FORWARD_SCRIPT = `(function(){var N='distribute_invite';function ok(v){return !!v&&v.length<=128&&/^[A-Za-z0-9._~-]+$/.test(v);}function read(){var m=location.search.match(/[?&]invite=([^&]+)/);if(m){try{var d=decodeURIComponent(m[1]);if(ok(d))return d;}catch(e){}}var c=document.cookie.match(new RegExp('(?:^|; )'+N+'=([^;]*)'));if(c){try{var v=decodeURIComponent(c[1]);if(ok(v))return v;}catch(e){}}return null;}var code=read();if(code){document.cookie=N+'='+encodeURIComponent(code)+'; path=/; max-age=7776000; SameSite=Lax';}document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a[href*="dashboard.distribute.you"]'):null;if(!a)return;var v=read();if(!v)return;try{var u=new URL(a.href);if(!u.searchParams.get('invite')){u.searchParams.set('invite',v);a.href=u.href;}}catch(err){}},true);function banner(){if(!code)return;if(document.getElementById('dy-invite-banner'))return;var b=document.createElement('div');b.id='dy-invite-banner';b.setAttribute('role','status');b.style.cssText='position:relative;z-index:60;padding:10px 16px;text-align:center;font:500 14px/1.5 Inter,system-ui,sans-serif;color:#0b1220;background:#dbeafe;border-bottom:1px solid #bfdbfe';b.textContent='You were invited, so you get $530 in free credits instead of $30. The $30 lands the moment you sign up, and $500 more once your payments reach $500.';var t=document.body;if(t)t.insertBefore(b,t.firstChild);}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',banner);}else{banner();}})();`;

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
// Homepage hero — the fleet's hot-lead proof row.
//
// A "hot lead" is a person who showed buying interest: a positive reply OR a
// visit to the brand's site. Both are first steps of a sales funnel, so the sum
// is the count of people the fleet actually put in front of a customer.
//
// All three figures describe ONE set of brands — those with at least one hot
// lead AND recorded spend — so the count, the company count and the price can
// never end up describing different populations.
//
// Derived at BUILD time from the per-brand ranked read; no client fetch and no
// second endpoint. `distribute.you` is in the fleet on purpose: we ran the
// product on ourselves.

const SALES_COLD_EMAIL_FEATURE_SLUG = "sales-cold-email-outreach";

function resolvePublicApiUrl(): string {
  const base = process.env.API_SERVICE_URL || URLS.api;
  return base.replace(/\/$/, "");
}

function num(stats: Record<string, number | null>, key: string): number {
  const value = stats[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

// A flame beside the count, the way the row it is modelled on marks its own.
const FLAME_PATH =
  '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>';

const HOT_LEAD_ROW_TOKEN = "__HOT_LEAD_ROW__";
// The comparison cluster states the SAME two figures as a full dark band (compare-page.ts).
// One token for the whole section, so an unmeasurable fleet drops the band rather than
// leaving a heading over nothing.
const HOT_LEAD_BAND_TOKEN = "__HOT_LEAD_BAND__";

// A median over a single brand is that brand's own price, not a fleet figure.
const MIN_HOT_LEAD_BRANDS = 2;

interface RankedBrandItem {
  stats: Record<string, number | null>;
}

export interface HotLeadStats {
  hotLeads: number;
  companies: number;
  medianCostUsd: number;
}

/**
 * The fleet's median return on spend, as features-service states it.
 *
 * A SECOND read: the per-brand ranked read the two figures above come from carries
 * spend and outcome counts and no revenue of any kind, so a return cannot be derived
 * from it. features-service answers this one off a persisted snapshot it warms away
 * from the request path — the read is milliseconds, the pass behind it is minutes.
 *
 * `measured: false` is a real answer, not an outage: the fleet has too few brands past
 * the spend floor, or the first snapshot has not landed yet. The producer says which,
 * and either way the stat is DROPPED — a median over a population nobody can stand
 * behind is worse than two figures instead of three.
 */
export interface FleetReturnStats {
  medianReturnPerDollar: number;
  brandCount: number;
}

// The population the median is taken over. A brand that has barely spent produces a
// multiple decided by whichever outcome happened to land, so the floor is what makes
// the figure mean anything — features-service applies it, we only state which one we
// asked for (owner-set: "la médiane des clients ayant dépensé au moins $100, sinon ça
// ne veut rien dire").
const RETURN_MIN_SPEND_USD = 100;

// The landing renders while a build waits on it, so every live read is bounded and
// drops its figure rather than holding the page.
const FLEET_READ_TIMEOUT_MS = 8_000;

/**
 * Fleet hot-lead proof, or null when it cannot be stated honestly.
 *
 * A brand joins the set only when it has BOTH a hot lead and recorded spend:
 * counting a brand with no spend would pull the median toward a $0 nobody was
 * charged, and stating a company count over a wider set than the price
 * describes would let the two numbers on the row contradict each other.
 */
export function hotLeadStats(results: RankedBrandItem[]): HotLeadStats | null {
  const priced = results
    .map((item) => ({
      hot: num(item.stats, "recipientsRepliesPositive") + num(item.stats, "recipientsClicked"),
      costCents: num(item.stats, "totalCostInUsdCents"),
    }))
    .filter((brand) => brand.hot > 0 && brand.costCents > 0);

  if (priced.length < MIN_HOT_LEAD_BRANDS) return null;

  const hotLeads = priced.reduce((total, brand) => total + brand.hot, 0);
  if (hotLeads <= 0) return null;

  const perBrandUsd = priced
    .map((brand) => brand.costCents / 100 / brand.hot)
    .sort((a, b) => a - b);
  const mid = Math.floor(perBrandUsd.length / 2);
  const medianCostUsd =
    perBrandUsd.length % 2 === 0
      ? (perBrandUsd[mid - 1] + perBrandUsd[mid]) / 2
      : perBrandUsd[mid];

  return { hotLeads, companies: priced.length, medianCostUsd };
}

/**
 * The row's markup. It lives here rather than in the HTML because the row must
 * DISAPPEAR when the figures cannot be read — a hardcoded fallback would state
 * numbers nobody measured, and "we could not measure this" is not "zero".
 *
 * `data-n` seeds the in-session nudge in v2/main.js; the class names are pinned
 * on both sides by tests/unit/hot-lead-stats.test.ts.
 */
export function hotLeadRowHtml(
  stats: HotLeadStats,
  fleetReturn: FleetReturnStats | null = null,
): string {
  const leads = stats.hotLeads.toLocaleString("en-US");
  const companies = stats.companies.toLocaleString("en-US");
  // Whole dollars: this is a headline price, and cents on a median that moves
  // with every outcome read as precision we do not have.
  const cost = `$${Math.round(stats.medianCostUsd).toLocaleString("en-US")}`;
  // The return is a SECOND read and states its own absence: unmeasurable, failed or
  // slow, the row renders the two figures it always did. The row wraps (centred flex),
  // so a third item costs no height at any width — measured, not assumed.
  const returnFigure = fleetReturn ? formatReturnMultiple(fleetReturn.medianReturnPerDollar) : null;
  return (
    '<div class="hero-stats">' +
    '<span class="hstat">' +
    `<svg class="hstat-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${FLAME_PATH}</svg>` +
    `<span class="hstat-n"><b data-hot-leads data-n="${stats.hotLeads}">${leads}</b></span>` +
    `<span class="hstat-l">hot leads for ${companies} companies</span></span>` +
    '<span class="hstat">' +
    `<span class="hstat-n"><b>${cost}</b></span>` +
    '<span class="hstat-l">median cost per hot lead</span></span>' +
    (returnFigure
      ? '<span class="hstat">' +
        `<span class="hstat-n"><b>${returnFigure.text}x</b></span>` +
        '<span class="hstat-l">median ROI reported</span></span>'
      : "") +
    "</div>"
  );
}

/**
 * A return multiple reads with one decimal under 10x and whole from 10x up — `3.7x` is
 * a different answer from `2.9x`, `41x` and `42x` are not, and a decimal there is
 * precision we do not have on a figure that moves with every outcome. Same shape as the
 * dashboard's own ROI formatter, so a client meets one convention in both places.
 */
function formatReturnMultiple(value: number): { text: string; decimals: number } {
  return value < 10
    ? { text: value.toFixed(1), decimals: 1 }
    : { text: String(Math.round(value)), decimals: 0 };
}

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
): string {
  const companies = stats.companies.toLocaleString("en-US");
  const returnFigure = fleetReturn ? formatReturnMultiple(fleetReturn.medianReturnPerDollar) : null;
  return (
    '<section class="framed dark">' +
    '<div class="wrap">' +
    '<div class="section-head center"><span class="eyebrow">Measured, not quoted</span>' +
    "<h2>What the fleet has produced, read off every campaign we run</h2>" +
    "<p>A hot lead is a buyer who replied with interest or came to the site. No competitor on this page publishes this figure.</p></div>" +
    `<div class="stats${returnFigure ? "" : " two"}">` +
    `<div class="stat rv"><div class="n"><span data-count="${stats.hotLeads}">0</span></div><div class="l">hot leads for ${companies} companies</div></div>` +
    `<div class="stat rv"><div class="n"><span class="u">$</span><span data-count="${Math.round(stats.medianCostUsd)}">0</span></div><div class="l">median cost per hot lead</div></div>` +
    (returnFigure
      ? `<div class="stat rv"><div class="n"><span data-count="${returnFigure.text}" data-decimals="${returnFigure.decimals}">0</span><span class="u">x</span></div><div class="l">median ROI of our clients</div></div>`
      : "") +
    "</div></div></section>"
  );
}

async function fetchHotLeadStats(): Promise<HotLeadStats | null> {
  const apiUrl = resolvePublicApiUrl();
  const res = await fetch(
    `${apiUrl}/v1/public/features/ranked?featureSlug=${encodeURIComponent(
      SALES_COLD_EMAIL_FEATURE_SLUG,
    )}&objective=emailsSent&groupBy=brand&limit=200`,
    { headers: { Accept: "application/json" }, next: { revalidate: 300 } },
  );
  if (!res.ok) {
    throw new Error(
      `[landing] /v1/public/features/ranked?groupBy=brand failed for ${SALES_COLD_EMAIL_FEATURE_SLUG}: ${res.status}`,
    );
  }
  const data = (await res.json()) as { results: RankedBrandItem[] };
  return hotLeadStats(data.results ?? []);
}

/**
 * The fleet's median return on spend, or null when it cannot be stated.
 *
 * `measured: false` carries the producer's own reason and is logged rather than
 * swallowed — "the first snapshot has not landed" and "too few brands past the floor"
 * are different facts, and neither is an error. The response is read defensively for
 * the one thing rendered: a non-finite or non-positive median is refused rather than
 * printed, since `0.0x` on a comparison page would state a result no client got.
 */
/**
 * The three named clients' funnel counts, read at render.
 *
 * Through the gateway rather than the producer directly: features-service's CORS
 * allowlist still names a retired brand's domains, and the gateway is the one public
 * surface this landing talks to. Bounded like every other build-time read here — a
 * cold endpoint must never hold the prerender.
 */
async function fetchShowcaseFunnels(): Promise<ShowcaseFunnels | null> {
  const apiUrl = resolvePublicApiUrl();
  const res = await fetch(`${apiUrl}/v1/public/features/showcase-funnels`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(FLEET_READ_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`[landing] /v1/public/features/showcase-funnels failed: ${res.status}`);
  }
  const data = (await res.json()) as ShowcaseFunnels;
  if (!Array.isArray(data?.brands) || data.brands.length === 0) return null;
  for (const brand of data.brands) {
    if (!brand.measured) {
      console.warn(
        `[landing] showcase funnel not measurable for ${brand?.brand?.domain ?? "an unnamed brand"} (${brand.unmeasuredReason ?? "no reason given"}), keeping the shipped figures`,
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
async function withShowcaseFunnels(html: string): Promise<string> {
  if (!html.includes('data-brand="')) return html;
  try {
    const data = await fetchShowcaseFunnels();
    return data ? reseedShowcaseCards(html, data) : html;
  } catch (error) {
    console.error("[landing] showcase funnel counts unavailable, keeping the shipped figures", error);
    return html;
  }
}

async function fetchFleetReturn(): Promise<FleetReturnStats | null> {
  const apiUrl = resolvePublicApiUrl();
  const res = await fetch(
    `${apiUrl}/v1/public/features/return-on-spend?featureSlug=${encodeURIComponent(
      SALES_COLD_EMAIL_FEATURE_SLUG,
    )}&minSpendUsd=${RETURN_MIN_SPEND_USD}`,
    {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(FLEET_READ_TIMEOUT_MS),
    },
  );
  if (!res.ok) {
    throw new Error(
      `[landing] /v1/public/features/return-on-spend failed for ${SALES_COLD_EMAIL_FEATURE_SLUG}: ${res.status}`,
    );
  }
  const data = (await res.json()) as {
    measured?: boolean;
    reason?: string | null;
    medianReturnPerDollar?: number | null;
    brandCount?: number | null;
  };
  if (!data.measured) {
    console.warn(
      `[landing] fleet return on spend not measurable (${data.reason ?? "no reason given"}), dropping the stat`,
    );
    return null;
  }
  const median = data.medianReturnPerDollar;
  const brandCount = data.brandCount;
  if (typeof median !== "number" || !Number.isFinite(median) || median <= 0) return null;
  if (typeof brandCount !== "number" || brandCount <= 0) return null;
  return { medianReturnPerDollar: median, brandCount };
}

async function withHotLeadStats(html: string) {
  const wantsRow = html.includes(HOT_LEAD_ROW_TOKEN);
  const wantsBand = html.includes(HOT_LEAD_BAND_TOKEN);
  if (!wantsRow && !wantsBand) return html;

  let stats: HotLeadStats | null = null;
  try {
    stats = await fetchHotLeadStats();
  } catch (error) {
    // Build-time prerender must stay shippable (CLAUDE.md "Exception — Vercel
    // build-time prerender"). Log loud; the row is dropped rather than filled
    // with a figure nobody measured.
    console.error("[landing] hot-lead proof row unavailable, dropping it", error);
  }

  // Both surfaces state the return, from ONE read, so the homepage hero and a
  // comparison page cannot quote two different medians. Nothing is fetched for a page
  // that carries neither token, and nothing is fetched when the fleet itself could not
  // be measured — a return with no hot leads beside it states half a picture.
  let fleetReturn: FleetReturnStats | null = null;
  if (stats) {
    try {
      fleetReturn = await fetchFleetReturn();
    } catch (error) {
      console.error("[landing] fleet return on spend unavailable, dropping the stat", error);
    }
  }

  return html
    .replaceAll(HOT_LEAD_ROW_TOKEN, stats ? hotLeadRowHtml(stats, fleetReturn) : "")
    .replaceAll(HOT_LEAD_BAND_TOKEN, stats ? hotLeadBandHtml(stats, fleetReturn) : "");
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

  const html = await withShowcaseFunnels(await withHotLeadStats(decorated));

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
      "cache-control": "s-maxage=86400, stale-while-revalidate=31536000",
    },
  });
}
