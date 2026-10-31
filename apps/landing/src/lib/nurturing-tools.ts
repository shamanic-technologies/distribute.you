/**
 * The lead nurturing tools the Lead Nurturing Automation page is compared with
 * (PAGE-LEAD-NURTURING-AUTOMATION-1030): one entry per `/lead-nurturing-automation/vs/<slug>`
 * page, the `/lead-nurturing-automation/alternatives` list, the page's compare table, the
 * sitemap and the page's footer all read it.
 *
 * Every figure is READ from the tool's own pricing page, with the URL it came from and the day
 * it was read (apps/landing/CLAUDE.md "A competitor figure is READ from their own site").
 * Read on 2026-10-30: ActiveCampaign (its page 403s a plain fetch; read through a rendering
 * reader of the same URL), HubSpot (rendered in a browser, US locale), Customer.io, Brevo (the
 * page's own JSON-LD `Offer` nodes and plan cards).
 *
 * Alias-free: the unit tests import it directly.
 */

export const NURTURING_PAGE_PATH = "/lead-nurturing-automation";
export const NURTURING_ALTERNATIVES_PATH = `${NURTURING_PAGE_PATH}/alternatives`;

export type ToolPrice = {
  /** The plan as the tool names it. */
  readonly plan: string;
  /** The price as the tool states it, with its unit. */
  readonly price: string;
  /** What that price buys, in the tool's own terms. */
  readonly note: string;
};

export type NurturingTool = {
  readonly slug: string;
  readonly name: string;
  /** Registrable domain, for the logo and the source check. */
  readonly domain: string;
  /** How they describe themselves, paraphrased from their own site. */
  readonly oneLiner: string;
  /** The pricing page every figure below was read from. */
  readonly sourceUrl: string;
  /** ISO day the source was read. */
  readonly verifiedOn: string;
  /** The cheapest way in, as a short label for the table. */
  readonly entryPrice: string;
  readonly prices: readonly ToolPrice[];
  readonly freeTier: string;
  /** Where WhatsApp sits in their plans, as their page states it. */
  readonly whatsapp: string;
  readonly whereTheyWin: readonly string[];
  readonly chooseThemIf: readonly string[];
};

/** How WE answer each row, stated once. */
export const OUR_NURTURING_ROW = {
  entryPrice: "Free, every action at the API price",
  pricing: "Free. Every message written and sent is billed at the vendor's API price, 0% markup, from a prepaid balance you start with $10.",
  freeTier: "Free, hosted. Open source under MIT to run yourself.",
  whatsapp: "Included. The agent writes on email and WhatsApp, whichever the lead answers.",
  whoWrites: "Our AI agent writes each message for one person, when that person acts.",
  signals: "Reads your Clerk signups, Stripe payments, PostHog visits and GoHighLevel stages.",
} as const;

const ACTIVECAMPAIGN = "https://www.activecampaign.com/pricing";
const HUBSPOT = "https://www.hubspot.com/pricing/marketing";
const CUSTOMERIO = "https://customer.io/pricing";
const BREVO = "https://www.brevo.com/pricing/";

