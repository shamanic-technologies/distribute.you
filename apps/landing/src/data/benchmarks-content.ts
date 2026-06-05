// Bespoke content for each /benchmarks/[featureSlug] page.
// Each feature gets its own narrative — why this channel matters for our ICP
// (solo founders shipping multiple products), 4–5 sourced external studies,
// interleaved value recaps, and CTAs that mirror the landing-page voice.

export interface ExternalStudy {
  provider: string;
  /** Root domain for logo.dev avatar lookup. */
  providerDomain: string;
  /** Exact report / study title. */
  title: string;
  /** ONE compelling headline number with units. */
  headlineStat: string;
  /** Optional short pull quote (<200 chars). */
  quote?: string;
  url: string;
  year: number;
}

export interface ValueRecap {
  /** One-line headline (sentence case, no period). */
  headline: string;
  /** One short paragraph. */
  body: string;
}

export interface BenchmarkCTACopy {
  /** ≤8 words. */
  headline: string;
  /** One sentence. */
  sub: string;
  /** Button label. */
  cta: string;
}

export interface WhyMattersSection {
  eyebrow: string;
  title: string;
  body: string;
}

export interface BenchmarkContent {
  whyMatters: WhyMattersSection;
  studies: ExternalStudy[];
  /** Reminder cards interleaved between leaderboards. Keep to 3. */
  valueRecaps: ValueRecap[];
  /** Top-of-page CTA (after Platform averages, before brand leaderboard). */
  ctaPrimary: BenchmarkCTACopy;
  /** Closing CTA (after both leaderboards). */
  ctaClosing: BenchmarkCTACopy;
}

// ─── Sales Cold Email Outreach ──────────────────────────────────────────────

const SALES_COLD_EMAIL: BenchmarkContent = {
  whyMatters: {
    eyebrow: "Solo founder × cold sales",
    title: "Most of your first 100 customers come from a cold inbox",
    body: "Cold sales email is the highest-leverage channel for a founder who hasn't raised. SEO takes a year. Ads burn your runway. A tight ICP filter + a 3-step sequence + warmed inboxes gets you replies inside a week and customers inside a month. The industry average is 3.43% reply rate; top-quartile campaigns hit 15–25%. The gap is targeting, personalization, and deliverability — distribute runs all three on autopilot from $25 in welcome credits.",
  },
  studies: [
    {
      provider: "Instantly",
      providerDomain: "instantly.ai",
      title: "Cold Email Benchmark Report 2026",
      headlineStat: "3.43% average B2B cold email reply rate",
      quote: "Top performing 'elite' cold email campaigns exceed a 10% reply rate; top quartile achieve 5.5%; average reply rate is 3.43%.",
      url: "https://instantly.ai/cold-email-benchmark-report-2026",
      year: 2026,
    },
    {
      provider: "Hunter.io",
      providerDomain: "hunter.io",
      title: "State of Email Outreach 2026",
      headlineStat: "4.5% sequence reply rate across 31M emails analyzed",
      quote: "Sending from a custom domain delivers a +108% higher reply rate than freemail (5.2% vs 2.5%).",
      url: "https://hunter.io/the-state-of-cold-email",
      year: 2025,
    },
    {
      provider: "Saleshandy",
      providerDomain: "saleshandy.com",
      title: "Cold Email Statistics: 100M+ Emails Analyzed",
      headlineStat: "3–5 follow-ups double reply rate (8.3% vs 4.1%)",
      url: "https://www.saleshandy.com/blog/cold-email-statistics/",
      year: 2025,
    },
    {
      provider: "Smartlead",
      providerDomain: "smartlead.ai",
      title: "27 Cold Email Statistics You Need to Know",
      headlineStat: "Personalized sends see ~2.7× higher reply rates (14.3B emails analyzed)",
      url: "https://www.smartlead.ai/blog/cold-email-stats",
      year: 2025,
    },
    {
      provider: "Lavender",
      providerDomain: "lavender.ai",
      title: "Building Your Own Sales Email Benchmarks",
      headlineStat: "Personalized non-automated emails see 1,200% more replies",
      quote: "Emails scoring 90+ on Lavender get 3x more replies than emails scoring below 50.",
      url: "https://www.lavender.ai/blog/building-your-own-sales-email-benchmarks",
      year: 2024,
    },
  ],
  valueRecaps: [
    {
      headline: "Warmed inboxes from day one",
      body: "We send from agency-warmed sender pools. Skip the 3–5 weeks of warming Lemlist tells you about. Your first email lands in primary, not spam.",
    },
    {
      headline: "AI qualifies — you only see replies that matter",
      body: "Every reply runs through an LLM. Positive → forwarded to your Gmail. Negative + unsubscribes → handled. You sleep at night.",
    },
    {
      headline: "Real cost per positive reply, live",
      body: "$25 welcome credits. No subscription. The dashboard tracks cost per qualified reply per product so you can double down on the winner.",
    },
  ],
  ctaPrimary: {
    headline: "Launch your first cold campaign in 60 seconds",
    sub: "$25 welcome credits. Drop your URL. We pick the workflow that performs best for your ICP.",
    cta: "Start free — $25 credits",
  },
  ctaClosing: {
    headline: "Ship more. Scale what works.",
    sub: "Pick the winning workflow from this leaderboard and clone it for your brand. $25 credits to try, no subscription.",
    cta: "Launch on autopilot",
  },
};

