/**
 * The agencies the User Acquisition Agency page is compared with (PAGE-USER-ACQUISITION-AGENCY-1030):
 * one entry per `/user-acquisition-agency/vs/<slug>` page, the `/user-acquisition-agency/alternatives`
 * list, the page's cost table, the sitemap and the page's footer all read it.
 *
 * Each one sells SaaS growth (users, signups, pipeline) and publishes a price. Every figure is READ
 * from the agency's own site, with the URL it came from and the day it was read (apps/landing/CLAUDE.md
 * "A competitor figure is READ from their own site"). Checked on 2026-10-30 and left out: Kalungi,
 * SimpleTiger, Hey Digital, Directive, AppAgent and Admiral Media (fee quoted on request only), Skale,
 * Embryo, NoGood and Ladder (no pricing page), Growth Machine and Growth Rocket (page refused or empty).
 *
 * Alias-free: the unit tests import it directly.
 */
import type { Agency } from "./agencies";

export const UA_PAGE_PATH = "/user-acquisition-agency";
export const UA_ALTERNATIVES_PATH = `${UA_PAGE_PATH}/alternatives`;

/** How WE answer each row on the user acquisition cluster, stated once. */
export const OUR_UA_ROW = {
  entryPrice: "From $1K/month + 10% of budget",
  pricing: "From $1K a month, plus 10% of the budget you put into your campaigns. The budget goes to reaching new users.",
  contract: "One call to start. Your budget is a hard cap you set.",
  channels: "Cold email from our own domains and WhatsApp, then a follow-up for every visit and signup until they pay. Run by our team and our AI agents.",
  guarantee: "Every visit, signup and payment is measured and shown, with what it cost you.",
  launch: "Live in 5 days from our first call.",
} as const;

const SAAS_HERO = "https://www.saashero.net/pricing/";
const PBS = "https://www.poweredbysearch.com/pricing/";
const GRIPPED_PRICING = "https://www.gripped.io/pricing";
const GRIPPED = "https://www.gripped.io/";
const RTR_PRICING = "https://www.rocktherankings.com/pricing/";
const RTR = "https://www.rocktherankings.com/";

