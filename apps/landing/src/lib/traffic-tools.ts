/**
 * The tools the Website Traffic Automation page is compared with (PAGE-TRAFFIC-1030): one
 * entry per `/website-traffic-automation/vs/<slug>` page, the `/website-traffic-automation/alternatives`
 * list, the page's compare table, the sitemap and the page's footer all read it.
 *
 * Every figure is READ from the tool's own pricing page, with the URL it came from and the day
 * it was read (apps/landing/CLAUDE.md "A competitor figure is READ from their own site"). Read on
 * 2026-10-30: Outrank and Babylovegrowth (organic traffic on autopilot), Blaze (AI marketing:
 * posts, emails and ads), Taplio (LinkedIn growth). Left out the same day: SEObot (one figure,
 * no plans named), Buffer and Hypefury (schedulers, no traffic promise), Postwise (followers,
 * not visits). Traffic bots were never considered.
 *
 * `AgentTool` is the shape every AI Agent page's own tool cluster uses here (the AI Ad
 * Management page reads it too): `channel` is the one column that differs per page.
 *
 * Alias-free: the unit tests import it directly.
 */

export const TRAFFIC_AUTOMATION_PATH = "/website-traffic-automation";
export const TRAFFIC_AUTOMATION_ALTERNATIVES_PATH = `${TRAFFIC_AUTOMATION_PATH}/alternatives`;

export type ToolPlan = {
  /** The plan as the tool names it. */
  readonly plan: string;
  /** The price as the tool states it, with its unit and billing basis. */
  readonly price: string;
  /** What that price buys, in the tool's own terms. */
  readonly note: string;
};

export type AgentTool = {
  readonly slug: string;
  readonly name: string;
  /** Registrable domain, for the logo and the source check. */
  readonly domain: string;
  /** How they describe themselves, paraphrased from their own site. */
  readonly oneLiner: string;
  /** The pricing page every figure below was read from. */
  readonly sourceUrl: string;
  /** ISO day the source was read. */
  readonly verifiedOn: string;
  /** The cheapest way in, as a short label for the table. */
  readonly entryPrice: string;
  readonly prices: readonly ToolPlan[];
  readonly freeTier: string;
  /** The page's own column: how the tool brings traffic, or which ad networks it runs. */
  readonly channel: string;
  readonly whereTheyWin: readonly string[];
  readonly chooseThemIf: readonly string[];
};

/** How WE answer each row, stated once. */
export const OUR_TRAFFIC_ROW = {
  entryPrice: "Free, every action at the API price",
  pricing:
    "Free. Every buyer found, every message written and sent is billed at the vendor's API price, 0% markup, from a prepaid balance you start with $10.",
  freeTier: "Free, hosted. Open source under MIT to run yourself.",
  channel: "Cold email from our own domains and WhatsApp, to buyers chosen by name.",
  whoVisits: "Buyers our agent picked for you: the role, the company size and the market you sell to.",
  whatCounts: "Human clicks only. Our AI judge leaves link scanners out.",
} as const;

const OUTRANK = "https://www.outrank.so/pricing";
const BABYLOVEGROWTH = "https://www.babylovegrowth.ai/pricing";
const BLAZE = "https://blaze.ai/pricing";
const TAPLIO = "https://taplio.com/pricing";