// ─── PR Cold Email Outreach ─────────────────────────────────────────────────

const PR_COLD_EMAIL: BenchmarkContent = {
  whyMatters: {
    eyebrow: "Solo founder × media coverage",
    title: "You can earn press without a $5K/month PR retainer",
    body: "96% of journalists prefer pitches by email (Muck Rack). 86% reject pitches outside their beat instantly (Cision). The bottleneck isn't access — it's relevance, timing, and follow-through. distribute discovers the right outlets for your story, generates personalized pitches grounded in the journalist's recent coverage, and tracks every open so you know who's actually reading. From $25 in welcome credits.",
  },
  studies: [
    {
      provider: "Muck Rack",
      providerDomain: "muckrack.com",
      title: "The State of Journalism 2025",
      headlineStat: "96% of journalists prefer pitches by email",
      quote: "Email is the primary method journalists prefer to receive pitches.",
      url: "https://muckrack.com/resources/research/state-of-journalism",
      year: 2025,
    },
    {
      provider: "Cision",
      providerDomain: "cision.com",
      title: "2025 State of the Media Report",
      headlineStat: "86% reject off-beat pitches immediately",
      quote: "The best way to build a relationship is simple: introduce yourself via email — even without a story to pitch.",
      url: "https://www.cision.com/resources/guides-and-reports/2025-state-of-the-media-report/",
      year: 2025,
    },
    {
      provider: "Muck Rack",
      providerDomain: "muckrack.com",
      title: "The State of Journalism 2024",
      headlineStat: "83% of journalists want personalized email pitches",
      quote: "49% of journalists seldom or never respond to pitches; 79% cite irrelevance as the top reason.",
      url: "https://muckrack.com/research/state-of-journalism-2024",
      year: 2024,
    },
    {
      provider: "Muck Rack",
      providerDomain: "muckrack.com",
      title: "The State of PR 2025",
      headlineStat: "72% of PR pros cite low response rates as their #1 challenge",
      url: "https://muckrack.com/research/state-of-pr",
      year: 2025,
    },
    {
      provider: "Cision",
      providerDomain: "cision.com",
      title: "2024 State of the Media Report",
      headlineStat: "77% of journalists say spam pitches are the fastest way to get blocked",
      url: "https://www.cision.com/resources/guides-and-reports/2024-state-of-the-media-report/",
      year: 2024,
    },
  ],
  valueRecaps: [
    {
      headline: "Personalized at journalist resolution",
      body: "Every pitch is grounded in the journalist's last 3 articles. No mail-merge tags. The LLM writes one-to-one, not one-to-many.",
    },
    {
      headline: "On-beat, not in-bulk",
      body: "We match your story to journalists whose beat overlaps your angle. Saves you from being one of the 49% that get ignored.",
    },
    {
      headline: "Cost per published mention, tracked",
      body: "Open, reply, and published-coverage tracking per workflow. You see what works for press — same dashboard as your sales campaigns.",
    },
  ],
  ctaPrimary: {
    headline: "Pitch journalists who actually cover your space",
    sub: "$25 welcome credits. Drop your URL — we find on-beat journalists and pitch on your behalf.",
    cta: "Start PR — $25 credits",
  },
  ctaClosing: {
    headline: "Skip the PR retainer",
    sub: "Clone the best-performing PR workflow from this leaderboard. Earn coverage from $25 in credits, no agency lock-in.",
    cta: "Launch on autopilot",
  },
};

