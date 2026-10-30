/**
 * The AI Customer Success page's own comparison cluster (PAGE-AI-CUSTOMER-SUCCESS-1030):
 * `/ai-customer-success/alternatives` and one `/ai-customer-success/vs/<slug>` per tool in
 * `cs-tools.ts`. Every figure about a tool is read from its own site, shown with its source
 * link and the day it was read; our column is `OUR_CS_ROW`.
 *
 * Light, like the AI Agent compare pages (`compare-page.ts` shape: side by side table, their
 * plans with the source, where each wins, choose X if, FAQ + FAQPage JSON-LD). Signature (refs
 * #18, the default.com pricing table): the table's rows dissolve in one by one as it enters
 * (`reveal` with stagger; the HTML is the final state).
 *
 * Alias-free: the unit tests render it directly.
 */
import { CS_ALTERNATIVES_PATH, CS_PAGE_PATH, CS_TOOLS, OUR_CS_ROW, csVsPath, type CsTool } from "../cs-tools";
import { SIGN_UP, SITE, breadcrumb, esc, shell, whyLine } from "../v2-shell";
import { csHead, verifiedLabel } from "./ai-customer-success";

const LOGO_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";
const logo = (domain: string, size = 40) =>
  `<img src="https://img.logo.dev/${domain}?token=${LOGO_TOKEN}&size=${size * 2}&format=png" alt="" width="${size}" height="${size}">`;

const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';

const OUR_WINS = [
  "The agent writes first, when a customer pays, comes back, stops paying or goes quiet.",
  "Each message is written for one customer on WhatsApp, then the reply is answered and the next check-in set.",
  "Free for one user, every message at the API price with 0% markup, WhatsApp included.",
];

const CHOOSE_US = [
  "You want every paying customer looked after, with no one keeping a list.",
  "You want WhatsApp check-ins written for you, the moment a customer acts or goes quiet.",
];

function bullets(items: readonly string[], tone: "yes" | "no"): string {
  const mark = tone === "yes" ? "✓" : "·";
  return `<ul>${items.map((t) => `<li><i>${mark}</i><span>${esc(t)}</span></li>`).join("")}</ul>`;
}

function faqFor(t: CsTool): { q: string; a: string }[] {
  return [
    {
      q: `How much does ${t.name} cost?`,
      a: `${t.name} starts at ${t.entryPrice.replace(/^From /, "").replace(/^Free, then from /, "free, then ")}. ${t.prices.map((p) => `${p.plan}: ${p.price}`).join(". ")}. distribute.you is free for one user, and every message is billed at the vendor's API price with 0% markup.`,
    },
    { q: `What does ${t.name} do best?`, a: t.whereTheyWin.join(" ") },
    {
      q: `Can I keep ${t.name} and add distribute.you?`,
      a: `Yes. Keep ${t.name} to answer the customers who write in, and let our AI agent check in with every paying customer on WhatsApp when they pay, come back or go quiet.`,
    },
  ];
}

function faqList(faq: { q: string; a: string }[]): string {
  return faq
    .map(
      (f, i) => `<div class="faq-item${i === 0 ? " open" : ""}">
        <button class="faq-q" type="button" aria-expanded="${i === 0}">${esc(f.q)}${PLUS}</button>
        <div class="faq-a"><p>${esc(f.a)}</p></div>
      </div>`,
    )
    .join("\n");
}

function row(label: string, ours: string, theirs: string): string {
  return `<tr><th scope="row">${esc(label)}</th><td class="us">${esc(ours)}</td><td>${esc(theirs)}</td></tr>`;
}

