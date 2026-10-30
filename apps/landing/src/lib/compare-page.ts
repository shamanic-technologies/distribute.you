/**
 * The comparison cluster: `/compare/<slug>` (one page per competitor), `/compare` (the
 * hub) and `/alternatives`. Rendered from `competitors.ts` at request time and served
 * through the same pipeline as the hand-written pages (`renderedResponse` in
 * static-html.ts), so every page gets the analytics head, the Organization JSON-LD,
 * `Accept: text/markdown`, the edge cache and the live `__HOT_LEAD_BAND__` figures for free.
 *
 * The shape is outrank.so's, because it works for both a search engine and an agent
 * reading the page: a feature table, a pricing row with a source, "where each wins",
 * "choose X if", a FAQ (also as FAQPage JSON-LD), and a verified-on date. What earns the
 * page is the band nobody else can copy: the hot leads the fleet produced and their
 * median cost, measured across every client and resolved live.
 *
 * Alias-free apart from the catalogue, so the unit tests can render a page directly.
 */
import {
  CATEGORY_LABEL,
  COMPARE_VERIFIED_LABEL,
  AI_LEAD_GEN_CLUSTER,
  COLD_EMAIL_AUTOMATION_CLUSTER,
  GTM_AUTOMATION_ALSO,
  GTM_AUTOMATION_CLUSTER,
  AI_SDR_CLUSTER,
  COMPETITORS,
  DISTRIBUTE_ROW,
  clusterAlternativesPath,
  clusterCompetitors,
  clusterOf,
  competitorBySlug,
  competitorPath,
  isAiLeadGenCluster,
  isGtmAutomationCluster,
  isColdEmailAutomationCluster,
  isAiSdrCluster,
  type CompareCluster,
  monthLabel,
  type Category,
  type Competitor,
} from "./competitors";
import {
  SIGN_UP,
  SITE,
  V2_STYLES_VERSION,
  breadcrumb,
  esc,
  shell,
  whyLine,
} from "./v2-shell";
import { AI_SDR_CSS_VERSION } from "./pages/ai-sdr";
import { AI_LEAD_GEN_CSS_VERSION } from "./pages/ai-lead-generation";
import { COLD_EMAIL_AUTOMATION_CSS_VERSION } from "./pages/cold-email-automation";
import { GTM_AUTOMATION_CSS_VERSION } from "./pages/gtm-automation";

export { V2_STYLES_VERSION };

/** Same publishable token the homepage and the dashboard bundle carry. */
const LOGO_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";

export function logo(domain: string, size = 40): string {
  return `<img src="https://img.logo.dev/${domain}?token=${LOGO_TOKEN}&size=${size * 2}&format=png" alt="" width="${size}" height="${size}">`;
}

/**
 * The band only we can publish: the fleet's hot leads and their median cost, the SAME two
 * figures the homepage hero states, rendered by static-html.ts from one read. A token
 * for the whole section: when the fleet cannot be measured the band is dropped, never a
 * heading over a number nobody measured.
 */
export function liveBand(): string {
  return "__HOT_LEAD_BAND__";
}

