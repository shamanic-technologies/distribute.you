/**
 * The tools the AI Ad Management page is compared with (PAGE-TRAFFIC-1030): one entry per
 * `/ai-ad-management/vs/<slug>` page, the `/ai-ad-management/alternatives` list, the page's
 * compare table, the sitemap and the page's footer all read it.
 *
 * Every figure is READ from the tool's own pricing page, with the URL it came from and the day
 * it was read (apps/landing/CLAUDE.md "A competitor figure is READ from their own site"). Read on
 * 2026-10-30: Optmyzr (the price table in the page's own HTML; a September sale price on the
 * page had ended and is not used), Adzooma, AdEspresso, Ryze AI. Left out the same day: Bïrch
 * (formerly Revealbot: its cards contradict each other and the overage share is blank), Madgicx
 * (price shown only inside the app), AdCreative.ai (pricing page 404, and it makes creatives).
 *
 * Every tool here manages ad ACCOUNTS (Google, Meta, ...). We manage none: the page says so, and
 * our row states where the budget goes instead (outreach to buyers chosen by name).
 *
 * Alias-free: the unit tests import it directly.
 */
import type { AgentTool } from "./traffic-tools";

export const AD_MANAGEMENT_PATH = "/ai-ad-management";
export const AD_MANAGEMENT_ALTERNATIVES_PATH = `${AD_MANAGEMENT_PATH}/alternatives`;

/** How WE answer each row, stated once. */
export const OUR_AD_ROW = {
  entryPrice: "Free for one user, every action at the API price",
  pricing:
    "Free for one user. $9 per user for a team. Your budget pays for each action at the vendor's API price, 0% markup, from a prepaid balance you start with $10.",
  freeTier: "Free for one user, hosted. Open source under MIT to run yourself.",
  channel: "Outreach by cold email and WhatsApp, to buyers chosen by name. We run no ad account.",
  whoSees: "Buyers our agent picked for you, each one by name.",
  whatCounts: "Human clicks only, then every signup is followed up on WhatsApp.",
} as const;

const OPTMYZR = "https://www.optmyzr.com/pricing/";
const ADZOOMA = "https://www.adzooma.com/pricing";
const ADESPRESSO = "https://adespresso.com/pricing/";
const RYZE = "https://www.get-ryze.ai/pricing";

