/**
 * The agencies the Cold Email Agency page is compared with (PAGE-COLD-EMAIL-AGENCY-1030): one
 * entry per `/cold-email-agency/vs/<slug>` page, the `/cold-email-agency/alternatives` list,
 * the sitemap and the page's footer all read it.
 *
 * Every figure is READ from the agency's own site, with the URL it came from and the day it was
 * read (apps/landing/CLAUDE.md "A competitor figure is READ from their own site"). Kept: the
 * cold email agencies whose price we could read on their own site. Sopro and Hypergen were read
 * on 2026-10-30; Callbox (lead generation cluster) and SalesRoads (GTM cluster) are reused as
 * they stand, so two clusters cannot describe one agency two ways. Checked the same day and left
 * out because no price is published: Belkins, SalesHive, Martal Group ("Inquire about pricing"),
 * Cleverly (cold email retainer quoted on a call). growthlead.io now serves Salesflow, a
 * software product, not an agency.
 *
 * Alias-free: the unit tests import it directly.
 */
import { agencyBySlug, type Agency } from "./agencies";
import { BEST_FOR_PAGES, COLD_EMAIL_AGENCY_HOME, bestForLinkLabel, bestForPath } from "./best-for";
import { LEADGEN_AGENCIES } from "./lead-generation-agencies";

export const COLD_EMAIL_PAGE_PATH = COLD_EMAIL_AGENCY_HOME;
export const COLD_EMAIL_ALTERNATIVES_PATH = `${COLD_EMAIL_PAGE_PATH}/alternatives`;

/** How WE answer each row on the cold email cluster, stated once. */
export const OUR_COLD_EMAIL_ROW = {
  entryPrice: "From $1K/month + 10% of budget",
  pricing: "From $1K a month, plus 10% of the budget you put into your campaigns. The budget pays for finding your buyers and sending to them.",
  contract: "One call to start. Your budget is a hard cap you set.",
  channels: "Cold email from our own domains and inboxes, every reply answered by our AI agents and our team.",
  guarantee: "6 booked meetings in 3 months or your paid media budget back. Every email, reply and booked meeting is counted on your dashboard, with what it came to.",
  launch: "Live in 5 days from our first call.",
} as const;

function fromCluster(list: readonly Agency[], slug: string, where: string): Agency {
  const a = list.find((x) => x.slug === slug);
  if (!a) throw new Error(`cold-email-agencies: no agency "${slug}" in ${where}`);
  return a;
}

const SOPRO: Agency = {
  slug: "sopro",
  name: "Sopro",
  domain: "sopro.io",
  oneLiner: {
    text: "A UK prospecting agency running fully managed B2B outreach by email and LinkedIn, on its own data and tech.",
    sourceUrl: "https://sopro.io/pricing/",
  },
  sourceUrl: "https://sopro.io/pricing/",
  verifiedOn: "2026-10-30",
  entryPrice: "From about £3K/month",
  pricing: {
    text: "Pricing starts at around £3K a month. No tiers are published: each campaign is quoted after a demo.",
    sourceUrl: "https://sopro.io/pricing/",
  },
  contract: {
    text: "No minimum contract.",
    sourceUrl: "https://sopro.io/pricing/",
  },
  channels: {
    text: "Email and LinkedIn outreach, display ads synced to your audience, gifting and intent tracking.",
    sourceUrl: "https://sopro.io/pricing/",
  },
  guarantee: {
    text: "No guarantee stated on the pricing page.",
    sourceUrl: "https://sopro.io/pricing/",
  },
  launch: {
    text: "Your campaign could be live in 3 weeks, in their own words.",
    sourceUrl: "https://sopro.io/pricing/",
  },
  claim: {
    text: "“630,388 conversations started” for 3,375 clients, on their pricing page.",
    sourceUrl: "https://sopro.io/pricing/",
  },
  whereTheyWin: [
    "Email, LinkedIn and display ads from one team.",
    "Their own B2B data, yours to download and keep.",
  ],
  chooseThemIf: [
    "You want LinkedIn and display ads run beside your email.",
    "You sell mostly in the UK and Europe.",
  ],
};

const HYPERGEN: Agency = {
  slug: "hypergen",
  name: "Hypergen",
  domain: "hypergen.io",
  oneLiner: {
    text: "A cold email and RevOps agency for B2B companies that want pipeline growth.",
    sourceUrl: "https://hypergen.io/",
  },
  sourceUrl: "https://hypergen.io/pricing",
  verifiedOn: "2026-10-30",
  entryPrice: "From $6,500/month",
  pricing: {
    text: "Lite: from $6,500 a month for 7,500 prospects contacted monthly. Standard (15,000 prospects) and Custom are priced on a call.",
    sourceUrl: "https://hypergen.io/pricing",
  },
  contract: {
    text: "A 6-month minimum agreement on every plan.",
    sourceUrl: "https://hypergen.io/pricing",
  },
  channels: {
    text: "Cold email, with CRM integration and website visitor nurturing set up beside it.",
    sourceUrl: "https://hypergen.io/pricing",
  },
  guarantee: {
    text: "No guarantee stated on the pricing page.",
    sourceUrl: "https://hypergen.io/pricing",
  },
  launch: {
    text: "Less than a month from onboarding to campaign launch, and 7 days to a first lead on average.",
    sourceUrl: "https://hypergen.io/pricing",
  },
  claim: {
    text: "“We’ve Helped 120+ Clients Book Meetings And Close Deals.”",
    sourceUrl: "https://hypergen.io/",
  },
  whereTheyWin: [
    "CRM and deliverability work sold beside the outreach.",
    "A published entry price for a stated prospect volume.",
  ],
  chooseThemIf: [
    "You want your CRM rebuilt along with your cold email.",
    "You are ready to sign for six months up front.",
  ],
};

export const COLD_EMAIL_AGENCIES: readonly Agency[] = [
  SOPRO,
  HYPERGEN,
  fromCluster(LEADGEN_AGENCIES, "callbox", "lead-generation-agencies.ts"),
  (() => {
    const a = agencyBySlug("salesroads");
    if (!a) throw new Error('cold-email-agencies: no agency "salesroads" in agencies.ts');
    return a;
  })(),
];

export function coldEmailVsPath(a: Pick<Agency, "slug">): string {
  return `${COLD_EMAIL_PAGE_PATH}/vs/${a.slug}`;
}

export function coldEmailAgencyBySlug(slug: string): Agency | undefined {
  return COLD_EMAIL_AGENCIES.find((a) => a.slug === slug);
}

/** The rankings that live under the page (`/cold-email-agency/best/<slug>`). */
export function coldEmailBestLinks(): { label: string; href: string }[] {
  return BEST_FOR_PAGES.filter((p) => p.home === COLD_EMAIL_PAGE_PATH).map((p) => ({ label: bestForLinkLabel(p), href: bestForPath(p) }));
}

/** Every vs/alternatives page of the cluster, for the sitemap (the rankings come from `bestForPaths`). */
export function coldEmailClusterPaths(): string[] {
  return [COLD_EMAIL_ALTERNATIVES_PATH, ...COLD_EMAIL_AGENCIES.map(coldEmailVsPath)];
}

/** The links the page's footer and its FAQ close on: vs pages, alternatives, then its rankings. */
export function coldEmailCompareLinks(): { label: string; href: string }[] {
  return [
    ...COLD_EMAIL_AGENCIES.map((a) => ({ label: `distribute.you vs ${a.name}`, href: coldEmailVsPath(a) })),
    { label: "Cold email agency alternatives", href: COLD_EMAIL_ALTERNATIVES_PATH },
    ...coldEmailBestLinks(),
  ];
}
