/**
 * `/lead-nurturing-automation`: the Lead Nurturing AI Agent page
 * (PAGE-LEAD-NURTURING-AUTOMATION-1030, owner 2026-10-29).
 *
 * Buyer: the cheap SaaS founder (root CLAUDE.md POSITIONING). Search keyword: "lead nurturing
 * automation" (70 US searches a month), with "ai lead nurturing" (30 to 50). Its Agency twin is
 * `/database-reactivation-agency` (a company making cash, Book a call); this page sells the same
 * outcome to the founder who plugs their own tools and lets our agent run it, at the API price,
 * starting free. What it says that no sibling says: the founder connects Clerk, Stripe, PostHog
 * or GoHighLevel (connectors every client can plug), and each thing a lead DOES (a visit, a
 * signup, a payment, a reply) is what makes the agent write, by email or WhatsApp. A lead who
 * never acted is never chased; every lead carries its next follow-up date.
 *
 * Every figure is READ at render, never typed here:
 * - `__HOT_LEAD_ROW__` / `__HOT_LEAD_BAND__`: the fleet's engaged leads and costs
 *   (static-html.ts `withHotLeadStats`, the reads the homepage hero states);
 * - `<!--action-prices-->`: the live price of each kind of action, from the cost catalogue;
 * - the tool rows: `nurturing-tools.ts`, each figure read on the tool's own site and dated.
 * The hero thread, the signals and the steps are a product preview: roles, never a person.
 *
 * Signature motion (refs #8, explee's agent chat, LIGHT variant): a live signals feed (PostHog
 * visit, Clerk signup, Stripe payment) where each signal lights up and the next WhatsApp
 * message or email answers it (motion.js `signal-thread`). The Agency twin plays a dark thread
 * of one quiet lead coming back (`wa-thread`); this one is a day of signals on a white card.
 * Styles: `public/landing/v2/lead-nurturing-automation.css`, after agent.css and ai-sdr.css.
 *
 * Alias-free: the unit tests render it directly.
 */
import {
  NURTURING_ALTERNATIVES_PATH,
  NURTURING_PAGE_PATH,
  NURTURING_TOOLS,
  OUR_NURTURING_ROW,
  nurturingVsPath,
} from "../nurturing-tools";
import { REACTIVATION_PAGE_PATH } from "../reactivation-agencies";
import { SITE, SIGN_UP, WHY, breadcrumb, esc, shell } from "../v2-shell";
import { AGENT_CSS_VERSION, AI_SDR_CSS_VERSION, quotesHtml } from "./ai-sdr";

export const NURTURING_CSS_VERSION = 1;

const LOGO = (domain: string, size = 28) =>
  `<img src="https://img.logo.dev/${domain}?token=pk_J1iY4__HSfm9acHjR8FibA&size=64&format=png" alt="" width="${size}" height="${size}">`;

const ARROW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';
const TICKS = '<svg class="ln-ticks" viewBox="0 0 18 12" aria-hidden="true"><path d="M1 6.5l3 3 6.5-7.5M7.5 9.5l1 1 6.5-8.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** The page's stylesheets: the AI Agent layers, then this page's own. */
export function nurturingHead(): string {
  return `<link rel="stylesheet" href="/landing/v2/agent.css?v=${AGENT_CSS_VERSION}">
<link rel="stylesheet" href="/landing/v2/ai-sdr.css?v=${AI_SDR_CSS_VERSION}">
<link rel="stylesheet" href="/landing/v2/lead-nurturing-automation.css?v=${NURTURING_CSS_VERSION}">`;
}

/** The tools a founder plugs (connectors every client can plug), and what the agent reads in each. */
export const CONNECTORS = [
  { name: "Clerk", domain: "clerk.com", reads: "Who signed up for your product" },
  { name: "Stripe", domain: "stripe.com", reads: "Who paid, and who stopped" },
  { name: "PostHog", domain: "posthog.com", reads: "Who came back to your site" },
  { name: "GoHighLevel", domain: "gohighlevel.com", reads: "Your contacts and pipeline stages" },
] as const;

