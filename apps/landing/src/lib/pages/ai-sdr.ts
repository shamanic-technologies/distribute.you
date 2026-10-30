/**
 * `/ai-sdr`: the Meetings Booked AI Agent page (PAGE-AI-SDR-1029, owner 2026-10-29).
 *
 * Buyer: the cheap SaaS founder (root CLAUDE.md POSITIONING). Search keyword: "ai sdr"
 * (1,600 US searches a month), with "ai appointment setter" (320) as its second. What
 * this page sells that `/` does not: the SDR's whole job ending in a meeting, the reply
 * desk that books it, the AI SDRs a founder weighs, side by side.
 *
 * Every figure is READ at render, never typed here:
 * - `__HOT_LEAD_ROW__` / `__HOT_LEAD_BAND__`: the fleet's cost per booked meeting and
 *   median ROI (static-html.ts `withHotLeadStats`, the same reads the homepage hero states);
 * - the client cards (`data-brand`) and proof cards (`data-proof-brand`): features-service's
 *   pick and counts (`withShowcaseOutcomes`), so a meeting count here is a real client's;
 * - `<!--action-prices-->`: the live price of each kind of action (`home-agent.ts`);
 * - the competitor rows: `competitors.ts`, each figure read on their own site and dated.
 *
 * Signature motion: the calendar that fills up (main.js `.cal`, the homepage recipe) with
 * the agent's WhatsApp thread booking the meetings in front of it (agent.css `.wa`,
 * played once before first paint). Styles: `public/landing/v2/ai-sdr.css`.
 *
 * Alias-free: the unit tests render it directly.
 */
import { APPOINTMENT_PAGE_PATH } from "../appointment-setting-agencies";
import { AI_SDR_ALTERNATIVES_PATH, AI_SDR_PATH, aiSdrCompetitors, competitorLogo, competitorPath } from "../competitors";
import { SITE, SIGN_UP, WHY, breadcrumb, esc, shell } from "../v2-shell";

export const AI_SDR_CSS_VERSION = 2;
/** agent.css is the homepage's own sheet (WhatsApp thread, offer strip, plans, copy box). */
export const AGENT_CSS_VERSION = 1;

const LOGO = (domain: string, size = 28) =>
  `<img src="https://img.logo.dev/${domain}?token=pk_J1iY4__HSfm9acHjR8FibA&size=64&format=png" alt="" width="${size}" height="${size}">`;

const ARROW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';

function head(): string {
  return `<link rel="stylesheet" href="/landing/v2/agent.css?v=${AGENT_CSS_VERSION}">
<link rel="stylesheet" href="/landing/v2/ai-sdr.css?v=${AI_SDR_CSS_VERSION}">`;
}

// ---------------------------------------------------------------------------
// Hero: the calendar that fills up, and the agent booking it on WhatsApp
// ---------------------------------------------------------------------------

/** The week the calendar fills, stage by stage (main.js advances `data-cal-stage`). */
const CAL_EVENTS: { stage: number; tone: string; short?: boolean; d: number; s: number; l: number; what: string; who: string }[] = [
  { stage: 1, tone: "ta", d: 4, s: 4, l: 4, what: "Demo", who: "Northwind Health" },
  { stage: 1, tone: "tb", short: true, d: 1, s: 8, l: 2, what: "Intro call", who: "Opsfolio" },
  { stage: 2, tone: "tc", d: 2, s: 6, l: 4, what: "Demo", who: "Riverbend Clinics" },
  { stage: 2, tone: "td", short: true, d: 3, s: 0, l: 2, what: "Intro call", who: "Cedar Dental Group" },
  { stage: 2, tone: "te", short: true, d: 5, s: 4, l: 2, what: "Intro call", who: "Lakeside PT" },
  { stage: 3, tone: "tb", d: 1, s: 14, l: 4, what: "Demo", who: "Summit Orthopedics" },
  { stage: 3, tone: "ta", d: 3, s: 12, l: 4, what: "Demo", who: "Cedar Dental Group" },
  { stage: 3, tone: "td", short: true, d: 5, s: 16, l: 2, what: "Follow-up", who: "Harbor Family Care" },
  { stage: 4, tone: "te", short: true, d: 2, s: 18, l: 2, what: "Intro call", who: "Harbor Family Care" },
  { stage: 4, tone: "tc", d: 4, s: 14, l: 4, what: "Demo", who: "Lakeside PT" },
  { stage: 4, tone: "ta", short: true, d: 1, s: 0, l: 2, what: "Intro call", who: "Northwind Health" },
  { stage: 5, tone: "td", d: 2, s: 0, l: 4, what: "Kickoff", who: "Opsfolio" },
  { stage: 5, tone: "tb", d: 3, s: 18, l: 4, what: "Demo", who: "Riverbend Clinics" },
  { stage: 5, tone: "tc", short: true, d: 5, s: 10, l: 2, what: "Intro call", who: "Summit Orthopedics" },
  { stage: 5, tone: "te", d: 4, s: 20, l: 4, what: "Demo", who: "Harbor Family Care" },
];

