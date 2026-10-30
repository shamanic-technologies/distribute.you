/**
 * The PPC Agency page's own comparison cluster (PAGE-PPC-AGENCY-1029):
 * `/ppc-agency/alternatives` and one `/ppc-agency/vs/<slug>` per agency in `ppc-agencies.ts`. Every figure about an agency is read from its own site,
 * shown with its source link and the day it was read; our column is `OUR_PPC_ROW`.
 *
 * Signature (refs #18, the default.com pricing table): the comparison table's cells dissolve
 * in one by one as it enters (`reveal` with stagger on the rows; the HTML is the final state).
 *
 * Alias-free: the unit tests render it directly.
 */
import type { Agency, AgencyFact } from "../agencies";
import { esc } from "../fleet-indexes";
import { OUR_PPC_ROW, PPC_AGENCIES, PPC_ALTERNATIVES_PATH, PPC_PAGE_PATH, ppcVsPath } from "../ppc-agencies";
import { SITE, WHY, breadcrumb, shell } from "../v2-shell";
import { AD_MANAGEMENT_PATH } from "../ad-management-tools";
import { callHtml } from "./gtm-agency";
import { ppcHead } from "./ppc-agency";

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
    { label: "Price", them: fact(a.pricing), us: esc(OUR_PPC_ROW.pricing) },
    { label: "Contract", them: fact(a.contract), us: esc(OUR_PPC_ROW.contract) },
    { label: "Channels", them: fact(a.channels), us: esc(OUR_PPC_ROW.channels) },
    { label: "Results", them: fact(a.guarantee), us: esc(OUR_PPC_ROW.guarantee) },
    { label: "Time to go live", them: a.launch ? fact(a.launch) : "Not stated", us: esc(OUR_PPC_ROW.launch) },
  ];
}

function faqFor(a: Agency) {
  return [
    {
      q: `Is distribute.you cheaper than ${a.name}?`,
      a: `Our fee is from $1K a month plus 10% of your budget. ${a.name}: ${a.pricing.text}`,
    },
    { q: `What does ${a.name} do best?`, a: a.whereTheyWin.join(" ") },
    { q: "Where does distribute.you put my paid budget?", a: "Into reaching the buyers we agree on, one message per person, by cold email from our own domains and on WhatsApp. Every click is judged human before it counts." },
    { q: "How fast do we go live?", a: OUR_PPC_ROW.launch },
  ];
}

export function renderPpcVsPage(a: Agency): string {
  const path = ppcVsPath(a);
  const rows = rowsFor(a)
    .map((r) => `<tr><th scope="row">${esc(r.label)}</th><td>${r.them}</td><td class="us">${r.us}</td></tr>`)
    .join("");
  const faq = faqFor(a);
  const description = `distribute.you vs ${a.name} as a PPC agency: price, contract, channels and results side by side, every ${a.name} figure read from their own site on ${verifiedLabel(a.verifiedOn)}.`;
  const others = PPC_AGENCIES.filter((x) => x.slug !== a.slug)
    .map((x) => `<a href="${ppcVsPath(x)}">distribute.you vs ${esc(x.name)}</a>`)
    .join("");
  const body = `${heroHtml(
    "PPC agency comparison",
    `distribute.you vs ${a.name}`,
    `${a.oneLiner.text} Here is how the two compare, for a company that wants its paid budget turned into buyers.`,
  )}
<section class="framed">
  <div class="wrap">
    <div class="ag-table-wrap">
      <table class="ag-table">
        <thead><tr><th scope="col"></th><th scope="col">${esc(a.name)}</th><th scope="col">distribute.you</th></tr></thead>
        <tbody data-motion="reveal" data-motion-stagger>
          <tr><th scope="row">Entry price</th><td>${esc(a.entryPrice)}</td><td class="us">${esc(OUR_PPC_ROW.entryPrice)}</td></tr>
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
      <li><span>You want your budget to reach buyers you chose, by name.</span></li>
      <li><span>You want only human clicks counted, and every sale traced to its buyer.</span></li>
      <li><span>You want to go live in 5 days, from one call.</span></li>
    </ul><a class="btn btn-accent btn-lg" href="${PPC_PAGE_PATH}">See the PPC Agency</a></div>
  </div>
</section>
<section class="framed">
  <div class="wrap">
    <div class="section-head center"><h2>Questions</h2></div>
    <div class="ag-faq">${faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</div>
    <nav class="ag-links" aria-label="Other PPC agency comparisons">${others}<a href="${PPC_ALTERNATIVES_PATH}">PPC agency alternatives</a></nav>
  </div>
</section>
${callHtml(AD_MANAGEMENT_PATH)}`;
  return shell({
    title: `distribute.you vs ${a.name}: PPC agency price and results compared`,
    description,
    path,
    head: ppcHead(),
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
        { name: "PPC Agency", path: PPC_PAGE_PATH },
        { name: `vs ${a.name}`, path },
      ]),
    ],
  });
}

