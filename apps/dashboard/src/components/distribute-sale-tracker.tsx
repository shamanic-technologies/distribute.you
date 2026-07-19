"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import {
  DISTRIBUTE_CONVERSION_TOKEN,
  DISTRIBUTE_CONVERSION_INGEST_URL,
} from "@/lib/distribute-conversion";

/**
 * Reports distribute's OWN "sale" conversion to api.distribute.you — we dogfood
 * our own conversion tracker (the same feature clients set up in Brand Settings)
 * the same way `posthog-auth-tracker` reports "signup" and `conversion-ping`
 * fires the liveness "ping". This is the SALE counterpart: when a distribute
 * prospect becomes a paying customer, lead-service attributes the sale back to
 * the lead we cold-emailed, so distribute's own outreach numbers reflect real
 * revenue.
 *
 * FIRE GATE mirrors `ads-purchase-tracker` (the Google Ads PURCHASE): a Stripe
 * Checkout return with `?success=true` and a positive payment value proves a
 * payment-mode checkout succeeded. Two payment-mode success_urls reach here:
 *  - onboarding launch → `daily_budget` (the 1-day budget in DOLLARS the user
 *    picked); value = that recurring per-day commitment.
 *  - billing top-up → `paid_amount` (the amount charged in CENTS).
 * `valueCents` is that value in cents, so the in-house sale value matches the
 * Ads conversion value. If neither positive value is present it is not a
 * completed purchase (e.g. a $0 card-add / setup return) and we do NOT fire.
 *
 * Identity: keyed on the real Clerk email (strongest match). We wait for the
 * email to load before reporting, so attribution to the lead is reliable.
 *
 * Fire-and-forget with a per-session dedup latch keyed on the return query, so a
 * refresh does not re-report. A failed report must never affect the page.
 */
const FIRED_KEY_PREFIX = "distribute_sale_reported";

export function DistributeSaleTracker() {
  const searchParams = useSearchParams();
  const { user } = useUser();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (searchParams.get("success") !== "true") return;

    // Resolve the payment value. daily_budget is DOLLARS (onboarding launch, the
    // 1-day budget); paid_amount is CENTS (billing top-up). Their presence proves
    // a payment-mode checkout succeeded.
    const dailyBudget = Number(searchParams.get("daily_budget"));
    const paidCents = Number(searchParams.get("paid_amount"));
    const valueCents =
      Number.isFinite(dailyBudget) && dailyBudget > 0
        ? Math.round(dailyBudget * 100)
        : Number.isFinite(paidCents) && paidCents > 0
          ? Math.round(paidCents)
          : null;

    // No positive payment value → not a completed purchase. Fire ONLY after a
    // real payment.
    if (valueCents === null) return;

    // Wait for the Clerk email before reporting — the sale attributes to the
    // lead by email, so reporting without it would be a weak/unattributable hit.
    const email = user?.primaryEmailAddress?.emailAddress;
    if (!email) return;

    const dedupKey = `${FIRED_KEY_PREFIX}:${searchParams.toString()}`;
    if (sessionStorage.getItem(dedupKey)) return;

    fired.current = true;
    sessionStorage.setItem(dedupKey, "1");

    void fetch(DISTRIBUTE_CONVERSION_INGEST_URL, {
      method: "POST",
      headers: {
        "x-conversion-token": DISTRIBUTE_CONVERSION_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event: "sale",
        email,
        firstName: user?.firstName ?? "",
        lastName: user?.lastName ?? "",
        valueCents,
      }),
    }).catch(() => {});
  }, [searchParams, user]);

  return null;
}
