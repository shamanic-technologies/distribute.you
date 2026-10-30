/**
 * The providers the Customer Success Agency page is compared with
 * (PAGE-CUSTOMER-SUCCESS-AGENCY-1030): one entry per `/customer-success-agency/vs/<slug>` page,
 * the `/customer-success-agency/alternatives` list, the page's cost table, the sitemap and the
 * page's footer all read it.
 *
 * Every figure is READ from the provider's own site, with the URL it came from and the day it was
 * read (apps/landing/CLAUDE.md "A competitor figure is READ from their own site"). Each one sells
 * customer success outsourcing (a dedicated customer success person, placed and paid for you)
 * and publishes a price. Checked on 2026-10-30 and left out: SupportNinja and EverHelp (quote
 * only), Peak Support (403), Helpware (520), PartnerHero and Simplr (now redirect elsewhere),
 * LTVplus (now sells IT help desk), Scale Army (404), 1840 & Co, Hire With Near and Floowi (only
 * salary ranges, no fee), Wing Assistant (customer service reps, not customer success), and
 * Gainsight, ChurnZero, Totango, Vitally (software, not a service).
 *
 * Alias-free: the unit tests import it directly.
 */
import type { Agency } from "./agencies";

export const CS_PAGE_PATH = "/customer-success-agency";
export const CS_ALTERNATIVES_PATH = `${CS_PAGE_PATH}/alternatives`;

/** How WE answer each row on the customer success cluster, stated once. */
export const OUR_CS_ROW = {
  entryPrice: "From $1K/month + 10% of budget",
  pricing: "From $1K a month, plus 10% of the budget you put into your campaigns. The budget goes to reaching your clients.",
  contract: "One call to start. Your budget is a hard cap you set.",
  channels: "WhatsApp, and email when a client writes by email. Our team runs your account, our AI agents welcome, answer and check in.",
  guarantee: "Every happy message from a paying client counts once as a result, the way a positive reply counts in sales.",
  launch: "Live in 5 days from our first call.",
} as const;

const BAMBOO = "https://bambooworks.io/roles/customer-success-manager";
const STEALTH_PRICING = "https://stealthagents.com/pricing/";
const STEALTH_CS = "https://stealthagents.com/alternatives/customer-success-manager-alternative";
const VAM_ROLE = "https://vamasters.com/customer-success-virtual-assistant/";
const VAM_GUIDE = "https://vamasters.com/how-to-outsource-customer-success-management/";
const VAM_PRICING = "https://vamasters.com/pricing/";
const SOUTH = "https://www.hireinsouth.com/roles/customer-success-manager";

