/**
 * `/cold-email-agency`: the Sales Cold Email outcome, Agency buyer (PAGE-COLD-EMAIL-AGENCY-1030,
 * owner 2026-10-29). SEO target "cold email agency" (880/month US, low difficulty).
 *
 * Cold email is our historical core business. Buyer: a company that makes cash and wants its
 * cold email run for it. Same offer as every Agency page ("From $1K/month + 10% of budget",
 * Book a call), told for THIS outcome: we find the buyers, write each email, send it from OUR
 * domains and inboxes, and answer every reply until the meeting is booked.
 *
 * Signature motion (refs #7, the default.com workflow demo): a workflow card where the buyer is
 * found, researched, the email is TYPED, the Send button is pressed and the step COLLAPSES, then
 * the reply is answered; three buyers in a loop. `data-motion="mail-flow"` in motion.js; the
 * HTML is the final state (every step done, the email written and sent), reduced motion plays
 * nothing. Darker sticky story below it, as on every Agency page.
 *
 * Every figure is READ at render: the emails our sending inboxes sent and their delivery
 * (`/v1/public/channels` `emailDelivery`), the cold email indexes (`/v1/public/indexes`), and the
 * client proof cards, reseeded by `staticResponse`'s showcase pass from the same read as the
 * homepage (`data-proof-brand`). A failed read drops its section or line, never prints a number
 * nobody measured. The buyers in the workflow card are a product preview (roles, no person).
 *
 * Alias-free: the unit tests render it directly.
 */
import { EXPECTED_LABEL, esc, isExpected, statusLegend, type IndexList, type IndexSummary } from "../fleet-indexes";
import {
  COLD_EMAIL_AGENCIES,
  COLD_EMAIL_ALTERNATIVES_PATH,
  COLD_EMAIL_PAGE_PATH,
  coldEmailBestLinks,
  coldEmailVsPath,
} from "../cold-email-agencies";
import { SITE, WHY, breadcrumb, shell } from "../v2-shell";
import { AGENCY_FEE_BASE_USD, BOOK_ATTRS, CALC_SCRIPT, agencyHead, GUARANTEE_FAQ, callHtml, indexCardHtml, priceHtml } from "./gtm-agency";

export const COLD_EMAIL_CSS_VERSION = 1;

/** The Agency stylesheet plus this page's own layer. */
export function coldEmailHead(): string {
  return `${agencyHead()}\n<link rel="stylesheet" href="/landing/v2/cold-email.css?v=${COLD_EMAIL_CSS_VERSION}">`;
}

// ---------------------------------------------------------------------------
// Hero: the workflow that writes and sends
// ---------------------------------------------------------------------------

export type FlowLead = {
  role: string;
  company: string;
  signal: string;
  subject: string;
  body: string;
  reply: string;
  /** Our answer, the one that books the meeting. */
  answer: string;
};

/**
 * A product preview: roles and company types, never a person. The first one is the HTML's final
 * state: found, researched, its email sent (the step collapsed to one line), the reply answered.
 */
export const FLOW_LEADS: readonly FlowLead[] = [
  {
    role: "Head of Sales",
    company: "B2B software, 80 people",
    signal: "Hiring two sales reps this quarter",
    subject: "Your two new sales reps",
    body: "Hi, I saw you are hiring two sales reps this quarter. We could have meetings waiting for them on day one. Worth a short call?",
    reply: "Sounds good. Can we talk Thursday?",
    answer: "Thursday at 10am works. The invite is on its way.",
  },
  {
    role: "VP Marketing",
    company: "E-commerce, 240 people",
    signal: "Launched a new product line",
    subject: "Your new product line",
    body: "Hi, congrats on the new product line. We put launches like yours in front of the buyers most likely to order. Open to a quick chat next week?",
    reply: "Yes, send me a time next week.",
    answer: "Monday at 2pm works. The invite is on its way.",
  },
  {
    role: "Founder",
    company: "Fintech, 40 people",
    signal: "Just raised a Series A",
    subject: "After your Series A",
    body: "Hi, congrats on the Series A. A fuller pipeline usually comes next. Can I show you how we would build it, in 15 minutes?",
    reply: "Interested. How does Tuesday look?",
    answer: "Tuesday at 11am works. The invite is on its way.",
  },
];