export function renderCsVsPage(t: CsTool): string {
  const path = csVsPath(t);
  const verified = verifiedLabel(t.verifiedOn);
  const faq = faqFor(t);
  const others = CS_TOOLS.filter((x) => x.slug !== t.slug)
    .map((x) => `<a href="${csVsPath(x)}">distribute.you vs ${esc(x.name)}</a>`)
    .join(" · ");
  const prices = `<table class="roi-table cmp-prices">
    <thead><tr><th>${esc(t.name)} plan</th><th>Price</th><th>What it buys</th></tr></thead>
    <tbody>${t.prices.map((p) => `<tr><td>${esc(p.plan)}</td><td class="roi">${esc(p.price)}</td><td>${esc(p.note)}</td></tr>`).join("")}</tbody>
  </table>
  <p class="cmp-source">Read from <a href="${esc(t.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(t.sourceUrl.replace(/^https?:\/\//, ""))}</a> on ${verified}. Prices change; the link is the authority.</p>`;

  const body = `<section class="hero cmp-hero">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <span class="eyebrow">AI customer success · Verified ${verified}</span>
    <div class="cmp-logos" aria-hidden="true"><span class="cmp-logo"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="40" height="40"></span><span class="cmp-vs">vs</span><span class="cmp-logo">${logo(t.logoDomain ?? t.domain)}</span></div>
    <h1>distribute.you <span class="accent">vs</span> ${esc(t.name)}</h1>
    <p class="hero-sub">${esc(t.name)}: ${esc(t.oneLiner)} distribute.you is the AI customer success agent: you plug Stripe, Clerk, PostHog or GoHighLevel, and our agent writes to each paying customer on WhatsApp when they act or go quiet.</p>
    ${whyLine()}
    <div class="cmp-cta"><a class="btn btn-accent btn-lg" href="${SIGN_UP}">Start free</a><a class="btn btn-outline btn-lg" href="#table">See the table</a></div>
  </div>
</section>

<section class="framed tint" id="table">
  <div class="wrap">
    <div class="section-head"><span class="eyebrow">Side by side</span><h2>distribute.you vs ${esc(t.name)}, row by row</h2><p>Our column is the same on every comparison page; theirs is read from their own site.</p></div>
    <div class="cmp-table-wrap">
      <table class="cmp-table">
        <thead><tr><th scope="col">What you are comparing</th><th scope="col" class="us">distribute.you</th><th scope="col">${esc(t.name)}</th></tr></thead>
        <tbody data-motion="reveal" data-motion-stagger>
          ${row("Entry price", OUR_CS_ROW.entryPrice, t.entryPrice)}
          ${row("AI agent price", OUR_CS_ROW.aiAgent, t.aiAgent)}
          ${row("Free to start", OUR_CS_ROW.freeTier, t.freeTier)}
          ${row("WhatsApp", OUR_CS_ROW.whatsapp, t.whatsapp)}
          ${row("Who starts the conversation", OUR_CS_ROW.whoStarts, "Your customer, when they write in with a question")}
          ${row("What it counts", OUR_CS_ROW.counts, "Conversations and tickets resolved")}
        </tbody>
      </table>
    </div>
  </div>
</section>

<section class="framed" id="pricing">
  <div class="wrap">
    <div class="section-head"><span class="eyebrow">Pricing</span><h2>${esc(t.name)} pricing, and ours</h2><p>${esc(OUR_CS_ROW.pricing)}</p></div>
    <div class="cmp-cols">
      <div class="panel rv"><span class="c"></span>${prices}</div>
      <div class="plan rv">
        <span class="plan-tag">distribute.you</span>
        <div class="plan-price">Free<small>for one user</small></div>
        <p class="plan-desc">Every action at the API price, 0% markup. Start with $10. Pause or cancel anytime.</p>
        <a class="btn btn-accent" href="${SIGN_UP}">Start free</a>
        <div class="plan-included">Included in the plan</div>
        <ul><li><i></i>Stripe, Clerk, PostHog and GoHighLevel connectors</li><li><i></i>WhatsApp messages to your paying customers</li><li><i></i>Every reply answered, the next check-in set</li><li><i></i>Open source under MIT</li></ul>
        <div class="plan-foot">Teams are $9 per user each month.</div>
      </div>
    </div>
  </div>
</section>

<section class="framed tint" id="wins">
  <div class="wrap">
    <div class="section-head"><span class="eyebrow">Where each one wins</span><h2>A helpdesk that answers, or an agent that checks in</h2></div>
    <div class="fit">
      <div class="fit-card yes rv"><h3>Where distribute.you wins</h3>${bullets(OUR_WINS, "yes")}</div>
      <div class="fit-card no rv"><h3>Where ${esc(t.name)} wins</h3>${bullets(t.whereTheyWin, "no")}</div>
    </div>
    <div class="fit" style="margin-top:20px">
      <div class="fit-card yes rv"><h3>Choose distribute.you if</h3>${bullets(CHOOSE_US, "yes")}</div>
      <div class="fit-card no rv"><h3>Choose ${esc(t.name)} if</h3>${bullets(t.chooseThemIf, "no")}</div>
    </div>
  </div>
</section>

__HOT_LEAD_BAND__

<section class="framed" id="faq">
  <div class="wrap">
    <div class="section-head center rv"><h2>Questions about ${esc(t.name)} and distribute.you</h2></div>
    <div class="faq-list rv">${faqList(faq)}</div>
    <p class="cmp-more rv">More comparisons: ${others} · <a href="${CS_ALTERNATIVES_PATH}">AI customer success alternatives</a> · <a href="${CS_PAGE_PATH}">AI Customer Success</a></p>
  </div>
</section>`;

  return shell({
    title: `${t.name} alternative: distribute.you vs ${t.name} for AI customer success`,
    description: `Looking at ${t.name} alternatives? distribute.you's AI customer success agent checks in with each paying customer on WhatsApp, free for one user.`,
    path,
    head: csHead(),
    bodyClass: "cs-agent",
    body,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      breadcrumb([
        { name: "AI Customer Success", path: CS_PAGE_PATH },
        { name: `distribute.you vs ${t.name}`, path },
      ]),
    ],
  });
}

