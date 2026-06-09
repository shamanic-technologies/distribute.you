import { z } from "zod";

const API_URL = process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";
const POSTHOG_PROJECT_ID = process.env.POSTHOG_PROJECT_ID || "171095";
const POSTHOG_API_HOST = normalizePostHogHost(
  process.env.POSTHOG_API_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.posthog.com",
);
const STRIPE_API_URL = "https://api.stripe.com/v1";

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
});

const billingStatsSchema = z.object({
  total_accounts: z.number(),
  accounts_with_payment_method: z.number(),
  total_credited_cents: z.string(),
  total_paid_cents: z.string(),
  total_revenue_cents: z.string(),
  total_local_credits_cents: z.string(),
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

export type UsersStats = z.infer<typeof usersStatsSchema>;
export type BillingStats = z.infer<typeof billingStatsSchema>;
export type RunsStats = z.infer<typeof runsStatsSchema>;

export type PublicAnalyticsView = "landing" | "signups" | "cards";

export interface DailyFunnelPoint {
  date: string;
  landingVisitors: number;
  signups: number;
  cardsAdded: number;
  signupConversionPct: number;
  cardConversionPct: number;
}

export interface TrafficSource {
  source: string;
  visitors: number;
  sharePct: number;
}

export interface PublicStats {
  users: UsersStats;
  billing: BillingStats;
  runs: RunsStats;
  landingVisitors: number;
  signupEvents: number;
  cardsAdded: number;
  timeline: DailyFunnelPoint[];
  trafficSources: TrafficSource[];
  updatedAt: string;
}

const posthogQueryResponseSchema = z.object({
  results: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
});

const stripeListSchema = z.object({
  data: z.array(z.object({
    id: z.string(),
    created: z.number(),
  }).passthrough()),
  has_more: z.boolean(),
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
      count() AS visitors
    FROM sessions
    WHERE \`$entry_hostname\` = 'distribute.you'
    GROUP BY day
    ORDER BY day ASC
    LIMIT 500
  `);
  return new Map(rows.map((row) => [asString(row[0], "landing day"), asNumber(row[1], "landing visitors")]));
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
      count() AS visitors
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

async function stripeList(path: string, params: URLSearchParams): Promise<z.infer<typeof stripeListSchema>> {
  const secretKey = requireEnv("STRIPE_SECRET_KEY");
  const res = await fetch(`${STRIPE_API_URL}${path}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`[public-stats] Stripe ${path} failed: ${res.status} ${res.statusText}`);
  }

  const data: unknown = await res.json();
  return stripeListSchema.parse(data);
}

async function fetchStripeCustomers(): Promise<Array<{ id: string }>> {
  const customers: Array<{ id: string }> = [];
  let startingAfter: string | null = null;

  do {
    const params = new URLSearchParams({ limit: "100" });
    if (startingAfter) params.set("starting_after", startingAfter);
    const page = await stripeList("/customers", params);
    customers.push(...page.data.map((customer) => ({ id: customer.id })));
    startingAfter = page.has_more ? page.data[page.data.length - 1]?.id ?? null : null;
  } while (startingAfter);

  return customers;
}

async function fetchStripeCardsDaily(): Promise<Map<string, number>> {
  const customers = await fetchStripeCustomers();
  const daily = new Map<string, number>();

  await Promise.all(customers.map(async (customer) => {
    const params = new URLSearchParams({ limit: "100", type: "card" });
    const page = await stripeList(`/customers/${customer.id}/payment_methods`, params);
    const firstCardCreated = page.data.map((paymentMethod) => paymentMethod.created).sort((a, b) => a - b)[0];
    if (firstCardCreated === undefined) return;
    const day = new Date(firstCardCreated * 1000).toISOString().slice(0, 10);
    daily.set(day, (daily.get(day) ?? 0) + 1);
  }));

  return daily;
}

function buildTimeline(
  landingDaily: Map<string, number>,
  signupDaily: Map<string, number>,
  cardDaily: Map<string, number>,
): DailyFunnelPoint[] {
  const dates = new Set<string>([
    ...landingDaily.keys(),
    ...signupDaily.keys(),
    ...cardDaily.keys(),
  ]);

  return [...dates].sort().map((date) => {
    const landingVisitors = landingDaily.get(date) ?? 0;
    const signups = signupDaily.get(date) ?? 0;
    const cardsAdded = cardDaily.get(date) ?? 0;
    return {
      date,
      landingVisitors,
      signups,
      cardsAdded,
      signupConversionPct: ratio(signups, landingVisitors),
      cardConversionPct: ratio(cardsAdded, signups),
    };
  });
}

export async function fetchPublicStatsSummary(view: PublicAnalyticsView = "landing"): Promise<PublicStats> {
  const includeCardTimeline = view === "cards";
  const [users, billing, runs, landingDaily, signupDaily, cardDaily] = await Promise.all([
    fetchPublicStats("/public/stats/users", usersStatsSchema),
    fetchPublicStats("/public/stats/billing", billingStatsSchema),
    fetchPublicStats("/public/stats/runs", runsStatsSchema),
    fetchLandingDaily(),
    fetchSignupDaily(),
    includeCardTimeline ? fetchStripeCardsDaily() : Promise.resolve(new Map<string, number>()),
  ]);
  const landingVisitors = [...landingDaily.values()].reduce((sum, value) => sum + value, 0);
  const signupEvents = [...signupDaily.values()].reduce((sum, value) => sum + value, 0);
  const trafficSources = await fetchTrafficSources(landingVisitors);

  return {
    users,
    billing,
    runs,
    landingVisitors,
    signupEvents,
    cardsAdded: billing.accounts_with_payment_method,
    timeline: buildTimeline(landingDaily, signupDaily, cardDaily),
    trafficSources,
    updatedAt: new Date().toISOString(),
  };
}
