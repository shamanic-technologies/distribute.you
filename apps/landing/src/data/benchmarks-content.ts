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
    body: "Cold sales email is the highest-leverage channel for a founder who hasn't raised. SEO takes a year. Ads burn your runway. A tight ICP filter + a 3-step sequence + warmed inboxes gets you replies inside a week and customers inside a month. The industry average is 3.43% reply rate; top-quartile campaigns hit 15–25%. The gap is targeting, personalization, and deliverability — distribute runs all three on autopilot — your first $25 spent is matched in free credits.",
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
      body: "$25 free credits. Cancel anytime. The dashboard tracks cost per qualified reply per product so you can double down on the winner.",
    },
  ],
  ctaPrimary: {
    headline: "Launch your first cold campaign in 60 seconds",
    sub: "$25 free credits. Drop your URL. We pick the workflow that performs best for your ICP.",
    cta: "Start free — $25 free credits",
  },
  ctaClosing: {
    headline: "Ship more. Scale what works.",
    sub: "Pick the winning workflow from this leaderboard and clone it for your brand. $25 free credits to try, cancel anytime.",
    cta: "Launch on autopilot",
  },
};

// ─── Lookup ─────────────────────────────────────────────────────────────────

export const BENCHMARK_CONTENT: Record<string, BenchmarkContent> = {
  "sales-cold-email-outreach": SALES_COLD_EMAIL,
};

export function getBenchmarkContent(featureSlug: string): BenchmarkContent | null {
  return BENCHMARK_CONTENT[featureSlug] ?? null;
}