export const TRAFFIC_TOOLS: readonly AgentTool[] = [
  {
    slug: "outrank",
    name: "Outrank",
    domain: "outrank.so",
    oneLiner: "Grows organic traffic on autopilot with blog posts written and published for you, plus backlinks.",
    sourceUrl: OUTRANK,
    verifiedOn: "2026-10-30",
    entryPrice: "From $99/month",
    prices: [
      { plan: "Organic Growth, monthly", price: "$99/month", note: "30 articles a month, written and published on autopilot, with keyword research and backlinks" },
      { plan: "Organic Growth, yearly", price: "$999/year", note: "The same plan, billed once a year" },
    ],
    freeTier: "A free trial. Trial articles carry an Outrank watermark.",
    channel: "Blog articles and backlinks, for Google and AI search.",
    whereTheyWin: [
      "One flat plan with 30 articles a month, published to WordPress, Webflow, Shopify and Framer.",
      "Articles in more than 150 languages, with every user in the team included.",
    ],
    chooseThemIf: ["You want organic traffic that builds up over months.", "You can wait for Google to rank new content."],
  },
  {
    slug: "babylovegrowth",
    name: "Babylovegrowth",
    domain: "babylovegrowth.ai",
    oneLiner: "Grows organic traffic from Google and AI search on autopilot, with articles, backlinks and Reddit and Quora agents.",
    sourceUrl: BABYLOVEGROWTH,
    verifiedOn: "2026-10-30",
    entryPrice: "From $59/month, billed yearly",
    prices: [
      { plan: "Grow", price: "$59/month, billed yearly", note: "30 branded articles a month, 10 AI prompts tracked, backlinks, auto publishing, Reddit and Quora agents" },
      { plan: "Scale", price: "$199/month, billed yearly", note: "120 articles a month in 4 languages, 50 prompts tracked, a dedicated specialist, unlimited seats" },
    ],
    freeTier: "A 3-day free trial, and a 90-day money back guarantee.",
    channel: "Articles, backlinks, Reddit and Quora answers, and social posts made from the articles.",
    whereTheyWin: [
      "Babylovegrowth tracks how you appear in ChatGPT, Claude and Gemini answers.",
      "A full refund if organic traffic does not grow within 90 days.",
    ],
    chooseThemIf: ["You want to show up in AI answer engines as well as Google.", "You are happy to pay for a year up front."],
  },
  {
    slug: "blaze",
    name: "Blaze",
    domain: "blaze.ai",
    oneLiner: "Marketing with AI: it plans, writes and posts your content while you review and approve each step.",
    sourceUrl: BLAZE,
    verifiedOn: "2026-10-30",
    entryPrice: "From $79/month",
    prices: [
      { plan: "Starter", price: "$79/month", note: "3 posting accounts, 600 generation credits a month, 1 user, automated ad campaigns" },
      { plan: "Growth", price: "$149/month", note: "10 posting accounts, 1,500 generation credits a month, unlimited users" },
      { plan: "All-In-One", price: "$999/month", note: "A managed funnel with a dedicated marketing expert, search ads and AI visibility" },
    ],
    freeTier: "A 7-day free trial on Starter and Growth, no credit card needed. 20% off on yearly plans.",
    channel: "AI social posts, emails and blogs, plus automated ad campaigns.",
    whereTheyWin: [
      "A brand identity, a content plan and the first week of posts on the first day.",
      "One tool for social posts, email, blog and ads.",
    ],
    chooseThemIf: ["You want one AI to run your content calendar.", "You would rather approve posts than write them."],
  },
  {
    slug: "taplio",
    name: "Taplio",
    domain: "taplio.com",
    oneLiner: "An all-in-one AI tool to grow your personal brand on LinkedIn.",
    sourceUrl: TAPLIO,
    verifiedOn: "2026-10-30",
    entryPrice: "From $39/month",
    prices: [
      { plan: "Starter", price: "$39/month, billed monthly", note: "Steady posting, quick scheduling, core analytics" },
      { plan: "Growth", price: "$69/month, billed monthly", note: "AI posts, faster replies and comments, team collaboration" },
      { plan: "Pro", price: "$199/month, billed monthly", note: "Unlimited AI posts and comments, automated lead outreach" },
    ],
    freeTier: "A 7-day trial with full Pro access, and a 30-day money back guarantee.",
    channel: "LinkedIn posts, comments and lead outreach.",
    whereTheyWin: [
      "A LinkedIn benchmark of more than 60,000 posts a month on every plan.",
      "Automated lead outreach on top of AI posts on the Pro plan.",
    ],
    chooseThemIf: ["Your buyers live on LinkedIn and your own name is the hook.", "You will post under your name every week."],
  },
];

export function trafficToolVsPath(t: Pick<AgentTool, "slug">): string {
  return `${TRAFFIC_AUTOMATION_PATH}/vs/${t.slug}`;
}

export function trafficToolBySlug(slug: string): AgentTool | undefined {
  return TRAFFIC_TOOLS.find((t) => t.slug === slug);
}

/** Every page of the cluster, for the sitemap. */
export function trafficToolClusterPaths(): string[] {
  return [TRAFFIC_AUTOMATION_ALTERNATIVES_PATH, ...TRAFFIC_TOOLS.map(trafficToolVsPath)];
}

/** The links the page's footer and its FAQ close on. */
export function trafficToolCompareLinks(): { label: string; href: string }[] {
  return [
    ...TRAFFIC_TOOLS.map((t) => ({ label: `distribute.you vs ${t.name}`, href: trafficToolVsPath(t) })),
    { label: "Website traffic automation alternatives", href: TRAFFIC_AUTOMATION_ALTERNATIVES_PATH },
  ];
}
