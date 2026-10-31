/**
 * `/lead-generation-agency`: the Lead Generation outcome, Agency buyer (PAGE-LEADGEN-AGENCY-1029,
 * owner 2026-10-29). SEO target "lead generation agency" (2,900/month US) and
 * "b2b lead generation agency" (480).
 *
 * Buyer: a company that makes cash and wants qualified leads found and worked for it. Same
 * offer as every Agency page ("From $1K/month + 10% of budget", Book a call), told for THIS
 * outcome: we find the buyers, judge each lead, reach out from our own domains, and hand
 * over the leads who act.
 *
 * Signature motion (refs #10, origami): lead rows drop into a live feed and flash Qualified
 * (green) or Not a fit (red, then dimmed), on the darker Agency slab, followed by a darker
 * sticky story. `data-motion="lead-rows"` in motion.js; the HTML is the final state (every
 * row already judged), reduced motion plays nothing.
 *
 * Every figure is READ at render: the fleet indexes (`/v1/public/indexes`), kept to the
 * outcomes a lead reaches (an engaged lead, a positive reply). A failed read drops the
 * section, never prints a number nobody measured. The rows in the feed are a product
 * preview (roles and company types, no person, no figure).
 *
 * Alias-free: the unit tests render it directly.
 */
import { EXPECTED_LABEL, esc, isExpected, statusLegend, type IndexList, type IndexSummary } from "../fleet-indexes";
import {
  LEADGEN_AGENCIES,
  LEADGEN_ALTERNATIVES_PATH,
  LEADGEN_PAGE_PATH,
  leadgenVsPath,
} from "../lead-generation-agencies";
import { SITE, WHY, breadcrumb, shell } from "../v2-shell";
import { AGENCY_FEE_BASE_USD, BOOK_ATTRS, CALC_SCRIPT, agencyHead, GUARANTEE_FAQ, callHtml, indexCardHtml, priceHtml } from "./gtm-agency";

export const LEADGEN_CSS_VERSION = 1;

/** The Agency stylesheet plus this page's own layer. */
export function leadgenHead(): string {
  return `${agencyHead()}\n<link rel="stylesheet" href="/landing/v2/leadgen.css?v=${LEADGEN_CSS_VERSION}">`;
}

// ---------------------------------------------------------------------------
// Hero: the live lead feed
// ---------------------------------------------------------------------------

export type FeedRow = { role: string; company: string; signal: string; fits: boolean };

/** A product preview: roles and company types, never a person. */
export const FEED_ROWS: readonly FeedRow[] = [
  { role: "Head of Sales", company: "B2B software, 80 people", signal: "Hiring two sales reps", fits: true },
  { role: "Founder", company: "Design studio, 4 people", signal: "Too small for your offer", fits: false },
  { role: "VP Marketing", company: "E-commerce, 240 people", signal: "Launched a new product line", fits: true },
  { role: "Head of Growth", company: "Fintech, 60 people", signal: "Just raised a Series A", fits: true },
  { role: "Office Manager", company: "Law firm, 30 people", signal: "Not a buyer of your offer", fits: false },
  { role: "COO", company: "Logistics, 150 people", signal: "Added a second warehouse", fits: true },
];

function verdict(fits: boolean): string {
  return fits ? `<em class="lg-v yes">Qualified</em>` : `<em class="lg-v no">Not a fit</em>`;
}

export function feedHtml(rows: readonly FeedRow[] = FEED_ROWS): string {
  const items = rows
    .map(
      (r) =>
        `<li class="lg-row is-judged" data-fits="${r.fits ? "yes" : "no"}"><span class="av">${esc(r.role.charAt(0))}</span><div><b>${esc(r.role)}</b><small>${esc(r.company)}</small><span class="sig">${esc(r.signal)}</span></div>${verdict(r.fits)}</li>`,
    )
    .join("");
  return `<div class="lg-feed" aria-hidden="true">
      <div class="lg-feed-h"><span class="live"><i></i>Leads found today</span><span>Judged by our AI agents</span></div>
      <ol class="lg-rows" data-motion="lead-rows">${items}</ol>
      <div class="lg-feed-f">Only qualified leads are contacted for you</div>
    </div>`;
}

