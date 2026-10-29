/**
 * The competitors we compare ourselves against, one entry per `/compare/<slug>` page.
 *
 * This catalogue is the ONE source for the comparison cluster: the pages, the hub, the
 * alternatives page, the sitemap, `llms.txt` and the homepage footer column all read it,
 * so a competitor added here appears everywhere at once and nowhere else has a list to
 * keep in step.
 *
 * Every figure about a competitor carries the URL it was read from and the date it was
 * read. Nothing here is written from memory: a wrong price on a comparison page is an SEO
 * liability and a legal one. When a price moves, update the figure, the URL if it moved,
 * and `verifiedOn`, in one edit.
 *
 * Alias-free (no `@/` import) so `tests/unit/compare-pages.test.ts` can import it directly.
 */

export type Category =
  | "cold-email-tool"
  | "ai-sdr"
  | "data-platform"
  | "sales-engagement"
  | "linkedin-outreach"
  | "inbound-routing"
  | "post-purchase"
  | "employee-advocacy";

export type PricePoint = {
  /** The plan as the competitor names it. */
  readonly plan: string;
  /** The price as the competitor states it, with its unit. */
  readonly price: string;
  /** What that price buys, in the competitor's own terms. */
  readonly note: string;
};

export type Competitor = {
  /** URL segment under `/compare/`. */
  readonly slug: string;
  readonly name: string;
  /** Registrable domain, for the logo and the outbound link. */
  readonly domain: string;
  readonly category: Category;
  /** How they describe themselves, paraphrased from their own site. */
  readonly oneLiner: string;
  /** The pricing page every figure below was read from. */
  readonly sourceUrl: string;
  /** ISO date the source was read. */
  readonly verifiedOn: string;
  /** Their pricing model in one sentence. */
  readonly pricingModel: string;
  /** The cheapest way in, as a short label for the table. */
  readonly entryPrice: string;
  readonly prices: readonly PricePoint[];
  /** Who runs the campaign day to day. */
  readonly operatedBy: "you" | "their AI agent" | "their team";
  /** Whose mailboxes and domains send. */
  readonly sendingDomains: string;
  /** Where leads come from. */
  readonly leads: string;
  /** What happens to a reply. */
  readonly replies: string;
  readonly channels: string;
  /** Whether they publish what a sales meeting costs their customers. */
  readonly costPerMeetingPublished: boolean;
  readonly freeTier: string;
  readonly contract: string;
  readonly whereTheyWin: readonly string[];
  readonly whereWeWin: readonly string[];
  readonly chooseThemIf: readonly string[];
  readonly chooseUsIf: readonly string[];
  readonly faq: readonly { readonly q: string; readonly a: string }[];
};


/**
 * How WE answer each row. Stated once, so eleven pages cannot describe us eleven ways.
 * The fleet figures (hot leads, companies, median cost per hot lead) are NOT here: they
 * are the `__HOT_LEAD_BAND__` token static-html.ts resolves from the same read as the
 * homepage hero, so a compare page and the homepage cannot state two different fleets.
 */
export const DISTRIBUTE_ROW = {
  entryPrice: "Free for one user. Every action at the API price, 0% markup",
  pricingModel:
    "Free for one user, $9 per user for a team. Every action at the vendor's API price, 0% markup, from a prepaid balance. Start with $10, cancel anytime.",
  operatedBy: "We run it end to end",
  sendingDomains: "Domains and mailboxes we own and warm. Your domain never sends cold email.",
  leads: "We find and qualify the buyers from your website. Bring your own list as an extra audience if you like.",
  replies: "We read every reply and answer the interested ones until the meeting is booked.",
  channels: "Cold email, every campaign A/B tested and measured.",
  costPerMeeting: "Yes. What an engaged lead and a meeting cost you is on your dashboard, and the fleet's median cost per engaged lead is published on this page.",
  freeTier: "Free for one user, and open source. You pay only for the actions, at the API price, and your campaign starts sending on day one.",
  contract: "None. Pause or cancel anytime; your credit is a hard cap.",
} as const;