// ---------------------------------------------------------------------------
// Hero: the signals feed and the WhatsApp thread that answers it
// ---------------------------------------------------------------------------

export type Beat =
  | { kind: "signal"; tool: string; domain: string; what: string; when: string; next: "WhatsApp" | "Email" }
  | { kind: "us" | "them"; text: string; time: string }
  | { kind: "event"; text: string };

/**
 * The day the hero plays (motion.js `signal-thread`), in order: each signal lights up, then the
 * message that answers it arrives. A product preview: a role, never a person, no figure.
 */
export const BEATS: readonly Beat[] = [
  { kind: "signal", tool: "PostHog", domain: "posthog.com", what: "Visited your pricing page", when: "9:41", next: "WhatsApp" },
  { kind: "us", text: "Hi! Saw you comparing our plans this morning. Want a hand picking the right one?", time: "9:43" },
  { kind: "them", text: "Yes please. Which one fits a team of three?", time: "9:50" },
  { kind: "us", text: "The Team plan. Start free today and invite your two teammates when you are ready.", time: "9:51" },
  { kind: "signal", tool: "Clerk", domain: "clerk.com", what: "Signed up", when: "10:12", next: "Email" },
  { kind: "event", text: "Email sent · Your first steps, in 2 minutes" },
  { kind: "signal", tool: "Stripe", domain: "stripe.com", what: "First payment", when: "16:05", next: "WhatsApp" },
  { kind: "us", text: "Welcome aboard! I will check in on Monday to see how your setup went.", time: "16:06" },
  { kind: "event", text: "Next follow-up · Monday 9:00" },
];

export function stageHtml(beats: readonly Beat[] = BEATS): string {
  const signals = beats
    .map((b, i) => ({ b, n: i + 1 }))
    .filter((x) => x.b.kind === "signal")
    .map(({ b, n }) => {
      const s = b as Extract<Beat, { kind: "signal" }>;
      return `<li class="ln-sig" data-beat="${n}" data-kind="signal">${LOGO(s.domain, 22)}<div><b>${esc(s.what)}</b><small>${esc(s.tool)} · ${esc(s.when)}</small></div><em>${esc(s.next)}</em></li>`;
    })
    .join("\n          ");
  const thread = beats
    .map((b, i) => ({ b, n: i + 1 }))
    .filter((x) => x.b.kind !== "signal")
    .map(({ b, n }) => {
      if (b.kind === "event") return `<div class="ln-event" data-beat="${n}" data-kind="event"><span class="ln-dot" aria-hidden="true"></span>${esc(b.text)}</div>`;
      const m = b as Extract<Beat, { kind: "us" | "them" }>;
      return `<div class="ln-msg ${m.kind}${m.kind === "us" ? " is-read" : ""}" data-beat="${n}" data-kind="${m.kind}"><p>${esc(m.text)}</p><span class="ln-meta">${esc(m.time)}${m.kind === "us" ? TICKS : ""}</span></div>`;
    })
    .join("\n          ");
  return `<div class="ln-stage" data-motion="signal-thread" role="img" aria-label="A lead visits your pricing page, signs up and pays; after each step our AI agent writes on WhatsApp or by email, then sets the next follow-up">
      <div class="ln-signals">
        <div class="ln-signals-h"><span class="live"><i></i>Signals from your tools</span></div>
        <ol class="ln-sig-list">
          ${signals}
        </ol>
        <p class="ln-signals-f">Each signal makes the agent write.</p>
      </div>
      <div class="ln-phone">
        <div class="ln-top">
          <span class="ln-av" aria-hidden="true">HG</span>
          <div><b>Head of Growth, B2B SaaS</b><small data-presence>online</small></div>
          <img src="https://www.google.com/s2/favicons?domain=whatsapp.com&sz=64" alt="" width="20" height="20">
        </div>
        <div class="ln-thread">
          <span class="ln-day">Today</span>
          ${thread}
          <div class="ln-typing" data-typing aria-hidden="true"><i></i><i></i><i></i></div>
        </div>
      </div>
    </div>`;
}