export const UA_AGENCIES: readonly Agency[] = [
  {
    slug: "saas-hero",
    name: "SaaS Hero",
    domain: "saashero.net",
    oneLiner: { text: "A performance marketing agency for B2B SaaS that runs paid ads for a flat monthly fee.", sourceUrl: "https://www.saashero.net/" },
    sourceUrl: SAAS_HERO,
    verifiedOn: "2026-10-30",
    entryPrice: "From $4,500/month",
    pricing: {
      text: "Growth Team is $4,500 a month for up to $10k of monthly ad spend, and $6,000 a month with creative. Landing pages are $750 or $950 each.",
      sourceUrl: SAAS_HERO,
    },
    contract: { text: "One 3 month agreement billed monthly, with discounts for 3 and 6 month commitments.", sourceUrl: SAAS_HERO },
    channels: {
      text: "Paid search and paid social on Google, Microsoft, LinkedIn, Meta, Reddit and X, plus landing pages, ad creative and programmatic SEO.",
      sourceUrl: SAAS_HERO,
    },
    guarantee: { text: "No guarantee is stated.", sourceUrl: SAAS_HERO },
    launch: { text: "About 3 to 4 weeks from the kickoff call to launch.", sourceUrl: SAAS_HERO },
    claim: { text: "\"Clients generally see 3x SQL growth within 90 days.\"", sourceUrl: "https://www.saashero.net/" },
    whereTheyWin: [
      "One flat fee covers every ad channel, with item prices for creative and landing pages.",
      "A 3 month term keeps the first commitment short.",
    ],
    chooseThemIf: ["You want paid search and paid social run for you.", "You spend about $10k a month on ads or less.", "You want a short first term."],
  },
  {
    slug: "powered-by-search",
    name: "Powered by Search",
    domain: "poweredbysearch.com",
    oneLiner: { text: "A B2B marketing agency that staffs senior teams to build a revenue engine for SaaS companies.", sourceUrl: PBS },
    sourceUrl: PBS,
    verifiedOn: "2026-10-30",
    entryPrice: "From $5,000/month",
    pricing: {
      text: "Paid media management runs from $5,000 or $6,000 a month for startups to $18,000 or $21,600 a month for enterprise, the two figures behind a monthly or quarterly toggle. SEO and AI search ranking starts at $7,500 or $9,000 a month.",
      sourceUrl: PBS,
    },
    contract: { text: "No term is stated on the page.", sourceUrl: PBS },
    channels: {
      text: "Paid media on Google, LinkedIn and Meta, SEO and AI search, digital PR, ABM, content, HubSpot RevOps and SaaS web design.",
      sourceUrl: PBS,
    },
    guarantee: { text: "No guarantee is stated. A paid audit is credited to the first retainer invoice within 30 days.", sourceUrl: PBS },
    launch: { text: "Pipeline in the first quarter, on 12 week programs.", sourceUrl: PBS },
    claim: { text: "\"87% of our clients hit their Q2 pipeline goals.\"", sourceUrl: PBS },
    whereTheyWin: [
      "Paid, SEO and RevOps under one roof, with a price for every tier.",
      "A paid audit to start, credited toward the retainer.",
    ],
    chooseThemIf: ["You want senior people only on your account.", "You want paid, SEO and RevOps from one team.", "You want to start with a paid audit."],
  },
  {
    slug: "gripped",
    name: "Gripped",
    domain: "gripped.io",
    oneLiner: { text: "A B2B digital marketing agency that works as the outsourced marketing team of SaaS, AI and tech companies.", sourceUrl: GRIPPED },
    sourceUrl: GRIPPED_PRICING,
    verifiedOn: "2026-10-30",
    entryPrice: "From £3,500/month",
    pricing: {
      text: "Advisory or execution from £3,500 a month plus project fees, one or two channels at £7,500 a month, and full demand generation at £15,000 a month. Ad budget is separate, plus a one time onboarding fee.",
      sourceUrl: GRIPPED_PRICING,
    },
    contract: { text: "Rolling contracts with three months notice; the FAQ also mentions 6 to 12 month commitments.", sourceUrl: GRIPPED },
    channels: {
      text: "Demand and lead generation, ABM, paid search, paid social, LinkedIn Ads, SEO, AI search, content, marketing ops and website design.",
      sourceUrl: GRIPPED_PRICING,
    },
    guarantee: { text: "No guarantee is stated.", sourceUrl: GRIPPED_PRICING },
    launch: null,
    claim: { text: "\"Gripped is the B2B digital marketing agency that's helped 160+ SaaS, AI and tech companies\"", sourceUrl: GRIPPED },
    whereTheyWin: [
      "The lowest published entry price of this list, from advisory up to full demand generation.",
      "A whole outsourced marketing team, for UK and European SaaS companies.",
    ],
    chooseThemIf: ["You want a full outsourced marketing team.", "You pay in pounds.", "Your own team runs the work and needs strategy."],
  },
  {
    slug: "rock-the-rankings",
    name: "Rock The Rankings",
    domain: "rocktherankings.com",
    oneLiner: { text: "A founder led SEO and AI search agency for B2B SaaS, judged on pipeline and revenue.", sourceUrl: RTR },
    sourceUrl: RTR_PRICING,
    verifiedOn: "2026-10-30",
    entryPrice: "From $5,500/month",
    pricing: {
      text: "Strategy and consulting from $5,500 a month, done for you from $8,650 and authority from $15,000, on the 90 day rate. Month to month costs $500 to $1,000 more a month.",
      sourceUrl: RTR_PRICING,
    },
    contract: { text: "Month to month with 30 days notice, or discounted 90 day and 12 month terms.", sourceUrl: RTR_PRICING },
    channels: { text: "SEO, AI search, content, link and citation building, and technical SEO.", sourceUrl: RTR_PRICING },
    guarantee: { text: "No guarantee is stated; weekly reporting and ROI scenarios instead.", sourceUrl: RTR_PRICING },
    launch: { text: "A 21 day foundation phase, then execution to day 90.", sourceUrl: RTR_PRICING },
    claim: { text: "\"300+ engagements. Founder-led. Always pipeline-driven.\"", sourceUrl: RTR },
    whereTheyWin: [
      "Signups and demos from Google and AI search, which keep coming after the work stops.",
      "Clear tiers and a month to month option.",
    ],
    chooseThemIf: ["You want signups from search, not outreach.", "You can wait a quarter for search to grow.", "You want the founder on your account."],
  },
];

export function uaVsPath(a: Pick<Agency, "slug">): string {
  return `${UA_PAGE_PATH}/vs/${a.slug}`;
}

export function uaAgencyBySlug(slug: string): Agency | undefined {
  return UA_AGENCIES.find((a) => a.slug === slug);
}

/** Every page of the cluster, for the sitemap. */
export function uaClusterPaths(): string[] {
  return [UA_ALTERNATIVES_PATH, ...UA_AGENCIES.map(uaVsPath)];
}

/** The links the page's footer and its FAQ close on. */
export function uaCompareLinks(): { label: string; href: string }[] {
  return [
    ...UA_AGENCIES.map((a) => ({ label: `distribute.you vs ${a.name}`, href: uaVsPath(a) })),
    { label: "User acquisition agency alternatives", href: UA_ALTERNATIVES_PATH },
  ];
}
