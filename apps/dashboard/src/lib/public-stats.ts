import { z } from "zod";

const API_URL = process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL || "https://api.distribute.you";

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

export interface PublicStats {
  users: UsersStats;
  billing: BillingStats;
  runs: RunsStats;
  updatedAt: string;
}

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

export async function fetchPublicStatsSummary(): Promise<PublicStats> {
  const [users, billing, runs] = await Promise.all([
    fetchPublicStats("/public/stats/users", usersStatsSchema),
    fetchPublicStats("/public/stats/billing", billingStatsSchema),
    fetchPublicStats("/public/stats/runs", runsStatsSchema),
  ]);

  return {
    users,
    billing,
    runs,
    updatedAt: new Date().toISOString(),
  };
}

