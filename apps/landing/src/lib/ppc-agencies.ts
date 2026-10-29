/**
 * The agencies the PPC Agency page is compared with (PAGE-PPC-AGENCY-1029): one entry per
 * `/ppc-agency/vs/<slug>` page, the `/ppc-agency/alternatives` list, the sitemap and the
 * page's footer all read it.
 *
 * Every figure is READ from the agency's own site, with the URL it came from and the day it
 * was read (apps/landing/CLAUDE.md "A competitor figure is READ from their own site"). A price
 * they do not publish is said so, never estimated. Read on 2026-10-29: WebFX publishes its PPC
 * tiers; KlientBoost shows example monthly investments; Disruptive Advertising and Directive
 * publish no agency price. Brainlabs (Hanapin) was checked the same day and left out: its site
 * publishes no price and names no contract, so there was nothing to set beside ours.
 *
 * Alias-free: the unit tests import it directly.
 */
import type { Agency } from "./agencies";

export const PPC_PAGE_PATH = "/ppc-agency";
export const PPC_ALTERNATIVES_PATH = `${PPC_PAGE_PATH}/alternatives`;

/** How WE answer each row on the PPC cluster, stated once. */
export const OUR_PPC_ROW = {
  entryPrice: "From $1K/month + 10% of budget",
  pricing: "From $1K a month, plus 10% of the budget you put into your campaigns. The budget pays for reaching your buyers.",
  contract: "One call to start. Your budget is a hard cap you set.",
  channels: "Outreach to the buyers you choose, by cold email from our own domains and on WhatsApp.",
  guarantee: "Every click is judged human before it counts, and every signup and paying client is shown on your dashboard.",
  launch: "Live in 5 days from our first call.",
} as const;

const WEBFX: Agency = {
  slug: "webfx",
  name: "WebFX",
  domain: "webfx.com",
  oneLiner: {
    text: "A US digital marketing agency with a large paid search team and three published PPC tiers.",
    sourceUrl: "https://www.webfx.com/ppc/pricing/",
  },
  sourceUrl: "https://www.webfx.com/ppc/pricing/",
  verifiedOn: "2026-10-29",
  entryPrice: "From $750/month",
  pricing: {
    text: "Lite: $750 a month for $100 to $5,000 of ad spend, plus $1,200 for the first month. Pro: $975 or 15% of spend, whichever is higher. Enterprise: $4,500 or 12% of spend.",
    sourceUrl: "https://www.webfx.com/ppc/pricing/",
  },
  contract: {
    text: "Contract length is not stated on the pricing page. The client keeps admin access to every campaign created.",
    sourceUrl: "https://www.webfx.com/ppc/pricing/",
  },
  channels: {
    text: "Search, shopping, local and social ad networks, plus ads inside AI chat assistants.",
    sourceUrl: "https://www.webfx.com/ppc/pricing/",
  },
  guarantee: {
    text: "No guarantee stated on the pricing page.",
    sourceUrl: "https://www.webfx.com/ppc/pricing/",
  },
  launch: null,
  claim: {
    text: "“$10,085,355,239+” revenue driven for their clients and “1,450+” clients trusting them with paid search.",
    sourceUrl: "https://www.webfx.com/ppc/pricing/",
  },
  whereTheyWin: [
    "A published price for each ad spend band.",
    "A large team certified on the big ad networks.",
  ],
  chooseThemIf: [
    "You want your search and shopping ads managed for you.",
    "You like a published price before the first call.",
  ],
};

const DISRUPTIVE: Agency = {
  slug: "disruptive-advertising",
  name: "Disruptive Advertising",
  domain: "disruptiveadvertising.com",
  oneLiner: {
    text: "A US digital marketing and advertising agency, fourteen years in business, with 160+ employees.",
    sourceUrl: "https://disruptiveadvertising.com/",
  },
  sourceUrl: "https://disruptiveadvertising.com/pricing/",
  verifiedOn: "2026-10-29",
  entryPrice: "Not published",
  pricing: {
    text: "No price is published. Each engagement is priced and scoped after they identify your needs.",
    sourceUrl: "https://disruptiveadvertising.com/",
  },
  contract: {
    text: "No long-term contracts, in their own words.",
    sourceUrl: "https://disruptiveadvertising.com/",
  },
  channels: {
    text: "Paid ads support and strategic marketing advice; the channels are not listed on the page.",
    sourceUrl: "https://disruptiveadvertising.com/pricing/",
  },
  guarantee: {
    text: "For qualifying brands, measurable growth within 90 days or your money back.",
    sourceUrl: "https://disruptiveadvertising.com/",
  },
  launch: null,
  claim: {
    text: "“$450M+ in annual ad-spend managed for clients” and “4.8 average rating from 350+ reviews on Clutch”.",
    sourceUrl: "https://disruptiveadvertising.com/",
  },
  whereTheyWin: [
    "A 90 day money back promise for qualifying brands.",
    "No long-term contract.",
  ],
  chooseThemIf: [
    "You already run large ad budgets and want them audited.",
    "You want a money back promise on growth.",
  ],
};

