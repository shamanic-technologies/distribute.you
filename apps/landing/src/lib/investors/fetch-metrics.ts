import { neon } from "@neondatabase/serverless";

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

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`[landing] Missing env var: ${name}`);
  return val;
}

export async function fetchInvestorMetrics(): Promise<InvestorMetrics> {
  const clientDb = neon(requireEnv("NEON_CLIENT_SERVICE_URL"));
  const billingDb = neon(requireEnv("NEON_BILLING_SERVICE_URL"));
  const runsDb = neon(requireEnv("NEON_RUNS_SERVICE_URL"));

  const [
    orgsResult,
    usersResult,
    billingResult,
    creditsLoadedResult,
    creditsConsumedResult,
    runsResult,
    monthlyOrgsResult,
    monthlyUsersResult,
    monthlyRunsResult,
  ] = await Promise.all([
    clientDb`SELECT COUNT(*)::int as count FROM orgs`,
    clientDb`SELECT COUNT(*)::int as count FROM users`,
    billingDb`SELECT COUNT(*)::int as total, SUM(credit_balance_cents)::int as balance, COUNT(*) FILTER (WHERE stripe_payment_method_id IS NOT NULL)::int as with_pm FROM billing_accounts`,
    billingDb`SELECT COALESCE(SUM(amount_cents), 0)::int as total FROM credit_provisions WHERE type = 'credit' AND status = 'confirmed'`,
    billingDb`SELECT COALESCE(SUM(amount_cents), 0)::int as total FROM credit_provisions WHERE type = 'debit' AND status = 'confirmed'`,
    runsDb`SELECT status, COUNT(*)::int as count FROM runs GROUP BY status`,
    clientDb`SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') as month, DATE_TRUNC('month', created_at) as sort_key, COUNT(*)::int as count FROM orgs GROUP BY month, sort_key ORDER BY sort_key`,
    clientDb`SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') as month, DATE_TRUNC('month', created_at) as sort_key, COUNT(*)::int as count FROM users GROUP BY month, sort_key ORDER BY sort_key`,
    runsDb`SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') as month, DATE_TRUNC('month', created_at) as sort_key, COUNT(*)::int as count FROM runs WHERE status = 'completed' GROUP BY month, sort_key ORDER BY sort_key`,
  ]);

  const runsMap = new Map<string, number>();
  for (const row of runsResult) {
    runsMap.set(row.status as string, row.count as number);
  }

  // Build monthly growth by merging all three monthly queries
  const monthlyMap = new Map<string, MonthlyRow>();
  for (const row of monthlyOrgsResult) {
    const key = row.month as string;
    monthlyMap.set(key, {
      month: key,
      newOrgs: row.count as number,
      newUsers: 0,
      completedRuns: 0,
    });
  }
  for (const row of monthlyUsersResult) {
    const key = row.month as string;
    const existing = monthlyMap.get(key);
    if (existing) {
      existing.newUsers = row.count as number;
    } else {
      monthlyMap.set(key, {
        month: key,
        newOrgs: 0,
        newUsers: row.count as number,
        completedRuns: 0,
      });
    }
  }
  for (const row of monthlyRunsResult) {
    const key = row.month as string;
    const existing = monthlyMap.get(key);
    if (existing) {
      existing.completedRuns = row.count as number;
    } else {
      monthlyMap.set(key, {
        month: key,
        newOrgs: 0,
        newUsers: 0,
        completedRuns: row.count as number,
      });
    }
  }

  // Sort by chronological order (using the month strings from monthly queries which are already ordered)
  const monthOrder = monthlyRunsResult.map((r) => r.month as string);
  const allMonths = new Set([
    ...monthlyOrgsResult.map((r) => r.month as string),
    ...monthlyUsersResult.map((r) => r.month as string),
    ...monthOrder,
  ]);
  const sortedMonths = [...allMonths].sort((a, b) => {
    const da = new Date(a);
    const db = new Date(b);
    return da.getTime() - db.getTime();
  });

  return {
    updatedAt: new Date().toISOString(),
    users: {
      total: usersResult[0].count as number,
      orgs: orgsResult[0].count as number,
    },
    billing: {
      totalAccounts: billingResult[0].total as number,
      accountsWithPaymentMethod: billingResult[0].with_pm as number,
      totalCreditBalanceCents: (billingResult[0].balance as number) ?? 0,
      totalCreditedCents: creditsLoadedResult[0].total as number,
      totalConsumedCents: creditsConsumedResult[0].total as number,
    },
    runs: {
      completed: runsMap.get("completed") ?? 0,
      failed: runsMap.get("failed") ?? 0,
      running: runsMap.get("running") ?? 0,
    },
    monthlyGrowth: sortedMonths.map((m) => monthlyMap.get(m)!).filter(Boolean),
  };
}