function heroHtml(): string {
  return `<section class="ag-hero ag-dark lg-hero">
  <div class="wrap ag-hero-grid">
    <div data-motion="reveal" data-motion-stagger>
      <span class="eyebrow">B2B Lead Generation Agency</span>
      <h1>The lead generation agency that judges every lead.</h1>
      <p class="lead">We find your buyers, keep only the ones who fit, and reach out for you. Your team gets the leads who answer.</p>
      <p class="why">${WHY}</p>
      <div class="ag-ctas">
        <a class="btn btn-accent btn-lg" ${BOOK_ATTRS}>Book a call</a>
        <a class="btn btn-lg btn-ghost-d" href="#how">See how we work</a>
      </div>
      <p class="ag-price-line"><b>From $1K/month + 10% of budget.</b> First leads in 5 days.</p>
    </div>
    ${feedHtml()}
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Sticky story (darker variant)
// ---------------------------------------------------------------------------

export const STORY_STEPS = [
  { title: "We find your buyers", line: "We read your offer, agree on who buys it, and our agents search for them every day." },
  { title: "We judge every lead", line: "An AI judge reads each profile and keeps only the people who fit, with the reason written down." },
  { title: "We reach out for you", line: "Each qualified lead gets an email written for them, sent from our own domains." },
  { title: "You get the leads who act", line: "Replies, visits and booked meetings land in your dashboard, ready for your team." },
];

function storyHtml(): string {
  const steps = STORY_STEPS.map(
    (s, i) => `<li class="ag-step" data-step="${i + 1}"><span class="n">${i + 1}</span><b>${esc(s.title)}</b><span>${esc(s.line)}</span></li>`,
  ).join("");
  return `<section class="ag-story lg-story" id="how" data-motion="sticky-story">
  <div class="wrap ag-story-grid">
    <div>
      <div class="section-head">
        <span class="eyebrow">How we work</span>
        <h2>Leads, not lists.</h2>
        <p>A list is names. A lead is a buyer who fits, reached for you, and counted when they act.</p>
      </div>
      <ol class="ag-steps">${steps}</ol>
    </div>
    <div class="ag-stage lg-stage" aria-hidden="true">
      <div class="ag-scene" data-scene="1">
        <span class="ag-tag">Your buyer, agreed on our first call</span>
        <div class="lg-icp">
          <div><label>Industry</label><span class="chip">B2B software</span><span class="chip">Fintech</span><span class="chip">E-commerce</span></div>
          <div><label>Team size</label><span class="chip">50 to 500 people</span></div>
          <div><label>Roles</label><span class="chip">Head of Sales</span><span class="chip">VP Marketing</span><span class="chip">Founder</span></div>
          <div><label>Region</label><span class="chip">United States</span><span class="chip">Europe</span></div>
        </div>
        <span class="lg-scan"><i></i>Our agents search for them every day</span>
      </div>
      <div class="ag-scene" data-scene="2">
        <span class="ag-tag">Every lead judged, with its reason</span>
        <div class="lg-mini yes"><b>Head of Sales</b><span>Hiring two sales reps. Fits your buyer.</span><em>Qualified</em></div>
        <div class="lg-mini no"><b>Founder, 4 people</b><span>Too small for your offer.</span><em>Not a fit</em></div>
        <div class="lg-mini yes"><b>VP Marketing</b><span>New product line. Fits your buyer.</span><em>Qualified</em></div>
      </div>
      <div class="ag-scene" data-scene="3">
        <span class="ag-tag">Written for one lead</span>
        <div class="ag-mail"><div class="h"><span>From: <b>distribute.you</b></span><span>Subject: <b>Your two new sales reps</b></span></div>
        <p>Hi, I saw you are hiring two sales reps this quarter.</p>
        <p>We could have qualified buyers waiting for them on day one. Worth a short call?</p></div>
      </div>
      <div class="ag-scene" data-scene="4">
        <span class="ag-tag">In your dashboard</span>
        <div class="lg-hand"><span class="dot r"></span><div><b>Head of Sales</b><small>Replied: “Can we talk Thursday?”</small></div><em>Interested</em></div>
        <div class="lg-hand"><span class="dot v"></span><div><b>VP Marketing</b><small>Visited your pricing page</small></div><em>Engaged</em></div>
        <div class="lg-hand"><span class="dot m"></span><div><b>Head of Growth</b><small>Booked a meeting with your team</small></div><em>Meeting</em></div>
      </div>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Live read: delivery of emails sent to a checked address
// ---------------------------------------------------------------------------

/** Delivery of the emails we sent to an address our check called valid, as served. */
export type CheckedDelivery = { deliveryRatePct: number; sent: number; since: string };

/** `/v1/public/channels` `emailDeliveryByVerdict`, read strictly; null on a shape we do not know. */
export function parseCheckedDelivery(body: unknown): CheckedDelivery | null {
  const d = (body as { emailDeliveryByVerdict?: { verificationsSince?: unknown; byVerdictAtSend?: unknown } })?.emailDeliveryByVerdict;
  if (!d || !Array.isArray(d.byVerdictAtSend) || typeof d.verificationsSince !== "string") {
    console.error("[landing] /v1/public/channels: emailDeliveryByVerdict missing or malformed");
    return null;
  }
  const valid = (d.byVerdictAtSend as { verdict?: unknown; sent?: unknown; deliveryRatePct?: unknown }[]).find((r) => r?.verdict === "valid");
  if (!valid || typeof valid.sent !== "number" || typeof valid.deliveryRatePct !== "number" || !(valid.sent > 0)) {
    console.error("[landing] /v1/public/channels: no measured valid verdict row", JSON.stringify(valid ?? null));
    return null;
  }
  const since = d.verificationsSince.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) {
    console.error("[landing] /v1/public/channels: bad verificationsSince", d.verificationsSince);
    return null;
  }
  return { deliveryRatePct: valid.deliveryRatePct, sent: valid.sent, since };
}

