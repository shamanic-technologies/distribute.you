"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Fires the Google Ads "purchase" conversion when a Stripe Checkout returns
 * successfully — i.e. the user made a wallet top-up. billing-guard + the billing page build their checkout
 * `success_url` with `?success=true`, so a `success=true` on return is the
 * card-added / paid signal regardless of which page launched the flow.
 *
 * The Ads conversion action must listen to the event name `manual_event_PURCHASE`.
 * The AW tag (config in app/layout.tsx) reads the `_gcl_aw` gclid cookie that the
 * landing set on `.distribute.you` for cross-subdomain attribution.
 *
 * Conversion VALUE + FIRE GATE: we fire the conversion ONLY after a real payment
 * succeeded, and the value is the payment amount. Two payment-mode redirect
 * checkouts reach this success_url:
 *  - onboarding launch → carries `daily_budget` (the 1-day budget in DOLLARS the
 *    user picked); value = that recurring per-day commitment.
 *  - billing top-up → carries `paid_amount` (the amount charged in CENTS).
 * Both params only exist on a payment-mode checkout whose success_url was reached,
 * i.e. the payment went through. If NEITHER positive value is present, this is not
 * a completed purchase (e.g. a $0 card-add / setup return) and we do NOT fire.
 * The billing-guard card-capture uses an EMBEDDED checkout (inline onComplete, no
 * `?success=true` redirect), so it never reaches this tracker.
 *
 * We forward `value` + `currency` so the campaign's "Maximize conversion value"
 * bidding optimizes on real revenue. The Ads conversion action must be set to
 * "Use different values for each conversion" or the sent value is ignored.
 *
 * Fire-only: it does NOT strip the params — the launch pages / billing page already
 * read `pending_topup` and strip the params to arm auto-topup, and stripping here
 * would race that logic. A per-session sessionStorage latch keyed on the return
 * query prevents a refresh from re-firing the conversion.
 */
const FIRED_KEY_PREFIX = "distribute_ads_purchase_fired";

export function AdsPurchaseTracker() {
  const searchParams = useSearchParams();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (searchParams.get("success") !== "true") return;

    // Resolve the payment value. daily_budget is DOLLARS (onboarding launch, the
    // 1-day budget); paid_amount is CENTS (billing top-up). Their presence proves
    // a payment-mode checkout succeeded.
    const dailyBudget = Number(searchParams.get("daily_budget"));
    const paidCents = Number(searchParams.get("paid_amount"));
    const value =
      Number.isFinite(dailyBudget) && dailyBudget > 0
        ? dailyBudget
        : Number.isFinite(paidCents) && paidCents > 0
          ? paidCents / 100
          : null;

    // No positive payment value → not a completed purchase (e.g. a card-add /
    // setup return). Fire ONLY after a real payment.
    if (value === null) return;

    const dedupKey = `${FIRED_KEY_PREFIX}:${searchParams.toString()}`;
    if (sessionStorage.getItem(dedupKey)) return;

    fired.current = true;
    sessionStorage.setItem(dedupKey, "1");

    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    gtag?.("event", "manual_event_PURCHASE", { value, currency: "USD" });
  }, [searchParams]);

  return null;
}
