// The account status features-service serves on GET /internal/stats/accounts and
// /internal/stats/customer-health (same composition on both). Every value the producer
// can send is listed here so no row falls through to an unstyled pill or a wrong rank.
//
// Campaigns come in two kinds. PROACTIVE ones start conversations (cold email) and spend
// the budget. REACTIVE ones act on conversations that already exist (AI meeting booking)
// and only carry a cap. "reactive_only" = every proactive campaign stopped while a
// reactive one is still on: it starts nothing, so it is neither active nor paused.
export const ACCOUNT_STATUSES = [
  "active",
  "reactive_only",
  "paused",
  "payment_declined",
  "no_payment_method",
  "inactive",
] as const;

export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  active: "Active",
  reactive_only: "Reactive only",
  paused: "Paused",
  payment_declined: "Payment declined",
  no_payment_method: "No payment method",
  inactive: "Inactive",
};

// Table rank: money in play first, then reactive-only (between active and paused, owner
// rule 2026-10-01), held ceilings, accounts billing cannot charge, then inactive.
export function accountStatusRank(status: AccountStatus): number {
  return ACCOUNT_STATUSES.indexOf(status);
}