export function renderPpcAlternativesPage(): string {
  const names = PPC_AGENCIES.map((a) => a.name).join(", ");
  const tableRows = PPC_AGENCIES.map(
    (a) => `<tr><th scope="row"><a href="${ppcVsPath(a)}">${esc(a.name)}</a></th><td>${esc(a.entryPrice)}</td><td>${esc(a.channels.text)}</td><td><a href="${esc(a.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(a.domain)}</a></td></tr>`,
  ).join("");
  const cards = PPC_AGENCIES.map(
    (a) => `<div class="ag-card"><h3><a href="${ppcVsPath(a)}">${esc(a.name)}</a></h3><p>${esc(a.oneLiner.text)}</p><p><b>Entry price:</b> ${esc(a.entryPrice)}</p><a class="btn btn-outline" href="${ppcVsPath(a)}">distribute.you vs ${esc(a.name)}</a></div>`,
  ).join("");
  const description = `The best PPC agency alternatives: ${names} and distribute.you, with prices read from each agency's own site.`;
  const body = `${heroHtml(
    "PPC agency alternatives",
    "PPC agency alternatives, side by side",
    "Price, contract and channels for each PPC agency, read from their own sites. Ours is first.",
  )}
<section class="framed">
  <div class="wrap">
    <div class="ag-table-wrap">
      <table class="ag-table">
        <thead><tr><th scope="col">Agency</th><th scope="col">Entry price</th><th scope="col">Channels</th><th scope="col">Source</th></tr></thead>
        <tbody data-motion="reveal" data-motion-stagger>
          <tr><th scope="row"><a href="${PPC_PAGE_PATH}">distribute.you</a></th><td class="us">${esc(OUR_PPC_ROW.entryPrice)}</td><td class="us">${esc(OUR_PPC_ROW.channels)}</td><td class="us"><a href="/indexes">Live indexes</a></td></tr>
          ${tableRows}
        </tbody>
      </table>
    </div>
    <p class="ag-src">Agency figures read on ${verifiedLabel(PPC_AGENCIES[0].verifiedOn)}.</p>
  </div>
</section>
<section class="framed tint">
  <div class="wrap ag-cards">${cards}</div>
</section>
${callHtml(AD_MANAGEMENT_PATH)}`;
  return shell({
    title: `PPC agency alternatives: ${names} and distribute.you`,
    description,
    path: PPC_ALTERNATIVES_PATH,
    head: ppcHead(),
    bodyClass: "ag",
    noCta: true,
    body,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "PPC agency alternatives",
        url: `${SITE}${PPC_ALTERNATIVES_PATH}`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "distribute.you", url: `${SITE}${PPC_PAGE_PATH}` },
          ...PPC_AGENCIES.map((a, i) => ({ "@type": "ListItem", position: i + 2, name: a.name, url: `${SITE}${ppcVsPath(a)}` })),
        ],
      },
      breadcrumb([
        { name: "distribute.you", path: "/" },
        { name: "PPC Agency", path: PPC_PAGE_PATH },
        { name: "Alternatives", path: PPC_ALTERNATIVES_PATH },
      ]),
    ],
  });
}
