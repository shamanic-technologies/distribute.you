/**
 * `/customer-success-agency`: the Customer Success outcome, Agency buyer
 * (PAGE-CUSTOMER-SUCCESS-AGENCY-1030, owner 2026-10-29: our WhatsApp campaigns cover customer
 * success). SEO target "customer success agency" (70 US searches a month) and "customer success
 * outsourcing" (20 to 30).
 *
 * What runs, read on the live catalogue on 2026-10-30 (`/v1/catalogue/pipes`, `/v1/triggers`):
 * - after "Paid client" the one leg is "Paid client → Client Satisfied", worked on WhatsApp
 *   (reactive, starts on the Paid client trigger);
 * - "Message Received" fires when a person writes to the brand on WhatsApp or email;
 * - "Follow-up Due" fires on the next follow-up date every send sets;
 * - "Client Satisfied" is reached when a paying client writes a message that reads positive,
 *   each such message counted once.
 * Nothing else is claimed: no phone, no SMS, no ticket desk, no figure (no index measures this
 * leg yet, so the page carries no proof block).
 *
 * Signature motion (refs #17, oxygen community posts): a reel of WhatsApp threads scrolling in
 * columns, with a visible pause toggle that stops the reel and shows every thread (motion.js
 * `post-reel`). No real client message is published (we hold no consent to quote one), so every
 * thread is an EXAMPLE, said so under the reel: roles and moments, no person, no figure. The
 * HTML is the final state (every thread in a plain grid); reduced motion plays nothing.
 * Then the darker sticky story.
 *
 * Alias-free: the unit tests render it directly.
 */
import { esc } from "../fleet-indexes";
import {
  CS_AGENCIES,
  CS_ALTERNATIVES_PATH,
  CS_PAGE_PATH,
  OUR_CS_ROW,
  csVsPath,
} from "../customer-success-agencies";
import { SITE, WHY, breadcrumb, shell } from "../v2-shell";
import { AGENCY_FEE_BASE_USD, BOOK_ATTRS, CALC_SCRIPT, agencyHead, callHtml, priceHtml } from "./gtm-agency";

export const CS_CSS_VERSION = 1;

/** The Agency stylesheet plus this page's own layer. */
export function csHead(): string {
  return `${agencyHead()}\n<link rel="stylesheet" href="/landing/v2/customer-success.css?v=${CS_CSS_VERSION}">`;
}

const LOGO = (domain: string, size = 32) =>
  `<img src="https://img.logo.dev/${domain}?token=pk_J1iY4__HSfm9acHjR8FibA&size=64&format=png" alt="" width="${size}" height="${size}">`;

/** The tools a client plugs so we know who paid and who wrote (every client can plug them). */
export const CS_CONNECTORS = [
  { name: "Stripe", domain: "stripe.com", reads: "Who just paid" },
  { name: "GoHighLevel", domain: "gohighlevel.com", reads: "Your clients and their stage" },
  { name: "Clerk", domain: "clerk.com", reads: "Who signed up for your product" },
  { name: "PostHog", domain: "posthog.com", reads: "Who came back to your site" },
] as const;

// ---------------------------------------------------------------------------
// Hero: a reel of example WhatsApp threads, with a pause toggle
// ---------------------------------------------------------------------------

export type PostLine = { from: "them" | "us"; text: string };
export type ThreadPost = {
  /** The catalogue moment the thread starts on. */
  moment: string;
  /** Where we read that moment. */
  via: string;
  lines: readonly PostLine[];
  /** What the thread ends on. */
  result: string;
  hot?: boolean;
};

