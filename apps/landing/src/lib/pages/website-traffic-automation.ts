/**
 * `/website-traffic-automation`: the Website Visits AI Agent page (PAGE-TRAFFIC-1030, owner
 * 2026-10-29).
 *
 * Buyer: the cheap SaaS founder (root CLAUDE.md POSITIONING). "website traffic automation" has
 * no measured search volume, so the title also targets "get qualified website visitors". Its
 * Agency twin is `/website-traffic-agency`. What only this page says: a visit is a BUYER the
 * agent chose and wrote to (cold email from our domains, WhatsApp), and only a human click
 * counts. It never claims SEO, ads or any channel we do not run.
 *
 * Every figure is READ at render, never typed here:
 * - `__HOT_LEAD_ROW__` / `__HOT_LEAD_BAND__`: the fleet reads the homepage hero states;
 * - the website visit indexes (Cold Email Cost Per Click, Click Rate), `/v1/public/indexes`;
 * - `<!--action-prices-->`: the live price of each kind of action, from the cost catalogue;
 * - the tool rows: `traffic-tools.ts`, each figure read on the tool's own site and dated.
 *
 * Signature motion (refs #12, graphed data beams, LIGHT): the beam map in the hero, buyers on
 * the left, our AI judge in the middle, the site on the right (`traffic-shared.ts`
 * `beamMapHtml`, motion.js `traffic-beams`). The Agency twin plays it dark, then a sticky story.
 *
 * Alias-free: the unit tests render it directly.
 */
import type { IndexList } from "../fleet-indexes";
import {
  OUR_TRAFFIC_ROW,
  TRAFFIC_AUTOMATION_ALTERNATIVES_PATH,
  TRAFFIC_AUTOMATION_PATH,
  TRAFFIC_TOOLS,
  trafficToolVsPath,
} from "../traffic-tools";
import { TRAFFIC_AGENCY_PATH } from "../traffic-agencies";
import { SITE, SIGN_UP, WHY, breadcrumb, esc, shell } from "../v2-shell";
import { quotesHtml } from "./ai-sdr";
import { type ToolCluster } from "./agent-tools-compare";
import {
  ARROW,
  LOGO,
  agentBoxHtml,
  agentTrafficHead,
  beamMapHtml,
  faqListHtml,
  plansHtml,
  pricesHtml,
  stripHtml,
  stripTags,
  verifiedLabel,
  visitIndexesHtml,
} from "./traffic-shared";

