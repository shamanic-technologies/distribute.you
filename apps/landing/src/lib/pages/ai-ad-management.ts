/**
 * `/ai-ad-management`: the Paid Acquisition AI Agent page (PAGE-TRAFFIC-1030, owner 2026-10-29).
 *
 * Buyer: the cheap SaaS founder (root CLAUDE.md POSITIONING). SEO target "ai ad management"
 * (20 US searches a month, CPC $30.31). Its Agency twin is `/ppc-agency`, and like it this page
 * says plainly where the budget goes: we manage NO ad account (the Google and Meta ad spend
 * tables are empty). The budget pays for outreach to buyers chosen by name, by cold email from
 * our domains and on WhatsApp; the agent A/B tests buyers and messages and moves the budget to
 * what brings human clicks; a signup is followed up on WhatsApp.
 *
 * Every figure is READ at render, never typed here:
 * - `__HOT_LEAD_ROW__` / `__HOT_LEAD_BAND__`: the fleet reads the homepage hero states;
 * - the website visit indexes (Cold Email Cost Per Click, Click Rate), `/v1/public/indexes`;
 * - `<!--action-prices-->`: the live price of each kind of action, from the cost catalogue;
 * - the tool rows: `ad-management-tools.ts`, each figure read on the tool's own site and dated.
 *
 * Signature motion (refs #14, outrank bars that grow, LIGHT and sideways): an ad manager card
 * whose bars, one per buyer and message, grow to their share of human clicks, and the budget
 * lands on the winners (motion.js `bar-grow` on the x axis). The bars carry no figure: a
 * product preview, roles never people. `/ppc-agency` grows real monthly spend, dark and upright.
 *
 * Alias-free: the unit tests render it directly.
 */
import {
  AD_MANAGEMENT_ALTERNATIVES_PATH,
  AD_MANAGEMENT_PATH,
  AD_TOOLS,
  OUR_AD_ROW,
  adToolVsPath,
} from "../ad-management-tools";
import type { IndexList } from "../fleet-indexes";
import { PPC_PAGE_PATH } from "../ppc-agencies";
import { SITE, SIGN_UP, WHY, breadcrumb, esc, shell } from "../v2-shell";
import { quotesHtml } from "./ai-sdr";
import { type ToolCluster } from "./agent-tools-compare";
import {
  ARROW,
  LOGO,
  agentBoxHtml,
  agentTrafficHead,
  faqListHtml,
  plansHtml,
  pricesHtml,
  stripHtml,
  stripTags,
  verifiedLabel,
  visitIndexesHtml,
} from "./traffic-shared";

/** The plain line every surface of the page agrees with. */
export const NO_AD_ACCOUNT = "We run no Google or Meta ad account. Your budget goes to outreach that brings buyers who click.";

// ---------------------------------------------------------------------------
// Hero: the ad manager, bars that grow
// ---------------------------------------------------------------------------

/** One line of the ad manager: a buyer, a channel, a message, and where the budget sits. */
export type AdLine = { buyer: string; via: "Email" | "WhatsApp"; message: string; share: number; state: "budget" | "testing" | "paused" };

export const AD_LINES: readonly AdLine[] = [
  { buyer: "Head of Growth, SaaS", via: "Email", message: "Message B", share: 88, state: "budget" },
  { buyer: "Founder, fintech", via: "WhatsApp", message: "Message A", share: 71, state: "budget" },
  { buyer: "VP Sales, logistics", via: "Email", message: "Message A", share: 44, state: "testing" },
  { buyer: "Marketing lead, retail", via: "WhatsApp", message: "Message B", share: 29, state: "testing" },
  { buyer: "Head of Sales, agencies", via: "Email", message: "Message C", share: 11, state: "paused" },
];

const STATE_WORD: Record<AdLine["state"], string> = { budget: "Budget here", testing: "Testing", paused: "Paused" };

