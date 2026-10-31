/**
 * `/database-reactivation-agency`: the Lead Nurturing outcome, Agency buyer
 * (PAGE-DATABASE-REACTIVATION-AGENCY-1030, owner 2026-10-29). SEO target "database reactivation"
 * (70 US searches a month, CPC $33.75) and "lead nurturing agency".
 *
 * Buyer: a company that makes cash and sits on a CRM full of contacts who went quiet. We bring
 * them back: the client's own tools are plugged through the connectors every client can plug
 * (GoHighLevel, Stripe, Clerk, PostHog), our AI agents write by email and WhatsApp, and the one
 * reactive campaign on "Lead event" (a reply, a visit, a signup, a meeting, a payment) decides to
 * write now, follow up later, or wait. Same offer as every Agency page ("From $1K/month + 10% of
 * budget", Book a call). Channels: only what we run (email from our own domains, WhatsApp).
 *
 * Signature motion: a WhatsApp thread where a lead silent for months comes back (motion.js
 * `wa-thread`, explee's agent chat with typing dots), then the darker sticky story. The HTML is
 * the final state (every message shown); reduced motion plays nothing.
 *
 * Every figure is READ at render, never typed here:
 * - the indexes a revived lead reaches (`/v1/public/indexes`, by outcome);
 * - the cost table: `reactivation-agencies.ts`, each figure read on the agency's own site.
 * A failed read drops its block, never prints a number nobody measured. The thread, the CRM rows
 * and the story scenes are a product preview: roles and company types, no person, no figure.
 *
 * Alias-free: the unit tests render it directly.
 */
import { EXPECTED_LABEL, esc, isExpected, statusLegend, type IndexList, type IndexSummary } from "../fleet-indexes";
import {
  OUR_REACTIVATION_ROW,
  REACTIVATION_AGENCIES,
  REACTIVATION_ALTERNATIVES_PATH,
  REACTIVATION_PAGE_PATH,
  reactivationVsPath,
} from "../reactivation-agencies";
import { NURTURING_PAGE_PATH } from "../nurturing-tools";
import { SITE, WHY, breadcrumb, shell } from "../v2-shell";
import { AGENCY_FEE_BASE_USD, BOOK_ATTRS, CALC_SCRIPT, agencyHead, callHtml, indexCardHtml, priceHtml } from "./gtm-agency";

export const REACTIVATION_CSS_VERSION = 2;

/** The Agency stylesheet plus this page's own layer. */
export function reactivationHead(): string {
  return `${agencyHead()}\n<link rel="stylesheet" href="/landing/v2/database-reactivation.css?v=${REACTIVATION_CSS_VERSION}">`;
}

const LOGO = (domain: string, size = 32) =>
  `<img src="https://img.logo.dev/${domain}?token=pk_J1iY4__HSfm9acHjR8FibA&size=64&format=png" alt="" width="${size}" height="${size}">`;

/** The tools a client plugs so we can read their contacts and what each one does (every client can plug them). */
export const CONNECTORS = [
  { name: "GoHighLevel", domain: "gohighlevel.com", reads: "Your contacts and pipeline stages" },
  { name: "Stripe", domain: "stripe.com", reads: "Who paid, who stopped" },
  { name: "Clerk", domain: "clerk.com", reads: "Who signed up for your product" },
  { name: "PostHog", domain: "posthog.com", reads: "Who came back to your site" },
] as const;

// ---------------------------------------------------------------------------
// Hero: a lead silent for months, back on WhatsApp
// ---------------------------------------------------------------------------

export type WaMsg = { from: "them" | "us" | "event"; text: string; time: string };

/** The thread the hero plays (motion.js `wa-thread`). A product preview: a role, never a person. */
export const THREAD: readonly WaMsg[] = [
  { from: "us", text: "Hi again. In March you said next quarter would be better for you. We just launched a plan built for teams your size. Still on your list?", time: "10:02" },
  { from: "them", text: "Good timing, actually. We got the budget last week.", time: "10:09" },
  { from: "us", text: "Great news. Would Thursday at 10am work for a short call?", time: "10:10" },
  { from: "them", text: "Thursday works.", time: "10:14" },
  { from: "event", text: "Meeting booked · Thu 10:00", time: "" },
];

