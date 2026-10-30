/**
 * `/website-traffic-agency`: the Website Visits outcome, Agency buyer (PAGE-TRAFFIC-1030, owner
 * 2026-10-29). SEO target "website traffic agency" (10 to 20 US searches a month). Never "seo
 * agency": we do not sell SEO, and the page says how we bring visitors instead.
 *
 * Buyer: a company that makes cash and wants the right people on its website. Same offer as
 * every Agency page ("From $1K/month + 10% of budget", Book a call), told for THIS outcome and
 * only with what we run today: our team and our agents invite the buyers we agree on, by cold
 * email from our own domains and on WhatsApp; a visit counts only when our AI judge reads the
 * click as human; a visitor who signs up is followed up on WhatsApp (legs start → website
 * visit → signup). No guarantee here: the Agency guarantee is for meetings pages only.
 *
 * Signature motion (refs #12, graphed data beams, DARK): the beam map in the hero
 * (`traffic-shared.ts` `beamMapHtml`, motion.js `traffic-beams`), then the darker sticky story.
 *
 * Every figure is READ at render: the website visit indexes (`/v1/public/indexes`, by outcome);
 * a failed read drops its block. The agencies compared: `traffic-agencies.ts`, read on their
 * own sites and dated.
 *
 * Alias-free: the unit tests render it directly.
 */
import { EXPECTED_LABEL, esc, isExpected, statusLegend, type IndexList } from "../fleet-indexes";
import {
  OUR_TRAFFIC_AGENCY_ROW,
  TRAFFIC_AGENCIES,
  TRAFFIC_AGENCY_ALTERNATIVES_PATH,
  TRAFFIC_AGENCY_PATH,
  trafficAgencyVsPath,
} from "../traffic-agencies";
import { TRAFFIC_AUTOMATION_PATH } from "../traffic-tools";
import { SITE, WHY, breadcrumb, shell } from "../v2-shell";
import { AGENCY_FEE_BASE_USD, BOOK_ATTRS, CALC_SCRIPT, agencyHead, callHtml, indexCardHtml, priceHtml } from "./gtm-agency";
import { LOGO, TRAFFIC_CSS, beamMapHtml, verifiedLabel, visitIndexes } from "./traffic-shared";

/** The Agency stylesheet plus the traffic layer. */
export function trafficAgencyHead(): string {
  return `${agencyHead()}\n${TRAFFIC_CSS}`;
}

