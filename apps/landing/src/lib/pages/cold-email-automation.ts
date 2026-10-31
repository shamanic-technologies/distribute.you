/**
 * `/cold-email-automation`: the Sales Cold Email AI Agent page (PAGE-COLD-EMAIL-AUTOMATION-1030,
 * owner 2026-10-29).
 *
 * Buyer: the cheap SaaS founder (root CLAUDE.md POSITIONING). Search keyword: "cold email
 * automation" (50 to 110 US searches a month), with "ai cold email" (50 to 70). Its Agency
 * twin is `/cold-email-agency` (company making cash, Book a call); this page sells the same
 * outcome to the founder who runs it from a website, at the API price, starting free. What
 * it says that no sibling says: every cold email is written for one buyer, sent from
 * domains we own (the mailbox, DNS and warmup work a cold email tool leaves to you), and
 * each step, down to the send itself, has a public price you see before it runs.
 *
 * Every figure is READ at render, never typed here:
 * - `__HOT_LEAD_ROW__` / `__HOT_LEAD_BAND__`: the fleet's engaged leads and costs
 *   (static-html.ts `withHotLeadStats`, the reads the homepage hero states);
 * - the client cards (`data-brand`) and proof cards (`data-proof-brand`): features-service's
 *   pick and counts (`withShowcaseOutcomes`);
 * - `<!--flow-price:*-->`, `<!--send-tiers-->` and `<!--action-prices-->`: the live price
 *   of each step of a cold email and of each send tier, from the public cost catalogue;
 * - the competitor rows: `competitors.ts`, each figure read on their own site and dated.
 *
 * Signature motion (refs #7, the `default` clone): a workflow card that finds the buyer,
 * reads their site, types the email, presses Send, collapses the step and answers the
 * reply (motion.js `mail-flow`, the Cold Email Agency page's effect), here on a LIGHT card
 * with the live price of each step on its node. Styles:
 * `public/landing/v2/cold-email-automation.css`, after agent.css and ai-sdr.css.
 *
 * Alias-free: the unit tests render it directly.
 */
import {
  COLD_EMAIL_AUTOMATION_ALTERNATIVES_PATH,
  COLD_EMAIL_AUTOMATION_PATH,
  coldEmailAutomationCompetitors,
  competitorLogo,
  competitorPath,
} from "../competitors";
import { SITE_PAGES } from "../site-pages";
import { SITE, SIGN_UP, WHY, breadcrumb, esc, shell } from "../v2-shell";
import { catalogSections, type PlatformPrice } from "./catalog";
import { actionPrices } from "./home-agent";
import { AGENT_CSS_VERSION, AI_SDR_CSS_VERSION, proofHtml, quotesHtml } from "./ai-sdr";

export const COLD_EMAIL_AUTOMATION_CSS_VERSION = 1;

const LOGO = (domain: string, size = 28) =>
  `<img src="https://img.logo.dev/${domain}?token=pk_J1iY4__HSfm9acHjR8FibA&size=64&format=png" alt="" width="${size}" height="${size}">`;

const ARROW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';

function head(): string {
  return `<link rel="stylesheet" href="/landing/v2/agent.css?v=${AGENT_CSS_VERSION}">
<link rel="stylesheet" href="/landing/v2/ai-sdr.css?v=${AI_SDR_CSS_VERSION}">
<link rel="stylesheet" href="/landing/v2/cold-email-automation.css?v=${COLD_EMAIL_AUTOMATION_CSS_VERSION}">`;
}

/** The Agency twin, linked only once its catalogue entry is live (it ships in its own PR). */
function agencyTwin(): string | null {
  return SITE_PAGES.find((p) => p.outcome === "cold-email" && p.buyer === "agency" && p.live)?.path ?? null;
}

// ---------------------------------------------------------------------------
// Live prices: one per step of the workflow, and the send tiers
// ---------------------------------------------------------------------------

/** The steps of the hero workflow that carry a price, keyed on the catalogue group they spend in. */
export type FlowPriceKey = "leads" | "research" | "ai" | "sending";

/** Where a step's price goes in the hero card; resolved by `withColdEmailPrices`. */
export const flowPriceToken = (k: FlowPriceKey) => `<!--flow-price:${k}-->`;