function heroHtml(): string {
  return `<section class="hero hero-agent hero-traffic">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <div class="hero-grid">
      <div class="hero-copy">
        __HOT_LEAD_ROW__

        <span class="eyebrow why-eyebrow">${WHY}</span>
        <h1>Website Traffic Automation<br><span class="accent">Qualified Visitors For You</span>
          <span class="sub">Our AI agent brings the right buyers to your website, by cold email and WhatsApp. Only the clicks a person made count.</span>
        </h1>

        <div class="pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 6.5 7 .9-5.1 4.8 1.3 7-6.2-3.4-6.2 3.4 1.3-7L2 9.4l7-.9z"/></svg>Free for one user. Every action at the API price, 0% markup.</div>

        <form class="launch" action="${SIGN_UP}" method="get" id="hero-form">
          <div class="launch-field">
            <input id="hero-website" name="url" type="text" autocomplete="off" placeholder="Paste your website, e.g., acme.com">
            <button class="btn btn-accent" type="submit"><span>Start free</span>${ARROW}</button>
          </div>
        </form>
        <div class="hero-links">
          <a class="no-site" href="#data">What a human visit costs</a>
          <a class="no-site" href="#agent">Use it from Claude Code or Grok</a>
          <a class="no-site" href="${TRAFFIC_AGENCY_PATH}">Want our team on it? Website Traffic Agency</a>
        </div>
      </div>

      <div class="tr-stage">
        ${beamMapHtml()}
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
// How it brings visitors: four steps
// ---------------------------------------------------------------------------

function howHtml(): string {
  return `<section class="framed" id="how">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">How it brings visitors</span>
      <h2 style="margin-top:16px">From your website to the buyers who visit it.</h2>
      <p>Website traffic automation that starts with who you want on your site, then goes and gets them.</p>
    </div>
    <div class="sdr-job">
      <svg class="sdr-beam" data-motion="beams" viewBox="0 0 1000 4" preserveAspectRatio="none" aria-hidden="true"><path d="M0 2 H1000" stroke="#2563eb" stroke-width="2" fill="none" vector-effect="non-scaling-stroke"/></svg>
      <ol class="sdr-steps" data-motion="reveal" data-motion-stagger>
        <li class="sdr-step">
          <span class="sdr-n">1</span>
          <h3>Reads your site</h3>
          <p>Writes down what you sell, who buys it, and the page each buyer should see.</p>
          <div class="sdr-vis gx-pitch tr-pitch" aria-hidden="true">
            <div><label>You sell</label><span class="chip">Analytics for SaaS</span></div>
            <div><label>Buyer</label><span class="chip">Head of Growth</span></div>
            <div><label>Page</label><span class="chip">/pricing</span></div>
          </div>
        </li>
        <li class="sdr-step">
          <span class="sdr-n">2</span>
          <h3>Finds your buyers</h3>
          <p>People who match your buyer, by role, company size and market.</p>
          <div class="sdr-vis" aria-hidden="true">
            <div class="sdr-lead"><span class="av"></span><div>Head of Growth<small>B2B SaaS, 40 people</small></div><em>Fits</em></div>
            <div class="sdr-lead"><span class="av"></span><div>Founder<small>Fintech startup</small></div><em>Fits</em></div>
          </div>
        </li>
        <li class="sdr-step">
          <span class="sdr-n">3</span>
          <h3>Invites each one</h3>
          <p>One message per buyer with a reason to visit, by email from our domains or on WhatsApp.</p>
          <div class="sdr-vis" aria-hidden="true">
            <div class="tr-mini">${LOGO("whatsapp.com", 14)}<span>Your new pricing calculator is live. Want the link?</span></div>
            <div class="sdr-mail"><b>A two minute tour</b><span>Here is the page that answers your question.</span></div>
          </div>
        </li>
        <li class="sdr-step">
          <span class="sdr-n">4</span>
          <h3>Counts real visits</h3>
          <p>Our AI judge reads every click. Only a person on your site counts.</p>
          <div class="sdr-vis" aria-hidden="true">
            <div class="tr-judge-row yes"><span>Head of Growth on /pricing</span><em>Human</em></div>
            <div class="tr-judge-row no"><span>Mail scanner, under a second</span><em>Left out</em></div>
          </div>
        </li>
      </ol>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Traffic you wait for vs visitors you chose
// ---------------------------------------------------------------------------

export const VISITOR_ROWS: { topic: string; wait: string; agent: string }[] = [
  { topic: "Who visits", wait: "Whoever finds your page", agent: "Buyers chosen by role, company and market" },
  { topic: "When they come", wait: "Once you rank, or while you post", agent: "From the first messages the agent sends" },
  { topic: "What you know", wait: "A source and a landing page", agent: "The role and company behind each visit" },
  { topic: "What counts", wait: "Sessions in your analytics", agent: "Human clicks, judged by our AI" },
  { topic: "After the visit", wait: "Up to your website", agent: "A signup is followed up on WhatsApp" },
];

function visitorsHtml(): string {
  const rows = VISITOR_ROWS.map(
    (r) => `<tr><th scope="row">${esc(r.topic)}</th><td>${esc(r.wait)}</td><td class="ours">${esc(r.agent)}</td></tr>`,
  ).join("");
  return `<section class="framed tint" id="visitors">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Qualified visitors</span>
      <h2 style="margin-top:16px">Traffic finds you over time. Our agent goes and invites your buyers.</h2>
      <p>Content and social posts grow your audience. Our agent invites the exact people you want to sell to.</p>
    </div>
    <div class="sdr-table-wrap" data-motion="reveal">
      <table class="sdr-table tr-contrast">
        <thead><tr><th scope="col"></th><th scope="col">Traffic you wait for</th><th scope="col">Visitors our agent brings</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// Website traffic tools side by side, read from their own sites
// ---------------------------------------------------------------------------

export function compareHtml(): string {
  const newest = TRAFFIC_TOOLS.map((t) => t.verifiedOn).sort().at(-1) ?? "";
  const rows = TRAFFIC_TOOLS.map(
    (t) =>
      `<tr><th scope="row"><a href="${trafficToolVsPath(t)}">${LOGO(t.domain, 20)}${esc(t.name)}</a></th><td>${esc(t.entryPrice)}</td><td>${esc(t.channel)}</td><td><a class="sdr-vs" href="${trafficToolVsPath(t)}">distribute.you vs ${esc(t.name)}</a></td></tr>`,
  ).join("");
  const sources = TRAFFIC_TOOLS.map((t) => `<a href="${esc(t.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(t.name)}</a>`).join(", ");
  return `<section class="framed tint" id="compare">
  <div class="wrap">
    <div class="section-head center" data-motion="reveal">
      <span class="eyebrow">Traffic tools compared</span>
      <h2 style="margin-top:16px">The traffic tool that brings your buyers.</h2>
      <p>Each of these grows an audience over time. Ours invites the people you want to sell to.</p>
    </div>
    <div class="sdr-table-wrap" data-motion="reveal">
      <table class="sdr-table">
        <thead><tr><th scope="col">Tool</th><th scope="col">Price on their site</th><th scope="col">How it brings traffic</th><th scope="col"></th></tr></thead>
        <tbody>
          <tr class="ours"><th scope="row"><a href="${TRAFFIC_AUTOMATION_PATH}"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="20" height="20">distribute.you</a></th><td>Free for one user. Every action at the API price, 0% markup</td><td>${esc(OUR_TRAFFIC_ROW.channel)}</td><td><a class="sdr-vs" href="${SIGN_UP}">Start free</a></td></tr>
          ${rows}
        </tbody>
      </table>
    </div>
    <p class="stack-source">Read on each site on ${esc(verifiedLabel(newest))}: ${sources}. <a href="${TRAFFIC_AUTOMATION_ALTERNATIVES_PATH}">Every website traffic automation alternative</a>.</p>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

export const TRAFFIC_AUTOMATION_FAQ: { q: string; a: string }[] = [
  {
    q: "What is website traffic automation?",
    a: "Website traffic automation gets people to your website without outreach by hand. Ours is an AI agent: it picks the buyers you want, writes to each one, and counts every person who visits.",
  },
  {
    q: "How do I get qualified website visitors?",
    a: "Invite the people who buy from you, one by one, with a good reason to look. Our agent finds them by role, company and market, writes to each one by email or WhatsApp, and sends them to the page that fits.",
  },
  {
    q: "Is this SEO?",
    a: "Our agent works beside SEO. SEO waits for people to search. Our agent reaches the buyers you choose, today, and invites them to your site.",
  },
  {
    q: "How do you know a visit is from a person?",
    a: "Mail security tools follow many links in emails. Our AI judge reads every click and counts only the ones a person made.",
  },
  {
    q: "What does a visit cost?",
    a: 'You see what each human click cost you, live on your dashboard. Our figure across every campaign is the <a href="/indexes/cold-email-cost-per-click">Cold Email Cost Per Click Index</a>, recorded every day.',
  },
  {
    q: "What is the price?",
    a: 'The agent is free for one user, and $9 per user each month for a team. Each action is billed at the vendor\'s API price with 0% markup, from a prepaid balance you start with $10. Every price is on our <a href="/catalog">catalog</a>.',
  },
  {
    q: "Can I run it on my own server?",
    a: 'Yes. The <a href="https://github.com/distribute-you/gtm-factory" target="_blank" rel="noopener">GTM Factory</a> behind it is open source under the MIT license. Run it with your own API keys, and your buyers stay in your own database.',
  },
  {
    q: "How is it different from Outrank, Babylovegrowth, Blaze or Taplio?",
    a: `Those tools grow an audience with articles or posts. Our agent invites the buyers you choose. Each comparison is on its own page: ${TRAFFIC_TOOLS.map((t) => `<a href="${trafficToolVsPath(t)}">${esc(t.name)}</a>`).join(", ")}.`,
  },
  {
    q: "Can your team run it for me?",
    a: `Yes. Our <a href="${TRAFFIC_AGENCY_PATH}">Website Traffic Agency</a> runs it with our team and our agents, from $1K/month + 10% of budget.`,
  },
];

function faqHtml(): string {
  const links = TRAFFIC_TOOLS.map((t) => `<a href="${trafficToolVsPath(t)}">distribute.you vs ${esc(t.name)}</a>`)
    .concat(`<a href="${TRAFFIC_AUTOMATION_ALTERNATIVES_PATH}">Website traffic automation alternatives</a>`, `<a href="${TRAFFIC_AGENCY_PATH}">Website Traffic Agency</a>`)
    .join(" · ");
  return `<section class="framed" id="faq">
  <div class="wrap">
    <div class="section-head center rv"><h2>Questions about website traffic automation</h2></div>
    <div class="faq-list rv">
      ${faqListHtml(TRAFFIC_AUTOMATION_FAQ)}
    </div>
    <p class="cmp-more">${links}</p>
  </div>
</section>`;
}

// ---------------------------------------------------------------------------
// The cluster and the page
// ---------------------------------------------------------------------------

export const TRAFFIC_TOOL_CLUSTER: ToolCluster = {
  pagePath: TRAFFIC_AUTOMATION_PATH,
  pageName: "Website Traffic Automation",
  alternativesPath: TRAFFIC_AUTOMATION_ALTERNATIVES_PATH,
  topic: "website traffic automation",
  tools: TRAFFIC_TOOLS,
  vsPath: trafficToolVsPath,
  our: OUR_TRAFFIC_ROW,
  channelLabel: "How it brings traffic",
  rows: [
    { label: "Who visits", ours: OUR_TRAFFIC_ROW.whoVisits, theirs: "Whoever finds your articles or posts" },
    { label: "What counts", ours: OUR_TRAFFIC_ROW.whatCounts, theirs: "Visits in your own analytics" },
  ],
  usLine: "distribute.you is an AI agent that brings the buyers you choose to your website, by cold email and WhatsApp, and counts only human clicks.",
  ourWins: [
    "Each visitor is a buyer the agent chose for you, by role, company and market.",
    "Visits start with the first messages, so you do not wait for content to rank.",
    "Free for one user, every action at the API price with 0% markup.",
  ],
  chooseUs: [
    "You want the right buyers on your pricing or demo page.",
    "You want each visit named and only human clicks counted.",
  ],
  planItems: ["Buyers found and invited for you", "Email from our domains and WhatsApp", "Every click judged human"],
  keep: (name) => `Yes. Keep ${name} to grow your audience over time, and let our AI agent invite the buyers you want on your site.`,
  head: agentTrafficHead(),
  bodyClass: "traffic",
};

export const TRAFFIC_AUTOMATION_TITLE = "Website Traffic Automation: Get Qualified Website Visitors | distribute.you";
export const TRAFFIC_AUTOMATION_DESCRIPTION =
  "Revenue made easy. Get qualified website visitors: our AI agent invites your buyers by cold email and WhatsApp and counts only human clicks. Free for one user.";

export function renderWebsiteTrafficAutomationPage(list: IndexList | null): string {
  const url = `${SITE}${TRAFFIC_AUTOMATION_PATH}`;
  return shell({
    title: TRAFFIC_AUTOMATION_TITLE,
    description: TRAFFIC_AUTOMATION_DESCRIPTION,
    path: TRAFFIC_AUTOMATION_PATH,
    head: agentTrafficHead(),
    bodyClass: "traffic",
    body: [
      heroHtml(),
      stripHtml("every action"),
      howHtml(),
      visitorsHtml(),
      visitIndexesHtml(list, {
        eyebrow: "Our data, live",
        h2: "What a human visit costs, read live.",
        p: "Cost per click and click rate across every campaign we run, recorded every day. Link scanners never count.",
      }),
      "__HOT_LEAD_BAND__",
      pricesHtml({ eyebrow: "The price of a visit", h2: "Every action behind a visit, at the API price." }),
      compareHtml(),
      quotesHtml(),
      plansHtml({
        h2: "Pay for the work, never for traffic.",
        openDesc: "Run your website traffic agent yourself and keep every buyer.",
        hostedDesc: "We host it and send from our domains. You pay each action at the API price.",
        hostedItems: ["Buyers found and invited by email and WhatsApp", "Every click judged human before it counts"],
        teamDesc: "Your whole team on the same buyers and visits.",
        bridge: {
          href: TRAFFIC_AGENCY_PATH,
          lead: "Want our team to bring the visitors?",
          line: "The Website Traffic Agency runs it with you. From $1K/month + 10% of budget.",
          cta: "See the Website Traffic Agency",
        },
      }),
      agentBoxHtml({
        h2: "Ask your agent for visitors.",
        p: "Run our AI agent from Claude Code, Grok or any agent that speaks MCP. Same agent, same API prices.",
        ask: "Bring qualified visitors to acme.com. Find our best buyers, invite each one by email or WhatsApp, and tell me who visited.",
      }),
      faqHtml(),
    ].join("\n\n"),
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        name: "distribute.you website traffic automation",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url,
        description: TRAFFIC_AUTOMATION_DESCRIPTION,
        offers: { "@type": "Offer", price: 0, priceCurrency: "USD", description: "Free for one user. Every action at the API price, 0% markup." },
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: TRAFFIC_AUTOMATION_FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: stripTags(f.a) } })),
      },
      breadcrumb([
        { name: "distribute.you", path: "/" },
        { name: "Website Traffic Automation", path: TRAFFIC_AUTOMATION_PATH },
      ]),
    ],
  });
}