export const COMPETITORS: readonly Competitor[] = [
  {
    slug: "instantly",
    name: "Instantly",
    domain: "instantly.ai",
    category: "cold-email-tool",
    oneLiner: "A cold email sending platform with unlimited mailbox connections, built-in warmup and a B2B lead database.",
    sourceUrl: "https://instantly.ai/pricing",
    verifiedOn: "2026-09-07",
    pricingModel: "Monthly subscription per workspace. Mailboxes and domains are bought separately.",
    entryPrice: "$47/month",
    prices: [
      { plan: "Growth", price: "$47/month", note: "5,000 emails and 1,000 uploaded contacts a month, unlimited mailboxes and warmup" },
      { plan: "Starter bundle", price: "$94/month", note: "5,000 emails, 1,000 contacts, 1,500 lead credits" },
      { plan: "Scale bundle", price: "$194/month", note: "100,000 emails, 25,000 contacts, 5,000 lead credits" },
      { plan: "Agency bundle", price: "$555/month", note: "500,000 emails, 100,000 contacts, 10,000 lead credits" },
    ],
    operatedBy: "you",
    sendingDomains: "Yours. You buy the domains and mailboxes, connect them, and let their warmup run.",
    leads: "Their 450M+ contact database, on credits, or your own upload.",
    replies: "Land in their Unibox for you to answer. An AI reply agent is on the bundles.",
    channels: "Email.",
    costPerMeetingPublished: false,
    freeTier: "14-day trial.",
    contract: "Monthly or annual, about 10% off annual.",
    whereTheyWin: [
      "Volume. Half a million emails a month on the top plan, from as many mailboxes as you connect.",
      "Control. Every sequence, every send window and every warmup setting is yours to tune.",
      "A large contact database inside the same tool.",
    ],
    whereWeWin: [
      "Nothing to run. You paste a website; we pick the buyers, write, send, and read the replies.",
      "Your domain stays out of it. We send from domains we own and warm.",
      "The cost of a positive reply is measured and shown, not left for you to work out from a sends counter.",
    ],
    chooseThemIf: [
      "You have an SDR or a growth person whose job is to run outbound every day.",
      "You already own warmed domains and a list, and you want the sending engine only.",
    ],
    chooseUsIf: [
      "You want meetings, not a tool to learn.",
      "You would rather be charged for what a campaign spent than for a seat.",
    ],
    faq: [
      { q: "Is distribute.you a cheaper Instantly?", a: "No. Instantly is software you run; distribute.you runs the campaign for you. You never touch a mailbox, a domain or a sequence." },
      { q: "Can I use Instantly and distribute.you together?", a: "Yes. Some clients keep Instantly for a house list and let us run the cold outreach from our own domains, so their sending reputation is never on the line." },
      { q: "Where do the replies go?", a: "To us first. We answer the interested ones until a meeting is booked, then hand the conversation to you. You still see every reply on your dashboard, including the refusals." },
    ],
  },
  {
    slug: "gojiberry",
    name: "Gojiberry",
    domain: "gojiberry.ai",
    category: "ai-sdr",
    oneLiner: "A Y Combinator-backed AI sales rep for founders that prospects across email and LinkedIn from warm signals.",
    sourceUrl: "https://gojiberry.ai/",
    verifiedOn: "2026-09-07",
    pricingModel: "Monthly subscription per agent set, with a custom tier above it.",
    entryPrice: "$99/month",
    prices: [
      { plan: "Pro", price: "$99/month", note: "Two AI agents prospecting around the clock, up to 1,800 prospects contacted a month" },
      { plan: "Custom", price: "On request", note: "A custom number of agents and prospects, more senders across channels" },
    ],
    operatedBy: "their AI agent",
    sendingDomains: "Senders you connect or buy through them.",
    leads: "Sourced by the agents from intent signals and their database.",
    replies: "Surfaced to you as warm leads to take over.",
    channels: "Email and LinkedIn.",
    costPerMeetingPublished: false,
    freeTier: "Free trial.",
    contract: "Monthly, cancel any time.",
    whereTheyWin: [
      "LinkedIn in the same run as email.",
      "A fixed monthly price, easy to budget.",
      "Live in a few minutes, self-serve.",
    ],
    whereWeWin: [
      "A person answers the interested replies and books the meeting; you are handed a conversation, not a lead to chase.",
      "No monthly fee for one user: what you spend covers the list, the emails and the sending, at the API price.",
      "The cost of a positive reply is measured on your account and published across ours.",
    ],
    chooseThemIf: [
      "LinkedIn is where your buyers answer and you want one agent doing both channels.",
      "You want to steer the agent yourself and a flat monthly price suits you.",
    ],
    chooseUsIf: [
      "You want the whole thing run for you, replies included.",
      "You want to see what a meeting costs before you scale the budget.",
    ],
    faq: [
      { q: "Both are AI sales reps for founders. What is the difference?", a: "Gojiberry sells you an AI agent you configure and watch. distribute.you runs it for you: we run the campaign, read the replies and book the meeting, and you see what each one cost." },
      { q: "Does distribute.you do LinkedIn?", a: "Not today. Cold email is the channel we run; new channels are added once we can measure them the same way." },
      { q: "Which is cheaper?", a: "Gojiberry sells the agent for $99 a month. At distribute.you one user is free, you choose how much goes to the campaign, and a bigger budget reaches more leads." },
    ],
  },
  {
    slug: "explee",
    name: "Explee",
    domain: "explee.com",
    category: "ai-sdr",
    oneLiner: "AI agents that research a market, find prospects, write the emails and book demos, priced per email sent.",
    sourceUrl: "https://explee.com/pricing",
    verifiedOn: "2026-10-04",
    pricingModel: "Pay as you go, no subscription: per email for the outreach agent, per 1,000 records for the database.",
    entryPrice: "$30 for 750 emails",
    prices: [
      { plan: "Outreach Agent", price: "$30 for 750 emails", note: "Their estimate: about 2 to 6 warm leads and 1 meeting per $30, $1 to $20 per lead" },
      { plan: "Database, deep research", price: "From $5 per 1,000 records", note: "Company records by country or worldwide, semantic search free" },
      { plan: "Database, emails", price: "From $10 per 1,000 records", note: "Decision maker emails from the same database" },
    ],
    operatedBy: "their AI agent",
    sendingDomains: "Pre-warmed domains they provide.",
    leads: "Found by the agent from their 536M-profile database.",
    replies: "Warm leads and booked demos surfaced to you.",
    channels: "Email.",
    costPerMeetingPublished: false,
    freeTier: "$30 to try it.",
    contract: "None, pay as you go.",
    whereTheyWin: [
      "A very low price per email.",
      "A large B2B database beside the agent, sold per record.",
      "Pre-warmed domains included, so nothing to set up.",
    ],
    whereWeWin: [
      "You pay for a campaign that reports what a positive reply cost, not for a count of emails.",
      "A person answers the interested replies and books the meeting.",
      "The price per outcome is measured across clients and published live.",
    ],
    chooseThemIf: [
      "You think in emails sent and want the lowest price per thousand.",
      "You want to buy prospect data per record beside the agent.",
    ],
    chooseUsIf: [
      "You think in meetings and want to know what one costs.",
      "You want a human in the loop from the first interested reply.",
    ],
    faq: [
      { q: "How much does Explee cost?", a: "Explee has no subscription. Its outreach agent costs $30 for 750 emails, and Explee estimates that buys about 2 to 6 warm leads and 1 meeting. Its database costs from $5 per 1,000 records for company research and from $10 per 1,000 for emails. New accounts get $30 to try it." },
      { q: "Explee sends from pre-warmed domains too. What differs?", a: "Who runs it. Explee hands the agent to you. distribute.you runs the campaign for you and answers the interested replies until a meeting is booked." },
      { q: "Is $30 for 750 emails cheaper than distribute.you?", a: "Per email, yes. distribute.you is free for one user: you choose your outreach budget. Per meeting, the honest answer is on your dashboard after the first weeks. We publish our clients' cost per positive reply so you can judge before you start." },
    ],
  },
  {
    slug: "apollo",
    name: "Apollo.io",
    domain: "apollo.io",
    category: "data-platform",
    oneLiner: "A B2B contact database with sequencing, dialer and enrichment, sold per user.",
    sourceUrl: "https://www.apollo.io/pricing",
    verifiedOn: "2026-09-07",
    pricingModel: "Per user per month, with credits for contact data.",
    entryPrice: "Free plan, then $49/user/month",
    prices: [
      { plan: "Free", price: "$0", note: "Limited contact database and basic engagement" },
      { plan: "Basic", price: "$49/user/month", note: "Contact access, CRM integrations, email automation" },
      { plan: "Professional", price: "$99/user/month", note: "Advanced automation, engagement tracking, AI insights" },
      { plan: "Enterprise", price: "On request", note: "Dedicated support, advanced analytics, API access" },
    ],
    operatedBy: "you",
    sendingDomains: "Yours. You connect your own mailboxes.",
    leads: "Their database, on credits.",
    replies: "Land in your inbox and their engagement view.",
    channels: "Email, phone, LinkedIn tasks.",
    costPerMeetingPublished: false,
    freeTier: "Free plan with limited credits.",
    contract: "Monthly or annual per user.",
    whereTheyWin: [
      "The database. Hundreds of millions of contacts with filters and enrichment.",
      "A full sales stack for a team: sequences, dialer, CRM sync.",
      "A free plan to start with.",
    ],
    whereWeWin: [
      "Nobody on your side has to run sequences or warm mailboxes.",
      "Your own domain never sends cold email.",
      "One user is free. You pay for outreach at the API price, and a team is $9 per user.",
    ],
    chooseThemIf: [
      "You have a sales team that needs a shared database and a dialer.",
      "You want to own every step of outbound in one tool.",
    ],
    chooseUsIf: [
      "You have no SDR and do not want to become one.",
      "You want the outcome measured and delivered, not the data to produce it.",
    ],
    faq: [
      { q: "Does distribute.you use Apollo data?", a: "We source contacts from several providers and pay for them inside your budget. You never buy credits or manage a database." },
      { q: "Can my team use Apollo for the CRM and still run distribute.you?", a: "Yes. The interested replies we forward can be logged in whatever CRM you keep." },
      { q: "Why is Apollo priced per user and distribute.you by credit?", a: "Apollo sells software seats. distribute.you sells a campaign: the credit you add is spent on it, so the number of people on your side changes nothing." },
    ],
  },
  {
    slug: "salesforge",
    name: "Salesforge",
    domain: "salesforge.ai",
    category: "cold-email-tool",
    oneLiner: "A sending platform with unlimited mailbox connections, sold beside its own mailbox, warmup and infrastructure products and an AI agent named Frank.",
    sourceUrl: "https://www.salesforge.ai/pricing",
    verifiedOn: "2026-09-07",
    pricingModel: "Monthly subscription, with sibling products for mailboxes and infrastructure billed on top.",
    entryPrice: "$40/month",
    prices: [
      { plan: "Pro", price: "$40/month", note: "1,000 active contacts, 5,000 emails a month, unlimited mailbox connections" },
      { plan: "Growth", price: "$80/month", note: "10,000 active contacts, 50,000 emails a month, unlimited users" },
      { plan: "Agent Frank", price: "$499/month, billed quarterly", note: "Their AI agent prospecting around the clock with a dedicated account manager" },
      { plan: "Mailforge and Infraforge", price: "$86 and $109/month", note: "Their mailbox and private infrastructure add-ons" },
    ],
    operatedBy: "you",
    sendingDomains: "Yours, or bought through their Mailforge and Primeforge products.",
    leads: "Your upload, or their contact search on the agent plan.",
    replies: "Land in your connected inboxes.",
    channels: "Email, with LinkedIn actions on credits.",
    costPerMeetingPublished: false,
    freeTier: "Trial.",
    contract: "Monthly or annual, two months free on annual.",
    whereTheyWin: [
      "One vendor for the tool, the mailboxes and the warmup.",
      "A low entry price for a team that runs its own outbound.",
      "An AI agent option when you want less hands-on time.",
    ],
    whereWeWin: [
      "There is no stack to assemble. The mailboxes, the warmup, the copy and the replies are our job.",
      "You pay for campaign spend, not for a plan plus a mailbox product plus an infrastructure product.",
      "The cost of a positive reply is measured and published.",
    ],
    chooseThemIf: [
      "You run outbound in-house and want to buy every layer from one place.",
      "You want unlimited mailboxes for a large team.",
    ],
    chooseUsIf: [
      "You would rather not own a sending stack at all.",
      "You want one number: what a meeting costs you.",
    ],
    faq: [
      { q: "Agent Frank is an AI agent too. How is distribute.you different?", a: "Frank is software you configure at $499 a month. distribute.you is an AI agent, free for one user, that runs the campaign for you on domains we own, and answers the interested replies." },
      { q: "Do I still need mailboxes with distribute.you?", a: "No. We send from mailboxes and domains we own and warm. Your domain never touches cold outreach." },
      { q: "Which costs less?", a: "For a team running its own outbound at volume, Salesforge's $40 or $80 plan is cheap software. For a founder who wants meetings without running anything, distribute.you is free for one user, every dollar you choose spent on the campaign, and shows what each positive reply cost." },
    ],
  },
  {
    slug: "11x",
    name: "11x",
    domain: "11x.ai",
    category: "ai-sdr",
    oneLiner: "Enterprise AI digital workers: Alice for outbound, Julian for inbound calls, sold through a sales team.",
    sourceUrl: "https://www.11x.ai/",
    verifiedOn: "2026-09-07",
    pricingModel: "Not published. Demo and contract through their sales team.",
    entryPrice: "On request",
    prices: [
      { plan: "Alice and Julian", price: "On request", note: "Annual contracts through a demo; no price on the site" },
    ],
    operatedBy: "their AI agent",
    sendingDomains: "Configured with their team during onboarding.",
    leads: "Sourced by the agent from their data partners.",
    replies: "Handled by the agent across channels, escalated to your team.",
    channels: "Email, phone, LinkedIn, SMS, WhatsApp, chat.",
    costPerMeetingPublished: false,
    freeTier: "None.",
    contract: "Annual, enterprise.",
    whereTheyWin: [
      "Breadth of channels, phone included.",
      "Enterprise controls: SOC 2, security reviews, dedicated onboarding.",
      "Backed by a16z and Benchmark with $70M+ raised.",
    ],
    whereWeWin: [
      "You can start today for free, without a demo or an annual contract.",
      "A price you can see, and a cost per positive reply measured on your account.",
      "Built for founders and small teams, not procurement.",
    ],
    chooseThemIf: [
      "You are an enterprise sales org with a procurement process and a multi-channel motion.",
      "Inbound phone handling matters as much as outbound email.",
    ],
    chooseUsIf: [
      "You want to start this week with a website and a small budget.",
      "You want to know the price before the call.",
    ],
    faq: [
      { q: "How much does 11x cost?", a: "They do not publish it. Pricing comes after a demo, on an annual contract. distribute.you publishes its prices: one user is free, and every action is billed at the vendor's API price with 0% markup." },
      { q: "Is distribute.you enterprise-ready?", a: "We serve founders and small B2B teams. If you need SOC 2 paperwork and a security review before a pilot, 11x is built for that buyer." },
      { q: "Can a small company use 11x?", a: "Their site targets sales, RevOps and marketing teams at larger companies. For a solo founder or a team of three, distribute.you is sized and priced for you." },
    ],
  },
  {
    slug: "smartlead",
    name: "Smartlead",
    domain: "smartlead.ai",
    category: "cold-email-tool",
    oneLiner: "A cold email sending platform with unlimited mailboxes, a shared warmup pool and agency client workspaces.",
    sourceUrl: "https://www.smartlead.ai/pricing",
    verifiedOn: "2026-10-04",
    pricingModel: "Monthly subscription by contacts and sends. Mailboxes and domains are paid on top.",
    entryPrice: "$39/month",
    prices: [
      { plan: "Base", price: "$39/month ($32.50 billed yearly)", note: "2,000 contacts, 6,000 emails a month, unlimited mailboxes" },
      { plan: "Pro", price: "$94/month ($78.30 billed yearly)", note: "30,000 contacts, 90,000 emails a month" },
      { plan: "Unlimited Smart", price: "$174/month ($144.50 billed yearly)", note: "Unlimited contacts, 150,000 emails a month" },
      { plan: "Unlimited Prime", price: "$379/month ($314.60 billed yearly)", note: "Unlimited contacts, 500,000 emails a month, 3 dedicated servers" },
      { plan: "Mailboxes", price: "From $3.99/mailbox/month", note: "Plus $13 to $19 per domain a year, bought through their partners" },
      { plan: "Client workspace", price: "$29/month each", note: "White label for agencies, from the Pro plan" },
    ],
    operatedBy: "you",
    sendingDomains: "Yours. You bring the mailboxes; their warmup pool is included.",
    leads: "Your upload. Email verification is included per plan.",
    replies: "Land in their master inbox for you to answer.",
    channels: "Email.",
    costPerMeetingPublished: false,
    freeTier: "14-day trial.",
    contract: "Monthly or annual, about 17% off annual.",
    whereTheyWin: [
      "Cheap volume: half a million sends a month on the top plan.",
      "Client workspaces built for agencies running many accounts.",
      "Warmup pool included on every plan.",
    ],
    whereWeWin: [
      "No mailboxes to buy, no list to upload, no sequences to write.",
      "Your reputation stays untouched: we send from our domains.",
      "A measured cost per positive reply instead of a sends counter.",
    ],
    chooseThemIf: [
      "You are an agency running outbound for many clients and want one console.",
      "You have the list and the mailboxes and only need the engine.",
    ],
    chooseUsIf: [
      "You want the meetings, not the console.",
      "You want to be charged on spend, not on a plan tier you have to size.",
    ],
    faq: [
      { q: "How much does Smartlead cost?", a: "Smartlead has four plans: Base at $39 a month, Pro at $94, Unlimited Smart at $174 and Unlimited Prime at $379. Yearly billing takes about 17% off. Mailboxes cost extra, from $3.99 each a month plus $13 to $19 per domain a year, and each agency client workspace is $29 a month." },
      { q: "Smartlead is $39 a month. How can distribute.you compete on price?", a: "Different things are being priced. $39 buys the sending software; you still buy mailboxes, a list and someone's time. distribute.you is free for one user, and the outreach budget you choose covers all of it." },
      { q: "I run an agency. Which should I use?", a: "If your team runs client outbound by hand, Smartlead's workspaces are made for you. If you want to resell outbound without staffing it, distribute.you runs each client brand as its own campaign." },
    ],
  },
  {
    slug: "lemlist",
    name: "Lemlist",
    domain: "lemlist.com",
    category: "cold-email-tool",
    oneLiner: "A multichannel outreach platform with email, LinkedIn, calls and a 650M-lead database, sold per user.",
    sourceUrl: "https://www.lemlist.com/pricing",
    verifiedOn: "2026-09-07",
    pricingModel: "Per user per month, email-only or multichannel.",
    entryPrice: "$69/month",
    prices: [
      { plan: "Email", price: "$69/month ($55 annual)", note: "50,000 emails a month, unlimited users, warmup, lead database" },
      { plan: "Multichannel", price: "$109/user/month ($87 annual)", note: "Unlimited emails and messages, LinkedIn, SMS, WhatsApp, dialer" },
      { plan: "Enterprise", price: "On request", note: "Roles, SSO, dedicated manager" },
    ],
    operatedBy: "you",
    sendingDomains: "Yours, connected to their deliverability hub.",
    leads: "Their 650M+ database on credits, or your upload.",
    replies: "Land in their unified inbox for you to answer.",
    channels: "Email, LinkedIn, SMS, WhatsApp, calls.",
    costPerMeetingPublished: false,
    freeTier: "14-day trial.",
    contract: "Monthly or annual per user.",
    whereTheyWin: [
      "Five channels in one sequence.",
      "A large database and a dialer inside the tool.",
      "Mature templates and a big community of users.",
    ],
    whereWeWin: [
      "You do not write, send or answer anything. We do.",
      "No seat: a founder and a team of ten pay the same for the same campaign.",
      "The cost of a positive reply is measured and shown.",
    ],
    chooseThemIf: [
      "Your buyers answer on LinkedIn or by phone and you have people to work those channels.",
      "You want a proven self-serve tool with a large template library.",
    ],
    chooseUsIf: [
      "You want cold email run for you and the meetings booked.",
      "You want the campaign priced on what it spent.",
    ],
    faq: [
      { q: "Lemlist does LinkedIn and calls. Does distribute.you?", a: "Not yet. We run cold email and measure every outcome; other channels are added once we can measure them the same way." },
      { q: "Is distribute.you cheaper than Lemlist?", a: "For one person, Lemlist is $69 a month plus your time. distribute.you is free for one user, every dollar you choose spent on your campaign, with the work included." },
      { q: "Can I keep Lemlist for my house list?", a: "Yes. Many clients keep a tool for warm contacts and let us run cold outreach from our own domains." },
    ],
  },
  {
    slug: "clay",
    name: "Clay",
    domain: "clay.com",
    category: "data-platform",
    oneLiner: "A data enrichment and GTM workflow builder that pulls from many providers on credits, for teams that build their own outbound.",
    sourceUrl: "https://www.clay.com/pricing",
    verifiedOn: "2026-09-07",
    pricingModel: "Monthly credits for data and actions, tiered by plan.",
    entryPrice: "Free plan, then from $167/month",
    prices: [
      { plan: "Free", price: "$0", note: "100 data credits and 500 actions a month" },
      { plan: "Launch", price: "From $167/month", note: "2,500 data credits and 15,000 actions a month; lower on annual" },
      { plan: "Growth", price: "From $446/month", note: "6,000 data credits and 40,000 actions a month" },
      { plan: "Enterprise", price: "On request", note: "100,000+ credits for GTM systems at scale" },
    ],
    operatedBy: "you",
    sendingDomains: "Not a sending tool. You connect a sequencer.",
    leads: "Built in tables from dozens of data providers, on credits.",
    replies: "Handled in whatever sequencer you connect.",
    channels: "Data and workflows; sending happens elsewhere.",
    costPerMeetingPublished: false,
    freeTier: "Free plan with 100 credits.",
    contract: "Monthly or annual.",
    whereTheyWin: [
      "The most flexible data layer in the category: waterfalls across providers, AI columns, any workflow.",
      "Loved by GTM engineers who want to build.",
      "A free plan to learn on.",
    ],
    whereWeWin: [
      "You do not need a GTM engineer. The finding, writing, sending and answering are done for you.",
      "One price for the outcome instead of credits for data plus a sequencer plus someone's week.",
      "Your domain never sends cold email.",
    ],
    chooseThemIf: [
      "You have someone who builds outbound systems and wants full control of the data.",
      "You already run a sequencer and need better inputs for it.",
    ],
    chooseUsIf: [
      "You want the meetings without building the machine.",
      "You want one measured cost per positive reply, not a credit ledger.",
    ],
    faq: [
      { q: "Clay is not a sending tool. Why compare?", a: "Because a founder deciding how to get meetings weighs building an outbound system in Clay against having one run for them. distribute.you is the second option." },
      { q: "Does distribute.you enrich leads?", a: "Yes, inside your budget. We source and qualify the buyers; you never buy credits or manage a table." },
      { q: "Can I feed Clay data into distribute.you?", a: "You can upload a list as its own audience. We run it beside the audiences we find and report its cost per outcome separately." },
    ],
  },
  {
    slug: "artisan",
    name: "Artisan",
    domain: "artisan.co",
    category: "ai-sdr",
    oneLiner: "An outbound platform led by Ava, an AI BDR that finds leads, writes and sends, handles replies and books meetings.",
    sourceUrl: "https://www.artisan.co/pricing",
    verifiedOn: "2026-09-07",
    pricingModel: "Credit-based tiers from startup to enterprise. Figures are not on the page; a call sets the price.",
    entryPrice: "On request",
    prices: [
      { plan: "Credit-based tiers", price: "On request", note: "Startups through enterprise; the pricing page states the model, not the figures" },
    ],
    operatedBy: "their AI agent",
    sendingDomains: "Set up through their platform during onboarding.",
    leads: "Sourced by Ava from their database.",
    replies: "Handled by Ava, meetings booked to your calendar.",
    channels: "Email, with LinkedIn.",
    costPerMeetingPublished: false,
    freeTier: "None stated.",
    contract: "Through their sales team.",
    whereTheyWin: [
      "An all-in-one platform with the agent, the data and the sequencer together.",
      "Ava handles replies and books meetings on her own.",
      "Built for teams from startup to enterprise.",
    ],
    whereWeWin: [
      "Published prices: free for one user, every action at the API price with 0% markup.",
      "A person, not only a model, answers the interested replies.",
      "You can start today from a website, without a sales call.",
    ],
    chooseThemIf: [
      "You want an AI agent inside a full platform and a sales-led onboarding.",
      "Your team will steer the agent week to week.",
    ],
    chooseUsIf: [
      "You want to know what you will pay before you talk to anyone.",
      "You want the campaign run as a service and measured per meeting.",
    ],
    faq: [
      { q: "How much does Artisan cost?", a: "Their pricing page describes credit-based tiers without figures; a call sets the price. distribute.you is free for one user, with every action at the API price and 0% markup." },
      { q: "Ava books meetings. So does distribute.you. What differs?", a: "Ava is an agent you license and steer. distribute.you runs it for you: we run the campaign from our own domains and a person handles the interested replies with the model." },
      { q: "Which is faster to start?", a: "distribute.you runs from your website within minutes and the first sends leave the same day. Artisan starts with a demo and an onboarding." },
    ],
  },
  {
    slug: "aisdr",
    name: "AiSDR",
    domain: "aisdr.com",
    category: "ai-sdr",
    oneLiner: "An AI SDR platform that prospects, personalises and runs email and LinkedIn outreach, with a strategist agent named Ami.",
    sourceUrl: "https://aisdr.com/pricing",
    verifiedOn: "2026-09-07",
    pricingModel: "Monthly plans by contacts reached, quarterly commitment above the entry plan.",
    entryPrice: "$250/month",
    prices: [
      { plan: "Solo", price: "$250/month", note: "200 contacts a month, one user, self-serve" },
      { plan: "Explore", price: "$900/month, quarterly", note: "800 contacts a month, unlimited users, GTM engineer support" },
      { plan: "Scale", price: "$2,500/month, quarterly", note: "2,500 contacts a month, managed options, priority support" },
    ],
    operatedBy: "their AI agent",
    sendingDomains: "Set up and warmed by them as part of the plan.",
    leads: "Sourced from their 300M+ database.",
    replies: "Handled by the agent, with human support on the higher plans.",
    channels: "Email and LinkedIn.",
    costPerMeetingPublished: false,
    freeTier: "None; onboarding included.",
    contract: "Monthly on Solo, quarterly or annual above it. 20% off annual.",
    whereTheyWin: [
      "Email infrastructure and warmup included in the plan.",
      "LinkedIn in the same motion as email.",
      "HubSpot and Salesforce integrations out of the box.",
    ],
    whereWeWin: [
      "Free for one user instead of $250 a month. Every dollar you choose goes to your campaign.",
      "No quarterly commitment.",
      "The cost of a positive reply measured on your account and published across clients.",
    ],
    chooseThemIf: [
      "You want a fixed monthly volume of contacts and a CRM-integrated agent.",
      "You are ready for a quarterly commitment at $900 or more.",
    ],
    chooseUsIf: [
      "You want to start small and let results set the budget.",
      "You want a human in the loop on the interested replies.",
    ],
    faq: [
      { q: "AiSDR's Solo plan is $250 a month. What does distribute.you cost for the same?", a: "One user is free, with no fixed contact count: every dollar becomes campaign credit, and the dashboard shows what each positive reply cost." },
      { q: "Do both handle infrastructure?", a: "Yes. AiSDR sets up and warms domains inside your plan. distribute.you sends from domains we own and warm, so nothing is set up in your name at all." },
      { q: "Is there a commitment with distribute.you?", a: "No. Cancel anytime, and your monthly amount is a hard cap." },
    ],
  },
  {
    slug: "parcellab",
    name: "parcelLab",
    domain: "parcellab.com",
    category: "post-purchase",
    oneLiner: "A post-purchase platform for retailers: order tracking, branded delivery messages, returns, exchanges and refunds in one place.",
    sourceUrl: "https://parcellab.com/",
    verifiedOn: "2026-10-03",
    pricingModel: "Not published. Demo and contract through their sales team.",
    entryPrice: "On request",
    prices: [
      { plan: "Platform (Convert, Engage, Retain, Insights, AI Agents)", price: "On request", note: "Sold after a demo; no price on the site" },
    ],
    operatedBy: "you",
    sendingDomains: "Your store's own domain, writing to shoppers who already ordered. It sends no cold email.",
    leads: "None. It messages the customers already in your order data.",
    replies: "Not what it is for. Its AI agent answers where-is-my-order, return and refund questions from your customers.",
    channels: "Branded tracking pages and post-purchase email to existing customers.",
    costPerMeetingPublished: false,
    freeTier: "None published; it starts with a demo.",
    contract: "Not published. Enterprise sales.",
    whereTheyWin: [
      "Everything after the checkout: tracking pages, delivery updates, returns, exchanges and refunds in one platform.",
      "Built for large retailers, with IKEA, Puma and Dyson among the brands on its site.",
      "Fewer where-is-my-order tickets for your support team.",
    ],
    whereWeWin: [
      "We bring you buyers you do not have yet. parcelLab talks to people who already bought from you.",
      "Free for one user, with nothing to set up on your side.",
      "The cost of a positive reply is measured and shown on your dashboard.",
    ],
    chooseThemIf: [
      "You run an online store with steady order volume and want fewer support tickets and more repeat purchases.",
      "Your problem is returns, delivery updates or customers asking where their order is.",
    ],
    chooseUsIf: [
      "You sell to businesses and need sales meetings with companies that have never heard of you.",
      "You searched for a parcelLab alternative because you want new customers, not a better experience for the ones you have.",
    ],
    faq: [
      { q: "Is distribute.you a parcelLab alternative?", a: "Only if what you need is new customers. parcelLab improves what happens after a shopper buys: tracking, delivery messages and returns. distribute.you runs cold email for you: we find companies who have never bought from you and books sales meetings with them. A retailer can use both." },
      { q: "Does distribute.you send order or shipping notifications?", a: "No. We send cold email to prospects from domains we own, never transactional email to your customers. For tracking pages and delivery updates, a post-purchase platform like parcelLab is the right pick." },
      { q: "Can an e-commerce brand use distribute.you?", a: "Yes, when it sells to other businesses, for example wholesale buyers, shops that could stock your products, or corporate gifting. You paste your website and we find and qualify those buyers." },
    ],
  },
  {
    slug: "postbeyond",
    name: "PostBeyond",
    domain: "postbeyond.com",
    category: "employee-advocacy",
    oneLiner: "An employee advocacy platform: your staff share approved company content on their own social networks, with analytics on what it drives.",
    sourceUrl: "https://www.postbeyond.com/pricing",
    verifiedOn: "2026-10-03",
    pricingModel: "Priced by the number of enrolled employees, with a 100-employee minimum on the paid plan.",
    entryPrice: "Free up to 30 employees, then $1,125/month",
    prices: [
      { plan: "Free Trial", price: "$0", note: "Up to 30 enrolled employees, content management, social sharing, Slack and Teams notifications, analytics" },
      { plan: "Growth", price: "$1,125/month", note: "100 enrolled employees minimum, adds single sign-on and a client success team" },
      { plan: "Enterprise", price: "On request", note: "250+ enrolled employees, lower per-user cost, user groups, managed services" },
    ],
    operatedBy: "you",
    sendingDomains: "Your employees' own social accounts. It sends no cold email.",
    leads: "None. Reach comes from the followers your employees already have.",
    replies: "Comments and messages land on each employee's own profile.",
    channels: "Employee posts on LinkedIn and other social networks, plus internal newsletters.",
    costPerMeetingPublished: false,
    freeTier: "Free plan for up to 30 enrolled employees.",
    contract: "Not published on the pricing page.",
    whereTheyWin: [
      "Brand reach through your own people: one approved post goes out on dozens of employee profiles.",
      "Use cases beyond sales, like recruiting, partner marketing and customer advocacy.",
      "Larger companies trust it, with Dynatrace, Fivetran, Gainsight and Scotiabank among the logos on its site.",
    ],
    whereWeWin: [
      "We contact buyers who do not follow you or your staff yet. PostBeyond reaches the networks your team already has.",
      "Free for one user, with no employee minimum. PostBeyond's paid plan starts at $1,125 a month for 100 employees.",
      "Nothing for your team to do. Nobody has to post, share or answer comments.",
    ],
    chooseThemIf: [
      "You have a few hundred employees and want them sharing company content to grow brand awareness and hiring reach.",
      "Your marketing team already produces content and needs a way to spread it through staff profiles.",
    ],
    chooseUsIf: [
      "You need sales meetings with companies that have never heard of you.",
      "Your team is small, so employee sharing would reach too few people to fill a pipeline.",
    ],
    faq: [
      { q: "Is distribute.you a PostBeyond alternative?", a: "Only if what you want is new sales conversations. PostBeyond helps your employees share company posts on social media. distribute.you runs cold email for you: we find companies that match your offer, write to them from our own domains and hand you the interested replies. Some teams use both." },
      { q: "Does distribute.you post on LinkedIn for my employees?", a: "No. We send cold email only, from domains and mailboxes we own. Your team's social accounts stay untouched." },
      { q: "Which one is cheaper for a small team?", a: "PostBeyond is free for up to 30 enrolled employees and its paid plan starts at $1,125 a month for 100 employees. distribute.you is free for one user, and every dollar you choose goes to your campaign." },
    ],
  },
  {
    slug: "leadrebel",
    name: "LeadRebel",
    domain: "leadinfo.com",
    category: "data-platform",
    oneLiner: "A website visitor identification tool. leadrebel.io now forwards to Leadinfo, which shows the companies visiting your site and the decision makers there.",
    sourceUrl: "https://www.leadinfo.com/en/pricing/",
    verifiedOn: "2026-10-03",
    pricingModel: "LeadRebel's own plans are gone; leadrebel.io forwards to Leadinfo, priced per month by the number of companies it identifies on your site.",
    entryPrice: "€69/month (annual), 14-day trial",
    prices: [
      { plan: "Starter (Leadinfo)", price: "€69/month annual, €99/month monthly", note: "Up to 100 identified companies a month, 3 users, decision maker database, lead scoring" },
      { plan: "Scale (Leadinfo)", price: "€159/month", note: "Up to 5,000 identified companies, 10 users, HubSpot and LinkedIn Ads integrations" },
      { plan: "Pro (Leadinfo)", price: "€359/month", note: "Unlimited users and automations, Salesforce integration, mobile numbers, customer success manager" },
    ],
    operatedBy: "you",
    sendingDomains: "Yours. Follow-up email goes out from your own tools and inbox.",
    leads: "Companies that already visit your website, plus contacts from its decision maker database.",
    replies: "Yours to handle, in your inbox or CRM.",
    channels: "Visitor identification, with follow-up through email, LinkedIn and your CRM.",
    costPerMeetingPublished: false,
    freeTier: "14-day trial, no credit card.",
    contract: "Monthly or annual; annual is cheaper on the Starter plan.",
    whereTheyWin: [
      "It shows you which companies are already reading your site, so you can call warm accounts first.",
      "Many CRM integrations, with Salesforce, HubSpot, Pipedrive and Microsoft Dynamics on its site.",
      "A low entry price if your site already gets steady B2B traffic.",
    ],
    whereWeWin: [
      "We do not need your traffic. We find buyers who have never visited your site and write to them.",
      "We do the outreach. Leadinfo hands you a list of visitors; someone on your team still has to write, send and follow up.",
      "Your domain stays out of it. We send from domains we own and warm.",
    ],
    chooseThemIf: [
      "Your website already gets a steady flow of B2B visitors and your sales team has time to follow up on them.",
      "You were a LeadRebel customer and want the same visitor tracking, now under the Leadinfo name.",
    ],
    chooseUsIf: [
      "Your site gets little traffic, so there are too few visitors to identify.",
      "You want someone else to find the buyers, write the emails and answer the replies.",
    ],
    faq: [
      { q: "What happened to LeadRebel?", a: "leadrebel.io now forwards to Leadinfo, which took over the product. Leadinfo does the same core job: it identifies the companies visiting your website and gives you contacts there. Its plans start at €69 a month on annual billing." },
      { q: "Is distribute.you a LeadRebel alternative?", a: "It solves the same problem from the other side. LeadRebel and Leadinfo tell you who already visited your site. distribute.you finds companies that have never heard of you, sends them cold email from our own domains and passes you the interested replies." },
      { q: "Can I use both?", a: "Yes. Visitor tracking catches warm accounts that found you. distribute.you adds new buyers who would not have found your site on their own." },
    ],
  },
  {
    slug: "reply-io",
    name: "Reply.io",
    domain: "reply.io",
    category: "cold-email-tool",
    oneLiner: "A sales engagement platform and cold email outreach software with unlimited mailboxes, warmup, multichannel sequences and an AI SDR called Jason.",
    sourceUrl: "https://reply.io/pricing/",
    verifiedOn: "2026-10-16",
    pricingModel: "Per user per month, email-only or multichannel, with LinkedIn and calls sold per account and an AI SDR plan on top.",
    entryPrice: "$49/user/month (annual)",
    prices: [
      { plan: "Email Volume", price: "From $49/user/month, billed annually", note: "1,000 active contacts a month, unlimited mailboxes and emails, warmup, 50 live data credits a month" },
      { plan: "Multichannel", price: "From $89/user/month, billed annually", note: "Unlimited active contacts, 10 mailboxes, email, LinkedIn, calls and SMS, onboarding with a CSM" },
      { plan: "Jason AI SDR", price: "From $500/month", note: "An AI SDR that searches contacts, personalizes messages and drafts responses around the clock" },
      { plan: "LinkedIn add-on", price: "$69/month per account", note: "Connection requests, messages and InMails, on the Email Volume plan" },
      { plan: "Calls and SMS add-on", price: "$29/month per account", note: "Built-in dialer, automated SMS, call transcripts" },
    ],
    operatedBy: "you",
    sendingDomains: "Yours. You connect your mailboxes; domains and mailboxes are also sold as an add-on.",
    leads: "Their B2B database of 1+ billion contacts on live data credits, or your own upload.",
    replies: "Land in their inbox for you to answer. Jason AI can draft and send responses on its plan.",
    channels: "Email, LinkedIn, calls, SMS, WhatsApp.",
    costPerMeetingPublished: false,
    freeTier: "14-day free trial.",
    contract: "Monthly or annual, up to 17% off annual.",
    whereTheyWin: [
      "Many channels in one sequence: email, LinkedIn, calls and SMS run side by side.",
      "Unlimited mailboxes and emails on the entry plan, so volume grows without a new tier.",
      "Ten years of product and deep CRM syncs with Salesforce, HubSpot and Pipedrive.",
    ],
    whereWeWin: [
      "Nothing to run. You paste a website; we find the buyers, write, send and answer the replies.",
      "Your domain stays out of it. We send from domains and mailboxes we own and warm.",
      "Your dashboard shows what each positive reply cost you, so you see the return in plain numbers.",
    ],
    chooseThemIf: [
      "You have an SDR team that wants email, LinkedIn and calls in one place.",
      "You want to build and tune every sequence yourself.",
    ],
    chooseUsIf: [
      "You want booked meetings without hiring someone to run a tool.",
      "You would rather pay for outreach than for seats.",
    ],
    faq: [
      { q: "How much does Reply.io cost?", a: "Reply.io has an Email Volume plan from $49 per user a month and a Multichannel plan from $89 per user a month, both billed annually. LinkedIn costs $69 a month per account and calls with SMS $29 a month per account. Their Jason AI SDR starts at $500 a month. Annual billing saves up to 17%." },
      { q: "Is distribute.you a Reply.io alternative?", a: "Yes, if what you want is the meetings rather than the software. Reply.io gives your team a platform to run outreach. distribute.you runs your cold email for you: we find the buyers, write, send from our own domains and answer the interested replies." },
      { q: "How does Jason AI compare to distribute.you?", a: "Jason is an AI SDR inside Reply.io that you set up and oversee. distribute.you runs the whole campaign from your website, A/B tests every campaign, and you can follow it on the dashboard or never log in at all." },
    ],
  },
  {
    slug: "saleshandy",
    name: "Saleshandy",
    domain: "saleshandy.com",
    category: "cold-email-tool",
    oneLiner: "An all-in-one cold outreach platform with unlimited email accounts, warmup, multichannel sequences and an 852M+ contact database.",
    sourceUrl: "https://www.saleshandy.com/pricing",
    verifiedOn: "2026-10-16",
    pricingModel: "Monthly subscription by plan tier, sized on active prospects, emails a month and users. Ready-made mailboxes and domains are an add-on.",
    entryPrice: "$34/month (annual)",
    prices: [
      { plan: "Starter", price: "$34/month billed annually ($408/year), $41/month paid monthly", note: "2,000 active prospects, 6,000 emails a month, 1 user, 1,500 lead finder credits a month" },
      { plan: "Pro", price: "$76/month billed annually ($912/year), $99/month paid monthly", note: "30,000 active prospects, 100,000 emails a month, 10 users, 4,000 lead finder credits a month" },
      { plan: "Scale", price: "$149/month billed annually ($1,788/year), $189/month paid monthly", note: "Unlimited active prospects under fair use, 200,000 emails a month, unlimited users, 8,000 lead finder credits a month" },
      { plan: "Enterprise", price: "On request", note: "SSO, white label for agencies, sending limits and credits sized to your volume" },
      { plan: "Email Infrastructure", price: "From $2.99/mailbox/month", note: "Annual fixed plan, $3.49 annual flexi, $3.99 quarterly, plus $14 a year per domain" },
    ],
    operatedBy: "you",
    sendingDomains: "Yours. You connect your mailboxes, or buy look-alike domains and mailboxes from them.",
    leads: "Their 852M+ contact database on lead finder credits, or your own upload.",
    replies: "Land in their unified inbox for you to answer.",
    channels: "Email, calls, LinkedIn, WhatsApp.",
    costPerMeetingPublished: false,
    freeTier: "7-day free trial, no credit card.",
    contract: "Monthly or annual, about 17% to 23% off annual.",
    whereTheyWin: [
      "Unlimited email accounts and warmup on every plan, with no per-inbox fees.",
      "A large contact database with waterfall enrichment, where one credit buys a verified email.",
      "Low entry price for a team that already knows how to run outbound.",
    ],
    whereWeWin: [
      "Nothing to set up. You paste a website; we find the buyers, write, send and answer the replies.",
      "Your domain stays out of it. We send from domains and mailboxes we own and warm.",
      "Your dashboard shows what each positive reply cost you, not a count of emails sent.",
    ],
    chooseThemIf: [
      "You have someone on the team whose job is to build sequences and work the inbox.",
      "You want a contact database and a sender in one tool at a low monthly price.",
    ],
    chooseUsIf: [
      "You want meetings on your calendar without learning a new tool.",
      "You would rather put your budget into outreach than into plan tiers and seats.",
    ],
    faq: [
      { q: "How much does Saleshandy cost?", a: "Saleshandy has three published plans: Starter at $34 a month, Pro at $76 a month and Scale at $149 a month, all billed annually. Paid monthly, the same plans are $41, $99 and $189. Ready-made mailboxes start at $2.99 each a month, plus $14 a year per domain. Enterprise is priced on request." },
      { q: "Is distribute.you a Saleshandy alternative?", a: "Yes, if you want the campaign run for you. Saleshandy is software your team uses to send cold email. distribute.you runs your cold email for you: we find and qualify the buyers, write the emails, send from our own domains and answer the interested replies." },
      { q: "Do I still need to buy mailboxes and domains?", a: "With Saleshandy, yes: you connect your own or buy them as an add-on. With distribute.you, no. We send from domains and mailboxes we own and warm, so your company domain never sends cold email." },
    ],
  },
  {
    slug: "woodpecker",
    name: "Woodpecker",
    domain: "woodpecker.co",
    category: "cold-email-tool",
    oneLiner: "A cold email and LinkedIn outreach tool for businesses that do outbound, with free warmup, email verification and unlimited team members.",
    sourceUrl: "https://woodpecker.co/pricing/",
    verifiedOn: "2026-10-16",
    pricingModel: "Monthly price set by how many prospects you contact each month. LinkedIn, extra warmups, mailboxes and the agency panel are add-ons.",
    entryPrice: "$35/month",
    prices: [
      { plan: "500 contacted prospects", price: "$35/month ($280 billed yearly)", note: "8,000 emails a month, 2 warmups, unlimited email accounts, team members and email verification" },
      { plan: "2,000 contacted prospects", price: "$67/month ($536 billed yearly)", note: "32,000 emails a month, 6 warmups" },
      { plan: "4,000 contacted prospects", price: "$99/month ($792 billed yearly)", note: "64,000 emails a month, 10 warmups" },
      { plan: "10,000 contacted prospects", price: "$188/month ($1,504 billed yearly)", note: "160,000 emails a month, 20 warmups" },
      { plan: "LinkedIn outreach", price: "$29/month per LinkedIn account", note: "Invites, messages and profile visits inside the same campaigns, cloud-based" },
      { plan: "Agency panel", price: "$27/month per active client", note: "A sub-account per client, roles, view-only client access" },
    ],
    operatedBy: "you",
    sendingDomains: "Yours. You connect your mailboxes, or buy pre-configured addresses from $4 to $6 a month each.",
    leads: "Their Lead Finder database on credits, or your own upload.",
    replies: "Land in their centralized inbox for you to answer.",
    channels: "Email and LinkedIn.",
    costPerMeetingPublished: false,
    freeTier: "14-day free trial, no credit card.",
    contract: "Monthly or annual, 33% off annual.",
    whereTheyWin: [
      "Clear pricing: you pay by prospects contacted, with team members and email accounts free.",
      "Free email verification and warmup built in, which keeps lists clean and inboxes healthy.",
      "A strong agency panel for teams running outbound for many clients.",
    ],
    whereWeWin: [
      "Nothing to run. You paste a website; we find the buyers, write, send and answer the replies.",
      "Your domain stays out of it. We send from domains and mailboxes we own and warm.",
      "Your dashboard shows what each positive reply cost you, so you see the return in plain numbers.",
    ],
    chooseThemIf: [
      "You have a person or a team who will write the campaigns and work the inbox every day.",
      "You run outbound for several clients and want one panel for all of them.",
    ],
    chooseUsIf: [
      "You want meetings booked without staffing outbound.",
      "You want every campaign A/B tested for you, with the results on your dashboard.",
    ],
    faq: [
      { q: "How much does Woodpecker cost?", a: "Woodpecker prices by contacted prospects a month. Contacting 500 prospects costs $35 a month, 2,000 costs $67, 4,000 costs $99 and 10,000 costs $188. Annual billing saves 33%. LinkedIn outreach is $29 a month per account and the agency panel is $27 a month per active client." },
      { q: "Is distribute.you a Woodpecker alternative?", a: "Yes, if you want the outreach done for you. Woodpecker is a tool your team uses to send cold email and LinkedIn messages. distribute.you runs your cold email for you: we find the buyers, write, send from our own domains and answer the interested replies." },
      { q: "Who writes the emails?", a: "In Woodpecker, you or your team write each campaign. With distribute.you, we write them from your website and A/B test every campaign, and you can review it all on the dashboard or never log in." },
    ],
  },
  {
    slug: "mailshake",
    name: "Mailshake",
    domain: "mailshake.com",
    category: "cold-email-tool",
    oneLiner: "An AI powered sales engagement and B2B lead platform: email automation that lands in inboxes, gets replies and books meetings, with a dialer and a data finder built in.",
    sourceUrl: "https://mailshake.com/pricing/",
    verifiedOn: "2026-10-16",
    pricingModel: "Monthly or yearly subscription, billed by the number of users you buy. Data Finder and ready-to-use mailboxes are paid add-ons.",
    entryPrice: "$29/month",
    prices: [
      { plan: "Starter", price: "$29/month ($25 billed yearly)", note: "1 email address, 1,500 sends a month, unlimited contacts and warmup, 50 data finder credits" },
      { plan: "Email Outreach", price: "$49/month ($45 billed yearly)", note: "2 email addresses, unlimited sends, email rotation, unified inbox, CRM integrations" },
      { plan: "Sales Engagement", price: "$99/month ($85 billed yearly)", note: "10 email addresses, 5 phone numbers and a power dialer, 2,500 data finder credits" },
      { plan: "Agency Plan", price: "On request", note: "All of Sales Engagement with unlimited email addresses, through their sales team" },
      { plan: "Data Finder", price: "$19/month ($17 billed yearly)", note: "Add-on to find decision makers' contact details by role, location or company" },
      { plan: "Ready to Use Mailboxes", price: "$12/month ($11 billed yearly)", note: "Add-on that creates sending addresses for you and switches if one runs into trouble" },
    ],
    operatedBy: "you",
    sendingDomains: "Yours. You connect Gmail, Office 365 or any SMTP mailbox; ready-made mailboxes are an add-on.",
    leads: "Your upload, plus Data Finder credits.",
    replies: "Land in Lead Catcher and the unified inbox for you to answer.",
    channels: "Email, plus a phone dialer on Sales Engagement.",
    costPerMeetingPublished: false,
    freeTier: "None. Payment is collected up front, with onboarding and training included.",
    contract: "Monthly or yearly, cheaper yearly. Cancel before renewal.",
    whereTheyWin: [
      "A gentle start. Starter is $29 a month and their AI writer drafts a sequence in under a minute.",
      "Email and calls in one place. Sales Engagement adds a power dialer with free minutes to North American numbers.",
      "Years of teaching. Their cold email masterclass, live training and onboarding help a new team learn outbound.",
    ],
    whereWeWin: [
      "We run the whole campaign. You paste a website; we find the buyers, write, send and read every reply.",
      "Your domain stays out of cold email. We send from domains and mailboxes we own and warm.",
      "Every campaign is A/B tested, and your dashboard shows what each positive reply cost you.",
    ],
    chooseThemIf: [
      "You have reps who want to write their own sequences and call the warm leads themselves.",
      "You want email and a dialer on one seat for your sales team.",
    ],
    chooseUsIf: [
      "You want booked meetings without hiring someone to run outbound.",
      "You would rather choose an outreach budget than size a plan per user.",
    ],
    faq: [
      { q: "How much does Mailshake cost?", a: "Mailshake has three self-serve plans: Starter at $29 a month, Email Outreach at $49 and Sales Engagement at $99. Yearly billing brings them to $25, $45 and $85. The Agency Plan is priced through their sales team. Data Finder is $19 a month and ready-to-use mailboxes are $12 a month on top." },
      { q: "Is distribute.you a Mailshake alternative?", a: "Yes, for the same goal: replies from new buyers. Mailshake gives your team the software to send. distribute.you runs your cold email for you, from finding the buyers to answering the interested replies." },
      { q: "Do I need my own mailboxes?", a: "With Mailshake, yes: you connect your own accounts or buy their mailbox add-on. With distribute.you, no. We send from domains and mailboxes we own and warm, so your own domain never sends cold email." },
    ],
  },
  {
    slug: "zoominfo",
    name: "ZoomInfo",
    domain: "zoominfo.com",
    category: "data-platform",
    oneLiner: "The AI platform for go-to-market teams, built on a large B2B contact and company database with buyer intent signals.",
    sourceUrl: "https://www.zoominfo.com/pricing",
    verifiedOn: "2026-10-16",
    pricingModel: "Prices are not published. Packages are quoted by their sales team from features, number of licenses and credit usage, with one credit per exported profile.",
    entryPrice: "On request",
    prices: [
      { plan: "Pricing", price: "On request", note: "Professional, Copilot Advanced and Copilot Enterprise sales plans, quoted by their sales team. Each package includes a set number of monthly credits; one export uses one credit." },
    ],
    operatedBy: "you",
    sendingDomains: "Yours. Outreach goes out from your own mailboxes and sales tools.",
    leads: "Their B2B contact and company database, with intent signals, website visitors and job changes.",
    replies: "Yours to handle, in your inbox, CRM or sales tools.",
    channels: "Contact data, with phone and email outreach tools and ad audiences.",
    costPerMeetingPublished: false,
    freeTier: "Free trial.",
    contract: "Package and payment frequency set with their sales team.",
    whereTheyWin: [
      "Depth of data. Direct dials, mobile numbers, org charts and company insights in one place.",
      "Buyer intent signals that show which accounts are researching a topic right now.",
      "A full suite for large sales, marketing and RevOps teams, with many CRM integrations.",
    ],
    whereWeWin: [
      "We find the buyers and then do the outreach. You paste a website; we write, send and answer the replies.",
      "Your domain stays out of it. We send from domains and mailboxes we own and warm.",
      "Every campaign is A/B tested, and your dashboard shows the price of each positive reply.",
    ],
    chooseThemIf: [
      "You run a large sales team that needs phone numbers, intent data and CRM enrichment every day.",
      "Your reps already have the time and tools to write, send and follow up themselves.",
    ],
    chooseUsIf: [
      "You want booked meetings rather than a database to work through.",
      "You would rather start today for free than wait for a sales quote.",
    ],
    faq: [
      { q: "How much does ZoomInfo cost?", a: "ZoomInfo does not publish prices. Its pricing page says packages depend on features, the number of licenses and credit usage, and its sales team quotes each one. Every export of a contact or company profile uses one credit." },
      { q: "Is distribute.you a ZoomInfo alternative?", a: "Yes, if what you want from ZoomInfo is new sales meetings. ZoomInfo gives your team contacts to reach. distribute.you finds the buyers, writes and sends the cold email from our own domains, and answers the interested replies until the meeting is booked." },
      { q: "Do I need a contact database if I use distribute.you?", a: "No. We find and qualify the buyers from your website, so the list comes with the campaign. If you already own a list, you can add it as an extra audience." },
    ],
  },
  {
    slug: "seamless-ai",
    name: "Seamless.AI",
    domain: "seamless.ai",
    category: "data-platform",
    oneLiner: "An AI sales prospecting platform with verified business emails and phone numbers, plus outreach tools and AI agents for sales teams.",
    sourceUrl: "https://seamless.ai/",
    verifiedOn: "2026-10-16",
    pricingModel: "Free for up to 50 credits. Paid plans are not published; their pricing page leads to a sales inquiry form.",
    entryPrice: "Free up to 50 credits, then on request",
    prices: [
      { plan: "Pricing", price: "On request", note: "Free for up to 50 credits. Plans with unlimited users, bulk credits, buyer intent and enrichment are quoted by their sales team." },
    ],
    operatedBy: "you",
    sendingDomains: "Yours. Emails and calls go out from your own accounts.",
    leads: "Their real-time search engine of verified business emails and phone numbers.",
    replies: "Yours to handle, in your inbox or CRM.",
    channels: "Contact data, with email, calling and social selling tools.",
    costPerMeetingPublished: false,
    freeTier: "Free for up to 50 credits.",
    contract: "Set with their sales team.",
    whereTheyWin: [
      "A big pool of contacts, with emails and direct phone numbers in the same search.",
      "Credit back protection. An invalid email gets its credit refunded automatically.",
      "Easy to try. The first 50 credits are free.",
    ],
    whereWeWin: [
      "We find the buyers and then do the outreach. You paste a website; we write, send and answer the replies.",
      "Your domain stays out of it. We send from domains and mailboxes we own and warm.",
      "Every campaign is A/B tested, and your dashboard shows the price of each positive reply.",
    ],
    chooseThemIf: [
      "Your reps call and email prospects every day and need fresh phone numbers.",
      "You want a contact search tool your whole sales team can share.",
    ],
    chooseUsIf: [
      "You want booked meetings rather than a list of contacts to work through.",
      "Nobody on your team has time to write, send and follow up cold email.",
    ],
    faq: [
      { q: "How much does Seamless.AI cost?", a: "Seamless.AI is free for up to 50 credits. Paid plans are not published. Its pricing page leads to a form, and its sales team quotes a plan for your team." },
      { q: "Is distribute.you a Seamless.AI alternative?", a: "Yes, if what you want from Seamless.AI is new sales meetings. Seamless.AI gives your team contacts to reach. distribute.you finds the buyers, writes and sends the cold email from our own domains, and answers the interested replies until the meeting is booked." },
      { q: "Do I have to build a lead list for distribute.you?", a: "No. You paste your website and we find and qualify the buyers. If you already own a list, you can add it as an extra audience." },
    ],
  },
  {
    slug: "hunter",
    name: "Hunter",
    domain: "hunter.io",
    category: "data-platform",
    oneLiner: "An all-in-one email outreach platform to find verified decision makers, verify their emails and send cold email sequences.",
    sourceUrl: "https://hunter.io/pricing",
    verifiedOn: "2026-10-16",
    pricingModel: "Monthly or yearly subscription by credits, with unlimited users on every plan. Yearly billing is 30% off.",
    entryPrice: "Free, then €49/month",
    prices: [
      { plan: "Free", price: "€0", note: "50 credits a month, 1 connected email account, 500 recipients per sequence" },
      { plan: "Starter", price: "€49/month, or €34/month billed yearly", note: "2,000 credits a month, 3 connected email accounts, AI Writing Assistant" },
      { plan: "Growth", price: "€149/month, or €104/month billed yearly", note: "10,000 credits a month, 10 connected email accounts" },
      { plan: "Scale", price: "€299/month, or €209/month billed yearly", note: "25,000 credits a month, 20 connected email accounts, account manager" },
    ],
    operatedBy: "you",
    sendingDomains: "Yours. You connect your email accounts; managed email accounts are an add-on.",
    leads: "Their B2B database, Domain Search and Email Finder, on credits.",
    replies: "Land in the email accounts you connected, for you to answer.",
    channels: "Email.",
    costPerMeetingPublished: false,
    freeTier: "Free plan, 50 credits a month.",
    contract: "Monthly or yearly. Cancel any time from the dashboard.",
    whereTheyWin: [
      "Email finding and verification that millions of people rely on, in the app, the API or the browser extension.",
      "A real free plan and clear public prices.",
      "Unlimited team members on every plan.",
    ],
    whereWeWin: [
      "We find the buyers and then do the outreach. You paste a website; we write, send and answer the replies.",
      "Your domain stays out of it. We send from domains and mailboxes we own and warm.",
      "Every campaign is A/B tested, and your dashboard shows the price of each positive reply.",
    ],
    chooseThemIf: [
      "You need to find or verify a specific person's email address.",
      "You enjoy writing your own sequences and sending them from your own inbox.",
    ],
    chooseUsIf: [
      "You want booked meetings rather than email addresses.",
      "You would rather someone else write the emails and answer the replies.",
    ],
    faq: [
      { q: "How much does Hunter cost?", a: "Hunter has a free plan with 50 credits a month. Starter is €49 a month, Growth €149 and Scale €299, or €34, €104 and €209 a month billed yearly. Enterprise is priced by their sales team." },
      { q: "Is distribute.you a Hunter alternative?", a: "Yes, if what you want from Hunter is new sales meetings. Hunter helps you find emails and send sequences yourself. distribute.you finds the buyers, writes and sends the cold email from our own domains, and answers the interested replies until the meeting is booked." },
      { q: "Can I use Hunter and distribute.you together?", a: "Yes. Some teams keep Hunter to look up a specific contact and let distribute.you run the cold email campaign from our own domains." },
    ],
  },
  {
    slug: "snov-io",
    name: "Snov.io",
    domain: "snov.io",
    category: "data-platform",
    oneLiner: "An all-in-one AI lead generation platform: a B2B lead database, email finder and verifier, warmup, and cold email plus LinkedIn outreach in one place.",
    sourceUrl: "https://snov.io/pricing",
    verifiedOn: "2026-10-16",
    pricingModel: "Monthly subscription by credits and recipients, with unlimited team seats. Annual billing takes 25% off, and LinkedIn automation slots are paid on top.",
    entryPrice: "Free Trial plan, then $39/month",
    prices: [
      { plan: "Trial", price: "$0/month", note: "50 credits, 100 recipients, 25 enrichment tokens and 1 email warm-up slot, renewed every month" },
      { plan: "Starter", price: "$39/month", note: "1,000 credits, 5,000 recipients, 75 enrichment tokens, 3 email warm-ups, unlimited team seats" },
      { plan: "Pro S", price: "$99/month", note: "5,000 credits, 25,000 recipients, 150 enrichment tokens, unlimited warm-ups" },
      { plan: "Pro M", price: "$189/month", note: "20,000 credits, 50,000 recipients a month" },
      { plan: "Pro L", price: "$369/month", note: "50,000 credits, 100,000 recipients a month" },
      { plan: "Ultra", price: "$738/month", note: "100,000 credits, 200,000 recipients a month" },
      { plan: "LinkedIn Automation", price: "$69/month per slot ($62 billed yearly)", note: "One connected LinkedIn account per slot, $10 off each slot with a Sales Suite plan" },
    ],
    operatedBy: "you",
    sendingDomains: "Yours. You connect your own mailboxes and warm them with the Snov.io warm-up.",
    leads: "The Snov.io B2B database and email finder, on credits, or your own upload.",
    replies: "Land in the Snov.io Unibox for you to answer, with reply sentiment analysis.",
    channels: "Email and LinkedIn, plus a built-in sales CRM.",
    costPerMeetingPublished: false,
    freeTier: "A free Trial plan that renews every month, with 50 credits and 100 recipients.",
    contract: "Monthly, 3-month at 5% off, or annual at 25% off. Upgrade or downgrade anytime.",
    whereTheyWin: [
      "Everything in one tool: lead search, email finding, verification, warmup, sequences and a CRM.",
      "Unlimited team seats on every paid plan, so the whole sales team can work in one account.",
      "Email and LinkedIn steps in the same multichannel campaign.",
    ],
    whereWeWin: [
      "We run the campaign. You paste a website; we find the buyers, write, send and read the replies.",
      "Your domain stays out of it. We send from domains and mailboxes we own and warm.",
      "We answer the interested replies until the meeting is booked, then hand the conversation to you.",
    ],
    chooseThemIf: [
      "You have someone on the team who wants to build lists and run sequences every day.",
      "You want one affordable toolbox for finding, verifying and emailing leads.",
    ],
    chooseUsIf: [
      "You want booked meetings, not another tool to learn.",
      "You would rather keep your own domain away from cold email.",
    ],
    faq: [
      { q: "How much does Snov.io cost?", a: "Snov.io has a free Trial plan with 50 credits and 100 recipients a month. Paid plans start with Starter at $39 a month, then Pro S at $99, Pro M at $189, Pro L at $369 and Ultra at $738. Annual billing takes 25% off. LinkedIn automation is extra, at $69 per slot a month." },
      { q: "Is distribute.you a Snov.io alternative?", a: "Yes, for teams that want the result rather than the toolbox. Snov.io gives you the database and the sending engine to run outreach yourself. distribute.you runs your cold email for you, from our own domains, and passes you the interested replies." },
      { q: "Do I need my own lead list with distribute.you?", a: "No. We find and qualify the buyers from your website. You can still add your own list as an extra audience if you have one." },
    ],
  },
  {
    slug: "rb2b",
    name: "RB2B",
    domain: "rb2b.com",
    category: "data-platform",
    oneLiner: "Website visitor identification software that names the people and companies visiting your site and sends their LinkedIn profiles and business emails to Slack or your CRM.",
    sourceUrl: "https://www.rb2b.com/pricing",
    verifiedOn: "2026-10-16",
    pricingModel: "A free plan, then monthly plans sized by the number of visitors RB2B identifies, with overage billed per extra resolution.",
    entryPrice: "Free plan, paid from $79/month",
    prices: [
      { plan: "Free", price: "$0/month", note: "Company-level ID pushed to Slack, 150 monthly resolutions, no person-level ID or emails" },
      { plan: "Starter", price: "$79/month", note: "Person-level ID, LinkedIn URLs to Slack or Teams, 300 monthly resolutions, overage at 45¢ per resolution" },
      { plan: "Pro", price: "From $149/month", note: "Business email addresses and all integrations, from 600 monthly resolutions, overage at 25¢ per resolution" },
      { plan: "Pro+", price: "From $199/month", note: "Premium Resolution with 35-45% coverage, from 600 monthly resolutions; above 12,500 a month is priced with their team" },
      { plan: "Additional domains", price: "$99/month (up to 5)", note: "On Pro and Pro+" },
    ],
    operatedBy: "you",
    sendingDomains: "Yours. Follow-up goes out from your own inbox and outreach tools.",
    leads: "People and companies already visiting your website. Person-level ID is US only.",
    replies: "Yours to handle, in your inbox or CRM.",
    channels: "Visitor identification, with alerts in Slack or Teams and sync to your CRM.",
    costPerMeetingPublished: false,
    freeTier: "A free plan forever, plus a 7-day full-featured trial with no credit card.",
    contract: "Monthly plans. Stay on the free plan or upgrade anytime.",
    whereTheyWin: [
      "RB2B shows the actual people reading your site, with their LinkedIn profiles, so your reps can reach warm visitors first.",
      "Setup takes minutes: one script on your site and visitors start landing in Slack.",
      "A generous free plan and many integrations, from HubSpot and Salesforce to Clay and Apollo.",
    ],
    whereWeWin: [
      "We do not need your traffic. We find buyers who have never visited your site and write to them.",
      "We do the outreach. RB2B hands you names; distribute.you writes, sends, follows up and answers the interested replies.",
      "Your domain stays out of it. We send from domains and mailboxes we own and warm.",
    ],
    chooseThemIf: [
      "Your site already gets steady US B2B traffic and your reps have time to follow up on every visitor.",
      "You want a warm signal in Slack the moment a target account reads your pricing page.",
    ],
    chooseUsIf: [
      "Your site gets too few visitors to fill a pipeline.",
      "You want someone else to find the buyers, write the emails and answer the replies.",
    ],
    faq: [
      { q: "How much does RB2B cost?", a: "RB2B has a free plan with 150 company-level resolutions a month. Starter is $79 a month for 300 person-level resolutions. Pro starts at $149 a month with business emails and all integrations, and Pro+ starts at $199 a month with higher match rates. Extra resolutions are 45¢ each on Starter and 25¢ on Pro and Pro+." },
      { q: "Is distribute.you an RB2B alternative?", a: "distribute.you solves the same problem from the other side. RB2B tells you who already visited your site. distribute.you finds companies that have never heard of you, sends them cold email from our own domains and passes you the interested replies." },
      { q: "Do I need website traffic for distribute.you to work?", a: "No. We start from your website to understand what you sell, then find the buyers ourselves. A new site with almost no visitors works just as well. Many teams use visitor tracking for warm accounts and distribute.you for new ones." },
    ],
  },
  {
    slug: "warmly",
    name: "Warmly",
    domain: "warmly.ai",
    category: "data-platform",
    oneLiner: "Autonomous revenue agents for B2B teams: Warmly identifies website visitors at the person level, engages them across chat, email and ads, and nurtures them until they are ready to buy.",
    sourceUrl: "https://www.warmly.ai/p/pricing",
    verifiedOn: "2026-10-16",
    pricingModel: "Annual or quarterly plans per product, sold through their sales team, each from 10K credits a month. Annual billing saves 30%.",
    entryPrice: "From $10,000/year or $4,875/quarter",
    prices: [
      { plan: "AI Web-Deanonymization", price: "From $10,000/year, or $4,875/quarter", note: "Website visitors (contacts and companies), ICP filtering, Slack alerts, lead routing, CRM sync, retargeting, from 10K credits a month" },
      { plan: "Inbound Chat", price: "From $20,000/year, or $6,500/quarter", note: "Adds an AI chatbot with 1 AI Studio Agent, live chat, Warm Offers and automated email follow-up" },
      { plan: "AI Inbound Autopilot", price: "From $30,000/year, or $9,750/quarter", note: "Adds unlimited AI Studio Agents, an Autopilot Agent, AI qualification and auto email follow-up" },
      { plan: "GTM Signals Package", price: "$10,000/year", note: "Add-on: intent data, hiring activity, funding events and competitive intelligence" },
      { plan: "Warm Experiences", price: "$10,000/year", note: "Add-on: personalized website content based on visitor identity and intent" },
    ],
    operatedBy: "their AI agent",
    sendingDomains: "Yours. Email follow-up runs through your own inboxes and sales engagement tools.",
    leads: "People and companies visiting your website, plus their database of 220M+ people profiles and intent signals.",
    replies: "Routed to your reps, with AI chat handling conversations on your site.",
    channels: "Visitor identification, website chat, email, and LinkedIn and Meta ads.",
    costPerMeetingPublished: false,
    freeTier: "None listed. Plans start with a demo.",
    contract: "Quarterly to try, or annual to save 30%.",
    whereTheyWin: [
      "Warmly names visitors at the person level and greets them on your site with AI chat while they are still reading.",
      "A deep signal layer: website visits, social activity, Bombora research intent, job changes and funding events.",
      "One platform for inbound and outbound, with retargeting across email, LinkedIn and Meta ads.",
    ],
    whereWeWin: [
      "We do not need your traffic. We find buyers who have never visited your site and write to them.",
      "We run the cold email from domains and mailboxes we own and warm, so your domain never sends it.",
      "You start in minutes: paste a website, choose your outreach budget, and the campaign starts sending.",
    ],
    chooseThemIf: [
      "Your site already draws strong B2B traffic and you want AI to convert more of those visitors.",
      "You have a RevOps team ready to wire signals, chat and ads into one GTM system.",
    ],
    chooseUsIf: [
      "You need new buyers who have not found your site yet.",
      "You want cold email run for you, with every campaign A/B tested and every interested reply answered.",
    ],
    faq: [
      { q: "How much does Warmly cost?", a: "Warmly sells three products through its sales team. AI Web-Deanonymization starts at $10,000 a year, Inbound Chat at $20,000 a year and AI Inbound Autopilot at $30,000 a year. Quarterly billing is $4,875, $6,500 and $9,750 a quarter. Add-ons such as the GTM Signals Package are $10,000 a year." },
      { q: "Is distribute.you a Warmly alternative?", a: "distribute.you solves a different part of the same problem. Warmly converts the people who already visit your site. distribute.you finds companies that have never heard of you, sends them cold email from our own domains and passes you the interested replies." },
      { q: "Can I use Warmly and distribute.you together?", a: "Yes. Warmly works the warm visitors who found you. distribute.you brings in new buyers who would not have found your site on their own, and some of them may visit your site after reading our email." },
    ],
  },
  {
    slug: "salesloft",
    name: "Salesloft",
    domain: "salesloft.com",
    category: "sales-engagement",
    oneLiner: "An AI revenue platform for sales teams that turns buyer signals into actions, with cadences, conversation intelligence, deals and forecasting in one place.",
    sourceUrl: "https://www.salesloft.com/see-it-live",
    verifiedOn: "2026-10-16",
    pricingModel: "Not published. salesloft.com/pricing forwards to a Talk to Sales page, and a quote comes after a call with their sales team.",
    entryPrice: "On request",
    prices: [
      { plan: "Pricing", price: "On request", note: "No price on the site; the pricing page forwards to Talk to Sales" },
    ],
    operatedBy: "you",
    sendingDomains: "Yours. Your reps send from their own mailboxes through the platform.",
    leads: "Your CRM and your own lists, worked by your reps.",
    replies: "Land with your reps, who answer them from Salesloft.",
    channels: "Email, phone and tasks in cadences, plus call recording and forecasting.",
    costPerMeetingPublished: false,
    freeTier: "None. A self-guided tour and a demo.",
    contract: "Through their sales team.",
    whereTheyWin: [
      "A complete workspace for an SDR and AE team: cadences, dialer, call insights, deals and forecasts.",
      "Built for scale. Salesloft says over 4,000 sales teams use it, and its Clari Forecast product sits on the same platform.",
      "Deep CRM sync and strong coaching tools for sales managers.",
    ],
    whereWeWin: [
      "Your team does not have to run anything. We find the buyers, write, send and answer the interested replies.",
      "Your domain stays out of it. We send from domains and mailboxes we own and warm.",
      "You can see our prices today. One user is free, and every action is at the API price with 0% markup.",
    ],
    chooseThemIf: [
      "You have a team of SDRs and AEs and want one platform to run their daily work.",
      "Forecasting and call coaching matter as much to you as outbound email.",
    ],
    chooseUsIf: [
      "You do not have an SDR team yet and want new conversations with buyers this month.",
      "You want to know the price before any sales call.",
    ],
    faq: [
      { q: "How much does Salesloft cost?", a: "Salesloft does not publish its prices. The pricing page forwards to a Talk to Sales form, and a quote follows a call. distribute.you publishes its prices: one user is free, and every action is billed at the vendor's API price with 0% markup." },
      { q: "Is distribute.you a Salesloft alternative?", a: "For outbound, yes, from a different angle. Salesloft gives your reps the software to run cadences. distribute.you runs the cold email for you, from our own domains, and passes you the interested replies." },
      { q: "Do I need an SDR team to use distribute.you?", a: "No. You paste your website and we run the campaign. If you already have reps on Salesloft, we can add new conversations for them to take over." },
    ],
  },
  {
    slug: "outreach",
    name: "Outreach",
    domain: "outreach.ai",
    category: "sales-engagement",
    oneLiner: "An agentic AI platform for revenue teams, covering prospecting, sequences, deals, coaching and forecasting in one place.",
    sourceUrl: "https://www.outreach.ai/pricing",
    verifiedOn: "2026-10-16",
    pricingModel: "Not published. Outreach combines a price per seat with AI credits used per action, and quotes each team after a call.",
    entryPrice: "On request",
    prices: [
      { plan: "Pricing", price: "On request", note: "Seats plus AI credits; every package says Request pricing. Amplify Essentials includes 10,000 AI credits, Core 25,000, Plus 50,000 and Pro 100,000" },
    ],
    operatedBy: "you",
    sendingDomains: "Yours. Your reps send from their own mailboxes through the platform.",
    leads: "Your CRM and your own lists, with their Research Agent and data enrichment.",
    replies: "Land with your reps, who answer them from Outreach.",
    channels: "Email, phone and tasks in sequences, plus meetings, coaching and forecasting.",
    costPerMeetingPublished: false,
    freeTier: "None. A demo.",
    contract: "Custom, through their sales team. Extra AI credit packs can be bought anytime.",
    whereTheyWin: [
      "One platform from first touch to forecast, with AI agents for research, personalization, deals and coaching.",
      "Clear packages for each stage of a sales team, from Amplify Essentials to Amplify Pro.",
      "Enterprise depth: managed services, API access and custom objects for RevOps.",
    ],
    whereWeWin: [
      "We run the outbound for you. Outreach equips your reps; distribute.you finds the buyers, writes, sends and answers the interested replies.",
      "Your domain stays out of it. We send from domains and mailboxes we own and warm.",
      "You can see our prices today. One user is free, and every action is at the API price with 0% markup.",
    ],
    chooseThemIf: [
      "You run a sales team of SDRs and AEs and want one platform for sequences, deals and forecasts.",
      "Your RevOps team wants API access and custom objects across the revenue cycle.",
    ],
    chooseUsIf: [
      "You want new conversations with buyers without hiring and equipping a team first.",
      "You want to start with a website, without a demo or a seat count.",
    ],
    faq: [
      { q: "How much does Outreach cost?", a: "Outreach does not publish its prices. Every package says Request pricing. Pricing combines a fee per seat with AI credits: Amplify Essentials includes 10,000 credits, Core 25,000, Plus 50,000 and Pro 100,000. distribute.you publishes its prices: one user is free, and every action is billed at the vendor's API price with 0% markup." },
      { q: "Is distribute.you an Outreach alternative?", a: "For outbound, yes, from a different angle. Outreach gives your reps the software to run sequences. distribute.you runs the cold email for you, from our own domains, and passes you the interested replies." },
      { q: "Can I keep Outreach and add distribute.you?", a: "Yes. Your reps keep working their accounts in Outreach. distribute.you starts new conversations with buyers who have not heard of you yet, and hands the interested ones to your team." },
    ],
  },
  {
    slug: "heyreach",
    name: "HeyReach",
    domain: "heyreach.io",
    category: "linkedin-outreach",
    oneLiner: "A LinkedIn automation tool for agencies, sales teams and GTM operators, with unlimited senders for one fixed monthly fee.",
    sourceUrl: "https://www.heyreach.io/pricing",
    verifiedOn: "2026-10-16",
    pricingModel: "Monthly subscription per LinkedIn sender, or a flat fee for a bundle of senders. Teammates and clients are free to add. A done-for-you service is priced on request.",
    entryPrice: "$79/month per sender",
    prices: [
      { plan: "Growth", price: "$79/month per sender ($71 quarterly, $63 yearly)", note: "Unlimited campaigns, all LinkedIn actions, unified inbox, a dedicated proxy per sender, 100 enrichment credits per sender" },
      { plan: "Agency", price: "$999/month ($899 quarterly, $799 yearly)", note: "25 senders, whitelabel included, done-for-you onboarding, a dedicated Slack channel; bring your own proxies" },
      { plan: "Unlimited", price: "$2,999/month ($2,699 quarterly, $2,399 yearly)", note: "Unlimited senders under a 300 sender fair use cap, 3,000 enrichment credits, priority support" },
      { plan: "Multi-brand whitelabel", price: "$500 per add-on", note: "Extra client brandings on the Unlimited plan" },
      { plan: "Done for you", price: "On request", note: "Their team runs ICP research, campaign setup, LinkedIn and email outreach and the inbox" },
    ],
    operatedBy: "you",
    sendingDomains: "Your LinkedIn accounts. Email goes through your own Instantly or Smartlead setup.",
    leads: "Your lists, imported or pushed in from tools like Clay, plus enrichment credits to find emails.",
    replies: "Land in their unified LinkedIn inbox for you to answer.",
    channels: "LinkedIn, with email through native Instantly and Smartlead integrations.",
    costPerMeetingPublished: false,
    freeTier: "14-day trial on Growth with 3 LinkedIn accounts, no card. 30-day trial on request for the bigger plans.",
    contract: "Monthly, quarterly (10% off) or yearly (20% off).",
    whereTheyWin: [
      "LinkedIn at scale. One login runs dozens of LinkedIn senders, each kept inside safe daily limits.",
      "Built for agencies. Whitelabel, client workspaces and free seats for teammates and clients.",
      "A strong builder stack. API, webhooks, an MCP server and Clay templates for teams that automate everything.",
    ],
    whereWeWin: [
      "Same goal, another channel. HeyReach starts sales conversations on LinkedIn; distribute.you starts them by cold email.",
      "Your accounts stay out of it. We send from domains and mailboxes we own and warm, so your LinkedIn profile and your domain are untouched.",
      "We run the campaign. You paste a website; we find the buyers, write, send, A/B test and answer the interested replies.",
    ],
    chooseThemIf: [
      "Your buyers live on LinkedIn and you have people ready to run many sender accounts.",
      "You run an agency and want whitelabel LinkedIn outreach for your clients.",
    ],
    chooseUsIf: [
      "You want new sales conversations by email, run for you from start to booked meeting.",
      "You would rather keep your team's LinkedIn profiles for their own posts and network.",
    ],
    faq: [
      { q: "How much does HeyReach cost?", a: "HeyReach Growth is $79 a month per LinkedIn sender, or $63 on yearly billing. Agency is $999 a month for 25 senders, and Unlimited is $2,999 a month. Quarterly billing takes 10% off and yearly takes 20% off. Their done-for-you service is priced on request." },
      { q: "Is distribute.you a HeyReach alternative?", a: "Yes, for the same job: new sales conversations with buyers who do not know you yet. HeyReach does it on LinkedIn from your accounts. distribute.you does it by cold email, from domains we own, and runs the campaign for you." },
      { q: "Does distribute.you send LinkedIn messages?", a: "No. distribute.you runs cold email only. Some teams keep LinkedIn for warm contacts and let us open new conversations by email." },
    ],
  },
  {
    slug: "waalaxy",
    name: "Waalaxy",
    domain: "waalaxy.com",
    category: "linkedin-outreach",
    oneLiner: "A LinkedIn outreach tool that makes LinkedIn your first acquisition channel, with automated follow-ups and email sequences, and no complex setup.",
    sourceUrl: "https://www.waalaxy.com/pricing",
    verifiedOn: "2026-10-16",
    pricingModel: "Subscription per user, billed monthly, quarterly or yearly. The LinkedIn Inbox is a paid add-on.",
    entryPrice: "€19/user/month (yearly)",
    prices: [
      { plan: "Pro", price: "€39/user/month (€31 quarterly, €19 yearly)", note: "300 LinkedIn invites a month, unlimited campaigns, automated follow-ups, CRM sync, 25 email finder credits a month" },
      { plan: "Advanced", price: "€99/user/month (€79 quarterly, €49 yearly)", note: "800 invites a month, API access, Make, Zapier and N8N modules, live chat support" },
      { plan: "Business", price: "€139/user/month (€109 quarterly, €69 yearly)", note: "800 invites a month, cold email sequences, LinkedIn plus email campaigns, 500 email finder credits a month" },
      { plan: "LinkedIn Inbox", price: "€20/month", note: "Add-on to handle LinkedIn conversations in one place; 500 free conversations to try it" },
    ],
    operatedBy: "you",
    sendingDomains: "Your own LinkedIn account, plus your own mailboxes for email on Business.",
    leads: "Imported from LinkedIn, Sales Navigator, Recruiter Lite or a CSV, plus email finder credits.",
    replies: "Reply detection stops the sequence; you answer on LinkedIn or in their Inbox add-on.",
    channels: "LinkedIn, plus cold email on the Business plan.",
    costPerMeetingPublished: false,
    freeTier: "14-day free trial.",
    contract: "Monthly, quarterly (20% off) or yearly (50% off). Cancel anytime by turning off auto-renewal.",
    whereTheyWin: [
      "Easy to start. Waalaxy says 75% of its users had never done LinkedIn outreach before.",
      "A low entry price. Pro is €19 per user a month on yearly billing.",
      "Loved by a large community: 200,000+ users and a 4.8 rating on the Chrome Store.",
    ],
    whereWeWin: [
      "Same goal, another channel. Waalaxy opens conversations on LinkedIn; distribute.you opens them by cold email.",
      "We do the work. You paste a website; we find and qualify the buyers, write, send, A/B test and answer the interested replies.",
      "Your profile and your domain stay yours. We send from domains and mailboxes we own and warm.",
    ],
    chooseThemIf: [
      "You want to prospect on LinkedIn yourself, from your own profile, on a small monthly budget.",
    ],
    chooseUsIf: [
      "You want new sales conversations by email without running the campaign yourself.",
      "You want to see what each positive reply cost you, campaign by campaign.",
    ],
    faq: [
      { q: "How much does Waalaxy cost?", a: "Waalaxy has three plans per user: Pro at €39 a month, Advanced at €99 and Business at €139. Quarterly billing brings them to €31, €79 and €109, and yearly billing to €19, €49 and €69. The LinkedIn Inbox is a €20 a month add-on. Every plan starts with a 14-day free trial." },
      { q: "Is distribute.you a Waalaxy alternative?", a: "Yes, for the same goal: new conversations with buyers. Waalaxy automates LinkedIn from your own profile. distribute.you runs cold email for you, from domains we own, until the meeting is booked." },
      { q: "Do I have to log in to distribute.you every day?", a: "No. Waalaxy runs from your account, so you check your campaigns yourself. With distribute.you the software is optional: you can send us your website and never log in." },
    ],
  },
  {
    slug: "chili-piper",
    name: "Chili Piper",
    domain: "chilipiper.com",
    category: "inbound-routing",
    oneLiner: "An AI website conversion platform: agents that qualify, route and schedule meetings with your visitors before and after the form fill.",
    sourceUrl: "https://www.chilipiper.com/pricing",
    verifiedOn: "2026-10-16",
    pricingModel: "Annual contract by tier, with a set of seats and AI credits included. Extra seats are billed per month, and longer contracts get a discount.",
    entryPrice: "$1,250/month ($15,000/year)",
    prices: [
      { plan: "Routing & Scheduling", price: "$1,250/month ($15,000/year)", note: "Up to 15 seats, then $45/seat/month; 45,000 AI credits a year; form, chat and round-robin routing" },
      { plan: "Experiences", price: "$3,500/month ($42,000/year)", note: "Up to 30 seats, then $50/seat/month; 150,000 AI credits a year; AI chat, account identification, ABM targeting" },
      { plan: "ChiliCal standalone", price: "$12/user/month", note: "Scheduling links only, minimum 200 seats, no AI credits or routing" },
    ],
    operatedBy: "you",
    sendingDomains: "Not a sending tool. Meetings land on your reps' calendars.",
    leads: "Your own inbound: web forms, chat, events and website visitors.",
    replies: "Hand-raisers are qualified, routed to the right rep and booked on the spot.",
    channels: "Web forms, chat, scheduling links and instant calls.",
    costPerMeetingPublished: false,
    freeTier: "None. A demo.",
    contract: "Annual. 15% off for 2 years, 25% for 3, 40% for 4.",
    whereTheyWin: [
      "Speed on inbound. A buyer who fills a form can book a meeting with the right rep on the spot.",
      "Strong routing: round-robin, Salesforce object routing and lead-to-account matching.",
      "A clear public price, with a calculator on the pricing page.",
    ],
    whereWeWin: [
      "We create demand you do not have yet. Chili Piper converts people already raising their hand; distribute.you starts conversations with buyers who have not found you.",
      "We do not need your traffic. We find the buyers from your website and write to them.",
      "We answer the interested replies until the meeting is booked.",
    ],
    chooseThemIf: [
      "Your website already brings steady demo requests and you want every one routed and booked fast.",
      "You run a sales team on Salesforce or HubSpot and need fair, rule-based lead distribution.",
    ],
    chooseUsIf: [
      "You want more buyers in the pipeline, not only faster handling of the ones you have.",
      "Your site gets few demo requests today and you want new conversations this month.",
    ],
    faq: [
      { q: "How much does Chili Piper cost?", a: "Routing & Scheduling starts at $1,250 a month, or $15,000 a year, with 15 seats and then $45 per seat a month. Experiences starts at $3,500 a month, or $42,000 a year, with 30 seats and then $50 per seat a month. ChiliCal alone is $12 per user a month with a 200 seat minimum. Longer contracts take 15% to 40% off." },
      { q: "Is distribute.you a Chili Piper alternative?", a: "No, the two work together. Chili Piper turns people already raising their hand into meetings. distribute.you creates new conversations with buyers who have not found you yet, by cold email from our own domains." },
      { q: "Can I use Chili Piper and distribute.you together?", a: "Yes. distribute.you brings new buyers into the conversation and books the interested ones. Chili Piper keeps routing and booking the inbound demand your website already gets." },
    ],
  },
  {
    slug: "default",
    name: "Default",
    domain: "default.com",
    category: "inbound-routing",
    oneLiner: "Marketing infrastructure for go-to-market teams: one platform to manage workflows, enrich records, route leads and schedule meetings.",
    sourceUrl: "https://www.default.com/pricing",
    verifiedOn: "2026-10-16",
    pricingModel: "Annual platform plan with included enrichment credits and workflow runs, plus a yearly price per user seat.",
    entryPrice: "$12,000/year",
    prices: [
      { plan: "Growth", price: "$12,000/year", note: "Core plan: 24,000 enrichment credits and 200,000 workflow runs a year, Slack support" },
      { plan: "Enterprise", price: "$25,000/year", note: "60,000 enrichment credits and 600,000 workflow runs a year, dedicated support, migration services, custom integrations" },
      { plan: "Routing + Scheduling seat", price: "$540 per user per year", note: "For AEs, CSMs and BDRs: queues, object routing, round robins, booking links, handoff, Chrome extension" },
      { plan: "Scheduling seat", price: "$240 per user per year", note: "For SEs, managers or BDRs: booking links, queues and handoff" },
      { plan: "Extra enrichment credits", price: "$0.10 per credit", note: "One credit is one call to one data provider" },
    ],
    operatedBy: "you",
    sendingDomains: "Not a cold email sender. Outbound sequences run through the tools you connect.",
    leads: "Leads that already reach you: form fills, website visitors, product signups, plus your CRM records.",
    replies: "Handled by your reps. Default routes and books the meeting with the right owner.",
    channels: "Inbound forms, lead routing, scheduling, enrichment and workflows across your CRM.",
    costPerMeetingPublished: false,
    freeTier: "None. Start with a demo.",
    contract: "Annual agreement; unused credits and runs roll over within it.",
    whereTheyWin: [
      "Speed to lead. A demo request is enriched, qualified, routed and booked on the right calendar in one flow.",
      "One platform in place of several, with scheduling, routing, enrichment and website intent under one contract.",
      "Clean data. Waterfall enrichment and nightly CRM hygiene keep every record complete, with an audit log on each change.",
    ],
    whereWeWin: [
      "We create new demand. Default makes the most of the leads that already come to you; we find buyers who have never heard of you and start the conversation.",
      "We run the campaign for you. You paste a website; we qualify the buyers, write, send and answer the interested replies until the meeting is booked.",
      "Your domain stays out of it. We send cold email from domains and mailboxes we own and warm.",
    ],
    chooseThemIf: [
      "Your website already brings steady demo requests and you want each one routed and booked in minutes.",
      "Your RevOps team wants routing, scheduling and enrichment in one platform on an annual plan.",
    ],
    chooseUsIf: [
      "You want more conversations with buyers who have not found you yet.",
      "You would rather start small, choose your own outreach budget, and pause or cancel anytime.",
    ],
    faq: [
      { q: "How much does Default cost?", a: "Default lists two annual plans. Growth is $12,000 a year with 24,000 enrichment credits and 200,000 workflow runs. Enterprise is $25,000 a year with 60,000 credits and 600,000 runs. Seats come on top: $540 per user per year for Routing + Scheduling, $240 for Scheduling. Extra credits are $0.10 each." },
      { q: "Is distribute.you a Default alternative?", a: "Not really, and the two work well together. Default handles the leads that already come to you: it enriches, routes and books them fast. distribute.you creates new ones: we find buyers who do not know you yet and run cold email to them until a meeting is booked." },
      { q: "Can I use Default and distribute.you together?", a: "Yes. distribute.you fills the top of your pipeline with new conversations. When an interested prospect books, Default can route the meeting to the right rep like any other inbound lead." },
    ],
  },
  {
    slug: "frontrunner",
    name: "Frontrunner",
    domain: "usefr.com",
    category: "ai-sdr",
    oneLiner: "AI agents for GTM that connect your stack, find the signals that matter, and act on them so your team runs in the same direction.",
    sourceUrl: "https://usefr.com/demo",
    verifiedOn: "2026-10-16",
    pricingModel: "No price on the site. The pricing path leads to a demo booking, and every call to action points there.",
    entryPrice: "On request",
    prices: [
      { plan: "Pricing", price: "On request", note: "No plans or figures published; access starts with a demo" },
    ],
    operatedBy: "their AI agent",
    sendingDomains: "Yours. Agents work through the sequencers, inboxes and LinkedIn seats you connect.",
    leads: "Signals across your stack: website visitors, job posts, leadership changes, lookalikes of won accounts, past buyers.",
    replies: "Agents read replies across your sequencers and inboxes, classify intent and send the hot ones to the owner.",
    channels: "Works across your CRM, email sequencers, LinkedIn and inbound forms.",
    costPerMeetingPublished: false,
    freeTier: "None listed. Start with a demo.",
    contract: "Not published.",
    whereTheyWin: [
      "Breadth. One set of agents covers signals, inbound routing, deal reviews, renewals and reply triage across your whole stack.",
      "Context. Agents read your CRM, calls, threads and docs, so every draft and brief starts from what your team already knows.",
      "Warm paths. Agents spot a new leader at a target account and draft the intro from whoever on your team knows them.",
    ],
    whereWeWin: [
      "We run the whole campaign. You paste a website; we find the buyers, write, send and answer the interested replies until the meeting is booked.",
      "We bring the sending setup. Cold email goes out from domains and mailboxes we own and warm, so your domain never sends it.",
      "Clear pricing. One user is free, every action is at the API price with 0% markup, and your dashboard shows what each positive reply cost you.",
    ],
    chooseThemIf: [
      "You have a GTM team and a full stack, and you want agents working across all of it.",
      "Your pipeline comes from many motions at once: inbound, renewals, events and warm intros.",
    ],
    chooseUsIf: [
      "You want new meetings from cold email without hiring or running a sales team.",
      "You want to start today on a budget you choose, with nothing to set up.",
    ],
    faq: [
      { q: "How much does Frontrunner cost?", a: "Frontrunner does not publish its prices. The site sends every visitor to a demo, so a quote comes from that call. distribute.you publishes its prices, and one user is free." },
      { q: "Is distribute.you a Frontrunner alternative?", a: "For cold email, yes. Frontrunner gives your team AI agents that act across your GTM stack. distribute.you runs your cold email for you: we find the buyers, write and send from our own domains, and answer the interested replies until the meeting is booked." },
      { q: "Do I need my own sales tools to get started?", a: "Not with distribute.you. We bring the lists, the mailboxes and the sending, and the software is optional. Frontrunner works on top of the CRM, sequencers and inboxes you already have, so the agents are only as wide as your stack." },
    ],
  }
];

export const CATEGORY_LABEL: Record<Category, string> = {
  "cold-email-tool": "Cold email software",
  "ai-sdr": "AI SDR agents",
  "data-platform": "Data platforms",
  "sales-engagement": "Sales engagement platforms",
  "linkedin-outreach": "LinkedIn outreach tools",
  "inbound-routing": "Inbound routing and scheduling",
  "post-purchase": "Post-purchase platforms",
  "employee-advocacy": "Employee advocacy platforms",
};

export function competitorBySlug(slug: string): Competitor | undefined {
  return COMPETITORS.find((c) => c.slug === slug);
}

/** Every path the cluster serves, for the sitemap and llms.txt. */
export function comparePaths(): string[] {
  return ["/compare", "/alternatives", ...COMPETITORS.map((c) => `/compare/${c.slug}`)];
}

/**
 * The month the catalogue was last read, derived from the newest `verifiedOn`, so the
 * "Verified" eyebrow moves with the data and never needs its own edit.
 */
export const COMPARE_VERIFIED_LABEL = monthLabel(
  new Date(`${COMPETITORS.map((c) => c.verifiedOn).sort().at(-1)}T12:00:00Z`),
);

/** "October 2026". UTC, so the label does not depend on the server's zone. */
export function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}
