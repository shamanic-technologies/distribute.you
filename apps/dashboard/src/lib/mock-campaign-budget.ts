/**
 * Mock campaign budget — shared by the Run Campaign modal (pick a budget) and
 * the signups page (show the active campaign's budget + edit it). PURE MOCKUP:
 * no real campaign is created, the selection lives in client state /
 * sessionStorage. Mirrors the create-campaign page's tier cards (Starter /
 * Recommended / Growth + Other), with plausible $/day amounts.
 */

export type BudgetCadence = "daily" | "weekly" | "monthly" | "one-off";
export type BudgetTierKey = "starter" | "recommended" | "growth" | "other";

export interface BudgetSelection {
  tier: BudgetTierKey;
  /** Amount in the chosen cadence (e.g. 35 for "$35 / day"). */
  amount: number;
  cadence: BudgetCadence;
}

export interface BudgetTier {
  key: Exclude<BudgetTierKey, "other">;
  label: string;
  /** Mock $/day. */
  daily: number;
  closesPerMonth: number;
  recommended?: boolean;
}

export const BUDGET_TIERS: BudgetTier[] = [
  { key: "starter", label: "Starter", daily: 20, closesPerMonth: 3 },
  { key: "recommended", label: "Recommended", daily: 35, closesPerMonth: 5, recommended: true },
  { key: "growth", label: "Growth", daily: 70, closesPerMonth: 10 },
];

export const DEFAULT_BUDGET: BudgetSelection = { tier: "recommended", amount: 35, cadence: "daily" };

const CADENCE_SUFFIX: Record<BudgetCadence, string> = {
  daily: "/day",
  weekly: "/week",
  monthly: "/month",
  "one-off": " one-off",
};

/** "$35/day" / "$200/week" / "$500 one-off". */
export function formatBudget(b: BudgetSelection): string {
  const amount = `$${Math.round(b.amount).toLocaleString("en-US")}`;
  return `${amount}${CADENCE_SUFFIX[b.cadence]}`;
}