function heroHtml(): string {
  return `<section class="ag-hero ag-dark tr-hero-a">
  <div class="wrap ag-hero-grid">
    <div data-motion="reveal" data-motion-stagger>
      <span class="eyebrow">Website Traffic Agency for B2B</span>
      <h1 style="margin-top:18px">The website traffic agency that brings your buyers.</h1>
      <p class="lead">Our team and our AI agents invite the people who buy from you to your website, by email and WhatsApp. Every visit is judged human, with a role and a company behind it.</p>
      <p class="why">${WHY}</p>
      <div class="ag-ctas">
        <a class="btn btn-accent btn-lg" ${BOOK_ATTRS}>Book a call</a>
        <a class="btn btn-lg btn-ghost-d" href="#how">See how we bring visitors</a>
      </div>
      <p class="ag-price-line"><b>From $1K/month + 10% of budget.</b> Live in 5 days.</p>
    </div>
    ${beamMapHtml("yourcompany.com", "dark")}
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Sticky story (darker variant): from your buyer to a visit with a name
// ---------------------------------------------------------------------------

export const STORY_STEPS = [
  { title: "We agree on who should visit", line: "On our first call we pick your buyers and the page each one should see." },
  { title: "We invite each buyer", line: "One message per person with a reason to look, by email from our own domains or on WhatsApp." },
  { title: "We count only people", line: "Our AI judge reads every click. Link scanners never count as a visit." },
  { title: "We follow each visitor", line: "A visitor who signs up hears from us on WhatsApp, until they become a client." },
];

function storyHtml(): string {
  const steps = STORY_STEPS.map(
    (s, i) => `<li class="ag-step" data-step="${i + 1}"><span class="n">${i + 1}</span><b>${esc(s.title)}</b><span>${esc(s.line)}</span></li>`,
  ).join("");
  return `<section class="ag-story tr-story" id="how" data-motion="sticky-story">
  <div class="wrap ag-story-grid">
    <div>
      <div class="section-head">
        <span class="eyebrow">How we bring visitors</span>
        <h2 style="margin-top:14px">The right people, on the right page.</h2>
        <p>Website traffic you choose, by name. Our team runs it, our agents do the work every day.</p>
      </div>
      <ol class="ag-steps">${steps}</ol>
    </div>
    <div class="ag-stage tr-stage-d" aria-hidden="true">
      <div class="ag-scene" data-scene="1">
        <span class="ag-tag">Who visits which page, agreed on our first call</span>
        <ul class="tr-map-list">
          <li><span class="chip">Head of Growth, SaaS</span><i></i><b>/pricing</b></li>
          <li><span class="chip">Founder, fintech</span><i></i><b>/demo</b></li>
          <li><span class="chip">VP Sales, logistics</span><i></i><b>/case-study</b></li>
        </ul>
      </div>
      <div class="ag-scene" data-scene="2">
        <span class="ag-tag">One invitation per buyer</span>
        <div class="ag-mail"><div class="h"><span>From: <b>distribute.you</b></span><span>Subject: <b>The page you asked about</b></span></div>
        <p>Hi, you mentioned your team is comparing tools.</p>
        <p>This short page shows how teams like yours set up the tool. Worth two minutes?</p></div>
        <div class="tr-wa-d"><span>WhatsApp</span>Hi, our new pricing calculator is live. Want the link?</div>
      </div>
      <div class="ag-scene" data-scene="3">
        <span class="ag-tag">Every click judged</span>
        <div class="tr-click yes"><b>Head of Growth</b><span>Two minutes on your pricing page</span><em>Human</em></div>
        <div class="tr-click no"><b>Mail security scanner</b><span>Followed the link in under a second</span><em>Not counted</em></div>
        <div class="tr-click yes"><b>Founder</b><span>Opened your demo page from WhatsApp</span><em>Human</em></div>
      </div>
      <div class="ag-scene" data-scene="4">
        <span class="ag-tag">One visitor, followed</span>
        <ol class="tr-trail-d">
          <li><b>Visited /pricing</b><small>From our email, judged human</small></li>
          <li><b>Signed up</b><small>The same afternoon</small></li>
          <li><b>WhatsApp: &ldquo;Want a hand with your setup?&rdquo;</b><small>Answered the next morning</small></li>
          <li class="hot"><b>Paid client</b><small>Counted on your dashboard</small></li>
        </ol>
      </div>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// What you see each week: the visitors, named
// ---------------------------------------------------------------------------

export const WEEK_ROWS = [
  { who: "Head of Growth", org: "B2B SaaS, 40 people", page: "/pricing", via: "Email", next: "Signed up" },
  { who: "Founder", org: "Fintech startup", page: "/demo", via: "WhatsApp", next: "Asked for a call" },
  { who: "VP Sales", org: "Logistics software", page: "/case-study", via: "Email", next: "Follow-up planned" },
  { who: "Marketing lead", org: "Online store", page: "/", via: "WhatsApp", next: "Follow-up planned" },
];

function weekHtml(): string {
  const rows = WEEK_ROWS.map(
    (r) =>
      `<tr><th scope="row"><b>${esc(r.who)}</b><small>${esc(r.org)}</small></th><td><code>${esc(r.page)}</code></td><td>${esc(r.via)}</td><td><span class="tr-human">Human</span></td><td>${esc(r.next)}</td></tr>`,
  ).join("");
  return `<section class="framed" id="visits">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Every visit, named</span>
      <h2 style="margin-top:14px">Your traffic report reads like a list of buyers.</h2>
      <p>Each visit comes with the role and company behind it, the message that brought them and what they did next. Your sales team knows who to call first.</p>
    </div>
    <div class="ag-table-wrap tr-week" data-motion="reveal">
      <table class="ag-table">
        <thead><tr><th scope="col">Visitor</th><th scope="col">Page</th><th scope="col">Invited by</th><th scope="col">Judged</th><th scope="col">Next</th></tr></thead>
        <tbody data-motion="reveal" data-motion-stagger>${rows}</tbody>
      </table>
    </div>
    <p class="ag-src">A preview of the dashboard. Your own visitors appear there from your first week.</p>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Proof: the live website visit indexes
// ---------------------------------------------------------------------------

export function trafficProofHtml(list: IndexList | null): string {
  const rows = visitIndexes(list);
  if (!list || !rows.length) return "";
  const n = rows.length;
  const cards = rows.map((i, k) => indexCardHtml(i, n === 1 ? 0 : k / n)).join("");
  return `<section class="ag-dark ag-proof" id="data" data-motion="scrub">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Our data, live</span>
      <h2 style="margin-top:14px">What a human visit costs, read live.</h2>
      <p>Cost per click and click rate, read from every campaign we run and recorded every day. Your campaign starts from our best one.</p>
    </div>
    <ul class="ag-proof-list">${cards}</ul>
    <p class="ag-legend">${esc(statusLegend(list.statusRule))}${rows.some(isExpected) ? ` ${esc(EXPECTED_LABEL)} marks a figure we expect while too few clicks are in to measure it.` : ""} <a href="/indexes">See every index</a></p>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Live in 5 days
// ---------------------------------------------------------------------------

const DAYS = [
  { title: "One call", line: "You tell us who buys from you and which pages sell best." },
  { title: "Buyers agreed", line: "We read your site and agree on who to invite, page by page." },
  { title: "First buyers found", line: "Our agents find the first people to invite." },
  { title: "First invitations sent", line: "Each buyer gets a message by email or WhatsApp." },
  { title: "Visits on your dashboard", line: "Human visits come in, each with its role and company." },
];

function daysHtml(): string {
  const days = DAYS.map(
    (d, i) => `<li class="ag-day"><span class="dot">${i + 1}</span><h3>Day ${i + 1}: ${esc(d.title)}</h3><p>${esc(d.line)}</p></li>`,
  ).join("");
  return `<section class="framed tint">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Live in 5 days</span>
      <h2 style="margin-top:14px">From our first call to your first visitors.</h2>
      <p>Nothing to set up on your side. Our data, our domains, our agents.</p>
    </div>
    <div class="ag-days-wrap">
      <svg class="ag-beam" data-motion="beams" viewBox="0 0 1000 4" preserveAspectRatio="none" aria-hidden="true"><path d="M0 2 H1000" stroke="#2563eb" stroke-width="2" fill="none" vector-effect="non-scaling-stroke"/></svg>
      <ol class="ag-days">${days}</ol>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Website traffic agencies compared, read on each site
// ---------------------------------------------------------------------------

export function trafficAgencyTableHtml(): string {
  const newest = TRAFFIC_AGENCIES.map((a) => a.verifiedOn).sort().at(-1) ?? "";
  const rows = TRAFFIC_AGENCIES.map(
    (a) =>
      `<tr><th scope="row"><a href="${trafficAgencyVsPath(a)}">${LOGO(a.domain, 20)}${esc(a.name)}</a></th><td>${esc(a.entryPrice)}</td><td>${a.launch ? esc(a.launch.text) : "Not stated"}</td><td><a href="${trafficAgencyVsPath(a)}">distribute.you vs ${esc(a.name)}</a></td></tr>`,
  ).join("");
  const sources = TRAFFIC_AGENCIES.map((a) => `<a href="${esc(a.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(a.name)}</a>`).join(", ");
  return `<section class="framed tint" id="compare">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Traffic agencies compared</span>
      <h2 style="margin-top:14px">Website traffic agencies, side by side.</h2>
      <p>What each one charges and how fast it starts, read on its own site.</p>
    </div>
    <div class="ag-table-wrap tr-table" data-motion="reveal">
      <table class="ag-table">
        <thead><tr><th scope="col">Agency</th><th scope="col">Price on their site</th><th scope="col">Time to launch</th><th scope="col"></th></tr></thead>
        <tbody>
          <tr class="ours"><th scope="row"><a href="${TRAFFIC_AGENCY_PATH}"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="20" height="20">distribute.you</a></th><td class="us">${esc(OUR_TRAFFIC_AGENCY_ROW.entryPrice)}</td><td class="us">${esc(OUR_TRAFFIC_AGENCY_ROW.launch)}</td><td class="us"><a ${BOOK_ATTRS}>Book a call</a></td></tr>
          ${rows}
        </tbody>
      </table>
    </div>
    <p class="ag-src">Read on each site on ${esc(verifiedLabel(newest))}: ${sources}. <a href="${TRAFFIC_AGENCY_ALTERNATIVES_PATH}">Every website traffic agency alternative</a>.</p>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Price, call, FAQ
// ---------------------------------------------------------------------------

export const TRAFFIC_AGENCY_INCLUDED = [
  "Your buyers and their pages agreed on our first call",
  "Invitations written for each buyer, by email and WhatsApp",
  "Every visit judged human before it counts",
  "Visitors who sign up followed on WhatsApp",
  "Live in 5 days from our first call",
];

export const TRAFFIC_AGENCY_FAQ = [
  {
    q: "What does a website traffic agency do?",
    a: "A website traffic agency brings people to your website for you. Ours brings the buyers you choose: our team and our AI agents invite each one by email or WhatsApp, and we count every person who visits.",
  },
  {
    q: "Do you do SEO?",
    a: "We bring visitors by inviting your buyers directly, from the first messages we send. SEO grows over months, and it works well beside us.",
  },
  {
    q: "Where does the traffic come from?",
    a: "From the people we agree on: by role, company size and market. Each one gets a message written for them, by email from our own domains or on WhatsApp, with a link to the page that fits.",
  },
  {
    q: "How do you know a visit is human?",
    a: "Mail security tools follow many links in emails. Our AI judge reads every click and counts only the ones a person made.",
  },
  {
    q: "What will I pay per visit?",
    a: "You see what each human visit cost you, live on your dashboard. Our own figure across every campaign is the Cold Email Cost Per Click Index, recorded every day.",
  },
  {
    q: "What does the price cover?",
    a: "From $1K a month for our team, plus 10% of the budget you put into your campaigns. The budget pays for reaching your buyers, and it is a hard cap you set.",
  },
  {
    q: "How fast do we go live?",
    a: "Live in 5 days from our first call. Nothing to set up on your side.",
  },
];

function faqHtml(): string {
  const items = TRAFFIC_AGENCY_FAQ.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("");
  const links = [
    ...TRAFFIC_AGENCIES.map((a) => `<a href="${trafficAgencyVsPath(a)}">distribute.you vs ${esc(a.name)}</a>`),
    `<a href="${TRAFFIC_AGENCY_ALTERNATIVES_PATH}">Website traffic agency alternatives</a>`,
    `<a href="${TRAFFIC_AUTOMATION_PATH}">Website Traffic Automation</a>`,
  ].join("");
  return `<section class="framed" id="faq">
  <div class="wrap">
    <div class="section-head center"><span class="eyebrow">Questions</span><h2 style="margin-top:14px">Good to know before the call.</h2></div>
    <div class="ag-faq">${items}</div>
    <nav class="ag-links" aria-label="Compare with other website traffic agencies">${links}</nav>
  </div>
</section>`;
}

export const TRAFFIC_AGENCY_TITLE = "Website Traffic Agency: qualified B2B buyers on your website | distribute.you";
export const TRAFFIC_AGENCY_DESCRIPTION =
  "Revenue made easy. A website traffic agency that invites your buyers by email and WhatsApp and counts only human visits. From $1K/month + 10% of budget.";

export function renderWebsiteTrafficAgencyPage(list: IndexList | null): string {
  const url = `${SITE}${TRAFFIC_AGENCY_PATH}`;
  return shell({
    title: TRAFFIC_AGENCY_TITLE,
    description: TRAFFIC_AGENCY_DESCRIPTION,
    path: TRAFFIC_AGENCY_PATH,
    head: trafficAgencyHead(),
    bodyClass: "ag",
    noCta: true,
    body: [
      heroHtml(),
      storyHtml(),
      weekHtml(),
      trafficProofHtml(list),
      daysHtml(),
      trafficAgencyTableHtml(),
      priceHtml("Website Traffic Agency", TRAFFIC_AGENCY_INCLUDED),
      callHtml(TRAFFIC_AUTOMATION_PATH),
      faqHtml(),
      CALC_SCRIPT,
    ].join("\n"),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Service",
        name: "distribute.you Website Traffic Agency",
        serviceType: "Website traffic",
        url,
        description: TRAFFIC_AGENCY_DESCRIPTION,
        provider: { "@type": "Organization", name: "distribute.you", url: SITE },
        offers: {
          "@type": "Offer",
          description: "From $1K/month + 10% of budget",
          priceSpecification: { "@type": "UnitPriceSpecification", price: AGENCY_FEE_BASE_USD, priceCurrency: "USD", unitText: "MONTH" },
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: TRAFFIC_AGENCY_FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      breadcrumb([
        { name: "distribute.you", path: "/" },
        { name: "Website Traffic Agency", path: TRAFFIC_AGENCY_PATH },
      ]),
    ],
  });
}
