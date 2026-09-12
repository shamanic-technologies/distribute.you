import { z } from "zod";

const API_URL = process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID || "171095";
const POSTHOG_API_HOST = normalizePostHogHost(
  process.env.POSTHOG_API_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.posthog.com",
);
const CLERK_API_URL = "https://api.clerk.com/v1";
const CLERK_API_VERSION = "2025-11-10";

const usersStatsSchema = z.object({
  totalOrgs: z.number(),
  totalUsers: z.number(),
  monthlyGrowth: z.array(z.object({
    month: z.string(),
    newOrgs: z.number(),
    newUsers: z.number(),
  })),
});

const billingGrowthRowSchema = z.object({
  period: z.string(),
  credited_cents: z.string(),
  revenue_cents: z.string(),
  // How many distinct accounts PAID in this period, and how many were paying for
  // the FIRST time — across every acquirer, not only the one stripe-service is
  // named after. Required, matching the producer: a rollback that stops serving
  // them must fail loud here rather than silently blank the paid-users charts.
  paying_accounts: z.number(),
  first_time_paying_accounts: z.number(),
});

// CASH COLLECTED, the money twin of the usage-consumed revenue the fleet stats
// report. billing-service composes it from stripe-service, which mirrors every
// acquirer we take money through, not only the one it is named after:
//   total_paid_cents      GROSS charged (a settled payment is never mutated
//                         when money goes back, so this alone over-reports by
//                         exactly what was returned)
//   total_returned_cents  settled refunds + LOST disputes
//   total_revenue_cents   NET = paid − returned. This is what we keep.
// The growth rows carry the same net figure per period (`revenue_cents`), with a
// return attributed to the period it HAPPENED in, so a past bucket is never
// rewritten — and a period whose refunds exceed its charges is legitimately
// negative. `total_returned_cents` was previously absent from this schema, so
// Zod stripped it and the refunded amount was invisible on the Revenue view.
const billingStatsSchema = z.object({
  total_accounts: z.number(),
  accounts_with_payment_method: z.number(),
  total_credited_cents: z.string(),
  total_paid_cents: z.string(),
  total_revenue_cents: z.string(),
  total_returned_cents: z.string(),
  total_local_credits_cents: z.string(),
  /**
   * Distinct accounts that have EVER paid, every acquirer. Distinct from
   * `accounts_with_payment_method`, which the producer documents as Stripe-only
   * and which counts a card on file rather than a payment: in production they
   * read 33 and 31, and neither is a subset of the other.
   */
  total_paying_accounts: z.number(),
  monthly_growth: z.array(billingGrowthRowSchema),
  weekly_growth: z.array(billingGrowthRowSchema),
});

const runsStatsSchema = z.object({
  byStatus: z.object({
    completed: z.number(),
    failed: z.number(),
    running: z.number(),
  }),
  totalCostInUsdCents: z.string(),
  monthly: z.array(z.object({
    month: z.string(),
    completed: z.number(),
    failed: z.number(),
    running: z.number(),
    totalCostInUsdCents: z.string(),
  })),
  weekly: z.array(z.object({
    period: z.string(),
    completed: z.number(),
    failed: z.number(),
    running: z.number(),
    totalCostInUsdCents: z.string(),
  })),
});

const clerkUserCountSchema = z.object({
  object: z.literal("total_count"),
  total_count: z.number(),
});

export type UsersStats = z.infer<typeof usersStatsSchema>;
export type BillingStats = z.infer<typeof billingStatsSchema>;
export type RunsStats = z.infer<typeof runsStatsSchema>;

export type PublicAnalyticsView =
  | "overview"
  | "landing"
  | "signups"
  | "active-users"
  | "cards"
  | "revenue";

/**
 * One day of the public funnel. Carries NO paid-user leg: who paid is money,
 * and money is answered by the billing stats (every acquirer, bucketed by the
 * producer), never derived here from saved Stripe cards.
 */
export interface DailyFunnelPoint {
  date: string;
  landingVisitors: number;
  signups: number;
  signupConversionPct: number;
}