function calendarHtml(): string {
  const cells = "<i></i>".repeat(30);
  const events = CAL_EVENTS.map(
    (e) =>
      `<div class="cal-ev ${e.tone}${e.short ? " short" : ""}" data-stage="${e.stage}" style="--d:${e.d};--s:${e.s};--l:${e.l}"><b>${esc(e.what)}</b><span>${esc(e.who)}</span></div>`,
  ).join("\n          ");
  return `<div class="sdr-cal-card">
      <div class="sdr-cal-top"><span class="sdr-cal-title"><img src="https://www.google.com/s2/favicons?domain=calendar.google.com&sz=64" alt="" width="18" height="18">Your calendar</span><span class="sdr-cal-week">This week</span></div>
      <div class="cal" data-cal-stage="5" aria-label="A week of sales meetings filling up">
        <div class="cal-days"><span></span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span></div>
        <div class="cal-body">
          <div class="cal-hours"><span>9 AM</span><span>10 AM</span><span>11 AM</span><span>12 PM</span><span>1 PM</span><span>2 PM</span></div>
          <div class="cal-grid">${cells}
          ${events}
          </div>
        </div>
      </div>
      <script>/* The HTML holds the full week; with motion on, the week starts empty and main.js fills it. */if(!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches))document.currentScript.previousElementSibling.setAttribute("data-cal-stage","1");</script>
    </div>`;
}

/** The agent's thread: a reply comes in, it answers, the meeting lands (agent.css `.wa`). */
const THREAD: { dir: "in" | "out"; t: number; text: string; booked?: boolean }[] = [
  { dir: "in", t: 0.9, text: "Northwind Health replied to your email. They want a demo." },
  { dir: "in", t: 2.2, text: "I answered their question on pricing and offered Thursday 10am." },
  { dir: "in", t: 3.6, text: "Demo booked with Northwind Health, Thursday 10am.", booked: true },
  { dir: "out", t: 4.6, text: "Amazing. Keep going!" },
  { dir: "in", t: 6.0, text: "Riverbend Clinics just took Tuesday 11am.", booked: true },
];

function threadHtml(): string {
  const rows = THREAD.map((m) =>
    m.dir === "out"
      ? `<div class="wa-row out" style="--t:${m.t}s"><div class="wa-msg">${esc(m.text)}</div></div>`
      : `<div class="wa-row in" style="--t:${m.t}s"><i class="wa-dots" aria-hidden="true"><b></b><b></b><b></b></i><div class="wa-msg${m.booked ? " booked" : ""}">${esc(m.text)}</div></div>`,
  ).join("\n            ");
  return `<div class="wa" role="img" aria-label="A WhatsApp chat: the AI SDR answers a reply and books the meeting in your calendar">
          <div class="wa-top"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="30" height="30"><div><b>Your AI SDR</b><small>online</small></div></div>
          <div class="wa-body">
            ${rows}
          </div>
          <script>/* Plays the thread once, before first paint; reduced motion keeps the final state. */if(!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches))document.currentScript.previousElementSibling.classList.add("play");</script>
        </div>`;
}