// ─── Hiring Cold Email Outreach ─────────────────────────────────────────────

const HIRING_COLD_EMAIL: BenchmarkContent = {
  whyMatters: {
    eyebrow: "Solo founder × first hires",
    title: "Sourced candidates are 5× more likely to be hired",
    body: "Inbound recruiting is a luxury you don't have yet. Solo founders hire by sourcing — cold outreach to candidates who match the role. Industry data: sourced applicants convert 5× better than inbound (Gem 2025), recruiter InMails average 13% response (LinkedIn), short-form messages under 400 characters get +22% replies. distribute runs the entire sourcing motion — find, message, follow up, qualify — on autopilot from $25.",
  },
  studies: [
    {
      provider: "Gem",
      providerDomain: "gem.com",
      title: "2025 Recruiting Benchmarks Report",
      headlineStat: "Sourced applicants are 5× more likely to be hired",
      url: "https://www.gem.com/resource/recruiting-benchmarks",
      year: 2025,
    },
    {
      provider: "Gem",
      providerDomain: "gem.com",
      title: "Recruiting Email Outreach Benchmarks, Fall 2024",
      headlineStat: "4-stage sequences get 2× more replies than one-offs",
      quote: "Sending on behalf of the hiring manager or senior leaders can improve replies by 50% or more.",
      url: "https://www.gem.com/resource/2024-recruiting-email-outreach-benchmarks",
      year: 2024,
    },
    {
      provider: "Ashby",
      providerDomain: "ashbyhq.com",
      title: "Talent Trends Report: Candidate Sourcing",
      headlineStat: "19.6% average reply rate across 500K+ sourcing sequences",
      quote: "Including more than three emails does not significantly improve overall reply rates, which plateau around 23%.",
      url: "https://www.ashbyhq.com/talent-trends-report/reports/candidate-sourcing",
      year: 2024,
    },
    {
      provider: "LinkedIn",
      providerDomain: "linkedin.com",
      title: "How InMail Response Rates Compare Across Industries",
      headlineStat: "13% average InMail response rate; individually-sent +15% vs bulk",
      url: "https://www.linkedin.com/business/talent/blog/talent-engagement/how-inmail-response-rates-compare-across-industries-and-functions",
      year: 2024,
    },
    {
      provider: "LinkedIn",
      providerDomain: "linkedin.com",
      title: "Best-Performing InMail Lengths",
      headlineStat: "InMails under 400 chars get +22% replies vs global average",
      url: "https://www.linkedin.com/business/talent/blog/talent-strategy/these-inmails-get-best-response-rates",
      year: 2024,
    },
  ],
  valueRecaps: [
    {
      headline: "From-the-founder voice, automatically",
      body: "Candidates respond 50% more when the email is from a hiring manager, not a recruiter. We write in your voice and send from your domain.",
    },
    {
      headline: "Three emails, max",
      body: "Replies plateau at 3 follow-ups. We stop at the right point — no nagging, no burned candidates for the next role.",
    },
    {
      headline: "Replies sorted by interest",
      body: "AI tags each reply: interested / not now / not interested. Only the interested ones land in your inbox. Saves your morning.",
    },
  ],
  ctaPrimary: {
    headline: "Source your first hire in 48 hours",
    sub: "$25 welcome credits. Tell us the role — we find matching candidates and send your first batch tonight.",
    cta: "Start hiring — $25 credits",
  },
  ctaClosing: {
    headline: "First 5 hires. From your inbox.",
    sub: "Clone the best hiring workflow from this leaderboard. Solo-founder-friendly pricing, no per-seat fees.",
    cta: "Launch on autopilot",
  },
};

// ─── VC Cold Email Outreach ─────────────────────────────────────────────────