/** Where the send tiers go in the sending section. */
export const SEND_TIERS_TOKEN = "<!--send-tiers-->";

/**
 * The cheapest served line of each step, read through the homepage's `actionPrices` (the
 * same `catalogSections` the catalog draws, so a line the catalog hides never shows here).
 * Stated "from": a step's real cost is the client's own campaign, shown on their dashboard.
 */
export function flowPrices(prices: PlatformPrice[] | null): Partial<Record<FlowPriceKey, string>> {
  const out: Partial<Record<FlowPriceKey, string>> = {};
  for (const a of prices ? actionPrices(prices) : []) {
    if (a.group === "leads" || a.group === "research" || a.group === "ai" || a.group === "sending") out[a.group] = a.price;
  }
  return out;
}

export type SendTier = { what: string; price: string };

/**
 * Every served line of the sending section: one price per BounceVerify verdict on the
 * recipient (valid, catch-all, unknown), cheapest first. The catalog's own note says the
 * rest: an address marked invalid or risky is never sent.
 */
export function sendTiers(prices: PlatformPrice[] | null): SendTier[] {
  if (!prices) return [];
  const rows = catalogSections(prices).find((s) => s.key === "sending")?.rows ?? [];
  return rows.filter((r) => Number.isFinite(r.usd)).map((r) => ({ what: r.what, price: r.price }));
}

function sendTiersHtml(prices: PlatformPrice[] | null): string {
  const tiers = sendTiers(prices);
  if (!tiers.length) {
    return `<div class="cx-tiers"><p class="cx-tiers-foot">The price of each email sent is live on our <a href="/catalog">catalog</a>.</p></div>`;
  }
  const items = tiers.map((t) => `<li><span>${esc(t.what)}</span><b>${esc(t.price)}</b></li>`).join("");
  return `<div class="cx-tiers">
        <div class="cx-tiers-h"><b>One email sent, priced live</b><span>0% markup</span></div>
        <ul data-motion="reveal" data-motion-stagger>${items}</ul>
        <p class="cx-tiers-foot">Checked by BounceVerify first. Addresses marked invalid or risky are never sent. Read from our <a href="/catalog">catalog</a>.</p>
      </div>`;
}

/** Resolves every price slot of the page from one catalogue read; a failed read prints no figure. */
export function withColdEmailPrices(html: string, prices: PlatformPrice[] | null): string {
  const flow = flowPrices(prices);
  let out = html.replaceAll(SEND_TIERS_TOKEN, sendTiersHtml(prices));
  for (const k of ["leads", "research", "ai", "sending"] as const) {
    const p = flow[k];
    out = out.replaceAll(flowPriceToken(k), p ? `<span class="cx-price">from ${esc(p)}</span>` : "");
  }
  return out;
}

// ---------------------------------------------------------------------------
// Hero: the light workflow card (default.com) that writes and sends
// ---------------------------------------------------------------------------

/** One buyer the card writes to: roles and company types, never a person. */
export type FlowLead = {
  role: string;
  company: string;
  signal: string;
  subject: string;
  body: string;
  reply: string;
  answer: string;
};