const TICKS = '<svg class="wa-ticks" viewBox="0 0 18 12" aria-hidden="true"><path d="M1 6.5l3 3 6.5-7.5M7.5 9.5l1 1 6.5-8.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function threadHtml(thread: readonly WaMsg[] = THREAD): string {
  const msgs = thread
    .map((m) =>
      m.from === "event"
        ? `<div class="wa-event" data-msg="event"><span class="dra-dot" aria-hidden="true"></span>${esc(m.text)}</div>`
        : `<div class="wa-msg ${m.from}${m.from === "us" ? " is-read" : ""}" data-msg="${m.from}"><p>${esc(m.text)}</p><span class="wa-meta">${esc(m.time)}${m.from === "us" ? TICKS : ""}</span></div>`,
    )
    .join("\n        ");
  return `<div class="dra-phone-wrap" data-motion="wa-thread">
    <div class="dra-phone" role="img" aria-label="A WhatsApp thread where a lead who went quiet in March replies and books a meeting">
      <div class="wa-top">
        <span class="wa-av" aria-hidden="true">HO</span>
        <div><b>Head of Operations, logistics</b><small data-presence>last seen in March</small></div>
        <img src="https://www.google.com/s2/favicons?domain=whatsapp.com&sz=64" alt="" width="20" height="20">
      </div>
      <div class="wa-thread">
        <span class="wa-day">March</span>
        <div class="wa-msg them old"><p>Not the right time for us. Maybe next quarter.</p><span class="wa-meta">16:41</span></div>
        <span class="wa-day">Today</span>
        ${msgs}
        <div class="wa-typing" data-typing aria-hidden="true"><i></i><i></i><i></i></div>
      </div>
    </div>
    <div class="dra-crm" aria-hidden="true">
      <span class="dra-crm-h">${LOGO("gohighlevel.com", 18)}Your CRM</span>
      <div class="dra-crm-row"><span>Status</span><s>Dormant since March</s></div>
      <div class="dra-crm-row now" data-msg="event"><span>Now</span><b>Meeting booked, call on Thursday</b></div>
    </div>
  </div>`;
}

