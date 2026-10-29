/**
 * `/ai-lead-generation`: the Lead Generation AI Agent page (PAGE-AI-LEAD-GEN-1029, owner
 * 2026-10-29).
 *
 * Buyer: the cheap SaaS founder (root CLAUDE.md POSITIONING). Search keyword: "ai lead
 * generation" (1,600 US searches a month), with "ai lead generation agent" (140) and
 * "lead generation automation" (90). Its Agency twin is `/lead-generation-agency`
 * (company making cash, Book a call); this page sells the same outcome to the founder who
 * runs it from a website, at the API price, starting free. What it says that no sibling
 * says: a lead is found, judged, checked and written to, and each of those steps has a
 * public price you see before it runs.
 *
 * Every figure is READ at render, never typed here:
 * - `__HOT_LEAD_ROW__` / `__HOT_LEAD_BAND__`: the fleet's engaged leads and costs
 *   (static-html.ts `withHotLeadStats`, the reads the homepage hero states);
 * - the client cards (`data-brand`) and proof cards (`data-proof-brand`): features-service's
 *   pick and counts (`withShowcaseOutcomes`);
 * - `<!--lead-receipt-->` and `<!--action-prices-->`: the live price of finding, checking and
 *   judging a lead, and of each kind of action, from the public cost catalogue;
 * - the competitor rows: `competitors.ts`, each figure read on their own site and dated.
 *
 * Signature motion (refs #10, origami): lead rows drop into a light feed and flash
 * Qualified or Not a fit (motion.js `lead-rows`, the Agency page's effect on a light card),
 * beside a treg-style receipt that prices one lead live. Styles:
 * `public/landing/v2/ai-lead-generation.css`, after agent.css and ai-sdr.css.
 *
 * Alias-free: the unit tests render it directly.
 */
import { AI_LEAD_GEN_ALTERNATIVES_PATH, AI_LEAD_GEN_PATH, aiLeadGenCompetitors, competitorPath } from "../competitors";
import { SITE, SIGN_UP, WHY, breadcrumb, esc, shell } from "../v2-shell";
import { catalogSections, type PlatformPrice } from "./catalog";
import { AGENT_CSS_VERSION, AI_SDR_CSS_VERSION, proofHtml, quotesHtml } from "./ai-sdr";

export const AI_LEAD_GEN_CSS_VERSION = 1;

/** Where the hero receipt goes; resolved by `withLeadReceipt` from the live catalogue. */
export const LEAD_RECEIPT_TOKEN = "<!--lead-receipt-->";

const LOGO = (domain: string, size = 28) =>
  `<img src="https://img.logo.dev/${domain}?token=pk_J1iY4__HSfm9acHjR8FibA&size=64&format=png" alt="" width="${size}" height="${size}">`;

const ARROW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';

function head(): string {
  return `<link rel="stylesheet" href="/landing/v2/agent.css?v=${AGENT_CSS_VERSION}">
<link rel="stylesheet" href="/landing/v2/ai-sdr.css?v=${AI_SDR_CSS_VERSION}">
<link rel="stylesheet" href="/landing/v2/ai-lead-generation.css?v=${AI_LEAD_GEN_CSS_VERSION}">`;
}

// ---------------------------------------------------------------------------
// The live receipt: what finding, checking and judging one lead costs
// ---------------------------------------------------------------------------

export type ReceiptLine = { step: "find" | "check" | "judge"; label: string; tool: string; domain: string | null; price: string };

const RECEIPT_LABEL: Record<ReceiptLine["step"], string> = {
  find: "Find the person",
  check: "Check the email",
  judge: "Judge the fit",
};

/**
 * One line per step, each the cheapest served line of its kind, read from the same
 * `catalogSections` the catalog draws (so a line the catalog hides never shows here):
 * finding = a lead data line priced per credit or per lead, checking = a lead data line
 * priced per email, judging = the Jev line of the AI section. A step with no served line
 * is dropped; the lines are never added up (how many of each a lead takes is the
 * client's own campaign, shown on their dashboard).
 */
