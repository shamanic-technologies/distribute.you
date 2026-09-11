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
import { COMPETITORS } from "./competitors";

export const SITE = "https://distribute.you";
export const SIGN_UP = "https://dashboard.distribute.you/sign-up";
export const SIGN_IN = "https://dashboard.distribute.you/sign-in";

/**
 * Bumped together with the homepage's link: every page reads the same stylesheet, so
 * an edit to it ships to a returning visitor only if every `?v=` moves at once.
 */
export const V2_STYLES_VERSION = 13;
export const V2_MAIN_VERSION = 8;

export function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** The footer column every page carries, read from the catalogue. */
export function compareFooterColumn(): string {
  const items = COMPETITORS.map(
    (c) => `<li><a href="/compare/${c.slug}">distribute.you vs ${esc(c.name)}</a></li>`,
  ).join("");
  return `<div><h4>Compare</h4><ul>${items}<li><a href="/compare">All comparisons</a></li><li><a href="/alternatives">Alternatives</a></li></ul></div>`;
}

export function nav(): string {
  return `<div class="nav" id="nav">
  <div class="nav-pill">
    <a class="brand" href="/"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="26" height="26">distribute.you</a>
    <nav class="nav-links">
      <a href="/#how">How it works</a>
      <a href="/#pricing">Pricing</a>
      <a href="/compare">Compare</a>
      <a href="/#faq">FAQ</a>
    </nav>
    <div class="nav-right">
      <a class="btn btn-ghost" href="${SIGN_IN}">Log in</a>
      <a class="btn btn-primary" href="${SIGN_UP}">Start free</a>
    </div>
  </div>
</div>`;
}

export function footer(): string {
  return `<footer>
  <div class="wrap">
    <div class="foot">
      <div>
        <a class="brand" href="/"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="26" height="26">distribute.you</a>
        <p class="tag">The AI-native acquisition agency</p>
      </div>
      <div><h4>Product</h4><ul><li><a href="/#how">How it works</a></li><li><a href="/#features">Features</a></li><li><a href="/#pricing">Pricing</a></li><li><a href="/#faq">FAQ</a></li></ul></div>
      ${compareFooterColumn()}
      <div><h4>Company</h4><ul><li><a href="/about">About</a></li><li><a href="/investors">Investors</a></li><li><a href="/contact">Contact</a></li><li><a href="/blog">Blog</a></li></ul></div>
      <div><h4>Legal</h4><ul><li><a href="/terms">Terms</a></li><li><a href="/privacy">Privacy</a></li><li><a href="/developers">Developers</a></li></ul></div>
    </div>
    <div class="foot-bottom"><span>© 2026 distribute.you</span></div>
  </div>
</footer>`;
}

export function ctaBox(): string {
  return `<section class="framed">
  <div class="wrap">
    <div class="cta-box rv">
      <h2>Your next <span class="accent">customers</span><br>are already out there.</h2>
      <p class="lead">Paste your website and let the campaign find them.</p>
      <form class="launch" action="${SIGN_UP}" method="get">
        <div class="launch-field">
          <input name="url" type="text" autocomplete="off" placeholder="https://yourwebsite.com">
          <button class="btn btn-accent" type="submit"><span>Start free</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
        </div>
      </form>
      <div class="fine">First $30 free · Live in 2 minutes · Stop any time</div>
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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fustat:wght@300;400;500&family=Inter:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/landing/v2/styles.css?v=${V2_STYLES_VERSION}">
${ld}
</head>
<body>
${nav()}
${s.body}
${s.noCta ? "" : ctaBox()}
${footer()}
<script src="/landing/v2/main.js?v=${V2_MAIN_VERSION}" defer></script>
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