function apiBase(): string {
  return (process.env.API_SERVICE_URL || "https://api.distribute.you").replace(/\/$/, "");
}

export async function fetchCheckedDelivery(timeoutMs = 8_000): Promise<CheckedDelivery | null> {
  try {
    const res = await fetch(`${apiBase()}/v1/public/channels`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(timeoutMs),
    } as RequestInit);
    if (res.status !== 200) throw new Error(`status ${res.status}`);
    return parseCheckedDelivery(await res.json());
  } catch (err) {
    console.error("[landing] /v1/public/channels read failed", err);
    return null;
  }
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** The served delivery rate, one line; empty when the read failed. */
export function checkedDeliveryHtml(d: CheckedDelivery | null): string {
  if (!d) return "";
  const [y, m, day] = d.since.split("-").map(Number);
  const rate = `${d.deliveryRatePct.toFixed(1)}%`;
  return `<p class="lg-stat"><b data-motion="count-up">${rate}</b><span>of our emails to a checked address were delivered: ${d.sent.toLocaleString("en-US")} emails since ${MONTH_NAMES[m - 1]} ${day}, ${y}. Read live.</span></p>`;
}

// ---------------------------------------------------------------------------
// What each lead comes with
// ---------------------------------------------------------------------------

export const LEAD_PARTS = [
  { title: "Who they are", line: "Name, role and company, matched to the buyer we agreed on." },
  { title: "Why they fit", line: "The reason our AI judge kept them, written in plain words." },
  { title: "A checked email", line: "We check each address before we write, so emails reach real inboxes." },
  { title: "What they did", line: "Every reply, visit and meeting, counted on the lead itself." },
];

