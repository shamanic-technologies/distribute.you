/**
 * The AI customer success tools the AI Customer Success page is compared with
 * (PAGE-AI-CUSTOMER-SUCCESS-1030): one entry per `/ai-customer-success/vs/<slug>` page, the
 * `/ai-customer-success/alternatives` list, the page's compare table, the sitemap and the
 * page's footer all read it.
 *
 * Every figure is READ from the tool's own pricing page, with the URL it came from and the day
 * it was read (apps/landing/CLAUDE.md "A competitor figure is READ from their own site").
 * Read on 2026-10-30: Intercom (server HTML of the page), Zendesk, HubSpot Service Hub (through a
 * rendering reader of the same URL, US locale), Freshdesk. Gainsight, Vitally and ChurnZero were
 * checked the same day and left out: their pricing pages publish no price ("Request Pricing").
 *
 * Alias-free: the unit tests import it directly.
 */

export const CS_PAGE_PATH = "/ai-customer-success";
export const CS_ALTERNATIVES_PATH = `${CS_PAGE_PATH}/alternatives`;

export type ToolPrice = {
  /** The plan as the tool names it. */
  readonly plan: string;
  /** The price as the tool states it, with its unit. */
  readonly price: string;
  /** What that price buys, in the tool's own terms. */
  readonly note: string;
};

export type CsTool = {
  readonly slug: string;
  readonly name: string;
  /** Registrable domain of the pricing page, for the logo and the source check. */
  readonly domain: string;
  /** The product's own domain for its logo, when the pricing page sits on a parent brand. */
  readonly logoDomain?: string;
  /** How they describe themselves, paraphrased from their own site. */
  readonly oneLiner: string;
  /** The pricing page every figure below was read from. */
  readonly sourceUrl: string;
  /** ISO day the source was read. */
  readonly verifiedOn: string;
  /** The cheapest way in, as a short label for the table. */
  readonly entryPrice: string;
  /** Their AI agent's price, as their page states it. */
  readonly aiAgent: string;
  readonly prices: readonly ToolPrice[];
  readonly freeTier: string;
  /** Where WhatsApp sits in their plans, as their page states it. */
  readonly whatsapp: string;
  readonly whereTheyWin: readonly string[];
  readonly chooseThemIf: readonly string[];
};

/** How WE answer each row, stated once. */
export const OUR_CS_ROW = {
  entryPrice: "Free for one user, every action at the API price",
  aiAgent: "Every message at the vendor's API price, 0% markup",
  pricing:
    "Free for one user. $9 per user for a team. Every message written and sent is billed at the vendor's API price, 0% markup, from a prepaid balance you start with $10.",
  freeTier: "Free for one user, hosted. Open source under MIT to run yourself.",
  whatsapp: "Included. The agent writes to your paying customers on WhatsApp.",
  whoStarts: "Our agent writes first, when a customer pays, comes back, stops paying or goes quiet.",
  counts: "Happy customers: each positive message from a paying customer counts once.",
} as const;

const INTERCOM = "https://www.intercom.com/pricing";
const ZENDESK = "https://www.zendesk.com/pricing/";
const HUBSPOT = "https://www.hubspot.com/pricing/service";
const FRESHDESK = "https://www.freshworks.com/freshdesk/pricing/";