/** Example threads, one per moment we act on. A product preview: roles, never a person. */
export const POSTS: readonly ThreadPost[] = [
  {
    moment: "Paid client",
    via: "Stripe",
    lines: [
      { from: "us", text: "Welcome aboard! Your account is live. What is the one result you want from us this month?" },
      { from: "them", text: "More demos booked from our site." },
      { from: "us", text: "Noted. I will check in with you on Friday about it." },
    ],
    result: "Next check-in set for Friday",
  },
  {
    moment: "Message received",
    via: "WhatsApp",
    lines: [
      { from: "them", text: "How do I add a second user to our account?" },
      { from: "us", text: "Settings, then Team, then Invite. Want me to send the invite for you?" },
      { from: "them", text: "Yes please, thank you!" },
    ],
    result: "Answered",
  },
  {
    moment: "Follow-up due",
    via: "Planned date",
    lines: [
      { from: "us", text: "Quick check: did the new report save your team time this week?" },
      { from: "them", text: "Big time. The whole team loves it." },
    ],
    result: "Client satisfied",
    hot: true,
  },
  {
    moment: "Signup",
    via: "Clerk",
    lines: [
      { from: "us", text: "Thanks for signing up yesterday. Want a hand with the first setup step?" },
      { from: "them", text: "Yes, I got stuck on the import." },
      { from: "us", text: "Here is a short guide. Write back here if it sticks." },
    ],
    result: "Next check-in set for tomorrow",
  },
  {
    moment: "Message received",
    via: "Email",
    lines: [
      { from: "them", text: "Our last invoice shows the wrong company name." },
      { from: "us", text: "Fixed. The new invoice is in your inbox." },
    ],
    result: "Answered",
  },
  {
    moment: "Client satisfied",
    via: "WhatsApp",
    lines: [
      { from: "them", text: "We just closed our biggest deal of the quarter. Thank you!" },
      { from: "us", text: "Wonderful news. Congrats to the whole team!" },
    ],
    result: "Counted as a result",
    hot: true,
  },
];

const TICKS = '<svg class="csa-ticks" viewBox="0 0 18 12" aria-hidden="true"><path d="M1 6.5l3 3 6.5-7.5M7.5 9.5l1 1 6.5-8.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function postHtml(p: ThreadPost): string {
  const lines = p.lines
    .map((l) => `<p class="csa-bub ${l.from}">${esc(l.text)}${l.from === "us" ? TICKS : ""}</p>`)
    .join("");
  return `<article class="csa-post">
        <div class="csa-post-h"><span class="csa-moment">${esc(p.moment)}</span><small>${esc(p.via)}</small></div>
        <div class="csa-lines">${lines}</div>
        <div class="csa-post-f${p.hot ? " hot" : ""}"><span class="csa-dot" aria-hidden="true"></span>${esc(p.result)}</div>
      </article>`;
}

/** The reel (motion.js `post-reel`): every thread in the HTML, the toggle shown only while it can play. */
export function reelHtml(posts: readonly ThreadPost[] = POSTS): string {
  return `<div class="csa-reel" data-motion="post-reel">
    <div class="csa-reel-grid" data-reel-grid>
      ${posts.map(postHtml).join("\n      ")}
    </div>
    <div class="csa-reel-foot">
      <p class="csa-note">Example threads, written to show the flow.</p>
      <button type="button" class="csa-reel-toggle" data-reel-toggle aria-pressed="false">Pause and show every thread</button>
    </div>
  </div>`;
}