const VC_COLD_EMAIL: BenchmarkContent = {
  whyMatters: {
    eyebrow: "Solo founder × fundraising",
    title: "Cold-to-VC is harder than warm — but it scales",
    body: "Cold pitch decks convert to a meeting 3–5% of the time vs 40–50% for warm intros (DocSend 2024). The fix isn't 'get warmer' — it's volume × precision. Target VCs by stage, sector thesis, and check size, hit 50–100 of them with a deck designed to read in 2:31 minutes, and you'll find the 3–5 that say yes. distribute filters by thesis, sequences the outreach, and tracks every deck-open per VC so you know who's interested.",
  },
  studies: [
    {
      provider: "DocSend",
      providerDomain: "docsend.com",
      title: "2024 Funding Divide Report",
      headlineStat: "Cold decks meet 3–5% vs 40–50% for warm intros",
      quote: "Cold decks have an average reading time of 2 minutes 31 seconds; warm decks 4 minutes 18 seconds.",
      url: "https://www.docsend.com/blog/docsends-2024-funding-divide-report-the-gap-for-underrepresented-founders-widens/",
      year: 2024,
    },
    {
      provider: "Carta",
      providerDomain: "carta.com",
      title: "State of Pre-Seed: 2024 in review",
      headlineStat: "Solo-founded startups = 35% of US startups but only 17% of VC-funded",
      url: "https://carta.com/data/state-of-pre-seed-2024/",
      year: 2025,
    },
    {
      provider: "DocSend",
      providerDomain: "docsend.com",
      title: "Investor Engagement Hits Q1 Record High",
      headlineStat: "Investor pitch deck interactions rose 19.2% YoY in Q1 2024",
      url: "https://www.prnewswire.com/news-releases/investor-activity-surpasses-2021-engagement-levels-hits-q1-record-high-according-to-docsend-2024-data-302113696.html",
      year: 2024,
    },
    {
      provider: "CB Insights",
      providerDomain: "cbinsights.com",
      title: "State of Venture 2024",
      headlineStat: "Median seed valuation hit $13.5M in 2024 — all-time high",
      url: "https://www.cbinsights.com/research/report/venture-trends-2024/",
      year: 2024,
    },
    {
      provider: "PitchBook-NVCA",
      providerDomain: "pitchbook.com",
      title: "Q4 2024 Venture Monitor",
      headlineStat: "~30% of 2024 US VC investments went to AI companies",
      url: "https://pitchbook.com/news/reports/q4-2024-pitchbook-nvca-venture-monitor",
      year: 2025,
    },
  ],
  valueRecaps: [
    {
      headline: "Thesis-matched, not blast-listed",
      body: "We filter the partner-level VC database by stage, sector, geo, and check size. You pitch only investors whose thesis your round actually fits.",
    },
    {
      headline: "Deck-open tracking per investor",
      body: "Know which partner re-opened your deck three times. Follow up with the warm ones first. Don't waste cycles on the cold ones.",
    },
    {
      headline: "Sequenced — not spammy",
      body: "Three touchpoints over 14 days. We stop the moment a partner replies positively, and forward the reply straight to your inbox.",
    },
  ],
  ctaPrimary: {
    headline: "Run a structured raise from your inbox",
    sub: "$25 welcome credits. Tell us your stage and sector — we'll pitch the matching partners for you.",
    cta: "Start fundraise — $25 credits",
  },
  ctaClosing: {
    headline: "Cold beats warm at volume.",
    sub: "Clone the best VC-outreach workflow on this leaderboard. Same dashboard tracks every deck-open, every reply.",
    cta: "Launch on autopilot",
  },
};

// ─── Accelerators Cold Email Outreach ───────────────────────────────────────