export function receiptLines(prices: PlatformPrice[]): ReceiptLine[] {
  const sections = catalogSections(prices);
  const leads = sections.find((s) => s.key === "leads")?.rows ?? [];
  const ai = sections.find((s) => s.key === "ai")?.rows ?? [];
  const live = <T extends { usd: number }>(rows: T[]) => rows.filter((r) => Number.isFinite(r.usd));
  const find = live(leads).find((r) => !/\/ email$/.test(r.price));
  const check = live(leads).find((r) => /\/ email$/.test(r.price));
  const judge = live(ai).find((r) => /\bJev\b/.test(r.what));
  const out: ReceiptLine[] = [];
  if (find) out.push({ step: "find", label: RECEIPT_LABEL.find, tool: find.tool, domain: find.domain, price: find.price });
  if (check) out.push({ step: "check", label: RECEIPT_LABEL.check, tool: check.what.replace(/ email$/, ""), domain: check.domain, price: check.price });
  if (judge) out.push({ step: "judge", label: RECEIPT_LABEL.judge, tool: judge.what.replace(/^Input tokens \((.+)\)$/, "$1"), domain: judge.domain, price: judge.price });
  return out;
}

function logoOrBlank(domain: string | null): string {
  return domain ? LOGO(domain, 22) : `<span class="ll-blank" aria-hidden="true"></span>`;
}

/** The receipt card, or a line pointing at the catalog when the read failed. */
export function leadReceiptHtml(prices: PlatformPrice[] | null): string {
  const lines = prices ? receiptLines(prices) : [];
  if (!lines.length) {
    return `<div class="ll-receipt"><p class="ll-foot">Each step&apos;s price is live on our <a href="/catalog">catalog</a>.</p></div>`;
  }
  const items = lines
    .map(
      (l) =>
        `<li data-step="${l.step}">${logoOrBlank(l.domain)}<span class="ll-what"><b>${esc(l.label)}</b><small>${esc(l.tool)}</small></span><span class="ll-price">${esc(l.price)}</span></li>`,
    )
    .join("");
  return `<div class="ll-receipt">
        <div class="ll-receipt-h"><b>One lead, priced live</b><span>0% markup</span></div>
        <ul class="ll-lines" data-motion="reveal" data-motion-stagger>${items}</ul>
        <p class="ll-foot">The vendor&apos;s own API price, read from our <a href="/catalog">catalog</a>.</p>
      </div>`;
}

/** Resolves the receipt slot. */
export function withLeadReceipt(html: string, prices: PlatformPrice[] | null): string {
  return html.replaceAll(LEAD_RECEIPT_TOKEN, leadReceiptHtml(prices));
}

// ---------------------------------------------------------------------------
// Hero: the light lead feed and the receipt
// ---------------------------------------------------------------------------

export type FeedRow = { role: string; company: string; signal: string; fits: boolean };

/** A product preview: roles and company types, never a person. */
export const FEED_ROWS: readonly FeedRow[] = [
  { role: "Head of Growth", company: "B2B SaaS, 45 people", signal: "Hiring a first SDR", fits: true },
  { role: "Student", company: "University, 1 person", signal: "Not a buyer of your product", fits: false },
  { role: "Founder and CEO", company: "Dev tools, 12 people", signal: "Just launched on Product Hunt", fits: true },
  { role: "VP Sales", company: "HR software, 130 people", signal: "Opened an office in Austin", fits: true },
  { role: "Freelance designer", company: "Self-employed", signal: "Too small for your offer", fits: false },
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
  return `<div class="ll-feed" aria-hidden="true">
        <div class="ll-feed-h"><span class="live"><i></i>Leads for yourcompany.com</span><span>Judged by Jev</span></div>
        <ol class="lg-rows" data-motion="lead-rows">${items}</ol>
      </div>`;
}