function heroHtml(): string {
  return `<section class="hero hero-agent hero-nurture">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <div class="hero-grid">
      <div class="hero-copy">
        __HOT_LEAD_ROW__

        <span class="eyebrow why-eyebrow">${WHY}</span>
        <h1>Lead Nurturing Automation<br><span class="accent">Leads Followed Up For You</span>
          <span class="sub">Our AI lead nurturing agent writes to each lead by email or WhatsApp the moment they visit, sign up or pay.</span>
        </h1>

        <div class="pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 6.5 7 .9-5.1 4.8 1.3 7-6.2-3.4-6.2 3.4 1.3-7L2 9.4l7-.9z"/></svg>Free. Every message at the API price, 0% markup.</div>

        <form class="launch" action="${SIGN_UP}" method="get" id="hero-form">
          <div class="launch-field">
            <input id="hero-website" name="url" type="text" autocomplete="off" placeholder="Paste your website, e.g., acme.com">
            <button class="btn btn-accent" type="submit"><span>Start free</span>${ARROW}</button>
          </div>
        </form>
        <ul class="ln-plugs" aria-label="Tools you can connect">${CONNECTORS.map((c) => `<li>${LOGO(c.domain, 16)}${esc(c.name)}</li>`).join("")}</ul>
        <div class="hero-links">
          <a class="no-site" href="#compare">Compare nurturing tools</a>
          <a class="no-site" href="#agent">Use it from Claude Code or Grok</a>
          <a class="no-site" href="${REACTIVATION_PAGE_PATH}">Want our team on it? Database Reactivation Agency</a>
        </div>
      </div>

      ${stageHtml()}
    </div>

    <div class="faces faces-showcase ln-faces">
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
  </div>
</section>`;
}