const ICON = {
  find: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
  read: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5.5h9M4 10h16M4 14.5h16M4 19h11"/></svg>',
  write: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6.5l8.5 6 8.5-6"/><rect x="3.5" y="5" width="17" height="14" rx="2.5"/></svg>',
  reply: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 8L4.5 12.5l5 4.5"/><path d="M4.5 12.5H14a6 6 0 0 1 6 6"/></svg>',
  done: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
};

/** One step of the workflow; `active`/`done` are the words its state pill shows. */
function node(key: string, icon: string, title: string, active: string, done: string, inner: string): string {
  return `<li class="ce-node" data-node="${key}" data-status="done">
          <div class="ce-node-h"><span class="ce-ic">${icon}</span><b>${esc(title)}</b><span class="ce-st"><span class="a"><i class="spin"></i>${esc(active)}</span><span class="d">${ICON.done}${esc(done)}</span></span></div>
          ${inner}
        </li>`;
}

export function flowHtml(leads: readonly FlowLead[] = FLOW_LEADS): string {
  const l = leads[0];
  const nodes = [
    node("found", ICON.find, "Buyer found", "Searching", "Found", `<p class="ce-sub"><span data-field="role">${esc(l.role)}</span>, <span data-field="company">${esc(l.company)}</span></p>`),
    node("research", ICON.read, "Research", "Reading", "Done", `<p class="ce-sub" data-field="signal">${esc(l.signal)}</p>`),
    node(
      "write",
      ICON.write,
      "Write and send",
      "Writing",
      "Sent",
      `<p class="ce-sub ce-sent-line">Sent from our own domains</p>
          <div class="ce-body"><div class="ce-draft">
            <div class="ce-draft-h"><span>From <b>distribute.you</b></span><span>To <b data-field="role">${esc(l.role)}</b></span><span>Subject <b data-field="subject">${esc(l.subject)}</b></span></div>
            <p class="ce-type" data-type>${esc(l.body)}</p>
            <div class="ce-draft-f"><span>Written for one buyer</span><span class="ce-send" data-send>Send</span></div>
          </div></div>`,
    ),
    node(
      "reply",
      ICON.reply,
      "Reply answered",
      "Waiting",
      "Booked",
      `<div class="ce-thread"><p class="ce-msg them" data-field="reply">${esc(l.reply)}</p><p class="ce-msg us" data-field="answer">${esc(l.answer)}</p><span class="ce-booked">Meeting booked in your calendar</span></div>`,
    ),
  ].join("\n        ");
  return `<div class="ce-flow" data-motion="mail-flow" aria-hidden="true">
      <div class="ce-flow-h"><span class="live"><i></i>Cold email workflow</span><span>Running for you</span></div>
      <ol class="ce-nodes">
        ${nodes}
      </ol>
      <svg class="ce-cursor" data-cursor viewBox="0 0 24 24" width="22" height="22"><path d="M5 3l14 8-6.2 1.6L10 19z" fill="#fff" stroke="#05070d" stroke-width="1.4" stroke-linejoin="round"/></svg>
      <script type="application/json" data-leads>${JSON.stringify(leads).replace(/</g, "\\u003c")}</script>
    </div>`;
}