export const AD_TOOLS: readonly AgentTool[] = [
  {
    slug: "optmyzr",
    name: "Optmyzr",
    domain: "optmyzr.com",
    oneLiner: "A PPC toolkit: connect your ad accounts and get tools to analyse, optimise and automate them.",
    sourceUrl: OPTMYZR,
    verifiedOn: "2026-10-30",
    entryPrice: "From $209/month, billed yearly",
    prices: [
      { plan: "Essentials", price: "$299/month billed monthly, $209/month billed yearly, up to $25K ad spend", note: "The core toolkit and reporting, up to 25 accounts. The price grows with your ad spend" },
      { plan: "Premium", price: "$389/month billed monthly, $272/month billed yearly, up to $25K ad spend", note: "The complete toolkit, full reporting, email support" },
      { plan: "Enterprise", price: "Custom", note: "Unlimited ad accounts, SSO, a dedicated account manager" },
    ],
    freeTier: "A 14-day free trial, no credit card needed.",
    channel: "Google Ads, Microsoft Ads, Amazon Ads, Meta Ads, LinkedIn Ads and Yahoo! Japan Ads.",
    whereTheyWin: [
      "Six ad networks in one toolkit.",
      "API integrations, SSO and an account manager for large teams.",
    ],
    chooseThemIf: ["You run large search and shopping accounts on several networks.", "You want hands-on tools to optimise them yourself."],
  },
  {
    slug: "adzooma",
    name: "Adzooma",
    domain: "adzooma.com",
    oneLiner: "Makes managing paid ad campaigns simple across Google, Microsoft and Facebook Ads.",
    sourceUrl: ADZOOMA,
    verifiedOn: "2026-10-30",
    entryPrice: "Free, then from $69/month",
    prices: [
      { plan: "Free", price: "$0", note: "Monthly PPC reports and opportunities, 3 alerts, 1 user seat" },
      { plan: "Silver", price: "$69/month, or $700/year", note: "Weekly reports, every opportunity, custom alerts, unlimited user seats" },
      { plan: "Gold", price: "$179/month, or $1,800/year", note: "Daily reports and opportunities, unlimited alerts" },
      { plan: "Enterprise", price: "Custom", note: "Built to your needs, through their sales team" },
    ],
    freeTier: "A free plan with no time limit.",
    channel: "Google Ads, Microsoft Ads and Facebook Ads.",
    whereTheyWin: [
      "A free plan forever, with unlimited ad accounts on every plan.",
      "PPC alerts and opportunities by email and Slack.",
    ],
    chooseThemIf: ["You want a free way to watch your Google, Microsoft and Meta campaigns.", "You mostly need reports and alerts."],
  },
  {
    slug: "adespresso",
    name: "AdEspresso",
    domain: "adespresso.com",
    oneLiner: "A Facebook advertising tool to create, test and manage your ads in one place.",
    sourceUrl: ADESPRESSO,
    verifiedOn: "2026-10-30",
    entryPrice: "From $49/month",
    prices: [
      { plan: "Starter", price: "$49/month", note: "Up to $1,000 of ad spend a month, unlimited ad accounts, Facebook and Instagram" },
      { plan: "Plus", price: "$99/month", note: "Unlimited ad spend, cross-campaign triggers, bulk creation, up to 15 seats" },
      { plan: "Enterprise", price: "From $259/month", note: "A dedicated Facebook marketing consultant, live training, API access" },
    ],
    freeTier: "A 14-day free trial on every plan.",
    channel: "Facebook and Instagram ads.",
    whereTheyWin: [
      "Split test reports and automatic optimisation on every plan.",
      "Campaign approval and white label reports for teams.",
    ],
    chooseThemIf: ["All your paid ads run on Facebook and Instagram.", "You test many ad versions and want simple split test reports."],
  },
  {
    slug: "ryze-ai",
    name: "Ryze AI",
    domain: "get-ryze.ai",
    oneLiner: "An AI marketer whose agents improve your ads day and night on Google, Meta, TikTok and LinkedIn.",
    sourceUrl: RYZE,
    verifiedOn: "2026-10-30",
    entryPrice: "From $89/month",
    prices: [
      { plan: "Paid Ads", price: "$89/month billed monthly", note: "AI ad autopilot, AI ad creatives, competitor ad research, unlimited ad accounts" },
      { plan: "Agency", price: "$279/month billed monthly", note: "Unlimited client workspaces, 3,000 credits a month, white label" },
      { plan: "Managed Campaigns, optional", price: "5% of the managed spend on smaller budgets, falling to 0.8% as the daily budget grows", note: "Ryze runs the campaigns for you" },
    ],
    freeTier: "A 7-day free trial on Paid Ads and Agency.",
    channel: "Google Ads, Meta, TikTok and LinkedIn, plus more than 50 integrations.",
    whereTheyWin: [
      "A flat monthly fee that stays the same whatever you spend on ads.",
      "AI agents that change your campaigns on their own and make ad creatives.",
    ],
    chooseThemIf: ["You want AI to run your ad accounts on several networks.", "You want the software price fixed before your ad spend grows."],
  },
];

export function adToolVsPath(t: Pick<AgentTool, "slug">): string {
  return `${AD_MANAGEMENT_PATH}/vs/${t.slug}`;
}

export function adToolBySlug(slug: string): AgentTool | undefined {
  return AD_TOOLS.find((t) => t.slug === slug);
}

/** Every page of the cluster, for the sitemap. */
export function adToolClusterPaths(): string[] {
  return [AD_MANAGEMENT_ALTERNATIVES_PATH, ...AD_TOOLS.map(adToolVsPath)];
}

/** The links the page's footer and its FAQ close on. */
export function adToolCompareLinks(): { label: string; href: string }[] {
  return [
    ...AD_TOOLS.map((t) => ({ label: `distribute.you vs ${t.name}`, href: adToolVsPath(t) })),
    { label: "AI ad management alternatives", href: AD_MANAGEMENT_ALTERNATIVES_PATH },
  ];
}
