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
 * Conversion VALUE: the checkout `success_url` carries `pending_topup` (the top-up
 * amount in cents — set by billing-guard + the billing page). We forward it as
 * `value` (dollars) + `currency` so the campaign's "Maximize conversion value"
 * bidding optimizes on real revenue, not a flat per-conversion default. The Ads
 * conversion action must be set to "Use different values for each conversion" or
 * the sent value is ignored. When the amount is absent/zero we fire without a
 * value rather than reporting $0.
 *
 * Fire-only: it does NOT strip the param — the launch pages / billing page already
 * read `pending_topup` and strip the params to arm auto-topup, and stripping here
 * would race that logic. A per-session
 * sessionStorage latch keyed on the return query prevents a refresh from
 * re-firing the conversion.
 */
const FIRED_KEY_PREFIX = "distribute_ads_purchase_fired";

export function AdsPurchaseTracker() {
  const searchParams = useSearchParams();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (searchParams.get("success") !== "true") return;

    const dedupKey = `${FIRED_KEY_PREFIX}:${searchParams.toString()}`;
    if (sessionStorage.getItem(dedupKey)) return;

    fired.current = true;
    sessionStorage.setItem(dedupKey, "1");

    const cents = Number(searchParams.get("pending_topup"));
    const valueParams =
      Number.isFinite(cents) && cents > 0
        ? { value: cents / 100, currency: "USD" }
        : undefined;

    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    gtag?.("event", "manual_event_PURCHASE", valueParams);
  }, [searchParams]);

  return null;
}
