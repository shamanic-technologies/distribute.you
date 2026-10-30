/**
 * The agencies the Database Reactivation Agency page is compared with
 * (PAGE-DATABASE-REACTIVATION-AGENCY-1030): one entry per `/database-reactivation-agency/vs/<slug>`
 * page, the `/database-reactivation-agency/alternatives` list, the page's cost table, the sitemap
 * and the page's footer all read it.
 *
 * Every figure is READ from the agency's own site, with the URL it came from and the day it was
 * read (apps/landing/CLAUDE.md "A competitor figure is READ from their own site"). Each one sells
 * database reactivation or lead nurturing as a done-for-you service and publishes a price.
 * Checked on 2026-10-30 and left out: xpanddigital.io and thatcompany.com (no price, /pricing
 * 404), scalegrowthpartners.com and mediabloom.us (the service is quoted after a call),
 * dealerfunnel.com, ciela.ai and consulnet.com (software, not a service), octavius.ai (404).
 *
 * Alias-free: the unit tests import it directly.
 */
import type { Agency } from "./agencies";

export const REACTIVATION_PAGE_PATH = "/database-reactivation-agency";
export const REACTIVATION_ALTERNATIVES_PATH = `${REACTIVATION_PAGE_PATH}/alternatives`;

/** How WE answer each row on the database reactivation cluster, stated once. */
export const OUR_REACTIVATION_ROW = {
  entryPrice: "From $1K/month + 10% of budget",
  pricing: "From $1K a month, plus 10% of the budget you put into your campaigns. The budget goes to reaching your contacts.",
  contract: "One call to start. Your budget is a hard cap you set.",
  channels: "Email from our own domains and WhatsApp, read from your CRM and product tools. Our team runs your account, our AI agents write and answer.",
  guarantee: "Every reply and meeting is shown on your dashboard with what it cost, and what a reply costs across all our clients is public.",
  launch: "Live in 5 days from our first call.",
} as const;

const ASCENSION = "https://ascensionagency.net/Activate";
const DOUBLETIME = "https://www.doubletimeai.com/services/database-reactivation";
const SEARCHBERG = "https://searchberg.com/email-marketing";
const NIAGARA = "https://niagarastandsout.ca/pages/database-reactivator-crm";

