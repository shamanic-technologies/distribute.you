/**
 * The chrome every request-rendered page on the apex wears: the floating pill nav,
 * the closing CTA box and the footer of the homepage (`public/landing/index-v2.html`),
 * with the same stylesheet and the same script. One copy, so a page rendered from TS
 * (the comparison cluster, About, Contact, Developers, the 404) cannot drift from the
 * hand-written homepage by a link or a column.
 *
 * Alias-free apart from the competitor catalogue, so the unit tests can render a page
 * directly without a module alias.
 */
import { footerHtml, navHtml, SIGN_IN, SIGN_UP, WHY, esc } from "./site-chrome";

export { SIGN_IN, SIGN_UP, WHY, esc };

export const SITE = "https://distribute.you";
// Where every CTA goes (SIGN_UP: the picker, not the signup form) and the why line
// live in `site-chrome.ts`, re-exported here for the pages that import them from the shell.

/**
 * Bumped together with the homepage's link: every page reads the same stylesheet, so
 * an edit to it ships to a returning visitor only if every `?v=` moves at once.
 */
export const V2_STYLES_VERSION = 20;
export const V2_MAIN_VERSION = 10;
/** The motion kit (`public/landing/v2/motion.js`): it loads GSAP only on a page with a `data-motion` element. */
export const MOTION_VERSION = 4;


/** The why under a hero's lead paragraph (compare, best-for, alternatives, About...). */
export function whyLine(): string {
  return `<p class="why">${WHY}</p>`;
}

/**
 * The nav and the footer every rendered page wears, drawn from the page catalogue
 * (`site-chrome.ts`): the variant follows the page's path (an AI Agent page, an Agency
 * page, or the both-columns footer of `/` and every other page).
 */
export function nav(path = "/"): string {
  return navHtml(path);
}

export function footer(path = "/"): string {
  return footerHtml(path);
}

export function ctaBox(): string {
  return `<section class="framed">
  <div class="wrap">
    <div class="cta-box rv">
      <p class="why">${WHY}</p>
      <h2>Your next <span class="accent">customers</span><br>are already out there.</h2>
      <p class="lead">Paste your website and let the campaign find them.</p>
      <form class="launch" action="${SIGN_UP}" method="get">
        <div class="launch-field">
          <input name="url" type="text" autocomplete="off" placeholder="https://yourwebsite.com">
          <button class="btn btn-accent" type="submit"><span>Start free</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
        </div>
      </form>
      <div class="fine">Free for one user · API price, 0% markup · Cancel anytime</div>
    </div>
  </div>
</section>`;
}

export function breadcrumb(items: { name: string; path: string }[], context = true) {
  return {
    ...(context ? { "@context": "https://schema.org" } : {}),
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE}${it.path}`,
    })),
  };
}

export type Shell = {
  title: string;
  description: string;
  path: string;
  body: string;
  jsonLd: unknown[];
  /** Search engines are told to skip the page (the 404). */
  noindex?: boolean;
  /** Skip the closing CTA box (the 404 already points elsewhere). */
  noCta?: boolean;
  /** Extra tags for the head (a page's own stylesheet, e.g. the Agency pages). */
  head?: string;
  /** A class on <body> scoping that stylesheet. */
  bodyClass?: string;
};

export function shell(s: Shell): string {
  const url = `${SITE}${s.path}`;
  const ld = s.jsonLd
    .map((node) => `<script type="application/ld+json">${JSON.stringify(node)}</script>`)
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(s.title)}</title>
<meta name="description" content="${esc(s.description)}">
<meta name="theme-color" content="#ffffff">
${s.noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${url}">`}
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(s.title)}">
<meta property="og:description" content="${esc(s.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/opengraph-image">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(s.title)}">
<meta name="twitter:description" content="${esc(s.description)}">
<meta name="twitter:image" content="${SITE}/opengraph-image">
<link rel="preconnect" href="https://dashboard.distribute.you">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fustat:wght@300;400;500&family=Inter:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/landing/v2/styles.css?v=${V2_STYLES_VERSION}">
${s.head ?? ""}
${ld}
</head>
<body${s.bodyClass ? ` class="${esc(s.bodyClass)}"` : ""}>
${nav(s.path)}
${s.body}
${s.noCta ? "" : ctaBox()}
${footer(s.path)}
<script src="/landing/v2/main.js?v=${V2_MAIN_VERSION}" defer></script>
<script src="/landing/v2/motion.js?v=${MOTION_VERSION}" defer></script>
</body>
</html>
`;
}

/** A section of running prose on a document page (About, Contact, Developers). */
export type DocSection = { id: string; h2: string; html: string; tint?: boolean };

export type DocPage = {
  title: string;
  description: string;
  path: string;
  eyebrow: string;
  h1: string;
  lead: string;
  sections: DocSection[];
  jsonLd: unknown[];
  noindex?: boolean;
  noCta?: boolean;
};

/**
 * A document page: the homepage's hero recipe with the words on the left, then one
 * framed section per heading. The prose block is the only class these pages add to
 * the stylesheet (`.doc`).
 */
export function docPage(p: DocPage): string {
  const sections = p.sections
    .map(
      (s) => `<section class="framed${s.tint ? " tint" : ""}" id="${esc(s.id)}">
  <div class="wrap">
    <div class="section-head"><h2>${s.h2}</h2></div>
    <div class="doc rv">${s.html}</div>
  </div>
</section>`,
    )
    .join("\n");
  const body = `<section class="hero doc-hero">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <span class="eyebrow">${esc(p.eyebrow)}</span>
    <h1>${p.h1}</h1>
    <p class="hero-sub">${p.lead}</p>
    ${whyLine()}
  </div>
</section>
${sections}`;
  return shell({
    title: p.title,
    description: p.description,
    path: p.path,
    body,
    jsonLd: p.jsonLd,
    noindex: p.noindex,
    noCta: p.noCta,
  });
}
