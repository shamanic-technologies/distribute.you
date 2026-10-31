/**
 * `/user-acquisition-agency`: the Signups outcome, Agency buyer (PAGE-USER-ACQUISITION-AGENCY-1030,
 * owner 2026-10-29). SEO target "user acquisition agency" (20 to 40 US searches a month) and
 * "saas growth agency" (20). Its AI Agent twin is `/signup-automation`.
 *
 * What runs, read on the live catalogue on 2026-10-30 (`/v1/catalogue/pipes?q=signup`,
 * `/v1/triggers`), and nothing else is claimed: cold email (Lead → Website visit), cold WhatsApp
 * (Start → Signup, Signup → Paid client), AI follow-up email (Website visit → Signup, Signup →
 * Paid client), on the triggers Visit Without Signup In 30 Min and Signup Not Paid In 30 Min / 24
 * Hours; the facts come from connectors every client can plug (PostHog, Clerk, Stripe). No index
 * measures a signup yet, so the page states no signup figure of ours.
 *
 * Signature motion (refs #13, explee rolling numbers, DARK variant): the hero's signups board
 * rolls its counters odometer style as each event lands (motion.js `signup-roll`, shared with the
 * AI Agent twin, a different feed), then the darker sticky story. The HTML is the final state.
 *
 * Alias-free: the unit tests render it directly.
 */
import { esc } from "../fleet-indexes";
import { SITE_PAGES } from "../site-pages";
import { OUR_UA_ROW, UA_AGENCIES, UA_ALTERNATIVES_PATH, UA_PAGE_PATH, uaVsPath } from "../user-acquisition-agencies";
import { SITE, WHY, breadcrumb, shell } from "../v2-shell";
import { AGENCY_FEE_BASE_USD, BOOK_ATTRS, CALC_SCRIPT, agencyHead, callHtml, priceHtml } from "./gtm-agency";
import { SIGNUPS_CSS_VERSION, SIGNUP_CONNECTORS, boardHtml, type FeedRow } from "./signup-automation";

/** The Agency stylesheet plus the Signups layer. */
export function uaHead(): string {
  return `${agencyHead()}\n<link rel="stylesheet" href="/landing/v2/signups.css?v=${SIGNUPS_CSS_VERSION}">`;
}

/** The AI Agent twin once it is live, else the homepage. */
export function uaAgentTwin(): string {
  return SITE_PAGES.find((p) => p.outcome === "signups" && p.buyer === "agent" && p.live)?.path ?? "/";
}

const LOGO = (domain: string, size = 32) =>
  `<img src="https://img.logo.dev/${domain}?token=pk_J1iY4__HSfm9acHjR8FibA&size=64&format=png" alt="" width="${size}" height="${size}">`;

/** The hero's feed (its own, never the AI Agent page's). Roles, never a person. */
export const UA_FEED: readonly FeedRow[] = [
  { tag: "Website visit", who: "VP Marketing, HR software", what: "Opened your demo page from our email", via: "PostHog", domain: "posthog.com", adds: "visits" },
  { tag: "Signup", who: "Ops lead, logistics app", what: "Signed up after a WhatsApp invite", via: "Clerk", domain: "clerk.com", adds: "signups" },
  { tag: "Website visit", who: "Founder, AI startup", what: "Came back after a follow-up email", via: "PostHog", domain: "posthog.com", adds: "visits" },
  { tag: "Signup", who: "Founder, AI startup", what: "Started a free trial", via: "Clerk", domain: "clerk.com", adds: "signups" },
  { tag: "Paid client", who: "Ops lead, logistics app", what: "Upgraded to a paid plan", via: "Stripe", domain: "stripe.com", adds: "paid" },
];

