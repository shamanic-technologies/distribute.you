/**
 * `/signup-automation`: the Signups AI Agent page (PAGE-SIGNUP-AUTOMATION-1030, owner 2026-10-29).
 *
 * Buyer: the cheap SaaS founder whose product needs signups (root CLAUDE.md POSITIONING). Search
 * keywords: "signup automation" and "user acquisition automation" (no measured US volume, so the
 * title also speaks to "get more signups"). Its Agency twin is `/user-acquisition-agency`.
 *
 * What runs, read on the live catalogue on 2026-10-30 (`/v1/catalogue/pipes?q=signup`,
 * `/v1/triggers`), and nothing else is claimed:
 * - Sales Cold Email Outreach: Lead → Website visit (measured);
 * - Cold WhatsApp Outreach: Start → Signup, and Signup → Paid client;
 * - AI Follow-up Email: Website visit → Signup, and Signup → Paid client;
 * - triggers Website visit, Visit Without Signup In 30 Min, Signup, Signup Not Paid In 30 Min,
 *   Signup Not Paid In 24 Hours, Paid client; the facts come from connectors every client can
 *   plug (PostHog, Clerk, Stripe).
 * No index measures a signup yet and no showcase client has one, so the page states no signup
 * figure of ours: the fleet band (`__HOT_LEAD_BAND__`) and the live action prices
 * (`<!--action-prices-->`) are the only served figures; the competitor rows are read on each
 * tool's own site (`signup-tools.ts`).
 *
 * Signature motion (refs #13, explee rolling numbers, LIGHT variant): a signups board for
 * yourcompany.com whose counters roll odometer style as each event of the feed lands (motion.js
 * `signup-roll`). A product preview: roles, never a person; each counter's total is the count of
 * the rows shown under it. The HTML is the final state. Styles: `public/landing/v2/signups.css`,
 * after agent.css and ai-sdr.css.
 *
 * Alias-free: the unit tests render it directly.
 */
import {
  OUR_SIGNUP_ROW,
  SIGNUP_ALTERNATIVES_PATH,
  SIGNUP_PAGE_PATH,
  SIGNUP_TOOLS,
  signupVsPath,
} from "../signup-tools";
import { SITE_PAGES } from "../site-pages";
import { SITE, SIGN_UP, WHY, breadcrumb, esc, shell } from "../v2-shell";
import { AGENT_CSS_VERSION, AI_SDR_CSS_VERSION, quotesHtml } from "./ai-sdr";

export const SIGNUPS_CSS_VERSION = 1;

const LOGO = (domain: string, size = 28) =>
  `<img src="https://img.logo.dev/${domain}?token=pk_J1iY4__HSfm9acHjR8FibA&size=64&format=png" alt="" width="${size}" height="${size}">`;

const ARROW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';

/** The AI Agent stylesheets, then the Signups layer (shared with the Agency twin). */
export function signupHead(): string {
  return `<link rel="stylesheet" href="/landing/v2/agent.css?v=${AGENT_CSS_VERSION}">
<link rel="stylesheet" href="/landing/v2/ai-sdr.css?v=${AI_SDR_CSS_VERSION}">
<link rel="stylesheet" href="/landing/v2/signups.css?v=${SIGNUPS_CSS_VERSION}">`;
}

/** The Agency twin, linked only while its catalogue entry is live. */
export function signupAgencyTwin(): string | null {
  return SITE_PAGES.find((p) => p.outcome === "signups" && p.buyer === "agency" && p.live)?.path ?? null;
}

/** The connectors that tell the agent who visited, signed up and paid (every client can plug them). */
export const SIGNUP_CONNECTORS = [
  { name: "PostHog", domain: "posthog.com", reads: "Who visited your site" },
  { name: "Clerk", domain: "clerk.com", reads: "Who signed up" },
  { name: "Stripe", domain: "stripe.com", reads: "Who paid" },
] as const;

// ---------------------------------------------------------------------------
// The signups board: counters that roll as each event lands
// ---------------------------------------------------------------------------

export type CounterKey = "visits" | "signups" | "paid";

