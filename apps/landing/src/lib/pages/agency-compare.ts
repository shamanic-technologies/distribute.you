/**
 * The Revenue Agency page's own comparison cluster (PAGE-REVENUE-AGENCY-1029):
 * `/revenue-agency/alternatives` and one `/revenue-agency/vs/<slug>` per agency in
 * `agencies.ts`. Every figure about an agency is read from its own site, shown with its
 * source link and the day it was read; our column is `OUR_AGENCY_ROW`, stated once.
 *
 * Alias-free: the unit tests render it directly.
 */
import { AGENCIES, ALTERNATIVES_PATH, AGENCY_PAGE_PATH, OUR_AGENCY_ROW, agencyVsPath, type Agency, type AgencyFact } from "../agencies";
import { esc } from "../fleet-indexes";
import { SITE, WHY, breadcrumb, shell } from "../v2-shell";
import { agencyHead, callHtml } from "./revenue-agency";

function verifiedLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
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
    { label: "Price", them: fact(a.pricing), us: esc(OUR_AGENCY_ROW.pricing) },
    { label: "Contract", them: fact(a.contract), us: esc(OUR_AGENCY_ROW.contract) },
    { label: "Channels", them: fact(a.channels), us: esc(OUR_AGENCY_ROW.channels) },
    { label: "Results", them: fact(a.guarantee), us: esc(OUR_AGENCY_ROW.guarantee) },
    { label: "Time to launch", them: a.launch ? fact(a.launch) : "Not stated", us: esc(OUR_AGENCY_ROW.launch) },
  ];
}

const FAQ_FOR = (a: Agency) => [
  {
    q: `Is distribute.you cheaper than ${a.name}?`,
    a: `Our fee is from $1K a month plus 10% of your budget. ${a.name}: ${a.pricing.text}`,
  },
  {
    q: `What does ${a.name} do best?`,
    a: a.whereTheyWin.join(" "),
  },
  {
    q: "How fast can distribute.you start?",
    a: OUR_AGENCY_ROW.launch,
  },
];

export function renderAgencyVsPage(a: Agency): string {
  const path = agencyVsPath(a);
  const rows = rowsFor(a)
    .map((r) => `<tr><th scope="row">${esc(r.label)}</th><td>${r.them}</td><td class="us">${r.us}</td></tr>`)
    .join("");
  const faq = FAQ_FOR(a);
  const description = `distribute.you vs ${a.name}: price, contract, channels and results side by side, every ${a.name} figure read from their own site on ${verifiedLabel(a.verifiedOn)}.`;
  const others = AGENCIES.filter((x) => x.slug !== a.slug)
    .map((x) => `<a href="${agencyVsPath(x)}">distribute.you vs ${esc(x.name)}</a>`)
    .join("");
  const body = `${heroHtml(
    "Agency comparison",
    `distribute.you vs ${a.name}`,
    `${a.oneLiner.text} Here is how the two compare, for a company that wants its growth run for it.`,
  )}
<section class="framed">
  <div class="wrap">
    <div class="ag-table-wrap" data-motion="reveal">
      <table class="ag-table">
        <thead><tr><th scope="col"></th><th scope="col">${esc(a.name)}</th><th scope="col">distribute.you</th></tr></thead>
        <tbody>
          <tr><th scope="row">Entry price</th><td>${esc(a.entryPrice)}</td><td class="us">${esc(OUR_AGENCY_ROW.entryPrice)}</td></tr>
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
      <li><span>You want the best growth on the market, run with data from every campaign we run.</span></li>
      <li><span>You want your team to see every lead, email and reply.</span></li>
      <li><span>You want to be live in 5 days, from one call.</span></li>
    </ul><a class="btn btn-accent btn-lg" href="${AGENCY_PAGE_PATH}">See the Revenue Agency</a></div>
  </div>
</section>
<section class="framed">
  <div class="wrap">
    <div class="section-head center"><h2>Questions</h2></div>
    <div class="ag-faq">${faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</div>
    <nav class="ag-links" aria-label="Other agency comparisons">${others}<a href="${ALTERNATIVES_PATH}">Agency alternatives</a></nav>
  </div>
</section>
${callHtml()}`;
  return shell({
    title: `distribute.you vs ${a.name}: agency price, contract and results compared`,
    description,
    path,
    head: agencyHead(),
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
        { name: "Revenue Agency", path: AGENCY_PAGE_PATH },
        { name: `vs ${a.name}`, path },
      ]),
    ],
  });
}

export function renderAgencyAlternativesPage(): string {
  const tableRows = AGENCIES.map(
    (a) => `<tr><th scope="row"><a href="${agencyVsPath(a)}">${esc(a.name)}</a></th><td>${esc(a.entryPrice)}</td><td>${esc(a.channels.text)}</td><td><a href="${esc(a.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(a.domain)}</a></td></tr>`,
  ).join("");
  const cards = AGENCIES.map(
    (a) => `<div class="ag-card"><h3><a href="${agencyVsPath(a)}">${esc(a.name)}</a></h3><p>${esc(a.oneLiner.text)}</p><p><b>Entry price:</b> ${esc(a.entryPrice)}</p><a class="btn btn-outline" href="${agencyVsPath(a)}">distribute.you vs ${esc(a.name)}</a></div>`,
  ).join("");
  const description = `The best revenue and growth agency alternatives: ${AGENCIES.map((a) => a.name).join(", ")} and distribute.you, with prices read from each agency's own site.`;
  const body = `${heroHtml(
    "Agency alternatives",
    "Revenue agency alternatives, side by side",
    "Price, contract and channels for each agency, read from their own sites. Ours is first.",
  )}
<section class="framed">
  <div class="wrap">
    <div class="ag-table-wrap" data-motion="reveal">
      <table class="ag-table">
        <thead><tr><th scope="col">Agency</th><th scope="col">Entry price</th><th scope="col">Channels</th><th scope="col">Source</th></tr></thead>
        <tbody>
          <tr><th scope="row"><a href="${AGENCY_PAGE_PATH}">distribute.you</a></th><td class="us">${esc(OUR_AGENCY_ROW.entryPrice)}</td><td class="us">${esc(OUR_AGENCY_ROW.channels)}</td><td class="us"><a href="/indexes">Live indexes</a></td></tr>
          ${tableRows}
        </tbody>
      </table>
    </div>
    <p class="ag-src">Agency figures read on ${verifiedLabel(AGENCIES[0].verifiedOn)}.</p>
  </div>
</section>
<section class="framed tint">
  <div class="wrap ag-cards">${cards}</div>
</section>
${callHtml()}`;
  return shell({
    title: `Revenue agency alternatives: ${AGENCIES.map((a) => a.name).join(", ")} and distribute.you`,
    description,
    path: ALTERNATIVES_PATH,
    head: agencyHead(),
    bodyClass: "ag",
    noCta: true,
    body,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Revenue agency alternatives",
        url: `${SITE}${ALTERNATIVES_PATH}`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "distribute.you", url: `${SITE}${AGENCY_PAGE_PATH}` },
          ...AGENCIES.map((a, i) => ({ "@type": "ListItem", position: i + 2, name: a.name, url: `${SITE}${agencyVsPath(a)}` })),
        ],
      },
      breadcrumb([
        { name: "distribute.you", path: "/" },
        { name: "Revenue Agency", path: AGENCY_PAGE_PATH },
        { name: "Alternatives", path: ALTERNATIVES_PATH },
      ]),
    ],
  });
}
