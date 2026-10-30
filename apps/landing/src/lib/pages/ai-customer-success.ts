/**
 * `/ai-customer-success`: the Customer Success AI Agent page (PAGE-AI-CUSTOMER-SUCCESS-1030,
 * owner 2026-10-29).
 *
 * Buyer: the cheap SaaS founder (root CLAUDE.md POSITIONING). Search keyword: "ai customer
 * success" (40 to 50 US searches a month, CPC $69), with "customer success automation" (30).
 * Its Agency twin is `/customer-success-agency` (a company making cash, Book a call); the page
 * links it only once the catalogue serves it (`agencyTwin()`).
 *
 * What it says that no sibling says, read from the live catalogue on 2026-10-30: the leg after
 * "Paid client" is "Paid client → Client Satisfied", run on WhatsApp, started by the "Lead event"
 * trigger (anything a person does: a payment, a visit, a reply). Every send sets the customer's
 * next follow-up date, so a customer who goes quiet hears from us on that day (the "Follow-up
 * Due" trigger); a customer who writes in ("Message Received", WhatsApp or email) is answered.
 * The outcome counted is "Client Satisfied": a paying customer writes a message that reads
 * positive, counted once. A support bot answers tickets; this agent writes first.
 * No figure of ours on this leg: it has no fleet history yet, so the page states none.
 *
 * Every figure is READ at render, never typed here:
 * - `__HOT_LEAD_ROW__` / `__HOT_LEAD_BAND__`: the fleet's engaged leads and costs
 *   (static-html.ts `withHotLeadStats`, the reads the homepage hero states);
 * - `<!--action-prices-->`: the live price of each kind of action, from the cost catalogue;
 * - the tool rows: `cs-tools.ts`, each figure read on the tool's own site and dated.
 * The hero feed is a product preview: roles, never a person, no figure.
 *
 * Signature motion (refs #17, oxygen's post marquee, LIGHT and vertical): a feed of WhatsApp
 * moments with paying customers rolls upward on a white card, pauses on hover and on its own
 * toggle (motion.js `marquee` with `data-motion-axis="y"`). The Agency twin plays a dark
 * sideways post reel; this one is a light customer feed.
 * Styles: `public/landing/v2/ai-customer-success.css`, after agent.css and ai-sdr.css.
 *
 * Alias-free: the unit tests render it directly.
 */
import { AI_CS_ALTERNATIVES_PATH, AI_CS_PAGE_PATH, CS_TOOLS, OUR_AI_CS_ROW, aiCsVsPath } from "../cs-tools";
import { livePages } from "../site-pages";
import { SITE, SIGN_UP, WHY, breadcrumb, esc, shell } from "../v2-shell";
import { AGENT_CSS_VERSION, AI_SDR_CSS_VERSION, quotesHtml } from "./ai-sdr";

export const CS_CSS_VERSION = 1;

const LOGO = (domain: string, size = 28) =>
  `<img src="https://img.logo.dev/${domain}?token=pk_J1iY4__HSfm9acHjR8FibA&size=64&format=png" alt="" width="${size}" height="${size}">`;

const ARROW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';
const TICKS = '<svg class="acs-ticks" viewBox="0 0 18 12" aria-hidden="true"><path d="M1 6.5l3 3 6.5-7.5M7.5 9.5l1 1 6.5-8.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

/** The page's stylesheets: the AI Agent layers, then this page's own. */
export function csHead(): string {
  return `<link rel="stylesheet" href="/landing/v2/agent.css?v=${AGENT_CSS_VERSION}">
<link rel="stylesheet" href="/landing/v2/ai-sdr.css?v=${AI_SDR_CSS_VERSION}">
<link rel="stylesheet" href="/landing/v2/ai-customer-success.css?v=${CS_CSS_VERSION}">`;
}

/** The Customer Success Agency page, once the catalogue serves it (a sibling ships it). */
export function agencyTwin(): { path: string } | undefined {
  return livePages("agency").find((p) => p.outcome === "customer-success");
}

