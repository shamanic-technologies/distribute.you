/**
 * The Database Reactivation Agency page's own comparison cluster (PAGE-DATABASE-REACTIVATION-AGENCY-1030):
 * `/database-reactivation-agency/alternatives` and one `/database-reactivation-agency/vs/<slug>` per
 * agency in `reactivation-agencies.ts`. Every figure about an agency is read from its own site,
 * shown with its source link and the day it was read; our column is `OUR_REACTIVATION_ROW`.
 *
 * Signature (refs #18, the default.com pricing table): the comparison table's cells dissolve
 * in one by one as it enters (`reveal` with stagger on the rows; the HTML is the final state).
 *
 * Alias-free: the unit tests render it directly.
 */
import type { Agency, AgencyFact } from "../agencies";
import { esc } from "../fleet-indexes";
import {
  REACTIVATION_AGENCIES,
  REACTIVATION_ALTERNATIVES_PATH,
  REACTIVATION_PAGE_PATH,
  OUR_REACTIVATION_ROW,
  reactivationVsPath,
} from "../reactivation-agencies";
import { SITE, WHY, breadcrumb, shell } from "../v2-shell";
import { callHtml } from "./gtm-agency";
import { reactivationHead } from "./database-reactivation-agency";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function verifiedLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function fact(f: AgencyFact): string {
  return `${esc(f.text)} <a href="${esc(f.sourceUrl)}" rel="nofollow noopener" target="_blank">Source</a>`;
}

function heroHtml(eyebrow: string, h1: string, lead: string): string {
  return `<section class="ag-page-hero ag-dark">
  <div class="wrap" data-motion="reveal" data-motion-stagger>
    <span class="eyebrow">${esc(eyebrow)}</span>
    <h1 style="margin-top:18px">${esc(h1)}</h1>
    <p class="lead">${esc(lead)}</p>
    <p class="why">${WHY}</p>
  </div>
</section>`;
}

function rowsFor(a: Agency): { label: string; them: string; us: string }[] {
  return [
    { label: "Price", them: fact(a.pricing), us: esc(OUR_REACTIVATION_ROW.pricing) },
    { label: "Contract", them: fact(a.contract), us: esc(OUR_REACTIVATION_ROW.contract) },
    { label: "Channels", them: fact(a.channels), us: esc(OUR_REACTIVATION_ROW.channels) },
    { label: "Results", them: fact(a.guarantee), us: esc(OUR_REACTIVATION_ROW.guarantee) },
    { label: "Time to go live", them: a.launch ? fact(a.launch) : "Not stated", us: esc(OUR_REACTIVATION_ROW.launch) },
  ];
}

function faqFor(a: Agency) {
  return [
    {
      q: `Is distribute.you cheaper than ${a.name}?`,
      a: `Our fee is from $1K a month plus 10% of your budget. ${a.name}: ${a.pricing.text}`,
    },
    { q: `What does ${a.name} do best?`, a: a.whereTheyWin.join(" ") },
    { q: "How does distribute.you reactivate a database?", a: "Our team connects your CRM and product tools, and our AI agents do the work: they pick the contacts showing a sign of life, write to each one by email from our own domains or on WhatsApp, answer every reply and book the call." },
    { q: "How fast do we go live?", a: OUR_REACTIVATION_ROW.launch },
  ];
}

