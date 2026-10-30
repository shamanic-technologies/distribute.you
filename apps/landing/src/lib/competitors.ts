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
  /**
   * The logo logo.dev serves is WHITE on a transparent background (Default's), so it vanishes on
   * our white tables: `competitorLogo` draws it on a dark tile instead.
   */
  readonly logoOnDark?: boolean;
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
    verifiedOn: "2026-10-30",
    pricingModel: "Monthly subscription for outreach, sized on emails and uploaded contacts. Lead credits are a second subscription; mailboxes and domains are bought separately.",
    entryPrice: "$47/month",
    prices: [
      { plan: "Growth", price: "$47/month", note: "5,000 emails and 1,000 uploaded contacts a month, unlimited email accounts and warmup" },
      { plan: "Hypergrowth", price: "$97/month", note: "125,000 emails and 25,000 uploaded contacts a month, replies answered inside their Unibox" },
      { plan: "Light Speed", price: "$358/month", note: "500,000 emails and 100,000 uploaded contacts a month, private servers and IP rotation" },
      { plan: "Instantly Credits", price: "From $9/month", note: "150 credits a month for lead search and their AI agents, a separate subscription" },
      { plan: "Done-for-you accounts", price: "From $4/month per account", note: "Plus $15 a year per domain, pre-warmed Google accounts at $10 a month" },
    ],
    operatedBy: "you",
    sendingDomains: "Yours. You buy the domains and mailboxes, connect them, and let their warmup run.",
    leads: "Their 450M+ contact database, on credits, or your own upload.",
    replies: "Land in their Unibox for you to answer. Their AI Reply Agent spends 5 credits per reply.",
    channels: "Email.",
    costPerMeetingPublished: false,
    freeTier: "14-day free trial, no card: 250 contacts and 1,000 emails.",
    contract: "Monthly or annual, cheaper annual.",
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
      { q: "How much does Instantly cost?", a: "Instantly's outreach plans are Growth at $47 a month, Hypergrowth at $97 and Light Speed at $358. Lead credits for their database and AI agents are a separate subscription from $9 a month. Mailboxes and domains are bought on top." },
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
  // The AI lead generation tools (PAGE-AI-LEAD-GEN-1029). Their comparison pages live under
  // the AI lead generation page's own cluster, `/ai-lead-generation/vs/<slug>`;
  // `/compare/<slug>` 301s there. Every figure re-read on each site on 2026-10-29.
  {
    slug: "apollo",
    name: "Apollo.io",
    domain: "apollo.io",
    category: "data-platform",
    oneLiner: "A B2B contact database with sequences, a dialer and AI features, sold per seat with credits for contact data.",
    sourceUrl: "https://www.apollo.io/pricing",
    verifiedOn: "2026-10-29",
    pricingModel: "Per seat per month, with credits for contact data pooled across the team. Unused credits expire each cycle.",
    entryPrice: "Free plan, then $49/seat/month",
    prices: [
      { plan: "Free", price: "$0", note: "A limited contact database and basic engagement tools" },
      { plan: "Basic", price: "$49/seat/month", note: "Contact access, CRM integrations and email automation" },
      { plan: "Professional", price: "$99/seat/month", note: "Higher credit limits, AI features, call recording" },
      { plan: "Custom", price: "On request", note: "Custom volumes, SSO, dedicated support, through their sales team" },
    ],
    operatedBy: "you",
    sendingDomains: "Yours. You connect your own mailboxes.",
    leads: "Searched by you in their database, revealed on credits.",
    replies: "Land in your inbox and their engagement view.",
    channels: "Contact data, with email sequences, a dialer and LinkedIn tasks.",
    costPerMeetingPublished: false,
    freeTier: "Free plan with limited credits.",
    contract: "Monthly, or annual paid upfront at a discount.",
    whereTheyWin: [
      "A huge contact database with filters and enrichment, in one search.",
      "A full sales stack for a team: sequences, dialer and CRM sync.",
      "A free plan to start with.",
    ],
    whereWeWin: [
      "Our AI agent picks the leads for you from your website. Nobody builds a search.",
      "Every lead is judged for fit and its email checked before anyone writes.",
      "Free for one user, every action at the API price with 0% markup, no seat to buy.",
    ],
    chooseThemIf: [
      "Your sales team needs a shared database and a dialer every day.",
      "You want to run every step of outbound yourself, in one tool.",
    ],
    chooseUsIf: [
      "You want qualified leads found for you, not a database to search.",
      "You want to pay the vendor's price for each lead, nothing added.",
    ],
    faq: [
      { q: "How much does Apollo cost?", a: "Apollo has a free plan, then Basic at $49 and Professional at $99 per seat per month, with credits for contact data. distribute.you is free for one user, and every action, each lead found included, is billed at the vendor's API price with 0% markup." },
      { q: "Does distribute.you use Apollo data?", a: "Yes, among other sources. Our agent calls Apollo's API to find people, and you pay Apollo's own price per credit, shown live on our catalog." },
      { q: "Can I keep Apollo for my sales team?", a: "Yes. Keep Apollo for your reps, and let our AI agent find, judge and write to new leads from domains we own." },
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
    slug: "smartlead",
    name: "Smartlead",
    domain: "smartlead.ai",
    category: "cold-email-tool",
    oneLiner: "A cold email sending platform with unlimited mailboxes, a shared warmup pool and agency client workspaces.",
    sourceUrl: "https://www.smartlead.ai/pricing",
    verifiedOn: "2026-10-30",
    pricingModel: "Monthly subscription by contacts and sends. Mailboxes and domains are paid on top.",
    entryPrice: "$39/month",
    prices: [
      { plan: "Base", price: "$39/month ($32 billed yearly)", note: "2,000 contacts, 6,000 emails a month, unlimited mailboxes" },
      { plan: "Pro", price: "$94/month ($78 billed yearly)", note: "30,000 contacts, 90,000 emails a month" },
      { plan: "Unlimited Smart", price: "$174/month ($144 billed yearly)", note: "Unlimited contacts, 150,000 emails a month" },
      { plan: "Unlimited Prime", price: "$379/month ($315 billed yearly)", note: "Unlimited contacts, 500,000 emails a month, 3 client workspaces included" },
      { plan: "Mailboxes", price: "From $3.99/mailbox/month", note: "Plus $13 to $19 per domain a year, bought through their partners" },
      { plan: "Client workspace", price: "$29/month each", note: "White label for agencies, from the Pro plan" },
    ],
    operatedBy: "you",
    sendingDomains: "Yours. You bring the mailboxes; their warmup pool is included.",
    leads: "Your upload. Email verification is included per plan.",
    replies: "Land in their master inbox for you to answer.",
    channels: "Email.",
    costPerMeetingPublished: false,
    freeTier: "Free trial on every plan, no credit card.",
    contract: "Monthly or annual, 17% off annual.",
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
      { q: "How much does Smartlead cost?", a: "Smartlead has four plans: Base at $39 a month, Pro at $94, Unlimited Smart at $174 and Unlimited Prime at $379. Yearly billing takes 17% off. Mailboxes cost extra, from $3.99 each a month plus $13 to $19 per domain a year, and each agency client workspace is $29 a month." },
      { q: "Smartlead is $39 a month. How can distribute.you compete on price?", a: "Different things are being priced. $39 buys the sending software; you still buy mailboxes, a list and someone's time. distribute.you is free for one user, and each action, from finding a buyer to sending the email, is billed at the API price with 0% markup." },
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
    verifiedOn: "2026-10-30",
    pricingModel: "Per user per month, email-only or multichannel.",
    entryPrice: "$69/month",
    prices: [
      { plan: "Email", price: "$69/month ($55 annual)", note: "50,000 emails a month, unlimited users, warmup, lead database" },
      { plan: "Multichannel", price: "$109/user/month ($87 annual)", note: "Unlimited emails and messages, LinkedIn, SMS, a dialer, WhatsApp as an add-on" },
      { plan: "Enterprise", price: "On request", note: "Roles, SSO, dedicated manager" },
    ],
    operatedBy: "you",
    sendingDomains: "Yours, connected to their deliverability hub.",
    leads: "Their 650M+ database on credits, or your upload.",
    replies: "Land in their unified inbox for you to answer.",
    channels: "Email, LinkedIn, SMS, calls, WhatsApp as an add-on.",
    costPerMeetingPublished: false,
    freeTier: "14-day free trial.",
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
      { q: "Is distribute.you cheaper than Lemlist?", a: "For one person, Lemlist is $69 a month plus your time. distribute.you is free for one user, and each action is billed at the API price with 0% markup, with the work included." },
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
    verifiedOn: "2026-10-29",
    pricingModel: "Monthly actions plus data credits, tiered by plan. The headline price is the entry actions and data credits together, billed annually.",
    entryPrice: "Free plan, then from $167/month",
    prices: [
      { plan: "Free", price: "$0", note: "500 actions and 100 data credits a month, unlimited seats" },
      { plan: "Launch", price: "From $167/month", note: "15,000 actions and 3,000 data credits a month, billed annually" },
      { plan: "Growth", price: "From $446/month", note: "40,000 actions and 6,000 data credits a month, billed annually" },
      { plan: "Enterprise", price: "On request", note: "Custom actions and data credits, through a demo" },
    ],
    operatedBy: "you",
    sendingDomains: "Not a sending tool. You connect a sequencer.",
    leads: "Built by you in tables, from dozens of data providers, on credits.",
    replies: "Handled in whatever sequencer you connect.",
    channels: "Data and workflows; sending happens elsewhere.",
    costPerMeetingPublished: false,
    freeTier: "Free plan with 100 data credits a month.",
    contract: "Monthly or annual.",
    whereTheyWin: [
      "The most flexible data layer in the category: waterfalls across providers, AI columns, any workflow.",
      "Loved by GTM engineers who want to build.",
      "A free plan to learn on.",
    ],
    whereWeWin: [
      "No table to build. Our AI agent reads your website and finds the leads itself.",
      "It also writes to each lead and answers the replies, from domains we own.",
      "Free for one user, every action at the API price with 0% markup.",
    ],
    chooseThemIf: [
      "You have a GTM engineer who wants full control of the data.",
      "You already run a sequencer and need richer inputs for it.",
    ],
    chooseUsIf: [
      "You want qualified leads without building the machine.",
      "You want each lead's price shown before it runs.",
    ],
    faq: [
      { q: "How much does Clay cost?", a: "Clay has a free plan, then Launch from $167 and Growth from $446 a month on annual billing, for actions and data credits together. distribute.you is free for one user, and every action is billed at the vendor's API price with 0% markup." },
      { q: "Clay finds leads too. What differs?", a: "Clay gives you the parts to build lead generation yourself. distribute.you is an AI agent that does it: it finds the leads, judges each one, checks the email and writes to them." },
      { q: "Can I feed a Clay table into distribute.you?", a: "Yes. Upload the list as its own audience. Our agent writes to it beside the leads it finds, and you see what each one brought." },
    ],
  },
  // The AI SDR agents (category "ai-sdr"). Their comparison pages live under the AI SDR
  // page's own cluster, `/ai-sdr/vs/<slug>` (PAGE-AI-SDR-1029); `/compare/<slug>` 301s
  // there. Every figure re-read on each site on 2026-10-29.
  {
    slug: "11x",
    name: "11x",
    domain: "11x.ai",
    category: "ai-sdr",
    oneLiner: "AI agents for large revenue teams: Alice writes outbound email and social, Julian answers inbound by voice and chat and books meetings.",
    sourceUrl: "https://www.11x.ai/",
    verifiedOn: "2026-10-29",
    pricingModel: "Not published. Every call to action on the site books a demo.",
    entryPrice: "On request",
    prices: [
      { plan: "Alice and Julian", price: "On request", note: "No price on the site; every path leads to a demo" },
    ],
    operatedBy: "their AI agent",
    sendingDomains: "Not stated on their site; set up with their team after the demo.",
    leads: "Researched by Alice, account by account.",
    replies: "Alice works outbound replies by email and social; Julian answers inbound by voice and chat, around the clock.",
    channels: "Voice, chat, email, social, SMS and WhatsApp, plus a human dialer.",
    costPerMeetingPublished: false,
    freeTier: "None stated; a demo comes first.",
    contract: "Not published; set after a demo.",
    whereTheyWin: [
      "Voice agents that call and answer in several languages, around the clock.",
      "Inbound and outbound in one platform, with a human dialer beside the agents.",
      "Built for large revenue teams, with pages for Sales, RevOps and Enterprise.",
    ],
    whereWeWin: [
      "Start today from your website, without a demo.",
      "Free for one user, every action at the API price with 0% markup.",
      "Open source under the MIT license: run it on your own server.",
    ],
    chooseThemIf: [
      "You run a large revenue team and want voice agents on inbound calls.",
      "You buy through a demo and a contract.",
    ],
    chooseUsIf: [
      "You want your first meetings this week, from your website.",
      "You want to see every price before you start.",
    ],
    faq: [
      { q: "How much does 11x cost?", a: "11x does not publish a price on its site; every path leads to a demo. distribute.you is free for one user, and every action is billed at the vendor's API price with 0% markup." },
      { q: "Is 11x an AI SDR?", a: "Yes. Alice is their outbound agent and Julian their inbound one. distribute.you is an AI SDR too: it finds your buyers, writes to them, answers the replies and books the meetings." },
      { q: "Which one fits a small team?", a: "11x writes for large revenue teams. distribute.you is built for founders and small teams: free for one user, $9 per user for a team." },
    ],
  },
  {
    slug: "artisan",
    name: "Artisan",
    domain: "artisan.co",
    category: "ai-sdr",
    oneLiner: "Ava, an autonomous AI BDR that finds and enriches B2B leads, writes and sends outreach, handles replies and books meetings.",
    sourceUrl: "https://www.artisan.co/pricing",
    verifiedOn: "2026-10-29",
    pricingModel: "Credit-based tiers from startups through enterprise. No figure is on the pricing page; a demo comes first.",
    entryPrice: "On request",
    prices: [
      { plan: "Credit-based tiers", price: "On request", note: "Startups through enterprise; the page states the model, not the figures" },
    ],
    operatedBy: "their AI agent",
    sendingDomains: "Not stated on their site.",
    leads: "Found and enriched by Ava.",
    replies: "Handled by Ava, who books the meetings.",
    channels: "Outbound outreach, with a dialer and intent signals in the platform.",
    costPerMeetingPublished: false,
    freeTier: "None stated; the main call to action is a demo.",
    contract: "Not published.",
    whereTheyWin: [
      "One platform for the agent, the data, a dialer and intent signals.",
      "Ava runs outbound end to end, replies and meetings included.",
    ],
    whereWeWin: [
      "Published prices: free for one user, every action at the API price with 0% markup.",
      "Start from your website in minutes, without a demo.",
      "Open source: your leads and replies can live in your own database.",
    ],
    chooseThemIf: [
      "You want an AI BDR inside an all-in-one outbound platform.",
      "You are happy to start with a demo.",
    ],
    chooseUsIf: [
      "You want to know what you will pay before you talk to anyone.",
      "You want to own the code and the data.",
    ],
    faq: [
      { q: "How much does Artisan cost?", a: "Their pricing page describes credit-based tiers without figures; a demo comes first. distribute.you is free for one user, with every action at the API price and 0% markup." },
      { q: "Ava books meetings. So does distribute.you. What differs?", a: "Both find leads, write, answer replies and book meetings. distribute.you sends from domains we own and warm, shows the price of every action before it runs, and is open source." },
      { q: "Which is faster to start?", a: "distribute.you starts from your website in minutes, and your first emails can leave the same day. Artisan starts with a demo." },
    ],
  },
  {
    slug: "aisdr",
    name: "AiSDR",
    domain: "aisdr.com",
    category: "ai-sdr",
    oneLiner: "An AI SDR platform that prospects, personalises and runs multichannel sequences, with an AI strategist named Ami.",
    sourceUrl: "https://aisdr.com/pricing",
    verifiedOn: "2026-10-29",
    pricingModel: "Pay as you go at $1.50 per person prospected, charged daily. Team plans are priced on volume, billed monthly on quarterly contracts.",
    entryPrice: "$1.50 per person prospected",
    prices: [
      { plan: "Pay as you go", price: "$1.50 per person prospected", note: "Charged daily, cancel anytime; Ami, prospecting, sequences, warmup and a unified inbox" },
      { plan: "Teams", price: "On request", note: "For teams contacting 1,000+ people a month; quarterly contracts, 20% off annual" },
      { plan: "Warmed-up mailbox", price: "$33", note: "Add-on, any plan" },
      { plan: "Fully managed service", price: "$2,500/month", note: "Add-on; a single managed campaign is $149" },
    ],
    operatedBy: "their AI agent",
    sendingDomains: "Lookalike domains with warmup and deliverability monitoring, set up by them.",
    leads: "Prospected from their 2B+ profiles.",
    replies: "Land in their unified inbox, synced both ways with HubSpot.",
    channels: "Multichannel sequences; LinkedIn signals and AI voice notes on Teams.",
    costPerMeetingPublished: false,
    freeTier: "Sign up without a card; payment starts when you launch a campaign.",
    contract: "None on pay as you go. Teams are quarterly, 20% off annual.",
    whereTheyWin: [
      "Pay as you go with no commitment, and a price per person on the page.",
      "HubSpot sync on every plan, Salesforce on Teams.",
      "A managed service if you want their team to run it.",
    ],
    whereWeWin: [
      "Free for one user, every action at the API price with 0% markup.",
      "Open source: run it on your own server with your own keys.",
      "What each meeting cost you, measured on your dashboard.",
    ],
    chooseThemIf: [
      "You want an AI SDR priced per person prospected, inside HubSpot.",
      "You plan to contact 1,000+ people a month on a quarterly contract.",
    ],
    chooseUsIf: [
      "You want to pay the vendor's API price for each action, nothing added.",
      "You want the code and the data in your hands.",
    ],
    faq: [
      { q: "How much does AiSDR cost?", a: "AiSDR's pay as you go plan is $1.50 per person prospected, charged daily. Team plans are priced on volume, on quarterly contracts. distribute.you is free for one user, and every action is billed at the vendor's API price with 0% markup." },
      { q: "Do both send from warmed domains?", a: "Yes. AiSDR sets up lookalike domains with warmup. distribute.you sends from domains we own and warm, so nothing is set up in your name." },
      { q: "Is there a commitment with distribute.you?", a: "No. You start with a $10 balance and can pause or cancel anytime." },
    ],
  },
  {
    slug: "qualified",
    name: "Qualified",
    domain: "qualified.com",
    category: "ai-sdr",
    oneLiner: "Piper, an AI SDR agent that talks with your website visitors and inbound leads by text, voice and email, and books meetings.",
    sourceUrl: "https://www.qualified.com/pricing",
    verifiedOn: "2026-10-29",
    pricingModel: "Three plans sized by web sessions and email contacts. No price is published; every plan says Contact us.",
    entryPrice: "On request",
    prices: [
      { plan: "Premier", price: "On request", note: "One SDR agent, 250K web sessions and 2.5K active email contacts a month" },
      { plan: "Enterprise", price: "On request", note: "2M web sessions and 10K email contacts a month, agent handoff, MCP and API access" },
      { plan: "Ultimate", price: "On request", note: "5M web sessions and 24K email contacts a month, a dedicated IP" },
    ],
    operatedBy: "their AI agent",
    sendingDomains: "Not a cold email sender: Piper emails your inbound leads.",
    leads: "Your own website visitors and inbound leads, enriched.",
    replies: "Piper answers on your website and by email, and books the meeting.",
    channels: "Website chat, voice and video, email, and Slack.",
    costPerMeetingPublished: false,
    freeTier: "None; a demo comes first.",
    contract: "Not published.",
    whereTheyWin: [
      "Turns the buyers already on your website into meetings, in real time.",
      "Deep Salesforce integration and 20+ GTM integrations.",
      "Over 500 companies have hired Piper, in their own words.",
    ],
    whereWeWin: [
      "We find new buyers who have never visited your site.",
      "Free for one user, every action at the API price with 0% markup.",
      "Start from your website today, without a demo.",
    ],
    chooseThemIf: [
      "Your site already gets heavy traffic and you want every visitor answered.",
      "You run Salesforce and buy through a demo.",
    ],
    chooseUsIf: [
      "You need new buyers, not only the ones already on your site.",
      "You want to see the price before you start.",
    ],
    faq: [
      { q: "How much does Qualified cost?", a: "Qualified publishes three plans, Premier, Enterprise and Ultimate, without a price; each says Contact us. distribute.you is free for one user, and every action is billed at the vendor's API price with 0% markup." },
      { q: "Is Qualified an outbound AI SDR?", a: "Piper works inbound: your website visitors and inbound leads. distribute.you works outbound: it finds new buyers, writes to them and books the meetings. The two can run side by side." },
      { q: "Which is faster to start?", a: "distribute.you starts from your website in minutes. Qualified starts with a demo." },
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
    verifiedOn: "2026-10-30",
    pricingModel: "Per user per month, email-only or multichannel, with LinkedIn and calls sold per account and an AI SDR plan on top.",
    entryPrice: "$49/user/month (annual)",
    prices: [
      { plan: "Email Volume", price: "From $49/user/month billed annually, $59 paid monthly", note: "1,000 active contacts a month, unlimited mailboxes and emails, warmup, 50 live data credits a month" },
      { plan: "Multichannel", price: "From $89/user/month billed annually, $99 paid monthly", note: "Unlimited active contacts, 10 mailboxes, email, LinkedIn, calls and SMS, onboarding with a CSM" },
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
    verifiedOn: "2026-10-30",
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
    verifiedOn: "2026-10-30",
    pricingModel: "Monthly price per plan, set by how many emails you send. More emails, extra warmups, mailboxes and the agency panel are add-ons; Scale is priced on a call.",
    entryPrice: "$39/month",
    prices: [
      { plan: "Email", price: "$39/month ($26 billed annually)", note: "5,000 emails a month, 3 warmups, 100 Lead Finder credits, unlimited contacts, email accounts, team members and email verification" },
      { plan: "Multichannel", price: "$68/month ($55 billed annually)", note: "Email and LinkedIn in one campaign: 5,000 emails a month and 1 LinkedIn account" },
      { plan: "LinkedIn", price: "$29/month", note: "1 LinkedIn account: messages, InMails, connection requests and profile visits" },
      { plan: "Scale", price: "On request", note: "Higher email or LinkedIn limits, priced on a call" },
    ],
    operatedBy: "you",
    sendingDomains: "Yours. You connect your mailboxes, or buy mailboxes and domains from them as an add-on.",
    leads: "Their Lead Finder database on credits, or your own upload.",
    replies: "Land in their centralized inbox for you to answer.",
    channels: "Email and LinkedIn.",
    costPerMeetingPublished: false,
    freeTier: "14-day free trial or 500 cold emails, whichever comes first, no credit card.",
    contract: "Monthly or annual, 33% off annual.",
    whereTheyWin: [
      "Clear pricing: you pay by emails sent, with team members, contacts and email accounts free.",
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
      { q: "How much does Woodpecker cost?", a: "Woodpecker's Email plan is $39 a month for 5,000 emails, or $26 a month billed annually. Multichannel, with one LinkedIn account, is $68 a month ($55 annually), and LinkedIn alone is $29 a month. Scale is priced on a call. Annual billing saves 33%." },
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
    verifiedOn: "2026-10-30",
    pricingModel: "Monthly or yearly subscription, billed by the number of users you buy. Data Finder and ready-to-use mailboxes are paid add-ons.",
    entryPrice: "$29/month",
    prices: [
      { plan: "Starter", price: "$29/month ($25 billed yearly)", note: "1 email address, 1,500 sends a month, unlimited contacts and warmup, 50 data finder credits" },
      { plan: "Email Outreach", price: "$49/month ($45 billed yearly)", note: "2 email addresses, unlimited sends, 50 data finder credits, unified inbox, CRM integrations" },
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
    verifiedOn: "2026-10-29",
    pricingModel: "Free for up to 50 credits. Paid plans are not published; their site sends you to their sales team.",
    entryPrice: "Free up to 50 credits, then on request",
    prices: [
      { plan: "Pricing", price: "On request", note: "Free for up to 50 credits. Every paid plan is quoted by their sales team." },
    ],
    operatedBy: "you",
    sendingDomains: "Yours. Emails and calls go out from your own accounts.",
    leads: "Searched by you in their engine of business emails and phone numbers.",
    replies: "Yours to handle, in your inbox or CRM.",
    channels: "Contact data, with email, calling and social selling tools.",
    costPerMeetingPublished: false,
    freeTier: "Free for up to 50 credits.",
    contract: "Set with their sales team.",
    whereTheyWin: [
      "Emails and direct phone numbers in the same search.",
      "Easy to try: the first 50 credits are free.",
    ],
    whereWeWin: [
      "A price on the page: free for one user, every action at the API price with 0% markup.",
      "Our AI agent picks and judges the leads from your website, then writes to them.",
      "Emails leave from domains we own, so your own domain stays clean.",
    ],
    chooseThemIf: [
      "Your reps call prospects every day and need phone numbers.",
      "You want a contact search your whole sales team shares.",
    ],
    chooseUsIf: [
      "You want qualified leads, already contacted, rather than contacts to work through.",
      "You want to see the price before you talk to anyone.",
    ],
    faq: [
      { q: "How much does Seamless.AI cost?", a: "Seamless.AI is free for up to 50 credits. Paid plans are not published; their sales team quotes one for your team. distribute.you is free for one user, and every action is billed at the vendor's API price with 0% markup." },
      { q: "Is distribute.you a Seamless.AI alternative?", a: "Yes, if what you want is new leads who answer. Seamless.AI gives your team contacts to reach. distribute.you finds the leads, judges each one, checks the email and writes to them for you." },
      { q: "Do I have to build a lead list for distribute.you?", a: "No. Paste your website and our agent finds the leads. If you already own a list, add it as an extra audience." },
    ],
  },
  {
    slug: "lusha",
    name: "Lusha",
    domain: "lusha.com",
    category: "data-platform",
    oneLiner: "A B2B contact data platform: reveal verified emails and phone numbers on credits, from the web app, a browser extension or your CRM.",
    sourceUrl: "https://www.lusha.com/pricing/",
    verifiedOn: "2026-10-29",
    pricingModel: "Monthly plans with a credit allowance. A verified email costs 1 credit, a phone number 5 credits.",
    entryPrice: "Free plan, then $49.90/month",
    prices: [
      { plan: "Free", price: "$0", note: "40 credits a month" },
      { plan: "Starter", price: "$49.90/month", note: "400 credits a month; $37.45/month billed annually" },
      { plan: "Professional", price: "$69.90/month", note: "600 credits a month; $52.45/month billed annually" },
      { plan: "Premium", price: "$399.90/month", note: "3,400 credits a month; $299.95/month billed annually" },
      { plan: "Scale", price: "On request", note: "Custom credits, for teams larger than 5 users" },
    ],
    operatedBy: "you",
    sendingDomains: "Not a cold email sender. You reach out from your own tools.",
    leads: "Revealed by you, one contact at a time or in bulk, on credits.",
    replies: "Handled in your own inbox or CRM.",
    channels: "Contact data and intent signals, with CRM and browser integrations.",
    costPerMeetingPublished: false,
    freeTier: "Free plan with 40 credits a month.",
    contract: "Monthly or annual.",
    whereTheyWin: [
      "Quick reveals of emails and phone numbers right inside your browser and CRM.",
      "A free plan and a clear price per credit on the page.",
    ],
    whereWeWin: [
      "Our AI agent decides who to reveal: only leads it judged a fit.",
      "Each email is checked, then written to from domains we own.",
      "Free for one user, every action at the API price with 0% markup.",
    ],
    chooseThemIf: [
      "Your reps look people up one by one and need their phone numbers.",
      "You want contact data inside your CRM and browser.",
    ],
    chooseUsIf: [
      "You want qualified leads found and contacted for you.",
      "You would rather pay per lead found than for a credit allowance.",
    ],
    faq: [
      { q: "How much does Lusha cost?", a: "Lusha has a free plan with 40 credits a month, then Starter at $49.90, Professional at $69.90 and Premium at $399.90 a month. A verified email is 1 credit, a phone number 5. distribute.you is free for one user, and every action is billed at the vendor's API price with 0% markup." },
      { q: "Is distribute.you a Lusha alternative?", a: "Yes, if what you want is leads who answer. Lusha reveals contacts for your team to reach. distribute.you finds the leads, judges each one, checks the email and writes to them." },
      { q: "Can I use both?", a: "Yes. Keep Lusha for your reps' lookups, and let our agent find and contact new leads from domains we own." },
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
    logoOnDark: true,
    category: "inbound-routing",
    oneLiner: "The inbound engine for go-to-market teams: one platform to manage workflows, enrich records, route leads and schedule meetings.",
    sourceUrl: "https://www.default.com/pricing",
    verifiedOn: "2026-10-30",
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
    sendingDomains: "Not a cold email sender. Its workflows add leads to the sequences you run in the tools you connect.",
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
  },
  {
    slug: "unify",
    name: "Unify",
    domain: "unifygtm.com",
    category: "sales-engagement",
    oneLiner: "Outbound agents for every rep: AI prospecting on a database of 1.1B+ people and 65M+ companies, with signals, sequences and a dialer.",
    sourceUrl: "https://www.unifygtm.com/pricing",
    verifiedOn: "2026-10-30",
    pricingModel: "Per seat per month, with credits for enrichment. A free plan, monthly Base and Pro plans, and a custom Business plan billed annually.",
    entryPrice: "Free plan, then $20/seat/month",
    prices: [
      { plan: "Free", price: "$0, free forever", note: "Limited credits, up to 3 seats, 1 mailbox per seat, 100 records per search" },
      { plan: "Base", price: "$20/seat/month, billed monthly", note: "800 credits per seat a month, AI email copywriting, job change and hiring signals, phone and email enrichment" },
      { plan: "Pro", price: "$60/seat/month, billed monthly", note: "2,400 credits per seat a month, read-only HubSpot and Salesforce sync, Slack notifications" },
      { plan: "Business", price: "On request, billed annually", note: "A custom credit pool, managed Gmail and Outlook mailboxes, website intent and product signals, a power dialer" },
    ],
    operatedBy: "their AI agent",
    sendingDomains: "One mailbox per seat on Free, Base and Pro. Managed Gmail and Outlook mailboxes, with warmup and rotation, on the custom Business plan.",
    leads: "Their database of 1.1B+ people and 65M+ companies from 40+ data sources, with signals such as job changes, funding, hiring and web visits.",
    replies: "Their site does not say who answers. Your reps work the email, call and social tasks of each sequence.",
    channels: "Email, calls and social tasks in one sequence.",
    costPerMeetingPublished: false,
    freeTier: "Free forever plan with limited credits, and a 14-day Pro trial with no card.",
    contract: "Base and Pro billed monthly; Business billed annually.",
    whereTheyWin: [
      "A big database: 1.1B+ people and 65M+ companies, enriched through 40+ data sources.",
      "Signals your reps can act on: job changes, funding, hiring, web visits and tech stack.",
      "A real free plan, and paid seats from $20 a month.",
    ],
    whereWeWin: [
      "We run the whole go-to-market: we find the buyers, write, send from our own domains, answer and book the meeting, so no rep has to work a queue.",
      "Sending comes with every plan, from domains we own and warm, with nothing to set up.",
      "One user is free, every action is at the API price with 0% markup, and the code is open source.",
    ],
    chooseThemIf: [
      "You have reps who will work sequences, calls and social tasks every day.",
      "You want a large contact database inside a sales engagement tool.",
    ],
    chooseUsIf: [
      "You are a founder without a sales team, and want buyers contacted and answered for you.",
      "You would rather pay each action at the API price than a seat.",
    ],
    faq: [
      { q: "How much does Unify cost?", a: "Unify has a free plan with limited credits. Base is $20 per seat a month with 800 credits per seat, Pro is $60 per seat a month with 2,400 credits per seat, and Business is a custom plan billed annually with managed mailboxes." },
      { q: "Is distribute.you a Unify alternative?", a: "Yes, if you want the work done rather than tools for reps. Unify gives your reps AI agents, a database and sequences to work. distribute.you runs your go-to-market for you: we find the buyers, write and send from our own domains, and answer the interested replies until the meeting is booked." },
      { q: "Do I need my own mailboxes?", a: "With distribute.you, no: we send from mailboxes and domains we own and warm, on every plan. Unify includes one mailbox per seat, and managed mailboxes on its custom Business plan." },
    ],
  },
  {
    slug: "common-room",
    name: "Common Room",
    domain: "commonroom.io",
    category: "data-platform",
    oneLiner: "Buyer intelligence that turns intent into pipeline: signals, a 400M+ contact directory and AI agents in one platform.",
    sourceUrl: "https://www.commonroom.io/pricing/",
    verifiedOn: "2026-10-30",
    pricingModel: "Annual plans with seats, contacts and AI credits included. Essential has a published price; Advanced and Enterprise are custom.",
    entryPrice: "$2,500/month, billed annually",
    prices: [
      { plan: "Essential", price: "$2,500/month, billed annually", note: "5 seats, up to 100k contacts, 5k RoomieAI research credits, 2.5k Prospector credits, a shared CSM" },
      { plan: "Advanced", price: "On request", note: "15 seats, up to 250k contacts, 7.5k research credits, 7.5k Prospector credits, a dedicated CSM" },
      { plan: "Enterprise", price: "On request", note: "30 seats, up to 750k contacts, 10k research credits, 15k Prospector credits, every integration" },
    ],
    operatedBy: "you",
    sendingDomains: "Not a sender itself. Sequences run in the sales engagement platform you connect, such as Outreach.",
    leads: "Signals from your website, community, social, job changes and product, plus a 400M+ contact directory with waterfall enrichment.",
    replies: "Handled by your reps, in the sales engagement platform you connect.",
    channels: "Signals and alerts in Salesforce, Slack, email and a browser extension; outreach through your sequencer.",
    costPerMeetingPublished: false,
    freeTier: "None listed. Start with a demo.",
    contract: "Billed annually.",
    whereTheyWin: [
      "Signals from many places at once: website visits, community, social, job changes and product usage.",
      "Research and scoring on every account, inside Salesforce and Slack.",
      "An MCP server on every plan, so your own agents can read their data.",
    ],
    whereWeWin: [
      "We act on the buyer, not only spot them: we write, send from our own domains, answer and book the meeting.",
      "One user is free and every action is at the API price with 0% markup, with no annual plan.",
      "Nothing to connect: sending, replies and follow up come with the agent.",
    ],
    chooseThemIf: [
      "You have a sales team and many signal sources, and want them scored and routed.",
      "You run a community or a product with lots of activity to read.",
    ],
    chooseUsIf: [
      "You want new buyers contacted and answered this week, without a sales team.",
      "You want to start free and pay as you go.",
    ],
    faq: [
      { q: "How much does Common Room cost?", a: "Essential is $2,500 a month, billed annually, with 5 seats, up to 100k contacts and 5k research credits. Advanced and Enterprise are priced on request." },
      { q: "Is distribute.you a Common Room alternative?", a: "For outbound, yes. Common Room finds and scores buyers for your reps to work in their own tools. distribute.you does the work: we find the buyers, write and send from our own domains, and answer the interested replies until the meeting is booked." },
      { q: "Can I use Common Room and distribute.you together?", a: "Yes. Common Room keeps reading the signals your website and community send. distribute.you reaches the buyers who have not shown up yet, and books the interested ones." },
    ],
  },
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

/**
 * An AI Agent page that owns the comparisons against the tools its own searchers weigh:
 * they are served at `<page>/vs/<slug>` and wear that page's nav and footer, and their old
 * `/compare/<slug>` URLs answer a 301 there. Every other competitor stays under `/compare`.
 */
export type CompareCluster = {
  /** The owning page's path. */
  readonly path: string;
  /** What the page is called in breadcrumbs and links ("AI SDR alternatives"). */
  readonly name: string;
  readonly slugs: readonly string[];
};

export const AI_SDR_PATH = "/ai-sdr";
export const AI_SDR_ALTERNATIVES_PATH = `${AI_SDR_PATH}/alternatives`;

/**
 * The AI SDRs searchers weigh against "ai sdr" (owner brief 2026-10-29): their pages move
 * under `/ai-sdr/vs/`. Gojiberry and Explee, AI SDRs too, stay under `/compare` with the
 * other clones the owner picked.
 */
export const AI_SDR_SLUGS: readonly string[] = ["11x", "artisan", "aisdr", "qualified"];

/** The AI lead generation page (Lead Generation, AI Agent buyer, PAGE-AI-LEAD-GEN-1029). */
export const AI_LEAD_GEN_PATH = "/ai-lead-generation";
export const AI_LEAD_GEN_ALTERNATIVES_PATH = `${AI_LEAD_GEN_PATH}/alternatives`;

/** The lead tools searchers weigh against "ai lead generation", each price published on their site. */
export const AI_LEAD_GEN_SLUGS: readonly string[] = ["apollo", "clay", "seamless-ai", "lusha"];

/** The cold email automation page (Sales Cold Email, AI Agent buyer, PAGE-COLD-EMAIL-AUTOMATION-1030). */
export const COLD_EMAIL_AUTOMATION_PATH = "/cold-email-automation";
export const COLD_EMAIL_AUTOMATION_ALTERNATIVES_PATH = `${COLD_EMAIL_AUTOMATION_PATH}/alternatives`;

/** The cold email tools searchers weigh against "cold email automation", each price published on their site. */
export const COLD_EMAIL_AUTOMATION_SLUGS: readonly string[] = ["instantly", "smartlead", "lemlist", "reply-io", "saleshandy", "woodpecker", "mailshake"];

/** The GTM automation page (GTM, AI Agent buyer, PAGE-GTM-AUTOMATION-1030), the umbrella of the AI Agent pages. */
export const GTM_AUTOMATION_PATH = "/gtm-automation";
export const GTM_AUTOMATION_ALTERNATIVES_PATH = `${GTM_AUTOMATION_PATH}/alternatives`;

/**
 * The GTM platforms searchers weigh against "gtm automation", each price published on their
 * site. Clay, a GTM platform too, stays in the AI lead generation cluster; the GTM page links it there.
 */
export const GTM_AUTOMATION_SLUGS: readonly string[] = ["default", "unify", "common-room"];

/** GTM tools compared on the GTM page whose own page lives in another cluster. */
export const GTM_AUTOMATION_ALSO: readonly string[] = ["clay"];

export const AI_SDR_CLUSTER: CompareCluster = { path: AI_SDR_PATH, name: "AI SDR", slugs: AI_SDR_SLUGS };
export const AI_LEAD_GEN_CLUSTER: CompareCluster = { path: AI_LEAD_GEN_PATH, name: "AI lead generation", slugs: AI_LEAD_GEN_SLUGS };
export const COLD_EMAIL_AUTOMATION_CLUSTER: CompareCluster = {
  path: COLD_EMAIL_AUTOMATION_PATH,
  name: "Cold email automation",
  slugs: COLD_EMAIL_AUTOMATION_SLUGS,
};
export const GTM_AUTOMATION_CLUSTER: CompareCluster = { path: GTM_AUTOMATION_PATH, name: "GTM automation", slugs: GTM_AUTOMATION_SLUGS };
export const COMPARE_CLUSTERS: readonly CompareCluster[] = [
  AI_SDR_CLUSTER,
  AI_LEAD_GEN_CLUSTER,
  COLD_EMAIL_AUTOMATION_CLUSTER,
  GTM_AUTOMATION_CLUSTER,
];

/** The cluster a competitor's page sits in, if any. */
export function clusterOf(c: Pick<Competitor, "slug">): CompareCluster | undefined {
  return COMPARE_CLUSTERS.find((k) => k.slugs.includes(c.slug));
}

/** A cluster's competitors, in its order. */
export function clusterCompetitors(k: CompareCluster): Competitor[] {
  return k.slugs.map((slug) => COMPETITORS.find((c) => c.slug === slug)).filter((c): c is Competitor => !!c);
}

export function clusterAlternativesPath(k: CompareCluster): string {
  return `${k.path}/alternatives`;
}

/** The AI SDR page's own competitors, in that order. */
export function aiSdrCompetitors(): Competitor[] {
  return clusterCompetitors(AI_SDR_CLUSTER);
}

export function isAiSdrCluster(c: Pick<Competitor, "slug">): boolean {
  return clusterOf(c) === AI_SDR_CLUSTER;
}

/** The AI lead generation page's own competitors, in that order. */
export function aiLeadGenCompetitors(): Competitor[] {
  return clusterCompetitors(AI_LEAD_GEN_CLUSTER);
}

export function isAiLeadGenCluster(c: Pick<Competitor, "slug">): boolean {
  return clusterOf(c) === AI_LEAD_GEN_CLUSTER;
}

/** The cold email automation page's own competitors, in that order. */
export function coldEmailAutomationCompetitors(): Competitor[] {
  return clusterCompetitors(COLD_EMAIL_AUTOMATION_CLUSTER);
}

export function isColdEmailAutomationCluster(c: Pick<Competitor, "slug">): boolean {
  return clusterOf(c) === COLD_EMAIL_AUTOMATION_CLUSTER;
}

/** The GTM automation page's own competitors, in that order. */
export function gtmAutomationCompetitors(): Competitor[] {
  return clusterCompetitors(GTM_AUTOMATION_CLUSTER);
}

/** The GTM tools the GTM page sets side by side: its own cluster, then the ones compared on another page. */
export function gtmAutomationTableCompetitors(): Competitor[] {
  return [...gtmAutomationCompetitors(), ...GTM_AUTOMATION_ALSO.map((slug) => competitorBySlug(slug)).filter((c): c is Competitor => !!c)];
}

export function isGtmAutomationCluster(c: Pick<Competitor, "slug">): boolean {
  return clusterOf(c) === GTM_AUTOMATION_CLUSTER;
}

/** Where a competitor's comparison page is served. Every link to one reads this. */
export function competitorPath(c: Pick<Competitor, "slug">): string {
  const k = clusterOf(c);
  return k ? `${k.path}/vs/${c.slug}` : `/compare/${c.slug}`;
}

/** A cluster's own vs/alternatives links, listed in its page's footer and closing its FAQ. */
export function clusterCompareLinks(k: CompareCluster): { label: string; href: string }[] {
  return [
    ...clusterCompetitors(k).map((c) => ({ label: `distribute.you vs ${c.name}`, href: competitorPath(c) })),
    { label: `${k.name} alternatives`, href: clusterAlternativesPath(k) },
  ];
}

export function aiSdrCompareLinks(): { label: string; href: string }[] {
  return clusterCompareLinks(AI_SDR_CLUSTER);
}

export function aiLeadGenCompareLinks(): { label: string; href: string }[] {
  return clusterCompareLinks(AI_LEAD_GEN_CLUSTER);
}

export function coldEmailAutomationCompareLinks(): { label: string; href: string }[] {
  return clusterCompareLinks(COLD_EMAIL_AUTOMATION_CLUSTER);
}

export function gtmAutomationCompareLinks(): { label: string; href: string }[] {
  return clusterCompareLinks(GTM_AUTOMATION_CLUSTER);
}

/** Every path the cluster serves, for the sitemap and llms.txt. */
export function comparePaths(): string[] {
  return ["/compare", "/alternatives", ...COMPARE_CLUSTERS.map(clusterAlternativesPath), ...COMPETITORS.map(competitorPath)];
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

/** Same publishable token the homepage and the dashboard bundle carry. */
const LOGO_TOKEN = "pk_J1iY4__HSfm9acHjR8FibA";

/**
 * A competitor's logo, `size` px square. A white logo (`logoOnDark`) sits on a dark tile, else it
 * renders blank on a white page (Default on /gtm-automation, fixed PAGE-SIGNUP-AUTOMATION-1030).
 */
export function competitorLogo(c: Pick<Competitor, "domain" | "logoOnDark">, size = 40): string {
  const tile = c.logoOnDark
    ? ` style="background:#0a0a0a;border-radius:${Math.max(4, Math.round(size / 5))}px;padding:${Math.max(2, Math.round(size / 8))}px;box-sizing:border-box"`
    : "";
  return `<img src="https://img.logo.dev/${c.domain}?token=${LOGO_TOKEN}&size=${size * 2}&format=png" alt="" width="${size}" height="${size}"${tile}>`;
}
