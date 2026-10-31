/**
 * `/gtm-automation`: the GTM AI Agent page (PAGE-GTM-AUTOMATION-1030, owner 2026-10-29).
 *
 * Buyer: the cheap SaaS founder (root CLAUDE.md POSITIONING). Search keyword: "gtm
 * automation" (40 US searches a month, CPC $99.61: buyer intent), with "ai gtm agent". Its
 * Agency twin is `/gtm-agency` (company making cash, Book a call); this page sells the same
 * outcome to the founder who wants the whole go-to-market run by one agent, at the API
 * price, open source, from a website or from Claude Code / Grok. It is the UMBRELLA of the
 * AI Agent pages: its outcome grid links every live one, read from the catalogue
 * (`site-pages.ts`), so a page that goes live appears here with no edit.
 *
 * Every figure is READ at render, never typed here:
 * - `__HOT_LEAD_ROW__` / `__HOT_LEAD_BAND__`: the fleet's engaged leads and costs
 *   (static-html.ts `withHotLeadStats`, the reads the homepage hero states);
 * - the client cards (`data-brand`) and proof cards (`data-proof-brand`): features-service's
 *   pick and counts (`withShowcaseOutcomes`);
 * - `<!--gtm-price:*-->` and `<!--action-prices-->`: the live price of each priced step,
 *   from the public cost catalogue;
 * - the competitor rows: `competitors.ts`, each figure read on their own site and dated.
 *
 * Signature motion (refs #1, oxygen `growth-scene`): a PINNED hero scrubbed by scroll. The
 * hero sticks while the page scrolls under it, and the scroll moves one lead down the
 * agent's run, from found to paid (motion.js `pin-scrub`); light variant. The HTML is the
 * final state (every stage done, nothing pinned). Styles:
 * `public/landing/v2/gtm-automation.css`, after agent.css and ai-sdr.css.
 *
 * Alias-free: the unit tests render it directly.
 */
import {
  GTM_AUTOMATION_ALTERNATIVES_PATH,
  GTM_AUTOMATION_PATH,
  competitorLogo,
  competitorPath,
  gtmAutomationTableCompetitors,
} from "../competitors";
import { SITE_PAGES, type OutcomeSlug } from "../site-pages";
import { SITE, SIGN_UP, WHY, breadcrumb, esc, shell } from "../v2-shell";
import { type PlatformPrice } from "./catalog";
import { actionPrices } from "./home-agent";
import { AGENT_CSS_VERSION, AI_SDR_CSS_VERSION, proofHtml, quotesHtml } from "./ai-sdr";

export const GTM_AUTOMATION_CSS_VERSION = 1;

const LOGO = (domain: string, size = 28) =>
  `<img src="https://img.logo.dev/${domain}?token=pk_J1iY4__HSfm9acHjR8FibA&size=64&format=png" alt="" width="${size}" height="${size}">`;

const ARROW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

function head(): string {
  return `<link rel="stylesheet" href="/landing/v2/agent.css?v=${AGENT_CSS_VERSION}">
<link rel="stylesheet" href="/landing/v2/ai-sdr.css?v=${AI_SDR_CSS_VERSION}">
<link rel="stylesheet" href="/landing/v2/gtm-automation.css?v=${GTM_AUTOMATION_CSS_VERSION}">`;
}

/** The Agency twin, linked only while its catalogue entry is live. */
function agencyTwin(): string | null {
  return SITE_PAGES.find((p) => p.outcome === "gtm" && p.buyer === "agency" && p.live)?.path ?? null;
}

// ---------------------------------------------------------------------------
// Live prices: one per priced stage of the run
// ---------------------------------------------------------------------------

/** The stages of the run that carry a price, keyed on the catalogue group they spend in. */
export type GtmPriceKey = "leads" | "research" | "ai" | "sending";

/** Where a stage's price goes in the hero; resolved by `withGtmPrices`. */
export const gtmPriceToken = (k: GtmPriceKey) => `<!--gtm-price:${k}-->`;

/**
 * The cheapest served line of each priced stage, read through the homepage's `actionPrices`
 * (the same `catalogSections` the catalog draws, so a line the catalog hides never shows
 * here). Stated "from": a stage's real cost is the client's own campaign, on their dashboard.
 */