export function renderReactivationVsPage(a: Agency): string {
  const path = reactivationVsPath(a);
  const rows = rowsFor(a)
    .map((r) => `<tr><th scope="row">${esc(r.label)}</th><td>${r.them}</td><td class="us">${r.us}</td></tr>`)
    .join("");
  const faq = faqFor(a);
  const description = `distribute.you vs ${a.name} as a database reactivation agency: price, contract, channels and results side by side, every ${a.name} figure read from their own site on ${verifiedLabel(a.verifiedOn)}.`;
  const others = REACTIVATION_AGENCIES.filter((x) => x.slug !== a.slug)
    .map((x) => `<a href="${reactivationVsPath(x)}">distribute.you vs ${esc(x.name)}</a>`)
    .join("");
  const body = `${heroHtml(
    "Database reactivation agency comparison",
    `distribute.you vs ${a.name}`,
    `${a.oneLiner.text} Here is how the two compare, for a company that wants its past leads back in conversation.`,
  )}
<section class="framed">
  <div class="wrap">
    <div class="ag-table-wrap">
      <table class="ag-table">
        <thead><tr><th scope="col"></th><th scope="col">${esc(a.name)}</th><th scope="col">distribute.you</th></tr></thead>
        <tbody data-motion="reveal" data-motion-stagger>
          <tr><th scope="row">Entry price</th><td>${esc(a.entryPrice)}</td><td class="us">${esc(OUR_REACTIVATION_ROW.entryPrice)}</td></tr>
          ${rows}
        </tbody>
      </table>
    </div>
    <p class="ag-src">Every ${esc(a.name)} figure was read on <a href="${esc(a.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(a.domain)}</a> on ${verifiedLabel(a.verifiedOn)}. They state: ${esc(a.claim.text)}</p>
  </div>
</section>
<section class="framed tint">
  <div class="wrap ag-two">
    <div class="ag-card"><h3>Choose ${esc(a.name)} if</h3><ul>${a.chooseThemIf.map((l) => `<li><span>${esc(l)}</span></li>`).join("")}</ul></div>
    <div class="ag-card feat"><h3>Choose distribute.you if</h3><ul>
      <li><span>You want past leads woken by email and WhatsApp, each reply answered.</span></li>
      <li><span>You want every lead to keep a next follow-up date, read from your own tools.</span></li>
      <li><span>You want to go live in 5 days, from one call.</span></li>
    </ul><a class="btn btn-accent btn-lg" href="${REACTIVATION_PAGE_PATH}">See the Database Reactivation Agency</a></div>
  </div>
</section>
<section class="framed">
  <div class="wrap">
    <div class="section-head center"><h2>Questions</h2></div>
    <div class="ag-faq">${faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</div>
    <nav class="ag-links" aria-label="Other database reactivation agency comparisons">${others}<a href="${REACTIVATION_ALTERNATIVES_PATH}">Database reactivation agency alternatives</a></nav>
  </div>
</section>
${callHtml()}`;
  return shell({
    title: `distribute.you vs ${a.name}: database reactivation agency price and results compared`,
    description,
    path,
    head: reactivationHead(),
    bodyClass: "ag",
    noCta: true,
    body,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      breadcrumb([
        { name: "distribute.you", path: "/" },
        { name: "Database Reactivation Agency", path: REACTIVATION_PAGE_PATH },
        { name: `vs ${a.name}`, path },
      ]),
    ],
  });
}

export function renderReactivationAlternativesPage(): string {
  const names = REACTIVATION_AGENCIES.map((a) => a.name).join(", ");
  const tableRows = REACTIVATION_AGENCIES.map(
    (a) => `<tr><th scope="row"><a href="${reactivationVsPath(a)}">${esc(a.name)}</a></th><td>${esc(a.entryPrice)}</td><td>${esc(a.channels.text)}</td><td><a href="${esc(a.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(a.domain)}</a></td></tr>`,
  ).join("");
  const cards = REACTIVATION_AGENCIES.map(
    (a) => `<div class="ag-card"><h3><a href="${reactivationVsPath(a)}">${esc(a.name)}</a></h3><p>${esc(a.oneLiner.text)}</p><p><b>Entry price:</b> ${esc(a.entryPrice)}</p><a class="btn btn-outline" href="${reactivationVsPath(a)}">distribute.you vs ${esc(a.name)}</a></div>`,
  ).join("");
  const description = `The best database reactivation agency alternatives: ${names} and distribute.you, with prices read from each agency's own site.`;
  const body = `${heroHtml(
    "Database reactivation agency alternatives",
    "Database reactivation agency alternatives, side by side",
    "Price, contract and channels for each database reactivation agency, read from their own sites. Ours is first.",
  )}
<section class="framed">
  <div class="wrap">
    <div class="ag-table-wrap">
      <table class="ag-table">
        <thead><tr><th scope="col">Agency</th><th scope="col">Entry price</th><th scope="col">Channels</th><th scope="col">Source</th></tr></thead>
        <tbody data-motion="reveal" data-motion-stagger>
          <tr><th scope="row"><a href="${REACTIVATION_PAGE_PATH}">distribute.you</a></th><td class="us">${esc(OUR_REACTIVATION_ROW.entryPrice)}</td><td class="us">${esc(OUR_REACTIVATION_ROW.channels)}</td><td class="us"><a href="/indexes">Live indexes</a></td></tr>
          ${tableRows}
        </tbody>
      </table>
    </div>
    <p class="ag-src">Agency figures read on ${verifiedLabel(REACTIVATION_AGENCIES[0].verifiedOn)}.</p>
  </div>
</section>
<section class="framed tint">
  <div class="wrap ag-cards">${cards}</div>
</section>
${callHtml()}`;
  return shell({
    title: `Database reactivation agency alternatives: ${names} and distribute.you`,
    description,
    path: REACTIVATION_ALTERNATIVES_PATH,
    head: reactivationHead(),
    bodyClass: "ag",
    noCta: true,
    body,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Database reactivation agency alternatives",
        url: `${SITE}${REACTIVATION_ALTERNATIVES_PATH}`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "distribute.you", url: `${SITE}${REACTIVATION_PAGE_PATH}` },
          ...REACTIVATION_AGENCIES.map((a, i) => ({ "@type": "ListItem", position: i + 2, name: a.name, url: `${SITE}${reactivationVsPath(a)}` })),
        ],
      },
      breadcrumb([
        { name: "distribute.you", path: "/" },
        { name: "Database Reactivation Agency", path: REACTIVATION_PAGE_PATH },
        { name: "Alternatives", path: REACTIVATION_ALTERNATIVES_PATH },
      ]),
    ],
  });
}
