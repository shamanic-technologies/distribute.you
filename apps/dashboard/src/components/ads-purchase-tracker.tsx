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

    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    gtag?.("event", "manual_event_PURCHASE");
  }, [searchParams]);

  return null;
}
