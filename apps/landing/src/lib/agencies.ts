/**
 * The agencies the GTM Agency page is compared with (PAGE-REVENUE-AGENCY-1029):
 * one entry per `/gtm-agency/vs/<slug>` page, the `/gtm-agency/alternatives`
 * list, the sitemap and the Agency footer all read it.
 *
 * Every figure is READ from the agency's own site, with the URL it came from and the
 * day it was read (apps/landing/CLAUDE.md "A competitor figure is READ from their own
 * site"). A price they do not publish is said so, never estimated. Martal Group was
 * checked on 2026-10-29 and left out: its site answered 403 to every read, so nothing
 * on it could be verified.
 *
 * Alias-free: the unit tests import it directly.
 */

export type AgencyFact = { readonly text: string; readonly sourceUrl: string };

export type Agency = {
  readonly slug: string;
  readonly name: string;
  readonly domain: string;
  /** How they describe themselves, paraphrased from their own site. */
  readonly oneLiner: AgencyFact;
  /** The pricing page the figures were read from. */
  readonly sourceUrl: string;
  readonly verifiedOn: string;
  /** Short label for the table: their cheapest stated way in, or "Not published". */
  readonly entryPrice: string;
  readonly pricing: AgencyFact;
  readonly contract: AgencyFact;
  readonly channels: AgencyFact;
  readonly guarantee: AgencyFact;
  readonly launch: AgencyFact | null;
  /** A headline figure they publish about themselves, quoted with its source. */
  readonly claim: AgencyFact;
  readonly whereTheyWin: readonly string[];
  readonly chooseThemIf: readonly string[];
};

/** How WE answer each row, stated once so the pages cannot describe us four ways. */
export const OUR_AGENCY_ROW = {
  entryPrice: "From $1K/month + 10% of budget",
  pricing: "From $1K a month, plus 10% of the budget you put into your campaigns. The budget goes to the campaigns themselves.",
  contract: "One call to start. Your budget is a hard cap you set.",
  channels: "Cold email from our own domains and WhatsApp, run by our team and our AI agents.",
  guarantee: "Every result is measured and shown: what you spent, who replied, which meetings came of it.",
  launch: "Live in 5 days from our first call.",
} as const;