/** The named clients' live counts: markup byte-shaped like the homepage's, so `withShowcaseOutcomes` reseeds it. */
function showcaseHtml(): string {
  return `<div class="showcase">
      <div class="showcase-label">Meetings our AI SDR booked for real clients</div>
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
  return `<section class="hero hero-agent hero-sdr">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <div class="hero-grid">
      <div class="hero-copy">
        __HOT_LEAD_ROW__

        <span class="eyebrow why-eyebrow">${WHY}</span>
        <h1>AI SDR<br><span class="accent">Meetings Booked For You</span>
          <span class="sub">distribute.you is the AI SDR that finds your buyers, writes to them, answers every reply and books the meeting in your calendar.</span>
        </h1>

        <div class="pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 6.5 7 .9-5.1 4.8 1.3 7-6.2-3.4-6.2 3.4 1.3-7L2 9.4l7-.9z"/></svg>Free for one user. Every action at the API price, 0% markup.</div>

        <form class="launch" action="${SIGN_UP}" method="get" id="hero-form">
          <div class="launch-field">
            <input id="hero-website" name="url" type="text" autocomplete="off" placeholder="Paste your website, e.g., acme.com">
            <button class="btn btn-accent" type="submit"><span>Start free</span>${ARROW}</button>
          </div>
        </form>
        <div class="hero-links">
          <a class="no-site" href="#compare">Compare AI SDRs</a>
          <a class="no-site" href="#agent">Use it from Claude Code or Grok</a>
          <a class="no-site" href="${APPOINTMENT_PAGE_PATH}">Want our team on it? Appointment Setting Agency</a>
        </div>
      </div>

      <div class="sdr-stage" aria-label="Your calendar fills with sales meetings while the AI SDR books them on WhatsApp">
        ${calendarHtml()}
        ${threadHtml()}
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
      <li><b>0%</b><span>markup on every API price</span></li>
      <li><b>$0</b><span>for one user, hosted by us</span></li>
      <li><b>$9</b><span>per user for teams</span></li>
      <li><b>MIT</b><span>open source, run it yourself</span></li>
    </ul>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// The SDR's job, step by step
// ---------------------------------------------------------------------------

function jobHtml(): string {
  return `<section class="framed" id="how">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">How it books</span>
      <h2 style="margin-top:16px">The whole SDR job, done by one agent.</h2>
      <p>From a website to a meeting in your calendar. You show up to the call.</p>
    </div>
    <div class="sdr-job">
      <svg class="sdr-beam" data-motion="beams" viewBox="0 0 1000 4" preserveAspectRatio="none" aria-hidden="true"><path d="M0 2 H1000" stroke="#2563eb" stroke-width="2" fill="none" vector-effect="non-scaling-stroke"/></svg>
      <ol class="sdr-steps" data-motion="reveal" data-motion-stagger>
        <li class="sdr-step">
          <span class="sdr-n">1</span>
          <h3>Finds your buyers</h3>
          <p>Reads your website, then picks the people most likely to buy.</p>
          <div class="sdr-vis" aria-hidden="true">
            <div class="sdr-lead"><span class="av"></span><div>Head of Sales<small>B2B software, 50 to 200</small></div><em>Fits</em></div>
            <div class="sdr-lead"><span class="av"></span><div>Founder and CEO<small>Clinic group, 10 to 50</small></div><em>Fits</em></div>
            <div class="sdr-lead dim"><span class="av"></span><div>Office manager<small>Retail, 5 people</small></div><em class="no">Skip</em></div>
          </div>
        </li>
        <li class="sdr-step">
          <span class="sdr-n">2</span>
          <h3>Writes to each one</h3>
          <p>One email per buyer, from domains we own and warm.</p>
          <div class="sdr-vis" aria-hidden="true">
            <div class="sdr-mail"><b>Opsfolio x Northwind Health</b><span>Hi Dana, saw Northwind just opened its third clinic. Worth 15 minutes next week?</span></div>
          </div>
        </li>
        <li class="sdr-step">
          <span class="sdr-n">3</span>
          <h3>Answers every reply</h3>
          <p>Questions, objections, the back and forth. Interested buyers get an answer.</p>
          <div class="sdr-vis" aria-hidden="true">
            <div class="sdr-bub in">Does this cover HIPAA too?</div>
            <div class="sdr-bub out">Both, in one audit. Does Thursday 10am work?</div>
          </div>
        </li>
        <li class="sdr-step">
          <span class="sdr-n">4</span>
          <h3>Books the meeting</h3>
          <p>The invite lands in your calendar, and you hear about it on WhatsApp.</p>
          <div class="sdr-vis" aria-hidden="true">
            <div class="sdr-invite"><span class="sdr-day"><small>Thu</small>12</span><div><b>Demo with Northwind Health</b><small>10:00 to 10:30 · Google Meet</small><em>Accepted</em></div></div>
          </div>
        </li>
      </ol>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// The appointment setter: the reply desk
// ---------------------------------------------------------------------------

function setterHtml(): string {
  return `<section class="framed tint" id="replies">
  <div class="wrap sdr-setter">
    <div class="section-head" data-motion="reveal">
      <span class="eyebrow">AI appointment setter</span>
      <h2 style="margin-top:16px">Our AI SDR works every reply until the meeting is set.</h2>
      <p>Questions, objections, finding a time. Our AI SDR answers each one for you.</p>
      <ul class="sdr-checks">
        <li>Reads every reply and spots the interested buyers</li>
        <li>Answers questions about your offer, from your own website</li>
        <li>Offers times, or sends your booking link</li>
        <li>Tells you on WhatsApp the moment a meeting lands</li>
      </ul>
    </div>
    <div class="sdr-thread" data-motion="reveal" data-motion-stagger aria-hidden="true">
      <div class="bubble in">Interesting. Does this cover HIPAA as well as SOC 2?</div>
      <div class="bubble out">Both, in the same audit. Happy to walk you through it. Does Tuesday 2pm work?</div>
      <div class="bubble in">Tuesday 2pm works.</div>
      <div class="bubble out">Sending the invite now.<span class="booked">✓ Meeting booked · Tue 14:00</span></div>
    </div>
  </div>
  <div class="wrap">
    <div class="integr">
      <span class="integr-label">Replies and meetings land where you already work</span>
      <div class="integr-logos">
        <span><img src="https://www.google.com/s2/favicons?domain=mail.google.com&sz=64" alt="">Gmail</span>
        <span><img src="https://www.google.com/s2/favicons?domain=outlook.com&sz=64" alt="">Outlook</span>
        <span><img src="https://www.google.com/s2/favicons?domain=cal.com&sz=64" alt="">Cal.com</span>
        <span><img src="https://www.google.com/s2/favicons?domain=calendly.com&sz=64" alt="">Calendly</span>
      </div>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Proof: the same live cards as the homepage, keyed per client
// ---------------------------------------------------------------------------

export function proofHtml(): string {
  return `<section class="framed" id="proof">
  <div class="wrap">
    <div class="section-head center rv">
      <span class="eyebrow">Receipts from real runs</span>
      <h2 style="margin-top:16px">What our clients got back.</h2>
      <p>Live figures, read off their own dashboards.</p>
    </div>
    <div class="proof-grid">
      <article class="proof-card rv" data-proof-brand="docdinners.com">
        <div class="proof-top"><img class="face" src="/landing/v2/assets/ryan-parenti.jpg" alt=""><div><div class="name">Ryan W.D. Parenti</div><div class="meta">Founder, Doc Dinners</div></div></div>
        <div class="proof-roi"><span class="big" data-count="2.2" data-decimals="1">0<small>x</small></span><span class="lbl">return on<br>paid budget</span></div>
        <div class="proof-line" data-proof-cost-step="conversation"><span>Cost per positive reply</span><b>$225</b></div>
        <div class="proof-funnel"><span data-proof-step="contacted"><b>12,307</b>contacted</span><span data-proof-step="conversation"><b>20</b>positive replies</span><span data-proof-step="meeting_booked"><b>3</b>meetings booked</span></div>
        <div class="proof-line"><span>Channel</span><b>Cold email</b></div>
      </article>
      <article class="proof-card rv" data-proof-brand="shockwavecenters.com">
        <div class="proof-top"><img class="face" src="/landing/v2/assets/david-tucker.jpg" alt=""><div><div class="name">David Tucker</div><div class="meta">Cofounder, Shockwave Centers</div></div></div>
        <div class="proof-roi"><span class="big" data-count="2.0" data-decimals="1">0<small>x</small></span><span class="lbl">return on<br>paid budget</span></div>
        <div class="proof-line" data-proof-cost-step="conversation"><span>Cost per positive reply</span><b>$68</b></div>
        <div class="proof-funnel"><span data-proof-step="contacted"><b>5,985</b>contacted</span><span data-proof-step="conversation"><b>8</b>positive replies</span></div>
        <div class="proof-line"><span>Channel</span><b>Cold email</b></div>
      </article>
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
      <span class="eyebrow">API price, nothing added</span>
      <h2 style="margin-top:16px">Every step of the SDR job, at the API price.</h2>
      <p>Each tool our AI SDR calls has a public price, read live from our <a href="/catalog">catalog</a>. You pay what the vendor charges, with 0% markup.</p>
    </div>
    <div class="prices-grid">
      <!--action-prices-->
      <aside class="byok" data-motion="reveal">
        <span class="byok-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/></svg></span>
        <h3>Your own key always wins</h3>
        <p>Run the open source version with your own API keys. Each vendor bills you directly, and we see nothing.</p>
        <h3 class="byok-2">Your balance is the cap</h3>
        <p>Hosted accounts run on a prepaid balance. Auto reload tops it up at the level you choose.</p>
      </aside>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// AI SDRs side by side, read from the competitor catalogue
// ---------------------------------------------------------------------------

function verifiedLabel(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export function compareHtml(): string {
  const list = aiSdrCompetitors();
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
      <span class="eyebrow">AI SDRs compared</span>
      <h2 style="margin-top:16px">The AI SDR you can start today.</h2>
      <p>Three of these four start with a demo. Ours starts with your website.</p>
    </div>
    <div class="sdr-table-wrap" data-motion="reveal">
      <table class="sdr-table">
        <thead><tr><th scope="col">AI SDR</th><th scope="col">Price on their site</th><th scope="col">How you start</th><th scope="col"></th></tr></thead>
        <tbody>
          <tr class="ours"><th scope="row"><a href="${AI_SDR_PATH}"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="20" height="20">distribute.you</a></th><td>Free for one user. Every action at the API price, 0% markup</td><td>Paste your website, start free. Open source too.</td><td><a class="sdr-vs" href="${SIGN_UP}">Start free</a></td></tr>
          ${rows}
        </tbody>
      </table>
    </div>
    <p class="stack-source">Read on each site on ${esc(verifiedLabel(newest))}: ${sources}. <a href="${AI_SDR_ALTERNATIVES_PATH}">Every AI SDR alternative</a>.</p>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Quotes, plans, agent, FAQ
// ---------------------------------------------------------------------------

const QUOTES = [
  { text: "Kevin is a very intelligent person with insights on how to expand and grow a business. I am happy to work with an ethical and hard working individual who brings results.", name: "Ryan W.D. Parenti", role: "Founder, Doc Dinners", img: "ryan-parenti.jpg" },
  { text: "Best thing I liked is the depth to which it personalizes outreach. Something I always wished I could do better at scale.", name: "Andrew Becker", role: "Founder, voozaa.app", img: "andrew-becker.jpg" },
  { text: "You are doing great man, congrats. I am very impressed", name: "Bohdan Petryshyn", role: "Co-Founder &amp; CTO, Bosar Agency", img: "bohdan-petryshyn.jpg" },
  { text: "It was incredibly fast to launch a campaign. I just entered my URL, the platform identified the right audience, handled the outreach, and even let me download the contacts, so I didn’t need to buy lists or set up a separate email marketing system.", name: "Christian Lemke", role: "Google Ads expert, Maggie M.", img: "christian-lemke.jpg" },
  { text: "This platform is incredible. Excellent click-through rate. I can literally see everything at a glance. Seriously, amazing work here, this is next-level.", name: "Katherine Fleishman", role: "Marketing expert, 20+ years", img: "katherine-fleishman.jpeg" },
  { text: "Everybody wants to get new leads. That's the solution everyone wants to buy.", name: "Christopher Lafay", role: "Founder, taap.bio", img: "christopher-lafay.jpg" },
];

export function quotesHtml(): string {
  const fig = (q: (typeof QUOTES)[number], hidden: boolean) => `<figure class="quote"${hidden ? ' aria-hidden="true"' : ""}>
        <div class="stars" aria-hidden="true">★★★★★</div>
        <blockquote>${q.text}</blockquote>
        <figcaption><img src="/landing/v2/assets/${q.img}" alt=""><span><b>${q.name}</b><small>${q.role}</small></span></figcaption>
      </figure>`;
  return `<section class="framed" id="quotes">
  <div class="wrap wide">
    <div class="section-head center rv"><h2>What clients are saying</h2></div>
    <div class="marquee rv"><div class="marquee-track">
      ${[...QUOTES.map((q) => fig(q, false)), ...QUOTES.map((q) => fig(q, true))].join("\n      ")}
    </div></div>
  </div>
</section>`;
}

function plansHtml(): string {
  return `<section class="framed tint tint-both" id="pricing">
  <div class="wrap">
    <div class="section-head center rv">
      <span class="eyebrow">Pricing</span>
      <h2 style="margin-top:16px">An AI SDR for the price of its tools.</h2>
      <p>The same agent and the same features on every plan. Pause or cancel anytime.</p>
    </div>
    <div class="plans plans-3">
      <article class="plan rv">
        <span class="plan-tag"><i></i>Open source</span>
        <div class="plan-price">Free<small>on your server</small></div>
        <p class="plan-desc">Run your AI SDR yourself and keep every byte.</p>
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
        <p class="plan-desc">We host it. You pay each action at the API price.</p>
        <a class="btn btn-accent btn-lg" href="${SIGN_UP}">Start free</a>
        <div class="plan-included">What's included</div>
        <ul>
          <li><i></i>Every action at the vendor's API price, 0% markup</li>
          <li><i></i>Buyers found and written to from our warmed domains</li>
          <li><i></i>Replies answered until the meeting is booked</li>
          <li><i></i>Our AI agent talks with you on WhatsApp</li>
          <li><i></i>A prepaid balance: start with $10, auto reload keeps it going</li>
        </ul>
      </article>
      <article class="plan rv">
        <span class="plan-tag"><i></i>Team</span>
        <div class="plan-price">$9<small>per user, each month</small></div>
        <p class="plan-desc">Your whole sales team on the same meetings.</p>
        <a class="btn btn-outline btn-lg" href="${SIGN_UP}">Start free</a>
        <div class="plan-included">What's included</div>
        <ul>
          <li><i></i>Everything in Hosted</li>
          <li><i></i>Every teammate sees every lead and meeting</li>
          <li><i></i>The same API prices, 0% markup</li>
        </ul>
      </article>
    </div>
    <a class="agency-bridge rv" href="${APPOINTMENT_PAGE_PATH}">
      <span><b>Want our team to book them for you?</b> Our Appointment Setting Agency sets your meetings. From $1K/month + 10% of budget.</span>
      <em>See the Appointment Setting Agency</em>
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
        <h2 style="margin-top:16px">Ask your agent for meetings.</h2>
        <p>Run our AI SDR from Claude Code, Grok or any agent that speaks MCP. Same agent, same API prices.</p>
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
          <pre><code>Be my AI SDR for acme.com. Find our best buyers, write to them, answer the interested replies and book sales meetings in my calendar.</code></pre>
        </div>
      </div>
    </div>
  </div>
</section>`;
}

/** The FAQ: answers in HTML for the page, the same text without tags for the JSON-LD. */
export const AI_SDR_FAQ: { q: string; a: string }[] = [
  {
    q: "What is an AI SDR?",
    a: "An AI SDR is an AI agent that does a sales development rep's job: it finds the right buyers, writes to them, follows up, answers the replies and books meetings. Ours does all of it from your website.",
  },
  {
    q: "Is it an AI appointment setter too?",
    a: "Yes. The same agent works as an AI appointment setter: it answers every interested reply, offers times or sends your booking link, and the meeting lands in your calendar.",
  },
  {
    q: "How much does the AI SDR cost?",
    a: 'The agent is free for one user, and $9 per user each month for a team. Each action is billed at the vendor\'s API price with 0% markup, from a prepaid balance you start with $10. Every price is on our <a href="/catalog">catalog</a>.',
  },
  {
    q: "How many meetings will I get?",
    a: 'That depends on your offer and your market, so we never quote a number up front. Your dashboard shows every reply and every meeting, and what each one cost. What a booked meeting costs across all our clients is live on our <a href="/indexes">indexes</a>.',
  },
  {
    q: "Whose mailboxes send the emails?",
    a: "Ours. Every email leaves from mailboxes and domains we own and warm, so your own domain stays clean and there is nothing to set up on your side.",
  },
  {
    q: "Will it replace my SDRs?",
    a: "It takes the prospecting off their plate: finding buyers, writing, following up and booking. Your team keeps the sales calls, and every lead and reply stays visible to them.",
  },
  {
    q: "Can I run the AI SDR on my own server?",
    a: 'Yes. The <a href="https://github.com/distribute-you/gtm-factory" target="_blank" rel="noopener">GTM Factory</a> behind it is open source under the MIT license. Run it with your own API keys, and your data stays in your own database.',
  },
  {
    q: "How is it different from 11x, Artisan, AiSDR or Qualified?",
    a: `You can start today from your website, see every price before it runs, and own the code. Each comparison is on its own page: <a href="${competitorPath({ slug: "11x" })}">11x</a>, <a href="${competitorPath({ slug: "artisan" })}">Artisan</a>, <a href="${competitorPath({ slug: "aisdr" })}">AiSDR</a>, <a href="${competitorPath({ slug: "qualified" })}">Qualified</a>.`,
  },
];

const stripTags = (s: string) => s.replace(/<[^>]+>/g, "");

function faqHtml(): string {
  const items = AI_SDR_FAQ.map(
    (f, i) => `<div class="faq-item${i === 0 ? " open" : ""}">
        <button class="faq-q" type="button" aria-expanded="${i === 0}">${esc(f.q)}${PLUS}</button>
        <div class="faq-a"><p>${f.a}</p></div>
      </div>`,
  ).join("\n      ");
  const links = aiSdrCompetitors()
    .map((c) => `<a href="${competitorPath(c)}">distribute.you vs ${esc(c.name)}</a>`)
    .concat(`<a href="${AI_SDR_ALTERNATIVES_PATH}">AI SDR alternatives</a>`)
    .join(" · ");
  return `<section class="framed" id="faq">
  <div class="wrap">
    <div class="section-head center rv"><h2>Questions about our AI SDR</h2></div>
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

export const AI_SDR_TITLE = "AI SDR: Meetings Booked Automation Done For You | distribute.you";
export const AI_SDR_DESCRIPTION =
  "Revenue made easy. The AI SDR that finds your buyers, writes to them, answers every reply and books your meetings. Free for one user, API price, 0% markup.";

export function renderAiSdrPage(): string {
  const url = `${SITE}${AI_SDR_PATH}`;
  return shell({
    title: AI_SDR_TITLE,
    description: AI_SDR_DESCRIPTION,
    path: AI_SDR_PATH,
    head: head(),
    bodyClass: "sdr",
    body: [
      heroHtml(),
      stripHtml(),
      jobHtml(),
      setterHtml(),
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
        name: "distribute.you AI SDR",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url,
        description: AI_SDR_DESCRIPTION,
        offers: { "@type": "Offer", price: 0, priceCurrency: "USD", description: "Free for one user. Every action at the API price, 0% markup." },
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: AI_SDR_FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: stripTags(f.a) } })),
      },
      breadcrumb([
        { name: "distribute.you", path: "/" },
        { name: "AI SDR", path: AI_SDR_PATH },
      ]),
    ],
  });
}
