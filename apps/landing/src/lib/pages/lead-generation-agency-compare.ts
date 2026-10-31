/**
 * The Lead Generation Agency page's own comparison cluster (PAGE-LEADGEN-AGENCY-1029):
 * `/lead-generation-agency/alternatives` and one `/lead-generation-agency/vs/<slug>` per agency
 * in `lead-generation-agencies.ts`. Every figure about an agency is read from its own site,
 * shown with its source link and the day it was read; our column is `OUR_LEADGEN_ROW`.
 *
 * Signature (refs #18, the default.com pricing table): the comparison table's cells dissolve
 * in one by one as it enters (`reveal` with stagger on the rows; the HTML is the final state).
 *
 * Alias-free: the unit tests render it directly.
 */
import type { Agency, AgencyFact } from "../agencies";
import { esc } from "../fleet-indexes";
import {
  LEADGEN_AGENCIES,
  LEADGEN_ALTERNATIVES_PATH,
  LEADGEN_PAGE_PATH,
  OUR_LEADGEN_ROW,
  leadgenVsPath,
} from "../lead-generation-agencies";
import { SITE, WHY, breadcrumb, shell } from "../v2-shell";
import { callHtml } from "./gtm-agency";
import { leadgenHead } from "./lead-generation-agency";

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
    <h1>${esc(h1)}</h1>
    <p class="lead">${esc(lead)}</p>
    <p class="why">${WHY}</p>
  </div>
</section>`;
}

function rowsFor(a: Agency): { label: string; them: string; us: string }[] {
  return [
    { label: "Price", them: fact(a.pricing), us: esc(OUR_LEADGEN_ROW.pricing) },
    { label: "Contract", them: fact(a.contract), us: esc(OUR_LEADGEN_ROW.contract) },
    { label: "Channels", them: fact(a.channels), us: esc(OUR_LEADGEN_ROW.channels) },
    { label: "Results", them: fact(a.guarantee), us: esc(OUR_LEADGEN_ROW.guarantee) },
    { label: "Time to first leads", them: a.launch ? fact(a.launch) : "Not stated", us: esc(OUR_LEADGEN_ROW.launch) },
  ];
}

function faqFor(a: Agency) {
  return [
    {
      q: `Is distribute.you cheaper than ${a.name}?`,
      a: `Our fee is from $1K a month plus 10% of your budget. ${a.name}: ${a.pricing.text}`,
    },
    { q: `What does ${a.name} do best?`, a: a.whereTheyWin.join(" ") },
    { q: "How does distribute.you qualify a lead?", a: "Our AI agents find people who match the buyer we agree on, judge each profile and keep only the ones who fit, with the reason written down." },
    { q: "How fast do the first leads arrive?", a: OUR_LEADGEN_ROW.launch },
  ];
}

export function renderLeadgenVsPage(a: Agency): string {
  const path = leadgenVsPath(a);
  const rows = rowsFor(a)
    .map((r) => `<tr><th scope="row">${esc(r.label)}</th><td>${r.them}</td><td class="us">${r.us}</td></tr>`)
    .join("");
  const faq = faqFor(a);
  const description = `distribute.you vs ${a.name} for B2B lead generation: price, contract, channels and results side by side, every ${a.name} figure read from their own site on ${verifiedLabel(a.verifiedOn)}.`;
  const others = LEADGEN_AGENCIES.filter((x) => x.slug !== a.slug)
    .map((x) => `<a href="${leadgenVsPath(x)}">distribute.you vs ${esc(x.name)}</a>`)
    .join("");
  const body = `${heroHtml(
    "Lead generation agency comparison",
    `distribute.you vs ${a.name}`,
    `${a.oneLiner.text} Here is how the two compare, for a company that wants qualified leads found and worked for it.`,
  )}
<section class="framed">
  <div class="wrap">
    <div class="ag-table-wrap">
      <table class="ag-table">
        <thead><tr><th scope="col"></th><th scope="col">${esc(a.name)}</th><th scope="col">distribute.you</th></tr></thead>
        <tbody data-motion="reveal" data-motion-stagger>
          <tr><th scope="row">Entry price</th><td>${esc(a.entryPrice)}</td><td class="us">${esc(OUR_LEADGEN_ROW.entryPrice)}</td></tr>
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
      <li><span>You want every lead judged before anyone writes to them, with the reason it fits.</span></li>
      <li><span>You want leads who act, counted on your dashboard.</span></li>
      <li><span>You want your first leads in 5 days, from one call.</span></li>
    </ul><a class="btn btn-accent btn-lg" href="${LEADGEN_PAGE_PATH}">See the Lead Generation Agency</a></div>
  </div>
