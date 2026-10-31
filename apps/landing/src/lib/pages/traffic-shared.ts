/**
 * What the three traffic pages share (PAGE-TRAFFIC-1030): `/website-traffic-automation`
 * (Website Visits, AI Agent), `/website-traffic-agency` (Website Visits, Agency) and
 * `/ai-ad-management` (Paid Acquisition, AI Agent).
 *
 * What runs, read on the live catalogue on 2026-10-30: the legs start → website visit →
 * signup; buyers are reached by cold email from our own domains and on WhatsApp; a visit is a
 * HUMAN click (our AI judge leaves link scanners out); the fleet's Cold Email Cost Per Click
 * and Click Rate indexes (`/v1/public/indexes`, outcome `website_visit`) are the public
 * figures. No ad account is managed (the Google and Meta ad spend tables are empty).
 *
 * - `beamMapHtml`: the Website Visits signature (refs #12, graphed data beams + agent status
 *   pulse). Buyers on the left, a beam to our AI judge, then to the client's site or to the
 *   scanners bin. The HTML is the final state (three human visits listed); motion.js
 *   `traffic-beams` sends a dot down each beam and lists the visit when it lands.
 * - `visitIndexesHtml`: the two website-visit indexes on a light page, read live.
 * - the AI Agent house parts with the page's own words: offer strip, plans + Agency bridge,
 *   "from your own agent" copy box.
 *
 * Alias-free: the unit tests render it directly.
 */
import {
  EXPECTED_LABEL,
  STATUS_LABEL,
  formatIndexValue,
  isExpected,
  statusLegend,
  unavailableLine,
  type IndexList,
  type IndexSummary,
} from "../fleet-indexes";
import { SIGN_UP, esc } from "../v2-shell";
import { AGENT_CSS_VERSION, AI_SDR_CSS_VERSION } from "./ai-sdr";

export const TRAFFIC_CSS_VERSION = 2;

export const LOGO = (domain: string, size = 28) =>
  `<img src="https://img.logo.dev/${domain}?token=pk_J1iY4__HSfm9acHjR8FibA&size=64&format=png" alt="" width="${size}" height="${size}">`;

export const ARROW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
export const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';

/** The traffic layer, after whatever the page's buyer already loads. */
export const TRAFFIC_CSS = `<link rel="stylesheet" href="/landing/v2/traffic.css?v=${TRAFFIC_CSS_VERSION}">`;

