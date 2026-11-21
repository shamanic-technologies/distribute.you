/**
 * The Distry skin: every real page of the site, redressed in the world of Distry (the
 * `distry-brand` skill) without a second copy of any page.
 *
 * A skin host (`lab-distry.distribute.you`) asks this same server for the live page and
 * passes the HTML through `applyDistrySkin`: the page keeps its markup, copy, links and
 * live figures, and gains the night-to-morning sky, the fonts, the stylesheet that
 * re-themes the live one, and Distry. Going to production is calling the same function
 * from the page pipeline, so nothing here may depend on the lab host.
 *
 * Alias-free: unit-tested directly.
 */

export const SKIN_ROUTE_PREFIX = "/internal-skin";
export const SKIN_ASSETS = "/landing/distry";
/** Bumped on any edit to `public/landing/distry/{skin.css,distry.js}`. */
export const SKIN_VERSION = 15;

/** The site's mark, and Distry's, which replaces it wherever the skin is worn (owner 2026-11-17). */
export const SITE_LOGO = "/landing/v2/assets/logo-mark.svg";
export const DISTRY_LOGO = `${SKIN_ASSETS}/assets/distry-mark.webp`;

/** Every use of the site's mark in a page, swapped for Distry's. */
export function withDistryLogo(html: string): string {
  return html.replaceAll(SITE_LOGO, DISTRY_LOGO);
}

/**
 * Requests a skin host lets through untouched: files and framework internals. Everything
 * else is a document and is fetched, skinned and answered by the skin route. The live
 * stylesheets are NOT in this list: they are re-themed on the way (`skinStylesheet`).
 */
export function isSkinPassThrough(pathname: string): boolean {
  if (isSkinnedStylesheet(pathname)) return false;
  if (pathname.startsWith("/_next/") || pathname.startsWith("/api/") || pathname.startsWith("/.well-known/")) return true;
  return /\.[a-z0-9]{2,5}$/i.test(pathname);
}

/** The live landing stylesheets, which hard-code a white page. */
export function isSkinnedStylesheet(pathname: string): boolean {
  return /^\/landing\/v2\/[a-z0-9-]+\.css$/.test(pathname);
}

/** The paper tokens: what any surface of the live site carries under the skin, at any hour. */
const PAPER =
  "--bg:#ffffff;--surface:#f6f8fc;--d-card:#ffffff;--text:#0b1230;--text-2:#17204a;--muted:#46507a;--muted-2:#5d678f;" +
  "--hair:#e3e8f2;--hair-2:#d3dbea;--accent:#2563eb;--accent-600:#1d4ed8;--accent-text:#1a4fc3;--accent-50:#eef3ff;--accent-100:#dbe6ff;" +
  "--secondary-50:#eef3ff;--secondary-100:#dbe6ff;--tertiary-50:#fff4dc;--tertiary-100:#ffe6b0;";

