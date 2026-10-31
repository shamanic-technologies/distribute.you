/**
 * The tools the Signup Automation page is compared with (PAGE-SIGNUP-AUTOMATION-1030): one entry
 * per `/signup-automation/vs/<slug>` page, the `/signup-automation/alternatives` list, the page's
 * compare table, the sitemap and the page's footer all read it.
 *
 * Each one sells a founder more signups, or more paying users out of their signups, and publishes
 * a price. Every figure is READ from the tool's own pricing page, with the URL it came from and the
 * day it was read (apps/landing/CLAUDE.md "A competitor figure is READ from their own site").
 * Read on 2026-10-30: Rewardful, ReferralHero, Userpilot, and Userlist (its page fills the prices
 * in with JavaScript; read from the pricing data in the page's own HTML). Checked and left out:
 * Viral Loops and Encharge (their pricing pages answer 403), GrowSurf (its entry plan has no price
 * on the page).
 *
 * Alias-free: the unit tests import it directly.
 */

export const SIGNUP_PAGE_PATH = "/signup-automation";
export const SIGNUP_ALTERNATIVES_PATH = `${SIGNUP_PAGE_PATH}/alternatives`;

export type ToolPrice = {
  /** The plan as the tool names it. */
  readonly plan: string;
  /** The price as the tool states it, with its unit. */
  readonly price: string;
  /** What that price buys, in the tool's own terms. */
  readonly note: string;
};

export type SignupTool = {
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
  /** Where their signups come from, or what they do with them. */
  readonly how: string;
  /** Their own headline promise, quoted from the page. */
  readonly promise: string;
  readonly whereTheyWin: readonly string[];
  readonly chooseThemIf: readonly string[];
};

/** How WE answer each row, stated once. */
export const OUR_SIGNUP_ROW = {
  entryPrice: "Free, every action at the API price",
  pricing:
    "Free. Every lead found, message written and email sent is billed at the vendor's API price, 0% markup, from a prepaid balance you start with $10.",
  freeTier: "Free, hosted. Open source under MIT to run yourself.",
  how: "Our AI agent writes to new buyers by cold email and WhatsApp, then follows every visit and signup until they pay.",
  whoWorks: "Our AI agent finds the buyers, writes each message and answers each reply.",
  signals: "Reads your PostHog visits, Clerk signups and Stripe payments.",
} as const;

const REWARDFUL = "https://www.rewardful.com/pricing";
const REFERRALHERO = "https://referralhero.com/pricing";
const USERPILOT = "https://userpilot.com/pricing/";
const USERLIST = "https://userlist.com/pricing/";

