/**
 * The agencies the Website Traffic Agency page is compared with (PAGE-TRAFFIC-1030): one entry
 * per `/website-traffic-agency/vs/<slug>` page, the `/website-traffic-agency/alternatives` list,
 * the page's compare table, the sitemap and the page's footer all read it.
 *
 * Traffic and demand generation agencies for B2B, never SEO agencies (we do not sell SEO, and
 * "seo agency" is not the page's keyword). Every figure is READ from the agency's own site, with
 * the URL it came from and the day it was read (apps/landing/CLAUDE.md "A competitor figure is
 * READ from their own site"). Read on 2026-10-30. SaaSHero's own pages disagree (a blog post
 * says $1,250 a month, month to month); its /pricing page is the one used. Left out the same day,
 * for want of a readable price on their own site: Hey Digital (only a design subscription is
 * priced), Single Grain (custom pricing), NoGood and Growth Spree (pricing pages 404).
 *
 * Alias-free: the unit tests import it directly.
 */
import type { Agency } from "./agencies";

export const TRAFFIC_AGENCY_PATH = "/website-traffic-agency";
export const TRAFFIC_AGENCY_ALTERNATIVES_PATH = `${TRAFFIC_AGENCY_PATH}/alternatives`;

/** How WE answer each row on the Website Traffic Agency cluster, stated once. */
export const OUR_TRAFFIC_AGENCY_ROW = {
  entryPrice: "From $1K/month + 10% of budget",
  pricing: "From $1K a month, plus 10% of the budget you put into your campaigns. The budget pays for reaching your buyers.",
  contract: "One call to start. Your budget is a hard cap you set.",
  channels: "Outreach to the buyers you choose, by cold email from our own domains and on WhatsApp.",
  guarantee: "Every visit is judged human before it counts, and every visitor's role and company is on your dashboard.",
  launch: "Live in 5 days from our first call.",
} as const;

const SAASHERO = "https://www.saashero.net/pricing/";
const IMPACTABLE = "https://impactable.com/paid-ads/";
const PBS = "https://www.poweredbysearch.com/pricing/";
const KALUNGI = "https://www.kalungi.com/services/full-service";

