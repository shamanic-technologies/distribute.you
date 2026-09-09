"use client";

import { useEffect, useRef } from "react";

/**
 * Fires the Google Ads MICRO-conversion when the sign-up page renders.
 *
 * Why a page view is a conversion here: smart bidding needs roughly 15-30
 * conversions per 30 days to learn, and the account produces about 5 signups
 * and 2 purchases a month, so bidding on those two bids blind. Reaching
 * `/sign-up` happens about 40-70 times a month, and over half of those sessions
 * entered the landing carrying a gclid. That is the volume the algorithm can
 * learn on. Explee, the closest competitor, does the same: their Ads triggers
 * are a free people-search and a lead form, not the paid signup.
 *
 * The Ads conversion action must listen to the event name
 * `manual_event_SIGNUP_PAGE`. The AW tag (config in app/layout.tsx) reads the
 * `_gcl_aw` gclid cookie the landing set on `.distribute.you`.
 *
 * NO value and NO currency: this is a page view, not money. Sending one would
 * put a made-up number into "maximize conversion value" bidding.
 *
 * Once per browser session, latched in sessionStorage exactly like the purchase
 * tracker beside it — a reload of the sign-up page is not a second person
 * arriving. The ref covers a re-render inside the same mount.
 *
 * This is the REAL-TIME half. It reaches Google for roughly one event in six
 * (ad blockers drop the Google tag), which is why `/api/cron/ads-conversion-feed`
 * also ships an `offline_signup_page` row per session: PostHog is served through
 * our own first-party proxy, so it sees the views this misses.
 */
const FIRED_KEY = "distribute_ads_signup_page_fired";

export function AdsSignUpPageTracker() {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (sessionStorage.getItem(FIRED_KEY)) return;

    fired.current = true;
    sessionStorage.setItem(FIRED_KEY, "1");

    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    gtag?.("event", "manual_event_SIGNUP_PAGE");
  }, []);

  return null;
}
