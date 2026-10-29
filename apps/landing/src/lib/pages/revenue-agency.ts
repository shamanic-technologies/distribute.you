/**
 * `/revenue-agency`: the first Agency page (PAGE-REVENUE-AGENCY-1029, owner 2026-10-29).
 *
 * Buyer: a company that already makes cash and wants its GTM department run for it.
 * Promise (owner): the best growth on the market right now, from our own data and the
 * network effect of every campaign we run, adaptive over time, with the client's team
 * kept on top of every move. Price: "From $1K/month + 10% of budget". CTA: Book a call.
 *
 * Every figure on the page is READ at render: the fleet indexes (`/v1/public/indexes`)
 * and the actions our agents completed each month (`/public/stats/runs`). A failed read
 * drops its section, never prints a number nobody measured. The proof cards read the
 * same indexes the homepage hero reads, so the two pages state one fleet.
 *
 * Motion (motion.js, darker variant of the Revenue orbit): `orbit` in the hero,
 * `sticky-story`, `beams`, `scrub` on the proof line, `bar-grow`, `reveal`. The HTML is
 * the final state; styles live in `public/landing/v2/agency.css`.
 *
 * Alias-free: the unit tests render it directly.
 */
import {
  STATUS_LABEL,
  EXPECTED_LABEL,
  esc,
  formatIndexValue,
  isExpected,
  statusLegend,
  unavailableLine,
  type IndexList,
  type IndexSummary,
} from "../fleet-indexes";
import { BOOK_A_CALL } from "../site-chrome";
import { AGENCIES, ALTERNATIVES_PATH, AGENCY_PAGE_PATH, agencyVsPath } from "../agencies";
import { SITE, WHY, breadcrumb, shell } from "../v2-shell";

export const AGENCY_CSS_VERSION = 1;
export const AGENCY_FEE_BASE_USD = 1000;
export const AGENCY_FEE_SHARE = 0.1;
/** The slider's starting budget: the fee shown before anyone moves it. */
export const DEFAULT_BUDGET_USD = 10000;

export type MonthlyRuns = { month: string; completed: number }[];

/** The agency stylesheet, linked in the page head. */
export function agencyHead(): string {
  return `<link rel="stylesheet" href="/landing/v2/agency.css?v=${AGENCY_CSS_VERSION}">`;
}

/** The fee for a monthly budget, in whole dollars: $1K + 10% of the budget. */
export function agencyFeeUsd(budgetUsd: number): number {
  return Math.round(AGENCY_FEE_BASE_USD + AGENCY_FEE_SHARE * budgetUsd);
}

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

const BOOK_ATTRS = `href="${BOOK_A_CALL}" target="_blank" rel="noopener"`;

// ---------------------------------------------------------------------------
// Live reads
// ---------------------------------------------------------------------------

/** `/public/stats/runs` monthly rows, read strictly; null on a shape we do not know. */
export function parseMonthlyRuns(body: unknown): MonthlyRuns | null {
  const monthly = (body as { monthly?: unknown })?.monthly;
  if (!Array.isArray(monthly)) {
    console.error("[landing] /public/stats/runs: monthly is not an array");
    return null;
  }
  const rows: MonthlyRuns = [];
  for (const r of monthly as { month?: unknown; completed?: unknown }[]) {
    const completed = typeof r?.completed === "string" ? Number(r.completed) : r?.completed;
    if (typeof r?.month !== "string" || !/^\d{4}-\d{2}$/.test(r.month) || typeof completed !== "number" || !Number.isFinite(completed)) {
      console.error("[landing] /public/stats/runs: bad monthly row", JSON.stringify(r));
      return null;
    }
    rows.push({ month: r.month, completed });
  }
  rows.sort((a, b) => a.month.localeCompare(b.month));
  return rows.length ? rows : null;
}

function apiBase(): string {
  return (process.env.API_SERVICE_URL || "https://api.distribute.you").replace(/\/$/, "");
}