export type FeedRow = {
  /** The catalogue event the row is (a trigger's name). */
  tag: string;
  /** A role and a company type, never a person. */
  who: string;
  what: string;
  /** The tool or channel it came through. */
  via: string;
  domain?: string;
  adds?: CounterKey;
};

/** The hero's feed, in order. Each counter's total is the number of rows that add to it. */
export const FEED: readonly FeedRow[] = [
  { tag: "Website visit", who: "Head of Growth, B2B SaaS", what: "Clicked through from a cold email", via: "PostHog", domain: "posthog.com", adds: "visits" },
  { tag: "No signup in 30 min", who: "Head of Growth, B2B SaaS", what: "A short follow-up email went out", via: "Email" },
  { tag: "Signup", who: "Head of Growth, B2B SaaS", what: "Created an account", via: "Clerk", domain: "clerk.com", adds: "signups" },
  { tag: "Website visit", who: "CTO, fintech", what: "Read your pricing page", via: "PostHog", domain: "posthog.com", adds: "visits" },
  { tag: "Signup", who: "Founder, dev tools", what: "Replied on WhatsApp, then signed up", via: "Clerk", domain: "clerk.com", adds: "signups" },
  { tag: "Not paid in 24 hours", who: "Head of Growth, B2B SaaS", what: "A WhatsApp message went out", via: "WhatsApp" },
  { tag: "Paid client", who: "Head of Growth, B2B SaaS", what: "Started a paid plan", via: "Stripe", domain: "stripe.com", adds: "paid" },
];

const COUNTER_LABELS: Record<CounterKey, string> = { visits: "Website visits", signups: "Signups", paid: "Paid users" };

export function counterTotals(feed: readonly FeedRow[]): Record<CounterKey, number> {
  const t: Record<CounterKey, number> = { visits: 0, signups: 0, paid: 0 };
  for (const r of feed) if (r.adds) t[r.adds] += 1;
  return t;
}

const DOT = '<span class="su-mark" aria-hidden="true"></span>';

/**
 * The board (motion.js `signup-roll`). `tone` picks the light card (AI Agent) or the dark slab
 * (Agency); the feed differs per page so the two are never the same preview.
 */
export function boardHtml(feed: readonly FeedRow[], opts: { tone: "light" | "dark"; title: string; note: string }): string {
  const totals = counterTotals(feed);
  const counters = (["visits", "signups", "paid"] as const)
    .map(
      (k) =>
        `<div class="su-count${k === "signups" ? " main" : ""}"><span class="su-num" data-roll="${k}">${totals[k]}</span><small>${esc(COUNTER_LABELS[k])}</small></div>`,
    )
    .join("");
  const rows = feed
    .map(
      (r) =>
        `<li class="su-row${r.adds ? ` adds-${r.adds}` : ""}" data-beat${r.adds ? ` data-adds="${r.adds}"` : ""}>
          <span class="su-via">${r.domain ? LOGO(r.domain, 18) : DOT}</span>
          <div class="su-what"><b>${esc(r.tag)}</b><span>${esc(r.who)}. ${esc(r.what)}</span></div>
          <em>${esc(r.via)}</em>
        </li>`,
    )
    .join("\n        ");
  return `<div class="su-board su-${opts.tone}" data-motion="signup-roll">
      <div class="su-board-h"><span class="live"><i></i>${esc(opts.title)}</span><span class="su-today">Today</span></div>
      <div class="su-counts">${counters}</div>
      <ol class="su-feed">
        ${rows}
      </ol>
      <p class="su-note">${esc(opts.note)}</p>
    </div>`;
}