export function stagePrices(prices: PlatformPrice[] | null): Partial<Record<GtmPriceKey, string>> {
  const out: Partial<Record<GtmPriceKey, string>> = {};
  for (const a of prices ? actionPrices(prices) : []) {
    if (a.group === "leads" || a.group === "research" || a.group === "ai" || a.group === "sending") out[a.group] = a.price;
  }
  return out;
}

/** Resolves every price slot of the page from one catalogue read; a failed read prints no figure. */
export function withGtmPrices(html: string, prices: PlatformPrice[] | null): string {
  const p = stagePrices(prices);
  let out = html;
  for (const k of ["leads", "research", "ai", "sending"] as const) {
    const v = p[k];
    out = out.replaceAll(gtmPriceToken(k), v ? `<span class="gx-price">from ${esc(v)}</span>` : "");
  }
  return out;
}

// ---------------------------------------------------------------------------
// The run: one lead, from found to paid (the pinned, scroll-scrubbed hero)
// ---------------------------------------------------------------------------

/** One stage of the run. A role and a company type, never a person. */
export type RunStage = { key: string; title: string; detail: string; price: GtmPriceKey | null };

export const RUN_STAGES: readonly RunStage[] = [
  { key: "found", title: "Found", detail: "Head of Growth, B2B SaaS, 45 people", price: "leads" },
  { key: "qualified", title: "Qualified", detail: "Fits your buyer: hiring a first SDR", price: "research" },
  { key: "emailed", title: "Emailed", detail: "One email, written for them", price: "sending" },
  { key: "replied", title: "Replied", detail: "Interested, and answered by the agent", price: "ai" },
  { key: "meeting", title: "Meeting booked", detail: "Thursday at 10am, in your calendar", price: null },
  { key: "paid", title: "Paid", detail: "Followed up on WhatsApp until they buy", price: null },
];

/**
 * The run card. Its final state is the lead at the last stage, every stage done (what a
 * crawler, a reduced-motion visitor and a failed script see); motion.js `pin-scrub` sets
 * `data-stage` and each step's `data-status` from the scroll, and `--p` for the progress bar.
 */
export function runCardHtml(stages: readonly RunStage[] = RUN_STAGES): string {
  const rows = stages
    .map(
      (s, i) => `<li class="gx-st" data-scrub-step data-status="done">
            <span class="gx-dot"><span class="n">${i + 1}</span>${CHECK}</span>
            <div class="gx-txt"><div class="gx-h"><b>${esc(s.title)}</b>${s.price ? gtmPriceToken(s.price) : ""}</div><span class="gx-d">${esc(s.detail)}</span></div>
            <span class="gx-state"><span class="now"><i></i>Now</span><span class="ok">Done</span></span>
          </li>`,
    )
    .join("\n          ");
  return `<div class="gx-run" data-scrub-scene data-stage="${stages.length}" style="--s:${stages.length - 1}">
      <div class="gx-run-h"><span class="live"><i></i>GTM agent for yourcompany.com</span><span class="gx-hint">Scroll to run it</span></div>
      <div class="gx-lead"><span class="gx-av" aria-hidden="true">HG</span><div><b>Head of Growth</b><span>B2B SaaS, 45 people</span></div><em>One lead, one agent</em></div>
      <div class="gx-rail-wrap">
        <span class="gx-token" aria-hidden="true"></span>
        <ol class="gx-rail">
          ${rows}
        </ol>
      </div>
      <div class="gx-run-f"><span>From found to paid</span><span class="gx-bar"><i></i></span></div>
    </div>`;
}