function anatomyHtml(delivery: CheckedDelivery | null): string {
  const parts = LEAD_PARTS.map(
    (p, i) => `<li><span class="k">${i + 1}</span><div><h3>${esc(p.title)}</h3><p>${esc(p.line)}</p></div></li>`,
  ).join("");
  return `<section class="framed" id="lead">
  <div class="wrap lg-anatomy">
    <div data-motion="reveal">
      <span class="eyebrow">Every lead</span>
      <h2>Each lead comes with its reason.</h2>
      <p>You see why we picked them, what we sent them and what they did. Your team calls the ones who are ready.</p>
      <ol class="lg-parts" data-motion="reveal" data-motion-stagger>${parts}</ol>
      ${checkedDeliveryHtml(delivery)}
    </div>
    <div class="lg-card" data-motion="reveal" aria-hidden="true">
      <div class="lg-card-h"><span class="av">H</span><div><b>Head of Sales</b><small>B2B software, 80 people</small></div><em class="lg-v yes">Qualified</em></div>
      <dl>
        <div><dt>Why they fit</dt><dd>Hiring two sales reps this quarter. Sells to companies like your best clients.</dd></div>
        <div><dt>Email</dt><dd>Checked before sending</dd></div>
        <div><dt>Sent</dt><dd>“Your two new sales reps”, from our own domains</dd></div>
      </dl>
      <ol class="lg-trail"><li>Emailed</li><li>Visited your site</li><li class="hot">Replied: interested</li></ol>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Proof: the live indexes a lead reaches
// ---------------------------------------------------------------------------

/** The outcomes a lead reaches, in the order the page tells them. */
export const LEAD_OUTCOMES = ["engaged_lead", "positive_reply"] as const;

/** The served indexes a lead's outcome names, engaged leads first; read by outcome, never by slug. */
export function leadIndexes(list: IndexList | null): IndexSummary[] {
  if (!list) return [];
  return LEAD_OUTCOMES.flatMap((o) => list.indexes.filter((i) => i.outcome === o));
}

export function leadProofHtml(list: IndexList | null): string {
  const rows = leadIndexes(list);
  if (!list || !rows.length) return "";
  const n = rows.length;
  const cards = rows.map((i, k) => indexCardHtml(i, n === 1 ? 0 : k / n)).join("");
  return `<section class="ag-dark ag-proof" id="data" data-motion="scrub">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Our data, live</span>
      <h2>What a lead who acts costs, read live.</h2>
      <p>An engaged lead replied with interest, or visited the client&apos;s website from our email. Read from every campaign we run, recorded every day.</p>
    </div>
    <ul class="ag-proof-list">${cards}</ul>
    <p class="ag-legend">${esc(statusLegend(list.statusRule))}${rows.some(isExpected) ? ` ${esc(EXPECTED_LABEL)} marks a figure we expect while too few leads have acted to measure it.` : ""} <a href="/indexes">See every index</a></p>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// First leads in 5 days
// ---------------------------------------------------------------------------

const DAYS = [
  { title: "One call", line: "You tell us who buys from you and your monthly budget." },
  { title: "Buyer mapped", line: "We read your site and offer, and agree on your buyer." },
  { title: "First leads judged", line: "Our agents find your first leads and keep the ones who fit." },
  { title: "First emails sent", line: "Each qualified lead gets an email from our own domains." },
  { title: "Leads in your dashboard", line: "Replies and visits come in, each on its lead." },
];

function daysHtml(): string {
  const days = DAYS.map(
    (d, i) => `<li class="ag-day"><span class="dot">${i + 1}</span><h3>Day ${i + 1}: ${esc(d.title)}</h3><p>${esc(d.line)}</p></li>`,
  ).join("");
  return `<section class="framed tint">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">First leads in 5 days</span>
      <h2>From our first call to your first leads.</h2>
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

export const LEADGEN_INCLUDED = [
  "Your buyers found by our AI agents every day",
  "Every lead judged, with the reason it fits",
  "Emails checked, written and sent from our own domains",
  "Every reply, visit and meeting in your dashboard",
  "First leads in 5 days from our first call",
];

export const LEADGEN_FAQ = [
  {
    q: "What counts as a qualified lead?",
    a: "A person who matches the buyer we agree on together. Our AI judge reads each profile, keeps the ones who fit and writes down why.",
  },
  {
    q: "Do I get a list or real conversations?",
    a: "Real conversations. Every qualified lead is contacted for you, and the ones who reply, visit or book reach your team with their history.",
  },
  {
    q: "What does the price cover?",
    a: "From $1K a month for our team, plus 10% of the budget you put into your campaigns. Your budget goes to finding and contacting your leads.",
  },
  GUARANTEE_FAQ,
  {
    q: "Whose domains send the emails?",
    a: "Ours. Every email leaves from domains and inboxes we own and warm, so there is nothing to set up on your side.",
  },
  {
    q: "How fast do the first leads arrive?",
    a: "First leads in 5 days from our first call.",
  },
  {
    q: "Can my team see every lead?",
    a: "Yes. Your dashboard shows every lead, the reason it fits, what we sent and what they did.",
  },
];

function faqHtml(): string {
  const items = LEADGEN_FAQ.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("");
  const links = [
    ...LEADGEN_AGENCIES.map((a) => `<a href="${leadgenVsPath(a)}">distribute.you vs ${esc(a.name)}</a>`),
    `<a href="${LEADGEN_ALTERNATIVES_PATH}">Lead generation agency alternatives</a>`,
  ].join("");
  return `<section class="framed" id="faq">
  <div class="wrap">
    <div class="section-head center"><span class="eyebrow">Questions</span><h2>Good to know before the call.</h2></div>
    <div class="ag-faq">${items}</div>
    <nav class="ag-links" aria-label="Compare with other lead generation agencies">${links}</nav>
  </div>
</section>`;
}

const DESCRIPTION =
  "Revenue made easy. A B2B lead generation agency that finds your buyers, judges every lead and reaches out for you. From $1K/month + 10% of budget. Book a call.";

export function renderLeadGenerationAgencyPage(list: IndexList | null, delivery: CheckedDelivery | null): string {
  const url = `${SITE}${LEADGEN_PAGE_PATH}`;
  return shell({
    title: "Lead Generation Agency: qualified B2B leads, found and contacted for you | distribute.you",
    description: DESCRIPTION,
    path: LEADGEN_PAGE_PATH,
    head: leadgenHead(),
    bodyClass: "ag",
    noCta: true,
    body: [
      heroHtml(),
      storyHtml(),
      anatomyHtml(delivery),
      leadProofHtml(list),
      daysHtml(),
      priceHtml("Lead Generation Agency", LEADGEN_INCLUDED, true),
      callHtml(),
      faqHtml(),
      CALC_SCRIPT,
    ].join("\n"),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "Service",
        name: "distribute.you Lead Generation Agency",
        serviceType: "B2B lead generation",
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
        mainEntity: LEADGEN_FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      breadcrumb([
        { name: "distribute.you", path: "/" },
        { name: "Lead Generation Agency", path: LEADGEN_PAGE_PATH },
      ]),
    ],
  });
}