function heroHtml(): string {
  const twin = signupAgencyTwin();
  return `<section class="hero hero-agent hero-signups">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <div class="hero-grid">
      <div class="hero-copy">
        __HOT_LEAD_ROW__

        <span class="eyebrow why-eyebrow">${WHY}</span>
        <h1>Signup Automation<br><span class="accent">Done For You</span>
          <span class="sub">Our AI agent brings the right buyers to your product, then follows every signup until they pay.</span>
        </h1>

        <div class="pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 6.5 7 .9-5.1 4.8 1.3 7-6.2-3.4-6.2 3.4 1.3-7L2 9.4l7-.9z"/></svg>Free for one user. Every action at the API price, 0% markup.</div>

        <form class="launch" action="${SIGN_UP}" method="get" id="hero-form">
          <div class="launch-field">
            <input id="hero-website" name="url" type="text" autocomplete="off" placeholder="Paste your website, e.g., acme.com">
            <button class="btn btn-accent" type="submit"><span>Start free</span>${ARROW}</button>
          </div>
        </form>
        <div class="hero-links">
          <a class="no-site" href="#path">How it gets you signups</a>
          <a class="no-site" href="#agent">Use it from Claude Code or Grok</a>${
            twin ? `\n          <a class="no-site" href="${twin}">Want our team on it? User Acquisition Agency</a>` : ""
          }
        </div>
      </div>

      <div class="su-stage" aria-label="A preview of the signup agent for yourcompany.com: each visit, signup and payment lands in the feed and rolls its counter up by one">
        ${boardHtml(FEED, { tone: "light", title: "Signup agent for yourcompany.com", note: "A preview of the feed. Roles, never real people." })}
      </div>
    </div>
  </div>
</section>`;
}

