/**
 * `/appointment-setting-agency`: the Meetings Booked outcome, Agency buyer
 * (PAGE-APPOINTMENT-AGENCY-1030, owner 2026-10-29). SEO target "appointment setting agency"
 * (320 to 390 US searches a month) and "b2b appointment setting" (140 to 260).
 *
 * Buyer: a company that makes cash and wants sales meetings set for its team. Agency twin of
 * `/ai-sdr` (same outcome, AI Agent buyer): the two bridge to each other, and this one sells
 * the SERVICE: our team runs the account on our data, our AI agents do the writing and the
 * first answers, the client's reps take the calls. Same offer as every Agency page
 * ("From $1K/month + 10% of budget", Book a call). Channels: only what we run (cold email from
 * our own domains, WhatsApp); no cold calls are promised.
 *
 * Signature motion: the calendar that fills up (main.js `.cal`, the homepage recipe), here on
 * the darker Agency slab with each booking toasted in front of it, followed by the darker
 * sticky story. The HTML is the final state (the full week); reduced motion plays nothing.
 *
 * Every figure is READ at render, never typed here:
 * - `__HOT_LEAD_ROW__`: the fleet's cost per booked meeting and median ROI (static-html.ts
 *   `withHotLeadStats`, the same read the homepage hero and `/ai-sdr` state);
 * - the client cards (`data-brand`) and proof cards (`data-proof-brand`): features-service's
 *   pick and counts (`withShowcaseOutcomes`), outreach-caused results only;
 * - the indexes a meeting reaches (`/v1/public/indexes`, by outcome);
 * - the cost table: `appointment-setting-agencies.ts`, each figure read on the agency's site.
 * A failed read drops its block, never prints a number nobody measured. Calendar events and
 * story scenes are a product preview: roles and company types, no person, no figure.
 *
 * Alias-free: the unit tests render it directly.
 */
import { EXPECTED_LABEL, esc, isExpected, statusLegend, type IndexList, type IndexSummary } from "../fleet-indexes";
import {
  APPOINTMENT_AGENCIES,
  APPOINTMENT_ALTERNATIVES_PATH,
  APPOINTMENT_PAGE_PATH,
  OUR_APPOINTMENT_ROW,
  appointmentVsPath,
} from "../appointment-setting-agencies";
import { AI_SDR_PATH } from "../competitors";
import { SITE, WHY, breadcrumb, shell } from "../v2-shell";
import { AGENCY_FEE_BASE_USD, BOOK_ATTRS, CALC_SCRIPT, agencyHead, callHtml, indexCardHtml, priceHtml } from "./gtm-agency";

export const APPOINTMENT_CSS_VERSION = 1;

/** The Agency stylesheet plus this page's own layer. */
export function appointmentHead(): string {
  return `${agencyHead()}\n<link rel="stylesheet" href="/landing/v2/appointment.css?v=${APPOINTMENT_CSS_VERSION}">`;
}

const LOGO = (domain: string, size = 32) =>
  `<img src="https://img.logo.dev/${domain}?token=pk_J1iY4__HSfm9acHjR8FibA&size=64&format=png" alt="" width="${size}" height="${size}">`;

// ---------------------------------------------------------------------------
// Hero: your team's calendar, filling up
// ---------------------------------------------------------------------------

export type CalEvent = { stage: number; tone: string; short?: boolean; d: number; s: number; l: number; what: string; who: string };