const ACCELERATORS_COLD_EMAIL: BenchmarkContent = {
  whyMatters: {
    eyebrow: "Solo founder × accelerator strategy",
    title: "YC takes <1%. The other 200 accelerators want you.",
    body: "Y Combinator takes ~260 of 27,000+ applicants per batch (<1%). Techstars + 200 other accelerators run on rolling cycles with much higher acceptance rates — but you have to know about them and apply on time. distribute tracks every accelerator deadline, generates a tailored cold pitch per program, and books partner calls before applications even open. From $25 in welcome credits.",
  },
  studies: [
    {
      provider: "Y Combinator",
      providerDomain: "ycombinator.com",
      title: "Meet the YC Winter 2024 Batch",
      headlineStat: "260 of 27,000+ applicants accepted (<1%)",
      url: "https://www.ycombinator.com/blog/meet-the-yc-winter-2024-batch",
      year: 2024,
    },
    {
      provider: "Y Combinator",
      providerDomain: "ycombinator.com",
      title: "Announcing YC Spring 2025",
      headlineStat: "144 companies — YC's first ever spring batch under 4-cohort model",
      url: "https://www.ycombinator.com/blog/announcing-yc-x25",
      year: 2025,
    },
    {
      provider: "Techstars",
      providerDomain: "techstars.com",
      title: "Spotlight on Techstars Spring 2024",
      headlineStat: "268 companies funded via 23 accelerators in one term",
      quote: "36% of companies across industry verticals are leveraging artificial intelligence in some capacity.",
      url: "https://www.techstars.com/newsroom/spotlight-on-techstars-spring-2024-class",
      year: 2024,
    },
    {
      provider: "Techstars",
      providerDomain: "techstars.com",
      title: "Techstars Shifts to Two-Term Schedule",
      headlineStat: "250+ portfolio companies welcomed in Spring 2024 term",
      url: "https://www.techstars.com/blog/innovation-in-action/two-term-schedule",
      year: 2024,
    },
    {
      provider: "DocSend",
      providerDomain: "docsend.com",
      title: "2024 Funding Divide Report",
      headlineStat: "Accelerators are one of the fastest paths to a warm VC intro",
      url: "https://www.docsend.com/blog/docsends-2024-funding-divide-report-the-gap-for-underrepresented-founders-widens/",
      year: 2024,
    },
  ],
  valueRecaps: [
    {
      headline: "Every deadline, on your calendar",
      body: "We track ~200 accelerator application windows. You get a heads-up two weeks before each one matches your stage.",
    },
    {
      headline: "Pitches tuned per program thesis",
      body: "Same company, different framing per accelerator. YC wants traction. Vertical accelerators want domain depth. We adapt the pitch.",
    },
    {
      headline: "Reply triage to your inbox",
      body: "Partner calls, follow-up requests, and rejections sorted by signal strength. Spend zero time managing the funnel.",
    },
  ],
  ctaPrimary: {
    headline: "Apply to the right accelerators this cycle",
    sub: "$25 welcome credits. Tell us your stage — we'll match you to the programs that fit.",
    cta: "Start applying — $25 credits",
  },
  ctaClosing: {
    headline: "The 199 accelerators that aren't YC.",
    sub: "Clone the best accelerator-outreach workflow on this leaderboard. Get into the program that fits your trajectory.",
    cta: "Launch on autopilot",
  },
};

// ─── PR Expert Quote Outreach ───────────────────────────────────────────────

const PR_EXPERT_QUOTE: BenchmarkContent = {
  whyMatters: {
    eyebrow: "Solo founder × earned authority",
    title: "Earn editorial backlinks while you sleep",
    body: "Featured.com (formerly HARO) sends ~3 daily emails with journalist quote requests. 75,000+ journalists use it. 50,000+ experts contribute. Speed matters: replies sent within 15–60 minutes have dramatically higher conversion than later ones. distribute monitors every quote request, drafts a reply in your voice grounded in your company context, and submits within minutes — so you build authority without checking your inbox.",
  },
  studies: [
    {
      provider: "Featured",
      providerDomain: "featured.com",
      title: "Featured for Experts",
      headlineStat: "50,000+ experts contribute across 2,500+ publications",
      url: "https://featured.com/expert",
      year: 2025,
    },
    {
      provider: "HARO",
      providerDomain: "helpareporter.com",
      title: "Help A Reporter Out: Sources Overview",
      headlineStat: "75,000+ journalists use HARO via 3 daily emails",
      quote: "If you're not in the first 50 responses, your chances drop fast. The highest conversion came from replies sent within 15 to 60 minutes.",
      url: "https://www.helpareporter.com/sources",
      year: 2025,
    },
    {
      provider: "Muck Rack",
      providerDomain: "muckrack.com",
      title: "The State of Journalism 2025",
      headlineStat: "63% of journalists value PR pros who connect them to relevant sources",
      quote: "Reporters want pitches grounded in reality — anchored by verified sources, third-party data, and credible SMEs.",
      url: "https://muckrack.com/resources/research/state-of-journalism",
      year: 2025,
    },
    {
      provider: "Featured",
      providerDomain: "featured.com",
      title: "How to Get Your Quote Selected For Publication",
      headlineStat: "AI ranks expert answers by quality + uniqueness before publishers select",
      url: "https://blog.featured.com/how-to-get-your-quote-published/",
      year: 2024,
    },
  ],
  valueRecaps: [
    {
      headline: "Sub-hour response, every time",
      body: "We watch every Featured.com request. When one matches your expertise, we draft and submit in under 30 minutes — faster than 99% of experts.",
    },
    {
      headline: "Quotes that sound like you",
      body: "The LLM is grounded in your bio, company context, and prior quotes. No generic LinkedIn-influencer voice.",
    },
    {
      headline: "Published backlinks, tracked",
      body: "When your quote runs, we detect the URL, log the DR of the publisher, and track the backlink to your domain.",
    },
  ],
  ctaPrimary: {
    headline: "Build authority on autopilot",
    sub: "$25 welcome credits. Tell us your expertise — we monitor every quote request and submit on your behalf.",
    cta: "Start quotes — $25 credits",
  },
  ctaClosing: {
    headline: "Press without a publicist.",
    sub: "Clone the best quote-outreach workflow on this leaderboard. Editorial backlinks, on autopilot, from $25.",
    cta: "Launch on autopilot",
  },
};