export const SIGNUP_TOOLS: readonly SignupTool[] = [
  {
    slug: "rewardful",
    name: "Rewardful",
    domain: "rewardful.com",
    oneLiner: "An affiliate and referral platform that helps SaaS companies launch and grow affiliate programs on Stripe.",
    sourceUrl: REWARDFUL,
    verifiedOn: "2026-10-30",
    entryPrice: "From $49/month",
    prices: [
      { plan: "Starter", price: "$49/month, or $490/year", note: "Up to $7,500 a month of affiliate revenue, 1 campaign, 2 team members" },
      { plan: "Growth", price: "$99/month, or $990/year", note: "Up to $15,000 a month of affiliate revenue, unlimited campaigns, branded portal" },
      { plan: "Enterprise", price: "$149+/month, or $1,490+/year", note: "Up to $30,000 a month on the entry tier, phone support, PayPal payouts" },
    ],
    freeTier: "A 14 day free trial on every plan.",
    how: "Affiliates and partners send you signups; you pay them a commission on real payments.",
    promise: "All-in-One Affiliate Management Software for SaaS",
    whereTheyWin: [
      "Rewardful plugs into Stripe, so each commission is tracked on a real payment.",
      "Partners who already have your buyers' attention send signups that cost nothing until they pay.",
    ],
    chooseThemIf: ["You want affiliates paid only on real revenue.", "You bill through Stripe.", "You already have partners who talk to your buyers."],
  },
  {
    slug: "referralhero",
    name: "ReferralHero",
    domain: "referralhero.com",
    oneLiner: "Referral program software that helps businesses track, reward and grow customer referrals.",
    sourceUrl: REFERRALHERO,
    verifiedOn: "2026-10-30",
    entryPrice: "From $249/month",
    prices: [
      { plan: "Basic", price: "$249/month", note: "1,000 subscribers, 1 campaign, 25,000 emails a month" },
      { plan: "Pro", price: "$399/month", note: "Unlimited subscribers and campaigns, 500+ integrations, custom branding and domains" },
      { plan: "Pro + Done For You", price: "Custom, book a demo", note: "Strategy, design, full setup and launch, ongoing changes" },
    ],
    freeTier: "A 7 day free trial.",
    how: "A waitlist, contest or referral program where your users invite their friends.",
    promise: "In just 48 hours, we help you build an AI-powered waitlist, contest, affiliate, or referral program",
    whereTheyWin: [
      "ReferralHero can run a waitlist or a contest that collects signups before your product ships.",
      "Word of mouth grows with your audience, with no cost per contact.",
    ],
    chooseThemIf: ["You want a waitlist before launch.", "You want contests or giveaways to bring signups.", "Your users already love to share you."],
  },
  {
    slug: "userpilot",
    name: "Userpilot",
    domain: "userpilot.com",
    oneLiner: "A product growth and analytics platform that helps SaaS teams improve the experience inside their product.",
    sourceUrl: USERPILOT,
    verifiedOn: "2026-10-30",
    entryPrice: "From $299/month",
    prices: [
      { plan: "Starter", price: "$299/month", note: "2,000 monthly active users, in app engagement, segments, NPS, 3 seats" },
      { plan: "Growth", price: "From $849/month", note: "Product analytics, autocapture, resource center, 100k emails a month, 15 seats" },
      { plan: "Enterprise", price: "Custom", note: "Mobile engagement, data warehouse sync, custom SLA" },
    ],
    freeTier: "A 14 day free trial, no card.",
    how: "Tours and checklists inside your product, for people who already signed up.",
    promise: "Turn every signup into an activated user",
    whereTheyWin: [
      "Userpilot guides users inside your product with tours and checklists.",
      "Its analytics show where a new user gets stuck before activating.",
    ],
    chooseThemIf: ["You want tours and checklists inside your app.", "You want product analytics on activation.", "You have a product team to build the flows."],
  },
  {
    slug: "userlist",
    name: "Userlist",
    domain: "userlist.com",
    oneLiner: "An email marketing platform for SaaS companies, built for product marketers.",
    sourceUrl: USERLIST,
    verifiedOn: "2026-10-30",
    entryPrice: "From $149/month",
    prices: [
      { plan: "Basic", price: "$149/month, or $119/month billed yearly", note: "10,000 users, 5 seats, lifecycle email, in app messages, workflows" },
      { plan: "Professional", price: "$349/month, or $279/month billed yearly", note: "10,000 users, 10 seats, A/B tests, conversion goals" },
      { plan: "Enterprise", price: "Custom", note: "Custom limits, data planning done for you, account manager" },
    ],
    freeTier: "A 14 day free trial, card required.",
    how: "Lifecycle emails and in app messages to people who already signed up, from flows you build.",
    promise: "Drive conversions at every stage of your product lifecycle",
    whereTheyWin: [
      "Userlist sends email and in app messages based on what each user does in your product.",
      "A founder with many signups gets one place for onboarding, trial and upgrade emails.",
    ],
    chooseThemIf: ["You want onboarding emails tied to product events.", "You want to build and own your lifecycle flows.", "You already have plenty of signups to convert."],
  },
];

export function signupVsPath(t: Pick<SignupTool, "slug">): string {
  return `${SIGNUP_PAGE_PATH}/vs/${t.slug}`;
}

export function signupToolBySlug(slug: string): SignupTool | undefined {
  return SIGNUP_TOOLS.find((t) => t.slug === slug);
}

/** Every page of the cluster, for the sitemap. */
export function signupClusterPaths(): string[] {
  return [SIGNUP_ALTERNATIVES_PATH, ...SIGNUP_TOOLS.map(signupVsPath)];
}

/** The links the page's footer and its FAQ close on. */
export function signupCompareLinks(): { label: string; href: string }[] {
  return [
    ...SIGNUP_TOOLS.map((t) => ({ label: `distribute.you vs ${t.name}`, href: signupVsPath(t) })),
    { label: "Signup automation alternatives", href: SIGNUP_ALTERNATIVES_PATH },
  ];
}