/** The card. Final state: every bar at its share, the budget on the winners. */
export function adManagerHtml(lines: readonly AdLine[] = AD_LINES): string {
  const rows = lines
    .map(
      (l, i) => `<li class="am-row ${l.state}">
            <div class="am-l"><b>${esc(l.buyer)}</b><small>${esc(l.via)} · ${esc(l.message)}</small></div>
            <span class="am-track"><i data-bar style="--w:${l.share}%;--i:${i}"></i></span>
            <em>${STATE_WORD[l.state]}</em>
          </li>`,
    )
    .join("\n          ");
  return `<div class="am" data-motion="bar-grow" data-motion-axis="x" role="img" aria-label="Our AI agent tests buyers and messages, and moves your budget to the ones that bring the most human clicks">
        <div class="am-h"><span class="live"><i></i>AI ad manager for yourcompany.com</span><span>Budget follows human clicks</span></div>
        <div class="am-budget">
          <div><small>Your budget</small><b>A hard cap you set</b></div>
          <div class="am-split" aria-hidden="true"><span class="b1"></span><span class="b2"></span><span class="b3"></span></div>
        </div>
        <div class="am-cols" aria-hidden="true"><span>Buyer and message</span><span>Human clicks per dollar</span><span></span></div>
        <ol class="am-rows">
          ${rows}
        </ol>
        <div class="am-f"><span>Every message is an A/B test</span><span>No ad account to run</span></div>
      </div>`;
}