</section>
<section class="framed">
  <div class="wrap">
    <div class="section-head center"><h2>Questions</h2></div>
    <div class="ag-faq">${faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("")}</div>
    <nav class="ag-links" aria-label="Other lead generation agency comparisons">${others}<a href="${LEADGEN_ALTERNATIVES_PATH}">Lead generation agency alternatives</a></nav>
  </div>
</section>
${callHtml()}`;
  return shell({
    title: `distribute.you vs ${a.name}: lead generation agency price and results compared`,
    description,
    path,
    head: leadgenHead(),
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
        { name: "Lead Generation Agency", path: LEADGEN_PAGE_PATH },
        { name: `vs ${a.name}`, path },
      ]),
    ],
  });
}

export function renderLeadgenAlternativesPage(): string {
  const names = LEADGEN_AGENCIES.map((a) => a.name).join(", ");
  const tableRows = LEADGEN_AGENCIES.map(
    (a) => `<tr><th scope="row"><a href="${leadgenVsPath(a)}">${esc(a.name)}</a></th><td>${esc(a.entryPrice)}</td><td>${esc(a.channels.text)}</td><td><a href="${esc(a.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(a.domain)}</a></td></tr>`,
  ).join("");
  const cards = LEADGEN_AGENCIES.map(
    (a) => `<div class="ag-card"><h3><a href="${leadgenVsPath(a)}">${esc(a.name)}</a></h3><p>${esc(a.oneLiner.text)}</p><p><b>Entry price:</b> ${esc(a.entryPrice)}</p><a class="btn btn-outline" href="${leadgenVsPath(a)}">distribute.you vs ${esc(a.name)}</a></div>`,
  ).join("");
  const description = `The best B2B lead generation agency alternatives: ${names} and distribute.you, with prices read from each agency's own site.`;
  const body = `${heroHtml(
    "Lead generation agency alternatives",
    "Lead generation agency alternatives, side by side",
    "Price, contract and channels for each B2B lead generation agency, read from their own sites. Ours is first.",
  )}
<section class="framed">
  <div class="wrap">
    <div class="ag-table-wrap">
      <table class="ag-table">
        <thead><tr><th scope="col">Agency</th><th scope="col">Entry price</th><th scope="col">Channels</th><th scope="col">Source</th></tr></thead>
        <tbody data-motion="reveal" data-motion-stagger>
          <tr><th scope="row"><a href="${LEADGEN_PAGE_PATH}">distribute.you</a></th><td class="us">${esc(OUR_LEADGEN_ROW.entryPrice)}</td><td class="us">${esc(OUR_LEADGEN_ROW.channels)}</td><td class="us"><a href="/indexes">Live indexes</a></td></tr>
          ${tableRows}
        </tbody>
      </table>
    </div>
    <p class="ag-src">Agency figures read on ${verifiedLabel(LEADGEN_AGENCIES[0].verifiedOn)}.</p>
  </div>
</section>
<section class="framed tint">
  <div class="wrap ag-cards">${cards}</div>
</section>
${callHtml()}`;
  return shell({
    title: `Lead generation agency alternatives: ${names} and distribute.you`,
    description,
    path: LEADGEN_ALTERNATIVES_PATH,
    head: leadgenHead(),
    bodyClass: "ag",
    noCta: true,
    body,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Lead generation agency alternatives",
        url: `${SITE}${LEADGEN_ALTERNATIVES_PATH}`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "distribute.you", url: `${SITE}${LEADGEN_PAGE_PATH}` },
          ...LEADGEN_AGENCIES.map((a, i) => ({ "@type": "ListItem", position: i + 2, name: a.name, url: `${SITE}${leadgenVsPath(a)}` })),
        ],
      },
      breadcrumb([
        { name: "distribute.you", path: "/" },
        { name: "Lead Generation Agency", path: LEADGEN_PAGE_PATH },
        { name: "Alternatives", path: LEADGEN_ALTERNATIVES_PATH },
      ]),
    ],
  });
}