export const FLOW_LEADS: readonly FlowLead[] = [
  {
    role: "Head of Growth",
    company: "B2B SaaS, 45 people",
    signal: "Hiring a first SDR",
    subject: "Before your first SDR starts",
    body: "Hi, saw you are hiring your first SDR. What if replies were already waiting on their first day? Happy to show you how in 10 minutes.",
    reply: "Interesting. What would that look like for us?",
    answer: "Here is a short plan for your buyers. Does Thursday at 10am suit you?",
  },
  {
    role: "Founder",
    company: "Dev tools, 12 people",
    signal: "Launched on Product Hunt this week",
    subject: "After your launch",
    body: "Hi, congrats on the Product Hunt launch. The week after is when teams like yours look for their next users. Want me to send you a few?",
    reply: "Yes please, send them over.",
    answer: "Great. Here are five teams that fit. Shall we walk through them on Monday?",
  },
  {
    role: "VP Sales",
    company: "HR software, 130 people",
    signal: "Opened an office in Austin",
    subject: "Your new Austin office",
    body: "Hi, saw the new Austin office. A local pipeline helps a new team close its first deals fast. Open to a quick idea for it?",
    reply: "Sure, what do you have in mind?",
    answer: "A list of Texas buyers who fit your product. Free for a 15 minute call on Tuesday?",
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
function node(key: string, icon: string, title: string, price: string, active: string, done: string, inner: string): string {
  return `<li class="cx-node" data-node="${key}" data-status="done">
          <div class="cx-node-h"><span class="cx-ic">${icon}</span><b>${esc(title)}</b>${price}<span class="cx-st"><span class="a"><i class="spin"></i>${esc(active)}</span><span class="d">${ICON.done}${esc(done)}</span></span></div>
          ${inner}
        </li>`;
}

/**
 * The card's final state is the first buyer, every step done and the email written (what a
 * crawler, a reduced-motion visitor and a failed script see); motion.js `mail-flow` replays
 * it buyer after buyer from the JSON.
 */
export function flowHtml(leads: readonly FlowLead[] = FLOW_LEADS): string {
  const l = leads[0];
  const nodes = [
    node("found", ICON.find, "Find the buyer", flowPriceToken("leads"), "Searching", "Found", `<p class="cx-sub"><span data-field="role">${esc(l.role)}</span>, <span data-field="company">${esc(l.company)}</span></p>`),
    node("research", ICON.read, "Read their website", flowPriceToken("research"), "Reading", "Done", `<p class="cx-sub" data-field="signal">${esc(l.signal)}</p>`),
    node(
      "write",
      ICON.write,
      "Write and send",
      flowPriceToken("ai"),
      "Writing",
      "Sent",
      `<p class="cx-sub cx-sent-line">Sent from our warmed domains</p>
          <div class="cx-body"><div class="cx-draft">
            <div class="cx-draft-h"><span>To <b data-field="role">${esc(l.role)}</b></span><span>Subject <b data-field="subject">${esc(l.subject)}</b></span></div>
            <p class="cx-type" data-type>${esc(l.body)}</p>
            <div class="cx-draft-f"><span class="cx-send-price">${flowPriceToken("sending")}</span><span class="cx-send" data-send>Send</span></div>
          </div></div>`,
    ),
    node(
      "reply",
      ICON.reply,
      "Answer the reply",
      "",
      "Waiting",
      "Answered",
      `<div class="cx-thread"><p class="cx-msg them" data-field="reply">${esc(l.reply)}</p><p class="cx-msg us" data-field="answer">${esc(l.answer)}</p><span class="cx-pos">Positive reply on your dashboard</span></div>`,
    ),
  ].join("\n        ");
  return `<div class="cx-flow" data-motion="mail-flow" aria-hidden="true">
      <div class="cx-flow-h"><span class="live"><i></i>Cold email for yourcompany.com</span><span>Each step priced live</span></div>
      <ol class="cx-nodes">
        ${nodes}
      </ol>
      <svg class="cx-cursor" data-cursor viewBox="0 0 24 24" width="22" height="22"><path d="M5 3l14 8-6.2 1.6L10 19z" fill="#0a0a0a" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg>
      <script type="application/json" data-leads>${JSON.stringify(leads).replace(/</g, "\\u003c")}</script>
    </div>`;
}

/** The named clients' live counts: markup byte-shaped like the homepage's, so `withShowcaseOutcomes` reseeds it. */
function showcaseHtml(): string {
  return `<div class="showcase">
      <div class="showcase-label">Interested leads our cold emails found for real clients</div>
      <div class="showcase-grid" id="live-cards">
        <a class="show-card" href="#proof" data-live data-brand="docdinners.com" data-steps="20,3">
          <div class="show-top">${LOGO("docdinners.com", 32)}<div><div class="show-name">Doc Dinners</div><div class="show-domain">docdinners.com</div></div><span class="show-live"><i></i><em data-status>Sending</em></span></div>
          <div class="show-funnel">
            <span class="sf" data-step="conversation"><b data-n="0">20</b><small>Interested leads</small></span>
            <span class="sf" data-step="meeting_booked"><b data-n="1">3</b><small>Meetings booked</small></span>
          </div>
        </a>
        <a class="show-card" href="#proof" data-live data-brand="pressbeat.io" data-steps="7,1">
          <div class="show-top">${LOGO("pressbeat.io", 32)}<div><div class="show-name">PressBeat</div><div class="show-domain">pressbeat.io</div></div><span class="show-live"><i></i><em data-status>Sending</em></span></div>
          <div class="show-funnel">
            <span class="sf" data-step="conversation"><b data-n="0">7</b><small>Interested leads</small></span>
            <span class="sf" data-step="meeting_booked"><b data-n="1">1</b><small>Meetings booked</small></span>
          </div>
        </a>
        <a class="show-card" href="#proof" data-live data-brand="shockwavecenters.com" data-steps="8,0">
          <div class="show-top">${LOGO("shockwavecenters.com", 32)}<div><div class="show-name">Shockwave Centers</div><div class="show-domain">shockwavecenters.com</div></div><span class="show-live"><i></i><em data-status>Sending</em></span></div>
          <div class="show-funnel">
            <span class="sf" data-step="conversation"><b data-n="0">8</b><small>Interested leads</small></span>
            <span class="sf" data-step="meeting_booked" data-zero><b data-n="1">0</b><small>Meetings booked</small></span>
          </div>
        </a>
        <a class="show-card yours" href="${SIGN_UP}">
          <div class="show-top"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="32" height="32"><div><div class="show-name">Your company</div><div class="show-domain">yourcompany.com</div></div><span class="show-live"><i></i>Start free</span></div>
          <div class="show-funnel">
            <span class="sf" data-zero><b>0</b><small>Interested leads</small></span>
            <span class="sf" data-zero><b>0</b><small>Meetings booked</small></span>
            <span class="sf"><b>$0</b><small>Platform fee</small></span>
          </div>
        </a>
      </div>
      <div class="faces faces-showcase">
        <div class="faces-row">
          <img src="/landing/v2/assets/roberto-wrege.jpg" alt="">
          <img src="/landing/v2/assets/ivan-menez.jpg" alt="">
          <img src="/landing/v2/assets/ajay-kumaran.jpg" alt="">
          <img src="/landing/v2/assets/coenraad-loubser.jpg" alt="">
          <img src="/landing/v2/assets/ugnius-motiejunas.jpg" alt="">
          <img src="/landing/v2/assets/tanyo-goshev.jpg" alt="">
        </div>
        <div class="faces-text"><span class="stars">★★★★★</span><span data-founder-count>Loved by 70+ founders</span></div>
      </div>
    </div>`;
}

function heroHtml(): string {
  const twin = agencyTwin();
  return `<section class="hero hero-agent hero-coldmail">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <div class="hero-grid">
      <div class="hero-copy">
        __HOT_LEAD_ROW__

        <span class="eyebrow why-eyebrow">${WHY}</span>
        <h1>Cold Email Automation<br><span class="accent">Written, Sent, Answered For You</span>
          <span class="sub">Our AI cold email agent finds your buyers, writes one email per person, sends it from our warmed domains and answers the replies.</span>
        </h1>

        <div class="pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 6.5 7 .9-5.1 4.8 1.3 7-6.2-3.4-6.2 3.4 1.3-7L2 9.4l7-.9z"/></svg>Free for one user. Every email at the API price, 0% markup.</div>

        <form class="launch" action="${SIGN_UP}" method="get" id="hero-form">
          <div class="launch-field">
            <input id="hero-website" name="url" type="text" autocomplete="off" placeholder="Paste your website, e.g., acme.com">
            <button class="btn btn-accent" type="submit"><span>Start free</span>${ARROW}</button>
          </div>
        </form>
        <div class="hero-links">
          <a class="no-site" href="#compare">Compare cold email tools</a>
          <a class="no-site" href="#agent">Use it from Claude Code or Grok</a>${
            twin ? `\n          <a class="no-site" href="${twin}">Want our team on it? Cold Email Agency</a>` : ""
          }
        </div>
      </div>

      <div class="cx-stage" aria-label="Our AI agent finds a buyer, reads their website, writes the email, sends it and answers the reply, with the live price of each step">
        ${flowHtml()}
      </div>
    </div>

    ${showcaseHtml()}
  </div>
</section>`;
}

function stripHtml(): string {
  return `<section class="offer-strip" aria-label="The offer">
  <div class="wrap">
    <ul class="strip" data-motion="reveal" data-motion-stagger>
      <li><b>0%</b><span>markup on every email sent</span></li>
      <li><b>$0</b><span>for one user, hosted by us</span></li>
      <li><b>$9</b><span>per user for teams</span></li>
      <li><b>MIT</b><span>open source, run it yourself</span></li>
    </ul>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// How it writes: four steps
// ---------------------------------------------------------------------------

function howHtml(): string {
  return `<section class="framed" id="how">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">How it writes</span>
      <h2>One email per buyer, every day.</h2>
      <p>AI cold email that reads before it writes. You paste a website; the agent runs the rest.</p>
    </div>
    <div class="sdr-job">
      <svg class="sdr-beam" data-motion="beams" viewBox="0 0 1000 4" preserveAspectRatio="none" aria-hidden="true"><path d="M0 2 H1000" stroke="#2563eb" stroke-width="2" fill="none" vector-effect="non-scaling-stroke"/></svg>
      <ol class="sdr-steps" data-motion="reveal" data-motion-stagger>
        <li class="sdr-step">
          <span class="sdr-n">1</span>
          <h3>Learns your pitch</h3>
          <p>Reads your website and writes down what you sell, to whom, and why it wins.</p>
          <div class="sdr-vis cx-pitch" aria-hidden="true">
            <div><label>You sell</label><span class="chip">Product analytics</span></div>
            <div><label>To</label><span class="chip">SaaS founders</span></div>
            <div><label>Proof</label><span class="chip">Your customers</span></div>
          </div>
        </li>
        <li class="sdr-step">
          <span class="sdr-n">2</span>
          <h3>Reads each buyer</h3>
          <p>Visits their website and news, and picks the one fact worth writing about.</p>
          <div class="sdr-vis" aria-hidden="true">
            <div class="cx-signal"><span>Hiring a first SDR</span><em>Use it</em></div>
            <div class="cx-signal"><span>Launched on Product Hunt</span><em>Use it</em></div>
            <div class="cx-signal dim"><span>Company founded in 2019</span><em>Skip</em></div>
          </div>
        </li>
        <li class="sdr-step">
          <span class="sdr-n">3</span>
          <h3>Writes one email</h3>
          <p>A short email for that one person, with a clear question at the end.</p>
          <div class="sdr-vis" aria-hidden="true">
            <div class="sdr-mail"><b>Before your first SDR starts</b><span>Hi, saw you are hiring your first SDR. What if replies were already waiting on their first day?</span></div>
          </div>
        </li>
        <li class="sdr-step">
          <span class="sdr-n">4</span>
          <h3>Tests and answers</h3>
          <p>Every campaign is A/B tested, with the results on your dashboard. Every reply gets read.</p>
          <div class="sdr-vis" aria-hidden="true">
            <div class="cx-ab"><span class="v">A</span><span>Before your first SDR starts</span><em>Testing</em></div>
            <div class="cx-ab"><span class="v">B</span><span>Quick question about hiring</span><em>Testing</em></div>
            <div class="sdr-mail cx-replied"><b>Reply answered</b><span>Interesting. What would that look like for us?</span></div>
          </div>
        </li>
      </ol>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Sending: the setup a cold email tool leaves to you, done; the send priced live
// ---------------------------------------------------------------------------

export const SETUP_ROWS: { topic: string; tool: string; agent: string }[] = [
  { topic: "Mailboxes and domains", tool: "You buy them and connect each one", agent: "We send from mailboxes and domains we own" },
  { topic: "SPF, DKIM and DMARC", tool: "You set them up for every domain", agent: "Already set on every domain we send from" },
  { topic: "Warmup", tool: "Weeks of warming before you send", agent: "Our inboxes are warm, so you send on day one" },
  { topic: "The emails", tool: "You write the sequence and its steps", agent: "Written for each buyer from your website" },
  { topic: "The replies", tool: "Land in an inbox you work every day", agent: "Read and answered for you" },
];

function sendingHtml(): string {
  const rows = SETUP_ROWS.map(
    (r) => `<tr><th scope="row">${esc(r.topic)}</th><td>${esc(r.tool)}</td><td class="ours">${esc(r.agent)}</td></tr>`,
  ).join("");
  return `<section class="framed tint" id="sending">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Sending, handled</span>
      <h2>Your domain stays clean. Our inboxes do the sending.</h2>
      <p>A cold email tool gives you a sender to set up. Our agent arrives with the inboxes, already warm.</p>
    </div>
    <div class="cx-send-grid">
      <div class="sdr-table-wrap" data-motion="reveal">
        <table class="sdr-table cx-setup">
          <thead><tr><th scope="col"></th><th scope="col">A cold email tool</th><th scope="col">Our AI agent</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${SEND_TIERS_TOKEN}
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Prices, read live
// ---------------------------------------------------------------------------

function pricesHtml(): string {
  return `<section class="framed" id="prices">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">The price of a cold email</span>
      <h2>Every step of an email, at the API price.</h2>
      <p>Each tool our agent calls has a public price, read live from our <a href="/catalog">catalog</a>. You pay what the vendor charges, with 0% markup.</p>
    </div>
    <div class="prices-grid">
      <!--action-prices-->
      <aside class="byok" data-motion="reveal">
        <span class="byok-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/></svg></span>
        <h3>Your own key always wins</h3>
        <p>Run the open source version with your own sending, data and model keys. Each vendor bills you directly, and we see nothing.</p>
        <h3 class="byok-2">Your balance is the cap</h3>
        <p>Hosted accounts run on a prepaid balance. Auto reload tops it up at the level you choose.</p>
      </aside>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Cold email tools side by side, read from the competitor catalogue
// ---------------------------------------------------------------------------

function verifiedLabel(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export function compareHtml(): string {
  const list = coldEmailAutomationCompetitors();
  const newest = list.map((c) => c.verifiedOn).sort().at(-1) ?? "";
  const rows = list
    .map(
      (c) =>
        `<tr><th scope="row"><a href="${competitorPath(c)}">${competitorLogo(c, 20)}${esc(c.name)}</a></th><td>${esc(c.entryPrice)}</td><td>${esc(c.freeTier)}</td><td><a class="sdr-vs" href="${competitorPath(c)}">distribute.you vs ${esc(c.name)}</a></td></tr>`,
    )
    .join("");
  const sources = list.map((c) => `<a href="${esc(c.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(c.name)}</a>`).join(", ");
  return `<section class="framed tint" id="compare">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Cold email tools compared</span>
      <h2>The cold email tool that also does the work.</h2>
      <p>Each of these is a fine sender for a team that runs outbound. Ours writes, sends and answers for you.</p>
    </div>
    <div class="sdr-table-wrap" data-motion="reveal">
      <table class="sdr-table">
        <thead><tr><th scope="col">Tool</th><th scope="col">Price on their site</th><th scope="col">Free to start</th><th scope="col"></th></tr></thead>
        <tbody>
          <tr class="ours"><th scope="row"><a href="${COLD_EMAIL_AUTOMATION_PATH}"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="20" height="20">distribute.you</a></th><td>Free for one user. Every action at the API price, 0% markup</td><td>Yes, and open source too</td><td><a class="sdr-vs" href="${SIGN_UP}">Start free</a></td></tr>
          ${rows}
        </tbody>
      </table>
    </div>
    <p class="stack-source">Read on each site on ${esc(verifiedLabel(newest))}: ${sources}. <a href="${COLD_EMAIL_AUTOMATION_ALTERNATIVES_PATH}">Every cold email automation alternative</a>.</p>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Plans, agent, FAQ
// ---------------------------------------------------------------------------

function plansHtml(): string {
  const twin = agencyTwin();
  const bridge = twin
    ? `
    <a class="agency-bridge rv" href="${twin}">
      <span><b>Want our team to run it for you?</b> The Cold Email Agency runs it with you. From $1K/month + 10% of budget.</span>
      <em>See the Cold Email Agency</em>
    </a>`
    : "";
  return `<section class="framed tint tint-both" id="pricing">
  <div class="wrap">
    <div class="section-head center rv">
      <span class="eyebrow">Pricing</span>
      <h2>Pay for the emails, never for a seat.</h2>
      <p>The same agent and the same features on every plan. Pause or cancel anytime.</p>
    </div>
    <div class="plans plans-3">
      <article class="plan rv">
        <span class="plan-tag"><i></i>Open source</span>
        <div class="plan-price">Free<small>on your server</small></div>
        <p class="plan-desc">Run your cold email agent yourself and keep every lead and reply.</p>
        <a class="btn btn-outline btn-lg" href="https://github.com/distribute-you/gtm-factory" target="_blank" rel="noopener">View the code</a>
        <div class="plan-included">What's included</div>
        <ul>
          <li><i></i>MIT license, every line on GitHub</li>
          <li><i></i>Your leads and replies in your own database</li>
          <li><i></i>Your own API keys, billed by each vendor</li>
        </ul>
      </article>
      <article class="plan featured rv">
        <span class="plan-tag"><i></i>Hosted</span>
        <div class="plan-price">Free<small>for one user</small></div>
        <p class="plan-desc">We host it and send from our inboxes. You pay each email at the API price.</p>
        <a class="btn btn-accent btn-lg" href="${SIGN_UP}">Start free</a>
        <div class="plan-included">What's included</div>
        <ul>
          <li><i></i>Every action at the vendor's API price, 0% markup</li>
          <li><i></i>Emails written for each buyer and A/B tested</li>
          <li><i></i>Sent from our warmed mailboxes and domains</li>
          <li><i></i>Our AI agent talks with you on WhatsApp</li>
          <li><i></i>A prepaid balance: start with $10, auto reload keeps it going</li>
        </ul>
      </article>
      <article class="plan rv">
        <span class="plan-tag"><i></i>Team</span>
        <div class="plan-price">$9<small>per user, each month</small></div>
        <p class="plan-desc">Your whole team on the same campaigns and replies.</p>
        <a class="btn btn-outline btn-lg" href="${SIGN_UP}">Start free</a>
        <div class="plan-included">What's included</div>
        <ul>
          <li><i></i>Everything in Hosted</li>
          <li><i></i>Every teammate sees every email and reply</li>
          <li><i></i>The same API prices, 0% markup</li>
        </ul>
      </article>
    </div>${bridge}
  </div>
</section>`;
}

function agentHtml(): string {
  return `<section class="framed" id="agent">
  <div class="wrap">
    <div class="agent-grid">
      <div class="section-head" data-motion="reveal">
        <span class="eyebrow">Works from your own agent</span>
        <h2>Ask your agent to send the emails.</h2>
        <p>Run our AI cold email agent from Claude Code, Grok or any agent that speaks MCP. Same agent, same API prices.</p>
        <div class="agent-logos">
          <span>${LOGO("claude.ai", 20)}Claude Code</span>
          <span>${LOGO("x.ai", 20)}Grok</span>
          <span>${LOGO("cursor.com", 20)}Cursor</span>
          <span>${LOGO("openai.com", 20)}ChatGPT</span>
        </div>
        <p class="agent-more"><a href="/docs/mcp">Read the MCP guide</a> · <a href="/docs/integrations/claude">Set up Claude Code</a></p>
      </div>
      <div class="copy-boxes" data-motion="reveal" data-motion-stagger>
        <div class="copy-box">
          <div class="copy-head"><span>Claude Code</span><button class="copy-btn" type="button" data-copy>Copy</button></div>
          <pre><code>claude mcp add --transport http distribute https://mcp.distribute.you/mcp</code></pre>
        </div>
        <div class="copy-box">
          <div class="copy-head"><span>Then ask</span><button class="copy-btn" type="button" data-copy>Copy</button></div>
          <pre><code>Start a cold email campaign for acme.com. Write one email per buyer, send from your domains and answer the replies.</code></pre>
        </div>
      </div>
    </div>
  </div>
</section>`;
}

/** The FAQ: answers in HTML for the page, the same text without tags for the JSON-LD. */
export const COLD_EMAIL_AUTOMATION_FAQ: { q: string; a: string }[] = [
  {
    q: "What is cold email automation?",
    a: "Cold email automation is software that sends your cold emails and their follow-ups for you. Ours goes further: an AI agent finds the buyers, writes each email, sends it from our own inboxes and answers the replies.",
  },
  {
    q: "Does AI cold email sound like a template?",
    a: "No. The agent reads each buyer's website and news first, then writes a short email about the one fact that matters to them. Every campaign is A/B tested, and you see the results on your dashboard.",
  },
  {
    q: "Whose mailboxes send the emails?",
    a: "Ours. Every email leaves from mailboxes and domains we own, set up and warm, so your company domain never sends cold email and there is nothing to configure on your side.",
  },
  {
    q: "How much does each cold email cost?",
    a: 'The agent is free for one user, and $9 per user each month for a team. Each step, finding the buyer, reading their site, writing and sending, is billed at the vendor\'s API price with 0% markup, from a prepaid balance you start with $10. Every price is on our <a href="/catalog">catalog</a>.',
  },
  {
    q: "Who answers the replies?",
    a: "The agent reads every reply. It answers the interested ones and keeps the conversation going, and each positive reply shows up on your dashboard with its whole history.",
  },
  {
    q: "Do I need Instantly, Smartlead or another sender?",
    a: "No. Sending is built in, from our warmed inboxes. If you already pay for a cold email tool, you can keep it for your own lists.",
  },
  {
    q: "Can I run it on my own server?",
    a: 'Yes. The <a href="https://github.com/distribute-you/gtm-factory" target="_blank" rel="noopener">GTM Factory</a> behind it is open source under the MIT license. Run it with your own API keys, and your leads and replies stay in your own database.',
  },
  {
    q: "How is it different from Instantly, Smartlead or Lemlist?",
    a: `They are cold email tools your team runs. Our agent writes, sends and answers for you. Each comparison is on its own page: ${coldEmailAutomationCompetitors()
      .map((c) => `<a href="${competitorPath(c)}">${esc(c.name)}</a>`)
      .join(", ")}.`,
  },
];

const stripTags = (s: string) => s.replace(/<[^>]+>/g, "");

function faqHtml(): string {
  const items = COLD_EMAIL_AUTOMATION_FAQ.map(
    (f, i) => `<div class="faq-item${i === 0 ? " open" : ""}">
        <button class="faq-q" type="button" aria-expanded="${i === 0}">${esc(f.q)}${PLUS}</button>
        <div class="faq-a"><p>${f.a}</p></div>
      </div>`,
  ).join("\n      ");
  const twin = agencyTwin();
  const links = coldEmailAutomationCompetitors()
    .map((c) => `<a href="${competitorPath(c)}">distribute.you vs ${esc(c.name)}</a>`)
    .concat(`<a href="${COLD_EMAIL_AUTOMATION_ALTERNATIVES_PATH}">Cold email automation alternatives</a>`)
    .concat(twin ? [`<a href="${twin}">Cold Email Agency</a>`] : [])
    .join(" · ");
  return `<section class="framed" id="faq">
  <div class="wrap">
    <div class="section-head center rv"><h2>Questions about cold email automation</h2></div>
    <div class="faq-list rv">
      ${items}
    </div>
    <p class="cmp-more">${links}</p>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

export const COLD_EMAIL_AUTOMATION_TITLE = "Cold Email Automation: AI Cold Email Done For You | distribute.you";
export const COLD_EMAIL_AUTOMATION_DESCRIPTION =
  "Revenue made easy. Cold email automation by an AI agent that finds your buyers, writes each email, sends it and answers. Free for one user, 0% markup.";

export function renderColdEmailAutomationPage(): string {
  const url = `${SITE}${COLD_EMAIL_AUTOMATION_PATH}`;
  return shell({
    title: COLD_EMAIL_AUTOMATION_TITLE,
    description: COLD_EMAIL_AUTOMATION_DESCRIPTION,
    path: COLD_EMAIL_AUTOMATION_PATH,
    head: head(),
    bodyClass: "coldmail",
    body: [
      heroHtml(),
      stripHtml(),
      howHtml(),
      sendingHtml(),
      proofHtml(),
      "__HOT_LEAD_BAND__",
      pricesHtml(),
      compareHtml(),
      quotesHtml(),
      plansHtml(),
      agentHtml(),
      faqHtml(),
    ].join("\n\n"),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "distribute.you cold email automation",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url,
        description: COLD_EMAIL_AUTOMATION_DESCRIPTION,
        offers: { "@type": "Offer", price: 0, priceCurrency: "USD", description: "Free for one user. Every action at the API price, 0% markup." },
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: COLD_EMAIL_AUTOMATION_FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: stripTags(f.a) } })),
      },
      breadcrumb([
        { name: "distribute.you", path: "/" },
        { name: "Cold Email Automation", path: COLD_EMAIL_AUTOMATION_PATH },
      ]),
    ],
  });
}