function heroHtml(): string {
  return `<section class="ag-hero ag-dark csa-hero">
  <div class="wrap ag-hero-grid">
    <div data-motion="reveal" data-motion-stagger>
      <span class="eyebrow">Customer Success Agency</span>
      <h1 style="margin-top:18px">The customer success agency that keeps your clients happy.</h1>
      <p class="lead">Our team and our AI agents talk to your paying clients on WhatsApp. Every client is welcomed, answered and checked on.</p>
      <p class="why">${WHY}</p>
      <div class="ag-ctas">
        <a class="btn btn-accent btn-lg" ${BOOK_ATTRS}>Book a call</a>
        <a class="btn btn-lg btn-ghost-d" href="#how">See how it works</a>
      </div>
      <p class="ag-price-line"><b>From $1K/month + 10% of budget.</b> Live in 5 days.</p>
      <ul class="csa-plugs" aria-label="Tools we connect to">${CS_CONNECTORS.map((c) => `<li>${LOGO(c.domain, 18)}${esc(c.name)}</li>`).join("")}</ul>
    </div>
    ${reelHtml()}
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Sticky story (darker variant): from first payment to happy client
// ---------------------------------------------------------------------------

export const CS_STORY_STEPS = [
  { title: "We plug into your tools", line: "Stripe, GoHighLevel, Clerk or PostHog. The moment a client pays, our agents know." },
  { title: "We welcome them on WhatsApp", line: "A warm first message the day they pay, asking what success looks like for them." },
  { title: "We answer every message", line: "A question on WhatsApp or by email gets a clear answer, in the same thread." },
  { title: "We check in, and count the wins", line: "A next check-in is planned after every message. Each happy message counts as a result." },
];

function storyHtml(): string {
  const steps = CS_STORY_STEPS.map(
    (s, i) => `<li class="ag-step" data-step="${i + 1}"><span class="n">${i + 1}</span><b>${esc(s.title)}</b><span>${esc(s.line)}</span></li>`,
  ).join("");
  const plugs = CS_CONNECTORS.map(
    (c) => `<div class="csa-plug">${LOGO(c.domain, 26)}<div><b>${esc(c.name)}</b><small>${esc(c.reads)}</small></div><em>Connected</em></div>`,
  ).join("");
  return `<section class="ag-story csa-story" id="how" data-motion="sticky-story">
  <div class="wrap ag-story-grid">
    <div>
      <div class="section-head">
        <span class="eyebrow">How our customer success works</span>
        <h2 style="margin-top:14px">From first payment to happy client.</h2>
        <p>Our team runs your account. Our AI agents write first, answer fast and never lose a thread.</p>
      </div>
      <ol class="ag-steps">${steps}</ol>
    </div>
    <div class="ag-stage csa-stage" aria-hidden="true">
      <div class="ag-scene" data-scene="1">
        <span class="ag-tag">Your tools, connected on our first call</span>
        <div class="csa-plugs-grid">${plugs}</div>
      </div>
      <div class="ag-scene" data-scene="2">
        <span class="ag-tag">Paid today</span>
        <div class="csa-paid">${LOGO("stripe.com", 22)}<div><b>New paying client</b><small>Head of Sales, software company</small></div><em>Paid</em></div>
        <p class="csa-bub us lone">Welcome aboard! Your account is live. What is the one result you want from us this month?${TICKS}</p>
      </div>
      <div class="ag-scene" data-scene="3">
        <span class="ag-tag">Every message, answered</span>
        <div class="ag-row"><span class="av"></span><div>COO, logistics<small>WhatsApp: &ldquo;Can we add a second team?&rdquo;</small></div><em>Answered</em></div>
        <div class="ag-row"><span class="av"></span><div>Founder, agency<small>Email: &ldquo;Where is my last invoice?&rdquo;</small></div><em>Answered</em></div>
        <div class="ag-row"><span class="av"></span><div>Ops lead, retail<small>WhatsApp: &ldquo;Thanks, all set now.&rdquo;</small></div><em>Answered</em></div>
      </div>
      <div class="ag-scene" data-scene="4">
        <span class="ag-tag">A next check-in, always</span>
        <ol class="csa-events">
          <li><b>Welcome sent on WhatsApp</b><small>Monday</small></li>
          <li><b>Check-in: &ldquo;Did the report help this week?&rdquo;</b><small>Friday</small></li>
          <li class="hot"><b>Client wrote: &ldquo;The whole team loves it.&rdquo;</b><small>Counted as a happy client</small></li>
        </ol>
        <div class="csa-next"><b>Next check-in</b><span>Set after every message, so no client is forgotten.</span></div>
      </div>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// The moments we act on, as the catalogue names them
// ---------------------------------------------------------------------------

export const MOMENTS = [
  { title: "Paid client", line: "A client just paid. We welcome them on WhatsApp the same day." },
  { title: "Message received", line: "A client wrote on WhatsApp or by email. We answer in that thread." },
  { title: "Follow-up due", line: "A client's next check-in date arrived. We write with something useful." },
  { title: "Client satisfied", line: "A client wrote something happy. We count it as a result." },
];

function momentsHtml(): string {
  const cards = MOMENTS.map((m, i) => `<li><span class="k">${i + 1}</span><div><h3>${esc(m.title)}</h3><p>${esc(m.line)}</p></div></li>`).join("");
  return `<section class="framed tint" id="moments">
  <div class="wrap csa-moments">
    <div data-motion="reveal">
      <span class="eyebrow">Customer success outsourcing, on time</span>
      <h2 style="margin-top:14px">Four moments, each one answered.</h2>
      <p>Our agents start on what your clients do, so every message lands when it helps. Every client always has a next check-in date.</p>
      <ol class="csa-mom" data-motion="reveal" data-motion-stagger>${cards}</ol>
    </div>
    <div class="csa-score" data-motion="reveal">
      <span class="csa-score-tag"><span class="csa-dot" aria-hidden="true"></span>Client satisfied</span>
      <h3>A happy client is a result, like a sale.</h3>
      <p>Each time a paying client writes something positive, it counts once. You see customer success the way you see sales: as results.</p>
      <blockquote>&ldquo;Big time. The whole team loves it.&rdquo;<small>Example message</small></blockquote>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// We run it on our own clients first
// ---------------------------------------------------------------------------

function ownHtml(): string {
  return `<section class="framed" id="ours">
  <div class="wrap csa-own" data-motion="reveal">
    <div>
      <span class="eyebrow">We use it ourselves</span>
      <h2 style="margin-top:14px">Our own clients hear from us first.</h2>
      <p>Every distribute.you client is followed by the same agents, on WhatsApp. What makes our clients happy reaches yours the same day.</p>
    </div>
    <ul class="csa-own-list">
      <li><b>A welcome the day they start</b><span>With one question: what result do you want first?</span></li>
      <li><b>A heads-up before credit runs out</b><span>So a campaign that works keeps running.</span></li>
      <li><b>Every message answered</b><span>On WhatsApp, in the thread the client already uses.</span></li>
    </ul>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// What customer success outsourcing charges elsewhere, read on each site
// ---------------------------------------------------------------------------

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function verifiedLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function csCostTableHtml(): string {
  const newest = CS_AGENCIES.map((a) => a.verifiedOn).sort().at(-1) ?? "";
  const rows = CS_AGENCIES.map(
    (a) =>
      `<tr><th scope="row"><a href="${csVsPath(a)}">${LOGO(a.domain, 20)}${esc(a.name)}</a></th><td>${esc(a.entryPrice)}</td><td>${a.launch ? esc(a.launch.text) : "Not stated"}</td><td><a href="${csVsPath(a)}">distribute.you vs ${esc(a.name)}</a></td></tr>`,
  ).join("");
  const sources = CS_AGENCIES.map((a) => `<a href="${esc(a.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(a.name)}</a>`).join(", ");
  return `<section class="framed" id="compare">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Customer success agencies compared</span>
      <h2 style="margin-top:14px">Customer success outsourcing, side by side.</h2>
      <p>What each one charges and how fast it starts, read on its own site.</p>
    </div>
    <div class="ag-table-wrap csa-table" data-motion="reveal">
      <table class="ag-table">
        <thead><tr><th scope="col">Provider</th><th scope="col">Price on their site</th><th scope="col">Time to launch</th><th scope="col"></th></tr></thead>
        <tbody>
          <tr class="ours"><th scope="row"><a href="${CS_PAGE_PATH}"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="20" height="20">distribute.you</a></th><td class="us">${esc(OUR_CS_ROW.entryPrice)}</td><td class="us">${esc(OUR_CS_ROW.launch)}</td><td class="us"><a ${BOOK_ATTRS}>Book a call</a></td></tr>
          ${rows}
        </tbody>
      </table>
    </div>
    <p class="ag-src">Read on each site on ${esc(verifiedLabel(newest))}: ${sources}. <a href="${CS_ALTERNATIVES_PATH}">Every customer success agency alternative</a>.</p>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Price, call, FAQ
// ---------------------------------------------------------------------------

export const CS_INCLUDED = [
  "Stripe and your CRM connected for you",
  "A WhatsApp welcome the day each client pays",
  "Every client message answered, on WhatsApp or by email",
  "A next check-in planned for every client",
  "Live in 5 days from our first call",
];

export const CS_FAQ = [
  {
    q: "What does a customer success agency do?",
    a: "A customer success agency talks to your paying clients for you. It welcomes each one, answers their questions and checks on them, so they stay and grow with you. Ours does it on WhatsApp, with our team and our AI agents.",
  },
  {
    q: "How is customer success outsourcing different from support outsourcing?",
    a: "Support waits for a ticket. Customer success writes first: a welcome, a check-in, a useful next step. We write first, and we answer every message too.",
  },
  {
    q: "Which channels do you use?",
    a: "WhatsApp, the app your clients already read every day. When a client writes by email, the answer comes by email, in the same thread.",
  },
  {
    q: "How do you know when a client pays?",
    a: "Stripe tells our agents the moment a client pays. GoHighLevel, Clerk and PostHog plug in too, in a few clicks, and any client can connect them.",
  },
  {
    q: "What counts as a result?",
    a: "A happy message from a paying client. Each one counts once, the way a positive reply counts in sales, so you see what customer success brings you.",
  },
  {
    q: "What does the price cover?",
    a: "Our team starts at $1K a month, plus 10% of the budget your campaigns use. That budget goes to reaching your clients, and you set its hard cap.",
  },
  {
    q: "How fast do we go live?",
    a: "Live in 5 days from our first call. Your newest clients hear from us that same week.",
  },
];

function faqHtml(): string {
  const items = CS_FAQ.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("");
  const links = [
    ...CS_AGENCIES.map((a) => `<a href="${csVsPath(a)}">distribute.you vs ${esc(a.name)}</a>`),
    `<a href="${CS_ALTERNATIVES_PATH}">Customer success agency alternatives</a>`,
  ].join("");
  return `<section class="framed" id="faq">
  <div class="wrap">
    <div class="section-head center"><span class="eyebrow">Questions</span><h2 style="margin-top:14px">Before we meet your clients.</h2></div>
    <div class="ag-faq">${items}</div>
    <nav class="ag-links" aria-label="Compare with other customer success agencies">${links}</nav>
  </div>
</section>`;
}

export const CS_TITLE = "Customer Success Agency: clients welcomed and answered on WhatsApp | distribute.you";
export const CS_DESCRIPTION =
  "Revenue made easy. A customer success agency that welcomes, answers and checks on your paying clients on WhatsApp. Customer success outsourcing from $1K/month + 10% of budget.";

export function renderCustomerSuccessAgencyPage(): string {
  const url = `${SITE}${CS_PAGE_PATH}`;
  return shell({
    title: CS_TITLE,
    description: CS_DESCRIPTION,
    path: CS_PAGE_PATH,
    head: csHead(),
    bodyClass: "ag",
    noCta: true,
    body: [
      heroHtml(),
      storyHtml(),
      momentsHtml(),
      ownHtml(),
      csCostTableHtml(),
      priceHtml("Customer Success Agency", CS_INCLUDED),
      callHtml(),
      faqHtml(),
      CALC_SCRIPT,
    ].join("\n"),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Service",
        name: "distribute.you Customer Success Agency",
        serviceType: "Customer success outsourcing",
        url,
        description: CS_DESCRIPTION,
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
        mainEntity: CS_FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      breadcrumb([
        { name: "distribute.you", path: "/" },
        { name: "Customer Success Agency", path: CS_PAGE_PATH },
      ]),
    ],
  });
}