/** The week the calendar fills, stage by stage (main.js advances `data-cal-stage`). A product preview: roles, never a person. */
export const CAL_EVENTS: readonly CalEvent[] = [
  { stage: 1, tone: "ta", d: 2, s: 2, l: 4, what: "Demo", who: "Head of Sales, fintech" },
  { stage: 1, tone: "tb", short: true, d: 4, s: 8, l: 2, what: "Intro call", who: "Founder" },
  { stage: 2, tone: "tc", d: 1, s: 6, l: 4, what: "Discovery", who: "VP Marketing, retail" },
  { stage: 2, tone: "td", short: true, d: 3, s: 0, l: 2, what: "Intro call", who: "COO" },
  { stage: 2, tone: "te", d: 5, s: 4, l: 4, what: "Demo", who: "Head of Growth, SaaS" },
  { stage: 3, tone: "tb", d: 3, s: 12, l: 4, what: "Demo", who: "VP Sales, logistics" },
  { stage: 3, tone: "ta", short: true, d: 1, s: 16, l: 2, what: "Intro call", who: "CEO" },
  { stage: 3, tone: "tc", d: 4, s: 14, l: 4, what: "Discovery", who: "Head of Ops, health" },
  { stage: 4, tone: "td", short: true, d: 2, s: 18, l: 2, what: "Follow-up", who: "Head of Sales" },
  { stage: 4, tone: "te", d: 5, s: 12, l: 4, what: "Demo", who: "CMO, e-commerce" },
  { stage: 4, tone: "ta", short: true, d: 1, s: 0, l: 2, what: "Intro call", who: "Founder" },
  { stage: 5, tone: "tc", d: 2, s: 8, l: 4, what: "Demo", who: "VP Revenue, SaaS" },
  { stage: 5, tone: "tb", short: true, d: 4, s: 20, l: 2, what: "Intro call", who: "COO" },
  { stage: 5, tone: "te", d: 3, s: 18, l: 4, what: "Discovery", who: "Head of Partnerships" },
  { stage: 5, tone: "td", short: true, d: 5, s: 20, l: 2, what: "Intro call", who: "CEO" },
];

/** What our team tells the client as each meeting lands (played once, the final state shown). */
export const BOOKINGS = [
  { what: "Demo booked", who: "Head of Sales, fintech", when: "Tue 10:00" },
  { what: "Discovery booked", who: "VP Marketing, retail", when: "Mon 12:00" },
  { what: "Demo booked", who: "VP Sales, logistics", when: "Wed 3:00 PM" },
];

export function calendarHtml(events: readonly CalEvent[] = CAL_EVENTS): string {
  const cells = "<i></i>".repeat(30);
  const evs = events
    .map(
      (e) =>
        `<div class="cal-ev ${e.tone}${e.short ? " short" : ""}" data-stage="${e.stage}" style="--d:${e.d};--s:${e.s};--l:${e.l}"><b>${esc(e.what)}</b><span>${esc(e.who)}</span></div>`,
    )
    .join("\n          ");
  const toasts = BOOKINGS.map(
    (b, i) =>
      `<li style="--t:${(1.2 + i * 1.6).toFixed(1)}s"><span class="asa-tick" aria-hidden="true"></span><div><b>${esc(b.what)}</b><small>${esc(b.who)} · ${esc(b.when)}</small></div></li>`,
  ).join("");
  return `<div class="asa-cal-wrap">
    <div class="asa-cal-card">
      <div class="asa-cal-top"><span class="asa-cal-title"><img src="https://www.google.com/s2/favicons?domain=calendar.google.com&sz=64" alt="" width="18" height="18">Your sales team&apos;s calendar</span><span class="asa-cal-week"><i></i>Booking now</span></div>
      <div class="cal" data-cal-stage="5" role="img" aria-label="A week of sales meetings filling up in your team's calendar">
        <div class="cal-days"><span></span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span></div>
        <div class="cal-body">
          <div class="cal-hours"><span>9 AM</span><span>10 AM</span><span>11 AM</span><span>12 PM</span><span>1 PM</span><span>2 PM</span></div>
          <div class="cal-grid">${cells}
          ${evs}
          </div>
        </div>
      </div>
      <script>/* The HTML holds the full week; with motion on, the week starts empty and main.js fills it. */if(!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches))document.currentScript.previousElementSibling.setAttribute("data-cal-stage","1");</script>
    </div>
    <ol class="asa-toasts" aria-hidden="true">${toasts}</ol>
  </div>`;
}