export const CS_AGENCIES: readonly Agency[] = [
  {
    slug: "bamboo-works",
    name: "Bamboo Works",
    domain: "bambooworks.io",
    oneLiner: {
      text: "A remote hiring partner that finds, vets, contracts and pays offshore customer success managers for one flat monthly fee.",
      sourceUrl: BAMBOO,
    },
    sourceUrl: BAMBOO,
    verifiedOn: "2026-10-30",
    entryPrice: "From $2,400/month all-in",
    pricing: {
      text: "One flat monthly fee from $2,400 all-in, sourcing, contracts, payroll and HR included, set against $10,300 a month for a traditional hire.",
      sourceUrl: BAMBOO,
    },
    contract: { text: "Month to month; no minimum term is stated.", sourceUrl: BAMBOO },
    channels: {
      text: "One customer success manager who owns onboarding and adoption, monitors account health, and runs check-ins, QBRs and renewals.",
      sourceUrl: BAMBOO,
    },
    guarantee: { text: "Unlimited free replacements.", sourceUrl: BAMBOO },
    launch: { text: "Shortlist in 10 days.", sourceUrl: BAMBOO },
    claim: { text: "\"Only 1% make the cut.\"", sourceUrl: BAMBOO },
    whereTheyWin: [
      "One all-in price covers pay, HR and contracts, month to month.",
      "Their customer success manager runs QBRs and renewals as well as check-ins.",
    ],
    chooseThemIf: ["You want one full-time customer success manager at a fixed monthly price.", "You prefer month to month terms.", "You want free replacements if the fit is wrong."],
  },
  {
    slug: "stealth-agents",
    name: "Stealth Agents",
    domain: "stealthagents.com",
    oneLiner: { text: "A virtual assistant company that places customer success assistants, starting at $1,600 a month.", sourceUrl: STEALTH_CS },
    sourceUrl: STEALTH_PRICING,
    verifiedOn: "2026-10-30",
    entryPrice: "From $1,600/month",
    pricing: {
      text: "Three plans of 160 hours a month: $1,600, $2,400 and $3,000 a month, each plus a one time onboarding fee.",
      sourceUrl: STEALTH_PRICING,
    },
    contract: { text: "The pricing page lists a 3 month commitment, and also says \"No contracts, no surprises\".", sourceUrl: STEALTH_PRICING },
    channels: {
      text: "Onboarding, scheduled check-ins, renewal tracking, account notes and follow-up on open issues.",
      sourceUrl: STEALTH_CS,
    },
    guarantee: { text: "Money back on the hire, and a free replacement if the assistant is not the right fit.", sourceUrl: STEALTH_PRICING },
    launch: { text: "7 to 14 days to start.", sourceUrl: STEALTH_PRICING },
    claim: { text: "\"We only offer the top 1% quality of virtual assistants.\"", sourceUrl: STEALTH_PRICING },
    whereTheyWin: [
      "The lowest monthly entry price of this list, with a money back promise.",
      "Pages written for customer success work: onboarding, renewals and check-ins.",
    ],
    chooseThemIf: ["You need help on low touch and mid touch accounts.", "You want a money back promise.", "A 3 month commitment suits you."],
  },
  {
    slug: "va-masters",
    name: "VA Masters",
    domain: "vamasters.com",
    oneLiner: { text: "A virtual assistant recruitment agency that places dedicated assistants from the Philippines.", sourceUrl: VAM_PRICING },
    sourceUrl: VAM_ROLE,
    verifiedOn: "2026-10-30",
    entryPrice: "$8.50 to $14.50/hour",
    pricing: {
      text: "$8.50 to $14.50 an hour, full time. Their guide prices teams: 1 assistant for 50 to 100 accounts at $1,280 to $2,240 a month, up to 3 or 4 assistants plus a local lead at $5,000 to $8,500.",
      sourceUrl: VAM_GUIDE,
    },
    contract: { text: "No fixed term; either side ends it with 30 days written notice. Recommended minimum: 80 hours a month.", sourceUrl: VAM_PRICING },
    channels: {
      text: "Onboarding, check-ins, health monitoring, renewals, expansion and support coordination, by email, Zoom, Slack and Loom.",
      sourceUrl: VAM_ROLE,
    },
    guarantee: { text: "A replacement if the fit is wrong, and \"Only pay when you are 100% satisfied.\"", sourceUrl: VAM_ROLE },
    launch: { text: "A shortlist usually within about 2 business days.", sourceUrl: VAM_PRICING },
    claim: { text: "\"up to 80 percent less than the loaded cost of a local customer success manager\".", sourceUrl: VAM_ROLE },
    whereTheyWin: [
      "The lowest hourly rate of this list, with no fixed term.",
      "The only one that prices a whole customer success team by account count.",
    ],
    chooseThemIf: ["You want to start part time, from 80 hours a month.", "You plan to grow from one assistant to a small team.", "You want to pay monthly after the work is done."],
  },
  {
    slug: "south",
    name: "South",
    domain: "hireinsouth.com",
    oneLiner: { text: "A hiring company that helps growing companies find, hire and pay Latin American talent.", sourceUrl: SOUTH },
    sourceUrl: SOUTH,
    verifiedOn: "2026-10-30",
    entryPrice: "$5,425/month all-in",
    pricing: {
      text: "One flat monthly rate covering the hire's pay and South's service, shown as 5425 a month for a customer success manager; rates vary by role and seniority.",
      sourceUrl: SOUTH,
    },
    contract: { text: "No cancellation fees or minimum commitments; hires are full time.", sourceUrl: SOUTH },
    channels: {
      text: "A customer success manager who onboards new customers, runs check-ins and business reviews, and prepares renewal plans.",
      sourceUrl: SOUTH,
    },
    guarantee: { text: "A second search at no charge if you are not happy with your hire in the first 120 days.", sourceUrl: SOUTH },
    launch: { text: "Teams built in 21 days or less.", sourceUrl: SOUTH },
    claim: { text: "\"Same Quality. 36% Less.\"", sourceUrl: SOUTH },
    whereTheyWin: [
      "Customer success managers in US time zones, with one fee for pay and service.",
      "A 120 day replacement window, the longest of this list.",
    ],
    chooseThemIf: ["You want a senior, full time customer success manager in your time zone.", "You run business reviews with your clients.", "You want no minimum term."],
  },
];

export function csVsPath(a: Pick<Agency, "slug">): string {
  return `${CS_PAGE_PATH}/vs/${a.slug}`;
}

export function csAgencyBySlug(slug: string): Agency | undefined {
  return CS_AGENCIES.find((a) => a.slug === slug);
}

/** Every page of the cluster, for the sitemap. */
export function csClusterPaths(): string[] {
  return [CS_ALTERNATIVES_PATH, ...CS_AGENCIES.map(csVsPath)];
}

/** The links the page's footer and its FAQ close on. */
export function csCompareLinks(): { label: string; href: string }[] {
  return [
    ...CS_AGENCIES.map((a) => ({ label: `distribute.you vs ${a.name}`, href: csVsPath(a) })),
    { label: "Customer success agency alternatives", href: CS_ALTERNATIVES_PATH },
  ];
}