function heroHtml(): string {
  return `<section class="hero hero-agent hero-traffic hero-ads">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <div class="hero-grid">
      <div class="hero-copy">
        __HOT_LEAD_ROW__

        <span class="eyebrow why-eyebrow">${WHY}</span>
        <h1>AI Ad Management<br><span class="accent">Budget Turned Into Buyers</span>
          <span class="sub">Our AI agent puts your budget into outreach to the buyers you choose, by cold email and WhatsApp. The agent moves the money to what brings human clicks.</span>
        </h1>

        <div class="pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 6.5 7 .9-5.1 4.8 1.3 7-6.2-3.4-6.2 3.4 1.3-7L2 9.4l7-.9z"/></svg>Free. Every action at the API price, 0% markup.</div>

        <form class="launch" action="${SIGN_UP}" method="get" id="hero-form">
          <div class="launch-field">
            <input id="hero-website" name="url" type="text" autocomplete="off" placeholder="Paste your website, e.g., acme.com">
            <button class="btn btn-accent" type="submit"><span>Start free</span>${ARROW}</button>
          </div>
        </form>
        <p class="tr-note">${esc(NO_AD_ACCOUNT)}</p>
        <div class="hero-links">
          <a class="no-site" href="#budget">Where your budget goes</a>
          <a class="no-site" href="#agent">Use it from Claude Code or Grok</a>
          <a class="no-site" href="${PPC_PAGE_PATH}">Want our team on it? PPC Agency</a>
        </div>
      </div>

      <div class="tr-stage">
        ${adManagerHtml()}
      </div>
    </div>

    <div class="faces faces-showcase tr-faces">
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

// ---------------------------------------------------------------------------
// How it manages the budget: four steps
// ---------------------------------------------------------------------------

function howHtml(): string {
  return `<section class="framed" id="how">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">How it manages your budget</span>
      <h2>You set the budget. The agent finds where it pays.</h2>
      <p>AI ad management for founders: every dollar goes to reaching a buyer, and the agent keeps the ones that click.</p>
    </div>
    <div class="sdr-job">
      <svg class="sdr-beam" data-motion="beams" viewBox="0 0 1000 4" preserveAspectRatio="none" aria-hidden="true"><path d="M0 2 H1000" stroke="#2563eb" stroke-width="2" fill="none" vector-effect="non-scaling-stroke"/></svg>
      <ol class="sdr-steps" data-motion="reveal" data-motion-stagger>
        <li class="sdr-step">
          <span class="sdr-n">1</span>
          <h3>Set your budget</h3>
          <p>A daily budget is a hard cap. Your prepaid balance is the ceiling.</p>
          <div class="sdr-vis" aria-hidden="true">
            <div class="tr-cap"><span>Daily budget</span><b>Your cap</b></div>
            <div class="tr-cap quiet"><span>Over the cap</span><b>Never spent</b></div>
          </div>
        </li>
        <li class="sdr-step">
          <span class="sdr-n">2</span>
          <h3>Tests buyers and messages</h3>
          <p>Different roles, markets and messages, by email from our domains and on WhatsApp.</p>
          <div class="sdr-vis" aria-hidden="true">
            <div class="gx-ab"><span class="v">A</span><span class="t"><i style="width:46%"></i></span></div>
            <div class="gx-ab win"><span class="v">B</span><span class="t"><i style="width:82%"></i></span><em>Budget here</em></div>
          </div>
        </li>
        <li class="sdr-step">
          <span class="sdr-n">3</span>
          <h3>Moves the budget</h3>
          <p>Money flows to the buyers and messages that bring human clicks.</p>
          <div class="sdr-vis" aria-hidden="true">
            <div class="tr-judge-row yes"><span>Head of Growth, Message B</span><em>More budget</em></div>
            <div class="tr-judge-row no"><span>Head of Sales, Message C</span><em>Paused</em></div>
          </div>
        </li>
        <li class="sdr-step">
          <span class="sdr-n">4</span>
          <h3>Follows every signup</h3>
          <p>Only human clicks count. A new signup hears from the agent on WhatsApp.</p>
          <div class="sdr-vis" aria-hidden="true">
            <div class="tr-mini">${LOGO("whatsapp.com", 14)}<span>Thanks for signing up! Want a hand with your first step?</span></div>
          </div>
        </li>
      </ol>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Where the budget goes: an ad account vs the agent
// ---------------------------------------------------------------------------

export const BUDGET_ROWS: { topic: string; ads: string; agent: string }[] = [
  { topic: "Who sees it", ads: "People who match your targeting", agent: "Buyers chosen by name, role and company" },
  { topic: "What you pay for", ads: "Impressions and clicks, at auction prices", agent: "Each action, at the API price, 0% markup" },
  { topic: "What counts", ads: "The clicks the network reports", agent: "Human clicks, judged by our AI" },
  { topic: "After the click", ads: "Up to your landing page", agent: "A signup is followed up on WhatsApp" },
  { topic: "Who moves the budget", ads: "You, or a tool you plug in", agent: "The agent, toward what brings clicks" },
];

function budgetHtml(): string {
  const rows = BUDGET_ROWS.map(
    (r) => `<tr><th scope="row">${esc(r.topic)}</th><td>${esc(r.ads)}</td><td class="ours">${esc(r.agent)}</td></tr>`,
  ).join("");
  return `<section class="framed tint" id="budget">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Where your budget goes</span>
      <h2>An ad buys a chance to be seen. Our agent reaches the buyer.</h2>
      <p>${esc(NO_AD_ACCOUNT)} You can set every click and signup beside any ad spend you run.</p>
    </div>
    <div class="sdr-table-wrap" data-motion="reveal">
      <table class="sdr-table tr-contrast">
        <thead><tr><th scope="col"></th><th scope="col">An ad account</th><th scope="col">Our AI agent</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// AI ad tools side by side, read from their own sites
// ---------------------------------------------------------------------------

export function compareHtml(): string {
  const newest = AD_TOOLS.map((t) => t.verifiedOn).sort().at(-1) ?? "";
  const rows = AD_TOOLS.map(
    (t) =>
      `<tr><th scope="row"><a href="${adToolVsPath(t)}">${LOGO(t.domain, 20)}${esc(t.name)}</a></th><td>${esc(t.entryPrice)}</td><td>${esc(t.channel)}</td><td><a class="sdr-vs" href="${adToolVsPath(t)}">distribute.you vs ${esc(t.name)}</a></td></tr>`,
  ).join("");
  const sources = AD_TOOLS.map((t) => `<a href="${esc(t.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(t.name)}</a>`).join(", ");
  return `<section class="framed tint" id="compare">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">AI ad tools compared</span>
      <h2>The AI ad manager that reaches buyers by name.</h2>
      <p>Each of these runs your ad accounts well. Ours puts the budget into reaching the buyers you chose.</p>
    </div>
    <div class="sdr-table-wrap" data-motion="reveal">
      <table class="sdr-table">
        <thead><tr><th scope="col">Tool</th><th scope="col">Price on their site</th><th scope="col">Where the budget goes</th><th scope="col"></th></tr></thead>
        <tbody>
          <tr class="ours"><th scope="row"><a href="${AD_MANAGEMENT_PATH}"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="20" height="20">distribute.you</a></th><td>Free. Every action at the API price, 0% markup</td><td>${esc(OUR_AD_ROW.channel)}</td><td><a class="sdr-vs" href="${SIGN_UP}">Start free</a></td></tr>
          ${rows}
        </tbody>
      </table>
    </div>
    <p class="stack-source">Read on each site on ${esc(verifiedLabel(newest))}: ${sources}. <a href="${AD_MANAGEMENT_ALTERNATIVES_PATH}">Every AI ad management alternative</a>.</p>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

export const AD_MANAGEMENT_FAQ: { q: string; a: string }[] = [
  {
    q: "What is AI ad management?",
    a: "AI ad management is software where AI runs your paid acquisition. Most tools plug into Google or Meta ad accounts. Ours puts your budget into outreach to the buyers you choose, and an AI agent moves it to what brings human clicks.",
  },
  {
    q: "Do you manage my Google or Meta ad account?",
    a: "We run no ad account. Your budget goes to outreach by cold email and WhatsApp that brings the buyers you choose to your site. You can set every click and signup beside any ad spend you run.",
  },
  {
    q: "How does the agent decide where the budget goes?",
    a: "Every campaign is an A/B test of buyers, messages and channels. The agent moves your budget to the ones that bring human clicks and signups, and pauses the rest.",
  },
  {
    q: "What will I pay per click?",
    a: 'You see what each human click cost you, live on your dashboard. Our figure across every campaign is the <a href="/indexes/cold-email-cost-per-click">Cold Email Cost Per Click Index</a>, recorded every day.',
  },
  {
    q: "How do you know a click is human?",
    a: "Mail security tools follow many links in emails. Our AI judge reads every click and counts only the ones a person made.",
  },
  {
    q: "What is the price?",
    a: 'The agent is free. Your budget pays each action at the vendor\'s API price with 0% markup, from a prepaid balance you start with $10. Every price is on our <a href="/catalog">catalog</a>.',
  },
  {
    q: "Can I run it on my own server?",
    a: 'Yes. The <a href="https://github.com/distribute-you/gtm-factory" target="_blank" rel="noopener">GTM Factory</a> behind it is open source under the MIT license. Run it with your own API keys, and your buyers stay in your own database.',
  },
  {
    q: "How is it different from Optmyzr, Adzooma, AdEspresso or Ryze AI?",
    a: `Those tools manage the ad accounts you already run. Our agent puts your budget into reaching buyers by name. Each comparison is on its own page: ${AD_TOOLS.map((t) => `<a href="${adToolVsPath(t)}">${esc(t.name)}</a>`).join(", ")}.`,
  },
  {
    q: "Can your team run it for me?",
    a: `Yes. Our <a href="${PPC_PAGE_PATH}">PPC Agency</a> runs your paid acquisition with our team and our agents, from $1K/month + 10% of budget.`,
  },
];

function faqHtml(): string {
  const links = AD_TOOLS.map((t) => `<a href="${adToolVsPath(t)}">distribute.you vs ${esc(t.name)}</a>`)
    .concat(`<a href="${AD_MANAGEMENT_ALTERNATIVES_PATH}">AI ad management alternatives</a>`, `<a href="${PPC_PAGE_PATH}">PPC Agency</a>`)
    .join(" · ");
  return `<section class="framed" id="faq">
  <div class="wrap">
    <div class="section-head center rv"><h2>Questions about AI ad management</h2></div>
    <div class="faq-list rv">
      ${faqListHtml(AD_MANAGEMENT_FAQ)}
    </div>
    <p class="cmp-more">${links}</p>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// The cluster and the page
// ---------------------------------------------------------------------------

export const AD_TOOL_CLUSTER: ToolCluster = {
  pagePath: AD_MANAGEMENT_PATH,
  pageName: "AI Ad Management",
  alternativesPath: AD_MANAGEMENT_ALTERNATIVES_PATH,
  topic: "AI ad management",
  tools: AD_TOOLS,
  vsPath: adToolVsPath,
  our: OUR_AD_ROW,
  channelLabel: "Where the budget goes",
  rows: [
    { label: "Who sees it", ours: OUR_AD_ROW.whoSees, theirs: "The people your ad targeting reaches" },
    { label: "What counts", ours: OUR_AD_ROW.whatCounts, theirs: "The clicks and conversions your ad networks report" },
  ],
  usLine:
    "distribute.you is an AI agent that puts your budget into outreach to buyers you choose, by cold email and WhatsApp, and moves it to what brings human clicks. distribute.you runs no ad account.",
  ourWins: [
    "Every dollar reaches a buyer you chose, by name.",
    "Only human clicks count, and every signup is followed up on WhatsApp.",
    "Free, every action at the API price with 0% markup.",
  ],
  chooseUs: [
    "You want your budget to reach the buyers you would sell to.",
    "You want each click named, and no ad account to look after.",
  ],
  planItems: ["Buyers and messages A/B tested for you", "Email from our domains and WhatsApp", "Every click judged human"],
  keep: (name) => `Yes. Keep ${name} for the ad accounts you run, and let our AI agent bring the buyers you choose by email and WhatsApp.`,
  head: agentTrafficHead(),
  bodyClass: "traffic",
};

export const AD_MANAGEMENT_TITLE = "AI Ad Management: Your Budget Turned Into Buyers | distribute.you";
export const AD_MANAGEMENT_DESCRIPTION =
  "Revenue made easy. AI ad management that puts your budget into outreach to the buyers you choose, and counts only human clicks. Free, 0% markup.";

export function renderAiAdManagementPage(list: IndexList | null): string {
  const url = `${SITE}${AD_MANAGEMENT_PATH}`;
  return shell({
    title: AD_MANAGEMENT_TITLE,
    description: AD_MANAGEMENT_DESCRIPTION,
    path: AD_MANAGEMENT_PATH,
    head: agentTrafficHead(),
    bodyClass: "traffic",
    body: [
      heroHtml(),
      stripHtml("every action"),
      howHtml(),
      budgetHtml(),
      visitIndexesHtml(list, {
        eyebrow: "Our data, live",
        h2: "What a human click costs, read live.",
        p: "Cost per click and click rate across every campaign we run, recorded every day. Link scanners never count.",
      }),
      "__HOT_LEAD_BAND__",
      pricesHtml({ eyebrow: "The price of your budget", h2: "Every dollar of your budget, at the API price." }),
      compareHtml(),
      quotesHtml(),
      plansHtml({
        h2: "Your budget reaches buyers. The agent is free.",
        openDesc: "Run your AI ad manager yourself and keep every buyer.",
        hostedDesc: "We host it and send from our domains. Your budget pays each action at the API price.",
        hostedItems: ["Buyers and messages A/B tested by the agent", "Every click judged human before it counts"],
        teamDesc: "Your whole team on the same buyers and budget.",
        bridge: {
          href: PPC_PAGE_PATH,
          lead: "Want our team to run your paid acquisition?",
          line: "Our PPC Agency runs it with you. From $1K/month + 10% of budget.",
          cta: "See the PPC Agency",
        },
      }),
      agentBoxHtml({
        h2: "Ask your agent to spend it well.",
        p: "Run our AI agent from Claude Code, Grok or any agent that speaks MCP. Same agent, same API prices.",
        ask: "Spend $20 a day bringing buyers to acme.com. Test who to reach and what to say, and move the budget to what brings human clicks.",
      }),
      faqHtml(),
    ].join("\n\n"),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "distribute.you AI ad management",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url,
        description: AD_MANAGEMENT_DESCRIPTION,
        offers: { "@type": "Offer", price: 0, priceCurrency: "USD", description: "Free. Every action at the API price, 0% markup." },
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: AD_MANAGEMENT_FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: stripTags(f.a) } })),
      },
      breadcrumb([
        { name: "distribute.you", path: "/" },
        { name: "AI Ad Management", path: AD_MANAGEMENT_PATH },
      ]),
    ],
  });
}