function stripHtml(): string {
  return `<section class="offer-strip" aria-label="The offer">
  <div class="wrap">
    <ul class="strip" data-motion="reveal" data-motion-stagger>
      <li><b>0%</b><span>markup on every message</span></li>
      <li><b>$0</b><span>hosted by us</span></li>
      <li><b>MIT</b><span>open source, run it yourself</span></li>
    </ul>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// How it nurtures: four steps
// ---------------------------------------------------------------------------

function howHtml(): string {
  const plugs = CONNECTORS.map((c) => `<div class="ln-plug">${LOGO(c.domain, 18)}<span>${esc(c.name)}</span><em>Connected</em></div>`).join("");
  return `<section class="framed" id="how">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">How it nurtures</span>
      <h2 style="margin-top:16px">From a signal to the right message.</h2>
      <p>Lead nurturing automation that waits for your lead to act, then writes. You plug your tools once; the agent runs every day.</p>
    </div>
    <div class="sdr-job">
      <svg class="sdr-beam" data-motion="beams" viewBox="0 0 1000 4" preserveAspectRatio="none" aria-hidden="true"><path d="M0 2 H1000" stroke="#2563eb" stroke-width="2" fill="none" vector-effect="non-scaling-stroke"/></svg>
      <ol class="sdr-steps" data-motion="reveal" data-motion-stagger>
        <li class="sdr-step">
          <span class="sdr-n">1</span>
          <h3>Plug your tools</h3>
          <p>Connect Clerk, Stripe, PostHog or GoHighLevel in a few clicks.</p>
          <div class="sdr-vis ln-plugs-v" aria-hidden="true">${plugs}</div>
        </li>
        <li class="sdr-step">
          <span class="sdr-n">2</span>
          <h3>Watches every lead</h3>
          <p>Each visit, signup, payment and reply lands on the lead&apos;s timeline.</p>
          <div class="sdr-vis" aria-hidden="true">
            <div class="sdr-lead"><span class="av"></span><div>Visited pricing<small>PostHog</small></div><em class="ln-new">New</em></div>
            <div class="sdr-lead"><span class="av"></span><div>Signed up<small>Clerk</small></div><em class="ln-new">New</em></div>
            <div class="sdr-lead"><span class="av"></span><div>Stopped paying<small>Stripe</small></div><em class="ln-new">New</em></div>
          </div>
        </li>
        <li class="sdr-step">
          <span class="sdr-n">3</span>
          <h3>Writes when they act</h3>
          <p>One message for one person, by email from our domains or on WhatsApp.</p>
          <div class="sdr-vis" aria-hidden="true">
            <div class="ln-mini"><span>${LOGO("whatsapp.com", 14)}WhatsApp</span>Saw you signed up. Want me to connect Stripe with you?</div>
            <div class="sdr-mail"><b>Your first steps</b><span>Two clicks and your first report is ready.</span></div>
          </div>
        </li>
        <li class="sdr-step">
          <span class="sdr-n">4</span>
          <h3>Sets the next date</h3>
          <p>Every lead keeps a next follow-up date, so nobody is forgotten.</p>
          <div class="sdr-vis" aria-hidden="true">
            <div class="ln-date"><span>Next follow-up</span><b>Monday 9:00</b></div>
            <div class="ln-date quiet"><span>Never acted</span><b>Left in peace</b></div>
          </div>
        </li>
      </ol>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// A drip sequence vs the agent
// ---------------------------------------------------------------------------

export const CONTRAST_ROWS: { topic: string; drip: string; agent: string }[] = [
  { topic: "When it writes", drip: "Day 1, day 3, day 7, whatever the lead does", agent: "The moment the lead visits, signs up, pays or replies" },
  { topic: "What it says", drip: "The same template for everyone on the list", agent: "One message about what this lead just did" },
  { topic: "Channels", drip: "Email, WhatsApp often an add-on", agent: "Email from our domains and WhatsApp, included" },
  { topic: "Replies", drip: "Land in your inbox for you to answer", agent: "Answered by the agent, then the next date is set" },
  { topic: "Who builds it", drip: "You draw the workflow and keep it up to date", agent: "Nobody. You plug your tools and the agent decides" },
];

function contrastHtml(): string {
  const rows = CONTRAST_ROWS.map(
    (r) => `<tr><th scope="row">${esc(r.topic)}</th><td>${esc(r.drip)}</td><td class="ours">${esc(r.agent)}</td></tr>`,
  ).join("");
  return `<section class="framed tint" id="drip">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Signals, not a schedule</span>
      <h2 style="margin-top:16px">A drip sequence follows a calendar. Our agent follows your lead.</h2>
      <p>The same email and WhatsApp channels, sent at the moment that counts.</p>
    </div>
    <div class="sdr-table-wrap" data-motion="reveal">
      <table class="sdr-table ln-contrast">
        <thead><tr><th scope="col"></th><th scope="col">A drip sequence</th><th scope="col">Our AI agent</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// The signals it acts on
// ---------------------------------------------------------------------------

export const SIGNALS = [
  { tool: "PostHog", domain: "posthog.com", signal: "Comes back to your pricing page", action: "Writes while the page is still open, about the plan they looked at." },
  { tool: "Clerk", domain: "clerk.com", signal: "Signs up for your product", action: "Sends the first steps and offers a hand with the setup." },
  { tool: "Stripe", domain: "stripe.com", signal: "Pays, or stops paying", action: "Thanks a new customer, or asks a leaving one what changed." },
  { tool: "GoHighLevel", domain: "gohighlevel.com", signal: "Moves to a new pipeline stage", action: "Writes the message that stage calls for, then plans the next one." },
  { tool: "Email or WhatsApp", domain: "whatsapp.com", signal: "Replies, even with one word", action: "Answers fast, while you are still on their mind." },
];

function signalsHtml(): string {
  const cards = SIGNALS.map(
    (s) =>
      `<li class="ln-card">${LOGO(s.domain, 24)}<div><small>${esc(s.tool)}</small><h3>${esc(s.signal)}</h3><p>${esc(s.action)}</p></div></li>`,
  ).join("");
  return `<section class="framed" id="signals">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Signals it acts on</span>
      <h2 style="margin-top:16px">Every move your lead makes gets an answer.</h2>
      <p>The agent reads the tools you already use. A lead who never acted is left in peace.</p>
    </div>
    <ul class="ln-cards" data-motion="reveal" data-motion-stagger>${cards}</ul>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// We nurture our own leads with it
// ---------------------------------------------------------------------------

function ownHtml(): string {
  return `<section class="framed tint" id="ours">
  <div class="wrap ln-own" data-motion="reveal">
    <div>
      <span class="eyebrow">We use it ourselves</span>
      <h2 style="margin-top:16px">Our own leads get the same agent.</h2>
      <p>Every founder who visits, replies or signs up with us is followed by this agent, through the same Clerk, Stripe and PostHog connectors you plug. What works on our leads reaches yours the same day.</p>
    </div>
    <ul class="ln-own-list">
      <li><b>One campaign per brand</b><span>It starts on any move a lead makes, so nobody waits for a list.</span></li>
      <li><b>A next date for every lead</b><span>Set after each message, then served on the day.</span></li>
      <li><b>Only people who acted</b><span>A lead we only wrote to stays cold until they move.</span></li>
    </ul>
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
      <span class="eyebrow">The price of a message</span>
      <h2 style="margin-top:16px">Every message, at the API price.</h2>
      <p>Each tool our agent calls has a public price, read live from our <a href="/catalog">catalog</a>. You pay what the vendor charges, with 0% markup.</p>
    </div>
    <div class="prices-grid">
      <!--action-prices-->
      <aside class="byok" data-motion="reveal">
        <span class="byok-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/></svg></span>
        <h3>Your data stays yours</h3>
        <p>Run the open source version on your own server with your own keys. Your leads and their history stay in your own database.</p>
        <h3 class="byok-2">Your balance is the cap</h3>
        <p>Hosted accounts run on a prepaid balance. Auto reload tops it up at the level you choose.</p>
      </aside>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Nurturing tools side by side, read from their own sites
// ---------------------------------------------------------------------------

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function verifiedLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function compareHtml(): string {
  const newest = NURTURING_TOOLS.map((t) => t.verifiedOn).sort().at(-1) ?? "";
  const rows = NURTURING_TOOLS.map(
    (t) =>
      `<tr><th scope="row"><a href="${nurturingVsPath(t)}">${LOGO(t.domain, 20)}${esc(t.name)}</a></th><td>${esc(t.entryPrice)}</td><td>${esc(t.whatsapp)}</td><td><a class="sdr-vs" href="${nurturingVsPath(t)}">distribute.you vs ${esc(t.name)}</a></td></tr>`,
  ).join("");
  const sources = NURTURING_TOOLS.map((t) => `<a href="${esc(t.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(t.name)}</a>`).join(", ");
  return `<section class="framed tint" id="compare">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Nurturing tools compared</span>
      <h2 style="margin-top:16px">The nurturing tool that writes the messages too.</h2>
      <p>Each of these is great at sending what you build. Ours decides when to write, and writes.</p>
    </div>
    <div class="sdr-table-wrap" data-motion="reveal">
      <table class="sdr-table">
        <thead><tr><th scope="col">Tool</th><th scope="col">Price on their site</th><th scope="col">WhatsApp</th><th scope="col"></th></tr></thead>
        <tbody>
          <tr class="ours"><th scope="row"><a href="${NURTURING_PAGE_PATH}"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="20" height="20">distribute.you</a></th><td>Free. Every message at the API price, 0% markup</td><td>${esc(OUR_NURTURING_ROW.whatsapp)}</td><td><a class="sdr-vs" href="${SIGN_UP}">Start free</a></td></tr>
          ${rows}
        </tbody>
      </table>
    </div>
    <p class="stack-source">Read on each site on ${esc(verifiedLabel(newest))}: ${sources}. <a href="${NURTURING_ALTERNATIVES_PATH}">Every lead nurturing automation alternative</a>.</p>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Plans, agent, FAQ
// ---------------------------------------------------------------------------

function plansHtml(): string {
  return `<section class="framed tint tint-both" id="pricing">
  <div class="wrap">
    <div class="section-head center rv">
      <span class="eyebrow">Pricing</span>
      <h2 style="margin-top:16px">Pay for the messages, never for your contacts.</h2>
      <p>The same agent and the same features on every plan. Pause or cancel anytime.</p>
    </div>
    <div class="plans">
      <article class="plan rv">
        <span class="plan-tag"><i></i>Open source</span>
        <div class="plan-price">Free<small>on your server</small></div>
        <p class="plan-desc">Run your lead nurturing agent yourself and keep every lead.</p>
        <a class="btn btn-outline btn-lg" href="https://github.com/distribute-you/gtm-factory" target="_blank" rel="noopener">View the code</a>
        <div class="plan-included">What's included</div>
        <ul>
          <li><i></i>MIT license, every line on GitHub</li>
          <li><i></i>Your leads and their history in your own database</li>
          <li><i></i>Your own API keys, billed by each vendor</li>
        </ul>
      </article>
      <article class="plan featured rv">
        <span class="plan-tag"><i></i>Hosted</span>
        <div class="plan-price">Free<small>no monthly fee</small></div>
        <p class="plan-desc">We host it. You pay each message at the API price.</p>
        <a class="btn btn-accent btn-lg" href="${SIGN_UP}">Start free</a>
        <div class="plan-included">What's included</div>
        <ul>
          <li><i></i>Every action at the vendor's API price, 0% markup</li>
          <li><i></i>Clerk, Stripe, PostHog and GoHighLevel connectors</li>
          <li><i></i>Messages by email from our domains and on WhatsApp</li>
          <li><i></i>Our AI agent talks with you on WhatsApp</li>
          <li><i></i>A prepaid balance: start with $10, auto reload keeps it going</li>
        </ul>
      </article>
    </div>
    <a class="agency-bridge rv" href="${REACTIVATION_PAGE_PATH}">
      <span><b>Want our team to bring your old leads back?</b> The Database Reactivation Agency runs it with you. From $1K/month + 10% of budget.</span>
      <em>See the Database Reactivation Agency</em>
    </a>
  </div>
</section>`;
}

function agentHtml(): string {
  return `<section class="framed" id="agent">
  <div class="wrap">
    <div class="agent-grid">
      <div class="section-head" data-motion="reveal">
        <span class="eyebrow">Works from your own agent</span>
        <h2 style="margin-top:16px">Ask your agent to follow up.</h2>
        <p>Run our AI lead nurturing agent from Claude Code, Grok or any agent that speaks MCP. Same agent, same API prices.</p>
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
          <pre><code>Nurture the leads of acme.com. Write to each one by email or WhatsApp when they visit, sign up or pay, and set their next follow-up.</code></pre>
        </div>
      </div>
    </div>
  </div>
</section>`;
}

/** The FAQ: answers in HTML for the page, the same text without tags for the JSON-LD. */
export const NURTURING_FAQ: { q: string; a: string }[] = [
  {
    q: "What is lead nurturing automation?",
    a: "It is following up with every lead until they buy, without doing it by hand. Ours is an AI agent: it watches what each lead does, writes the right message at the right moment, and sets the next follow-up date.",
  },
  {
    q: "What is AI lead nurturing?",
    a: "AI lead nurturing writes one message for one person, about what they just did, instead of sending the same template to a list. Our agent reads the signal, picks email or WhatsApp, writes, and answers the reply.",
  },
  {
    q: "Which tools does it connect to?",
    a: "Clerk for signups, Stripe for payments, PostHog for site visits and GoHighLevel for your contacts and pipeline. Every client can plug them in a few clicks, and the agent reads each lead's timeline from them.",
  },
  {
    q: "Which channels does it write on?",
    a: "Email, sent from mailboxes and domains we own, and WhatsApp. Your own domain stays clean and there is nothing to set up on your side.",
  },
  {
    q: "Will it bother leads who never asked to hear from us?",
    a: "The agent writes when a lead acts: a visit, a signup, a payment, a reply. A lead who never acted is left in peace, and anyone who asks to stop is never written to again.",
  },
  {
    q: "What is the price?",
    a: 'The agent is free. Each message is billed at the vendor\'s API price with 0% markup, from a prepaid balance you start with $10. Every price is on our <a href="/catalog">catalog</a>.',
  },
  {
    q: "Can I run it on my own server?",
    a: 'Yes. The <a href="https://github.com/distribute-you/gtm-factory" target="_blank" rel="noopener">GTM Factory</a> behind it is open source under the MIT license. Run it with your own API keys, and your leads stay in your own database.',
  },
  {
    q: "How is it different from ActiveCampaign, HubSpot, Customer.io or Brevo?",
    a: `They send the sequences you build. Our agent decides when to write and writes each message itself. Each comparison is on its own page: ${NURTURING_TOOLS.map((t) => `<a href="${nurturingVsPath(t)}">${esc(t.name)}</a>`).join(", ")}.`,
  },
  {
    q: "Can your team run it for me?",
    a: `Yes. Our <a href="${REACTIVATION_PAGE_PATH}">Database Reactivation Agency</a> connects your tools, wakes your past leads and keeps every lead followed up, from $1K a month plus 10% of budget.`,
  },
];

const stripTags = (s: string) => s.replace(/<[^>]+>/g, "");

function faqHtml(): string {
  const items = NURTURING_FAQ.map(
    (f, i) => `<div class="faq-item${i === 0 ? " open" : ""}">
        <button class="faq-q" type="button" aria-expanded="${i === 0}">${esc(f.q)}${PLUS}</button>
        <div class="faq-a"><p>${f.a}</p></div>
      </div>`,
  ).join("\n      ");
  const links = NURTURING_TOOLS.map((t) => `<a href="${nurturingVsPath(t)}">distribute.you vs ${esc(t.name)}</a>`)
    .concat(`<a href="${NURTURING_ALTERNATIVES_PATH}">Lead nurturing automation alternatives</a>`, `<a href="${REACTIVATION_PAGE_PATH}">Database Reactivation Agency</a>`)
    .join(" · ");
  return `<section class="framed" id="faq">
  <div class="wrap">
    <div class="section-head center rv"><h2>Questions about lead nurturing automation</h2></div>
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

export const NURTURING_TITLE = "Lead Nurturing Automation: Leads Followed Up For You | distribute.you";
export const NURTURING_DESCRIPTION =
  "Revenue made easy. AI lead nurturing that writes to each lead by email or WhatsApp when they visit, sign up or pay. Free, 0% markup.";

export function renderLeadNurturingAutomationPage(): string {
  const url = `${SITE}${NURTURING_PAGE_PATH}`;
  return shell({
    title: NURTURING_TITLE,
    description: NURTURING_DESCRIPTION,
    path: NURTURING_PAGE_PATH,
    head: nurturingHead(),
    bodyClass: "nurture",
    body: [
      heroHtml(),
      stripHtml(),
      howHtml(),
      contrastHtml(),
      signalsHtml(),
      ownHtml(),
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
        name: "distribute.you AI lead nurturing agent",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url,
        description: NURTURING_DESCRIPTION,
        offers: { "@type": "Offer", price: 0, priceCurrency: "USD", description: "Free. Every action at the API price, 0% markup." },
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: NURTURING_FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: stripTags(f.a) } })),
      },
      breadcrumb([
        { name: "distribute.you", path: "/" },
        { name: "Lead Nurturing Automation", path: NURTURING_PAGE_PATH },
      ]),
    ],
  });
}
