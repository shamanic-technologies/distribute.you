/**
 * `/ppc-agency`: the Paid Acquisition outcome, Agency buyer (PAGE-PPC-AGENCY-1029, owner
 * 2026-10-29). SEO target "ppc agency" (5,400/month US) and "paid media agency" (320).
 *
 * Buyer: a company that makes cash and wants its paid budget turned into buyers. Same offer
 * as every Agency page ("From $1K/month + 10% of budget", Book a call), told for THIS outcome
 * and only with what we run today (`/v1/public/channels`, read 2026-10-29): the budget pays
 * for outreach to buyers we choose with the client, by cold email from our own domains and on
 * WhatsApp; a click counts only when it is judged human; a signup who has not paid is followed
 * up on WhatsApp. No ad network is named: none is managed for clients today.
 *
 * Signature motion (refs #14, outrank): month-by-month bars that grow, on the darker Agency
 * slab, followed by a darker sticky story. The bars are the spend our agents put to work each
 * month (`/public/stats/runs` `monthly[].totalCostInUsdCents`, every campaign we run); the HTML
 * is the final state, `bar-grow` in motion.js replays it, reduced motion plays nothing.
 *
 * Every figure is READ at render: the monthly spend and the fleet indexes a click and a sale
 * reach (`/v1/public/indexes`, by outcome). A failed read drops its block, never prints a
 * number nobody measured.
 *
 * Alias-free: the unit tests render it directly.
 */
import { EXPECTED_LABEL, esc, isExpected, statusLegend, type IndexList, type IndexSummary } from "../fleet-indexes";
import { AD_MANAGEMENT_PATH } from "../ad-management-tools";
import { PPC_AGENCIES, PPC_ALTERNATIVES_PATH, PPC_PAGE_PATH, ppcVsPath } from "../ppc-agencies";
import { SITE, WHY, breadcrumb, shell } from "../v2-shell";
import { AGENCY_FEE_BASE_USD, BOOK_ATTRS, CALC_SCRIPT, agencyHead, callHtml, indexCardHtml, priceHtml } from "./gtm-agency";

export const PPC_CSS_VERSION = 1;

/** The Agency stylesheet plus this page's own layer. */
export function ppcHead(): string {
  return `${agencyHead()}\n<link rel="stylesheet" href="/landing/v2/ppc.css?v=${PPC_CSS_VERSION}">`;
}

// ---------------------------------------------------------------------------
// Live read: spend put to work each month
// ---------------------------------------------------------------------------

export type MonthlySpend = { month: string; usd: number }[];

/** `/public/stats/runs` monthly rows, spend only, read strictly; null on a shape we do not know. */
export function parseMonthlySpend(body: unknown): MonthlySpend | null {
  const monthly = (body as { monthly?: unknown })?.monthly;
  if (!Array.isArray(monthly)) {
    console.error("[landing] /public/stats/runs: monthly is not an array");
    return null;
  }
  const rows: MonthlySpend = [];
  for (const r of monthly as { month?: unknown; totalCostInUsdCents?: unknown }[]) {
    const cents = typeof r?.totalCostInUsdCents === "string" ? Number(r.totalCostInUsdCents) : r?.totalCostInUsdCents;
    if (typeof r?.month !== "string" || !/^\d{4}-\d{2}$/.test(r.month) || typeof cents !== "number" || !Number.isFinite(cents) || cents < 0) {
      console.error("[landing] /public/stats/runs: bad monthly spend row", JSON.stringify(r));
      return null;
    }
    rows.push({ month: r.month, usd: cents / 100 });
  }
  rows.sort((a, b) => a.month.localeCompare(b.month));
  return rows.length ? rows : null;
}

function apiBase(): string {
  return (process.env.API_SERVICE_URL || "https://api.distribute.you").replace(/\/$/, "");
}