export const CS_TOOLS: readonly CsTool[] = [
  {
    slug: "intercom",
    name: "Intercom",
    domain: "intercom.com",
    oneLiner: "A customer service helpdesk with Fin, an AI agent that answers your customers' questions.",
    sourceUrl: INTERCOM,
    verifiedOn: "2026-10-30",
    entryPrice: "From $19/seat/month, billed yearly",
    aiAgent: "Fin AI Agent, $0.99 per outcome",
    prices: [
      { plan: "Essential", price: "$19/seat/month, billed yearly ($29 before the new customer discount)", note: "Messenger live chat, shared inbox and ticketing, public help center" },
      { plan: "Advanced", price: "$85/seat/month, billed yearly", note: "Workflow automation builder, multiple team inboxes, round robin assignment" },
      { plan: "Expert", price: "$132/seat/month, billed yearly", note: "SSO, HIPAA support, service level agreements, multibrand Messenger" },
      { plan: "Fin AI Agent", price: "$0.99 per outcome", note: "On every plan, or on your current helpdesk with a monthly minimum" },
      { plan: "Proactive Support Plus", price: "From $99/month", note: "Product tours, surveys, in-app messages, 500 messages included" },
    ],
    freeTier: "A 14-day free trial, no credit card.",
    whatsapp: "A channel charged per message sent, by market and message type.",
    whereTheyWin: [
      "Fin answers your customers' questions inside a full helpdesk.",
      "You pay Fin only when it resolves a conversation.",
    ],
    chooseThemIf: ["Your customers write to you with questions all day.", "You have a support team working one shared inbox."],
  },
  {
    slug: "zendesk",
    name: "Zendesk",
    domain: "zendesk.com",
    oneLiner: "A customer service suite with ticketing, messaging and AI agents that resolve requests.",
    sourceUrl: ZENDESK,
    verifiedOn: "2026-10-30",
    entryPrice: "From $19/agent/month, billed yearly",
    aiAgent: "AI agents, $1.50 per automated resolution committed, $2.00 pay as you go",
    prices: [
      { plan: "Support Team", price: "$19/agent/month billed yearly, $25 monthly", note: "Core support essentials, 5 automated resolutions per agent each month" },
      { plan: "Suite Team", price: "$55/agent/month billed yearly, $69 monthly", note: "Every support channel in one place, AI agents, 5 automated resolutions per agent each month" },
      { plan: "Suite Professional", price: "$115/agent/month billed yearly, $149 monthly", note: "Advanced automation and AI insights, 10 automated resolutions per agent each month" },
      { plan: "Suite Enterprise", price: "On request", note: "Through their sales team" },
    ],
    freeTier: "A 14-day free trial of Suite Professional.",
    whatsapp: "On Suite plans, with additional fees.",
    whereTheyWin: [
      "Tickets, messaging, help center and AI agents in one mature suite.",
      "Plans for every support team, from a few agents to an enterprise.",
    ],
    chooseThemIf: ["You run a support team that answers tickets every day.", "You need routing, SLAs and a help center in one place."],
  },
  {
    slug: "hubspot-service-hub",
    name: "HubSpot Service Hub",
    domain: "hubspot.com",
    oneLiner: "The help desk and customer success side of HubSpot's customer platform, with a Customer Agent in its paid plans.",
    sourceUrl: HUBSPOT,
    verifiedOn: "2026-10-30",
    entryPrice: "Free, then from $20/seat/month",
    aiAgent: "Customer Agent on Professional and Enterprise, paid in HubSpot Credits at $0.010 a credit",
    prices: [
      { plan: "Free", price: "$0/month", note: "Free for up to 2 users" },
      { plan: "Starter", price: "$20/seat/month ($7 for new customers)", note: "Help desk essentials, 500 HubSpot Credits a month" },
      { plan: "Professional", price: "From $90/seat/month, plus a one-time $1,500 onboarding", note: "Customer success workspace, health scores, Customer Agent, 3,000 HubSpot Credits a month" },
      { plan: "Enterprise", price: "From $150/seat/month, plus a one-time $3,500 onboarding", note: "Advanced routing and enterprise controls, 5,000 HubSpot Credits a month" },
    ],
    freeTier: "Free tools for up to 2 users.",
    whatsapp: "A WhatsApp integration on Professional and Enterprise, up to 1,000 messages a month.",
    whereTheyWin: [
      "A customer success workspace and health scores inside the CRM your company shares.",
      "A free tier for two users, with no credit card.",
    ],
    chooseThemIf: ["Your company already runs on the HubSpot CRM.", "You have customer success managers who work a book of accounts."],
  },
  {
    slug: "freshdesk",
    name: "Freshdesk",
    domain: "freshworks.com",
    logoDomain: "freshdesk.com",
    oneLiner: "A customer support helpdesk by Freshworks, with Freddy AI Agent answering your customers.",
    sourceUrl: FRESHDESK,
    verifiedOn: "2026-10-30",
    entryPrice: "From $19/agent/month, billed yearly",
    aiAgent: "Freddy AI Agent, first 500 sessions included, then $49 per 100 sessions",
    prices: [
      { plan: "Growth", price: "$19/agent/month, billed yearly", note: "Freddy AI Agent, first 500 sessions included" },
      { plan: "Pro", price: "$55/agent/month, billed yearly", note: "Freddy AI Agent, first 500 sessions included" },
      { plan: "Enterprise", price: "$89/agent/month, billed yearly", note: "Freddy AI Agent, first 500 sessions included" },
      { plan: "AI Agent sessions", price: "$49 per 100 sessions", note: "Sessions beyond the first 500" },
    ],
    freeTier: "A 14-day free trial of the Enterprise plan.",
    whatsapp: "Not listed on their pricing page.",
    whereTheyWin: [
      "A helpdesk with a low price per agent and 500 AI sessions to try.",
      "Part of the Freshworks suite, with CRM and IT service tools beside it.",
    ],
    chooseThemIf: ["You want a classic ticketing helpdesk at a low seat price.", "Your team answers customer tickets by hand every day."],
  },
];

export function csVsPath(t: Pick<CsTool, "slug">): string {
  return `${CS_PAGE_PATH}/vs/${t.slug}`;
}

export function csToolBySlug(slug: string): CsTool | undefined {
  return CS_TOOLS.find((t) => t.slug === slug);
}

/** Every page of the cluster, for the sitemap. */
export function csClusterPaths(): string[] {
  return [CS_ALTERNATIVES_PATH, ...CS_TOOLS.map(csVsPath)];
}

/** The links the page's footer and its FAQ close on. */
export function csCompareLinks(): { label: string; href: string }[] {
  return [
    ...CS_TOOLS.map((t) => ({ label: `distribute.you vs ${t.name}`, href: csVsPath(t) })),
    { label: "AI customer success alternatives", href: CS_ALTERNATIVES_PATH },
  ];
}