/** The actions our agents completed each month, every client together; null on a failed read. */
export async function fetchMonthlyRuns(timeoutMs = 8_000): Promise<MonthlyRuns | null> {
  try {
    const res = await fetch(`${apiBase()}/public/stats/runs`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(timeoutMs),
    } as RequestInit);
    if (res.status !== 200) throw new Error(`status ${res.status}`);
    return parseMonthlyRuns(await res.json());
  } catch (err) {
    console.error("[landing] /public/stats/runs read failed", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

/** What we run, circling the agent. Every one is an outcome we run in production. */
export const ORBIT_OUTCOMES = [
  "Meetings booked",
  "Cold email",
  "Lead generation",
  "Website visits",
  "Signups",
  "Lead nurturing",
  "Customer success",
  "Paid acquisition",
];

function heroHtml(): string {
  const chips = ORBIT_OUTCOMES.map(
    (o, i) => `<span class="ag-chip" style="--a:${Math.round((i / ORBIT_OUTCOMES.length) * 360)}deg"><i></i>${esc(o)}</span>`,
  ).join("");
  return `<section class="ag-hero ag-dark">
  <div class="wrap ag-hero-grid">
    <div data-motion="reveal" data-motion-stagger>
      <span class="eyebrow">Revenue Agency</span>
      <h1 style="margin-top:18px">The best growth on the market, run for you.</h1>
      <p class="lead">We run your go-to-market with data from every campaign we run. Your team stays on top of every lead, with agents that do the work.</p>
      <p class="why">${WHY}</p>
      <div class="ag-ctas">
        <a class="btn btn-accent btn-lg" ${BOOK_ATTRS}>Book a call</a>
        <a class="btn btn-lg btn-ghost-d" href="#price">See the price</a>
      </div>
      <p class="ag-price-line"><b>From $1K/month + 10% of budget.</b> Live in 5 days.</p>
    </div>
    <div class="ag-orbit-wrap" aria-hidden="true">
      <span class="ag-ring r3"></span><span class="ag-ring r2"></span><span class="ag-ring r1"></span>
      <div class="ag-core"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="34" height="34">Your growth team</div>
      <div class="ag-orbit" data-motion="orbit" data-motion-speed="48">${chips}</div>
    </div>
  </div>
</section>`;
}

const STORY_STEPS = [
  { title: "We find your buyers", line: "Our agents pick the companies and people most likely to buy from you." },
  { title: "We write and send", line: "Every email leaves from our own domains, written for each buyer." },
  { title: "We answer every reply", line: "Interested buyers get an answer fast, until the meeting is in your calendar." },
  { title: "We keep what pays", line: "Templates, AI models and audiences are tested on every campaign. Your budget moves to the winners." },
];

function storyHtml(): string {
  const steps = STORY_STEPS.map(
    (s, i) => `<li class="ag-step" data-step="${i + 1}"><span class="n">${i + 1}</span><b>${esc(s.title)}</b><span>${esc(s.line)}</span></li>`,
  ).join("");
  return `<section class="ag-story" id="how" data-motion="sticky-story">
  <div class="wrap ag-story-grid">
    <div>
      <div class="section-head">
        <span class="eyebrow">How we work</span>
        <h2 style="margin-top:14px">We run your GTM department.</h2>
        <p>Your team keeps the meetings and the deals. Our team and our agents run everything before them.</p>
      </div>
      <ol class="ag-steps">${steps}</ol>
    </div>
    <div class="ag-stage" aria-hidden="true">
      <div class="ag-scene" data-scene="1">
        <span class="ag-tag">Buyers found today</span>
        <div class="ag-row"><span class="av"></span><div>Head of Sales<small>B2B software, 50 to 200 people</small></div><em>Fits</em></div>
        <div class="ag-row"><span class="av"></span><div>Founder and CEO<small>Agency, 10 to 50 people</small></div><em>Fits</em></div>
        <div class="ag-row"><span class="av"></span><div>VP Marketing<small>E-commerce, 200 to 500 people</small></div><em>Fits</em></div>
      </div>
      <div class="ag-scene" data-scene="2">
        <span class="ag-tag">Written for one buyer</span>
        <div class="ag-mail"><div class="h"><span>From: <b>distribute.you</b></span><span>Subject: <b>A quick idea for your pipeline</b></span></div>
        <p>Hi, I saw your team is hiring two sales reps this quarter.</p>
        <p>We could fill their calendars from day one. Worth a short call?</p></div>
      </div>
      <div class="ag-scene" data-scene="3">
        <span class="ag-tag">Reply answered</span>
        <div class="ag-bubble them">Sounds interesting. Can we talk Thursday?</div>
        <div class="ag-bubble us">Thursday at 10am works. The invite is on its way.</div>
        <span class="ag-booked">Meeting booked in your calendar</span>
      </div>
      <div class="ag-scene" data-scene="4">
        <span class="ag-tag">Tested on every campaign</span>
        <div class="ag-test"><label>Template A</label><div class="ag-track"><i style="width:46%"></i></div></div>
        <div class="ag-test"><label>Template B <span>budget moves here</span></label><div class="ag-track"><i class="win" style="width:82%"></i></div></div>
        <div class="ag-test"><label>Audience A <span>budget moves here</span></label><div class="ag-track"><i class="win" style="width:74%"></i></div></div>
        <div class="ag-test"><label>Audience B</label><div class="ag-track"><i style="width:58%"></i></div></div>
      </div>
    </div>
  </div>
</section>`;
}

const DAYS = [
  { title: "One call", line: "You tell us your goal, your market and your budget." },
  { title: "Your offer, read", line: "We read your site and your offer, and pick your first buyers." },
  { title: "Campaign set up", line: "We write the first emails and set up the campaign." },
  { title: "First sends", line: "Your first emails leave from our own domains." },
  { title: "You are live", line: "Replies come in, and your dashboard shows every one." },
];

function daysHtml(): string {
  const days = DAYS.map(
    (d, i) => `<li class="ag-day"><span class="dot">${i + 1}</span><h3>Day ${i + 1}: ${esc(d.title)}</h3><p>${esc(d.line)}</p></li>`,
  ).join("");
  return `<section class="framed">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Live in 5 days</span>
      <h2 style="margin-top:14px">From our first call to your first replies.</h2>
      <p>Nothing to set up on your side. Our domains, our inboxes, our agents.</p>
    </div>
    <div class="ag-days-wrap">
      <svg class="ag-beam" data-motion="beams" viewBox="0 0 1000 4" preserveAspectRatio="none" aria-hidden="true"><path d="M0 2 H1000" stroke="#2563eb" stroke-width="2" fill="none" vector-effect="non-scaling-stroke"/></svg>
      <ol class="ag-days">${days}</ol>
    </div>
  </div>
</section>`;
}

function indexCardHtml(i: IndexSummary, at: number): string {
  const value =
    i.value === null
      ? `<span class="v words">${esc(unavailableLine(i.unavailableReason))}</span>`
      : `<span class="v">${esc(formatIndexValue(i.value, i.unit))}</span>`;
  const tag = isExpected(i) ? EXPECTED_LABEL : STATUS_LABEL[i.status];
  return `<li><a class="ag-ix" href="/indexes/${esc(i.slug)}" style="--at:${at.toFixed(3)}">${value}<div><b>${esc(i.name)}</b><span>${esc(i.valuePer)}</span></div><em>${esc(tag)}</em></a></li>`;
}

/** The proof line: every served index, lit one by one as the line passes (11x). */
export function proofHtml(list: IndexList | null): string {
  if (!list || !list.indexes.length) return "";
  const n = list.indexes.length;
  const cards = list.indexes.map((i, k) => indexCardHtml(i, n === 1 ? 0 : k / n)).join("");
  return `<section class="ag-dark ag-proof" id="data" data-motion="scrub">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Our data, live</span>
      <h2 style="margin-top:14px">Every campaign we run makes the next one sharper.</h2>
      <p>One data set, fed by every client. Your campaign starts where our best one is today. Read live, every day.</p>
    </div>
    <ul class="ag-proof-list">${cards}</ul>
    <p class="ag-legend">${esc(statusLegend(list.statusRule))} <a href="/indexes">See every index</a></p>
  </div>
</section>`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 14k, 999k, 2.5M: a bar label read in one glance. */
export function compactCount(n: number): string {
  // 999,881 rounds to 1,000k: anything that would print 1000k reads as millions.
  if (n >= 999_500) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}

/** Month-by-month bars of the actions our agents completed (outrank). */
export function monthlyHtml(rows: MonthlyRuns | null, now: Date = new Date()): string {
  if (!rows || !rows.length) return "";
  const max = Math.max(...rows.map((r) => r.completed));
  if (!(max > 0)) return "";
  const thisMonth = now.toISOString().slice(0, 7);
  const bars = rows
    .map((r) => `<div class="ag-bar"><b>${compactCount(r.completed)}</b><i data-bar style="--h:${((r.completed / max) * 100).toFixed(1)}%"></i></div>`)
    .join("");
  const months = rows
    .map((r) => {
      const m = MONTHS[Number(r.month.slice(5)) - 1];
      return `<span>${r.month === thisMonth ? `${m}, so far` : m}</span>`;
    })
    .join("");
  const first = rows[0].month;
  const since = `${MONTHS[Number(first.slice(5)) - 1]} ${first.slice(0, 4)}`;
  return `<section class="framed tint" id="growth">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Month by month</span>
      <h2 style="margin-top:14px">Our agents at work, month by month.</h2>
      <p>Actions our AI agents completed for all our clients, each month since ${esc(since)}.</p>
    </div>
    <div data-motion="bar-grow"><div class="ag-bars" role="img" aria-label="Actions our agents completed each month, read live">${bars}</div></div>
    <div class="ag-bar-months">${months}</div>
    <p class="ag-note">Read live from our run records.</p>
  </div>
</section>`;
}

const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

const INCLUDED = [
  "Your go-to-market run by our team and our AI agents",
  "Every campaign tested, with budget moved to what pays",
  "Every lead, email and reply visible to your team",
  "Sent from our own domains and inboxes",
  "Live in 5 days from our first call",
];

function priceHtml(): string {
  const fee = agencyFeeUsd(DEFAULT_BUDGET_USD);
  const share = Math.round(AGENCY_FEE_SHARE * DEFAULT_BUDGET_USD);
  return `<section class="framed" id="price">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Price</span>
      <h2 style="margin-top:14px">One fee that grows with your budget.</h2>
      <p>Move the slider to see your monthly fee.</p>
    </div>
    <div class="ag-price">
      <div class="ag-card feat">
        <h3>Revenue Agency</h3>
        <p class="big">From $1K<small>/month + 10% of budget</small></p>
        <ul>${INCLUDED.map((l) => `<li>${CHECK}<span>${esc(l)}</span></li>`).join("")}</ul>
        <a class="btn btn-accent btn-lg" ${BOOK_ATTRS}>Book a call</a>
      </div>
      <div class="ag-card ag-calc" data-agency-calc data-base="${AGENCY_FEE_BASE_USD}" data-share="${AGENCY_FEE_SHARE}">
        <label for="ag-budget">Your monthly budget <output id="ag-budget-out">${usd(DEFAULT_BUDGET_USD)}</output></label>
        <input id="ag-budget" type="range" min="1000" max="100000" step="1000" value="${DEFAULT_BUDGET_USD}" aria-describedby="ag-fee-out">
        <div class="scale"><span>$1,000</span><span>$100,000</span></div>
        <div class="ag-sum">
          <div><span>Our base fee</span><output>${usd(AGENCY_FEE_BASE_USD)}</output></div>
          <div><span>10% of your budget</span><output id="ag-share-out">${usd(share)}</output></div>
          <div class="tot"><span>Your monthly fee</span><output id="ag-fee-out">${usd(fee)}</output></div>
        </div>
        <p style="margin-top:18px;font-size:14px">Your budget goes to your campaigns. The fee pays our team.</p>
      </div>
    </div>
  </div>
</section>`;
}

/** The slider: recomputes the fee in the browser from the same two numbers the card states. */
const CALC_SCRIPT = `<script>(function(){var c=document.querySelector("[data-agency-calc]");if(!c)return;var b=Number(c.getAttribute("data-base")),s=Number(c.getAttribute("data-share"));var i=c.querySelector("#ag-budget"),o=c.querySelector("#ag-budget-out"),sh=c.querySelector("#ag-share-out"),f=c.querySelector("#ag-fee-out");function u(n){return "$"+Math.round(n).toLocaleString("en-US")}function d(){var v=Number(i.value);o.textContent=u(v);sh.textContent=u(s*v);f.textContent=u(b+s*v)}i.addEventListener("input",d);d()})();</script>`;

export function callHtml(): string {
  return `<section class="framed">
  <div class="wrap">
    <div class="ag-call" data-motion="reveal">
      <div>
        <p class="why">${WHY}</p>
        <h2>One call with our team.</h2>
        <p>Tell us your goal. We show you how we would reach it, with the numbers from our own campaigns.</p>
      </div>
      <div class="ag-call-side">
        <ul><li>Your market, read before the call</li><li>A plan for your first month</li><li>Live in 5 days if you go</li></ul>
        <a class="btn btn-accent" ${BOOK_ATTRS}>Book a call</a>
        <a class="alt" href="/">Just testing? Start free</a>
      </div>
    </div>
  </div>
</section>`;
}

export const AGENCY_FAQ = [
  {
    q: "What does the price cover?",
    a: "From $1K a month for our team, plus 10% of the budget you put into your campaigns. Your budget goes to the campaigns themselves.",
  },
  {
    q: "Do you replace my sales team?",
    a: "Your team stays on top of the work. We run the campaigns; your team takes the meetings and sees every lead and every reply.",
  },
  {
    q: "Which outcomes do you run?",
    a: "Meetings booked, cold email, lead generation, website visits, signups, lead nurturing, customer success and paid acquisition, on cold email and WhatsApp.",
  },
  {
    q: "Whose domains send the emails?",
    a: "Ours. Every email leaves from domains and inboxes we own and warm, so there is nothing to set up on your side.",
  },
  {
    q: "How fast can we start?",
    a: "Live in 5 days from our first call.",
  },
];

function faqHtml(): string {
  const items = AGENCY_FAQ.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("");
  const links = [
    ...AGENCIES.map((a) => `<a href="${agencyVsPath(a)}">distribute.you vs ${esc(a.name)}</a>`),
    `<a href="${ALTERNATIVES_PATH}">Agency alternatives</a>`,
  ].join("");
  return `<section class="framed" id="faq">
  <div class="wrap">
    <div class="section-head center"><span class="eyebrow">Questions</span><h2 style="margin-top:14px">Good to know before the call.</h2></div>
    <div class="ag-faq">${items}</div>
    <nav class="ag-links" aria-label="Compare with other agencies">${links}</nav>
  </div>
</section>`;
}

const DESCRIPTION =
  "Revenue made easy. The best growth on the market, run for you with data from every campaign we run. From $1K/month + 10% of budget. Book a call.";

export function renderRevenueAgencyPage(list: IndexList | null, monthly: MonthlyRuns | null, now: Date = new Date()): string {
  const url = `${SITE}${AGENCY_PAGE_PATH}`;
  return shell({
    title: "Revenue Agency: the best growth on the market, run for you | distribute.you",
    description: DESCRIPTION,
    path: AGENCY_PAGE_PATH,
    head: agencyHead(),
    bodyClass: "ag",
    noCta: true,
    body: [heroHtml(), storyHtml(), daysHtml(), proofHtml(list), monthlyHtml(monthly, now), priceHtml(), callHtml(), faqHtml(), CALC_SCRIPT].join("\n"),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Service",
        name: "distribute.you Revenue Agency",
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
        mainEntity: AGENCY_FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      breadcrumb([
        { name: "distribute.you", path: "/" },
        { name: "Revenue Agency", path: AGENCY_PAGE_PATH },
      ]),
    ],
  });
}