export const TRAFFIC_AGENCIES: readonly Agency[] = [
  {
    slug: "saashero",
    name: "SaaSHero",
    domain: "saashero.net",
    oneLiner: {
      text: "A B2B performance marketing agency for SaaS companies, on flat monthly retainers.",
      sourceUrl: "https://www.saashero.net/strategy/performance-marketing-agency-pricing/",
    },
    sourceUrl: SAASHERO,
    verifiedOn: "2026-10-30",
    entryPrice: "From $4,500/month",
    pricing: {
      text: "One flat monthly fee with every ad channel included. Growth Team: $4,500 a month for up to $10k of ad spend. Growth Team + Creative: $6,000 a month.",
      sourceUrl: SAASHERO,
    },
    contract: { text: "One 3-month agreement, billed monthly.", sourceUrl: SAASHERO },
    channels: {
      text: "Google Ads, Microsoft Ads, LinkedIn, Meta, Reddit, X and Capterra ads.",
      sourceUrl: SAASHERO,
    },
    guarantee: { text: "No guarantee stated on the pricing page.", sourceUrl: SAASHERO },
    launch: { text: "About 3 to 4 weeks from the kickoff call to launch across channels.", sourceUrl: SAASHERO },
    claim: { text: "“TripMaster adds $504,758 in Net New ARR in One Year”.", sourceUrl: SAASHERO },
    whereTheyWin: [
      "One flat fee covers every ad channel, with no share of spend and no setup fee.",
      "Creative add-ons with public prices, such as landing pages.",
    ],
    chooseThemIf: [
      "You are a B2B SaaS company that wants ads on several networks for one fee.",
      "You can sign a 3-month agreement and launch in about a month.",
    ],
  },
  {
    slug: "impactable",
    name: "Impactable",
    domain: "impactable.com",
    oneLiner: { text: "A B2B paid ads agency known for LinkedIn Ads, with 84 marketing experts.", sourceUrl: IMPACTABLE },
    sourceUrl: IMPACTABLE,
    verifiedOn: "2026-10-30",
    entryPrice: "From $1.5K/month + 15% of ad budget",
    pricing: {
      text: "Strategic: $1.5k a month plus 15% of ad budget, up to $25k of spend, $3k a month minimum. Custom: 15% to 7% of ad budget above $25k. Impactable suggests $5,000 to $10,000 a month of ad spend to start.",
      sourceUrl: IMPACTABLE,
    },
    contract: { text: "A 90-day discovery phase first, then 3, 6 or 12-month agreements.", sourceUrl: IMPACTABLE },
    channels: { text: "LinkedIn Ads, Google Ads, Meta, YouTube, programmatic display and email campaigns.", sourceUrl: IMPACTABLE },
    guarantee: { text: "No guarantee stated.", sourceUrl: IMPACTABLE },
    launch: null,
    claim: { text: "“84 marketing experts including 20+ LinkedIn-certified insiders”.", sourceUrl: IMPACTABLE },
    whereTheyWin: ["Deep LinkedIn Ads skills, with many certified staff.", "A published entry fee and minimum."],
    chooseThemIf: ["LinkedIn is your main B2B channel.", "You can spend $5,000 to $10,000 a month on ads."],
  },
  {
    slug: "powered-by-search",
    name: "Powered by Search",
    domain: "poweredbysearch.com",
    oneLiner: {
      text: "A B2B paid media agency for companies with long sales cycles, measured on pipeline.",
      sourceUrl: "https://www.poweredbysearch.com/learn/best-b2b-paid-media-agencies/",
    },
    sourceUrl: PBS,
    verifiedOn: "2026-10-30",
    entryPrice: "From $6,000/month",
    pricing: {
      text: "Paid Media Startup from $6,000 a month for one channel, Scale Up from $14,400 for 2 to 3 channels, Enterprise from $21,600 with ABM.",
      sourceUrl: PBS,
    },
    contract: {
      text: "Not stated on the pricing page. A pilot is credited to the first invoice if you upgrade within 30 days.",
      sourceUrl: PBS,
    },
    channels: { text: "Google, LinkedIn, Meta and more.", sourceUrl: PBS },
    guarantee: { text: "No guarantee stated.", sourceUrl: PBS },
    launch: { text: "Core campaigns launch in month 1; pipeline begins in the first quarter.", sourceUrl: PBS },
    claim: {
      text: "“200+ B2B clients across software, cybersecurity, fintech, healthtech, and industrial technology”.",
      sourceUrl: "https://www.poweredbysearch.com/learn/best-b2b-paid-media-agencies/",
    },
    whereTheyWin: ["Every tier and pilot has a published price.", "You keep your ad accounts and their billing."],
    chooseThemIf: ["You sell B2B with a long sales cycle and judge ads on pipeline.", "You can pay $6,000 a month for one channel."],
  },
  {
    slug: "kalungi",
    name: "Kalungi",
    domain: "kalungi.com",
    oneLiner: { text: "A full-service B2B SaaS marketing team of 10+ people, sold as one engagement.", sourceUrl: KALUNGI },
    sourceUrl: KALUNGI,
    verifiedOn: "2026-10-30",
    entryPrice: "From $50,000/month",
    pricing: { text: "A full-service engagement costs $50,000+ a month, in place of 8 to 12 hires.", sourceUrl: KALUNGI },
    contract: { text: "Not stated on the page.", sourceUrl: KALUNGI },
    channels: {
      text: "ABM, outbound, paid social and demand generation, SEO and content, conversion work, web and brand, lifecycle email.",
      sourceUrl: KALUNGI,
    },
    guarantee: { text: "No guarantee stated.", sourceUrl: KALUNGI },
    launch: { text: "Execution is live by week 4.", sourceUrl: KALUNGI },
    claim: { text: "“$4.7M added in Pipeline in 16 months”.", sourceUrl: KALUNGI },
    whereTheyWin: ["One team for all of B2B SaaS marketing, strategy to execution.", "A launch date on the page: live by week 4."],
    chooseThemIf: ["You are a funded SaaS company replacing a whole marketing department.", "You can spend $50,000+ a month."],
  },
];

export function trafficAgencyVsPath(a: Pick<Agency, "slug">): string {
  return `${TRAFFIC_AGENCY_PATH}/vs/${a.slug}`;
}

export function trafficAgencyBySlug(slug: string): Agency | undefined {
  return TRAFFIC_AGENCIES.find((a) => a.slug === slug);
}

/** Every page of the cluster, for the sitemap. */
export function trafficAgencyClusterPaths(): string[] {
  return [TRAFFIC_AGENCY_ALTERNATIVES_PATH, ...TRAFFIC_AGENCIES.map(trafficAgencyVsPath)];
}

/** The links the page's footer and its FAQ close on. */
export function trafficAgencyCompareLinks(): { label: string; href: string }[] {
  return [
    ...TRAFFIC_AGENCIES.map((a) => ({ label: `distribute.you vs ${a.name}`, href: trafficAgencyVsPath(a) })),
    { label: "Website traffic agency alternatives", href: TRAFFIC_AGENCY_ALTERNATIVES_PATH },
  ];
}
