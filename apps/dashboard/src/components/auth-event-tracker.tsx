"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { sendAuthNotification } from "@/lib/api";

const INTENT_KEY = "distribute_auth_intent";
const SIGNIN_TRACKED_KEY = "distribute_signin_tracked";
const PROMO_KEY = "distribute_promo_code";

/**
 * Fires signup_notification or signin_notification once per auth session.
 * - Sign-up page sets sessionStorage "distribute_auth_intent" = "signup" before OAuth redirect.
 * - If that flag is present → signup_notification (once-only dedup server-side).
 * - Otherwise → signin_notification (deduped per browser session via sessionStorage).
 */
export function AuthEventTracker() {
  const { isSignedIn } = useAuth();
  const hasFired = useRef(false);

  useEffect(() => {
    if (!isSignedIn || hasFired.current) return;
    hasFired.current = true;

    const intent = sessionStorage.getItem(INTENT_KEY);

    if (intent === "signup") {
      sessionStorage.removeItem(INTENT_KEY);
      const promoCode = sessionStorage.getItem(PROMO_KEY);
      if (promoCode) sessionStorage.removeItem(PROMO_KEY);
      sendAuthNotification("signup_notification", undefined, promoCode ? { promoCode } : undefined).catch(() => {});
    } else if (!sessionStorage.getItem(SIGNIN_TRACKED_KEY)) {
      sessionStorage.setItem(SIGNIN_TRACKED_KEY, "1");
      sendAuthNotification("signin_notification").catch(() => {});
    }
  }, [isSignedIn]);

  return null;
}
