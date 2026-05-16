import { URLS } from "@distribute/content";

interface MonthlyRow {
  month: string;
  newOrgs: number;
  newUsers: number;
  completedRuns: number;
  creditedCents: string;
  consumedCents: string;
  revenueCents: string;
}

interface BillingGrowthRow {
  period: string;
  credited_cents: string;
  revenue_cents: string;
}

interface WeeklyRow {
  period: string;
  creditedCents: string;
  consumedCents: string;
  revenueCents: string;
}

export interface InvestorMetrics {
  updatedAt: string;
  users: { total: number; orgs: number };
  billing: {
    totalAccounts: number;
    accountsWithPaymentMethod: number;
    totalCreditedCents: string;
    totalRevenueCents: string;
  };
  runs: {
    completed: number;
    failed: number;
    running: number;
    totalCostInUsdCents: string;
  };
  monthlyGrowth: MonthlyRow[];
  weeklyGrowth: WeeklyRow[];
}

interface UsersStatsResponse {
  totalOrgs: number;
  totalUsers: number;
  monthlyGrowth: { month: string; newOrgs: number; newUsers: number }[];
}

// billing-service /public/stats/billing — wire shape per live spec
// (snake_case throughout, post billing-service v3). Live spec:
// https://billing.distribute.you/openapi.json
interface BillingStatsResponse {
  total_accounts: number;
  accounts_with_payment_method: number;
  total_credited_cents: string;
  total_paid_cents: string;
  total_revenue_cents: string;
  total_local_credits_cents: string;
  monthly_growth: BillingGrowthRow[];
  weekly_growth: BillingGrowthRow[];
}

// runs-service /public/stats/runs — registry-verified shape.
// `totalCostInUsdCents` is the all-time cumulative cost across all completed/non-cancelled
// platform runs (10-decimal string). Authoritative source for "Total Consumed".
interface RunsStatsResponse {
  byStatus: { completed: number; failed: number; running: number };
  totalCostInUsdCents: string;
  monthly: { month: string; completed: number; failed: number; running: number; totalCostInUsdCents: string }[];
  weekly: { period: string; completed: number; failed: number; running: number; totalCostInUsdCents: string }[];
}

function resolveApiUrl(hostname: string): string {
  if (process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL) {
    return process.env.NEXT_PUBLIC_DISTRIBUTE_API_URL;
  }
  if (hostname.includes("staging")) {
    return URLS.api.replace("://api.", "://api-staging.");
  }
  return URLS.api;
}

export async function fetchInvestorMetrics(hostname = ""): Promise<InvestorMetrics> {
  const apiUrl = resolveApiUrl(hostname);
  const headers: Record<string, string> = { Accept: "application/json" };
  const apiKey = process.env.ADMIN_DISTRIBUTE_API_KEY;
  if (apiKey) headers["X-API-Key"] = apiKey;

  const [usersRes, billingRes, runsRes] = await Promise.all([
    fetch(`${apiUrl}/public/stats/users`, { headers, cache: "no-store" }),
    fetch(`${apiUrl}/public/stats/billing`, { headers, cache: "no-store" }),
    fetch(`${apiUrl}/public/stats/runs`, { headers, cache: "no-store" }),
  ]);

  if (!usersRes.ok) throw new Error(`[landing] /public/stats/users failed: ${usersRes.status}`);
  if (!billingRes.ok) throw new Error(`[landing] /public/stats/billing failed: ${billingRes.status}`);
  if (!runsRes.ok) throw new Error(`[landing] /public/stats/runs failed: ${runsRes.status}`);

  const users: UsersStatsResponse = await usersRes.json();
  const billing: BillingStatsResponse = await billingRes.json();
  const runs: RunsStatsResponse = await runsRes.json();

  // Merge monthly data from users, runs, and billing into a unified timeline
  const monthlyMap = new Map<string, MonthlyRow>();

  const emptyRow = (month: string): MonthlyRow => ({
    month,
    newOrgs: 0,
    newUsers: 0,
    completedRuns: 0,
    creditedCents: "0",
    consumedCents: "0",
    revenueCents: "0",
  });

  for (const row of users.monthlyGrowth) {
    const entry = monthlyMap.get(row.month) ?? emptyRow(row.month);
    entry.newOrgs = row.newOrgs;
    entry.newUsers = row.newUsers;
    monthlyMap.set(row.month, entry);
  }

  for (const row of runs.monthly) {
    const entry = monthlyMap.get(row.month) ?? emptyRow(row.month);
    entry.completedRuns = row.completed;
    entry.consumedCents = row.totalCostInUsdCents;
    monthlyMap.set(row.month, entry);
  }

  for (const row of billing.monthly_growth) {
    // Normalize "2026-03-01" to "2026-03" to merge with users/runs data
    const month = row.period.slice(0, 7);
    const entry = monthlyMap.get(month) ?? emptyRow(month);
    entry.creditedCents = row.credited_cents;
    entry.revenueCents = row.revenue_cents;
    monthlyMap.set(month, entry);
  }

  // Only show completed periods — exclude the current (in-progress) month and week
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const sortedMonthsDesc = [...monthlyMap.keys()]
    .sort()
    .reverse()
    .filter((m) => m < currentMonth);

  // Merge weekly data from billing (credited + revenue) and runs (consumed) into a unified row
  const weeklyMap = new Map<string, WeeklyRow>();
  const emptyWeeklyRow = (period: string): WeeklyRow => ({
    period,
    creditedCents: "0",
    consumedCents: "0",
    revenueCents: "0",
  });

  for (const row of billing.weekly_growth) {
    const entry = weeklyMap.get(row.period) ?? emptyWeeklyRow(row.period);
    entry.creditedCents = row.credited_cents;
    entry.revenueCents = row.revenue_cents;
    weeklyMap.set(row.period, entry);
  }

  for (const row of runs.weekly) {
    const entry = weeklyMap.get(row.period) ?? emptyWeeklyRow(row.period);
    entry.consumedCents = row.totalCostInUsdCents;
    weeklyMap.set(row.period, entry);
  }

  const dayOfWeek = now.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const currentWeekStart = new Date(now);
  currentWeekStart.setUTCDate(now.getUTCDate() - mondayOffset);
  const currentWeekStr = currentWeekStart.toISOString().slice(0, 10);
  const sortedWeeklyDesc = [...weeklyMap.keys()]
    .sort()
    .reverse()
    .filter((p) => p < currentWeekStr)
    .map((p) => weeklyMap.get(p)!);

  return {
    updatedAt: new Date().toISOString(),
    users: {
      total: users.totalUsers,
      orgs: users.totalOrgs,
    },
    billing: {
      totalAccounts: billing.total_accounts,
      accountsWithPaymentMethod: billing.accounts_with_payment_method,
      totalCreditedCents: billing.total_credited_cents,
      totalRevenueCents: billing.total_revenue_cents,
    },
    runs: {
      completed: runs.byStatus.completed,
      failed: runs.byStatus.failed,
      running: runs.byStatus.running,
      totalCostInUsdCents: runs.totalCostInUsdCents,
    },
    monthlyGrowth: sortedMonthsDesc.map((m) => monthlyMap.get(m)!),
    weeklyGrowth: sortedWeeklyDesc,
  };
}