function heroHtml(): string {
  return `<section class="ag-hero ag-dark ce-hero">
  <div class="wrap ag-hero-grid">
    <div data-motion="reveal" data-motion-stagger>
      <span class="eyebrow">Cold Email Agency</span>
      <h1>The cold email agency that books your meetings.</h1>
      <p class="lead">We find your buyers, write each email for one person, send it from our own domains and answer every reply. Your team takes the meetings.</p>
      <p class="why">${WHY}</p>
      <div class="ag-ctas">
        <a class="btn btn-accent btn-lg" ${BOOK_ATTRS}>Book a call</a>
        <a class="btn btn-lg btn-ghost-d" href="#how">See how we work</a>
      </div>
      <p class="ag-price-line"><b>From $1K/month + 10% of budget.</b> Live in 5 days.</p>
    </div>
    ${flowHtml()}
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Sticky story (darker variant)
// ---------------------------------------------------------------------------

export const STORY_STEPS = [
  { title: "We find your buyers", line: "We agree on who buys from you. Our agents find those people every day, with a checked email address." },
  { title: "We write each email", line: "Every email is written for one buyer, from what they and their company are doing right now." },
  { title: "We send from our domains", line: "Our own domains and warmed inboxes do the sending. Your domain keeps your everyday emails." },
  { title: "We answer every reply", line: "Interested buyers get an answer fast, until the meeting is in your calendar." },
];

function storyHtml(): string {
  const steps = STORY_STEPS.map(
    (s, i) => `<li class="ag-step" data-step="${i + 1}"><span class="n">${i + 1}</span><b>${esc(s.title)}</b><span>${esc(s.line)}</span></li>`,
  ).join("");
  const inboxes = ["Warmed inbox", "Warmed inbox", "Warmed inbox", "Warmed inbox", "Warmed inbox", "Warmed inbox"]
    .map((t) => `<span class="ce-inbox"><i></i>${t}</span>`)
    .join("");
  return `<section class="ag-story ce-story" id="how" data-motion="sticky-story">
  <div class="wrap ag-story-grid">
    <div>
      <div class="section-head">
        <span class="eyebrow">How we work</span>
        <h2>Every email written for one buyer.</h2>
        <p>Cold email works when it reads like a note from a person. We write it that way, at the scale of a team.</p>
      </div>
      <ol class="ag-steps">${steps}</ol>
    </div>
    <div class="ag-stage ce-stage" aria-hidden="true">
      <div class="ag-scene" data-scene="1">
        <span class="ag-tag">Buyers found today</span>
        <div class="ag-row"><span class="av"></span><div>Head of Sales<small>B2B software, 80 people</small></div><em>Fits</em></div>
        <div class="ag-row"><span class="av"></span><div>VP Marketing<small>E-commerce, 240 people</small></div><em>Fits</em></div>
        <div class="ag-row"><span class="av"></span><div>Founder<small>Fintech, 40 people</small></div><em>Fits</em></div>
      </div>
      <div class="ag-scene" data-scene="2">
        <span class="ag-tag">Written for one buyer</span>
        <div class="ag-mail"><div class="h"><span>From: <b>distribute.you</b></span><span>Subject: <b>After your Series A</b></span></div>
        <p>Hi, congrats on the <mark>Series A</mark>.</p>
        <p>A fuller pipeline usually comes next. Can I show you how we would build it, in 15 minutes?</p></div>
      </div>
      <div class="ag-scene" data-scene="3">
        <span class="ag-tag">Sent from our own domains</span>
        <div class="ce-inboxes">${inboxes}</div>
        <div class="ce-yours"><b>Your domain</b><span>Keeps sending your invoices and onboarding emails, as always</span></div>
      </div>
      <div class="ag-scene" data-scene="4">
        <span class="ag-tag">Reply answered</span>
        <div class="ag-bubble them">Interested. How does Tuesday look?</div>
        <div class="ag-bubble us">Tuesday at 11am works. The invite is on its way.</div>
        <span class="ag-booked">Meeting booked in your calendar</span>
      </div>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Our sending, with the live count of what our inboxes sent
// ---------------------------------------------------------------------------

/** Every email our sending inboxes sent and how many were delivered, as served. */
export type SendingVolume = { sent: number; deliveryRatePct: number };

/** `/v1/public/channels` `emailDelivery`, read strictly; null on a shape we do not know. */
export function parseSendingVolume(body: unknown): SendingVolume | null {
  const d = (body as { emailDelivery?: { sentEmails?: unknown; deliveryRatePct?: unknown; basis?: unknown; unavailableReason?: unknown } })?.emailDelivery;
  if (!d || typeof d !== "object") {
    console.error("[landing] /v1/public/channels: emailDelivery missing");
    return null;
  }
  if (d.unavailableReason) {
    console.error("[landing] /v1/public/channels: emailDelivery unavailable", d.unavailableReason);
    return null;
  }
  // The sentence says "every email our inboxes sent": only that basis may fill it.
  if (d.basis !== "every_email_our_sending_inboxes_sent" || typeof d.sentEmails !== "number" || !(d.sentEmails > 0) || typeof d.deliveryRatePct !== "number") {
    console.error("[landing] /v1/public/channels: emailDelivery malformed", JSON.stringify(d));
    return null;
  }
  return { sent: d.sentEmails, deliveryRatePct: d.deliveryRatePct };
}

function apiBase(): string {
  return (process.env.API_SERVICE_URL || "https://api.distribute.you").replace(/\/$/, "");
}

export async function fetchSendingVolume(timeoutMs = 8_000): Promise<SendingVolume | null> {
  try {
    const res = await fetch(`${apiBase()}/v1/public/channels`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(timeoutMs),
    } as RequestInit);
    if (res.status !== 200) throw new Error(`status ${res.status}`);
    return parseSendingVolume(await res.json());
  } catch (err) {
    console.error("[landing] /v1/public/channels read failed", err);
    return null;
  }
}