export const AGENCIES: readonly Agency[] = [
  {
    slug: "belkins",
    name: "Belkins",
    domain: "belkins.io",
    oneLiner: {
      text: "A B2B outbound lead generation and appointment setting agency, working since 2017 on monthly retainer packages.",
      sourceUrl: "https://belkins.io/",
    },
    sourceUrl: "https://belkins.io/pricing",
    verifiedOn: "2026-10-29",
    entryPrice: "Not published",
    pricing: {
      text: "Monthly retainer packages (Growth, Growth Plus, For small business, Enterprise). No price is published on the pricing page.",
      sourceUrl: "https://belkins.io/pricing",
    },
    contract: {
      text: "Not stated on the pricing page; Enterprise gets custom SLAs and contract terms.",
      sourceUrl: "https://belkins.io/pricing",
    },
    channels: {
      text: "Cold email, LinkedIn, intent-based cold calling, Messenger and WhatsApp, executive dinners and conferences; Growth Plus adds paid ads, account-based marketing and webinars.",
      sourceUrl: "https://belkins.io/pricing",
    },
    guarantee: {
      text: "Their site says their approach guarantees 100 to 400 yearly appointments; no cost per meeting is published.",
      sourceUrl: "https://belkins.io/",
    },
    launch: {
      text: "Campaign set up and launched in the first 14 days, first appointments within the next 30 days.",
      sourceUrl: "https://belkins.io/",
    },
    claim: {
      text: "100 to 400+ qualified appointments a year, in their own words.",
      sourceUrl: "https://belkins.io/",
    },
    whereTheyWin: [
      "Many channels in one retainer, events and dinners included.",
      "A long track record across 50+ industries.",
    ],
    chooseThemIf: [
      "You want calls, LinkedIn and events run beside your email.",
      "You buy on a yearly appointment volume.",
    ],
  },
  {
    slug: "cience",
    name: "CIENCE",
    domain: "cience.com",
    oneLiner: {
      text: "Managed SDR teams that book qualified outbound meetings by phone, email and LinkedIn.",
      sourceUrl: "https://www.cience.com/",
    },
    sourceUrl: "https://www.cience.com/pricing/",
    verifiedOn: "2026-10-29",
    entryPrice: "$1,750/SDR/month + $2,499/month",
    pricing: {
      text: "Offshore SDRs from $1,750 per SDR per month (US and Europe from $3,500), plus a $2,000/month campaign team and the $499/month graph8 platform, plus a bonus on held meetings. Their own example: 5 offshore SDRs for $11,249 a month, plus bonus.",
      sourceUrl: "https://www.cience.com/pricing/",
    },
    contract: {
      text: "Month to month with no long contract, after a one-time setup fee (amount not published).",
      sourceUrl: "https://www.cience.com/pricing/",
    },
    channels: {
      text: "Phone, email, LinkedIn and website messaging, with ads and social as add-ons.",
      sourceUrl: "https://www.cience.com/",
    },
    guarantee: {
      text: "No guarantee; a bonus is paid on top when an SDR hits a monthly target of held meetings.",
      sourceUrl: "https://www.cience.com/pricing/",
    },
    launch: {
      text: "Live in less than 14 days after setup.",
      sourceUrl: "https://www.cience.com/pricing/",
    },
    claim: {
      text: "“5 to 20+ qualified meetings a month per SDR, depending on industry and target.”",
      sourceUrl: "https://www.cience.com/",
    },
    whereTheyWin: [
      "Human SDRs on the phone, priced per seat.",
      "A published price list, bonus formula included.",
    ],
    chooseThemIf: [
      "Cold calling is the channel that sells in your market.",
      "You want to size a team by the number of SDRs.",
    ],
  },
  {
    slug: "salesroads",
    name: "SalesRoads",
    domain: "salesroads.com",
    oneLiner: {
      text: "A US sales outsourcing company that builds dedicated SDR teams for outbound calling and email appointment setting.",
      sourceUrl: "https://salesroads.com/",
    },
    sourceUrl: "https://salesroads.com/pricing/",
    verifiedOn: "2026-10-29",
    entryPrice: "$11,950 per 4 weeks",
    pricing: {
      text: "$11,950 per 4-week period for one SDR; $16,750 for two ($8,375 each), down to $43,150 for six ($7,192 each).",
      sourceUrl: "https://salesroads.com/pricing/",
    },
    contract: {
      text: "No long-term commitment, cancel anytime; they recommend a full 12-week go-to-market lab.",
      sourceUrl: "https://salesroads.com/pricing/",
    },
    channels: {
      text: "Outbound calling and personalized email; inbound appointment setting and account reactivation as add-ons.",
      sourceUrl: "https://salesroads.com/pricing/",
    },
    guarantee: {
      text: "No guarantee and no cost per meeting published.",
      sourceUrl: "https://salesroads.com/pricing/",
    },
    launch: {
      text: "Launch in 15 business days.",
      sourceUrl: "https://salesroads.com/pricing/",
    },
    claim: {
      text: "“937 appointments for AchieveIt.”",
      sourceUrl: "https://salesroads.com/",
    },
    whereTheyWin: [
      "Dedicated US-based callers who learn your pitch.",
      "19+ years of outbound for B2B teams.",
    ],
    chooseThemIf: [
      "You need a US calling team on your account every day.",
      "Your deal size carries a five-figure monthly program.",
    ],
  },
  {
    slug: "saleshive",
    name: "SalesHive",
    domain: "saleshive.com",
    oneLiner: {
      text: "A B2B sales agency running lead generation, cold calling, cold email and appointment setting with US-based SDRs and its own AI platform.",
      sourceUrl: "https://saleshive.com/",
    },
    sourceUrl: "https://saleshive.com/pricing",
    verifiedOn: "2026-10-29",
    entryPrice: "Custom quote",
    pricing: {
      text: "Starter, Growth and Crush plans are custom quoted, by team location, channels and daily outreach volume. One flat monthly fee.",
      sourceUrl: "https://saleshive.com/pricing",
    },
    contract: {
      text: "No setup fees; month-to-month or annual plans. Cancelling month to month takes written notice and ends at the end of the next billing month.",
      sourceUrl: "https://saleshive.com/pricing",
    },
    channels: {
      text: "Cold calling (US or offshore), cold email, list building and reply handling.",
      sourceUrl: "https://saleshive.com/pricing",
    },
    guarantee: {
      text: "Their FAQ says they do not guarantee a number of meetings and do not price by the meeting.",
      sourceUrl: "https://saleshive.com/pricing",
    },
    launch: {
      text: "Most clients launch in about three weeks.",
      sourceUrl: "https://saleshive.com/pricing",
    },
    claim: {
      text: "“Qualified meetings booked 106K+”, counted since 2016.",
      sourceUrl: "https://saleshive.com/",
    },
    whereTheyWin: [
      "Calling and email from one team, US-based callers included.",
      "A self-serve workspace beside the managed plans.",
    ],
    chooseThemIf: [
      "You want cold calls in the mix from day one.",
      "You prefer one flat monthly fee, quoted for you.",
    ],
  },
];

export const AGENCY_PAGE_PATH = "/gtm-agency";
export const ALTERNATIVES_PATH = `${AGENCY_PAGE_PATH}/alternatives`;

export function agencyVsPath(a: Pick<Agency, "slug">): string {
  return `${AGENCY_PAGE_PATH}/vs/${a.slug}`;
}

export function agencyBySlug(slug: string): Agency | undefined {
  return AGENCIES.find((a) => a.slug === slug);
}

/** Every page of the cluster, for the sitemap. */
export function agencyClusterPaths(): string[] {
  return [ALTERNATIVES_PATH, ...AGENCIES.map(agencyVsPath)];
}

/** The links the Agency footer and the page close on. */
export function agencyCompareLinks(): { label: string; href: string }[] {
  return [
    ...AGENCIES.map((a) => ({ label: `distribute.you vs ${a.name}`, href: agencyVsPath(a) })),
    { label: "GTM agency alternatives", href: ALTERNATIVES_PATH },
  ];
}