const KLIENTBOOST: Agency = {
  slug: "klientboost",
  name: "KlientBoost",
  domain: "klientboost.com",
  oneLiner: {
    text: "An outcome marketing agency for paid ads, SEO and conversion work, that sets a goal for every service.",
    sourceUrl: "https://www.klientboost.com/",
  },
  sourceUrl: "https://www.klientboost.com/pricing/",
  verifiedOn: "2026-10-29",
  entryPrice: "Not published",
  pricing: {
    text: "No price list. Their pricing page offers options to go faster or slower; their growth plan examples show investments from $3,000 to $7,500 a month.",
    sourceUrl: "https://www.klientboost.com/pricing/",
  },
  contract: {
    text: "Contract terms are not stated on the pricing page.",
    sourceUrl: "https://www.klientboost.com/pricing/",
  },
  channels: {
    text: "Search and social ads, SEO, landing pages and conversion rate work.",
    sourceUrl: "https://www.klientboost.com/",
  },
  guarantee: {
    text: "A service that does not hit its goal is removed, and they add resources for free if they are pacing behind.",
    sourceUrl: "https://www.klientboost.com/",
  },
  launch: null,
  claim: {
    text: "“We Hit 84% of Client Goals In Q3, 2026”.",
    sourceUrl: "https://www.klientboost.com/",
  },
  whereTheyWin: [
    "A goal set for every service they run.",
    "Ads, landing pages and SEO from one team.",
  ],
  chooseThemIf: [
    "You want ads and landing pages built together.",
    "You want a free marketing plan before you sign.",
  ],
};

const DIRECTIVE: Agency = {
  slug: "directive",
  name: "Directive",
  domain: "directiveconsulting.com",
  oneLiner: {
    text: "A B2B performance marketing agency, working since 2013, focused on qualified pipeline over MQLs.",
    sourceUrl: "https://directiveconsulting.com/",
  },
  sourceUrl: "https://directiveconsulting.com/pricing/",
  verifiedOn: "2026-10-29",
  entryPrice: "Not published",
  pricing: {
    text: "No agency price is published. Their pricing page sells a $399 do it yourself course of their method.",
    sourceUrl: "https://directiveconsulting.com/pricing/",
  },
  contract: {
    text: "Contract terms are not stated; the next step is an intro call.",
    sourceUrl: "https://directiveconsulting.com/",
  },
  channels: {
    text: "Paid media, paid social, programmatic, shopping and marketplace ads, content and PR.",
    sourceUrl: "https://directiveconsulting.com/",
  },
  guarantee: {
    text: "No guarantee stated.",
    sourceUrl: "https://directiveconsulting.com/",
  },
  launch: null,
  claim: {
    text: "“700+” brands served and “$1B+” revenue generated.",
    sourceUrl: "https://directiveconsulting.com/",
  },
  whereTheyWin: [
    "A B2B method built around pipeline.",
    "A large team of 130+ strategists.",
  ],
  chooseThemIf: [
    "You run B2B paid media across many networks at once.",
    "You want PR and content from the same agency.",
  ],
};

export const PPC_AGENCIES: readonly Agency[] = [WEBFX, DISRUPTIVE, KLIENTBOOST, DIRECTIVE];

export function ppcVsPath(a: Pick<Agency, "slug">): string {
  return `${PPC_PAGE_PATH}/vs/${a.slug}`;
}

export function ppcAgencyBySlug(slug: string): Agency | undefined {
  return PPC_AGENCIES.find((a) => a.slug === slug);
}

/** Every page of the cluster, for the sitemap. */
export function ppcClusterPaths(): string[] {
  return [PPC_ALTERNATIVES_PATH, ...PPC_AGENCIES.map(ppcVsPath)];
}

/** The links the page's footer and its FAQ close on. */
export function ppcCompareLinks(): { label: string; href: string }[] {
  return [
    ...PPC_AGENCIES.map((a) => ({ label: `distribute.you vs ${a.name}`, href: ppcVsPath(a) })),
    { label: "PPC agency alternatives", href: PPC_ALTERNATIVES_PATH },
  ];
}