export const REACTIVATION_AGENCIES: readonly Agency[] = [
  {
    slug: "ascension-agency",
    name: "Ascension Agency",
    domain: "ascensionagency.net",
    oneLiner: { text: "A growth partner for local businesses that runs done-for-you database activation campaigns.", sourceUrl: ASCENSION },
    sourceUrl: ASCENSION,
    verifiedOn: "2026-10-30",
    entryPrice: "$997/month + $497 setup",
    pricing: {
      text: "Standard $997/mo (up to 300 SMS offers a week), Professional $1,497/mo (600 a week), Enterprise $1,997/mo (900 a week), each plus a $497 setup fee.",
      sourceUrl: ASCENSION,
    },
    contract: { text: "Every tier states a 3 month minimum.", sourceUrl: ASCENSION },
    channels: {
      text: "SMS and email activation campaigns, automated appointment booking, nurture and follow-up, referral campaigns and response management.",
      sourceUrl: ASCENSION,
    },
    guarantee: { text: "No guarantee is stated; they report an average activation rate of 5% to 15%.", sourceUrl: ASCENSION },
    launch: null,
    claim: { text: "\"average activation rate of 5%-15%\".", sourceUrl: ASCENSION },
    whereTheyWin: [
      "Clear published tiers, each with its weekly SMS volume.",
      "Every tier is sold as a complete done-for-you package, so a buyer can sign without a sales call.",
    ],
    chooseThemIf: ["You are a local business with an old customer list.", "You want SMS-led reactivation at a fixed monthly fee.", "A 3 month commitment suits you."],
  },
  {
    slug: "doubletime-ai",
    name: "DoubleTime AI",
    domain: "doubletimeai.com",
    oneLiner: {
      text: "A US-based marketing and AI automation agency for service businesses, with Get Found, Get Leads and Get Booked services.",
      sourceUrl: "https://www.doubletimeai.com/",
    },
    sourceUrl: DOUBLETIME,
    verifiedOn: "2026-10-30",
    entryPrice: "$5,000 per campaign",
    pricing: {
      text: "$5,000 per campaign for an AI-run SMS campaign; lists that pass their audit can pay per booked appointment instead, at a rate not published.",
      sourceUrl: DOUBLETIME,
    },
    contract: { text: "Not stated on the service page.", sourceUrl: DOUBLETIME },
    channels: { text: "Two-way SMS handled by AI. Phone handling is a separate AI Front Desk service.", sourceUrl: DOUBLETIME },
    guarantee: { text: "No response rate is promised; most campaigns know their results inside two to three weeks.", sourceUrl: DOUBLETIME },
    launch: null,
    claim: { text: "Most campaigns \"know results inside two to three weeks\".", sourceUrl: DOUBLETIME },
    whereTheyWin: [
      "A flat published price per campaign, and no inflated promise.",
      "Clients own what is built and approve it before it goes live.",
    ],
    chooseThemIf: ["You want one SMS campaign on an old CRM list.", "Your list is large and consented enough to pay per booking.", "You prefer a one-off project to a monthly plan."],
  },
  {
    slug: "searchberg",
    name: "SearchBerg",
    domain: "searchberg.com",
    oneLiner: { text: "A digital marketing firm with more than 10 years in SEO and web design, running email marketing as a managed service.", sourceUrl: SEARCHBERG },
    sourceUrl: SEARCHBERG,
    verifiedOn: "2026-10-30",
    entryPrice: "From $499/month",
    pricing: {
      text: "Six monthly plans from Starter $499 to Pro Convert $2,699; Pro Target, $999, covers one email automation series with up to 4 automated emails a month.",
      sourceUrl: SEARCHBERG,
    },
    contract: { text: "Not stated on the pricing page.", sourceUrl: SEARCHBERG },
    channels: { text: "Email only: copywriting, design, coding, sending and split tests.", sourceUrl: SEARCHBERG },
    guarantee: { text: "No result of their own is stated; the page cites industry email return figures.", sourceUrl: SEARCHBERG },
    launch: null,
    claim: { text: "\"more than 10 years\" in SEO and web design.", sourceUrl: SEARCHBERG },
    whereTheyWin: ["Fully managed email, from copy to design to sending.", "Six published tiers, starting at $499 a month."],
    chooseThemIf: ["You want an email nurture series written and run for you.", "You do not need WhatsApp or SMS.", "You want a low monthly entry price."],
  },
  {
    slug: "niagara-stands-out",
    name: "Niagara Stands Out",
    domain: "niagarastandsout.ca",
    oneLiner: {
      text: "A marketing agency in Port Colborne, Ontario, whose Database Reactivator turns an old customer list into new revenue by mail.",
      sourceUrl: NIAGARA,
    },
    sourceUrl: NIAGARA,
    verifiedOn: "2026-10-30",
    entryPrice: "$1,500 setup + first campaign",
    pricing: {
      text: "$1,500 one time for setup and the first campaign (list cleaning and the first 500 cards), then $2.50 per card each quarter, plus an optional $500 a quarter for full management.",
      sourceUrl: NIAGARA,
    },
    contract: { text: "Not stated; the page says no payment until you approve.", sourceUrl: NIAGARA },
    channels: { text: "Physical direct mail, sent through Canada Post.", sourceUrl: NIAGARA },
    guarantee: { text: "No guarantee is stated; the page reports an 8.4x average ROI and a 2.3% average response.", sourceUrl: NIAGARA },
    launch: null,
    claim: { text: "\"127K records cleaned\".", sourceUrl: NIAGARA },
    whereTheyWin: ["Clear one time plus per card pricing, paid only after you approve.", "List cleaning is included before anything is mailed."],
    chooseThemIf: ["Your list has postal addresses.", "You want reactivation by mail in Canada.", "You prefer paying per card to a monthly fee."],
  },
];

export function reactivationVsPath(a: Pick<Agency, "slug">): string {
  return `${REACTIVATION_PAGE_PATH}/vs/${a.slug}`;
}

export function reactivationAgencyBySlug(slug: string): Agency | undefined {
  return REACTIVATION_AGENCIES.find((a) => a.slug === slug);
}

/** Every page of the cluster, for the sitemap. */
export function reactivationClusterPaths(): string[] {
  return [REACTIVATION_ALTERNATIVES_PATH, ...REACTIVATION_AGENCIES.map(reactivationVsPath)];
}

/** The links the page's footer and its FAQ close on. */
export function reactivationCompareLinks(): { label: string; href: string }[] {
  return [
    ...REACTIVATION_AGENCIES.map((a) => ({ label: `distribute.you vs ${a.name}`, href: reactivationVsPath(a) })),
    { label: "Database reactivation agency alternatives", href: REACTIVATION_ALTERNATIVES_PATH },
  ];
}
