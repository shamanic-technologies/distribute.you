"use client";

import { getBillingAccount, type BillingAccount } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { dailyBudgetHidden } from "@/lib/payment-mode";

/**
 * True when this org must not see or edit a daily budget: it is on a plan, whose
 * $50/day is fixed (owner 2026-10-03; rule in `lib/payment-mode` `dailyBudgetHidden`).
 * Same `["billingAccount"]` key as Billing, so it costs no new request.
 */
export function useDailyBudgetHidden(): boolean {
  const { data: account, isError } = useAuthQuery<BillingAccount>(["billingAccount"], () =>
    getBillingAccount(),
  );
  return dailyBudgetHidden(account, account !== undefined || isError);
}