function heroHtml(): string {
  return `<section class="ag-hero ag-dark ua-hero">
  <div class="wrap ag-hero-grid">
    <div data-motion="reveal" data-motion-stagger>
      <span class="eyebrow">User Acquisition Agency</span>
      <h1>The user acquisition agency that turns buyers into paying users.</h1>
      <p class="lead">Our team and our AI agents invite the right buyers to your product, then follow every signup until they pay.</p>
      <p class="why">${WHY}</p>
      <div class="ag-ctas">
        <a class="btn btn-accent btn-lg" ${BOOK_ATTRS}>Book a call</a>
        <a class="btn btn-lg btn-ghost-d" href="#how">See how we work</a>
      </div>
      <p class="ag-price-line"><b>From $1K/month + 10% of budget.</b> Live in 5 days.</p>
    </div>
    <div class="su-stage" aria-label="A preview of your signups board: each visit, signup and payment lands in the feed and rolls its counter up by one">
      ${boardHtml(UA_FEED, { tone: "dark", title: "Your signups, run by our team", note: "A preview of the board. Roles, never real people." })}
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Sticky story (darker variant): from first invite to paying user
// ---------------------------------------------------------------------------

export const UA_STORY_STEPS = [
  { title: "We plug into your product", line: "PostHog, Clerk and Stripe, on our first call. From then on our agents see every visit, signup and payment." },
  { title: "We invite your next users", line: "Cold email from our own domains and WhatsApp, each message written for one buyer." },
  { title: "We bring back every visitor", line: "A visitor read your site and left without signing up? Half an hour later, our agents send a short email to bring them back." },
  { title: "We stay with each signup until it pays", line: "Not paid after 30 minutes, then after 24 hours: our agents write, help and answer." },
];

function storyHtml(): string {
  const steps = UA_STORY_STEPS.map(
    (s, i) => `<li class="ag-step" data-step="${i + 1}"><span class="n">${i + 1}</span><b>${esc(s.title)}</b><span>${esc(s.line)}</span></li>`,
  ).join("");
  const plugs = SIGNUP_CONNECTORS.map(
    (c) => `<div class="ua-plug">${LOGO(c.domain, 26)}<div><b>${esc(c.name)}</b><small>${esc(c.reads)}</small></div><em>Connected</em></div>`,
  ).join("");
  return `<section class="ag-story ua-story" id="how" data-motion="sticky-story">
  <div class="wrap ag-story-grid">
    <div>
      <div class="section-head">
        <span class="eyebrow">How our user acquisition works</span>
        <h2>From the first invite to a paying user.</h2>
        <p>Our team runs your account. Our AI agents write every message and never lose a signup.</p>
      </div>
      <ol class="ag-steps">${steps}</ol>
    </div>
    <div class="ag-stage ua-stage" aria-hidden="true">
      <div class="ag-scene" data-scene="1">
        <span class="ag-tag">Your tools, connected on our first call</span>
        <div class="ua-plugs">${plugs}</div>
      </div>
      <div class="ag-scene" data-scene="2">
        <span class="ag-tag">Written for one buyer</span>
        <div class="ag-mail"><div class="h"><span>From: <b>distribute.you</b></span><span>Subject: <b>A faster way to run payroll</b></span></div>
        <p>Hi, your team just opened two offices. Our app runs payroll in every country you hire in.</p>
        <p>Here is a free account to try it this week.</p></div>
        <div class="ag-bubble us">Hi! Want me to set up a free account for your team?</div>
      </div>
      <div class="ag-scene" data-scene="3">
        <span class="ag-tag">Visited, then left</span>
        <div class="ag-row"><span class="av"></span><div>Head of People, retail<small>Read your pricing page, no signup in 30 min</small></div><em>Emailed</em></div>
        <div class="ag-row"><span class="av"></span><div>CFO, logistics<small>Came back from the follow-up</small></div><em>Signed up</em></div>
        <div class="ag-row"><span class="av"></span><div>Founder, agency<small>Opened your demo page</small></div><em>Emailed</em></div>
      </div>
      <div class="ag-scene" data-scene="4">
        <span class="ag-tag">One signup, followed to the end</span>
        <ol class="ua-events">
          <li><b>Signed up</b><small>Monday, 9:12</small></li>
          <li><b>Not paid in 30 min: a WhatsApp to help with setup</b><small>Monday, 9:42</small></li>
          <li><b>Not paid in 24 hours: an email with the next step</b><small>Tuesday, 9:12</small></li>
          <li class="hot"><b>Paid</b><small>Counted as a new paying user</small></li>
        </ol>
      </div>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// The steps we run, as the catalogue names them
// ---------------------------------------------------------------------------

export const UA_LEGS = [
  { route: "Start → Website visit", title: "Cold email", line: "We write to buyers who fit your product and send them to your site." },
  { route: "Start → Signup", title: "WhatsApp invites", line: "A short message that asks the buyer to try your product, every reply answered." },
  { route: "Website visit → Signup", title: "Visitor follow-up", line: "A visitor who left without signing up hears from us 30 minutes later." },
  { route: "Signup → Paid client", title: "Signup follow-up", line: "A new user who has not paid hears from us after 30 minutes, then after 24 hours." },
];

function legsHtml(): string {
  const items = UA_LEGS.map(
    (l) => `<li><span class="ua-route">${esc(l.route)}</span><h3>${esc(l.title)}</h3><p>${esc(l.line)}</p></li>`,
  ).join("");
  return `<section class="framed tint" id="legs">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">A SaaS growth agency, step by step</span>
      <h2>Four steps, each measured on its own.</h2>
      <p>You see what each step brings: visits, signups and paying users, with what each one cost you.</p>
    </div>
    <ul class="ua-legs" data-motion="reveal" data-motion-stagger>${items}</ul>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// What SaaS user acquisition agencies charge, read on each site
// ---------------------------------------------------------------------------

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function verifiedLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function uaCostTableHtml(): string {
  const newest = UA_AGENCIES.map((a) => a.verifiedOn).sort().at(-1) ?? "";
  const rows = UA_AGENCIES.map(
    (a) =>
      `<tr><th scope="row"><a href="${uaVsPath(a)}">${LOGO(a.domain, 20)}${esc(a.name)}</a></th><td>${esc(a.entryPrice)}</td><td>${a.launch ? esc(a.launch.text) : "Not stated"}</td><td><a href="${uaVsPath(a)}">distribute.you vs ${esc(a.name)}</a></td></tr>`,
  ).join("");
  const sources = UA_AGENCIES.map((a) => `<a href="${esc(a.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(a.name)}</a>`).join(", ");
  return `<section class="framed" id="compare">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">User acquisition agencies compared</span>
      <h2>SaaS growth agencies, side by side.</h2>
      <p>What each one charges and how fast it starts, read on its own site.</p>
    </div>
    <div class="ag-table-wrap ua-table" data-motion="reveal">
      <table class="ag-table">
        <thead><tr><th scope="col">Agency</th><th scope="col">Price on their site</th><th scope="col">Time to launch</th><th scope="col"></th></tr></thead>
        <tbody>
          <tr class="ours"><th scope="row"><a href="${UA_PAGE_PATH}"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="20" height="20">distribute.you</a></th><td class="us">${esc(OUR_UA_ROW.entryPrice)}</td><td class="us">${esc(OUR_UA_ROW.launch)}</td><td class="us"><a ${BOOK_ATTRS}>Book a call</a></td></tr>
          ${rows}
        </tbody>
      </table>
    </div>
    <p class="ag-src">Read on each site on ${esc(verifiedLabel(newest))}: ${sources}. <a href="${UA_ALTERNATIVES_PATH}">Every user acquisition agency alternative</a>.</p>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Price, call, FAQ
// ---------------------------------------------------------------------------

export const UA_INCLUDED = [
  "PostHog, Clerk and Stripe connected for you",
  "Cold email from our own domains, and WhatsApp invites",
  "Every visitor and every signup followed up",
  "Visits, signups and paying users measured, step by step",
  "Live in 5 days from our first call",
];

export function uaFaq(): { q: string; a: string }[] {
  const twin = uaAgentTwin();
  return [
    {
      q: "What does a user acquisition agency do?",
      a: "A user acquisition agency brings new users to your product. Ours invites the right buyers by cold email and WhatsApp, brings visitors back, and follows each signup until they pay.",
    },
    {
      q: "Are you a SaaS growth agency?",
      a: "Yes. We grow SaaS products by signups and paying users, with our team and our AI agents, from data on every campaign we run.",
    },
    {
      q: "Which channels do you use?",
      a: "Cold email, sent from domains and inboxes we own, and WhatsApp. There is nothing to set up on your side, and your own domain stays clean.",
    },
    {
      q: "What happens after someone signs up?",
      a: "A new user who has not paid 30 minutes later gets a message to help. A new user still not paid after 24 hours hears from us again, and every reply gets an answer.",
    },
    {
      q: "How do you know who visited, signed up or paid?",
      a: "PostHog tells our agents who visited, Clerk who signed up, Stripe who paid. We connect them on our first call, and any client can plug them.",
    },
    {
      q: "What does the price cover?",
      a: "Our team starts at $1K a month, plus 10% of the budget your campaigns use. That budget goes to reaching new users, and you set its hard cap.",
    },
    {
      q: "How fast do we go live?",
      a: "Live in 5 days from our first call. The first invites go out that same week.",
    },
    {
      q: "Can I run it myself instead?",
      a: `Yes. Our <a href="${twin}">Signup Automation</a> is the same AI agent, free for one user, every action at the API price.`,
    },
  ];
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, "");

function faqHtml(): string {
  const items = uaFaq()
    .map((f) => `<details><summary>${esc(f.q)}</summary><p>${f.a}</p></details>`)
    .join("");
  const links = [
    ...UA_AGENCIES.map((a) => `<a href="${uaVsPath(a)}">distribute.you vs ${esc(a.name)}</a>`),
    `<a href="${UA_ALTERNATIVES_PATH}">User acquisition agency alternatives</a>`,
    `<a href="${uaAgentTwin()}">Signup Automation</a>`,
  ].join("");
  return `<section class="framed" id="faq">
  <div class="wrap">
    <div class="section-head center"><span class="eyebrow">Questions</span><h2>Before we meet your next users.</h2></div>
    <div class="ag-faq">${items}</div>
    <nav class="ag-links" aria-label="Compare with other user acquisition agencies">${links}</nav>
  </div>
</section>`;
}

export const UA_TITLE = "User Acquisition Agency: more signups and paying users for SaaS | distribute.you";
export const UA_DESCRIPTION =
  "Revenue made easy. A user acquisition agency for SaaS: buyers invited by cold email and WhatsApp, every signup followed until they pay. From $1K/month + 10% of budget.";

export function renderUserAcquisitionAgencyPage(): string {
  const url = `${SITE}${UA_PAGE_PATH}`;
  const faq = uaFaq();
  return shell({
    title: UA_TITLE,
    description: UA_DESCRIPTION,
    path: UA_PAGE_PATH,
    head: uaHead(),
    bodyClass: "ag",
    noCta: true,
    body: [
      heroHtml(),
      storyHtml(),
      legsHtml(),
      uaCostTableHtml(),
      priceHtml("User Acquisition Agency", UA_INCLUDED),
      callHtml(uaAgentTwin()),
      faqHtml(),
      CALC_SCRIPT,
    ].join("\n"),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Service",
        name: "distribute.you User Acquisition Agency",
        serviceType: "User acquisition",
        url,
        description: UA_DESCRIPTION,
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
        mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: stripTags(f.a) } })),
      },
      breadcrumb([
        { name: "distribute.you", path: "/" },
        { name: "User Acquisition Agency", path: UA_PAGE_PATH },
      ]),
    ],
  });
}
