/**
 * The comparison cluster of an AI Agent traffic page (PAGE-TRAFFIC-1030): `<page>/alternatives`
 * and one `<page>/vs/<slug>` per tool, for `/website-traffic-automation` and `/ai-ad-management`.
 * Same shape as the other AI Agent clusters (side by side table, their plans with the source,
 * where each wins, choose X if, FAQ + FAQPage JSON-LD); each page passes its own words, tools
 * and our row. Every figure about a tool is read from its own site, shown with its source link
 * and the day it was read.
 *
 * Signature (refs #18, the default.com pricing table): the table's rows dissolve in one by one
 * as it enters (`reveal` with stagger; the HTML is the final state).
 *
 * Alias-free: the unit tests render it directly.
 */
import type { AgentTool } from "../traffic-tools";
import { SIGN_UP, SITE, breadcrumb, esc, shell, whyLine } from "../v2-shell";
import { PLUS, verifiedLabel } from "./traffic-shared";

const logo = (domain: string, size = 40) =>
  `<img src="https://img.logo.dev/${domain}?token=pk_J1iY4__HSfm9acHjR8FibA&size=${size * 2}&format=png" alt="" width="${size}" height="${size}">`;

export type ToolCluster = {
  /** The AI Agent page the cluster belongs to. */
  pagePath: string;
  pageName: string;
  alternativesPath: string;
  /** Lower case, for sentences and the eyebrow ("website traffic automation"). */
  topic: string;
  tools: readonly AgentTool[];
  vsPath: (t: Pick<AgentTool, "slug">) => string;
  our: { entryPrice: string; pricing: string; freeTier: string; channel: string };
  /** The label of the per-page column (`AgentTool.channel`). */
  channelLabel: string;
  /** Two more rows, the same "them" answer for every tool. */
  rows: readonly { label: string; ours: string; theirs: string }[];
  /** What we are, after their one-liner in the vs hero. */
  usLine: string;
  ourWins: readonly string[];
  chooseUs: readonly string[];
  planItems: readonly string[];
  keep: (name: string) => string;
  head: string;
  bodyClass: string;
};

function bullets(items: readonly string[], tone: "yes" | "no"): string {
  const mark = tone === "yes" ? "✓" : "·";
  return `<ul>${items.map((t) => `<li><i>${mark}</i><span>${esc(t)}</span></li>`).join("")}</ul>`;
}

