"use client";

import { getBillingAccount, type BillingAccount } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { offersNoFreeMoney } from "@/lib/v2/get-started";

/**
 * Whether this org may be shown a referral reward or free credit (owner 2026-10-29:
 * « on arrete le $100 de free credit et les $ gratuits de referral », older orgs
 * grandfathered). `show` is false until billing answers, so nothing is promised to an
 * org that has no such offer. Same `["billingAccount"]` key as Billing: no new request.
 */
export function useFreeMoneyShown(): { show: boolean; settled: boolean } {
  const { data: account, isError } = useAuthQuery<BillingAccount>(["billingAccount"], () => getBillingAccount());
  const settled = account !== undefined || isError;
  return { show: account !== undefined && !offersNoFreeMoney(account), settled };
}
