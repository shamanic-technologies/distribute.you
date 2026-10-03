"use client";

import { getBillingAccount, listPlans, type BillingAccount } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { paymentModeOf } from "@/lib/payment-mode";
import { offerHasLivePlan } from "@/lib/subscription-plan";

/**
 * Whether this offer needs a plan before it can send (owner 2026-10-03): the org is on
 * plans (`payment_mode` `subscription`) and billing holds no live plan for this brand x
 * offer. `null` until both reads answered, so nothing is claimed before it is known.
 */
export function useOfferNeedsPlan(brandId: string | null, offerId: string | null): boolean | null {
  const account = useAuthQuery<BillingAccount>(["billingAccount"], () => getBillingAccount());
  const onPlans = paymentModeOf(account.data) === "subscription";
  const plans = useAuthQuery(["subscriptionPlans"], () => listPlans(), { enabled: onPlans });
  if (!brandId || !offerId) return null;
  if (account.data === undefined) return null;
  if (!onPlans) return false;
  if (plans.data === undefined) return null;
  return !offerHasLivePlan(plans.data.subscriptions, brandId, offerId);
}