function heroHtml(): string {
  return `<section class="ag-hero ag-dark dra-hero">
  <div class="wrap ag-hero-grid">
    <div data-motion="reveal" data-motion-stagger>
      <span class="eyebrow">Database Reactivation Agency</span>
      <h1>Database reactivation that turns old leads into new meetings.</h1>
      <p class="lead">Your CRM already holds your next clients. Our team wakes them up by email and WhatsApp, and books the ones who answer.</p>
      <p class="why">${WHY}</p>
      <div class="ag-ctas">
        <a class="btn btn-accent btn-lg" ${BOOK_ATTRS}>Book a call</a>
        <a class="btn btn-lg btn-ghost-d" href="#how">See how it works</a>
      </div>
      <p class="ag-price-line"><b>From $1K/month + 10% of budget.</b> Live in 5 days. <a href="${NURTURING_PAGE_PATH}">Rather run it yourself? Lead Nurturing Automation, free.</a></p>
      <ul class="dra-plugs" aria-label="Tools we connect to">${CONNECTORS.map((c) => `<li>${LOGO(c.domain, 18)}${esc(c.name)}</li>`).join("")}</ul>
    </div>
    ${threadHtml()}
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Sticky story (darker variant): how a quiet lead comes back
// ---------------------------------------------------------------------------

export const STORY_STEPS = [
  { title: "We plug into your tools", line: "GoHighLevel, Stripe, Clerk or PostHog. Your past leads, trials and old clients, read in one place." },
  { title: "We find who is ready", line: "A visit last week, a trial never paid, a lead who said next quarter. Each one is a reason to write." },
  { title: "We write on the channel they answer", line: "One message per person, by email from our own domains or on WhatsApp, about what they told you." },
  { title: "When they move, we answer", line: "A reply, a click, a signup. Our agents answer fast, plan the next follow-up and book the call." },
];

function storyHtml(): string {
  const steps = STORY_STEPS.map(
    (s, i) => `<li class="ag-step" data-step="${i + 1}"><span class="n">${i + 1}</span><b>${esc(s.title)}</b><span>${esc(s.line)}</span></li>`,
  ).join("");
  const plugs = CONNECTORS.map(
    (c) => `<div class="dra-plug">${LOGO(c.domain, 26)}<div><b>${esc(c.name)}</b><small>${esc(c.reads)}</small></div><em>Connected</em></div>`,
  ).join("");
  return `<section class="ag-story dra-story" id="how" data-motion="sticky-story">
  <div class="wrap ag-story-grid">
    <div>
      <div class="section-head">
        <span class="eyebrow">How we reactivate your database</span>
        <h2>From quiet contact to booked call.</h2>
        <p>Our team runs your account. Our AI agents read every sign of life and answer it on time.</p>
      </div>
      <ol class="ag-steps">${steps}</ol>
    </div>
    <div class="ag-stage dra-stage" aria-hidden="true">
      <div class="ag-scene" data-scene="1">
        <span class="ag-tag">Your tools, connected on our first call</span>
        <div class="dra-plugs-grid">${plugs}</div>
      </div>
      <div class="ag-scene" data-scene="2">
        <span class="ag-tag">Ready to hear from you</span>
        <div class="ag-row"><span class="av"></span><div>VP Sales, logistics<small>Visited your pricing page yesterday</small></div><em>Write now</em></div>
        <div class="ag-row"><span class="av"></span><div>Founder, SaaS<small>Started a trial in June, never paid</small></div><em>Write now</em></div>
        <div class="ag-row"><span class="av"></span><div>Head of Ops, health<small>Said &ldquo;next quarter&rdquo; in March</small></div><em>Write now</em></div>
        <div class="ag-row dim"><span class="av"></span><div>Office manager, retail<small>No sign since last year</small></div><em class="wait">Wait</em></div>
      </div>
      <div class="ag-scene" data-scene="3">
        <span class="ag-tag">Written for one person</span>
        <div class="ag-mail"><div class="h"><span>From: <b>distribute.you</b></span><span>Subject: <b>Your trial from June</b></span></div>
        <p>Hi, you tried our reporting in June and stopped at the import step.</p>
        <p>That step takes one click now. Want me to set it up with you on a short call?</p></div>
        <div class="dra-wa-mini"><span>${LOGO("whatsapp.com", 16)}WhatsApp</span>Hi again. You asked about multi site plans in March. They are live now.</div>
      </div>
      <div class="ag-scene" data-scene="4">
        <span class="ag-tag">Every move, answered</span>
        <ol class="dra-events">
          <li><b>Clicked your link</b><small>Tuesday 9:12</small></li>
          <li><b>Replied: &ldquo;Can we talk this week?&rdquo;</b><small>Tuesday 9:40</small></li>
          <li class="hot"><b>Meeting booked</b><small>Thursday 10:00</small></li>
        </ol>
        <div class="dra-next"><b>Next follow-up</b><span>Set after every message, so no lead is forgotten.</span></div>
      </div>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// What wakes a lead: the signs of life we act on
// ---------------------------------------------------------------------------

export const SIGNALS = [
  { title: "A reply", line: "Even a short one. We answer while they still have you in mind." },
  { title: "A visit", line: "They came back to your site. We write while the page is still open." },
  { title: "A signup", line: "They tried your product. We help them reach the moment it clicks." },
  { title: "A payment", line: "They bought or stopped paying. We thank them, or bring them back." },
];

function signalsHtml(): string {
  const cards = SIGNALS.map((s, i) => `<li><span class="k">${i + 1}</span><div><h3>${esc(s.title)}</h3><p>${esc(s.line)}</p></div></li>`).join("");
  const rows = CONNECTORS.map((c) => `<li>${LOGO(c.domain, 22)}<b>${esc(c.name)}</b><span>${esc(c.reads)}</span></li>`).join("");
  return `<section class="framed tint" id="signals">
  <div class="wrap dra-signals">
    <div data-motion="reveal">
      <span class="eyebrow">Lead nurturing, on time</span>
      <h2>Your contacts keep sending signals.</h2>
      <p>Each sign of life tells our agents what to do next: write now, follow up later, or wait. Every lead always has its next follow-up date.</p>
      <ol class="dra-sig" data-motion="reveal" data-motion-stagger>${cards}</ol>
    </div>
    <div class="dra-conn" data-motion="reveal">
      <h3>Read from the tools you already use</h3>
      <ul>${rows}</ul>
      <p>Your data stays in your tools. We read it to pick the right moment, and every message shows up on your dashboard.</p>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Proof: the live indexes a revived lead reaches
// ---------------------------------------------------------------------------

/** The outcomes a reactivated lead is judged on, in the order the page tells them. */
export const REACTIVATION_OUTCOMES = ["positive_reply", "meeting_booked"] as const;

/** The served indexes for an interested reply and the meeting after it; read by outcome, never by slug. */
export function reactivationIndexes(list: IndexList | null): IndexSummary[] {
  if (!list) return [];
  return REACTIVATION_OUTCOMES.flatMap((o) => list.indexes.filter((i) => i.outcome === o));
}

export function reactivationProofHtml(list: IndexList | null): string {
  const rows = reactivationIndexes(list);
  if (!list || !rows.length) return "";
  const n = rows.length;
  const cards = rows.map((i, k) => indexCardHtml(i, n === 1 ? 0 : k / n)).join("");
  return `<section class="ag-dark ag-proof dra-proof" id="data" data-motion="scrub">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Our data, live</span>
      <h2>What a reply and a meeting cost, read live.</h2>
      <p>Measured on every campaign we run, cold leads included, and recorded every day. Your past leads start from there, and they already know your name.</p>
    </div>
    <ul class="ag-proof-list">${cards}</ul>
    <p class="ag-legend">${esc(statusLegend(list.statusRule))}${rows.some(isExpected) ? ` ${esc(EXPECTED_LABEL)} marks a figure we expect while too few results are in to measure it.` : ""} <a href="/indexes">See every index</a></p>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// We run it on our own leads first
// ---------------------------------------------------------------------------

function ownHtml(): string {
  return `<section class="framed" id="ours">
  <div class="wrap dra-own" data-motion="reveal">
    <div>
      <span class="eyebrow">We use it ourselves</span>
      <h2>Our own leads get the same care.</h2>
      <p>Every person who visits, replies or signs up with us is followed the same way, by the same agents. What works on our leads reaches yours the same day.</p>
    </div>
    <ul class="dra-own-list">
      <li><b>One campaign per brand</b><span>It starts on any move a lead makes, so nobody waits for a list to be built.</span></li>
      <li><b>A next date for every lead</b><span>Set after each message we send, then served on the day.</span></li>
      <li><b>Only people who showed a sign of life</b><span>A lead we only wrote to stays cold until they act.</span></li>
    </ul>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// What database reactivation costs elsewhere, read on each agency's site
// ---------------------------------------------------------------------------

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function verifiedLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function costTableHtml(): string {
  const newest = REACTIVATION_AGENCIES.map((a) => a.verifiedOn).sort().at(-1) ?? "";
  const rows = REACTIVATION_AGENCIES.map(
    (a) =>
      `<tr><th scope="row"><a href="${reactivationVsPath(a)}">${LOGO(a.domain, 20)}${esc(a.name)}</a></th><td>${esc(a.entryPrice)}</td><td>${a.launch ? esc(a.launch.text) : "Not stated"}</td><td><a href="${reactivationVsPath(a)}">distribute.you vs ${esc(a.name)}</a></td></tr>`,
  ).join("");
  const sources = REACTIVATION_AGENCIES.map((a) => `<a href="${esc(a.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(a.name)}</a>`).join(", ");
  return `<section class="framed" id="compare">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Database reactivation agencies compared</span>
      <h2>The reactivation agency that keeps going after the first send.</h2>
      <p>What each one charges and how fast it starts, read on its own site.</p>
    </div>
    <div class="ag-table-wrap dra-table" data-motion="reveal">
      <table class="ag-table">
        <thead><tr><th scope="col">Agency</th><th scope="col">Price on their site</th><th scope="col">Time to launch</th><th scope="col"></th></tr></thead>
        <tbody>
          <tr class="ours"><th scope="row"><a href="${REACTIVATION_PAGE_PATH}"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="20" height="20">distribute.you</a></th><td class="us">${esc(OUR_REACTIVATION_ROW.entryPrice)}</td><td class="us">${esc(OUR_REACTIVATION_ROW.launch)}</td><td class="us"><a ${BOOK_ATTRS}>Book a call</a></td></tr>
          ${rows}
        </tbody>
      </table>
    </div>
    <p class="ag-src">Read on each site on ${esc(verifiedLabel(newest))}: ${sources}. <a href="${REACTIVATION_ALTERNATIVES_PATH}">Every database reactivation agency alternative</a>.</p>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Price, call, FAQ
// ---------------------------------------------------------------------------

export const REACTIVATION_INCLUDED = [
  "Your CRM and product tools connected for you",
  "Each quiet lead read for a reason to write",
  "Messages by email from our own domains and on WhatsApp",
  "Every reply answered until the call is booked",
  "Live in 5 days from our first call",
];

export const REACTIVATION_FAQ = [
  {
    q: "What is database reactivation?",
    a: "It is writing again to the people already in your CRM: past leads, trials that never paid, old clients. They know your name, so a good message at the right moment brings many of them back to a call.",
  },
  {
    q: "How is it different from lead nurturing?",
    a: "Reactivation wakes the contacts who went quiet. Nurturing keeps every lead moving after that. We do both: each lead carries its next follow-up date, and every reply, visit or signup is answered.",
  },
  {
    q: "Which channels do you use?",
    a: "Email sent from our own domains, and WhatsApp. Those are the channels we run and measure every day, so you see what each reply and each meeting cost.",
  },
  {
    q: "Which tools can you connect to?",
    a: "GoHighLevel for your contacts and pipeline, Stripe for payments, Clerk for signups and PostHog for site visits. Any client can plug them in a few clicks.",
  },
  {
    q: "Will you write to people who never asked to hear from us?",
    a: "We write to the people in your own database, about what they already told you. Anyone who asks to stop is never written to again.",
  },
  {
    q: "What does the price cover?",
    a: "Our team starts at $1K a month, plus 10% of the budget your campaigns use. That budget goes to reaching your contacts, and you set its hard cap.",
  },
  {
    q: "How fast do we go live?",
    a: "Live in 5 days from our first call. Your first quiet leads hear from us that same week.",
  },
];

function faqHtml(): string {
  const items = REACTIVATION_FAQ.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("");
  const links = [
    ...REACTIVATION_AGENCIES.map((a) => `<a href="${reactivationVsPath(a)}">distribute.you vs ${esc(a.name)}</a>`),
    `<a href="${REACTIVATION_ALTERNATIVES_PATH}">Database reactivation agency alternatives</a>`,
    `<a href="${NURTURING_PAGE_PATH}">Lead Nurturing Automation</a>`,
  ].join("");
  return `<section class="framed" id="faq">
  <div class="wrap">
    <div class="section-head center"><span class="eyebrow">Questions</span><h2>Before we wake your database.</h2></div>
    <div class="ag-faq">${items}</div>
    <nav class="ag-links" aria-label="Compare with other database reactivation agencies">${links}</nav>
  </div>
</section>`;
}

export const REACTIVATION_TITLE = "Database Reactivation Agency: old leads turned into meetings | distribute.you";
export const REACTIVATION_DESCRIPTION =
  "Revenue made easy. A database reactivation and lead nurturing agency that wakes your past leads by email and WhatsApp and books the ones who answer. From $1K/month + 10% of budget.";

export function renderDatabaseReactivationAgencyPage(list: IndexList | null): string {
  const url = `${SITE}${REACTIVATION_PAGE_PATH}`;
  return shell({
    title: REACTIVATION_TITLE,
    description: REACTIVATION_DESCRIPTION,
    path: REACTIVATION_PAGE_PATH,
    head: reactivationHead(),
    bodyClass: "ag",
    noCta: true,
    body: [
      heroHtml(),
      storyHtml(),
      signalsHtml(),
      reactivationProofHtml(list),
      ownHtml(),
      costTableHtml(),
      priceHtml("Database Reactivation Agency", REACTIVATION_INCLUDED),
      callHtml(),
      faqHtml(),
      CALC_SCRIPT,
    ].join("\n"),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Service",
        name: "distribute.you Database Reactivation Agency",
        serviceType: "Database reactivation and lead nurturing",
        url,
        description: REACTIVATION_DESCRIPTION,
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
        mainEntity: REACTIVATION_FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      breadcrumb([
        { name: "distribute.you", path: "/" },
        { name: "Database Reactivation Agency", path: REACTIVATION_PAGE_PATH },
      ]),
    ],
  });
}