/** An AI Agent traffic page's stylesheets: the AI Agent layers, then the traffic layer. */
export function agentTrafficHead(): string {
  return `<link rel="stylesheet" href="/landing/v2/agent.css?v=${AGENT_CSS_VERSION}">
<link rel="stylesheet" href="/landing/v2/ai-sdr.css?v=${AI_SDR_CSS_VERSION}">
${TRAFFIC_CSS}`;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function verifiedLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export const stripTags = (s: string) => s.replace(/<[^>]+>/g, "");

// ---------------------------------------------------------------------------
// The beam map (Website Visits signature)
// ---------------------------------------------------------------------------

/** One buyer the agent wrote to. A role and a company type, never a person. */
export type BeamBuyer = { role: string; org: string; via: "Email" | "WhatsApp"; page: string };

export const BEAM_BUYERS: readonly BeamBuyer[] = [
  { role: "Head of Growth", org: "B2B SaaS, 40 people", via: "Email", page: "Pricing" },
  { role: "Founder", org: "Fintech startup", via: "WhatsApp", page: "Demo page" },
  { role: "VP Sales", org: "Logistics software", via: "Email", page: "Case study" },
  { role: "Marketing lead", org: "Online store", via: "WhatsApp", page: "Home page" },
];

/**
 * The clicks the map plays, in order, then again: which buyer's message was clicked and
 * whether a person made the click (a link scanner at their company follows links too).
 */
export const BEAM_CLICKS: readonly { buyer: number; human: boolean }[] = [
  { buyer: 2, human: false },
  { buyer: 0, human: true },
  { buyer: 1, human: true },
  { buyer: 3, human: false },
  { buyer: 2, human: true },
  { buyer: 3, human: true },
  { buyer: 0, human: false },
  { buyer: 1, human: true },
];

/** The visits the site card lists in the final state, newest first (buyer indexes). */
export const BEAM_FINAL_VISITS = [3, 1, 0] as const;

// Map geometry, in the SVG's own units (viewBox 600 x 400). The HTML nodes sit on the same
// grid in percentages, so a beam ends exactly at the node it points to at any width.
const W = 600;
const H = 400;
const CHIP = { x: 0, w: 192, h: 58, tops: [22, 116, 210, 304] };
const JUDGE = { x: 252, y: 152, w: 80, h: 84 };
const SITE = { x: 392, y: 70, w: 208, h: 248 };
const DROP = { x: 222, y: 318, w: 140, h: 56 };
const MID = JUDGE.y + JUDGE.h / 2;

const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;
const box = (b: { x: number; y: number; w: number; h: number }) =>
  `left:${pct(b.x, W)};top:${pct(b.y, H)};width:${pct(b.w, W)};height:${pct(b.h, H)}`;

/** The beam from buyer `i` to the judge. */
export function buyerBeam(i: number): string {
  const y = CHIP.tops[i] + CHIP.h / 2;
  const x0 = CHIP.x + CHIP.w;
  const x1 = JUDGE.x;
  return `M${x0} ${y} C${x0 + 34} ${y} ${x1 - 34} ${MID} ${x1} ${MID}`;
}

export const SITE_BEAM = `M${JUDGE.x + JUDGE.w} ${MID} L${SITE.x} ${MID}`;
export const DROP_BEAM = `M${JUDGE.x + JUDGE.w / 2} ${JUDGE.y + JUDGE.h} L${JUDGE.x + JUDGE.w / 2} ${DROP.y}`;

const MAIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>';
const WA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/></svg>';

function visitRow(b: BeamBuyer): string {
  return `<li><b>${esc(b.role)}</b><span>${esc(b.page)}</span><em>Human</em></li>`;
}

/**
 * The map. `dark` is the Agency variant. Its final state lists three human visits and the
 * scanners bin; motion.js `traffic-beams` replays the clicks from the JSON beside it.
 */
export function beamMapHtml(site = "yourcompany.com", variant: "light" | "dark" = "light"): string {
  const chips = BEAM_BUYERS.map(
    (b, i) =>
      `<li class="tb-chip" data-buyer="${i}" style="${box({ x: CHIP.x, y: CHIP.tops[i], w: CHIP.w, h: CHIP.h })}"><span class="tb-via ${b.via === "Email" ? "tb-mail" : "tb-wa"}" title="${b.via}">${b.via === "Email" ? MAIL : WA}</span><span class="tb-who"><b>${esc(b.role)}</b><small>${esc(b.org)}</small></span></li>`,
  ).join("");
  const beams = BEAM_BUYERS.map((_, i) => `<path class="tb-path" data-beam="buyer" d="${buyerBeam(i)}"/>`).join("");
  const visits = BEAM_FINAL_VISITS.map((i) => visitRow(BEAM_BUYERS[i])).join("");
  const data = JSON.stringify({ buyers: BEAM_BUYERS, clicks: BEAM_CLICKS }).replaceAll("<", "\\u003c");
  return `<div class="tb tb-${variant}" data-motion="traffic-beams" role="img" aria-label="Our AI agent writes to your buyers by email and WhatsApp. Our AI judge reads every click: people go on to your website, link scanners are left out.">
      <div class="tb-h"><span class="live"><i></i>Visitors to ${esc(site)}</span><span>Human clicks only</span></div>
      <div class="tb-map">
        <svg class="tb-svg" viewBox="0 0 ${W} ${H}" aria-hidden="true">
          ${beams}
          <path class="tb-path out" data-beam="site" d="${SITE_BEAM}"/>
          <path class="tb-path drop" data-beam="drop" d="${DROP_BEAM}"/>
        </svg>
        <ol class="tb-chips" aria-hidden="true">${chips}</ol>
        <div class="tb-judge" data-judge style="${box(JUDGE)}" aria-hidden="true"><span class="tb-core"><span class="tb-pulse"></span></span><b>AI judge</b><small>Person or scanner?</small></div>
        <div class="tb-site" data-site style="${box(SITE)}" aria-hidden="true">
          <div class="tb-site-h"><span class="tb-dots"><i></i><i></i><i></i></span>${esc(site)}</div>
          <ol class="tb-visits" data-visits>${visits}</ol>
        </div>
        <div class="tb-drop" data-drop style="${box(DROP)}" aria-hidden="true"><b>Link scanners</b><small>Not counted</small></div>
      </div>
      <script type="application/json" data-beam-data>${data}</script>
    </div>`;
}

// ---------------------------------------------------------------------------
// The website visit indexes, read live (light)
// ---------------------------------------------------------------------------

/** The served indexes whose outcome is a website visit (cost per click, click rate), by outcome, never by slug. */
export function visitIndexes(list: IndexList | null): IndexSummary[] {
  return list ? list.indexes.filter((i) => i.outcome === "website_visit") : [];
}

function lightIndexCard(i: IndexSummary): string {
  const value =
    i.value === null
      ? `<span class="v words">${esc(unavailableLine(i.unavailableReason))}</span>`
      : `<span class="v" data-motion="count-up">${esc(formatIndexValue(i.value, i.unit))}</span>`;
  const tag = isExpected(i) ? EXPECTED_LABEL : STATUS_LABEL[i.status];
  return `<li><a class="tr-ix" href="/indexes/${esc(i.slug)}"><em>${esc(tag)}</em>${value}<b>${esc(i.name)}</b><span>${esc(i.valuePer)}</span><small>${esc(i.method)}</small></a></li>`;
}

/** The section; empty when the read failed or no website visit index is served. */
export function visitIndexesHtml(list: IndexList | null, words: { eyebrow: string; h2: string; p: string }): string {
  const rows = visitIndexes(list);
  if (!list || !rows.length) return "";
  return `<section class="framed tint" id="data">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">${esc(words.eyebrow)}</span>
      <h2 style="margin-top:16px">${esc(words.h2)}</h2>
      <p>${esc(words.p)}</p>
    </div>
    <ul class="tr-ix-list" data-motion="reveal" data-motion-stagger>${rows.map(lightIndexCard).join("")}</ul>
    <p class="tr-legend">${esc(statusLegend(list.statusRule))}${rows.some(isExpected) ? ` ${esc(EXPECTED_LABEL)} marks a figure we expect while too few clicks are in to measure it.` : ""} <a href="/indexes">See every index</a></p>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// AI Agent house parts, in the page's own words
// ---------------------------------------------------------------------------

export function stripHtml(unit: string): string {
  return `<section class="offer-strip" aria-label="The offer">
  <div class="wrap">
    <ul class="strip" data-motion="reveal" data-motion-stagger>
      <li><b>0%</b><span>markup on ${esc(unit)}</span></li>
      <li><b>$0</b><span>hosted by us</span></li>
      <li><b>MIT</b><span>open source, run it yourself</span></li>
    </ul>
  </div>
</section>`;
}

export type PlanWords = {
  h2: string;
  openDesc: string;
  hostedDesc: string;
  hostedItems: readonly string[];
  teamDesc: string;
  /** The Agency twin the plans close on. */
  bridge: { href: string; lead: string; line: string; cta: string };
};

export function plansHtml(w: PlanWords): string {
  return `<section class="framed tint tint-both" id="pricing">
  <div class="wrap">
    <div class="section-head center rv">
      <span class="eyebrow">Pricing</span>
      <h2 style="margin-top:16px">${esc(w.h2)}</h2>
      <p>The same agent and the same features on every plan. Pause or cancel anytime.</p>
    </div>
    <div class="plans">
      <article class="plan rv">
        <span class="plan-tag"><i></i>Open source</span>
        <div class="plan-price">Free<small>on your server</small></div>
        <p class="plan-desc">${esc(w.openDesc)}</p>
        <a class="btn btn-outline btn-lg" href="https://github.com/distribute-you/gtm-factory" target="_blank" rel="noopener">View the code</a>
        <div class="plan-included">What's included</div>
        <ul>
          <li><i></i>MIT license, every line on GitHub</li>
          <li><i></i>Your buyers and their visits in your own database</li>
          <li><i></i>Your own API keys, billed by each vendor</li>
        </ul>
      </article>
      <article class="plan featured rv">
        <span class="plan-tag"><i></i>Hosted</span>
        <div class="plan-price">Free<small>no monthly fee</small></div>
        <p class="plan-desc">${esc(w.hostedDesc)}</p>
        <a class="btn btn-accent btn-lg" href="${SIGN_UP}">Start free</a>
        <div class="plan-included">What's included</div>
        <ul>
          <li><i></i>Every action at the vendor's API price, 0% markup</li>
          ${w.hostedItems.map((l) => `<li><i></i>${esc(l)}</li>`).join("\n          ")}
          <li><i></i>Our AI agent talks with you on WhatsApp</li>
          <li><i></i>A prepaid balance: start with $10, auto reload keeps it going</li>
        </ul>
      </article>
    </div>
    <a class="agency-bridge rv" href="${w.bridge.href}">
      <span><b>${esc(w.bridge.lead)}</b> ${esc(w.bridge.line)}</span>
      <em>${esc(w.bridge.cta)}</em>
    </a>
  </div>
</section>`;
}

export function agentBoxHtml(w: { h2: string; p: string; ask: string }): string {
  return `<section class="framed" id="agent">
  <div class="wrap">
    <div class="agent-grid">
      <div class="section-head" data-motion="reveal">
        <span class="eyebrow">Works from your own agent</span>
        <h2 style="margin-top:16px">${esc(w.h2)}</h2>
        <p>${esc(w.p)}</p>
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
          <pre><code>${esc(w.ask)}</code></pre>
        </div>
      </div>
    </div>
  </div>
</section>`;
}

export function pricesHtml(w: { eyebrow: string; h2: string }): string {
  return `<section class="framed" id="prices">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">${esc(w.eyebrow)}</span>
      <h2 style="margin-top:16px">${esc(w.h2)}</h2>
      <p>Each tool our agent calls has a public price, read live from our <a href="/catalog">catalog</a>. You pay what the vendor charges, with 0% markup.</p>
    </div>
    <div class="prices-grid">
      <!--action-prices-->
      <aside class="byok" data-motion="reveal">
        <span class="byok-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/></svg></span>
        <h3>Your own key always wins</h3>
        <p>Run the open source version with your own data, model and sending keys. Each vendor bills you directly.</p>
        <h3 class="byok-2">Your balance is the cap</h3>
        <p>Hosted accounts run on a prepaid balance. Auto reload tops it up at the level you choose.</p>
      </aside>
    </div>
  </div>
</section>`;
}

/** The FAQ list (answers may carry links; the JSON-LD gets them without tags). */
export function faqListHtml(faq: readonly { q: string; a: string }[]): string {
  return faq
    .map(
      (f, i) => `<div class="faq-item${i === 0 ? " open" : ""}">
        <button class="faq-q" type="button" aria-expanded="${i === 0}">${esc(f.q)}${PLUS}</button>
        <div class="faq-a"><p>${f.a}</p></div>
      </div>`,
    )
    .join("\n      ");
}