export const NURTURING_TOOLS: readonly NurturingTool[] = [
  {
    slug: "activecampaign",
    name: "ActiveCampaign",
    domain: "activecampaign.com",
    oneLiner: "An email marketing and automation platform with AI builders, sold by plan and contact count.",
    sourceUrl: ACTIVECAMPAIGN,
    verifiedOn: "2026-10-30",
    entryPrice: "From $15/month for 1,000 contacts",
    prices: [
      { plan: "Starter", price: "$15/month, billed yearly", note: "1,000 contacts, 10,000 email sends a month, 1 user seat" },
      { plan: "Plus", price: "$49/month, billed yearly", note: "1,000 contacts, 10,000 email sends a month, landing pages, cross-channel marketing" },
      { plan: "Pro", price: "$79/month, billed yearly", note: "1,000 contacts, 12,000 email sends a month, 3 user seats, predictive sending" },
      { plan: "Enterprise", price: "$145/month, billed yearly", note: "1,000 contacts, 15,000 email sends a month, 5 user seats, SSO" },
    ],
    freeTier: "A free trial.",
    whatsapp: "A WhatsApp Messaging add-on with its own plans.",
    whereTheyWin: [
      "A mature automation builder with more than 250 email templates.",
      "Plans for every team size, from one seat to an enterprise account.",
    ],
    chooseThemIf: ["You want to design every automation yourself, step by step.", "Your nurturing is mostly newsletters and email sequences."],
  },
  {
    slug: "hubspot-marketing-hub",
    name: "HubSpot Marketing Hub",
    domain: "hubspot.com",
    oneLiner: "The marketing side of HubSpot's customer platform, with a free tier and AI agents in its paid plans.",
    sourceUrl: HUBSPOT,
    verifiedOn: "2026-10-30",
    entryPrice: "Free, then from $20/seat/month",
    prices: [
      { plan: "Free", price: "$0/month", note: "Free for up to 2 users" },
      { plan: "Starter", price: "$20/seat/month ($7 for new customers, for a limited time)", note: "1,000 marketing contacts, email marketing, simple marketing automation" },
      { plan: "Professional", price: "From $800/month, plus a one-time $3,000 onboarding", note: "3 core seats, 2,000 marketing contacts, the Nurture Agent in beta" },
      { plan: "Enterprise", price: "From $3,600/month, plus a one-time $7,000 onboarding", note: "5 core seats, 10,000 marketing contacts, behavioral event triggers" },
    ],
    freeTier: "Free tools for up to 2 users.",
    whatsapp: "A WhatsApp integration on Professional and Enterprise, up to 1,000 messages a month.",
    whereTheyWin: [
      "Marketing, sales and service in one CRM your whole company shares.",
      "A free tier for two users, with no credit card.",
    ],
    chooseThemIf: ["Your company already runs on the HubSpot CRM.", "You have a marketing team to build and run the campaigns."],
  },
  {
    slug: "customer-io",
    name: "Customer.io",
    domain: "customer.io",
    oneLiner: "A messaging platform that sends email, push, in-app and WhatsApp messages from the data your product sends it.",
    sourceUrl: CUSTOMERIO,
    verifiedOn: "2026-10-30",
    entryPrice: "From $100/month",
    prices: [
      { plan: "Essentials", price: "From $100/month", note: "5,000 profiles and 1 million emails a month" },
      { plan: "Premium", price: "From $1,000/month, billed annually", note: "Custom profile and email volume" },
      { plan: "Enterprise", price: "On request", note: "Custom volume, through their sales team" },
    ],
    freeTier: "A free trial. Startups that raised under $10M get a year free through their Startup Program.",
    whatsapp: "Native WhatsApp, included on every plan.",
    whereTheyWin: [
      "Messages triggered by any event your product sends, with deep segmentation.",
      "Email, push, in-app and WhatsApp in one place, for a product team with engineers.",
    ],
    chooseThemIf: ["Your engineers can send product events and build the journeys.", "You send at high volume and want one tool for every channel."],
  },
  {
    slug: "brevo",
    name: "Brevo",
    domain: "brevo.com",
    oneLiner: "An email, SMS and WhatsApp marketing platform with a free plan, used by more than 600,000 customers.",
    sourceUrl: BREVO,
    verifiedOn: "2026-10-30",
    entryPrice: "Free, then from $9/month",
    prices: [
      { plan: "Free", price: "$0/month", note: "Up to 300 emails a day" },
      { plan: "Starter", price: "$9/month", note: "From 5,000 emails a month, email and SMS" },
      { plan: "Standard", price: "$18/month", note: "Marketing automation, A/B testing, send time optimization" },
      { plan: "Professional", price: "$499/month", note: "From 150,000 emails a month, WhatsApp, 10 seats" },
      { plan: "Enterprise", price: "On request", note: "For companies with 1M+ contacts, through their sales team" },
    ],
    freeTier: "A free plan, up to 300 emails a day.",
    whatsapp: "On the Professional plan, $499 a month.",
    whereTheyWin: [
      "A free plan and a low entry price for email and SMS.",
      "Automated workflows you can build yourself from the Standard plan.",
    ],
    chooseThemIf: ["You mostly send newsletters and want the lowest monthly price.", "You will build and update the workflows yourself."],
  },
];

export function nurturingVsPath(t: Pick<NurturingTool, "slug">): string {
  return `${NURTURING_PAGE_PATH}/vs/${t.slug}`;
}

export function nurturingToolBySlug(slug: string): NurturingTool | undefined {
  return NURTURING_TOOLS.find((t) => t.slug === slug);
}

/** Every page of the cluster, for the sitemap. */
export function nurturingClusterPaths(): string[] {
  return [NURTURING_ALTERNATIVES_PATH, ...NURTURING_TOOLS.map(nurturingVsPath)];
}

/** The links the page's footer and its FAQ close on. */
export function nurturingCompareLinks(): { label: string; href: string }[] {
  return [
    ...NURTURING_TOOLS.map((t) => ({ label: `distribute.you vs ${t.name}`, href: nurturingVsPath(t) })),
    { label: "Lead nurturing automation alternatives", href: NURTURING_ALTERNATIVES_PATH },
  ];
}
