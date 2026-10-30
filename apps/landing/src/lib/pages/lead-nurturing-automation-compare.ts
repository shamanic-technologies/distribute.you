/**
 * The Lead Nurturing Automation page's own comparison cluster (PAGE-LEAD-NURTURING-AUTOMATION-1030):
 * `/lead-nurturing-automation/alternatives` and one `/lead-nurturing-automation/vs/<slug>` per tool
 * in `nurturing-tools.ts`. Every figure about a tool is read from its own site, shown with its
 * source link and the day it was read; our column is `OUR_NURTURING_ROW`.
 *
 * Light, like the AI Agent compare pages (`compare-page.ts` shape: side by side table, their
 * plans with the source, where each wins, choose X if, FAQ + FAQPage JSON-LD). Signature (refs
 * #18, the default.com pricing table): the table's rows dissolve in one by one as it enters
 * (`reveal` with stagger; the HTML is the final state).
 *
 * Alias-free: the unit tests render it directly.
 */
import {
  NURTURING_ALTERNATIVES_PATH,
  NURTURING_PAGE_PATH,
  NURTURING_TOOLS,
  OUR_NURTURING_ROW,
  nurturingVsPath,
  type NurturingTool,
} from "../nurturing-tools";
import { SIGN_UP, SITE, breadcrumb, esc, shell, whyLine } from "../v2-shell";
import { nurturingHead, verifiedLabel } from "./lead-nurturing-automation";

const LOGO_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";
const logo = (domain: string, size = 40) =>
  `<img src="https://img.logo.dev/${domain}?token=${LOGO_TOKEN}&size=${size * 2}&format=png" alt="" width="${size}" height="${size}">`;

const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';

const OUR_WINS = [
  "The agent decides when to write, from what each lead just did. Nobody draws a workflow.",
  "Each message is written for one person, then the reply is answered and the next date set.",
  "Free for one user, every message at the API price with 0% markup, WhatsApp included.",
];

const CHOOSE_US = [
  "You want every lead followed up without building sequences.",
  "You want email and WhatsApp written for you, the moment a lead acts.",
];

function bullets(items: readonly string[], tone: "yes" | "no"): string {
  const mark = tone === "yes" ? "✓" : "·";
  return `<ul>${items.map((t) => `<li><i>${mark}</i><span>${esc(t)}</span></li>`).join("")}</ul>`;
}