// ─── Outlet Database Discovery ──────────────────────────────────────────────

const OUTLET_DISCOVERY: BenchmarkContent = {
  whyMatters: {
    eyebrow: "Solo founder × media list building",
    title: "A 10-contact media list beats a 200-contact blast",
    body: "Prezly's 2025 data: pitches to lists of 1–10 contacts earn 5× the click-through rate of sends to 200+ (19.3% vs 3.6%). Quality of fit > volume of contacts. distribute discovers outlets that actually cover your industry, geography, and PR angle — not a generic database export. You start with a small, ridiculously well-matched list and earn coverage from the publications that move your needle.",
  },
  studies: [
    {
      provider: "Prezly",
      providerDomain: "prezly.com",
      title: "2025 PR Performance Report",
      headlineStat: "Pitches to 1–10 contacts: 5× the CTR of 200+ contact sends",
      quote: "Pitches sent to lists of 1 contact achieve a 19.3% click-through rate; lists of 200+ achieve 3.6%.",
      url: "https://www.prezly.com/insights",
      year: 2025,
    },
    {
      provider: "Muck Rack",
      providerDomain: "muckrack.com",
      title: "The State of PR 2025",
      headlineStat: "62% of PR pros report shrinking media lists in their relevant beats",
      url: "https://muckrack.com/research/state-of-pr",
      year: 2025,
    },
    {
      provider: "Cision",
      providerDomain: "cision.com",
      title: "2025 State of the Media Report",
      headlineStat: "3,016 journalists across 19 markets surveyed; 86% reject off-beat pitches",
      quote: "Relevance Rules — APAC Journalists Have a Type, It's Called Relevant.",
      url: "https://www.cision.com/resources/guides-and-reports/2025-state-of-the-media-report/",
      year: 2025,
    },
    {
      provider: "Prowly",
      providerDomain: "prowly.com",
      title: "Best Media Database in 2025",
      headlineStat: "Modern databases cover 1M+ journalist contacts with live traffic data",
      url: "https://prowly.com/magazine/best-media-database/",
      year: 2025,
    },
  ],
  valueRecaps: [
    {
      headline: "Industry × geo × angle, all three filters",
      body: "We search by what your story actually is — not by a static category dropdown. The list is small and relevant by design.",
    },
    {
      headline: "Refreshed per campaign",
      body: "Old PR databases rot. We re-search the web every time you launch — journalists move, beats change, outlets fold.",
    },
    {
      headline: "Ready to pitch in one click",
      body: "The discovered list flows straight into PR Cold Email Outreach. Discover and send without leaving the dashboard.",
    },
  ],
  ctaPrimary: {
    headline: "Build a 10-outlet media list in 60 seconds",
    sub: "$25 welcome credits. Tell us your industry — we surface the outlets that actually cover your space.",
    cta: "Find outlets — $25 credits",
  },
  ctaClosing: {
    headline: "Stop sending to 200. Start sending to 10.",
    sub: "Clone the best discovery workflow on this leaderboard. A small, sharp list beats every PR database export.",
    cta: "Launch on autopilot",
  },
};

// ─── Press Kit Page Generation ──────────────────────────────────────────────