function faqFor(c: ToolCluster, t: AgentTool): { q: string; a: string }[] {
  return [
    {
      q: `How much does ${t.name} cost?`,
      a: `${t.name}: ${t.prices.map((p) => `${p.plan}, ${p.price}`).join(". ")}. distribute.you is free for one user, and every action is billed at the vendor's API price with 0% markup.`,
    },
    { q: `What does ${t.name} do best?`, a: t.whereTheyWin.join(" ") },
    { q: `Can I keep ${t.name} and add distribute.you?`, a: c.keep(t.name) },
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

export function renderToolVsPage(c: ToolCluster, t: AgentTool): string {
  const path = c.vsPath(t);
  const verified = verifiedLabel(t.verifiedOn);
  const faq = faqFor(c, t);
  const others = c.tools
    .filter((x) => x.slug !== t.slug)
    .map((x) => `<a href="${c.vsPath(x)}">distribute.you vs ${esc(x.name)}</a>`)
    .join(" · ");
  const prices = `<table class="roi-table cmp-prices">
    <thead><tr><th>${esc(t.name)} plan</th><th>Price</th><th>What it buys</th></tr></thead>
    <tbody>${t.prices.map((p) => `<tr><td>${esc(p.plan)}</td><td class="roi">${esc(p.price)}</td><td>${esc(p.note)}</td></tr>`).join("")}</tbody>
  </table>
  <p class="cmp-source">Read from <a href="${esc(t.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(t.sourceUrl.replace(/^https?:\/\//, ""))}</a> on ${verified}. Prices change; the link is the authority.</p>`;

  const body = `<section class="hero cmp-hero">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <span class="eyebrow">${esc(c.pageName)} · Verified ${verified}</span>
    <div class="cmp-logos" aria-hidden="true"><span class="cmp-logo"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="40" height="40"></span><span class="cmp-vs">vs</span><span class="cmp-logo">${logo(t.domain)}</span></div>
    <h1>distribute.you <span class="accent">vs</span> ${esc(t.name)}</h1>
    <p class="hero-sub">${esc(t.name)}: ${esc(t.oneLiner)} ${esc(c.usLine)}</p>
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
          ${row("Entry price", c.our.entryPrice, t.entryPrice)}
          ${row("Free to start", c.our.freeTier, t.freeTier)}
          ${row(c.channelLabel, c.our.channel, t.channel)}
          ${c.rows.map((r) => row(r.label, r.ours, r.theirs)).join("\n          ")}
        </tbody>
      </table>
    </div>
  </div>
</section>

<section class="framed" id="pricing">
  <div class="wrap">
    <div class="section-head"><span class="eyebrow">Pricing</span><h2>${esc(t.name)} pricing, and ours</h2><p>${esc(c.our.pricing)}</p></div>
    <div class="cmp-cols">
      <div class="panel rv"><span class="c"></span>${prices}</div>
      <div class="plan rv">
        <span class="plan-tag">distribute.you</span>
        <div class="plan-price">Free<small>for one user</small></div>
        <p class="plan-desc">Every action at the API price, 0% markup. Start with $10. Pause or cancel anytime.</p>
        <a class="btn btn-accent" href="${SIGN_UP}">Start free</a>
        <div class="plan-included">Included in the plan</div>
        <ul>${c.planItems.map((l) => `<li><i></i>${esc(l)}</li>`).join("")}<li><i></i>Open source under MIT</li></ul>
        <div class="plan-foot">Teams are $9 per user each month.</div>
      </div>
    </div>
  </div>
</section>

<section class="framed tint" id="wins">
  <div class="wrap">
    <div class="section-head"><span class="eyebrow">Where each one wins</span><h2>A tool you run, or an agent that brings buyers</h2></div>
    <div class="fit">
      <div class="fit-card yes rv"><h3>Where distribute.you wins</h3>${bullets(c.ourWins, "yes")}</div>
      <div class="fit-card no rv"><h3>Where ${esc(t.name)} wins</h3>${bullets(t.whereTheyWin, "no")}</div>
    </div>
    <div class="fit" style="margin-top:20px">
      <div class="fit-card yes rv"><h3>Choose distribute.you if</h3>${bullets(c.chooseUs, "yes")}</div>
      <div class="fit-card no rv"><h3>Choose ${esc(t.name)} if</h3>${bullets(t.chooseThemIf, "no")}</div>
    </div>
  </div>
</section>

__HOT_LEAD_BAND__

<section class="framed" id="faq">
  <div class="wrap">
    <div class="section-head center rv"><h2>Questions about ${esc(t.name)} and distribute.you</h2></div>
    <div class="faq-list rv">${faqList(faq)}</div>
    <p class="cmp-more rv">More comparisons: ${others} · <a href="${c.alternativesPath}">${esc(c.topic[0].toUpperCase() + c.topic.slice(1))} alternatives</a> · <a href="${c.pagePath}">${esc(c.pageName)}</a></p>
  </div>
</section>`;

  return shell({
    title: `${t.name} alternative: distribute.you vs ${t.name} for ${c.topic}`,
    description: `Looking at ${t.name} alternatives? distribute.you's AI agent brings the right buyers to your website, free for one user. Compare prices, read on ${verified}.`,
    path,
    head: c.head,
    bodyClass: c.bodyClass,
    body,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      breadcrumb([
        { name: c.pageName, path: c.pagePath },
        { name: `distribute.you vs ${t.name}`, path },
      ]),
    ],
  });
}

export function renderToolAlternativesPage(c: ToolCluster): string {
  const names = c.tools.map((t) => t.name).join(", ");
  const newest = c.tools.map((t) => t.verifiedOn).sort().at(-1) ?? "";
  const Topic = c.topic[0].toUpperCase() + c.topic.slice(1);
  const rows = c.tools
    .map(
      (t) =>
        `<tr><th scope="row"><a href="${c.vsPath(t)}">${logo(t.domain, 20)}${esc(t.name)}</a></th><td>${esc(t.entryPrice)}</td><td>${esc(t.channel)}</td><td><a href="${esc(t.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(t.domain)}</a></td></tr>`,
    )
    .join("");
  const cards = c.tools
    .map(
      (t) => `<a class="cmp-card rv" href="${c.vsPath(t)}">
    <div class="cmp-card-top">${logo(t.domain, 32)}<div><b>${esc(t.name)} alternative</b><small>${esc(t.entryPrice)}</small></div></div>
    <p>${esc(t.oneLiner)}</p>
  </a>`,
    )
    .join("");
  const body = `<section class="hero cmp-hero">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <span class="eyebrow">${esc(Topic)} alternatives · Verified ${verifiedLabel(newest)}</span>
    <h1>${esc(Topic)} alternatives, side by side</h1>
    <p class="hero-sub">The price of each ${esc(c.topic)} tool, read from their own sites. Ours is first: an AI agent that brings buyers you chose to your website.</p>
    ${whyLine()}
  </div>
</section>
<section class="framed tint">
  <div class="wrap">
    <div class="cmp-table-wrap">
      <table class="cmp-table cmp-alt-table">
        <thead><tr><th scope="col">Tool</th><th scope="col">Entry price</th><th scope="col">${esc(c.channelLabel)}</th><th scope="col">Source</th></tr></thead>
        <tbody data-motion="reveal" data-motion-stagger>
          <tr class="us-row"><th scope="row"><a href="${c.pagePath}"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="20" height="20">distribute.you</a></th><td class="us">${esc(c.our.entryPrice)}</td><td class="us">${esc(c.our.channel)}</td><td class="us"><a href="/catalog">Our catalog</a></td></tr>
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
    title: `${Topic} alternatives: ${names} and distribute.you`,
    description: `The best ${c.topic} alternatives: ${names} and distribute.you, with prices read from each tool's own site.`,
    path: c.alternativesPath,
    head: c.head,
    bodyClass: c.bodyClass,
    body,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: `${Topic} alternatives`,
        url: `${SITE}${c.alternativesPath}`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "distribute.you", url: `${SITE}${c.pagePath}` },
          ...c.tools.map((t, i) => ({ "@type": "ListItem", position: i + 2, name: t.name, url: `${SITE}${c.vsPath(t)}` })),
        ],
      },
      breadcrumb([
        { name: c.pageName, path: c.pagePath },
        { name: "Alternatives", path: c.alternativesPath },
      ]),
    ],
  });
}