function heroHtml(): string {
  const twin = agencyTwin();
  return `<section class="gx-track" id="run" data-motion="pin-scrub">
  <div class="gx-pin">
    <div class="hero hero-agent hero-gtm">
      <div class="hero-glow" aria-hidden="true"></div>
      <div class="wrap hero-inner">
        <div class="hero-grid">
          <div class="hero-copy">
            __HOT_LEAD_ROW__

            <span class="eyebrow why-eyebrow">${WHY}</span>
            <h1>GTM Automation<br><span class="accent">Run By One AI Agent</span>
              <span class="sub">Our AI GTM agent finds your buyers, writes to them, answers, books the meeting and follows up until they pay.</span>
            </h1>

            <div class="pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 6.5 7 .9-5.1 4.8 1.3 7-6.2-3.4-6.2 3.4 1.3-7L2 9.4l7-.9z"/></svg>Free. Every action at the API price, 0% markup.</div>

            <form class="launch" action="${SIGN_UP}" method="get" id="hero-form">
              <div class="launch-field">
                <input id="hero-website" name="url" type="text" autocomplete="off" placeholder="Paste your website, e.g., acme.com">
                <button class="btn btn-accent" type="submit"><span>Start free</span>${ARROW}</button>
              </div>
            </form>
            <div class="hero-links">
              <a class="no-site" href="#outcomes">Every outcome it runs</a>
              <a class="no-site" href="#agent">Use it from Claude Code or Grok</a>${
                twin ? `\n              <a class="no-site" href="${twin}">Want our team on it? GTM Agency</a>` : ""
              }
            </div>
          </div>

          <div class="gx-stage" aria-label="Our AI GTM agent moves one lead from found to paid: found, qualified, emailed, replied, meeting booked and paid, with the live price of each priced step">
            ${runCardHtml()}
          </div>
        </div>
      </div>
    </div>
  </div>
</section>`;
}

/** The named clients' live counts: markup byte-shaped like the homepage's, so `withShowcaseOutcomes` reseeds it. */
function showcaseHtml(): string {
  return `<section class="gx-showcase">
  <div class="wrap">
    <div class="showcase">
      <div class="showcase-label">Interested leads our agent found for real clients</div>
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
    </div>
  </div>
</section>`;
}