function stripHtml(): string {
  return `<section class="offer-strip" aria-label="The offer">
  <div class="wrap">
    <ul class="strip" data-motion="reveal" data-motion-stagger>
      <li><b>0%</b><span>markup on every action</span></li>
      <li><b>$0</b><span>for one user, hosted by us</span></li>
      <li><b>$9</b><span>per user for teams</span></li>
      <li><b>MIT</b><span>open source, run it yourself</span></li>
    </ul>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// The path: the four legs that run, as the catalogue names them
// ---------------------------------------------------------------------------

export type Leg = { from: string; to: string; channel: string; title: string; line: string; trigger: string | null };

export const LEGS: readonly Leg[] = [
  {
    from: "Start",
    to: "Website visit",
    channel: "Cold email",
    title: "Buyers reach your site",
    line: "Each email is written for one buyer and sent from our warmed domains, with a link to your product.",
    trigger: null,
  },
  {
    from: "Start",
    to: "Signup",
    channel: "WhatsApp",
    title: "Buyers try your product",
    line: "A short WhatsApp message invites the buyer to sign up, and the agent answers every reply.",
    trigger: null,
  },
  {
    from: "Website visit",
    to: "Signup",
    channel: "Follow-up email",
    title: "Visitors come back",
    line: "Someone read your site and left. Thirty minutes later, a short email brings them back.",
    trigger: "Visit without signup in 30 min",
  },
  {
    from: "Signup",
    to: "Paid client",
    channel: "Email or WhatsApp",
    title: "Signups become paying users",
    line: "Signed up but not paid after 30 minutes, then after 24 hours? The agent writes, helps and answers.",
    trigger: "Signup not paid in 30 min or 24 hours",
  },
];

function pathHtml(): string {
  const cards = LEGS.map(
    (l, i) => `<li class="su-leg">
        <span class="su-leg-n">${i + 1}</span>
        <div class="su-leg-route"><span>${esc(l.from)}</span>${ARROW}<span class="to">${esc(l.to)}</span></div>
        <h3>${esc(l.title)}</h3>
        <p>${esc(l.line)}</p>
        <div class="su-leg-f"><span class="chan">${esc(l.channel)}</span>${l.trigger ? `<span class="trig">Starts on: ${esc(l.trigger)}</span>` : ""}</div>
      </li>`,
  ).join("\n      ");
  return `<section class="framed" id="path">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">User acquisition automation</span>
      <h2>From a first message to a paying user.</h2>
      <p>Four steps run for you, each one on its own. A buyer who visits, signs up or goes quiet always gets the next message.</p>
    </div>
    <ol class="su-legs" data-motion="reveal" data-motion-stagger>
      ${cards}
    </ol>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// The tools it reads
// ---------------------------------------------------------------------------

function toolsHtml(): string {
  const plugs = SIGNUP_CONNECTORS.map(
    (c) => `<li>${LOGO(c.domain, 28)}<div><b>${esc(c.name)}</b><small>${esc(c.reads)}</small></div></li>`,
  ).join("");
  return `<section class="framed tint" id="tools">
  <div class="wrap su-tools">
    <div data-motion="reveal">
      <span class="eyebrow">Plug in three tools</span>
      <h2>The agent sees every visit, signup and payment.</h2>
      <p>Connect PostHog, Clerk and Stripe in a few clicks. Every new signup gets a welcome. Every quiet one gets a follow-up. Nobody who already paid gets a nudge.</p>
    </div>
    <ul class="su-plugs" data-motion="reveal" data-motion-stagger>${plugs}</ul>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// How it runs: four steps
// ---------------------------------------------------------------------------

function howHtml(): string {
  return `<section class="framed" id="how">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">How it runs</span>
      <h2>Paste your website. Watch the signups come in.</h2>
      <p>Signup automation that starts from what already brings signups to other founders.</p>
    </div>
    <div class="sdr-job">
      <svg class="sdr-beam" data-motion="beams" viewBox="0 0 1000 4" preserveAspectRatio="none" aria-hidden="true"><path d="M0 2 H1000" stroke="#2563eb" stroke-width="2" fill="none" vector-effect="non-scaling-stroke"/></svg>
      <ol class="sdr-steps" data-motion="reveal" data-motion-stagger>
        <li class="sdr-step">
          <span class="sdr-n">1</span>
          <h3>Learns your product</h3>
          <p>Reads your website: what you sell, who signs up, and what makes them stay.</p>
        </li>
        <li class="sdr-step">
          <span class="sdr-n">2</span>
          <h3>Finds your next users</h3>
          <p>Picks the people most likely to sign up, from the audiences that work best for products like yours.</p>
        </li>
        <li class="sdr-step">
          <span class="sdr-n">3</span>
          <h3>Invites them in</h3>
          <p>Cold email from our domains and WhatsApp, each message written for one person, each reply answered.</p>
        </li>
        <li class="sdr-step">
          <span class="sdr-n">4</span>
          <h3>Follows up until they pay</h3>
          <p>Every visit and every signup gets its next message. Your budget moves to the emails that bring paying users.</p>
        </li>
      </ol>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Prices, read live
// ---------------------------------------------------------------------------

function pricesHtml(): string {
  return `<section class="framed tint" id="prices">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">The price of a signup</span>
      <h2>Pay for the work, never for a seat.</h2>
      <p>Each tool our agent calls has a public price, read live from our <a href="/catalog">catalog</a>. You pay what the vendor charges, with 0% markup.</p>
    </div>
    <div class="prices-grid">
      <!--action-prices-->
      <aside class="byok" data-motion="reveal">
        <span class="byok-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/></svg></span>
        <h3>Your users stay yours</h3>
        <p>Run the open source version on your own server with your own keys. Your leads and signups stay in your own database.</p>
        <h3 class="byok-2">Your balance is the cap</h3>
        <p>Hosted accounts run on a prepaid balance. Auto reload tops it up at the level you choose.</p>
      </aside>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Signup tools side by side, read from their own sites
// ---------------------------------------------------------------------------

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function verifiedLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function compareHtml(): string {
  const newest = SIGNUP_TOOLS.map((t) => t.verifiedOn).sort().at(-1) ?? "";
  const rows = SIGNUP_TOOLS.map(
    (t) =>
      `<tr><th scope="row"><a href="${signupVsPath(t)}">${LOGO(t.domain, 20)}${esc(t.name)}</a></th><td>${esc(t.entryPrice)}</td><td>${esc(t.how)}</td><td><a class="sdr-vs" href="${signupVsPath(t)}">distribute.you vs ${esc(t.name)}</a></td></tr>`,
  ).join("");
  const sources = SIGNUP_TOOLS.map((t) => `<a href="${esc(t.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(t.name)}</a>`).join(", ");
  return `<section class="framed" id="compare">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Signup tools compared</span>
      <h2>The signup tool that finds new users too.</h2>
      <p>Each of these grows signups from people who already know you. Ours also reaches the buyers who have never heard of you.</p>
    </div>
    <div class="sdr-table-wrap" data-motion="reveal">
      <table class="sdr-table su-table">
        <thead><tr><th scope="col">Tool</th><th scope="col">Price on their site</th><th scope="col">Where signups come from</th><th scope="col"></th></tr></thead>
        <tbody>
          <tr class="ours"><th scope="row"><a href="${SIGNUP_PAGE_PATH}"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="20" height="20">distribute.you</a></th><td>Free for one user. Every action at the API price, 0% markup</td><td>${esc(OUR_SIGNUP_ROW.how)}</td><td><a class="sdr-vs" href="${SIGN_UP}">Start free</a></td></tr>
          ${rows}
        </tbody>
      </table>
    </div>
    <p class="stack-source">Read on each site on ${esc(verifiedLabel(newest))}: ${sources}. <a href="${SIGNUP_ALTERNATIVES_PATH}">Every signup automation alternative</a>.</p>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Plans, agent, FAQ
// ---------------------------------------------------------------------------

function plansHtml(): string {
  const twin = signupAgencyTwin();
  const bridge = twin
    ? `
    <a class="agency-bridge rv" href="${twin}">
      <span><b>Want our team to grow your signups?</b> Our User Acquisition Agency runs it with you. From $1K/month + 10% of budget.</span>
      <em>See the User Acquisition Agency</em>
    </a>`
    : "";
  return `<section class="framed tint tint-both" id="pricing">
  <div class="wrap">
    <div class="section-head center rv">
      <span class="eyebrow">Pricing</span>
      <h2>More signups, at the price of the tools.</h2>
      <p>The same agent and the same features on every plan. Pause or cancel anytime.</p>
    </div>
    <div class="plans plans-3">
      <article class="plan rv">
        <span class="plan-tag"><i></i>Open source</span>
        <div class="plan-price">Free<small>on your server</small></div>
        <p class="plan-desc">Run your signup agent yourself and keep every lead and signup.</p>
        <a class="btn btn-outline btn-lg" href="https://github.com/distribute-you/gtm-factory" target="_blank" rel="noopener">View the code</a>
        <div class="plan-included">What's included</div>
        <ul>
          <li><i></i>MIT license, every line on GitHub</li>
          <li><i></i>Your leads and signups in your own database</li>
          <li><i></i>Your own API keys, billed by each vendor</li>
        </ul>
      </article>
      <article class="plan featured rv">
        <span class="plan-tag"><i></i>Hosted</span>
        <div class="plan-price">Free<small>for one user</small></div>
        <p class="plan-desc">We host it and send from our inboxes. You pay each action at the API price.</p>
        <a class="btn btn-accent btn-lg" href="${SIGN_UP}">Start free</a>
        <div class="plan-included">What's included</div>
        <ul>
          <li><i></i>Every action at the vendor's API price, 0% markup</li>
          <li><i></i>Cold email from our domains, and WhatsApp</li>
          <li><i></i>PostHog, Clerk and Stripe connectors</li>
          <li><i></i>Every signup followed up until they pay</li>
          <li><i></i>A prepaid balance: start with $10, auto reload keeps it going</li>
        </ul>
      </article>
      <article class="plan rv">
        <span class="plan-tag"><i></i>Team</span>
        <div class="plan-price">$9<small>per user, each month</small></div>
        <p class="plan-desc">Your whole team sees every signup and reply.</p>
        <a class="btn btn-outline btn-lg" href="${SIGN_UP}">Start free</a>
        <div class="plan-included">What's included</div>
        <ul>
          <li><i></i>Everything in Hosted</li>
          <li><i></i>Every teammate sees every lead, signup and reply</li>
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
        <h2>Ask your agent for more signups.</h2>
        <p>Run our signup agent from Claude Code, Grok or any agent that speaks MCP. Same agent, same API prices.</p>
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
          <pre><code>Get acme.com more signups. Invite our best buyers by email and WhatsApp, then follow up every visit and signup until they pay.</code></pre>
        </div>
      </div>
    </div>
  </div>
</section>`;
}

/** The FAQ: answers in HTML for the page, the same text without tags for the JSON-LD. */
export function signupFaq(): { q: string; a: string }[] {
  const twin = signupAgencyTwin();
  const vs = SIGNUP_TOOLS.map((t) => `<a href="${signupVsPath(t)}">${esc(t.name)}</a>`).join(", ");
  return [
    {
      q: "What is signup automation?",
      a: "Signup automation gets people to sign up for your product without outreach by hand. Ours is an AI agent: it invites the right buyers, brings them back when they leave, and follows each signup until they pay.",
    },
    {
      q: "What is user acquisition automation?",
      a: "Software that finds new users for your product and moves them to sign up and pay. Our agent covers the whole path: the first message, the visit, the signup and the payment.",
    },
    {
      q: "How does it get me more signups?",
      a: "The agent writes to buyers who fit your product by cold email, from our own domains, and on WhatsApp. When someone visits your site and leaves, a short follow-up brings them back.",
    },
    {
      q: "What happens after someone signs up?",
      a: "A new user who has not paid 30 minutes later gets a message to help. A new user still not paid after 24 hours hears from the agent again, by email or WhatsApp, and every reply gets an answer.",
    },
    {
      q: "Which tools does it connect to?",
      a: "PostHog for visits, Clerk for signups and Stripe for payments. Every client can plug them in a few clicks.",
    },
    {
      q: "How much does signup automation cost?",
      a: 'The agent is free for one user, and $9 per user each month for a team. Each action is billed at the vendor\'s API price with 0% markup, from a prepaid balance you start with $10. Every price is on our <a href="/catalog">catalog</a>.',
    },
    {
      q: "Can I run it from Claude Code or on my own server?",
      a: 'Yes. Add our MCP server to Claude Code, Grok or Cursor, or run the <a href="https://github.com/distribute-you/gtm-factory" target="_blank" rel="noopener">GTM Factory</a> yourself: it is open source under the MIT license.',
    },
    {
      q: "How is it different from Rewardful, ReferralHero, Userpilot or Userlist?",
      a: `They grow signups from people who already know you, or convert the ones you have. Our agent also finds new buyers and writes to them. Each comparison is on its own page: ${vs}.`,
    },
    ...(twin
      ? [
          {
            q: "Can your team run it for me?",
            a: `Yes. Our <a href="${twin}">User Acquisition Agency</a> grows your signups with our team and our agents, from $1K/month + 10% of budget.`,
          },
        ]
      : []),
  ];
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, "");

function faqHtml(): string {
  const items = signupFaq()
    .map(
      (f, i) => `<div class="faq-item${i === 0 ? " open" : ""}">
        <button class="faq-q" type="button" aria-expanded="${i === 0}">${esc(f.q)}${PLUS}</button>
        <div class="faq-a"><p>${f.a}</p></div>
      </div>`,
    )
    .join("\n      ");
  const twin = signupAgencyTwin();
  const links = SIGNUP_TOOLS.map((t) => `<a href="${signupVsPath(t)}">distribute.you vs ${esc(t.name)}</a>`)
    .concat(`<a href="${SIGNUP_ALTERNATIVES_PATH}">Signup automation alternatives</a>`)
    .concat(twin ? [`<a href="${twin}">User Acquisition Agency</a>`] : [])
    .join(" · ");
  return `<section class="framed" id="faq">
  <div class="wrap">
    <div class="section-head center rv"><h2>Questions about signup automation</h2></div>
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

export const SIGNUP_TITLE = "Signup Automation: an AI Agent That Gets You More Signups | distribute.you";
export const SIGNUP_DESCRIPTION =
  "Revenue made easy. Signup automation by one AI agent: buyers invited by cold email and WhatsApp, every signup followed until they pay. Free for one user, 0% markup.";

export function renderSignupAutomationPage(): string {
  const url = `${SITE}${SIGNUP_PAGE_PATH}`;
  const faq = signupFaq();
  return shell({
    title: SIGNUP_TITLE,
    description: SIGNUP_DESCRIPTION,
    path: SIGNUP_PAGE_PATH,
    head: signupHead(),
    bodyClass: "signups",
    body: [
      heroHtml(),
      stripHtml(),
      pathHtml(),
      toolsHtml(),
      howHtml(),
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
        name: "distribute.you signup automation",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url,
        description: SIGNUP_DESCRIPTION,
        offers: { "@type": "Offer", price: 0, priceCurrency: "USD", description: "Free for one user. Every action at the API price, 0% markup." },
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: stripTags(f.a) } })),
      },
      breadcrumb([
        { name: "distribute.you", path: "/" },
        { name: "Signup Automation", path: SIGNUP_PAGE_PATH },
      ]),
    ],
  });
}