export function faqJsonLd(faq: readonly { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function faqList(faq: readonly { q: string; a: string }[]): string {
  return faq
    .map(
      (f, i) => `<div class="faq-item${i === 0 ? " open" : ""}">
        <button class="faq-q" type="button" aria-expanded="${i === 0 ? "true" : "false"}">${esc(f.q)}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></button>
        <div class="faq-a"><p>${esc(f.a)}</p></div>
      </div>`,
    )
    .join("\n");
}

export function bullets(items: readonly string[], tone: "yes" | "no"): string {
  const mark = tone === "yes" ? "✓" : "·";
  return `<ul>${items.map((t) => `<li><i>${mark}</i><span>${esc(t)}</span></li>`).join("")}</ul>`;
}

function featureRow(label: string, ours: string, theirs: string): string {
  return `<tr><th scope="row">${esc(label)}</th><td class="us">${ours}</td><td>${esc(theirs)}</td></tr>`;
}

/**
 * A title states the month the page is SERVED in, read at render time (the routes revalidate
 * daily), so it never shows last month. The "Verified" eyebrow keeps the month the prices were
 * actually read: that one is a fact about the data, this one is the page's freshness.
 */
export function comparePageTitle(c: Competitor, now: Date = new Date()): string {
  return `${c.name} alternative: distribute.you vs ${c.name} pricing (${monthLabel(now)})`;
}

export function comparePageDescription(c: Competitor): string {
  if (isAiSdrCluster(c)) {
    return `Looking at ${c.name} alternatives? distribute.you is the AI SDR that books your meetings, free for one user. Compare price, contract and channels.`;
  }
  if (isAiLeadGenCluster(c)) {
    return `Looking at ${c.name} alternatives? distribute.you's AI lead generation agent finds, checks and contacts your leads, free for one user. Compare prices.`;
  }
  if (isColdEmailAutomationCluster(c)) {
    return `Looking at ${c.name} alternatives? distribute.you's cold email automation writes, sends and answers for you, free for one user. Compare prices.`;
  }
  if (isGtmAutomationCluster(c)) {
    return `Looking at ${c.name} alternatives? distribute.you's AI GTM agent runs your go-to-market for you, free for one user. Compare prices.`;
  }
  return `Looking at ${c.name} alternatives? distribute.you's AI agent runs your cold email, free for one user. Compare price and cost per positive reply.`;
}

/** What distribute.you is, said for the reader of this page: an AI SDR page names the job. */
function ourLine(c: Competitor): string {
  if (isAiSdrCluster(c)) {
    return "distribute.you is the AI SDR that books your meetings: you paste a website, our agent finds your buyers, writes from domains we own, answers the replies and books the meeting.";
  }
  if (isAiLeadGenCluster(c)) {
    return "distribute.you is the AI lead generation agent: you paste a website, our agent finds your leads, judges each one, checks the email and writes to them from domains we own.";
  }
  if (isColdEmailAutomationCluster(c)) {
    return "distribute.you is cold email automation done for you: you paste a website, our AI agent finds your buyers, writes each email, sends it from domains we own and answers the replies.";
  }
  if (isGtmAutomationCluster(c)) {
    return "distribute.you is GTM automation done for you: you paste a website, one AI agent finds your buyers, writes from domains we own, answers, books the meeting and follows up until they buy.";
  }
  return "distribute.you runs your cold email for you: you paste a website, we run the campaign from domains we own, and you see what each positive reply cost.";
}

export function renderComparePage(c: Competitor): string {
  const path = competitorPath(c);
  const cluster = clusterOf(c);
  const verified = new Date(c.verifiedOn).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const table = `<table class="cmp-table">
    <thead><tr><th scope="col">What you are comparing</th><th scope="col" class="us">distribute.you</th><th scope="col">${esc(c.name)}</th></tr></thead>
    <tbody>
      ${featureRow("Entry price", esc(DISTRIBUTE_ROW.entryPrice), c.entryPrice)}
      ${featureRow("Pricing model", esc(DISTRIBUTE_ROW.pricingModel), c.pricingModel)}
      ${featureRow("Who runs the campaign", esc(DISTRIBUTE_ROW.operatedBy), c.operatedBy === "you" ? "You do, in their software" : c.operatedBy === "their AI agent" ? "Their AI agent, steered by you" : "Their team")}
      ${featureRow("Sending domains and warmup", esc(DISTRIBUTE_ROW.sendingDomains), c.sendingDomains)}
      ${featureRow("Where the leads come from", esc(DISTRIBUTE_ROW.leads), c.leads)}
      ${featureRow("What happens to a reply", esc(DISTRIBUTE_ROW.replies), c.replies)}
      ${featureRow("Channels", esc(DISTRIBUTE_ROW.channels), c.channels)}
      ${featureRow("Cost per sales meeting published", DISTRIBUTE_ROW.costPerMeeting, c.costPerMeetingPublished ? "Yes" : "No")}
      ${featureRow("Free to start", esc(DISTRIBUTE_ROW.freeTier), c.freeTier)}
      ${featureRow("Contract", esc(DISTRIBUTE_ROW.contract), c.contract)}
    </tbody>
  </table>`;

  const prices = `<table class="roi-table cmp-prices">
    <thead><tr><th>${esc(c.name)} plan</th><th>Price</th><th>What it buys</th></tr></thead>
    <tbody>${c.prices
      .map(
        (p) => `<tr><td>${esc(p.plan)}</td><td class="roi">${esc(p.price)}</td><td>${esc(p.note)}</td></tr>`,
      )
      .join("")}</tbody>
  </table>
  <p class="cmp-source">Read from <a href="${esc(c.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(c.sourceUrl.replace(/^https?:\/\//, ""))}</a> on ${verified}. Prices change; the link is the authority.</p>`;

  const body = `<section class="hero cmp-hero">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <span class="eyebrow">${esc(CATEGORY_LABEL[c.category])} · Verified ${COMPARE_VERIFIED_LABEL}</span>
    <div class="cmp-logos" aria-hidden="true"><span class="cmp-logo"><img src="/landing/v2/assets/logo-mark.svg" alt="" width="40" height="40"></span><span class="cmp-vs">vs</span><span class="cmp-logo">${logo(c.domain)}</span></div>
    <h1>distribute.you <span class="accent">vs</span> ${esc(c.name)}</h1>
    <p class="hero-sub">${esc(c.name)}: ${esc(c.oneLiner)} ${ourLine(c)}</p>
    ${whyLine()}
    <div class="cmp-cta"><a class="btn btn-accent btn-lg" href="${SIGN_UP}">Start free</a><a class="btn btn-outline btn-lg" href="#table">See the table</a></div>
  </div>
</section>

<section class="framed tint" id="table">
  <div class="wrap">
    <div class="section-head"><span class="eyebrow">Side by side</span><h2>distribute.you vs ${esc(c.name)}, row by row</h2><p>The rows a founder actually decides on. Our column is the same on every comparison page; theirs is read from their own site.</p></div>
    <div class="cmp-table-wrap rv">${table}</div>
  </div>
</section>

<section class="framed" id="pricing">
  <div class="wrap">
    <div class="section-head"><span class="eyebrow">Pricing</span><h2>${esc(c.name)} pricing: what they charge, and what we charge</h2><p>${esc(c.name)} sells ${c.operatedBy === "you" ? "software you run" : "an agent you steer"}. Our AI agent is free for one user: every action is at the vendor's API price with 0% markup, and we show what each positive reply cost.</p></div>
    <div class="cmp-cols">
      <div class="panel rv"><span class="c"></span>${prices}</div>
      <div class="plan rv">
        <span class="plan-tag">distribute.you</span>
        <div class="plan-price">Free<small>for one user</small></div>
        <p class="plan-desc">Every action at the API price, 0% markup. Start with $10. Pause or cancel anytime.</p>
        <a class="btn btn-accent" href="${SIGN_UP}">Start free</a>
        <div class="plan-included">Included in the plan</div>
        <ul><li><i></i>Buyers found and qualified from your website</li><li><i></i>Emails written and sent from our domains</li><li><i></i>Every reply read, the interested ones answered</li><li><i></i>Cost per positive reply on your dashboard</li></ul>
        <div class="plan-foot">Teams are $9 per user each month. What a meeting costs you is measured on your account.</div>
      </div>
    </div>
  </div>
</section>

<section class="framed" id="wins">
  <div class="wrap">
    <div class="section-head"><span class="eyebrow">Where each one wins</span><h2>Two different things are being sold</h2></div>
    <div class="fit">
      <div class="fit-card yes rv"><h3>Where distribute.you wins</h3>${bullets(c.whereWeWin, "yes")}</div>
      <div class="fit-card no rv"><h3>Where ${esc(c.name)} wins</h3>${bullets(c.whereTheyWin, "no")}</div>
    </div>
  </div>
</section>

<section class="framed tint" id="choose">
  <div class="wrap">
    <div class="section-head"><span class="eyebrow">Pick the right one</span><h2>Choose ${esc(c.name)} if, choose distribute.you if</h2></div>
    <div class="fit">
      <div class="fit-card yes rv"><h3>Choose distribute.you if</h3>${bullets(c.chooseUsIf, "yes")}</div>
      <div class="fit-card no rv"><h3>Choose ${esc(c.name)} if</h3>${bullets(c.chooseThemIf, "no")}</div>
    </div>
  </div>
</section>

${liveBand()}

<section class="framed" id="faq">
  <div class="wrap">
    <div class="section-head center rv"><h2>Questions people ask about ${esc(c.name)} and distribute.you</h2></div>
    <div class="faq-list rv">${faqList(c.faq)}</div>
    <p class="cmp-more rv">More comparisons: ${COMPETITORS.filter((o) => o.slug !== c.slug)
      .map((o) => `<a href="${competitorPath(o)}">distribute.you vs ${esc(o.name)}</a>`)
      .join(" · ")} · ${cluster ? `<a href="${clusterAlternativesPath(cluster)}">${esc(cluster.name)} alternatives</a> · <a href="/compare">every comparison</a> · ` : ""}<a href="/alternatives">all alternatives</a></p>
  </div>
</section>`;

  return shell({
    title: comparePageTitle(c),
    description: comparePageDescription(c),
    path,
    body,
    jsonLd: [
      breadcrumb(
        cluster
          ? [
              { name: cluster.name, path: cluster.path },
              { name: `distribute.you vs ${c.name}`, path },
            ]
          : [
              { name: "Compare", path: "/compare" },
              { name: `distribute.you vs ${c.name}`, path },
            ],
      ),
      faqJsonLd(c.faq),
    ],
  });
}

function categoryGroups(): { category: Category; items: Competitor[] }[] {
  const order: Category[] = [
    "ai-sdr",
    "cold-email-tool",
    "data-platform",
    "sales-engagement",
    "linkedin-outreach",
    "inbound-routing",
    "post-purchase",
    "employee-advocacy",
  ];
  return order.map((category) => ({
    category,
    items: COMPETITORS.filter((c) => c.category === category),
  }));
}

function competitorCard(c: Competitor, verb: "vs" | "alternative"): string {
  const href = competitorPath(c);
  const label = verb === "vs" ? `distribute.you vs ${esc(c.name)}` : `${esc(c.name)} alternative`;
  return `<a class="cmp-card rv" href="${href}">
    <div class="cmp-card-top">${logo(c.domain, 32)}<div><b>${label}</b><small>${esc(c.entryPrice)}</small></div></div>
    <p>${esc(c.oneLiner)}</p>
  </a>`;
}

export function renderCompareHub(): string {
  const groups = categoryGroups()
    .map(
      (g) => `<h3>${esc(CATEGORY_LABEL[g.category])}</h3><div class="cmp-grid">${g.items.map((c) => competitorCard(c, "vs")).join("")}</div>`,
    )
    .join("");
  const body = `<section class="hero cmp-hero">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <span class="eyebrow">Compare · Verified ${COMPARE_VERIFIED_LABEL}</span>
    <h1>distribute.you <span class="accent">vs</span> the tools and agents you are weighing</h1>
    <p class="hero-sub">Every page reads the competitor's price from their own site, states where they win, and puts our measured cost per positive reply beside it. One thing is different on all of them: we run the campaign, they sell you the means to.</p>
    ${whyLine()}
  </div>
</section>
<section class="framed tint">
  <div class="wrap cmp-hub">${groups}</div>
</section>
${liveBand()}`;
  return shell({
    title: `Compare distribute.you with ${COMPETITORS.length} cold email tools and AI SDRs (${monthLabel(new Date())})`,
    description: `Side-by-side pages against ${COMPETITORS.length} cold email tools: entry price, who runs the campaign, whose domains send, and what a positive reply costs.`,
    path: "/compare",
    body,
    jsonLd: [breadcrumb([{ name: "Compare", path: "/compare" }])],
  });
}

export function renderAlternativesPage(): string {
  const groups = categoryGroups()
    .map(
      (g) => `<h3>${esc(CATEGORY_LABEL[g.category])}</h3><div class="cmp-grid">${g.items.map((c) => competitorCard(c, "alternative")).join("")}</div>`,
    )
    .join("");
  const body = `<section class="hero cmp-hero">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <span class="eyebrow">Alternatives · Verified ${COMPARE_VERIFIED_LABEL}</span>
    <h1>The alternative to running <span class="accent">outbound yourself</span></h1>
    <p class="hero-sub">Cold email tools, AI SDR agents and data platforms all sell you a way to run outbound. distribute.you is the alternative to all of them: we run it for you from domains we own, charges what the campaign spent, and shows what each positive reply cost.</p>
    ${whyLine()}
    <div class="cmp-cta"><a class="btn btn-accent btn-lg" href="${SIGN_UP}">Start free</a><a class="btn btn-outline btn-lg" href="/compare">Every comparison</a></div>
  </div>
</section>
<section class="framed tint">
  <div class="wrap">
    <div class="section-head"><span class="eyebrow">Looking for an alternative to</span><h2>Pick the one you are leaving</h2><p>Each page states the price you would pay them, read from their site, and what you pay us.</p></div>
    <div class="cmp-hub">${groups}</div>
  </div>
</section>
${liveBand()}`;
  return shell({
    title: `Alternatives to ${COMPETITORS.slice(0, 4).map((c) => c.name).join(", ")} and ${COMPETITORS.length - 4} more (${monthLabel(new Date())})`,
    description: `Weighing ${COMPETITORS.length} cold email tools? distribute.you is the AI agent that runs your outbound from our domains, free for one user, and shows what a positive reply costs.`,
    path: "/alternatives",
    body,
    jsonLd: [breadcrumb([{ name: "Alternatives", path: "/alternatives" }])],
  });
}

const AI_SDR_ALTERNATIVES_FAQ = [
  {
    q: "What is the best AI SDR alternative for a founder?",
    a: "distribute.you, if you want meetings without a demo or a contract: our AI agent finds your buyers, writes to them, answers the replies and books the meeting, free for one user at the API price with 0% markup.",
  },
  {
    q: "Which AI SDRs publish their price?",
    a: "Of the four here, only AiSDR prints a figure: $1.50 per person prospected on pay as you go. 11x, Artisan and Qualified ask for a demo first. distribute.you prints every action's price on its catalog.",
  },
  {
    q: "Is there an open source AI SDR?",
    a: "Yes. The GTM Factory behind distribute.you is open source under the MIT license. Run it on your own server with your own API keys, or let us host it, free for one user.",
  },
];

/** What one cluster's alternatives page says, beside the data every cluster shares. */
type AlternativesCopy = {
  cluster: CompareCluster;
  /** The noun for one row ("AI SDR", "Tool"). */
  rowLabel: string;
  sub: (names: string) => string;
  seeOurs: string;
  tableHead: string;
  faq: readonly { q: string; a: string }[];
  /** "distribute.you AI SDR". */
  ourName: string;
  stylesheet: string;
  /** Tools set side by side here whose own page sits in another cluster (Clay on the GTM page). */
  also?: readonly string[];
};

const AI_SDR_ALTERNATIVES: AlternativesCopy = {
  cluster: AI_SDR_CLUSTER,
  rowLabel: "AI SDR",
  sub: (names) => `${names} and distribute.you all sell an AI that books sales meetings. Here is what each one costs and how you start, read from their own sites.`,
  seeOurs: "See our AI SDR",
  tableHead: "Price, start and channels for each AI SDR",
  faq: AI_SDR_ALTERNATIVES_FAQ,
  ourName: "distribute.you AI SDR",
  stylesheet: `/landing/v2/ai-sdr.css?v=${AI_SDR_CSS_VERSION}`,
};

const AI_LEAD_GEN_ALTERNATIVES_FAQ = [
  {
    q: "What is the best AI lead generation alternative for a founder?",
    a: "distribute.you, if you want leads who answer rather than a database to search: our AI agent finds your leads from your website, judges each one, checks the email and writes to them, free for one user at the API price with 0% markup.",
  },
  {
    q: "Which lead tools publish their price?",
    a: "Apollo, Clay and Lusha publish the price of each plan. Seamless.AI is free for up to 50 credits, then quotes through its sales team. distribute.you prints every action's price on its catalog.",
  },
  {
    q: "Is there an open source AI lead generation tool?",
    a: "Yes. The GTM Factory behind distribute.you is open source under the MIT license. Run it on your own server with your own API keys, or let us host it, free for one user.",
  },
];

const AI_LEAD_GEN_ALTERNATIVES: AlternativesCopy = {
  cluster: AI_LEAD_GEN_CLUSTER,
  rowLabel: "Tool",
  sub: (names) => `${names} and distribute.you all help you find B2B leads. Here is what each one costs and how you start, read from their own sites.`,
  seeOurs: "See our AI lead generation",
  tableHead: "Price, start and what you get from each tool",
  faq: AI_LEAD_GEN_ALTERNATIVES_FAQ,
  ourName: "distribute.you AI lead generation",
  stylesheet: `/landing/v2/ai-lead-generation.css?v=${AI_LEAD_GEN_CSS_VERSION}`,
};

const COLD_EMAIL_AUTOMATION_ALTERNATIVES_FAQ = [
  {
    q: "What is the best cold email automation alternative for a founder?",
    a: "distribute.you, if you want the emails written, sent and answered rather than a tool to run: our AI agent finds your buyers from your website, writes each email, sends it from domains we own and answers the replies, free for one user at the API price with 0% markup.",
  },
  {
    q: "Which cold email tools publish their price?",
    a: "Instantly, Smartlead, Lemlist, Reply.io, Saleshandy, Woodpecker and Mailshake all publish the price of each plan. distribute.you prints every action's price on its catalog.",
  },
  {
    q: "Do I need my own mailboxes and domains?",
    a: "With the tools above, yes: you buy them, set them up and warm them, or buy them as an add-on. distribute.you sends from mailboxes and domains we own and warm, so your company domain never sends cold email.",
  },
  {
    q: "Is there an open source cold email automation tool?",
    a: "Yes. The GTM Factory behind distribute.you is open source under the MIT license. Run it on your own server with your own API keys, or let us host it, free for one user.",
  },
];

const COLD_EMAIL_AUTOMATION_ALTERNATIVES: AlternativesCopy = {
  cluster: COLD_EMAIL_AUTOMATION_CLUSTER,
  rowLabel: "Tool",
  sub: (names) => `${names} and distribute.you all help you send cold email. Here is what each one costs and how you start, read from their own sites.`,
  seeOurs: "See our cold email automation",
  tableHead: "Price, start and channels for each cold email tool",
  faq: COLD_EMAIL_AUTOMATION_ALTERNATIVES_FAQ,
  ourName: "distribute.you cold email automation",
  stylesheet: `/landing/v2/cold-email-automation.css?v=${COLD_EMAIL_AUTOMATION_CSS_VERSION}`,
};

const GTM_AUTOMATION_ALTERNATIVES_FAQ = [
  {
    q: "What is the best GTM automation alternative for a founder?",
    a: "distribute.you, if you want your go-to-market run rather than a platform to staff: one AI agent finds your buyers, writes from domains we own, answers, books the meeting and follows up, free for one user at the API price with 0% markup.",
  },
  {
    q: "Which GTM platforms publish their price?",
    a: "Default publishes its annual plans and seats, Unify its free, Base and Pro plans, Clay its plans, and Common Room its Essential plan. distribute.you prints every action's price on its catalog.",
  },
  {
    q: "Do these platforms send the emails for me?",
    a: "Mostly not: they enrich, score, route or sequence, and your reps or your sequencer do the sending. distribute.you sends from mailboxes and domains we own and warm, and answers the replies.",
  },
  {
    q: "Is there an open source GTM automation tool?",
    a: "Yes. The GTM Factory behind distribute.you is open source under the MIT license. Run it on your own server with your own API keys, or let us host it, free for one user.",
  },
];

const GTM_AUTOMATION_ALTERNATIVES: AlternativesCopy = {
  cluster: GTM_AUTOMATION_CLUSTER,
  rowLabel: "Platform",
  sub: (names) => `${names} and distribute.you all help a team run its go-to-market. Here is what each one costs and how you start, read from their own sites.`,
  seeOurs: "See our GTM automation",
  tableHead: "Price, start and channels for each GTM platform",
  faq: GTM_AUTOMATION_ALTERNATIVES_FAQ,
  ourName: "distribute.you GTM automation",
  stylesheet: `/landing/v2/gtm-automation.css?v=${GTM_AUTOMATION_CSS_VERSION}`,
  also: GTM_AUTOMATION_ALSO,
};

/** `/gtm-automation/alternatives`: the GTM platforms side by side, every figure read from their own site. */
export function renderGtmAutomationAlternativesPage(): string {
  return renderClusterAlternativesPage(GTM_AUTOMATION_ALTERNATIVES);
}

/** `/cold-email-automation/alternatives`: the cold email tools side by side, every figure read from their own site. */
export function renderColdEmailAutomationAlternativesPage(): string {
  return renderClusterAlternativesPage(COLD_EMAIL_AUTOMATION_ALTERNATIVES);
}

/** `/ai-sdr/alternatives`: the AI SDR agents side by side, every figure read from their own site. */
export function renderAiSdrAlternativesPage(): string {
  return renderClusterAlternativesPage(AI_SDR_ALTERNATIVES);
}

/** `/ai-lead-generation/alternatives`: the lead tools side by side, every figure read from their own site. */
export function renderAiLeadGenAlternativesPage(): string {
  return renderClusterAlternativesPage(AI_LEAD_GEN_ALTERNATIVES);
}

function renderClusterAlternativesPage(copy: AlternativesCopy): string {
  const { cluster } = copy;
  const PAGE = cluster.path;
  const ALT = clusterAlternativesPath(cluster);
  const also = (copy.also ?? []).map((slug) => competitorBySlug(slug)).filter((c): c is Competitor => !!c);
  const list = [...clusterCompetitors(cluster), ...also];
  const verified = new Date(`${list.map((c) => c.verifiedOn).sort().at(-1)}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const rows = list
    .map(
      (c) =>
        `<tr><th scope="row"><a href="${competitorPath(c)}">${esc(c.name)}</a></th><td>${esc(c.entryPrice)}</td><td>${esc(c.freeTier)}</td><td>${esc(c.channels)}</td><td><a href="${esc(c.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(c.domain)}</a></td></tr>`,
    )
    .join("");
  const table = `<table class="cmp-table cmp-alt-table">
    <thead><tr><th scope="col">${esc(copy.rowLabel)}</th><th scope="col">Entry price</th><th scope="col">Free to start</th><th scope="col">Channels</th><th scope="col">Source</th></tr></thead>
    <tbody>
      <tr class="us-row"><th scope="row"><a href="${PAGE}">distribute.you</a></th><td class="us">${esc(DISTRIBUTE_ROW.entryPrice)}</td><td class="us">Yes, for one user. Open source too.</td><td class="us">${esc(DISTRIBUTE_ROW.channels)}</td><td class="us"><a href="/catalog">Our catalog</a></td></tr>
      ${rows}
    </tbody>
  </table>`;
  const body = `<section class="hero cmp-hero">
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="wrap hero-inner">
    <span class="eyebrow">${esc(cluster.name)} alternatives · Verified ${esc(verified)}</span>
    <h1>${esc(cluster.name)} alternatives, <span class="accent">side by side</span></h1>
    <p class="hero-sub">${esc(copy.sub(list.map((c) => c.name).join(", ")))}</p>
    ${whyLine()}
    <div class="cmp-cta"><a class="btn btn-accent btn-lg" href="${SIGN_UP}">Start free</a><a class="btn btn-outline btn-lg" href="${PAGE}">${esc(copy.seeOurs)}</a></div>
  </div>
</section>
<section class="framed tint" id="table">
  <div class="wrap">
    <div class="section-head"><span class="eyebrow">Side by side</span><h2>${esc(copy.tableHead)}</h2><p>Ours is first. Each other row links the page we read it on.</p></div>
    <div class="cmp-table-wrap rv">${table}</div>
    <p class="cmp-source">Every competitor figure was read on its own site on ${esc(verified)}. Prices change; each link is the authority.</p>
  </div>
</section>
<section class="framed">
  <div class="wrap">
    <div class="section-head"><span class="eyebrow">One page each</span><h2>Pick the one you are weighing</h2></div>
    <div class="cmp-grid">${list.map((c) => competitorCard(c, "vs")).join("")}</div>
  </div>
</section>
${liveBand()}
<section class="framed" id="faq">
  <div class="wrap">
    <div class="section-head center rv"><h2>Questions about ${esc(cluster.name)} alternatives</h2></div>
    <div class="faq-list rv">${faqList(copy.faq)}</div>
    <p class="cmp-more rv">More: <a href="${PAGE}">${esc(copy.ourName)}</a> · <a href="/compare">every comparison</a> · <a href="/alternatives">all alternatives</a></p>
  </div>
</section>`;
  return shell({
    title: `${cluster.name} alternatives: ${list.map((c) => c.name).join(", ")} compared (${monthLabel(new Date())})`,
    description: `The best ${cluster.name} alternatives: ${list.map((c) => c.name).join(", ")} and distribute.you, with prices read from each one's own site.`,
    path: ALT,
    head: `<link rel="stylesheet" href="${copy.stylesheet}">`,
    body,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: `${cluster.name} alternatives`,
        url: `${SITE}${ALT}`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "distribute.you", url: `${SITE}${PAGE}` },
          ...list.map((c, i) => ({ "@type": "ListItem", position: i + 2, name: c.name, url: `${SITE}${competitorPath(c)}` })),
        ],
      },
      faqJsonLd(copy.faq),
      breadcrumb([
        { name: cluster.name, path: PAGE },
        { name: "Alternatives", path: ALT },
      ]),
    ],
  });
}
