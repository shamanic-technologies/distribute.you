/**
 * The comparison cluster: `/compare/<slug>` (one page per competitor), `/compare` (the
 * hub) and `/alternatives`. Rendered from `competitors.ts` at request time and served
 * through the same pipeline as the hand-written pages (`renderedResponse` in
 * static-html.ts), so every page gets the analytics head, the Organization JSON-LD,
 * `Accept: text/markdown`, the edge cache and the live `__HOT_LEAD_BAND__` figures for free.
 *
 * The shape is outrank.so's, because it works for both a search engine and an agent
 * reading the page: a feature table, a pricing row with a source, "where each wins",
 * "choose X if", a FAQ (also as FAQPage JSON-LD), and a verified-on date. What earns the
 * page is the band nobody else can copy: the hot leads the fleet produced and their
 * median cost, measured across every client and resolved live.
 *
 * Alias-free apart from the catalogue, so the unit tests can render a page directly.
 */
import {
  CATEGORY_LABEL,
  COMPARE_VERIFIED_LABEL,
  COMPETITORS,
  DISTRIBUTE_ROW,
  type Category,
  type Competitor,
} from "./competitors";
import {
  SIGN_UP,
  SITE,
  V2_STYLES_VERSION,
  breadcrumb,
  compareFooterColumn,
  esc,
  shell,
} from "./v2-shell";

export { V2_STYLES_VERSION };

/** Same publishable token the homepage and the dashboard bundle carry. */
const LOGO_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";

function logo(domain: string, size = 40): string {
  return `<img src="https://img.logo.dev/${domain}?token=${LOGO_TOKEN}&size=${size * 2}&format=png" alt="" width="${size}" height="${size}">`;
}

/**
 * The band only we can publish: the fleet's hot leads and their median cost, the SAME two
 * figures the homepage hero states, rendered by static-html.ts from one read. A token
 * for the whole section: when the fleet cannot be measured the band is dropped, never a
 * heading over a number nobody measured.
 */
function liveBand(): string {
  return "__HOT_LEAD_BAND__";
}