const PRESS_KIT: BenchmarkContent = {
  whyMatters: {
    eyebrow: "Solo founder × media-ready",
    title: "87% of journalists use the multimedia you supply",
    body: "When a journalist decides to cover you, they need assets in 15 minutes: hero shot, founder bio, logos, screenshots, one-line description, contact. Cision: 87% of journalists use multimedia assets supplied with pitches. Business Wire: press releases with video get 55.4% more views, 36.1% more click-throughs. distribute generates a press kit page with assets, bios, and contact in one click — so when a reporter says yes, the link is already in your reply.",
  },
  studies: [
    {
      provider: "Cision",
      providerDomain: "cision.com",
      title: "2024 State of the Media Report",
      headlineStat: "87% of journalists use multimedia assets supplied with pitches",
      quote: "Multimedia assets are being leveraged by the media more than ever.",
      url: "https://www.cision.com/resources/guides-and-reports/2024-state-of-the-media-report/",
      year: 2024,
    },
    {
      provider: "Cision",
      providerDomain: "cision.com",
      title: "2025 State of the Media Report",
      headlineStat: "70% of journalists say images increase reader interest",
      url: "https://www.cision.com/resources/guides-and-reports/2025-state-of-the-media-report/",
      year: 2025,
    },
    {
      provider: "Business Wire",
      providerDomain: "businesswire.com",
      title: "Multimedia Boosts Press Release Performance",
      headlineStat: "Releases with video: +55.4% views, +36.1% link clicks vs no multimedia",
      quote: "Making multimedia interactive can engage audiences 30–50% more than traditional news releases.",
      url: "https://www.businesswire.com/services/press-releases/multimedia",
      year: 2024,
    },
    {
      provider: "PR Newswire",
      providerDomain: "prnewswire.com",
      title: "2024 State of the Press Release Report",
      headlineStat: "88% of PR pros use multimedia to enhance press releases",
      url: "https://www.prnewswire.com/resources/white-papers/2024-state-of-the-press-release-report/",
      year: 2024,
    },
    {
      provider: "Prezly",
      providerDomain: "prezly.com",
      title: "2025 PR Performance Report",
      headlineStat: "Owned newsroom content earns 450× more AI citations than syndicated PR",
      quote: "65% of newsroom traffic comes from search, 29% direct, 5% social, 1% from AI tools like ChatGPT, Claude, and Perplexity.",
      url: "https://www.prezly.com/insights",
      year: 2025,
    },
  ],
  valueRecaps: [
    {
      headline: "Generated from your URL",
      body: "We extract logos, screenshots, the founder bio, and one-line description from your live site. No design brief, no agency.",
    },
    {
      headline: "Hosted, indexed, AI-searchable",
      body: "Each press kit lives on its own page — the same SEO structure that earns 450× more AI citations than syndicated PR per Prezly.",
    },
    {
      headline: "One link in every pitch",
      body: "Already used by PR Cold Email Outreach + PR Expert Quote Outreach. Reporters get the assets without asking.",
    },
  ],
  ctaPrimary: {
    headline: "Generate your press kit page in one click",
    sub: "$25 welcome credits. Drop your URL — we build a media-ready kit and host it.",
    cta: "Generate kit — $25 credits",
  },
  ctaClosing: {
    headline: "Be reporter-ready before they ask.",
    sub: "Clone the best press-kit workflow on this leaderboard. Assets, bios, and contact in one hosted page.",
    cta: "Launch on autopilot",
  },
};

// ─── AI Visibility Scoring ──────────────────────────────────────────────────