function heroHtml(): string {
  return `<section class="ag-hero ag-dark asa-hero">
  <div class="wrap ag-hero-grid">
    <div data-motion="reveal" data-motion-stagger>
      <span class="eyebrow">B2B Appointment Setting Agency</span>
      <h1 style="margin-top:18px">The appointment setting agency that fills your calendar.</h1>
      <p class="lead">Our team finds your buyers, writes to each one and answers every reply. Your reps just show up to the meetings.</p>
      <p class="why">${WHY}</p>
      <div class="ag-ctas">
        <a class="btn btn-accent btn-lg" ${BOOK_ATTRS}>Book a call</a>
        <a class="btn btn-lg btn-ghost-d" href="#clients">See real meetings</a>
      </div>
      <p class="ag-price-line"><b>From $1K/month + 10% of budget.</b> Live in 5 days.</p>
      __HOT_LEAD_ROW__
    </div>
    ${calendarHtml()}
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Clients: the same live cards as the homepage, keyed per client
// ---------------------------------------------------------------------------

/** Markup byte-shaped like the homepage's, so `withShowcaseOutcomes` swaps in the producer's pick. */
function clientsHtml(): string {
  return `<section class="framed" id="clients">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Real clients, read live</span>
      <h2 style="margin-top:14px">Meetings we set for real companies.</h2>
      <p>Each card is a client of ours, with the interested buyers and meetings our outreach brought them.</p>
    </div>
    <div class="showcase asa-showcase">
      <div class="showcase-grid" id="live-cards">
        <a class="show-card" href="#proof" data-live data-brand="docdinners.com" data-steps="20,3">
          <div class="show-top">${LOGO("docdinners.com")}<div><div class="show-name">Doc Dinners</div><div class="show-domain">docdinners.com</div></div><span class="show-live"><i></i><em data-status>Sending</em></span></div>
          <div class="show-funnel">
            <span class="sf" data-step="conversation"><b data-n="0">20</b><small>Interested leads</small></span>
            <span class="sf" data-step="meeting_booked"><b data-n="1">3</b><small>Meetings booked</small></span>
          </div>
        </a>
        <a class="show-card" href="#proof" data-live data-brand="pressbeat.io" data-steps="7,1">
          <div class="show-top">${LOGO("pressbeat.io")}<div><div class="show-name">PressBeat</div><div class="show-domain">pressbeat.io</div></div><span class="show-live"><i></i><em data-status>Sending</em></span></div>
          <div class="show-funnel">
            <span class="sf" data-step="conversation"><b data-n="0">7</b><small>Interested leads</small></span>
            <span class="sf" data-step="meeting_booked"><b data-n="1">1</b><small>Meetings booked</small></span>
          </div>
        </a>
        <a class="show-card" href="#proof" data-live data-brand="shockwavecenters.com" data-steps="8,0">
          <div class="show-top">${LOGO("shockwavecenters.com")}<div><div class="show-name">Shockwave Centers</div><div class="show-domain">shockwavecenters.com</div></div><span class="show-live"><i></i><em data-status>Sending</em></span></div>
          <div class="show-funnel">
            <span class="sf" data-step="conversation"><b data-n="0">8</b><small>Interested leads</small></span>
            <span class="sf" data-step="meeting_booked" data-zero><b data-n="1">0</b><small>Meetings booked</small></span>
          </div>
        </a>
        <a class="show-card yours" ${BOOK_ATTRS}>
          <div class="show-top"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="32" height="32"><div><div class="show-name">Your company</div><div class="show-domain">yourcompany.com</div></div><span class="show-live"><i></i>Book a call</span></div>
          <div class="show-funnel">
            <span class="sf"><b>5 days</b><small>To go live</small></span>
            <span class="sf"><b>$1K</b><small>From, per month</small></span>
          </div>
        </a>
      </div>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Sticky story (darker variant): how a meeting gets set
// ---------------------------------------------------------------------------

export const STORY_STEPS = [
  { title: "We agree on who you want to meet", line: "On our first call we set your buyer: industry, size, role. Our agents find those people every day." },
  { title: "We write to each one", line: "One email per buyer, sent from our own domains, with WhatsApp where it fits." },
  { title: "We answer every reply", line: "Questions, objections, the right time. Our AI agents answer fast and our team keeps watch." },
  { title: "The meeting lands in your calendar", line: "Your rep gets the invite, and the whole thread waits on your dashboard." },
];

function storyHtml(): string {
  const steps = STORY_STEPS.map(
    (s, i) => `<li class="ag-step" data-step="${i + 1}"><span class="n">${i + 1}</span><b>${esc(s.title)}</b><span>${esc(s.line)}</span></li>`,
  ).join("");
  return `<section class="ag-story asa-story" id="how" data-motion="sticky-story">
  <div class="wrap ag-story-grid">
    <div>
      <div class="section-head">
        <span class="eyebrow">How we set meetings</span>
        <h2 style="margin-top:14px">From cold buyer to warm call.</h2>
        <p>Our team runs your account on data from every campaign we run. Your reps keep the calls and the deals.</p>
      </div>
      <ol class="ag-steps">${steps}</ol>
    </div>
    <div class="ag-stage asa-stage" aria-hidden="true">
      <div class="ag-scene" data-scene="1">
        <span class="ag-tag">Who you want to meet, agreed on our first call</span>
        <div class="asa-icp">
          <div><label>Industry</label><span class="chip">B2B software</span><span class="chip">Fintech</span><span class="chip">Health</span></div>
          <div><label>Team size</label><span class="chip">50 to 500 people</span></div>
          <div><label>Roles</label><span class="chip">Head of Sales</span><span class="chip">VP Marketing</span><span class="chip">Founder</span></div>
          <div><label>Meeting</label><span class="chip">30 minute demo</span><span class="chip">Your booking link</span></div>
        </div>
      </div>
      <div class="ag-scene" data-scene="2">
        <span class="ag-tag">Written for one buyer</span>
        <div class="ag-mail"><div class="h"><span>From: <b>distribute.you</b></span><span>Subject: <b>Your third clinic</b></span></div>
        <p>Hi, congrats on opening your third clinic this month.</p>
        <p>We help groups like yours fill new chairs fast. Worth 20 minutes next week?</p></div>
      </div>
      <div class="ag-scene" data-scene="3">
        <span class="ag-tag">Reply answered fast</span>
        <div class="ag-bubble them">Interesting. Does it work for groups with more than one site?</div>
        <div class="ag-bubble us">Yes, every site in one plan. Does Tuesday at 10am work for a demo?</div>
        <div class="ag-bubble them">Tuesday works.</div>
      </div>
      <div class="ag-scene" data-scene="4">
        <span class="ag-tag">In your rep&apos;s calendar</span>
        <div class="asa-invite">
          <span class="asa-day"><small>Tue</small>12</span>
          <div><b>Demo with a Head of Operations, health</b><small>10:00 to 10:30 · Google Meet</small><em>Accepted</em></div>
        </div>
        <div class="asa-note"><b>The thread, on your dashboard</b><span>Our first email named their third clinic. Asked about groups with more than one site. Picked Tuesday.</span></div>
      </div>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Every meeting: what your rep gets
// ---------------------------------------------------------------------------

export const MEETING_PARTS = [
  { title: "Who is coming", line: "Name, role and company, a buyer we agreed on with you." },
  { title: "Why they said yes", line: "The email they answered and every message after it." },
  { title: "When and where", line: "The invite in your calendar, or a time picked on your booking link." },
  { title: "What it cost", line: "The spend behind each meeting, shown on your dashboard." },
];

function meetingHtml(): string {
  const parts = MEETING_PARTS.map(
    (p, i) => `<li><span class="k">${i + 1}</span><div><h3>${esc(p.title)}</h3><p>${esc(p.line)}</p></div></li>`,
  ).join("");
  return `<section class="framed tint" id="meeting">
  <div class="wrap asa-meeting">
    <div data-motion="reveal">
      <span class="eyebrow">Every meeting</span>
      <h2 style="margin-top:14px">Your rep walks in knowing the buyer.</h2>
      <p>Each meeting arrives with its whole story. Your team reads it in a minute and starts the call warm.</p>
      <ol class="asa-parts" data-motion="reveal" data-motion-stagger>${parts}</ol>
    </div>
    <div class="asa-card" data-motion="reveal" aria-hidden="true">
      <div class="asa-card-h"><span class="asa-day light"><small>Thu</small>14</span><div><b>Demo with a VP Sales</b><small>Logistics, 150 people · 3:00 PM</small></div><em>Booked</em></div>
      <dl>
        <div><dt>First email</dt><dd>“Your second warehouse”, sent from our own domains</dd></div>
        <div><dt>They replied</dt><dd>“Good timing. What does onboarding look like?”</dd></div>
        <div><dt>We answered</dt><dd>Onboarding in one week, then offered Thursday 3pm</dd></div>
      </dl>
      <ol class="asa-trail"><li>Emailed</li><li>Replied with a question</li><li>Answered</li><li class="hot">Meeting booked</li></ol>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Proof: the live indexes a meeting reaches
// ---------------------------------------------------------------------------

/** The outcomes a meeting is judged on, in the order the page tells them. */
export const MEETING_OUTCOMES = ["meeting_booked", "positive_reply"] as const;

/** The served indexes for a meeting and for the interested reply before it; read by outcome, never by slug. */
export function meetingIndexes(list: IndexList | null): IndexSummary[] {
  if (!list) return [];
  return MEETING_OUTCOMES.flatMap((o) => list.indexes.filter((i) => i.outcome === o));
}

export function meetingProofHtml(list: IndexList | null): string {
  const rows = meetingIndexes(list);
  if (!list || !rows.length) return "";
  const n = rows.length;
  const cards = rows.map((i, k) => indexCardHtml(i, n === 1 ? 0 : k / n)).join("");
  return `<section class="ag-dark ag-proof" id="data" data-motion="scrub">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Our data, live</span>
      <h2 style="margin-top:14px">What a booked meeting costs, read live.</h2>
      <p>Cost per meeting, meeting rate and the interested replies before them, read from every campaign we run and recorded every day.</p>
    </div>
    <ul class="ag-proof-list">${cards}</ul>
    <p class="ag-legend">${esc(statusLegend(list.statusRule))}${rows.some(isExpected) ? ` ${esc(EXPECTED_LABEL)} marks a figure we expect while too few meetings are in to measure it.` : ""} <a href="/indexes">See every index</a></p>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Receipts: the proof cards, keyed per client
// ---------------------------------------------------------------------------

/** Markup byte-shaped like the homepage's proof grid, so `withShowcaseOutcomes` swaps in the producer's pick. */
function receiptsHtml(): string {
  return `<section class="framed" id="proof">
  <div class="wrap">
    <div class="section-head center rv">
      <span class="eyebrow">Receipts</span>
      <h2 style="margin-top:16px">What our clients got back for their budget.</h2>
      <p>Read off each client&apos;s own dashboard, every time this page loads.</p>
    </div>
    <div class="proof-grid">
      <article class="proof-card rv" data-proof-brand="docdinners.com">
        <div class="proof-top"><img class="face" src="/landing/v2/assets/ryan-parenti.jpg" alt=""><div><div class="name">Ryan W.D. Parenti</div><div class="meta">Founder, Doc Dinners</div></div></div>
        <div class="proof-roi"><span class="big" data-count="2.2" data-decimals="1">0<small>x</small></span><span class="lbl">return on<br>paid budget</span></div>
        <div class="proof-line" data-proof-cost-step="conversation"><span>Cost per positive reply</span><b>$225</b></div>
        <div class="proof-funnel"><span data-proof-step="contacted"><b>12,307</b>contacted</span><span data-proof-step="conversation"><b>20</b>positive replies</span><span data-proof-step="meeting_booked"><b>3</b>meetings booked</span></div>
        <div class="proof-line"><span>Channel</span><b>Cold email</b></div>
      </article>
      <article class="proof-card rv" data-proof-brand="shockwavecenters.com">
        <div class="proof-top"><img class="face" src="/landing/v2/assets/david-tucker.jpg" alt=""><div><div class="name">David Tucker</div><div class="meta">Cofounder, Shockwave Centers</div></div></div>
        <div class="proof-roi"><span class="big" data-count="2.0" data-decimals="1">0<small>x</small></span><span class="lbl">return on<br>paid budget</span></div>
        <div class="proof-line" data-proof-cost-step="conversation"><span>Cost per positive reply</span><b>$68</b></div>
        <div class="proof-funnel"><span data-proof-step="contacted"><b>5,985</b>contacted</span><span data-proof-step="conversation"><b>8</b>positive replies</span></div>
        <div class="proof-line"><span>Channel</span><b>Cold email</b></div>
      </article>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// What appointment setting costs elsewhere, read on each agency's site
// ---------------------------------------------------------------------------

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function verifiedLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function costTableHtml(): string {
  const newest = APPOINTMENT_AGENCIES.map((a) => a.verifiedOn).sort().at(-1) ?? "";
  const rows = APPOINTMENT_AGENCIES.map(
    (a) =>
      `<tr><th scope="row"><a href="${appointmentVsPath(a)}">${LOGO(a.domain, 20)}${esc(a.name)}</a></th><td>${esc(a.entryPrice)}</td><td>${a.launch ? esc(a.launch.text) : "Not stated"}</td><td><a href="${appointmentVsPath(a)}">distribute.you vs ${esc(a.name)}</a></td></tr>`,
  ).join("");
  const sources = APPOINTMENT_AGENCIES.map((a) => `<a href="${esc(a.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(a.name)}</a>`).join(", ");
  return `<section class="framed" id="compare">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Appointment setting agencies compared</span>
      <h2 style="margin-top:14px">The appointment setting agency you can start this week.</h2>
      <p>Price and time to launch, read on each agency&apos;s own site.</p>
    </div>
    <div class="ag-table-wrap asa-table" data-motion="reveal">
      <table class="ag-table">
        <thead><tr><th scope="col">Agency</th><th scope="col">Price on their site</th><th scope="col">Time to launch</th><th scope="col"></th></tr></thead>
        <tbody>
          <tr class="ours"><th scope="row"><a href="${APPOINTMENT_PAGE_PATH}"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="20" height="20">distribute.you</a></th><td class="us">${esc(OUR_APPOINTMENT_ROW.entryPrice)}</td><td class="us">${esc(OUR_APPOINTMENT_ROW.launch)}</td><td class="us"><a ${BOOK_ATTRS}>Book a call</a></td></tr>
          ${rows}
        </tbody>
      </table>
    </div>
    <p class="ag-src">Read on each site on ${esc(verifiedLabel(newest))}: ${sources}. <a href="${APPOINTMENT_ALTERNATIVES_PATH}">Every appointment setting agency alternative</a>.</p>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Bridge to the AI Agent twin, price, call, FAQ
// ---------------------------------------------------------------------------

function bridgeHtml(): string {
  return `<section class="framed">
  <div class="wrap">
    <a class="asa-bridge" href="${AI_SDR_PATH}" data-motion="reveal">
      <span><b>Rather run it yourself?</b> Our AI SDR books meetings for you, free for one user, every action at the API price.</span>
      <em>See the AI SDR</em>
    </a>
  </div>
</section>`;
}

export const APPOINTMENT_INCLUDED = [
  "Your buyers found by our AI agents every day",
  "Emails written for each buyer, sent from our own domains",
  "Every reply answered until the meeting is set",
  "Each meeting in your calendar, with its whole thread",
  "Live in 5 days from our first call",
];

export const APPOINTMENT_FAQ = [
  {
    q: "What does an appointment setting agency do?",
    a: "It books sales meetings for your team. We find the buyers you want to meet, write to each one, answer the replies and put the meeting in your calendar. Your reps take the call.",
  },
  {
    q: "Who sets the appointments, people or AI?",
    a: "Both. Our team runs your account and owns the result. Our AI agents find buyers, write each email and answer replies fast, using data from every campaign we run.",
  },
  {
    q: "Which channels do you book meetings on?",
    a: "Cold email from our own domains, and WhatsApp. Those are the channels we run and measure every day, so we can show you what each meeting cost.",
  },
  {
    q: "How many meetings will I get?",
    a: "That depends on your offer and your market, so we never quote a number up front. Your dashboard shows every reply and every meeting, and what a meeting costs across all our clients is live on our indexes.",
  },
  {
    q: "What does the price cover?",
    a: "From $1K a month for our team, plus 10% of the budget you put into your campaigns. Your budget goes to reaching your buyers, and it is a hard cap you set.",
  },
  {
    q: "Whose domains send the emails?",
    a: "Ours. Every email leaves from domains and inboxes we own and warm, so your own domain stays clean and there is nothing to set up on your side.",
  },
  {
    q: "How fast do we go live?",
    a: "Live in 5 days from our first call. The agencies compared on this page state two to three weeks or more on their own sites.",
  },
];

function faqHtml(): string {
  const items = APPOINTMENT_FAQ.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("");
  const links = [
    ...APPOINTMENT_AGENCIES.map((a) => `<a href="${appointmentVsPath(a)}">distribute.you vs ${esc(a.name)}</a>`),
    `<a href="${APPOINTMENT_ALTERNATIVES_PATH}">Appointment setting agency alternatives</a>`,
  ].join("");
  return `<section class="framed" id="faq">
  <div class="wrap">
    <div class="section-head center"><span class="eyebrow">Questions</span><h2 style="margin-top:14px">Good to know before the call.</h2></div>
    <div class="ag-faq">${items}</div>
    <nav class="ag-links" aria-label="Compare with other appointment setting agencies">${links}</nav>
  </div>
</section>`;
}

export const APPOINTMENT_TITLE = "Appointment Setting Agency: B2B sales meetings set for your team | distribute.you";
export const APPOINTMENT_DESCRIPTION =
  "Revenue made easy. A B2B appointment setting agency that finds your buyers, answers every reply and books meetings in your calendar. From $1K/month + 10% of budget.";

export function renderAppointmentSettingAgencyPage(list: IndexList | null): string {
  const url = `${SITE}${APPOINTMENT_PAGE_PATH}`;
  return shell({
    title: APPOINTMENT_TITLE,
    description: APPOINTMENT_DESCRIPTION,
    path: APPOINTMENT_PAGE_PATH,
    head: appointmentHead(),
    bodyClass: "ag",
    noCta: true,
    body: [
      heroHtml(),
      clientsHtml(),
      storyHtml(),
      meetingHtml(),
      meetingProofHtml(list),
      receiptsHtml(),
      costTableHtml(),
      priceHtml("Appointment Setting Agency", APPOINTMENT_INCLUDED),
      bridgeHtml(),
      callHtml(),
      faqHtml(),
      CALC_SCRIPT,
    ].join("\n"),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Service",
        name: "distribute.you Appointment Setting Agency",
        serviceType: "B2B appointment setting",
        url,
        description: APPOINTMENT_DESCRIPTION,
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
        mainEntity: APPOINTMENT_FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      breadcrumb([
        { name: "distribute.you", path: "/" },
        { name: "Appointment Setting Agency", path: APPOINTMENT_PAGE_PATH },
      ]),
    ],
  });
}
