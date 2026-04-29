import { URLS } from "@distribute/content";

interface MonthlyRow {
  month: string;
  newOrgs: number;
  newUsers: number;
  completedRuns: number;
}

export interface InvestorMetrics {
  updatedAt: string;
  users: { total: number; orgs: number };
  billing: {
    totalAccounts: number;
    accountsWithPaymentMethod: number;
    totalCreditBalanceCents: number;
    totalCreditedCents: number;
    totalConsumedCents: number;
  };
  runs: {
    completed: number;
    failed: number;
    running: number;
  };
  monthlyGrowth: MonthlyRow[];
}

interface UsersStatsResponse {
  totalOrgs: number;
  totalUsers: number;
  monthlyGrowth: { month: string; newOrgs: number; newUsers: number }[];
}

interface BillingStatsResponse {
  totalAccounts: number;
  accountsWithPaymentMethod: number;
  totalCreditBalanceCents: number;
  totalCreditedCents: number;
  totalConsumedCents: number;
}

interface RunsStatsResponse {
  byStatus: { completed: number; failed: number; running: number };
  monthly: { month: string; completed: number; failed: number; running: number }[];
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

  // Merge monthly data from users and runs into a unified timeline
  const monthlyMap = new Map<string, MonthlyRow>();

  for (const row of users.monthlyGrowth) {
    monthlyMap.set(row.month, {
      month: row.month,
      newOrgs: row.newOrgs,
      newUsers: row.newUsers,
      completedRuns: 0,
    });
  }

  for (const row of runs.monthly) {
    const existing = monthlyMap.get(row.month);
    if (existing) {
      existing.completedRuns = row.completed;
    } else {
      monthlyMap.set(row.month, {
        month: row.month,
        newOrgs: 0,
        newUsers: 0,
        completedRuns: row.completed,
      });
    }
  }

  const sortedMonths = [...monthlyMap.keys()].sort();

  return {
    updatedAt: new Date().toISOString(),
    users: {
      total: users.totalUsers,
      orgs: users.totalOrgs,
    },
    billing: {
      totalAccounts: billing.totalAccounts,
      accountsWithPaymentMethod: billing.accountsWithPaymentMethod,
      totalCreditBalanceCents: billing.totalCreditBalanceCents,
      totalCreditedCents: billing.totalCreditedCents,
      totalConsumedCents: billing.totalConsumedCents,
    },
    runs: {
      completed: runs.byStatus.completed,
      failed: runs.byStatus.failed,
      running: runs.byStatus.running,
    },
    monthlyGrowth: sortedMonths.map((m) => monthlyMap.get(m)!),
  };
}