/** The served count and delivery, two figures in one band; empty when the read failed. */
export function sendingStatsHtml(v: SendingVolume | null): string {
  if (!v) return "";
  return `<div class="ce-stats">
        <div><b data-motion="count-up">${v.sent.toLocaleString("en-US")}</b><span>emails sent from our own inboxes for our clients</span></div>
        <div><b data-motion="count-up">${v.deliveryRatePct.toFixed(1)}%</b><span>of them delivered</span></div>
      </div>
      <p class="ce-stats-note">Every email our sending inboxes have sent. Read live.</p>`;
}

export const SENDING_POINTS = [
  { title: "Our domains, our inboxes", line: "We buy, warm and watch every sending domain and inbox. Nothing to set up on your side." },
  { title: "Your domain stays yours", line: "Your own domain keeps sending your invoices, onboarding and team emails, as before." },
  { title: "Replies land with us first", line: "We read and answer every reply, so a warm buyer never waits." },
  { title: "Everything on your dashboard", line: "Every email we sent, every reply and every meeting, visible to your team." },
];

function sendingHtml(v: SendingVolume | null): string {
  const points = SENDING_POINTS.map(
    (p, i) => `<li><span class="k">${i + 1}</span><div><h3>${esc(p.title)}</h3><p>${esc(p.line)}</p></div></li>`,
  ).join("");
  return `<section class="framed" id="sending">
  <div class="wrap ce-sending">
    <div data-motion="reveal">
      <span class="eyebrow">Our sending</span>
      <h2>We send from our own domains.</h2>
      <p>Your brand reaches buyers through sending we run every day for all our clients.</p>
      <ol class="ce-points" data-motion="reveal" data-motion-stagger>${points}</ol>
    </div>
    <div class="ce-split" data-motion="reveal" aria-hidden="true">
      <div class="ce-lane us">
        <span class="lbl">Our sending domains</span>
        <div class="ce-lane-rows"><span><i></i>Cold email to your buyers</span><span><i></i>Follow ups</span><span><i></i>Replies, answered</span></div>
      </div>
      <div class="ce-lane you">
        <span class="lbl">Your domain</span>
        <div class="ce-lane-rows"><span><i></i>Invoices</span><span><i></i>Onboarding</span><span><i></i>Your team’s emails</span></div>
      </div>
      ${sendingStatsHtml(v)}
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Client proof: the homepage's proof cards, reseeded live per client
// ---------------------------------------------------------------------------

/**
 * Seed cards, keyed for the reseed the day they ship (apps/landing/CLAUDE.md "A client figure
 * ... must be keyed"): `staticResponse`'s showcase pass replaces them with features-service's
 * highest-return pick, from the same read as the homepage, so the two pages state one figure.
 */
function proofHtml(): string {
  return `<section class="framed tint" id="proof">
  <div class="wrap">
    <div class="section-head center rv">
      <span class="eyebrow">Client results</span>
      <h2>What our clients got back from cold email.</h2>
      <p>Live figures from their own dashboards, counting only what our outreach brought in.</p>
    </div>
    <div class="proof-grid">
      <article class="proof-card rv" data-proof-brand="docdinners.com">
        <div class="proof-top"><img class="face" src="/landing/v2/assets/ryan-parenti.jpg" alt=""><div><div class="name">Ryan W.D. Parenti</div><div class="meta">Founder, Doc Dinners</div></div></div>
        <div class="proof-roi"><span class="big" data-count="1.9" data-decimals="1">0<small>x</small></span><span class="lbl">return on<br>paid budget</span></div>
        <div class="proof-line" data-proof-cost-step="conversation"><span>Cost per positive reply</span><b>$438</b></div>
        <div class="proof-funnel"><span data-proof-step="contacted"><b>18,596</b>contacted</span><span data-proof-step="conversation"><b>30</b>positive replies</span><span data-proof-step="meeting_booked"><b>7</b>meetings booked</span></div>
        <div class="proof-line"><span>Channel</span><b>Cold email</b></div>
      </article>
      <article class="proof-card rv" data-proof-brand="shockwavecenters.com">
        <div class="proof-top"><img class="face" src="/landing/v2/assets/david-tucker.jpg" alt=""><div><div class="name">David Tucker</div><div class="meta">Cofounder, Shockwave Centers</div></div></div>
        <div class="proof-roi"><span class="big" data-count="2.2" data-decimals="1">0<small>x</small></span><span class="lbl">return on<br>paid budget</span></div>
        <div class="proof-line" data-proof-cost-step="conversation"><span>Cost per positive reply</span><b>$68</b></div>
        <div class="proof-funnel"><span data-proof-step="contacted"><b>5,985</b>contacted</span><span data-proof-step="conversation"><b>8</b>positive replies</span></div>
        <div class="proof-line"><span>Channel</span><b>Cold email</b></div>
      </article>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Our data: the cold email indexes, read live
// ---------------------------------------------------------------------------

/** The cold email channel, as the indexes name it. */
export const COLD_EMAIL_CHANNEL = "sales-cold-email-outreach";
/** What cold email brings, in the order the page tells it. */
export const COLD_EMAIL_OUTCOMES = ["positive_reply", "meeting_booked", "engaged_lead", "revenue"] as const;

/**
 * The served cold email indexes a buyer pays for, replies first: read by channel and outcome,
 * never by slug; the rate twins (`conversion_rate`) are left to `/indexes`.
 */
export function coldEmailIndexes(list: IndexList | null): IndexSummary[] {
  if (!list) return [];
  return COLD_EMAIL_OUTCOMES.flatMap((o) =>
    list.indexes.filter((i) => i.channelSlug === COLD_EMAIL_CHANNEL && i.outcome === o && i.metric !== "conversion_rate"),
  );
}

export function coldEmailProofHtml(list: IndexList | null): string {
  const rows = coldEmailIndexes(list);
  if (!list || rows.length < 2) return "";
  const n = rows.length;
  const cards = rows.map((i, k) => indexCardHtml(i, k / n)).join("");
  return `<section class="ag-dark ag-proof" id="data" data-motion="scrub">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Our data, live</span>
      <h2>What cold email brings, measured every day.</h2>
      <p>Replies, meetings and returns from every cold email campaign we run. Your campaign starts on the workflow that leads today.</p>
    </div>
    <ul class="ag-proof-list">${cards}</ul>
    <p class="ag-legend">${esc(statusLegend(list.statusRule))}${rows.some(isExpected) ? ` ${esc(EXPECTED_LABEL)} marks a figure we expect while too few buyers have acted to measure it.` : ""} <a href="/indexes">See every index</a></p>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Live in 5 days
// ---------------------------------------------------------------------------

const DAYS = [
  { title: "One call", line: "You tell us what you sell, who buys it and your monthly budget." },
  { title: "Your emails, written", line: "We read your offer and write your first emails." },
  { title: "Your buyers, found", line: "Our agents find the first buyers who fit, with checked addresses." },
  { title: "First sends", line: "Your first emails go out from our own domains." },
  { title: "Replies answered", line: "Replies reach your dashboard, and we answer each one." },
];

function daysHtml(): string {
  const days = DAYS.map(
    (d, i) => `<li class="ag-day"><span class="dot">${i + 1}</span><h3>Day ${i + 1}: ${esc(d.title)}</h3><p>${esc(d.line)}</p></li>`,
  ).join("");
  return `<section class="framed">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Live in 5 days</span>
      <h2>From our first call to your first replies.</h2>
      <p>We bring the domains, the inboxes and the agents. You bring your offer.</p>
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

export const COLD_EMAIL_INCLUDED = [
  "Your buyers found by our AI agents every day",
  "Every email written for one buyer",
  "Sent from our own warmed domains and inboxes",
  "Every reply answered until the meeting is booked",
  "Live in 5 days from our first call",
];

export const COLD_EMAIL_FAQ = [
  {
    q: "What does a cold email agency do for me?",
    a: "We find your buyers, write an email for each one, send it from our own domains and answer every reply until a meeting is booked. Your team takes the meetings.",
  },
  {
    q: "Whose domains and inboxes send the emails?",
    a: "Ours. We buy, warm and watch every sending domain and inbox, so your own domain keeps sending your everyday emails as always.",
  },
  {
    q: "Are the emails written one by one?",
    a: "Yes. Each email is written for one buyer, from what they and their company are doing right now.",
  },
  {
    q: "Who answers the replies?",
    a: "Our AI agents and our team answer each reply fast, until the meeting is in your calendar. You see every reply on your dashboard, the refusals too.",
  },
  {
    q: "What does the price cover?",
    a: "From $1K a month for our team, plus 10% of the budget you put into your campaigns. The budget pays for finding your buyers and sending to them.",
  },
  GUARANTEE_FAQ,
  {
    q: "How fast do the first emails go out?",
    a: "Live in 5 days from our first call.",
  },
];

function faqHtml(): string {
  const items = COLD_EMAIL_FAQ.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("");
  const links = [
    ...COLD_EMAIL_AGENCIES.map((a) => `<a href="${coldEmailVsPath(a)}">distribute.you vs ${esc(a.name)}</a>`),
    `<a href="${COLD_EMAIL_ALTERNATIVES_PATH}">Cold email agency alternatives</a>`,
    ...coldEmailBestLinks().map((l) => `<a href="${l.href}">${esc(l.label)}</a>`),
  ].join("");
  return `<section class="framed" id="faq">
  <div class="wrap">
    <div class="section-head center"><span class="eyebrow">Questions</span><h2>What clients ask us about cold email.</h2></div>
    <div class="ag-faq">${items}</div>
    <nav class="ag-links" aria-label="Compare with other cold email agencies">${links}</nav>
  </div>
</section>`;
}

const DESCRIPTION =
  "Revenue made easy. A cold email agency that finds your buyers, writes each email, sends from our own domains and answers every reply. From $1K/month + 10% of budget. Book a call.";

export function renderColdEmailAgencyPage(list: IndexList | null, sending: SendingVolume | null): string {
  const url = `${SITE}${COLD_EMAIL_PAGE_PATH}`;
  return shell({
    title: "Cold Email Agency: emails written, sent and answered for you | distribute.you",
    description: DESCRIPTION,
    path: COLD_EMAIL_PAGE_PATH,
    head: coldEmailHead(),
    bodyClass: "ag",
    noCta: true,
    body: [
      heroHtml(),
      storyHtml(),
      sendingHtml(sending),
      proofHtml(),
      coldEmailProofHtml(list),
      daysHtml(),
      priceHtml("Cold Email Agency", COLD_EMAIL_INCLUDED, true),
      callHtml(),
      faqHtml(),
      CALC_SCRIPT,
    ].join("\n"),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Service",
        name: "distribute.you Cold Email Agency",
        serviceType: "Cold email outreach",
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
        mainEntity: COLD_EMAIL_FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      breadcrumb([
        { name: "distribute.you", path: "/" },
        { name: "Cold Email Agency", path: COLD_EMAIL_PAGE_PATH },
      ]),
    ],
  });
}