const WHITE = /#fff(?:fff)?\b|\bwhite\b/gi;
const SURFACE = /background(?:-color)?\s*:\s*[^;]*(?:#fff(?:fff)?\b|\bwhite\b|#fafafa\b|var\(--bg\)|var\(--surface\))/i;
/** Page-level bands: they let the sky through, so they are not surfaces. */
const BAND = /(^|,)\s*(html|body|:root|main|section|footer|\.hero|\.nav)\b[^,]*$/i;

/**
 * The live stylesheets assume a white page. Under the skin the page is the sky, so:
 * every white used as a SURFACE (background, border, ring) becomes the skin's paper, and
 * every rule that paints a surface also carries the paper tokens, which makes each card,
 * mock screen and panel of the live site an island of ink on paper at any hour, while
 * the text standing directly on the sky follows the hour. A white used as INK stays.
 */
export function skinStylesheet(css: string): string {
  return css.replace(/([^{}]+)\{([^{}]*)\}/g, (rule, selector: string, body: string) => {
    if (selector.trim().startsWith("@")) return rule;
    const band = selector.split(",").every((part) => BAND.test(part.trim()));
    const paper = !band && SURFACE.test(body);
    const repainted = body.replace(
      /((?:background(?:-color)?|border(?:-[a-z]+)*|box-shadow|outline|--shadow-ring)\s*:\s*)([^;{}]+)/g,
      (_all, prop: string, value: string) => prop + value.replace(WHITE, "var(--d-card, #fff)"),
    );
    if (!paper) return `${selector}{${repainted}}`;
    const ink = /(^|;|\s)color\s*:/.test(body) ? "" : "color:var(--text);";
    return `${selector}{${PAPER}${ink}${repainted}}`;
  });
}

const SKY = `<div class="d-sky" aria-hidden="true"><div class="d-sky-layer d-sky-night"></div><div class="d-sky-layer d-sky-dawn"></div><div class="d-sky-layer d-sky-day"></div><canvas class="d-stars" id="stars"></canvas><div class="d-orb d-moon"></div><div class="d-orb d-sun"></div></div><canvas class="d-fireflies" id="fireflies" aria-hidden="true"></canvas>`;

/**
 * Where a click on Distry leads. Distry beside the visitor is a way to TALK to us, never a
 * decoration (owner 2026-11-17), and it replaces the floating WhatsApp button. Until the
 * AI answers in the page itself, the click opens the same WhatsApp conversation.
 */
export const DISTRY_CHAT_URL = `https://wa.me/33680478702?text=${encodeURIComponent("Hi Distry! I have a question about distribute.you:")}`;

const BUDDY = `<aside class="buddy" id="buddy"><p class="buddy-say" id="buddy-say" aria-hidden="true"></p><a class="buddy-face" href="${DISTRY_CHAT_URL}" target="_blank" rel="noopener noreferrer" aria-label="Chat with Distry"><img src="${SKIN_ASSETS}/assets/distry-avatar-160.webp" alt="" width="72" height="72"></a></aside>`;

const HEAD = `<meta name="robots" content="noindex, nofollow">
<link rel="icon" type="image/png" href="${SKIN_ASSETS}/assets/distry-mark-64.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,400..700,100&family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${SKIN_ASSETS}/skin.css?v=${SKIN_VERSION}">
<script>document.documentElement.classList.add("distry");if(!matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("js")</script>`;

/**
 * The painting behind a page's opening section: one moment of Distry's night per kind of
 * page (`distry-brand` skill, `scenes/page-*`). First match wins, so the comparison
 * shapes are tested before the outcome a comparison sits under (`/ai-sdr/vs/11x`).
 */
const SCENES: readonly (readonly [RegExp, string])[] = [
  [/\/vs\/|^\/compare|\/alternatives/, "page-compare"],
  [/^\/best|\/best\//, "page-best"],
  [/\/blog/, "page-blog"],
  [/^\/(gtm-automation|gtm-agency)/, "page-gtm"],
  [/^\/(cold-email-automation|cold-email-agency)/, "page-cold-email"],
  [/^\/(ai-sdr|appointment-setting-agency)/, "page-meetings"],
  [/^\/(signup-automation|user-acquisition-agency)/, "page-signups"],
  [/^\/website-traffic-/, "page-traffic"],
  [/^\/(ai-lead-generation|lead-generation-agency)/, "page-leadgen"],
  [/^\/(ai-ad-management|ppc-agency)/, "page-ads"],
  [/^\/(lead-nurturing-automation|database-reactivation-agency)/, "page-nurturing"],
  [/^\/(ai-customer-success|customer-success-agency)/, "page-customer-success"],
  [/^\/indexes/, "page-indexes"],
  [/^\/catalog/, "page-catalog"],
  [/^\/docs/, "page-docs"],
  [/^\/about/, "page-about"],
  [/^\/contact/, "page-contact"],
  [/^\/(terms|privacy)/, "page-legal"],
  [/^\/investors/, "page-investors"],
];

export function sceneFor(pathname: string, status = 200): string {
  if (status === 404) return "page-notfound";
  return SCENES.find(([pattern]) => pattern.test(pathname))?.[1] ?? "hero-night";
}

/** What Distry says beside the visitor, by the hour the section sits in. */
const LINES: Record<"night" | "dawn" | "day", readonly string[]> = {
  night: ["Hi, I'm Distry. I work the night shift.", "We write, we answer, we book. You sleep.", "Meet the team. Each of us has one job."],
  dawn: ["Look. The replies are coming back.", "I keep the money on what books meetings."],
  day: ["Good morning. Your coffee, your meetings.", "Ask me anything. I like questions.", "Paste your website. I start tonight."],
};

export function hourFor(sky: number): "night" | "dawn" | "day" {
  return sky < 0.4 ? "night" : sky < 0.72 ? "dawn" : "day";
}

/** Analytics the live page carries. A skinned page under review must not report as production traffic. */
const TRACKER = /googletagmanager|gtag\(|posthog|partnero|AW-\d{6,}/i;

/**
 * The page's sections, in order, each given its place in the night: `data-sky` (0 night
 * to 1 day), a `d-night | d-dawn | d-day` class the stylesheet themes, and Distry's line.
 * Done here rather than in the browser so the page is correct before any script runs.
 */
export function placeSections(html: string): string {
  const total = (html.match(/<section\b/g) ?? []).length;
  if (total === 0) return html;
  let index = 0;
  const said: Record<string, number> = { night: 0, dawn: 0, day: 0 };
  return html.replace(/<section\b([^>]*)>/g, (_tag, attrs: string) => {
    // Sober (owner 2026-11-17): the night is the opening section only, the rest is a clean day page.
    const sky = index === 0 ? 0 : 1;
    index += 1;
    const hour = hourFor(sky);
    const line = LINES[hour][Math.min(said[hour], LINES[hour].length - 1)];
    said[hour] += 1;
    const cls = `d-${hour}`;
    const withClass = /\bclass="/.test(attrs)
      ? attrs.replace(/\bclass="([^"]*)"/, (_m, existing: string) => `class="${existing} ${cls}"`)
      : `${attrs} class="${cls}"`;
    return `<section${withClass} data-sky="${sky.toFixed(2)}" data-say="${line}">`;
  });
}

/** A page React hydrates in the browser: any markup added to its body is thrown away at hydration. */
export function isHydratedPage(html: string): boolean {
  return /self\.__next_f\b|__NEXT_DATA__/.test(html);
}

/** The page's painting, framed like a product screenshot. */
export function frameHtml(sceneUrl: string): string {
  return `<figure class="d-frame" aria-hidden="true"><img src="${sceneUrl}" alt="" loading="lazy" width="1600" height="893"></figure>`;
}

export function applyDistrySkin(html: string, pathname = "/", status = 200): string {
  if (!/<\/head>/i.test(html) || !/<body\b/i.test(html)) return html;
  const sceneUrl = `${SKIN_ASSETS}/assets/${sceneFor(pathname, status)}.webp`;
  if (isHydratedPage(html)) {
    // Nothing is added to the body: the script dresses the page once it has settled.
    const handover = JSON.stringify({ late: true, sky: SKY, buddy: BUDDY, lines: LINES, frame: frameHtml(sceneUrl), logo: DISTRY_LOGO }).replace(/</g, "\\u003c");
    return html.replace(
      /<\/head>/i,
      `${HEAD}\n<script>window.__distry=${handover}</script>\n<script src="${SKIN_ASSETS}/distry.js?v=${SKIN_VERSION}" defer></script>\n</head>`,
    );
  }
  let out = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (tag) =>
    TRACKER.test(tag) && !/application\/ld\+json/i.test(tag) ? "" : tag,
  );
  // Links to the production site stay on the host the visitor is reviewing.
  out = out.replace(/(href|action)="https:\/\/distribute\.you(\/[^"]*)?"/g, (_m, attr: string, path?: string) => `${attr}="${path ?? "/"}"`);
  out = withDistryLogo(placeSections(out));
  // The page's painting is ONE framed moment, never a background: in the closing box
  // when the page has one, else just above the footer.
  const frame = frameHtml(sceneUrl);
  let framed = false;
  out = out.replace(/<div class="cta-box[^"]*">/, (tag) => {
    framed = true;
    return `${tag}${frame}`;
  });
  if (!framed) out = out.replace(/<footer\b/, `<div class="d-frame-band">${frame}</div><footer`);
  // The footer is always the morning: the sky ends in daylight on every page, however few sections it has.
  out = out.replace(/<footer\b(?![^>]*data-sky)/g, `<footer data-sky="1" data-say="${LINES.day[2]}"`);
  out = out.replace(/<\/head>/i, `${HEAD}\n</head>`);
  out = out.replace(/<body\b([^>]*)>/i, (_tag, attrs: string) => `<body${attrs}>${SKY}`);
  out = out.replace(/<\/body>/i, `${BUDDY}<script src="${SKIN_ASSETS}/distry.js?v=${SKIN_VERSION}" defer></script>\n</body>`);
  return out;
}