export interface TrafficSource {
  source: string;
  visitors: number;
  sharePct: number;
}

/**
 * `[month, count]` rows: how many people reached a funnel stage for the FIRST
 * time in that month. Accumulated, these give the distinct population at any
 * point — which is what an avg-revenue-per-X divides by. Summing a per-month
 * `uniq()` instead counts the same person once per month they came back.
 */
export type FirstSeenMonthRow = [string, number];

export interface PublicStats {
  users: UsersStats;
  billing: BillingStats;
  runs: RunsStats;
  landingVisitors: number;
  signupEvents: number;
  timeline: DailyFunnelPoint[];
  trafficSources: TrafficSource[];
  /** Visitors by the month of their first-ever session on the landing. */
  visitorFirstSeenMonths: FirstSeenMonthRow[];
  /** Signups by the month each user first completed signup. */
  signupFirstSeenMonths: FirstSeenMonthRow[];
  /**
   * Distinct visitors and signups over the trailing 30- and 90-day windows.
   *
   * Read DISTINCT over each window rather than summed off the daily series: those
   * rows are `uniq()` per day, so adding 30 of them counts a person once per day
   * they came back. Empty on every view but the Overview, which is the only one
   * that states a windowed funnel.
   */
  windows: FunnelWindowTotals | null;
  updatedAt: string;
}

/** Distinct counts over the trailing windows the Overview's funnel is stated over. */
export interface FunnelWindowTotals {
  visitors30d: number;
  visitors90d: number;
  signups30d: number;
  signups90d: number;
}

const posthogQueryResponseSchema = z.object({
  results: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
});

async function fetchPublicStats<T>(path: string, schema: z.ZodSchema<T>): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`[public-stats] ${path} failed: ${res.status} ${res.statusText}`);
  }

  const data: unknown = await res.json();
  return schema.parse(data);
}

async function fetchClerkUserCount(): Promise<number> {
  const secretKey = requireEnv("CLERK_SECRET_KEY");
  const res = await fetch(`${CLERK_API_URL}/users/count`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${secretKey}`,
      "Clerk-API-Version": CLERK_API_VERSION,
    },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`[public-stats] Clerk /users/count failed: ${res.status} ${res.statusText}`);
  }

  const data: unknown = await res.json();
  return clerkUserCountSchema.parse(data).total_count;
}

function normalizePostHogHost(host: string): string {
  return host.replace("https://eu.i.posthog.com", "https://eu.posthog.com").replace(/\/$/, "");
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[public-stats] ${name} is required`);
  return value;
}

function asString(value: string | number | null, context: string): string {
  if (typeof value !== "string") throw new Error(`[public-stats] ${context} expected string`);
  return value;
}