/** What our agents spent running every campaign, each month; null on a failed read. */
export async function fetchMonthlySpend(timeoutMs = 8_000): Promise<MonthlySpend | null> {
  try {
    const res = await fetch(`${apiBase()}/public/stats/runs`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(timeoutMs),
    } as RequestInit);
    if (res.status !== 200) throw new Error(`status ${res.status}`);
    return parseMonthlySpend(await res.json());
  } catch (err) {
    console.error("[landing] /public/stats/runs read failed", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hero: the month-by-month bars
// ---------------------------------------------------------------------------

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** $112, $4.8k, $1.2M: a bar label read in one glance. */
export function compactUsd(n: number): string {
  if (n >= 999_500) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return `$${Math.round(n)}`;
}

/** The bars card; empty when the read failed or nothing was spent. */
export function spendChartHtml(rows: MonthlySpend | null, now: Date = new Date()): string {
  if (!rows || !rows.length) return "";
  const max = Math.max(...rows.map((r) => r.usd));
  if (!(max > 0)) return "";
  const thisMonth = now.toISOString().slice(0, 7);
  const full = [...rows].reverse().find((r) => r.month !== thisMonth) ?? rows[rows.length - 1];
  const fullName = MONTH_LONG[Number(full.month.slice(5)) - 1];
  const first = rows[0].month;
  const since = `${MONTH_LONG[Number(first.slice(5)) - 1]} ${first.slice(0, 4)}`;
  const bars = rows
    .map((r, k) => {
      const m = MONTH_SHORT[Number(r.month.slice(5)) - 1];
      const current = r.month === thisMonth;
      return `<div class="pp-bar${current ? " now" : ""}"><b>${compactUsd(r.usd)}</b><i data-bar style="--h:${((r.usd / max) * 100).toFixed(1)}%;--i:${k}"></i><span>${current ? `${m}, so far` : m}</span></div>`;
    })
    .join("");
  return `<figure class="pp-chart">
      <div class="pp-chart-h"><span class="live"><i></i>Budget at work, month by month</span><span>Read live</span></div>
      <p class="pp-chart-big"><b>${compactUsd(full.usd)}</b><span>put to work by our agents in ${esc(fullName)}</span></p>
      <div class="pp-bars" data-motion="bar-grow" role="img" aria-label="What our agents spent running every campaign, each month since ${esc(since)}, read live">${bars}</div>
      <figcaption>Every campaign we run, each month since ${esc(since)}. Read from our cost ledger.</figcaption>
    </figure>`;
}

function heroHtml(spend: MonthlySpend | null, now: Date): string {
  const chart = spendChartHtml(spend, now);
  return `<section class="ag-hero ag-dark pp-hero${chart ? "" : " solo"}">
  <div class="wrap ag-hero-grid">
    <div data-motion="reveal" data-motion-stagger>
      <span class="eyebrow">PPC Agency for B2B</span>
      <h1 style="margin-top:18px">The PPC agency where every click is a buyer you chose.</h1>
      <p class="lead">Your paid budget reaches the people who buy from you, by email and WhatsApp. We count every human click, every signup and every sale.</p>
      <p class="why">${WHY}</p>
      <div class="ag-ctas">
        <a class="btn btn-accent btn-lg" ${BOOK_ATTRS}>Book a call</a>
        <a class="btn btn-lg btn-ghost-d" href="#how">See where your budget goes</a>
      </div>
      <p class="ag-price-line"><b>From $1K/month + 10% of budget.</b> Live in 5 days.</p>
    </div>
    ${chart}
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Sticky story (darker variant): where the budget goes
// ---------------------------------------------------------------------------

export const STORY_STEPS = [
  { title: "We choose who sees your offer", line: "On our first call we agree on your buyer. Our agents find those people every day." },
  { title: "Your budget reaches them one by one", line: "Each buyer gets a message written for them, by email from our own domains or on WhatsApp." },
  { title: "We count only human clicks", line: "Our AI judge reads every click and keeps the ones a person made." },
  { title: "We follow every signup until they pay", line: "A new signup who has not paid hears from us on WhatsApp, at the right moment." },
];

function storyHtml(): string {
  const steps = STORY_STEPS.map(
    (s, i) => `<li class="ag-step" data-step="${i + 1}"><span class="n">${i + 1}</span><b>${esc(s.title)}</b><span>${esc(s.line)}</span></li>`,
  ).join("");
  return `<section class="ag-story pp-story" id="how" data-motion="sticky-story">
  <div class="wrap ag-story-grid">
    <div>
      <div class="section-head">
        <span class="eyebrow">Where your budget goes</span>
        <h2 style="margin-top:14px">Paid reach, aimed at your buyers.</h2>
        <p>Your budget pays to reach people you picked. Each click has a name, and each sale shows where it came from.</p>
      </div>
      <ol class="ag-steps">${steps}</ol>
    </div>
    <div class="ag-stage pp-stage" aria-hidden="true">
      <div class="ag-scene" data-scene="1">
        <span class="ag-tag">Your buyer, agreed on our first call</span>
        <div class="pp-icp">
          <div><label>Industry</label><span class="chip">B2B software</span><span class="chip">Fintech</span></div>
          <div><label>Team size</label><span class="chip">20 to 500 people</span></div>
          <div><label>Roles</label><span class="chip">Head of Sales</span><span class="chip">Founder</span><span class="chip">VP Growth</span></div>
          <div><label>Region</label><span class="chip">United States</span><span class="chip">Europe</span></div>
        </div>
      </div>
      <div class="ag-scene" data-scene="2">
        <span class="ag-tag">Written for one buyer</span>
        <div class="ag-mail"><div class="h"><span>From: <b>distribute.you</b></span><span>Subject: <b>Your new pricing page</b></span></div>
        <p>Hi, I saw you just launched a new pricing page.</p>
        <p>We help teams like yours turn visits into paying clients. Worth a look?</p></div>
        <div class="pp-wa"><span>WhatsApp</span>Hi, quick one about your new pricing page. Can I send you the short version?</div>
      </div>
      <div class="ag-scene" data-scene="3">
        <span class="ag-tag">Every click judged</span>
        <div class="pp-click yes"><b>Head of Sales</b><span>Read your pricing page for two minutes</span><em>Human</em></div>
        <div class="pp-click no"><b>Mail security scanner</b><span>Followed the link in under a second</span><em>Not counted</em></div>
        <div class="pp-click yes"><b>Founder</b><span>Visited your demo page from WhatsApp</span><em>Human</em></div>
      </div>
      <div class="ag-scene" data-scene="4">
        <span class="ag-tag">A signup, followed up on WhatsApp</span>
        <div class="pp-thread">
          <p class="in">Hi, you signed up yesterday. Want me to set up your first campaign with you?</p>
          <p class="out">Yes please, today if you can.</p>
          <p class="done"><i></i>Paid client</p>
        </div>
      </div>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// A click you can name
// ---------------------------------------------------------------------------

export const CLICK_PARTS = [
  { title: "Who clicked", line: "Name, role and company, a buyer we chose with you." },
  { title: "What brought them", line: "The exact email or WhatsApp message they clicked from." },
  { title: "A person, judged", line: "Link scanners follow many links. Only clicks a person made count." },
  { title: "What came next", line: "Signup, meeting or sale, counted on the same buyer." },
];

function clickHtml(): string {
  const parts = CLICK_PARTS.map(
    (p, i) => `<li><span class="k">${i + 1}</span><div><h3>${esc(p.title)}</h3><p>${esc(p.line)}</p></div></li>`,
  ).join("");
  return `<section class="framed" id="clicks">
  <div class="wrap pp-clicks">
    <div data-motion="reveal">
      <span class="eyebrow">Every click</span>
      <h2 style="margin-top:14px">A click you can put a name on.</h2>
      <p>Each visit to your site comes with the buyer behind it. Your team knows who to call first.</p>
      <ol class="pp-parts" data-motion="reveal" data-motion-stagger>${parts}</ol>
    </div>
    <div class="pp-card" data-motion="reveal" aria-hidden="true">
      <div class="pp-card-h"><span class="av">H</span><div><b>Head of Sales</b><small>B2B software, 80 people</small></div><em>Human click</em></div>
      <dl>
        <div><dt>Clicked from</dt><dd>“Your new pricing page”, sent from our own domains</dd></div>
        <div><dt>Visited</dt><dd>Pricing, then your demo page</dd></div>
        <div><dt>Judged</dt><dd>A person, not a link scanner</dd></div>
      </dl>
      <ol class="pp-trail"><li>Emailed</li><li>Clicked</li><li>Signed up</li><li class="hot">Paid client</li></ol>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Proof: the live indexes a click and a sale reach
// ---------------------------------------------------------------------------

/** The outcomes paid reach is judged on, in the order the page tells them. */
export const PPC_OUTCOMES = ["website_visit", "revenue"] as const;

/** The served indexes for a click and for revenue, clicks first; read by outcome, never by slug. */
export function ppcIndexes(list: IndexList | null): IndexSummary[] {
  if (!list) return [];
  return PPC_OUTCOMES.flatMap((o) => list.indexes.filter((i) => i.outcome === o));
}

export function ppcProofHtml(list: IndexList | null): string {
  const rows = ppcIndexes(list);
  if (!list || !rows.length) return "";
  const n = rows.length;
  const cards = rows.map((i, k) => indexCardHtml(i, n === 1 ? 0 : k / n)).join("");
  return `<section class="ag-dark ag-proof" id="data" data-motion="scrub">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Our data, live</span>
      <h2 style="margin-top:14px">What a human click costs, read live.</h2>
      <p>Cost per click, click rate and return on spend, read from every campaign we run and recorded every day.</p>
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
  { title: "One call", line: "You tell us who buys from you and your monthly budget." },
  { title: "Buyer agreed", line: "We read your site and offer, and agree on who to reach." },
  { title: "First buyers found", line: "Our agents find the first people your budget will reach." },
  { title: "First messages sent", line: "Each buyer gets a message by email or WhatsApp." },
  { title: "Clicks in your dashboard", line: "Human clicks and signups come in, each with its buyer." },
];

function daysHtml(): string {
  const days = DAYS.map(
    (d, i) => `<li class="ag-day"><span class="dot">${i + 1}</span><h3>Day ${i + 1}: ${esc(d.title)}</h3><p>${esc(d.line)}</p></li>`,
  ).join("");
  return `<section class="framed tint">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Live in 5 days</span>
      <h2 style="margin-top:14px">From our first call to your first clicks.</h2>
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
// Price, call, FAQ
// ---------------------------------------------------------------------------

export const PPC_INCLUDED = [
  "Your budget aimed at buyers you choose with us",
  "Messages written for each buyer, by email and WhatsApp",
  "Every click judged human before it counts",
  "Signups followed up on WhatsApp until they pay",
  "Live in 5 days from our first call",
];

export const PPC_FAQ = [
  {
    q: "Where does my paid budget go?",
    a: "Into reaching the buyers we agree on: finding them, writing one message per person and sending it by email from our own domains or on WhatsApp. Every action has a public price.",
  },
  {
    q: "Do you manage search and social ad accounts?",
    a: "We put your budget where we measure the best return today: outreach to the buyers you choose. Every click and sale it brings is counted, so you can set it beside any ad spend you run.",
  },
  {
    q: "What will I pay per click?",
    a: "We never quote a price per click. You see what each human click cost you, live on your dashboard. Our own figure across every campaign is the Cold Email Cost Per Click Index.",
  },
  {
    q: "How do you know a click is human?",
    a: "Mail security tools follow many links in emails. Our AI judge reads every click and counts only the ones a person made.",
  },
  {
    q: "What does the price cover?",
    a: "From $1K a month for our team, plus 10% of the budget you put into your campaigns. You set the budget, and it is a hard cap.",
  },
  {
    q: "How fast do we go live?",
    a: "Live in 5 days from our first call. Nothing to set up on your side.",
  },
];

function faqHtml(): string {
  const items = PPC_FAQ.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("");
  const links = [
    ...PPC_AGENCIES.map((a) => `<a href="${ppcVsPath(a)}">distribute.you vs ${esc(a.name)}</a>`),
    `<a href="${PPC_ALTERNATIVES_PATH}">PPC agency alternatives</a>`,
    `<a href="${AD_MANAGEMENT_PATH}">AI Ad Management</a>`,
  ].join("");
  return `<section class="framed" id="faq">
  <div class="wrap">
    <div class="section-head center"><span class="eyebrow">Questions</span><h2 style="margin-top:14px">Good to know before the call.</h2></div>
    <div class="ag-faq">${items}</div>
    <nav class="ag-links" aria-label="Compare with other PPC agencies">${links}</nav>
  </div>
</section>`;
}

const DESCRIPTION =
  "Revenue made easy. A PPC agency where your paid budget reaches the buyers you choose, by email and WhatsApp, and every click is judged human. From $1K/month + 10% of budget.";

export function renderPpcAgencyPage(list: IndexList | null, spend: MonthlySpend | null, now: Date = new Date()): string {
  const url = `${SITE}${PPC_PAGE_PATH}`;
  return shell({
    title: "PPC Agency: paid acquisition where every click is a buyer | distribute.you",
    description: DESCRIPTION,
    path: PPC_PAGE_PATH,
    head: ppcHead(),
    bodyClass: "ag",
    noCta: true,
    body: [
      heroHtml(spend, now),
      storyHtml(),
      clickHtml(),
      ppcProofHtml(list),
      daysHtml(),
      priceHtml("PPC Agency", PPC_INCLUDED),
      callHtml(AD_MANAGEMENT_PATH),
      faqHtml(),
      CALC_SCRIPT,
    ].join("\n"),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Service",
        name: "distribute.you PPC Agency",
        serviceType: "Paid acquisition",
        url,
        description: DESCRIPTION,
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
        mainEntity: PPC_FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      breadcrumb([
        { name: "distribute.you", path: "/" },
        { name: "PPC Agency", path: PPC_PAGE_PATH },
      ]),
    ],
  });
}