/** The named clients' live counts: markup byte-shaped like the homepage's, so `withShowcaseOutcomes` reseeds it. */
function showcaseHtml(): string {
  return `<div class="showcase">
      <div class="showcase-label">Interested leads our AI agent found for real clients</div>
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
  return `<section class="hero hero-agent hero-leads">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <div class="hero-grid">
      <div class="hero-copy">
        __HOT_LEAD_ROW__

        <span class="eyebrow why-eyebrow">${WHY}</span>
        <h1>AI Lead Generation<br><span class="accent">Qualified Leads Found For You</span>
          <span class="sub">Our AI lead generation agent finds your buyers, judges every lead, checks the email and writes to them for you.</span>
        </h1>

        <div class="pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 6.5 7 .9-5.1 4.8 1.3 7-6.2-3.4-6.2 3.4 1.3-7L2 9.4l7-.9z"/></svg>Free for one user. Every lead at the API price, 0% markup.</div>

        <form class="launch" action="${SIGN_UP}" method="get" id="hero-form">
          <div class="launch-field">
            <input id="hero-website" name="url" type="text" autocomplete="off" placeholder="Paste your website, e.g., acme.com">
            <button class="btn btn-accent" type="submit"><span>Start free</span>${ARROW}</button>
          </div>
        </form>
        <div class="hero-links">
          <a class="no-site" href="#compare">Compare lead tools</a>
          <a class="no-site" href="#agent">Use it from Claude Code or Grok</a>
          <a class="no-site" href="/lead-generation-agency">Want our team on it? Lead Generation Agency</a>
        </div>
      </div>

      <div class="ll-stage" aria-label="New leads drop in and are judged Qualified or Not a fit, beside the live price of one lead">
        ${feedHtml()}
        ${LEAD_RECEIPT_TOKEN}
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
      <li><b>0%</b><span>markup on every lead found</span></li>
      <li><b>$0</b><span>for one user, hosted by us</span></li>
      <li><b>$9</b><span>per user for teams</span></li>
      <li><b>MIT</b><span>open source, run it yourself</span></li>
    </ul>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// How it finds leads: four steps
// ---------------------------------------------------------------------------

function howHtml(): string {
  return `<section class="framed" id="how">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">How it finds leads</span>
      <h2 style="margin-top:16px">From your website to leads who answer.</h2>
      <p>Lead generation automation that thinks about each lead. You paste a website; the agent does the rest every day.</p>
    </div>
    <div class="sdr-job">
      <svg class="sdr-beam" data-motion="beams" viewBox="0 0 1000 4" preserveAspectRatio="none" aria-hidden="true"><path d="M0 2 H1000" stroke="#2563eb" stroke-width="2" fill="none" vector-effect="non-scaling-stroke"/></svg>
      <ol class="sdr-steps" data-motion="reveal" data-motion-stagger>
        <li class="sdr-step">
          <span class="sdr-n">1</span>
          <h3>Learns who buys</h3>
          <p>Reads your website and writes down your buyer: industry, size and role.</p>
          <div class="sdr-vis ll-icp" aria-hidden="true">
            <div><label>Industry</label><span class="chip">B2B SaaS</span><span class="chip">Dev tools</span></div>
            <div><label>Size</label><span class="chip">10 to 200 people</span></div>
            <div><label>Role</label><span class="chip">Founder</span><span class="chip">Head of Growth</span></div>
          </div>
        </li>
        <li class="sdr-step">
          <span class="sdr-n">2</span>
          <h3>Finds the people</h3>
          <p>Searches lead data sources for people who match, every day.</p>
          <div class="sdr-vis" aria-hidden="true">
            <div class="sdr-lead"><span class="av"></span><div>Head of Growth<small>B2B SaaS, 45 people</small></div><em class="ll-new">New</em></div>
            <div class="sdr-lead"><span class="av"></span><div>VP Sales<small>HR software, 130 people</small></div><em class="ll-new">New</em></div>
            <div class="sdr-lead"><span class="av"></span><div>Founder and CEO<small>Dev tools, 12 people</small></div><em class="ll-new">New</em></div>
          </div>
        </li>
        <li class="sdr-step">
          <span class="sdr-n">3</span>
          <h3>Judges each lead</h3>
          <p>Jev reads every profile and keeps the people who fit, with the reason.</p>
          <div class="sdr-vis" aria-hidden="true">
            <div class="sdr-lead"><span class="av"></span><div>Head of Growth<small>Hiring a first SDR</small></div><em>Fits</em></div>
            <div class="sdr-lead dim"><span class="av"></span><div>Student<small>Not a buyer</small></div><em class="no">Skip</em></div>
          </div>
        </li>
        <li class="sdr-step">
          <span class="sdr-n">4</span>
          <h3>Checks and writes</h3>
          <p>Checks the email exists, then writes to the lead from domains we own.</p>
          <div class="sdr-vis" aria-hidden="true">
            <div class="ll-check"><span>Work email found</span><em>Valid</em></div>
            <div class="sdr-mail"><b>Your first SDR</b><span>Hi Dana, saw you are hiring your first SDR. Want leads waiting on day one?</span></div>
          </div>
        </li>
      </ol>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// A database gives contacts; the agent gives leads
// ---------------------------------------------------------------------------

export const CONTRAST_ROWS: { topic: string; database: string; agent: string }[] = [
  { topic: "Who to look for", database: "You build the search and its filters", agent: "It reads your website and picks your buyer" },
  { topic: "What you pay", database: "A monthly plan with a credit allowance", agent: "Each lead found, at the vendor's API price" },
  { topic: "Who fits", database: "You read each profile", agent: "Jev judges every lead and writes the reason" },
  { topic: "Emails", database: "Revealed, then yours to check", agent: "Checked before anyone writes" },
  { topic: "Outreach", database: "You write and send from your domain", agent: "It writes from domains we own" },
];

function contrastHtml(): string {
  const rows = CONTRAST_ROWS.map(
    (r) => `<tr><th scope="row">${esc(r.topic)}</th><td>${esc(r.database)}</td><td class="ours">${esc(r.agent)}</td></tr>`,
  ).join("");
  return `<section class="framed tint" id="leads">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Leads, not a list</span>
      <h2 style="margin-top:16px">A database gives you contacts. Our agent gives you leads.</h2>
      <p>The same lead data, with the work around it done for you.</p>
    </div>
    <div class="sdr-table-wrap" data-motion="reveal">
      <table class="sdr-table ll-contrast">
        <thead><tr><th scope="col"></th><th scope="col">A lead database</th><th scope="col">Our AI agent</th></tr></thead>
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
      <span class="eyebrow">The price of a lead</span>
      <h2 style="margin-top:16px">Every step of a lead, at the API price.</h2>
      <p>Each tool our agent calls has a public price, read live from our <a href="/catalog">catalog</a>. You pay what the vendor charges, with 0% markup.</p>
    </div>
    <div class="prices-grid">
      <!--action-prices-->
      <aside class="byok" data-motion="reveal">
        <span class="byok-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/></svg></span>
        <h3>Your own key always wins</h3>
        <p>Run the open source version with your own Apollo or data keys. Each vendor bills you directly, and we see nothing.</p>
        <h3 class="byok-2">Your balance is the cap</h3>
        <p>Hosted accounts run on a prepaid balance. Auto reload tops it up at the level you choose.</p>
      </aside>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Lead tools side by side, read from the competitor catalogue
// ---------------------------------------------------------------------------

function verifiedLabel(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export function compareHtml(): string {
  const list = aiLeadGenCompetitors();
  const newest = list.map((c) => c.verifiedOn).sort().at(-1) ?? "";
  const rows = list
    .map(
      (c) =>
        `<tr><th scope="row"><a href="${competitorPath(c)}">${LOGO(c.domain, 20)}${esc(c.name)}</a></th><td>${esc(c.entryPrice)}</td><td>${esc(c.leads)}</td><td><a class="sdr-vs" href="${competitorPath(c)}">distribute.you vs ${esc(c.name)}</a></td></tr>`,
    )
    .join("");
  const sources = list.map((c) => `<a href="${esc(c.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(c.name)}</a>`).join(", ");
  return `<section class="framed tint" id="compare">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Lead tools compared</span>
      <h2 style="margin-top:16px">The lead tool that also does the work.</h2>
      <p>Each of these is great at contact data. Ours finds, judges and writes to the lead too.</p>
    </div>
    <div class="sdr-table-wrap" data-motion="reveal">
      <table class="sdr-table">
        <thead><tr><th scope="col">Tool</th><th scope="col">Price on their site</th><th scope="col">How you get leads</th><th scope="col"></th></tr></thead>
        <tbody>
          <tr class="ours"><th scope="row"><a href="${AI_LEAD_GEN_PATH}"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="20" height="20">distribute.you</a></th><td>Free for one user. Every action at the API price, 0% markup</td><td>Our AI agent finds, judges and contacts them from your website</td><td><a class="sdr-vs" href="${SIGN_UP}">Start free</a></td></tr>
          ${rows}
        </tbody>
      </table>
    </div>
    <p class="stack-source">Read on each site on ${esc(verifiedLabel(newest))}: ${sources}. <a href="${AI_LEAD_GEN_ALTERNATIVES_PATH}">Every AI lead generation alternative</a>.</p>
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
      <h2 style="margin-top:16px">Pay for the leads, never for a seat.</h2>
      <p>The same agent and the same features on every plan. Pause or cancel anytime.</p>
    </div>
    <div class="plans plans-3">
      <article class="plan rv">
        <span class="plan-tag"><i></i>Open source</span>
        <div class="plan-price">Free<small>on your server</small></div>
        <p class="plan-desc">Run your lead generation agent yourself and keep every lead.</p>
        <a class="btn btn-outline btn-lg" href="https://github.com/distribute-you/gtm-factory" target="_blank" rel="noopener">View the code</a>
        <div class="plan-included">What's included</div>
        <ul>
          <li><i></i>MIT license, every line on GitHub</li>
          <li><i></i>Your leads in your own database</li>
          <li><i></i>Your own API keys, billed by each vendor</li>
        </ul>
      </article>
      <article class="plan featured rv">
        <span class="plan-tag"><i></i>Hosted</span>
        <div class="plan-price">Free<small>for one user</small></div>
        <p class="plan-desc">We host it. You pay each lead at the API price.</p>
        <a class="btn btn-accent btn-lg" href="${SIGN_UP}">Start free</a>
        <div class="plan-included">What's included</div>
        <ul>
          <li><i></i>Every action at the vendor's API price, 0% markup</li>
          <li><i></i>Leads found, judged and checked every day</li>
          <li><i></i>Emails written and sent from our warmed domains</li>
          <li><i></i>Our AI agent talks with you on WhatsApp</li>
          <li><i></i>A prepaid balance: start with $10, auto reload keeps it going</li>
        </ul>
      </article>
      <article class="plan rv">
        <span class="plan-tag"><i></i>Team</span>
        <div class="plan-price">$9<small>per user, each month</small></div>
        <p class="plan-desc">Your whole sales team on the same leads.</p>
        <a class="btn btn-outline btn-lg" href="${SIGN_UP}">Start free</a>
        <div class="plan-included">What's included</div>
        <ul>
          <li><i></i>Everything in Hosted</li>
          <li><i></i>Every teammate sees every lead and reply</li>
          <li><i></i>The same API prices, 0% markup</li>
        </ul>
      </article>
    </div>
    <a class="agency-bridge rv" href="/lead-generation-agency">
      <span><b>Want our team to find them for you?</b> The Lead Generation Agency runs it with you. From $1K/month + 10% of budget.</span>
      <em>See the Lead Generation Agency</em>
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
        <h2 style="margin-top:16px">Ask your agent for leads.</h2>
        <p>Run our AI lead generation agent from Claude Code, Grok or any agent that speaks MCP. Same agent, same API prices.</p>
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
          <pre><code>Find qualified leads for acme.com. Keep only the ones who fit our buyer, check their emails and write to each one.</code></pre>
        </div>
      </div>
    </div>
  </div>
</section>`;
}

/** The FAQ: answers in HTML for the page, the same text without tags for the JSON-LD. */
export const AI_LEAD_GEN_FAQ: { q: string; a: string }[] = [
  {
    q: "What is AI lead generation?",
    a: "AI lead generation is an AI agent that finds the people likely to buy from you, judges whether each one fits, and starts the conversation. Ours does all of it from your website.",
  },
  {
    q: "How does the AI lead generation agent pick leads?",
    a: "It reads your website, writes down your buyer, then searches lead data sources every day. Jev, our AI judge, reads each profile and keeps only the people who fit, with the reason.",
  },
  {
    q: "How much does a lead cost?",
    a: 'The agent is free for one user, and $9 per user each month for a team. Each step of a lead, finding it, checking the email and judging the fit, is billed at the vendor\'s API price with 0% markup, from a prepaid balance you start with $10. Every price is on our <a href="/catalog">catalog</a>.',
  },
  {
    q: "Is it a lead list or real outreach?",
    a: "Real outreach. Every qualified lead gets an email written for them, and the ones who reply or visit your site show up on your dashboard with their history. You can download the leads too.",
  },
  {
    q: "Whose mailboxes send the emails?",
    a: "Ours. Every email leaves from mailboxes and domains we own and warm, so your own domain stays clean and there is nothing to set up on your side.",
  },
  {
    q: "Is it lead generation automation or a person?",
    a: "Automation, done for you. The agent runs every day on its own, and it talks with you on WhatsApp about who it found. Want a team beside it? See our Lead Generation Agency.",
  },
  {
    q: "Can I run it on my own server?",
    a: 'Yes. The <a href="https://github.com/distribute-you/gtm-factory" target="_blank" rel="noopener">GTM Factory</a> behind it is open source under the MIT license. Run it with your own API keys, and your leads stay in your own database.',
  },
  {
    q: "How is it different from Apollo, Clay, Seamless.AI or Lusha?",
    a: `They give you contact data to work through. Our agent finds, judges, checks and writes to each lead for you. Each comparison is on its own page: <a href="${competitorPath({ slug: "apollo" })}">Apollo</a>, <a href="${competitorPath({ slug: "clay" })}">Clay</a>, <a href="${competitorPath({ slug: "seamless-ai" })}">Seamless.AI</a>, <a href="${competitorPath({ slug: "lusha" })}">Lusha</a>.`,
  },
];

const stripTags = (s: string) => s.replace(/<[^>]+>/g, "");

function faqHtml(): string {
  const items = AI_LEAD_GEN_FAQ.map(
    (f, i) => `<div class="faq-item${i === 0 ? " open" : ""}">
        <button class="faq-q" type="button" aria-expanded="${i === 0}">${esc(f.q)}${PLUS}</button>
        <div class="faq-a"><p>${f.a}</p></div>
      </div>`,
  ).join("\n      ");
  const links = aiLeadGenCompetitors()
    .map((c) => `<a href="${competitorPath(c)}">distribute.you vs ${esc(c.name)}</a>`)
    .concat(`<a href="${AI_LEAD_GEN_ALTERNATIVES_PATH}">AI lead generation alternatives</a>`, `<a href="/lead-generation-agency">Lead Generation Agency</a>`)
    .join(" · ");
  return `<section class="framed" id="faq">
  <div class="wrap">
    <div class="section-head center rv"><h2>Questions about AI lead generation</h2></div>
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

export const AI_LEAD_GEN_TITLE = "AI Lead Generation: Qualified Leads Found For You | distribute.you";
export const AI_LEAD_GEN_DESCRIPTION =
  "Revenue made easy. AI lead generation that finds your buyers, judges every lead, checks the email and writes to them. Free for one user, 0% markup.";

export function renderAiLeadGenerationPage(): string {
  const url = `${SITE}${AI_LEAD_GEN_PATH}`;
  return shell({
    title: AI_LEAD_GEN_TITLE,
    description: AI_LEAD_GEN_DESCRIPTION,
    path: AI_LEAD_GEN_PATH,
    head: head(),
    bodyClass: "leads",
    body: [
      heroHtml(),
      stripHtml(),
      howHtml(),
      contrastHtml(),
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
        name: "distribute.you AI lead generation agent",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url,
        description: AI_LEAD_GEN_DESCRIPTION,
        offers: { "@type": "Offer", price: 0, priceCurrency: "USD", description: "Free for one user. Every action at the API price, 0% markup." },
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: AI_LEAD_GEN_FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: stripTags(f.a) } })),
      },
      breadcrumb([
        { name: "distribute.you", path: "/" },
        { name: "AI Lead Generation", path: AI_LEAD_GEN_PATH },
      ]),
    ],
  });
}