const AI_VISIBILITY: BenchmarkContent = {
  whyMatters: {
    eyebrow: "Solo founder × AI search",
    title: "Your next 1,000 customers will ask ChatGPT before Google",
    body: "Generative AI referral traffic to retail sites is up 1,200% YoY (Adobe, 2025). Gartner expects search engine volume to drop 25% by 2026 as users shift to ChatGPT, Claude, Perplexity, Gemini. The brands those models mention by name capture the demand; the ones they don't, lose it silently. distribute audits how often your brand shows up in answers, what share-of-voice you have vs competitors, and which prompts surface you — so you can fix what's missing.",
  },
  studies: [
    {
      provider: "Adobe",
      providerDomain: "adobe.com",
      title: "Traffic from Generative AI Sources Jumps 1,200%",
      headlineStat: "GenAI referral traffic to US retail: +1,200% YoY (Feb 2025)",
      quote: "92% said it enhanced their experience, with 87% saying they are more likely to use AI for larger or more complex purchases.",
      url: "https://blog.adobe.com/en/publish/2025/03/17/adobe-analytics-traffic-to-us-retail-websites-from-generative-ai-sources-jumps-1200-percent",
      year: 2025,
    },
    {
      provider: "Pew Research",
      providerDomain: "pewresearch.org",
      title: "Google AI Summaries Cut Click-Throughs in Half",
      headlineStat: "CTR halves with AI Overview: 8% vs 15% (Pew, 2025)",
      quote: "Google users who encounter an AI summary are less likely to click on links to other websites than users who do not see one.",
      url: "https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/",
      year: 2025,
    },
    {
      provider: "Semrush",
      providerDomain: "semrush.com",
      title: "AI Overviews Study: 10M+ Keywords Analyzed",
      headlineStat: "AI Overviews appeared on up to 24.6% of queries at July 2025 peak",
      quote: "The growth and volatility of AI Overviews means marketing teams can no longer rely on traditional search rankings alone.",
      url: "https://www.semrush.com/blog/semrush-ai-overviews-study/",
      year: 2025,
    },
    {
      provider: "BrightEdge",
      providerDomain: "brightedge.com",
      title: "ChatGPT Brand Mentions vs Citations",
      headlineStat: "Mentions outpace citations 3.2×; commercial queries 4–8× higher",
      quote: "Mentions are the new frontier of AI visibility. While citations remain unstable, mentions reveal how ChatGPT 'trusts' brands enough to recommend them.",
      url: "https://www.brightedge.com/resources/weekly-ai-search-insights/chatgpt-brand-mentions-vs-citations-what-triggers-visibility",
      year: 2025,
    },
    {
      provider: "Ahrefs",
      providerDomain: "ahrefs.com",
      title: "How to Earn LLM Citations",
      headlineStat: "Only 11% of domains are cited by both ChatGPT and Perplexity",
      quote: "80% of LLM citations don't rank in Google's top 100. When an AI cites your content, it's essentially telling users: 'This source is reliable enough to stake my answer on.'",
      url: "https://ahrefs.com/blog/llm-citations/",
      year: 2025,
    },
    {
      provider: "Gartner",
      providerDomain: "gartner.com",
      title: "Search Engine Volume to Drop 25% by 2026",
      headlineStat: "Traditional search volume projected −25% by 2026",
      url: "https://www.gartner.com/en/newsroom/press-releases/2024-02-19-gartner-predicts-search-engine-volume-will-drop-25-percent-by-2026-due-to-ai-chatbots-and-other-virtual-agents",
      year: 2024,
    },
    {
      provider: "Bain & Company",
      providerDomain: "bain.com",
      title: "Executive Survey: AI Moves from Pilots to Production",
      headlineStat: "95% of US companies use generative AI (Bain, 2025)",
      url: "https://www.bain.com/insights/executive-survey-ai-moves-from-pilots-to-production/",
      year: 2025,
    },
  ],
  valueRecaps: [
    {
      headline: "Mention rate, share-of-voice, average position",
      body: "Track every key metric AI search rewards. Across ChatGPT, Claude, Perplexity, Gemini. One dashboard, weekly snapshot.",
    },
    {
      headline: "Competitor delta, every week",
      body: "See which of your 3–7 competitors gets mentioned more often, by which model, on which prompts. Close the gap one prompt at a time.",
    },
    {
      headline: "Audit, then act",
      body: "When you spot a prompt where you should appear and don't, the dashboard suggests the content + PR moves to fix it — and you can launch them from the same place.",
    },
  ],
  ctaPrimary: {
    headline: "See if ChatGPT recommends your brand",
    sub: "$25 welcome credits. Drop your URL — we audit your AI visibility across 4 major answer engines.",
    cta: "Run audit — $25 credits",
  },
  ctaClosing: {
    headline: "Be the brand the model picks.",
    sub: "Clone the best AI-visibility workflow on this leaderboard. Track mention rate, share-of-voice, and competitor delta weekly.",
    cta: "Launch on autopilot",
  },
};

// ─── Lookup ─────────────────────────────────────────────────────────────────

export const BENCHMARK_CONTENT: Record<string, BenchmarkContent> = {
  "sales-cold-email-outreach": SALES_COLD_EMAIL,
  "pr-cold-email-outreach": PR_COLD_EMAIL,
  "hiring-cold-email-outreach": HIRING_COLD_EMAIL,
  "vc-cold-email-outreach": VC_COLD_EMAIL,
  "accelerators-cold-email-outreach": ACCELERATORS_COLD_EMAIL,
  "pr-expert-quote-outreach": PR_EXPERT_QUOTE,
  "outlet-database-discovery": OUTLET_DISCOVERY,
  "press-kit-page-generation": PRESS_KIT,
  "ai-visibility-scoring": AI_VISIBILITY,
};

export function getBenchmarkContent(featureSlug: string): BenchmarkContent | null {
  return BENCHMARK_CONTENT[featureSlug] ?? null;
}