function asNumber(value: string | number | null, context: string): number {
  if (typeof value !== "number") throw new Error(`[public-stats] ${context} expected number`);
  return value;
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

async function posthogQuery(query: string): Promise<Array<Array<string | number | null>>> {
  const personalApiKey = requireEnv("POSTHOG_PERSONAL_API_KEY");
  const res = await fetch(`${POSTHOG_API_HOST}/api/projects/${POSTHOG_PROJECT_ID}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${personalApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`[public-stats] PostHog query failed: ${res.status} ${res.statusText}`);
  }

  const data: unknown = await res.json();
  return posthogQueryResponseSchema.parse(data).results;
}

async function fetchLandingDaily(): Promise<Map<string, number>> {
  const rows = await posthogQuery(`
    SELECT
      formatDateTime(\`$start_timestamp\`, '%Y-%m-%d') AS day,
      uniq(distinct_id) AS visitors
    FROM sessions
    WHERE \`$entry_hostname\` = 'distribute.you'
    GROUP BY day
    ORDER BY day ASC
    LIMIT 500
  `);
  return new Map(rows.map((row) => [asString(row[0], "landing day"), asNumber(row[1], "landing visitors")]));
}

async function fetchLandingUniqueVisitors(): Promise<number> {
  const rows = await posthogQuery(`
    SELECT
      uniq(distinct_id) AS visitors
    FROM sessions
    WHERE \`$entry_hostname\` = 'distribute.you'
  `);
  const row = rows[0];
  if (!row) throw new Error("[public-stats] landing unique visitors query returned no rows");
  return asNumber(row[0], "landing unique visitors");
}

/**
 * Visitors bucketed by the month of their FIRST session — the entrant series the
 * avg-revenue-per-visitor denominator accumulates. `min($start_timestamp)` per
 * `distinct_id` is what makes each person land in exactly one month; a per-month
 * `uniq()` would count a returning visitor again in every month they came back.
 */
async function fetchVisitorFirstSeenMonths(): Promise<FirstSeenMonthRow[]> {
  const rows = await posthogQuery(`
    SELECT month, count() AS visitors
    FROM (
      SELECT
        distinct_id,
        formatDateTime(min(\`$start_timestamp\`), '%Y-%m') AS month
      FROM sessions
      WHERE \`$entry_hostname\` = 'distribute.you'
      GROUP BY distinct_id
    )
    GROUP BY month
    ORDER BY month ASC
    LIMIT 500
  `);
  return rows.map((row) => [
    asString(row[0], "visitor first-seen month"),
    asNumber(row[1], "visitor first-seen count"),
  ]);
}

/** Signups bucketed by the month each user FIRST completed signup (same rule as visitors). */
async function fetchSignupFirstSeenMonths(): Promise<FirstSeenMonthRow[]> {
  const rows = await posthogQuery(`
    SELECT month, count() AS signups
    FROM (
      SELECT
        if(notEmpty(properties['$user_id']), properties['$user_id'], distinct_id) AS person,
        formatDateTime(min(timestamp), '%Y-%m') AS month
      FROM events
      WHERE event = 'signup_completed'
      GROUP BY person
    )
    GROUP BY month
    ORDER BY month ASC
    LIMIT 500
  `);
  return rows.map((row) => [
    asString(row[0], "signup first-seen month"),
    asNumber(row[1], "signup first-seen count"),
  ]);
}

/**
 * Distinct visitors and signups over the trailing 30 and 90 days, in ONE query per
 * stage so the two windows can never be read from two different moments.
 *
 * `uniqIf` counts each person once per window however many sessions or repeat
 * `signup_completed` events they produced — which is the whole reason this is not
 * a sum over the daily series the other tabs chart.
 */
async function fetchFunnelWindowTotals(): Promise<FunnelWindowTotals> {
  const [visitorRows, signupRows] = await Promise.all([
    posthogQuery(`
      SELECT
        uniqIf(distinct_id, \`$start_timestamp\` >= now() - INTERVAL 30 DAY) AS d30,
        uniqIf(distinct_id, \`$start_timestamp\` >= now() - INTERVAL 90 DAY) AS d90
      FROM sessions
      WHERE \`$entry_hostname\` = 'distribute.you'
    `),
    posthogQuery(`
      SELECT
        uniqIf(person, timestamp >= now() - INTERVAL 30 DAY) AS d30,
        uniqIf(person, timestamp >= now() - INTERVAL 90 DAY) AS d90
      FROM (
        SELECT
          if(notEmpty(properties['$user_id']), properties['$user_id'], distinct_id) AS person,
          timestamp
        FROM events
        WHERE event = 'signup_completed'
      )
    `),
  ]);
  const visitors = visitorRows[0];
  const signups = signupRows[0];
  if (!visitors || !signups) {
    throw new Error("[public-stats] funnel window query returned no rows");
  }
  return {
    visitors30d: asNumber(visitors[0], "visitors 30d"),
    visitors90d: asNumber(visitors[1], "visitors 90d"),
    signups30d: asNumber(signups[0], "signups 30d"),
    signups90d: asNumber(signups[1], "signups 90d"),
  };
}

async function fetchSignupDaily(): Promise<Map<string, number>> {
  const rows = await posthogQuery(`
    SELECT
      formatDateTime(timestamp, '%Y-%m-%d') AS day,
      uniq(if(notEmpty(properties['$user_id']), properties['$user_id'], distinct_id)) AS signups
    FROM events
    WHERE event = 'signup_completed'
    GROUP BY day
    ORDER BY day ASC
    LIMIT 500
  `);
  return new Map(rows.map((row) => [asString(row[0], "signup day"), asNumber(row[1], "signups")]));
}

async function fetchTrafficSources(totalVisitors: number): Promise<TrafficSource[]> {
  const rows = await posthogQuery(`
    SELECT
      if(
        notEmpty(\`$entry_utm_source\`),
        \`$entry_utm_source\`,
        if(notEmpty(\`$entry_referring_domain\`), \`$entry_referring_domain\`, if(notEmpty(\`$channel_type\`), \`$channel_type\`, 'direct'))
      ) AS source,
      uniq(distinct_id) AS visitors
    FROM sessions
    WHERE \`$entry_hostname\` = 'distribute.you'
    GROUP BY source
    ORDER BY visitors DESC
    LIMIT 100
  `);

  return rows.map((row) => {
    const source = asString(row[0], "traffic source");
    const visitors = asNumber(row[1], "traffic source visitors");
    return {
      source: source === "$direct" ? "direct" : source,
      visitors,
      sharePct: ratio(visitors, totalVisitors),
    };
  });
}

function buildTimeline(
  landingDaily: Map<string, number>,
  signupDaily: Map<string, number>,
): DailyFunnelPoint[] {
  const dates = new Set<string>([
    ...landingDaily.keys(),
    ...signupDaily.keys(),
  ]);

  return [...dates].sort().map((date) => {
    const landingVisitors = landingDaily.get(date) ?? 0;
    const signups = signupDaily.get(date) ?? 0;
    return {
      date,
      landingVisitors,
      signups,
      signupConversionPct: ratio(signups, landingVisitors),
    };
  });
}

export async function fetchPublicStatsSummary(view: PublicAnalyticsView = "landing"): Promise<PublicStats> {
  // Paid users are read off the billing stats every view already fetches, so no tab
  // pays a per-customer Stripe fan-out for them any more.
  // Only the Overview states a windowed funnel; two extra PostHog reads elsewhere
  // would buy nothing.
  const includeWindows = view === "overview";
  // The first-seen series only feed the Revenue view's avg-per-X denominators —
  // two extra PostHog queries on every other tab would buy nothing.
  const includeFirstSeen = view === "revenue";
  const [
    users,
    clerkUserCount,
    billing,
    runs,
    landingDaily,
    landingVisitors,
    signupDaily,
    visitorFirstSeenMonths,
    signupFirstSeenMonths,
    windows,
  ] = await Promise.all([
    fetchPublicStats("/public/stats/users", usersStatsSchema),
    fetchClerkUserCount(),
    fetchPublicStats("/public/stats/billing", billingStatsSchema),
    fetchPublicStats("/public/stats/runs", runsStatsSchema),
    fetchLandingDaily(),
    fetchLandingUniqueVisitors(),
    fetchSignupDaily(),
    includeFirstSeen ? fetchVisitorFirstSeenMonths() : Promise.resolve([] as FirstSeenMonthRow[]),
    includeFirstSeen ? fetchSignupFirstSeenMonths() : Promise.resolve([] as FirstSeenMonthRow[]),
    includeWindows ? fetchFunnelWindowTotals() : Promise.resolve(null),
  ]);
  const signupEvents = [...signupDaily.values()].reduce((sum, value) => sum + value, 0);
  const trafficSources = await fetchTrafficSources(landingVisitors);
  const clerkUsers = { ...users, totalUsers: clerkUserCount };

  return {
    users: clerkUsers,
    billing,
    runs,
    landingVisitors,
    signupEvents,
    timeline: buildTimeline(landingDaily, signupDaily),
    trafficSources,
    visitorFirstSeenMonths,
    signupFirstSeenMonths,
    windows,
    updatedAt: new Date().toISOString(),
  };
}