function stripHtml(): string {
  return `<section class="offer-strip" aria-label="The offer">
  <div class="wrap">
    <ul class="strip" data-motion="reveal" data-motion-stagger>
      <li><b>0%</b><span>markup on every action</span></li>
      <li><b>$0</b><span>hosted by us</span></li>
      <li><b>MIT</b><span>open source, run it yourself</span></li>
    </ul>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// The umbrella: every outcome the agent runs, one live page each
// ---------------------------------------------------------------------------

/** Which stages of the run each outcome's own page is about. */
const STAGES_COVERED: Partial<Record<OutcomeSlug, string>> = {
  revenue: "Found to meeting booked",
  "lead-generation": "Found and qualified",
  signups: "Visited to signed up to paid",
  "cold-email": "Emailed and replied",
  meetings: "Replied to meeting booked",
  "website-visits": "Emailed to visited",
  "paid-acquisition": "Budget to buyers",
  "lead-nurturing": "Followed up until paid",
  "customer-success": "After they pay",
};

/** The live AI Agent pages this one sits above, in the catalogue's order. */
export function outcomePages() {
  return SITE_PAGES.filter((p) => p.buyer === "agent" && p.live && p.path !== GTM_AUTOMATION_PATH);
}

function outcomesHtml(): string {
  const cards = outcomePages()
    .map((p) => {
      const covers = STAGES_COVERED[p.outcome];
      return `<a class="gx-out" href="${p.path}">
          <span class="gx-out-k">${covers ? esc(covers) : "Part of the run"}</span>
          <b>${esc(p.navLabel)}</b>
          <span>${esc(p.description)}</span>
          <em>See ${esc(p.navLabel)} ${ARROW}</em>
        </a>`;
    })
    .join("\n        ");
  return `<section class="framed" id="outcomes">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">One agent, every outcome</span>
      <h2 style="margin-top:16px">Your whole go-to-market, from one AI GTM agent.</h2>
      <p>Each part of the run has its own page. The same agent runs them all, on one balance.</p>
    </div>
    <div class="gx-outs" data-motion="reveal" data-motion-stagger>
        ${cards}
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// How it runs: four steps
// ---------------------------------------------------------------------------

function howHtml(): string {
  return `<section class="framed tint" id="how">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">How it runs</span>
      <h2 style="margin-top:16px">Paste your website. The agent runs the rest.</h2>
      <p>GTM automation that starts from what already works for other founders.</p>
    </div>
    <div class="sdr-job">
      <svg class="sdr-beam" data-motion="beams" viewBox="0 0 1000 4" preserveAspectRatio="none" aria-hidden="true"><path d="M0 2 H1000" stroke="#2563eb" stroke-width="2" fill="none" vector-effect="non-scaling-stroke"/></svg>
      <ol class="sdr-steps" data-motion="reveal" data-motion-stagger>
        <li class="sdr-step">
          <span class="sdr-n">1</span>
          <h3>Reads your market</h3>
          <p>Reads your website and writes down what you sell, to whom, and why it wins.</p>
          <div class="sdr-vis gx-pitch" aria-hidden="true">
            <div><label>You sell</label><span class="chip">Product analytics</span></div>
            <div><label>To</label><span class="chip">SaaS founders</span></div>
            <div><label>Proof</label><span class="chip">Your customers</span></div>
          </div>
        </li>
        <li class="sdr-step">
          <span class="sdr-n">2</span>
          <h3>Starts from what works</h3>
          <p>Each campaign starts from the workflow with the best return across every campaign we run.</p>
          <div class="sdr-vis" aria-hidden="true">
            <div class="gx-pick win"><span>Best return today</span><em>Picked</em></div>
            <div class="gx-pick"><span>Runner up</span><em>Tested</em></div>
            <div class="gx-pick"><span>New idea</span><em>Tested</em></div>
          </div>
        </li>
        <li class="sdr-step">
          <span class="sdr-n">3</span>
          <h3>Runs every channel</h3>
          <p>Cold email from our warmed domains, then WhatsApp to follow up. Every reply gets read.</p>
          <div class="sdr-vis" aria-hidden="true">
            <div class="gx-chan"><span class="gx-mail">Cold email</span><span class="gx-wa">WhatsApp</span></div>
            <div class="sdr-mail"><b>Reply answered</b><span>Interesting. What would that look like for us?</span></div>
          </div>
        </li>
        <li class="sdr-step">
          <span class="sdr-n">4</span>
          <h3>Moves budget to what pays</h3>
          <p>Every campaign is A/B tested. Your budget moves to the emails and audiences that bring buyers.</p>
          <div class="sdr-vis" aria-hidden="true">
            <div class="gx-ab"><span class="v">A</span><span class="t"><i style="width:48%"></i></span></div>
            <div class="gx-ab win"><span class="v">B</span><span class="t"><i style="width:84%"></i></span><em>Budget here</em></div>
          </div>
        </li>
      </ol>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// What a GTM platform leaves to you
// ---------------------------------------------------------------------------

export const PLATFORM_ROWS: { topic: string; platform: string; agent: string }[] = [
  { topic: "Lead data", platform: "Credits inside a plan", agent: "Each lookup at the API price" },
  { topic: "Workflows", platform: "You build them and keep them running", agent: "The agent picks the best one and runs it" },
  { topic: "Sending", platform: "Your sequencer and your mailboxes", agent: "Built in, from our warmed domains" },
  { topic: "Replies", platform: "Your reps answer them", agent: "Answered until the meeting is booked" },
  { topic: "Follow up", platform: "Another tool to wire in", agent: "On WhatsApp, until they buy" },
  { topic: "How you pay", platform: "Seats, often on a yearly plan", agent: "Free, pause anytime" },
];

function platformHtml(): string {
  const rows = PLATFORM_ROWS.map(
    (r) => `<tr><th scope="row">${esc(r.topic)}</th><td>${esc(r.platform)}</td><td class="ours">${esc(r.agent)}</td></tr>`,
  ).join("");
  return `<section class="framed" id="platform">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">A platform, or an agent</span>
      <h2 style="margin-top:16px">A GTM platform hands you tools. Our agent hands you buyers.</h2>
      <p>Platforms are great for a sales team that runs the work. A founder gets the work done.</p>
    </div>
    <div class="sdr-table-wrap" data-motion="reveal">
      <table class="sdr-table gx-platform">
        <thead><tr><th scope="col"></th><th scope="col">A GTM platform</th><th scope="col">Our AI GTM agent</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
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
      <span class="eyebrow">The price of the run</span>
      <h2 style="margin-top:16px">Every step of your go-to-market, at the API price.</h2>
      <p>Each tool our agent calls has a public price, read live from our <a href="/catalog">catalog</a>. You pay what the vendor charges, with 0% markup.</p>
    </div>
    <div class="prices-grid">
      <!--action-prices-->
      <aside class="byok" data-motion="reveal">
        <span class="byok-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/></svg></span>
        <h3>Your own key always wins</h3>
        <p>Run the open source version with your own data, model and sending keys. Each vendor bills you directly, and we see nothing.</p>
        <h3 class="byok-2">Your balance is the cap</h3>
        <p>Hosted accounts run on a prepaid balance. Auto reload tops it up at the level you choose.</p>
      </aside>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// GTM platforms side by side, read from the competitor catalogue
// ---------------------------------------------------------------------------

function verifiedLabel(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export function compareHtml(): string {
  const list = gtmAutomationTableCompetitors();
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
      <span class="eyebrow">GTM platforms compared</span>
      <h2 style="margin-top:16px">The GTM automation that also does the work.</h2>
      <p>Each of these helps a sales team run its go-to-market. Ours runs it for you.</p>
    </div>
    <div class="sdr-table-wrap" data-motion="reveal">
      <table class="sdr-table">
        <thead><tr><th scope="col">Platform</th><th scope="col">Price on their site</th><th scope="col">Free to start</th><th scope="col"></th></tr></thead>
        <tbody>
          <tr class="ours"><th scope="row"><a href="${GTM_AUTOMATION_PATH}"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="20" height="20">distribute.you</a></th><td>Free. Every action at the API price, 0% markup</td><td>Yes, and open source too</td><td><a class="sdr-vs" href="${SIGN_UP}">Start free</a></td></tr>
          ${rows}
        </tbody>
      </table>
    </div>
    <p class="stack-source">Read on each site, the latest on ${esc(verifiedLabel(newest))}: ${sources}. <a href="${GTM_AUTOMATION_ALTERNATIVES_PATH}">Every GTM automation alternative</a>.</p>
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
      <span><b>Want our team to run it for you?</b> Our GTM Agency runs your go-to-market with you. From $1K/month + 10% of budget.</span>
      <em>See the GTM Agency</em>
    </a>`
    : "";
  return `<section class="framed tint tint-both" id="pricing">
  <div class="wrap">
    <div class="section-head center rv">
      <span class="eyebrow">Pricing</span>
      <h2 style="margin-top:16px">A whole GTM team for the price of its tools.</h2>
      <p>The same agent and the same features on every plan. Pause or cancel anytime.</p>
    </div>
    <div class="plans">
      <article class="plan rv">
        <span class="plan-tag"><i></i>Open source</span>
        <div class="plan-price">Free<small>on your server</small></div>
        <p class="plan-desc">Run your GTM agent yourself and keep every lead and reply.</p>
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
        <div class="plan-price">Free<small>no monthly fee</small></div>
        <p class="plan-desc">We host it and send from our inboxes. You pay each action at the API price.</p>
        <a class="btn btn-accent btn-lg" href="${SIGN_UP}">Start free</a>
        <div class="plan-included">What's included</div>
        <ul>
          <li><i></i>Every action at the vendor's API price, 0% markup</li>
          <li><i></i>Buyers found, written to and answered for you</li>
          <li><i></i>Meetings booked, then WhatsApp follow up</li>
          <li><i></i>Our AI agent talks with you on WhatsApp</li>
          <li><i></i>A prepaid balance: start with $10, auto reload keeps it going</li>
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
        <h2 style="margin-top:16px">Ask your agent to run your go-to-market.</h2>
        <p>Run our AI GTM agent from Claude Code, Grok or any agent that speaks MCP. Same agent, same API prices.</p>
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
          <pre><code>Run the go-to-market for acme.com. Find our best buyers, write to them, answer the replies, book meetings and follow up until they buy.</code></pre>
        </div>
      </div>
    </div>
  </div>
</section>`;
}

const linkList = (links: { href: string; label: string }[]) => links.map((l) => `<a href="${l.href}">${esc(l.label)}</a>`).join(", ");

/** The FAQ: answers in HTML for the page, the same text without tags for the JSON-LD. */
export function gtmAutomationFaq(): { q: string; a: string }[] {
  const twin = agencyTwin();
  const outcomes = linkList(outcomePages().map((p) => ({ href: p.path, label: p.navLabel })));
  const vs = linkList(gtmAutomationTableCompetitors().map((c) => ({ href: competitorPath(c), label: c.name })));
  return [
    {
      q: "What is GTM automation?",
      a: "GTM automation is software that runs parts of your go-to-market for you: finding buyers, enriching them, reaching out and handling the replies. Ours runs all of it with one AI agent, from the first buyer found to the follow up that closes the sale.",
    },
    {
      q: "What is an AI GTM agent?",
      a: "An AI agent that does go-to-market work end to end. Ours reads your website, finds and qualifies your buyers, writes to each one from our domains, answers the replies, books the meeting and follows up on WhatsApp.",
    },
    {
      q: "Which parts of my go-to-market does it run?",
      a: `Lead generation, cold email, the replies, meetings booked and the follow up until they buy. Each part has its own page: ${outcomes}.`,
    },
    {
      q: "Do I still need Clay, Apollo or a sequencer?",
      a: "No. Lead data, research, writing and sending are built in, each at the vendor's API price. If you already pay for one, you can keep it for your own lists.",
    },
    {
      q: "How much does GTM automation cost?",
      a: 'With us, the agent is free. Each action is billed at the vendor\'s API price with 0% markup, from a prepaid balance you start with $10. Every price is on our <a href="/catalog">catalog</a>.',
    },
    {
      q: "Can I run it from Claude Code or Grok?",
      a: 'Yes. Add our MCP server to Claude Code, Grok, Cursor or any agent that speaks MCP, then ask in plain words. The <a href="/docs/mcp">MCP guide</a> has the steps.',
    },
    {
      q: "Can I run it on my own server?",
      a: 'Yes. The <a href="https://github.com/distribute-you/gtm-factory" target="_blank" rel="noopener">GTM Factory</a> behind it is open source under the MIT license. Run it with your own API keys, and your leads and replies stay in your own database.',
    },
    {
      q: "How is it different from Default, Unify, Common Room or Clay?",
      a: `They are platforms a sales team runs. Our agent does the work for you. Each comparison is on its own page: ${vs}.`,
    },
    ...(twin
      ? [
          {
            q: "Can your team run it for me?",
            a: `Yes. Our <a href="${twin}">GTM Agency</a> runs your go-to-market with our team and our agents, from $1K/month + 10% of budget.`,
          },
        ]
      : []),
  ];
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, "");

function faqHtml(): string {
  const items = gtmAutomationFaq()
    .map(
      (f, i) => `<div class="faq-item${i === 0 ? " open" : ""}">
        <button class="faq-q" type="button" aria-expanded="${i === 0}">${esc(f.q)}${PLUS}</button>
        <div class="faq-a"><p>${f.a}</p></div>
      </div>`,
    )
    .join("\n      ");
  const twin = agencyTwin();
  const links = gtmAutomationTableCompetitors()
    .map((c) => `<a href="${competitorPath(c)}">distribute.you vs ${esc(c.name)}</a>`)
    .concat(`<a href="${GTM_AUTOMATION_ALTERNATIVES_PATH}">GTM automation alternatives</a>`)
    .concat(twin ? [`<a href="${twin}">GTM Agency</a>`] : [])
    .join(" · ");
  return `<section class="framed" id="faq">
  <div class="wrap">
    <div class="section-head center rv"><h2>Questions about GTM automation</h2></div>
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

export const GTM_AUTOMATION_TITLE = "GTM Automation: an AI GTM Agent Done For You | distribute.you";
export const GTM_AUTOMATION_DESCRIPTION =
  "Revenue made easy. GTM automation by one AI agent that finds buyers, writes, answers, books meetings and follows up. Free, 0% markup.";

export function renderGtmAutomationPage(): string {
  const url = `${SITE}${GTM_AUTOMATION_PATH}`;
  const faq = gtmAutomationFaq();
  return shell({
    title: GTM_AUTOMATION_TITLE,
    description: GTM_AUTOMATION_DESCRIPTION,
    path: GTM_AUTOMATION_PATH,
    head: head(),
    bodyClass: "gtm",
    body: [
      heroHtml(),
      showcaseHtml(),
      stripHtml(),
      outcomesHtml(),
      howHtml(),
      platformHtml(),
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
        name: "distribute.you GTM automation",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url,
        description: GTM_AUTOMATION_DESCRIPTION,
        offers: { "@type": "Offer", price: 0, priceCurrency: "USD", description: "Free. Every action at the API price, 0% markup." },
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: stripTags(f.a) } })),
      },
      breadcrumb([
        { name: "distribute.you", path: "/" },
        { name: "GTM Automation", path: GTM_AUTOMATION_PATH },
      ]),
    ],
  });
}
