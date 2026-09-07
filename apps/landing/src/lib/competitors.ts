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

export type Category = "cold-email-tool" | "ai-sdr" | "data-platform";

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

export const COMPARE_VERIFIED_LABEL = "September 2026";

/**
 * How WE answer each row. Stated once, so eleven pages cannot describe us eleven ways.
 * The fleet figures (hot leads, companies, median cost per hot lead) are NOT here: they
 * are the `__HOT_LEAD_BAND__` token static-html.ts resolves from the same read as the
 * homepage hero, so a compare page and the homepage cannot state two different fleets.
 */
export const DISTRIBUTE_ROW = {
  entryPrice: "From $1/day, first $30 free",
  pricingModel:
    "You set a daily budget and are charged what the campaign spent. No seat, no retainer, no term.",
  operatedBy: "Our agency runs it end to end",
  sendingDomains: "Domains and mailboxes we own and warm. Your domain never sends cold email.",
  leads: "We find and qualify the buyers from your website. Bring your own list as an extra audience if you like.",
  replies: "We read every reply and answer the interested ones until the meeting is booked.",
  channels: "Cold email today, more channels as they prove out, all measured the same way.",
  costPerMeeting: "Yes. What a hot lead and a meeting cost you is on your dashboard, and the fleet's median cost per hot lead is published on this page.",
  freeTier: "$30 of budget at signup, no card needed to see the plan.",
  contract: "None. Pause in one click, the daily budget is a hard cap.",
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
      "The cost of a sales interest is measured and shown, not left for you to work out from a sends counter.",
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
      { q: "Is distribute.you a cheaper Instantly?", a: "No. Instantly is software you run; distribute.you is an agency that runs the campaign for you. You never touch a mailbox, a domain or a sequence." },
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
      "Pay for what was spent, from $1/day, rather than a flat $99 whether the month was busy or quiet.",
      "The cost of a sales interest is measured on your account and published across ours.",
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
      { q: "Both are AI sales reps for founders. What is the difference?", a: "Gojiberry sells you an AI agent you configure and watch. distribute.you is an agency: we run the campaign, read the replies and book the meeting, and you see what each one cost." },
      { q: "Does distribute.you do LinkedIn?", a: "Not today. Cold email is the channel we run; new channels are added once we can measure them the same way." },
      { q: "Which is cheaper?", a: "It depends on volume. Gojiberry is $99 a month flat. distribute.you starts at $1 a day and charges what the campaign spent, so a quiet month costs less and a busy one costs what it bought." },
    ],
  },
  {
    slug: "explee",
    name: "Explee",
    domain: "explee.com",
    category: "ai-sdr",
    oneLiner: "AI agents that research a market, find prospects, write the emails and book demos, priced per email sent.",
    sourceUrl: "https://explee.com/pricing",
    verifiedOn: "2026-09-07",
    pricingModel: "Pay as you go per email for the outreach agent, subscriptions for the search product.",
    entryPrice: "$30 per 1,000 emails",
    prices: [
      { plan: "AutoGTM", price: "$30 per 1,000 emails", note: "Their estimate: 2 to 8 warm leads and 1 to 2 meetings per thousand" },
      { plan: "AI Search", price: "$49 to $490/month", note: "Prospect search and enrichment, Starter to Pro" },
      { plan: "Database", price: "$5 to $10 per 1,000 records", note: "Bulk company and people records" },
    ],
    operatedBy: "their AI agent",
    sendingDomains: "Pre-warmed domains they provide.",
    leads: "Found by the agent from their 536M-profile database.",
    replies: "Warm leads and booked demos surfaced to you.",
    channels: "Email.",
    costPerMeetingPublished: false,
    freeTier: "$30 in free credits.",
    contract: "None, pay as you go.",
    whereTheyWin: [
      "A very low price per email.",
      "A large search and enrichment product beside the outreach agent.",
      "Pre-warmed domains included, so nothing to set up.",
    ],
    whereWeWin: [
      "You pay for a campaign that reports what a sales interest cost, not for a count of emails.",
      "A person answers the interested replies and books the meeting.",
      "The price per outcome is measured across clients and published live.",
    ],
    chooseThemIf: [
      "You think in emails sent and want the lowest price per thousand.",
      "You want a prospect database and search product with the agent.",
    ],
    chooseUsIf: [
      "You think in meetings and want to know what one costs.",
      "You want a human in the loop from the first interested reply.",
    ],
    faq: [
      { q: "Both start with $30 free. Is the offer the same?", a: "Both give you $30 to start. Explee prices in emails sent, distribute.you in daily budget spent, and shows you what each sales interest cost." },
      { q: "Explee sends from pre-warmed domains too. What differs?", a: "Who runs it. Explee hands the agent to you. distribute.you runs the campaign as an agency and answers the interested replies until a meeting is booked." },
      { q: "Is $30 per 1,000 emails cheaper than distribute.you?", a: "Per email, yes. Per meeting, the honest answer is on your dashboard after the first weeks. We publish our clients' cost per sales interest so you can judge before you start." },
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
      "You are charged what the campaign spent, not a seat per person on the team.",
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
      { q: "Why is Apollo priced per user and distribute.you per day?", a: "Apollo sells software seats. distribute.you sells a campaign that runs on a daily budget, so the number of people on your side changes nothing." },
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
      "The cost of a sales interest is measured and published.",
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
      { q: "Agent Frank is an AI agent too. How is distribute.you different?", a: "Frank is software you configure at $499 a month. distribute.you is an agency that starts at $1 a day, runs the campaign on domains we own, and answers the interested replies." },
      { q: "Do I still need mailboxes with distribute.you?", a: "No. We send from mailboxes and domains we own and warm. Your domain never touches cold outreach." },
      { q: "Which costs less?", a: "For a team running its own outbound at volume, Salesforge's $40 or $80 plan is cheap software. For a founder who wants meetings without running anything, distribute.you charges what the campaign spent and shows what each sales interest cost." },
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
      "You can start today for $1 a day, without a demo or an annual contract.",
      "A price you can see, and a cost per sales interest measured on your account.",
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
      { q: "How much does 11x cost?", a: "They do not publish it. Pricing comes after a demo, on an annual contract. distribute.you publishes its model: from $1 a day, charged on what the campaign spent." },
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
    verifiedOn: "2026-09-07",
    pricingModel: "Monthly subscription by contacts and sends. Mailboxes are bought elsewhere.",
    entryPrice: "$39/month",
    prices: [
      { plan: "Base", price: "$39/month", note: "2,000 contacts, 6,000 emails a month, unlimited mailboxes" },
      { plan: "Pro", price: "$94/month", note: "30,000 contacts, 90,000 emails a month" },
      { plan: "Unlimited Smart", price: "$174/month", note: "Unlimited contacts, 150,000 emails a month" },
      { plan: "Unlimited Prime", price: "$379/month", note: "Unlimited contacts, 500,000 emails a month" },
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
      "A measured cost per sales interest instead of a sends counter.",
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
      { q: "Smartlead is $39 a month. How can distribute.you compete on price?", a: "Different things are being priced. $39 buys the sending software; you still buy mailboxes, a list and someone's time. distribute.you charges what the campaign spent and includes all of that." },
      { q: "I run an agency. Which should I use?", a: "If your team runs client outbound by hand, Smartlead's workspaces are made for you. If you want to resell outbound without staffing it, distribute.you runs each client brand as its own campaign." },
      { q: "Does distribute.you have a warmup pool?", a: "We warm the domains we own, on our side. There is no pool to join because you never send from your own mailboxes." },
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
      "The cost of a sales interest is measured and shown.",
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
      { q: "Is distribute.you cheaper than Lemlist?", a: "For one person, Lemlist is $69 a month plus your time. distribute.you starts at $1 a day and charges what the campaign spent, with the work included." },
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
      "You want one measured cost per sales interest, not a credit ledger.",
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
      "A published price: from $1 a day, charged on what was spent.",
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
      { q: "How much does Artisan cost?", a: "Their pricing page describes credit-based tiers without figures; a call sets the price. distribute.you starts at $1 a day and charges what the campaign spent." },
      { q: "Ava books meetings. So does distribute.you. What differs?", a: "Ava is an agent you license and steer. distribute.you is an agency: we run the campaign from our own domains and a person handles the interested replies with the model." },
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
      "From $1 a day instead of $250 a month, charged on what was spent.",
      "No quarterly commitment.",
      "The cost of a sales interest measured on your account and published across clients.",
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
      { q: "AiSDR's Solo plan is $250 a month. What does distribute.you cost for the same?", a: "There is no fixed volume to match. You set a daily budget from $1 and are charged what the campaign spent; the dashboard shows what each sales interest cost." },
      { q: "Do both handle infrastructure?", a: "Yes. AiSDR sets up and warms domains inside your plan. distribute.you sends from domains we own and warm, so nothing is set up in your name at all." },
      { q: "Is there a commitment with distribute.you?", a: "No. Pause in one click, and the daily budget is a hard cap." },
    ],
  },
];

export const CATEGORY_LABEL: Record<Category, string> = {
  "cold-email-tool": "Cold email software",
  "ai-sdr": "AI SDR agents",
  "data-platform": "Data platforms",
};

export function competitorBySlug(slug: string): Competitor | undefined {
  return COMPETITORS.find((c) => c.slug === slug);
}

/** Every path the cluster serves, for the sitemap and llms.txt. */
export function comparePaths(): string[] {
  return ["/compare", "/alternatives", ...COMPETITORS.map((c) => `/compare/${c.slug}`)];
}