export function renderCsAlternativesPage(): string {
  const names = CS_TOOLS.map((t) => t.name).join(", ");
  const newest = CS_TOOLS.map((t) => t.verifiedOn).sort().at(-1) ?? "";
  const rows = CS_TOOLS.map(
    (t) =>
      `<tr><th scope="row"><a href="${csVsPath(t)}">${logo(t.logoDomain ?? t.domain, 20)}${esc(t.name)}</a></th><td>${esc(t.entryPrice)}</td><td>${esc(t.aiAgent)}</td><td><a href="${esc(t.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(t.domain)}</a></td></tr>`,
  ).join("");
  const cards = CS_TOOLS.map(
    (t) => `<a class="cmp-card rv" href="${csVsPath(t)}">
    <div class="cmp-card-top">${logo(t.logoDomain ?? t.domain, 32)}<div><b>${esc(t.name)} alternative</b><small>${esc(t.entryPrice)}</small></div></div>
    <p>${esc(t.oneLiner)}</p>
  </a>`,
  ).join("");
  const body = `<section class="hero cmp-hero">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <span class="eyebrow">AI customer success alternatives · Verified ${verifiedLabel(newest)}</span>
    <h1>AI customer success alternatives, side by side</h1>
    <p class="hero-sub">The price and AI agent of each customer success tool, read from their own sites. Ours is first: an AI agent that checks in with every paying customer on WhatsApp.</p>
    ${whyLine()}
  </div>
</section>
<section class="framed tint">
  <div class="wrap">
    <div class="cmp-table-wrap">
      <table class="cmp-table cmp-alt-table">
        <thead><tr><th scope="col">Tool</th><th scope="col">Entry price</th><th scope="col">Their AI agent</th><th scope="col">Source</th></tr></thead>
        <tbody data-motion="reveal" data-motion-stagger>
          <tr class="us-row"><th scope="row"><a href="${CS_PAGE_PATH}"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="20" height="20">distribute.you</a></th><td class="us">${esc(OUR_CS_ROW.entryPrice)}</td><td class="us">${esc(OUR_CS_ROW.aiAgent)}</td><td class="us"><a href="/catalog">Our catalog</a></td></tr>
          ${rows}
        </tbody>
      </table>
    </div>
  </div>
</section>
<section class="framed">
  <div class="wrap"><div class="cmp-grid">${cards}</div></div>
</section>
__HOT_LEAD_BAND__`;
  return shell({
    title: `AI customer success alternatives: ${names} and distribute.you`,
    description: `The best AI customer success alternatives: ${names} and distribute.you, with prices read from each tool's own site.`,
    path: CS_ALTERNATIVES_PATH,
    head: csHead(),
    bodyClass: "cs-agent",
    body,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "AI customer success alternatives",
        url: `${SITE}${CS_ALTERNATIVES_PATH}`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "distribute.you", url: `${SITE}${CS_PAGE_PATH}` },
          ...CS_TOOLS.map((t, i) => ({ "@type": "ListItem", position: i + 2, name: t.name, url: `${SITE}${csVsPath(t)}` })),
        ],
      },
      breadcrumb([
        { name: "AI Customer Success", path: CS_PAGE_PATH },
        { name: "Alternatives", path: CS_ALTERNATIVES_PATH },
      ]),
    ],
  });
}