/** The tools a founder plugs (connectors every client can plug), and what the agent reads in each. */
export const CONNECTORS = [
  { name: "Stripe", domain: "stripe.com", reads: "Who pays, renews or stops" },
  { name: "Clerk", domain: "clerk.com", reads: "Who has an account" },
  { name: "PostHog", domain: "posthog.com", reads: "Who comes back to your site" },
  { name: "GoHighLevel", domain: "gohighlevel.com", reads: "Your contacts and stages" },
] as const;

// ---------------------------------------------------------------------------
// Hero: a feed of WhatsApp moments with paying customers
// ---------------------------------------------------------------------------

export type Moment = {
  /** A role, never a person. */
  who: string;
  initials: string;
  /** What the customer did, and where we read it. */
  signal: string;
  source: { name: string; domain?: string };
  us: string;
  them?: string;
  /** The customer wrote back happy: counted once as Client Satisfied. */
  satisfied?: boolean;
};

/** The feed the hero rolls (motion.js `marquee`, upward). A product preview, no figure. */
export const MOMENTS: readonly Moment[] = [
  {
    who: "Founder, design studio",
    initials: "FD",
    signal: "First payment",
    source: { name: "Stripe", domain: "stripe.com" },
    us: "Welcome aboard! Want a hand with your setup this week?",
    them: "Yes please, Thursday works.",
  },
  {
    who: "Head of Sales, fintech",
    initials: "HS",
    signal: "Quiet for three weeks",
    source: { name: "Next check-in date" },
    us: "How are your weekly reports going? Anything I can set up for you?",
    them: "All good, the team loves them!",
    satisfied: true,
  },
  {
    who: "Ops lead, logistics SaaS",
    initials: "OL",
    signal: "Back on your upgrade page",
    source: { name: "PostHog", domain: "posthog.com" },
    us: "Saw you looking at the Team plan. Want a hand adding your teammates?",
  },
  {
    who: "Marketing manager, online store",
    initials: "MM",
    signal: "Stopped paying",
    source: { name: "Stripe", domain: "stripe.com" },
    us: "Sorry to see you go. What changed? Happy to help you get set up again.",
    them: "Budget freeze until January.",
  },
  {
    who: "CTO, healthtech",
    initials: "CT",
    signal: "Renewed for a year",
    source: { name: "Stripe", domain: "stripe.com" },
    us: "Thank you for another year! Here is what is new since you joined.",
    them: "Great, thanks for keeping us posted.",
    satisfied: true,
  },
  {
    who: "Founder, B2B SaaS",
    initials: "FB",
    signal: "Wrote to you",
    source: { name: "WhatsApp", domain: "whatsapp.com" },
    us: "Yes, you can export everything from Settings. Want me to show you?",
  },
];

function momentHtml(m: Moment): string {
  const src = m.source.domain ? LOGO(m.source.domain, 14) : `<span class="acs-clock">${CLOCK}</span>`;
  return `<article class="acs-moment">
          <header><span class="acs-av" aria-hidden="true">${esc(m.initials)}</span><b>${esc(m.who)}</b></header>
          <p class="acs-signal">${src}<span>${esc(m.signal)}</span><small>${esc(m.source.name)}</small></p>
          <div class="acs-bubble us"><p>${esc(m.us)}</p><span class="acs-meta">${TICKS}</span></div>${
            m.them ? `\n          <div class="acs-bubble them"><p>${esc(m.them)}</p></div>` : ""
          }${m.satisfied ? `\n          <span class="acs-happy"><i aria-hidden="true"></i>Client satisfied</span>` : ""}
        </article>`;
}

export function stageHtml(moments: readonly Moment[] = MOMENTS): string {
  return `<div class="acs-stage" role="img" aria-label="A feed of WhatsApp messages our AI agent writes to paying customers when they pay, come back, stop paying or go quiet; happy replies count as satisfied customers">
      <div class="acs-top">
        <img src="https://www.google.com/s2/favicons?domain=whatsapp.com&sz=64" alt="" width="20" height="20">
        <div><b>Your paying customers</b><small><i></i>Agent on WhatsApp</small></div>
        <button class="acs-pause" type="button" data-motion-pause="acs-feed" aria-pressed="false" aria-label="Pause the feed" hidden><span class="p" aria-hidden="true"></span></button>
      </div>
      <div class="acs-feed" id="acs-feed" data-motion="marquee" data-motion-axis="y" data-motion-speed="38">
        ${moments.map(momentHtml).join("\n        ")}
      </div>
      <p class="acs-foot">Each happy reply counts as a satisfied customer.</p>
    </div>`;
}