function faqJsonLd(faq: readonly { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

function faqList(faq: readonly { q: string; a: string }[]): string {
  return faq
    .map(
      (f, i) => `<div class="faq-item${i === 0 ? " open" : ""}">
        <button class="faq-q" type="button" aria-expanded="${i === 0 ? "true" : "false"}">${esc(f.q)}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></button>
        <div class="faq-a"><p>${esc(f.a)}</p></div>
      </div>`,
    )
    .join("\n");
}

function bullets(items: readonly string[], tone: "yes" | "no"): string {
  const mark = tone === "yes" ? "✓" : "·";
  return `<ul>${items.map((t) => `<li><i>${mark}</i><span>${esc(t)}</span></li>`).join("")}</ul>`;
}

function featureRow(label: string, ours: string, theirs: string): string {
  return `<tr><th scope="row">${esc(label)}</th><td class="us">${ours}</td><td>${esc(theirs)}</td></tr>`;
}

export function comparePageTitle(c: Competitor): string {
  return `distribute.you vs ${c.name}: pricing, model and what a meeting costs (${COMPARE_VERIFIED_LABEL})`;
}

export function comparePageDescription(c: Competitor): string {
  return `${c.name} vs distribute.you, side by side: entry price, who runs the campaign, whose domains send, and the measured cost of a sales interest. Prices read from ${c.domain} in ${COMPARE_VERIFIED_LABEL}.`;
}

export function renderComparePage(c: Competitor): string {
  const path = `/compare/${c.slug}`;
  const verified = new Date(c.verifiedOn).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const table = `<table class="cmp-table">
    <thead><tr><th scope="col">What you are comparing</th><th scope="col" class="us">distribute.you</th><th scope="col">${esc(c.name)}</th></tr></thead>
    <tbody>
      ${featureRow("Entry price", esc(DISTRIBUTE_ROW.entryPrice), c.entryPrice)}
      ${featureRow("Pricing model", esc(DISTRIBUTE_ROW.pricingModel), c.pricingModel)}
      ${featureRow("Who runs the campaign", esc(DISTRIBUTE_ROW.operatedBy), c.operatedBy === "you" ? "You do, in their software" : c.operatedBy === "their AI agent" ? "Their AI agent, steered by you" : "Their team")}
      ${featureRow("Sending domains and warmup", esc(DISTRIBUTE_ROW.sendingDomains), c.sendingDomains)}
      ${featureRow("Where the leads come from", esc(DISTRIBUTE_ROW.leads), c.leads)}
      ${featureRow("What happens to a reply", esc(DISTRIBUTE_ROW.replies), c.replies)}
      ${featureRow("Channels", esc(DISTRIBUTE_ROW.channels), c.channels)}
      ${featureRow("Cost per sales meeting published", DISTRIBUTE_ROW.costPerMeeting, c.costPerMeetingPublished ? "Yes" : "No")}
      ${featureRow("Free to start", esc(DISTRIBUTE_ROW.freeTier), c.freeTier)}
      ${featureRow("Contract", esc(DISTRIBUTE_ROW.contract), c.contract)}
    </tbody>
  </table>`;

  const prices = `<table class="roi-table cmp-prices">
    <thead><tr><th>${esc(c.name)} plan</th><th>Price</th><th>What it buys</th></tr></thead>
    <tbody>${c.prices
      .map(
        (p) => `<tr><td>${esc(p.plan)}</td><td class="roi">${esc(p.price)}</td><td>${esc(p.note)}</td></tr>`,
      )
      .join("")}</tbody>
  </table>
  <p class="cmp-source">Read from <a href="${esc(c.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(c.sourceUrl.replace(/^https?:\/\//, ""))}</a> on ${verified}. Prices change; the link is the authority.</p>`;

  const body = `<section class="hero cmp-hero">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <span class="eyebrow">${esc(CATEGORY_LABEL[c.category])} · Verified ${COMPARE_VERIFIED_LABEL}</span>
    <div class="cmp-logos" aria-hidden="true"><span class="cmp-logo"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="40" height="40"></span><span class="cmp-vs">vs</span><span class="cmp-logo">${logo(c.domain)}</span></div>
    <h1>distribute.you <span class="accent">vs</span> ${esc(c.name)}</h1>
    <p class="hero-sub">${esc(c.name)}: ${esc(c.oneLiner)} distribute.you is an acquisition agency: you paste a website, we run the campaign from domains we own, and you see what each sales interest cost.</p>
    <div class="cmp-cta"><a class="btn btn-accent btn-lg" href="${SIGN_UP}">Start free</a><a class="btn btn-outline btn-lg" href="#table">See the table</a></div>
  </div>
</section>

<section class="framed tint" id="table">
  <div class="wrap">
    <div class="section-head"><span class="eyebrow">Side by side</span><h2>distribute.you vs ${esc(c.name)}, row by row</h2><p>The rows a founder actually decides on. Our column is the same on every comparison page; theirs is read from their own site.</p></div>
    <div class="cmp-table-wrap rv">${table}</div>
  </div>
</section>

<section class="framed" id="pricing">
  <div class="wrap">
    <div class="section-head"><span class="eyebrow">Pricing</span><h2>What ${esc(c.name)} charges, and what we charge</h2><p>${esc(c.name)} sells ${c.operatedBy === "you" ? "software you run" : "an agent you steer"}. We charge the budget the campaign spent, from $1 a day, and show what each sales interest cost.</p></div>
    <div class="cmp-cols">
      <div class="panel rv"><span class="c"></span>${prices}</div>
      <div class="plan rv">
        <span class="plan-tag">distribute.you</span>
        <div class="plan-price">$1<small>/day and up</small></div>
        <p class="plan-desc">First $30 of budget free. Charged on what the campaign spent, nothing else.</p>
        <a class="btn btn-accent" href="${SIGN_UP}">Start free</a>
        <div class="plan-included">Included in the budget</div>
        <ul><li><i></i>Buyers found and qualified from your website</li><li><i></i>Emails written and sent from our domains</li><li><i></i>Every reply read, the interested ones answered</li><li><i></i>Cost per sales interest on your dashboard</li></ul>
        <div class="plan-foot">Our margin sits inside the budget. What a meeting costs you is measured on your account.</div>
      </div>
    </div>
  </div>
</section>

<section class="framed" id="wins">
  <div class="wrap">
    <div class="section-head"><span class="eyebrow">Where each one wins</span><h2>Two different things are being sold</h2></div>
    <div class="fit">
      <div class="fit-card yes rv"><h3>Where distribute.you wins</h3>${bullets(c.whereWeWin, "yes")}</div>
      <div class="fit-card no rv"><h3>Where ${esc(c.name)} wins</h3>${bullets(c.whereTheyWin, "no")}</div>
    </div>
  </div>
</section>

<section class="framed tint" id="choose">
  <div class="wrap">
    <div class="section-head"><span class="eyebrow">Pick the right one</span><h2>Choose ${esc(c.name)} if, choose distribute.you if</h2></div>
    <div class="fit">
      <div class="fit-card yes rv"><h3>Choose distribute.you if</h3>${bullets(c.chooseUsIf, "yes")}</div>
      <div class="fit-card no rv"><h3>Choose ${esc(c.name)} if</h3>${bullets(c.chooseThemIf, "no")}</div>
    </div>
  </div>
</section>

${liveBand()}

<section class="framed" id="faq">
  <div class="wrap">
    <div class="section-head center rv"><h2>Questions people ask about ${esc(c.name)} and distribute.you</h2></div>
    <div class="faq-list rv">${faqList(c.faq)}</div>
    <p class="cmp-more rv">More comparisons: ${COMPETITORS.filter((o) => o.slug !== c.slug)
      .map((o) => `<a href="/compare/${o.slug}">distribute.you vs ${esc(o.name)}</a>`)
      .join(" · ")} · <a href="/alternatives">all alternatives</a></p>
  </div>
</section>`;

  return shell({
    title: comparePageTitle(c),
    description: comparePageDescription(c),
    path,
    body,
    jsonLd: [
      breadcrumb([
        { name: "Compare", path: "/compare" },
        { name: `distribute.you vs ${c.name}`, path },
      ]),
      faqJsonLd(c.faq),
    ],
  });
}

function categoryGroups(): { category: Category; items: Competitor[] }[] {
  const order: Category[] = ["ai-sdr", "cold-email-tool", "data-platform"];
  return order.map((category) => ({
    category,
    items: COMPETITORS.filter((c) => c.category === category),
  }));
}

function competitorCard(c: Competitor, verb: "vs" | "alternative"): string {
  const href = `/compare/${c.slug}`;
  const label = verb === "vs" ? `distribute.you vs ${esc(c.name)}` : `${esc(c.name)} alternative`;
  return `<a class="cmp-card rv" href="${href}">
    <div class="cmp-card-top">${logo(c.domain, 32)}<div><b>${label}</b><small>${esc(c.entryPrice)}</small></div></div>
    <p>${esc(c.oneLiner)}</p>
  </a>`;
}

export function renderCompareHub(): string {
  const groups = categoryGroups()
    .map(
      (g) => `<h3>${esc(CATEGORY_LABEL[g.category])}</h3><div class="cmp-grid">${g.items.map((c) => competitorCard(c, "vs")).join("")}</div>`,
    )
    .join("");
  const body = `<section class="hero cmp-hero">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <span class="eyebrow">Compare · Verified ${COMPARE_VERIFIED_LABEL}</span>
    <h1>distribute.you <span class="accent">vs</span> the tools and agents you are weighing</h1>
    <p class="hero-sub">Every page reads the competitor's price from their own site, states where they win, and puts our measured cost per sales interest beside it. One thing is different on all of them: we run the campaign, they sell you the means to.</p>
  </div>
</section>
<section class="framed tint">
  <div class="wrap cmp-hub">${groups}</div>
</section>
${liveBand()}`;
  return shell({
    title: `Compare distribute.you with ${COMPETITORS.length} cold email tools and AI SDRs (${COMPARE_VERIFIED_LABEL})`,
    description: `Side-by-side pages against ${COMPETITORS.map((c) => c.name).join(", ")}: entry price, who runs the campaign, whose domains send, and the measured cost of a sales interest.`,
    path: "/compare",
    body,
    jsonLd: [breadcrumb([{ name: "Compare", path: "/compare" }])],
  });
}

export function renderAlternativesPage(): string {
  const groups = categoryGroups()
    .map(
      (g) => `<h3>${esc(CATEGORY_LABEL[g.category])}</h3><div class="cmp-grid">${g.items.map((c) => competitorCard(c, "alternative")).join("")}</div>`,
    )
    .join("");
  const body = `<section class="hero cmp-hero">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <span class="eyebrow">Alternatives · Verified ${COMPARE_VERIFIED_LABEL}</span>
    <h1>The alternative to running <span class="accent">outbound yourself</span></h1>
    <p class="hero-sub">Cold email tools, AI SDR agents and data platforms all sell you a way to run outbound. distribute.you is the alternative to all of them: an agency that runs it from domains we own, charges what the campaign spent, and shows what each sales interest cost.</p>
    <div class="cmp-cta"><a class="btn btn-accent btn-lg" href="${SIGN_UP}">Start free</a><a class="btn btn-outline btn-lg" href="/compare">Every comparison</a></div>
  </div>
</section>
<section class="framed tint">
  <div class="wrap">
    <div class="section-head"><span class="eyebrow">Looking for an alternative to</span><h2>Pick the one you are leaving</h2><p>Each page states the price you would pay them, read from their site, and what you pay us.</p></div>
    <div class="cmp-hub">${groups}</div>
  </div>
</section>
${liveBand()}`;
  return shell({
    title: `Alternatives to ${COMPETITORS.slice(0, 4).map((c) => c.name).join(", ")} and ${COMPETITORS.length - 4} more (${COMPARE_VERIFIED_LABEL})`,
    description: `Weighing ${COMPETITORS.map((c) => c.name).join(", ")}? distribute.you runs the outbound for you from domains we own, from $1 a day, and publishes what a sales interest costs.`,
    path: "/alternatives",
    body,
    jsonLd: [breadcrumb([{ name: "Alternatives", path: "/alternatives" }])],
  });
}