function faqFor(t: NurturingTool): { q: string; a: string }[] {
  return [
    {
      q: `How much does ${t.name} cost?`,
      a: `${t.name} starts at ${t.entryPrice.replace(/^From /, "").replace(/^Free, then from /, "free, then ")}. ${t.prices.map((p) => `${p.plan}: ${p.price}`).join(". ")}. distribute.you is free for one user, and every message is billed at the vendor's API price with 0% markup.`,
    },
    { q: `What does ${t.name} do best?`, a: t.whereTheyWin.join(" ") },
    {
      q: `Can I keep ${t.name} and add distribute.you?`,
      a: `Yes. Keep ${t.name} for your newsletters and campaigns, and let our AI agent follow up each lead by email or WhatsApp when they visit, sign up or pay.`,
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

export function renderNurturingVsPage(t: NurturingTool): string {
  const path = nurturingVsPath(t);
  const verified = verifiedLabel(t.verifiedOn);
  const faq = faqFor(t);
  const others = NURTURING_TOOLS.filter((x) => x.slug !== t.slug)
    .map((x) => `<a href="${nurturingVsPath(x)}">distribute.you vs ${esc(x.name)}</a>`)
    .join(" · ");
  const prices = `<table class="roi-table cmp-prices">
    <thead><tr><th>${esc(t.name)} plan</th><th>Price</th><th>What it buys</th></tr></thead>
    <tbody>${t.prices.map((p) => `<tr><td>${esc(p.plan)}</td><td class="roi">${esc(p.price)}</td><td>${esc(p.note)}</td></tr>`).join("")}</tbody>
  </table>
  <p class="cmp-source">Read from <a href="${esc(t.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(t.sourceUrl.replace(/^https?:\/\//, ""))}</a> on ${verified}. Prices change; the link is the authority.</p>`;

  const body = `<section class="hero cmp-hero">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <span class="eyebrow">Lead nurturing automation · Verified ${verified}</span>
    <div class="cmp-logos" aria-hidden="true"><span class="cmp-logo"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="40" height="40"></span><span class="cmp-vs">vs</span><span class="cmp-logo">${logo(t.domain)}</span></div>
    <h1>distribute.you <span class="accent">vs</span> ${esc(t.name)}</h1>
    <p class="hero-sub">${esc(t.name)}: ${esc(t.oneLiner)} distribute.you is the AI lead nurturing agent: you plug Clerk, Stripe, PostHog or GoHighLevel, and our agent writes to each lead by email or WhatsApp when they act.</p>
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
          ${row("Entry price", OUR_NURTURING_ROW.entryPrice, t.entryPrice)}
          ${row("Free to start", OUR_NURTURING_ROW.freeTier, t.freeTier)}
          ${row("WhatsApp", OUR_NURTURING_ROW.whatsapp, t.whatsapp)}
          ${row("Who writes each message", OUR_NURTURING_ROW.whoWrites, "You, in templates and workflows you build")}
          ${row("What starts a message", OUR_NURTURING_ROW.signals, "The triggers and schedules you set up")}
        </tbody>
      </table>
    </div>
  </div>
</section>

<section class="framed" id="pricing">
  <div class="wrap">
    <div class="section-head"><span class="eyebrow">Pricing</span><h2>${esc(t.name)} pricing, and ours</h2><p>${esc(OUR_NURTURING_ROW.pricing)}</p></div>
    <div class="cmp-cols">
      <div class="panel rv"><span class="c"></span>${prices}</div>
      <div class="plan rv">
        <span class="plan-tag">distribute.you</span>
        <div class="plan-price">Free<small>for one user</small></div>
        <p class="plan-desc">Every action at the API price, 0% markup. Start with $10. Pause or cancel anytime.</p>
        <a class="btn btn-accent" href="${SIGN_UP}">Start free</a>
        <div class="plan-included">Included in the plan</div>
        <ul><li><i></i>Clerk, Stripe, PostHog and GoHighLevel connectors</li><li><i></i>Messages by email from our domains and on WhatsApp</li><li><i></i>Every reply answered, the next date set</li><li><i></i>Open source under MIT</li></ul>
        <div class="plan-foot">Teams are $9 per user each month.</div>
      </div>
    </div>
  </div>
</section>

<section class="framed tint" id="wins">
  <div class="wrap">
    <div class="section-head"><span class="eyebrow">Where each one wins</span><h2>A tool you run, or an agent that runs it</h2></div>
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
    <p class="cmp-more rv">More comparisons: ${others} · <a href="${NURTURING_ALTERNATIVES_PATH}">Lead nurturing automation alternatives</a> · <a href="${NURTURING_PAGE_PATH}">Lead Nurturing Automation</a></p>
  </div>
</section>`;

  return shell({
    title: `${t.name} alternative: distribute.you vs ${t.name} for lead nurturing`,
    description: `Looking at ${t.name} alternatives? distribute.you's AI lead nurturing agent writes to each lead when they act, free for one user. Compare prices.`,
    path,
    head: nurturingHead(),
    bodyClass: "nurture",
    body,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      breadcrumb([
        { name: "Lead Nurturing Automation", path: NURTURING_PAGE_PATH },
        { name: `distribute.you vs ${t.name}`, path },
      ]),
    ],
  });
}

export function renderNurturingAlternativesPage(): string {
  const names = NURTURING_TOOLS.map((t) => t.name).join(", ");
  const newest = NURTURING_TOOLS.map((t) => t.verifiedOn).sort().at(-1) ?? "";
  const rows = NURTURING_TOOLS.map(
    (t) =>
      `<tr><th scope="row"><a href="${nurturingVsPath(t)}">${logo(t.domain, 20)}${esc(t.name)}</a></th><td>${esc(t.entryPrice)}</td><td>${esc(t.whatsapp)}</td><td><a href="${esc(t.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(t.domain)}</a></td></tr>`,
  ).join("");
  const cards = NURTURING_TOOLS.map(
    (t) => `<a class="cmp-card rv" href="${nurturingVsPath(t)}">
    <div class="cmp-card-top">${logo(t.domain, 32)}<div><b>${esc(t.name)} alternative</b><small>${esc(t.entryPrice)}</small></div></div>
    <p>${esc(t.oneLiner)}</p>
  </a>`,
  ).join("");
  const body = `<section class="hero cmp-hero">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <span class="eyebrow">Lead nurturing automation alternatives · Verified ${verifiedLabel(newest)}</span>
    <h1>Lead nurturing automation alternatives, side by side</h1>
    <p class="hero-sub">The price and WhatsApp plan of each lead nurturing tool, read from their own sites. Ours is first: an AI agent that writes when your lead acts.</p>
    ${whyLine()}
  </div>
</section>
<section class="framed tint">
  <div class="wrap">
    <div class="cmp-table-wrap">
      <table class="cmp-table cmp-alt-table">
        <thead><tr><th scope="col">Tool</th><th scope="col">Entry price</th><th scope="col">WhatsApp</th><th scope="col">Source</th></tr></thead>
        <tbody data-motion="reveal" data-motion-stagger>
          <tr class="us-row"><th scope="row"><a href="${NURTURING_PAGE_PATH}"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="20" height="20">distribute.you</a></th><td class="us">${esc(OUR_NURTURING_ROW.entryPrice)}</td><td class="us">${esc(OUR_NURTURING_ROW.whatsapp)}</td><td class="us"><a href="/catalog">Our catalog</a></td></tr>
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
    title: `Lead nurturing automation alternatives: ${names} and distribute.you`,
    description: `The best lead nurturing automation alternatives: ${names} and distribute.you, with prices read from each tool's own site.`,
    path: NURTURING_ALTERNATIVES_PATH,
    head: nurturingHead(),
    bodyClass: "nurture",
    body,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Lead nurturing automation alternatives",
        url: `${SITE}${NURTURING_ALTERNATIVES_PATH}`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "distribute.you", url: `${SITE}${NURTURING_PAGE_PATH}` },
          ...NURTURING_TOOLS.map((t, i) => ({ "@type": "ListItem", position: i + 2, name: t.name, url: `${SITE}${nurturingVsPath(t)}` })),
        ],
      },
      breadcrumb([
        { name: "Lead Nurturing Automation", path: NURTURING_PAGE_PATH },
        { name: "Alternatives", path: NURTURING_ALTERNATIVES_PATH },
      ]),
    ],
  });
}
