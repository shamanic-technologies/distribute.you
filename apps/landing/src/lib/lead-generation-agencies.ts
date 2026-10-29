/**
 * The agencies the Lead Generation Agency page is compared with (PAGE-LEADGEN-AGENCY-1029):
 * one entry per `/lead-generation-agency/vs/<slug>` page, the
 * `/lead-generation-agency/alternatives` list, the sitemap and the page's footer all read it.
 *
 * Every figure is READ from the agency's own site, with the URL it came from and the day it
 * was read (apps/landing/CLAUDE.md "A competitor figure is READ from their own site"). Belkins
 * and CIENCE are the GTM cluster's entries (`agencies.ts`, read the same day), reused as they
 * stand so the two clusters cannot describe one agency two ways. Callbox and Leadium were read
 * on 2026-10-29. Martal Group was checked the same day and left out: its pricing page answered
 * 403, so nothing on it could be verified.
 *
 * Alias-free: the unit tests import it directly.
 */
import { agencyBySlug, type Agency } from "./agencies";

export const LEADGEN_PAGE_PATH = "/lead-generation-agency";
export const LEADGEN_ALTERNATIVES_PATH = `${LEADGEN_PAGE_PATH}/alternatives`;

/** How WE answer each row on the lead generation cluster, stated once. */
export const OUR_LEADGEN_ROW = {
  entryPrice: "From $1K/month + 10% of budget",
  pricing: "From $1K a month, plus 10% of the budget you put into your campaigns. The budget goes to finding and contacting your leads.",
  contract: "One call to start. Your budget is a hard cap you set.",
  channels: "Leads found and judged by our AI agents, then contacted by cold email from our own domains and on WhatsApp.",
  guarantee: "Every lead is shown with the reason it fits, and every reply and visit it brings is counted.",
  launch: "First leads in 5 days from our first call.",
} as const;

function reused(slug: string): Agency {
  const a = agencyBySlug(slug);
  if (!a) throw new Error(`lead-generation-agencies: no agency "${slug}" in agencies.ts`);
  return a;
}

const CALLBOX: Agency = {
  slug: "callbox",
  name: "Callbox",
  domain: "callboxinc.com",
  oneLiner: {
    text: "An outsourced B2B lead generation and sales support company, founded in 2004, mixing human and AI outreach.",
    sourceUrl: "https://www.callboxinc.com/lead-generation-pricing/",
  },
  sourceUrl: "https://www.callboxinc.com/lead-generation-pricing/",
  verifiedOn: "2026-10-29",
  entryPrice: "$6,667/month per pod",
  pricing: {
    text: "$6,667 a month per Campaign Pod, a dedicated outreach unit for one market segment or persona. Exact pricing after a consultation.",
    sourceUrl: "https://www.callboxinc.com/lead-generation-pricing/",
  },
  contract: {
    text: "Subscription pricing with no commitment required; contract length is discussed with their team.",
    sourceUrl: "https://www.callboxinc.com/lead-generation-pricing/",
  },
  channels: {
    text: "Phone, email, LinkedIn and web retargeting.",
    sourceUrl: "https://www.callboxinc.com/lead-generation-pricing/",
  },
  guarantee: {
    text: "No guarantee stated. Their FAQ says they do not charge per lead: the price covers the team, data and tools.",
    sourceUrl: "https://www.callboxinc.com/faqs",
  },
  launch: null,
  claim: {
    text: "“15K+ companies served” and “10K+ campaigns run”.",
    sourceUrl: "https://www.callboxinc.com/lead-generation-pricing/",
  },
  whereTheyWin: [
    "Phone, email, LinkedIn and retargeting from one team.",
    "Twenty years of campaigns in 60+ countries.",
  ],
  chooseThemIf: [
    "You want callers working each segment beside your email.",
    "You sell in many countries and languages at once.",
  ],
};

const LEADIUM: Agency = {
  slug: "leadium",
  name: "Leadium",
  domain: "leadium.com",
  oneLiner: {
    text: "A full-service outbound sales agency for appointment setting, data sourcing and inbound lead qualification.",
    sourceUrl: "https://leadium.com/pricing/",
  },
  sourceUrl: "https://leadium.com/pricing/",
  verifiedOn: "2026-10-29",
  entryPrice: "Not published",
  pricing: {
    text: "No price is published. Their quote form asks for a monthly budget, from $2,500 to $3,500 up to above $10,000.",
    sourceUrl: "https://leadium.com/pricing/",
  },
  contract: {
    text: "All contracts are month to month.",
    sourceUrl: "https://leadium.com/pricing/",
  },
  channels: {
    text: "Outbound email, cold calling, LinkedIn prospecting, gifting and marketing events.",
    sourceUrl: "https://leadium.com/pricing/",
  },
  guarantee: {
    text: "They guarantee the service and sales activity they deliver, and say they give no performance guarantee on outcomes.",
    sourceUrl: "https://leadium.com/pricing/",
  },
  launch: {
    text: "Lead generation in 1 to 3 days; appointment setting in 7 to 10 days.",
    sourceUrl: "https://leadium.com/pricing/",
  },
  claim: {
    text: "“Over $1b in opportunity creation”, in their own words.",
    sourceUrl: "https://leadium.com/",
  },
  whereTheyWin: [
    "Calls, LinkedIn and gifting beside email.",
    "Month to month contracts and a fast lead generation start.",
  ],
  chooseThemIf: [
    "You want a sales team that calls and sends gifts.",
    "You also need your inbound leads qualified by people.",
  ],
};

export const LEADGEN_AGENCIES: readonly Agency[] = [reused("belkins"), reused("cience"), CALLBOX, LEADIUM];

export function leadgenVsPath(a: Pick<Agency, "slug">): string {
  return `${LEADGEN_PAGE_PATH}/vs/${a.slug}`;
}

export function leadgenAgencyBySlug(slug: string): Agency | undefined {
  return LEADGEN_AGENCIES.find((a) => a.slug === slug);
}

/** Every page of the cluster, for the sitemap. */
export function leadgenClusterPaths(): string[] {
  return [LEADGEN_ALTERNATIVES_PATH, ...LEADGEN_AGENCIES.map(leadgenVsPath)];
}

/** The links the page's footer and its FAQ close on. */
export function leadgenCompareLinks(): { label: string; href: string }[] {
  return [
    ...LEADGEN_AGENCIES.map((a) => ({ label: `distribute.you vs ${a.name}`, href: leadgenVsPath(a) })),
    { label: "Lead generation agency alternatives", href: LEADGEN_ALTERNATIVES_PATH },
  ];
}