function heroHtml(): string {
  const twin = agencyTwin();
  return `<section class="hero hero-agent hero-cs">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <div class="hero-grid">
      <div class="hero-copy">
        __HOT_LEAD_ROW__

        <span class="eyebrow why-eyebrow">${WHY}</span>
        <h1>AI Customer Success<br><span class="accent">Customers Kept Happy For You</span>
          <span class="sub">Our AI customer success agent writes to each paying customer on WhatsApp when they pay, come back, stop paying or go quiet.</span>
        </h1>

        <div class="pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 6.5 7 .9-5.1 4.8 1.3 7-6.2-3.4-6.2 3.4 1.3-7L2 9.4l7-.9z"/></svg>Free for one user. Every message at the API price, 0% markup.</div>

        <form class="launch" action="${SIGN_UP}" method="get" id="hero-form">
          <div class="launch-field">
            <input id="hero-website" name="url" type="text" autocomplete="off" placeholder="Paste your website, e.g., acme.com">
            <button class="btn btn-accent" type="submit"><span>Start free</span>${ARROW}</button>
          </div>
        </form>
        <ul class="acs-plugs" aria-label="Tools you can connect">${CONNECTORS.map((c) => `<li>${LOGO(c.domain, 16)}${esc(c.name)}</li>`).join("")}</ul>
        <div class="hero-links">
          <a class="no-site" href="#compare">Compare customer success tools</a>
          <a class="no-site" href="#agent">Use it from Claude Code or Grok</a>${
            twin ? `\n          <a class="no-site" href="${twin.path}">Want our team on it? Customer Success Agency</a>` : ""
          }
        </div>
      </div>

      ${stageHtml()}
    </div>

    <div class="faces faces-showcase acs-faces">
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
      <li><b>$0</b><span>for one user, hosted by us</span></li>
      <li><b>$9</b><span>per user for teams</span></li>
      <li><b>MIT</b><span>open source, run it yourself</span></li>
    </ul>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// How it keeps customers: four steps
// ---------------------------------------------------------------------------

function howHtml(): string {
  const plugs = CONNECTORS.map((c) => `<div class="acs-plug">${LOGO(c.domain, 18)}<span>${esc(c.name)}</span><em>Connected</em></div>`).join("");
  return `<section class="framed" id="how">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">How it keeps customers</span>
      <h2 style="margin-top:16px">From a payment to a happy customer.</h2>
      <p>Customer success automation that starts the day a customer pays. You plug your tools once; the agent checks in for you every day.</p>
    </div>
    <div class="sdr-job">
      <svg class="sdr-beam" data-motion="beams" viewBox="0 0 1000 4" preserveAspectRatio="none" aria-hidden="true"><path d="M0 2 H1000" stroke="#2563eb" stroke-width="2" fill="none" vector-effect="non-scaling-stroke"/></svg>
      <ol class="sdr-steps" data-motion="reveal" data-motion-stagger>
        <li class="sdr-step">
          <span class="sdr-n">1</span>
          <h3>Plug your tools</h3>
          <p>Connect Stripe, Clerk, PostHog or GoHighLevel in a few clicks.</p>
          <div class="sdr-vis acs-plugs-v" aria-hidden="true">${plugs}</div>
        </li>
        <li class="sdr-step">
          <span class="sdr-n">2</span>
          <h3>Sees every customer</h3>
          <p>Each payment, visit and message lands on the customer&apos;s timeline.</p>
          <div class="sdr-vis" aria-hidden="true">
            <div class="sdr-lead"><span class="av"></span><div>First payment<small>Stripe</small></div><em class="acs-new">New</em></div>
            <div class="sdr-lead"><span class="av"></span><div>Back on pricing<small>PostHog</small></div><em class="acs-new">New</em></div>
            <div class="sdr-lead"><span class="av"></span><div>Stopped paying<small>Stripe</small></div><em class="acs-new">New</em></div>
          </div>
        </li>
        <li class="sdr-step">
          <span class="sdr-n">3</span>
          <h3>Writes on WhatsApp</h3>
          <p>One message for one customer, about what they just did. Replies are answered.</p>
          <div class="sdr-vis" aria-hidden="true">
            <div class="acs-mini"><span>${LOGO("whatsapp.com", 14)}WhatsApp</span>Welcome aboard! Want a hand with your setup this week?</div>
            <div class="acs-mini them">Yes please, Thursday works.</div>
          </div>
        </li>
        <li class="sdr-step">
          <span class="sdr-n">4</span>
          <h3>Checks in again</h3>
          <p>Every customer keeps a next check-in date, so a quiet one is never forgotten.</p>
          <div class="sdr-vis" aria-hidden="true">
            <div class="acs-date"><span>Next check-in</span><b>Monday 9:00</b></div>
            <div class="acs-date happy"><span>Wrote back happy</span><b>Client satisfied</b></div>
          </div>
        </li>
      </ol>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// A support bot vs our customer success agent
// ---------------------------------------------------------------------------

export const CONTRAST_ROWS: { topic: string; bot: string; agent: string }[] = [
  { topic: "Who starts", bot: "The customer, when something is wrong", agent: "Our agent, when the customer pays, comes back or goes quiet" },
  { topic: "What it says", bot: "Answers from your help center", agent: "One message about what this customer just did" },
  { topic: "Where", bot: "Your chat widget and ticket inbox", agent: "WhatsApp, where your customers already read" },
  { topic: "What it counts", bot: "Tickets resolved", agent: "Customers who write back happy" },
  { topic: "Who builds it", bot: "You write the articles and the rules", agent: "Nobody. You plug your tools and the agent decides" },
];

function contrastHtml(): string {
  const rows = CONTRAST_ROWS.map(
    (r) => `<tr><th scope="row">${esc(r.topic)}</th><td>${esc(r.bot)}</td><td class="ours">${esc(r.agent)}</td></tr>`,
  ).join("");
  return `<section class="framed tint" id="support">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">It writes first</span>
      <h2 style="margin-top:16px">A support bot waits for a ticket. Our agent checks in first.</h2>
      <p>Keep your helpdesk for questions. Let our agent look after every customer in between.</p>
    </div>
    <div class="sdr-table-wrap" data-motion="reveal">
      <table class="sdr-table acs-contrast">
        <thead><tr><th scope="col"></th><th scope="col">A support bot</th><th scope="col">Our AI customer success agent</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// The moments it acts on
// ---------------------------------------------------------------------------

export const MOMENT_CARDS = [
  { tool: "Stripe", domain: "stripe.com", moment: "Pays for the first time", action: "Welcomes them and offers a hand with the setup." },
  { tool: "Stripe", domain: "stripe.com", moment: "Renews, or stops paying", action: "Thanks a loyal customer, or asks a leaving one what changed." },
  { tool: "PostHog", domain: "posthog.com", moment: "Comes back to your pricing page", action: "Offers help with the plan they looked at." },
  { tool: "Next check-in date", domain: "", moment: "Goes quiet", action: "Checks in on the day set after the last message." },
  { tool: "WhatsApp or email", domain: "whatsapp.com", moment: "Writes to you", action: "Answers fast, while you are still on their mind." },
];

function momentsHtml(): string {
  const cards = MOMENT_CARDS.map(
    (s) =>
      `<li class="acs-card">${s.domain ? LOGO(s.domain, 24) : `<span class="acs-clock big">${CLOCK}</span>`}<div><small>${esc(s.tool)}</small><h3>${esc(s.moment)}</h3><p>${esc(s.action)}</p></div></li>`,
  ).join("");
  return `<section class="framed" id="moments">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Moments it acts on</span>
      <h2 style="margin-top:16px">Every moment that keeps a customer.</h2>
      <p>The agent reads the tools you already use, then writes to the right customer at the right time.</p>
    </div>
    <ul class="acs-cards" data-motion="reveal" data-motion-stagger>${cards}</ul>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// What we count: happy customers
// ---------------------------------------------------------------------------

function countHtml(): string {
  return `<section class="framed tint" id="happy">
  <div class="wrap acs-own" data-motion="reveal">
    <div>
      <span class="eyebrow">What it counts</span>
      <h2 style="margin-top:16px">We count happy customers.</h2>
      <p>A paying customer who writes back a positive message counts once as a satisfied customer, in your campaign results.</p>
    </div>
    <ul class="acs-own-list">
      <li><b>Starts at the first payment</b><span>Every paying customer is looked after from day one.</span></li>
      <li><b>A next date for every customer</b><span>Set after each message, then served on the day.</span></li>
      <li><b>Stops when they ask</b><span>Anyone who asks to stop is never written to again.</span></li>
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
        <h3>Your customers stay yours</h3>
        <p>Run the open source version on your own server with your own keys. Your customers and their history stay in your own database.</p>
        <h3 class="byok-2">Your balance is the cap</h3>
        <p>Hosted accounts run on a prepaid balance. Auto reload tops it up at the level you choose.</p>
      </aside>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Customer success tools side by side, read from their own sites
// ---------------------------------------------------------------------------

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function verifiedLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function compareHtml(): string {
  const newest = CS_TOOLS.map((t) => t.verifiedOn).sort().at(-1) ?? "";
  const rows = CS_TOOLS.map(
    (t) =>
      `<tr><th scope="row"><a href="${aiCsVsPath(t)}">${LOGO(t.logoDomain ?? t.domain, 20)}${esc(t.name)}</a></th><td>${esc(t.entryPrice)}</td><td>${esc(t.aiAgent)}</td><td><a class="sdr-vs" href="${aiCsVsPath(t)}">distribute.you vs ${esc(t.name)}</a></td></tr>`,
  ).join("");
  const sources = CS_TOOLS.map((t) => `<a href="${esc(t.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(t.name)}</a>`).join(", ");
  return `<section class="framed tint" id="compare">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Customer success tools compared</span>
      <h2 style="margin-top:16px">The AI that checks in before a customer asks.</h2>
      <p>Each of these is great at answering the customers who write in. Ours writes to every customer first.</p>
    </div>
    <div class="sdr-table-wrap" data-motion="reveal">
      <table class="sdr-table">
        <thead><tr><th scope="col">Tool</th><th scope="col">Price on their site</th><th scope="col">Their AI agent</th><th scope="col"></th></tr></thead>
        <tbody>
          <tr class="ours"><th scope="row"><a href="${AI_CS_PAGE_PATH}"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="20" height="20">distribute.you</a></th><td>Free for one user</td><td>${esc(OUR_AI_CS_ROW.aiAgent)}</td><td><a class="sdr-vs" href="${SIGN_UP}">Start free</a></td></tr>
          ${rows}
        </tbody>
      </table>
    </div>
    <p class="stack-source">Read on each site on ${esc(verifiedLabel(newest))}: ${sources}. Gainsight, Vitally and ChurnZero publish no price. <a href="${AI_CS_ALTERNATIVES_PATH}">Every AI customer success alternative</a>.</p>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Plans, agent, FAQ
// ---------------------------------------------------------------------------

function plansHtml(): string {
  const twin = agencyTwin();
  return `<section class="framed tint tint-both" id="pricing">
  <div class="wrap">
    <div class="section-head center rv">
      <span class="eyebrow">Pricing</span>
      <h2 style="margin-top:16px">Pay for the messages, never for your customers.</h2>
      <p>The same agent and the same features on every plan. Pause or cancel anytime.</p>
    </div>
    <div class="plans plans-3">
      <article class="plan rv">
        <span class="plan-tag"><i></i>Open source</span>
        <div class="plan-price">Free<small>on your server</small></div>
        <p class="plan-desc">Run your customer success agent yourself and keep every customer record.</p>
        <a class="btn btn-outline btn-lg" href="https://github.com/distribute-you/gtm-factory" target="_blank" rel="noopener">View the code</a>
        <div class="plan-included">What's included</div>
        <ul>
          <li><i></i>MIT license, every line on GitHub</li>
          <li><i></i>Your customers and their history in your own database</li>
          <li><i></i>Your own API keys, billed by each vendor</li>
        </ul>
      </article>
      <article class="plan featured rv">
        <span class="plan-tag"><i></i>Hosted</span>
        <div class="plan-price">Free<small>for one user</small></div>
        <p class="plan-desc">We host it. You pay each message at the API price.</p>
        <a class="btn btn-accent btn-lg" href="${SIGN_UP}">Start free</a>
        <div class="plan-included">What's included</div>
        <ul>
          <li><i></i>Every action at the vendor's API price, 0% markup</li>
          <li><i></i>Stripe, Clerk, PostHog and GoHighLevel connectors</li>
          <li><i></i>WhatsApp messages to your paying customers</li>
          <li><i></i>Our AI agent talks with you on WhatsApp</li>
          <li><i></i>A prepaid balance: start with $10, auto reload keeps it going</li>
        </ul>
      </article>
      <article class="plan rv">
        <span class="plan-tag"><i></i>Team</span>
        <div class="plan-price">$9<small>per user, each month</small></div>
        <p class="plan-desc">Your whole team on the same customers and threads.</p>
        <a class="btn btn-outline btn-lg" href="${SIGN_UP}">Start free</a>
        <div class="plan-included">What's included</div>
        <ul>
          <li><i></i>Everything in Hosted</li>
          <li><i></i>Every teammate sees every customer and message</li>
          <li><i></i>The same API prices, 0% markup</li>
        </ul>
      </article>
    </div>${
      twin
        ? `
    <a class="agency-bridge rv" href="${twin.path}">
      <span><b>Want our team to look after your customers?</b> The Customer Success Agency runs it with you. From $1K/month + 10% of budget.</span>
      <em>See the Customer Success Agency</em>
    </a>`
        : ""
    }
  </div>
</section>`;
}

function agentHtml(): string {
  return `<section class="framed" id="agent">
  <div class="wrap">
    <div class="agent-grid">
      <div class="section-head" data-motion="reveal">
        <span class="eyebrow">Works from your own agent</span>
        <h2 style="margin-top:16px">Ask your agent to check in.</h2>
        <p>Run our AI customer success agent from Claude Code, Grok or any agent that speaks MCP. Same agent, same API prices.</p>
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
          <pre><code>claude mcp add --transport http distribute https://mcp.distribute.you/mcp --header "Authorization: Bearer distrib.usr_YOUR_KEY"</code></pre>
        </div>
        <div class="copy-box">
          <div class="copy-head"><span>Then ask</span><button class="copy-btn" type="button" data-copy>Copy</button></div>
          <pre><code>Look after the paying customers of acme.com. Write to each one on WhatsApp when they pay, come back or go quiet, and tell me who writes back happy.</code></pre>
        </div>
      </div>
    </div>
  </div>
</section>`;
}

/** The FAQ: answers in HTML for the page, the same text without tags for the JSON-LD. */
export function csFaq(): { q: string; a: string }[] {
  const twin = agencyTwin();
  return [
    {
      q: "What is AI customer success?",
      a: "AI customer success means looking after every paying customer without doing it by hand. Ours is an AI agent: it sees what each customer does, writes to them on WhatsApp at the right moment, and answers their replies.",
    },
    {
      q: "What is customer success automation?",
      a: "Checking in with customers on time, every time, with no one keeping a list. Our agent sets a next check-in date after each message, so a quiet customer hears from you on that day.",
    },
    {
      q: "When does the agent write to a customer?",
      a: "When they pay for the first time, come back to your site, renew, stop paying, write to you, or reach their next check-in date. Anyone who asks to stop is never written to again.",
    },
    {
      q: "Which tools does it connect to?",
      a: "Stripe for payments, Clerk for accounts, PostHog for site visits and GoHighLevel for your contacts and stages. Every client can plug them in a few clicks.",
    },
    {
      q: "Which channel does it write on?",
      a: "WhatsApp, where your customers already read. When a customer writes to you on WhatsApp or by email, the agent reads it and answers.",
    },
    {
      q: "How do I know it works?",
      a: "Every positive message from a paying customer counts once as a satisfied customer, in your campaign results.",
    },
    {
      q: "What is the price?",
      a: 'The agent is free for one user, and $9 per user each month for a team. Each message is billed at the vendor\'s API price with 0% markup, from a prepaid balance you start with $10. Every price is on our <a href="/catalog">catalog</a>.',
    },
    {
      q: "Can I run it on my own server?",
      a: 'Yes. The <a href="https://github.com/distribute-you/gtm-factory" target="_blank" rel="noopener">GTM Factory</a> behind it is open source under the MIT license. Run it with your own API keys, and your customers stay in your own database.',
    },
    {
      q: "How is it different from Intercom, Zendesk, HubSpot Service Hub or Freshdesk?",
      a: `Their AI agents answer the customers who write in. Ours writes to every customer first, on WhatsApp. Keep your helpdesk; each comparison is on its own page: ${CS_TOOLS.map((t) => `<a href="${aiCsVsPath(t)}">${esc(t.name)}</a>`).join(", ")}.`,
    },
    ...(twin
      ? [
          {
            q: "Can your team run it for me?",
            a: `Yes. Our <a href="${twin.path}">Customer Success Agency</a> connects your tools and looks after every paying customer with you, from $1K a month plus 10% of budget.`,
          },
        ]
      : []),
  ];
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, "");

function faqHtml(faq: { q: string; a: string }[]): string {
  const twin = agencyTwin();
  const items = faq
    .map(
      (f, i) => `<div class="faq-item${i === 0 ? " open" : ""}">
        <button class="faq-q" type="button" aria-expanded="${i === 0}">${esc(f.q)}${PLUS}</button>
        <div class="faq-a"><p>${f.a}</p></div>
      </div>`,
    )
    .join("\n      ");
  const links = CS_TOOLS.map((t) => `<a href="${aiCsVsPath(t)}">distribute.you vs ${esc(t.name)}</a>`)
    .concat(`<a href="${AI_CS_ALTERNATIVES_PATH}">AI customer success alternatives</a>`, ...(twin ? [`<a href="${twin.path}">Customer Success Agency</a>`] : []))
    .join(" · ");
  return `<section class="framed" id="faq">
  <div class="wrap">
    <div class="section-head center rv"><h2>Questions about AI customer success</h2></div>
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

export const CS_TITLE = "AI Customer Success: Customers Kept Happy For You | distribute.you";
export const CS_DESCRIPTION =
  "Revenue made easy. AI customer success that writes to each paying customer on WhatsApp when they pay, come back or go quiet. Free for one user, 0% markup.";

export function renderAiCustomerSuccessPage(): string {
  const url = `${SITE}${AI_CS_PAGE_PATH}`;
  const faq = csFaq();
  return shell({
    title: CS_TITLE,
    description: CS_DESCRIPTION,
    path: AI_CS_PAGE_PATH,
    head: csHead(),
    bodyClass: "cs-agent",
    body: [
      heroHtml(),
      stripHtml(),
      howHtml(),
      contrastHtml(),
      momentsHtml(),
      countHtml(),
      "__HOT_LEAD_BAND__",
      pricesHtml(),
      compareHtml(),
      quotesHtml(),
      plansHtml(),
      agentHtml(),
      faqHtml(faq),
    ].join("\n\n"),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "distribute.you AI customer success agent",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url,
        description: CS_DESCRIPTION,
        offers: { "@type": "Offer", price: 0, priceCurrency: "USD", description: "Free for one user. Every action at the API price, 0% markup." },
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: stripTags(f.a) } })),
      },
      breadcrumb([
        { name: "distribute.you", path: "/" },
        { name: "AI Customer Success", path: AI_CS_PAGE_PATH },
      ]),
    ],
  });
}
