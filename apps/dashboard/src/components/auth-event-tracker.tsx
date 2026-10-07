"use client";

import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { sendAuthNotification } from "@/lib/api";
import { isStaffEmail, STAFF_BROWSER_KEY } from "@/lib/owner-ping";
import { pingOwner } from "@/lib/owner-ping-client";

const INTENT_KEY = "distribute_auth_intent";
const SIGNIN_TRACKED_KEY = "distribute_signin_tracked";
const PROMO_KEY = "distribute_promo_code";

/**
 * Fires signup_notification or signin_notification once per auth session.
 * - Sign-up page sets sessionStorage "distribute_auth_intent" = "signup" before OAuth redirect.
 * - If that flag is present → signup_notification (admin ping) + welcome (user-facing), both once-only dedup server-side.
 * - Otherwise → signin_notification (deduped per browser session via sessionStorage).
 */
export function AuthEventTracker() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const hasFired = useRef(false);

  // A browser a staff account signed in on: the owner's own later visits send him no ping.
  const email = user?.primaryEmailAddress?.emailAddress;
  useEffect(() => {
    if (!isStaffEmail(email)) return;
    try {
      localStorage.setItem(STAFF_BROWSER_KEY, "1");
    } catch {
      // No storage: nothing to remember.
    }
  }, [email]);

  useEffect(() => {
    if (!isSignedIn || hasFired.current) return;
    hasFired.current = true;

    const intent = sessionStorage.getItem(INTENT_KEY);

    if (intent === "signup") {
      sessionStorage.removeItem(INTENT_KEY);
      const promoCode = sessionStorage.getItem(PROMO_KEY);
      if (promoCode) sessionStorage.removeItem(PROMO_KEY);
      sendAuthNotification("signup_notification", undefined, promoCode ? { promoCode } : undefined).catch(() => {});
      pingOwner({ event: "signed_up" });
      // User-facing welcome email — routed to the new user server-side (not in ADMIN_NOTIFICATION_EVENTS),
      // once-only deduped on {orgId}:welcome:{userId}.
      sendAuthNotification("welcome").catch(() => {});
    } else if (!sessionStorage.getItem(SIGNIN_TRACKED_KEY)) {
      sessionStorage.setItem(SIGNIN_TRACKED_KEY, "1");
      // PAUSED while the platform sits on Postmark's free plan (100 emails/month,
      // hard stop, no overages). This fired ~220 times a month and every one of
      // them was read by one person, who now gets the same information once a day
      // in the staff digest. Restore this line when the account is back on a paid
      // plan; the sessionStorage latch above is kept so the dedup behaviour is
      // unchanged the moment it comes back.
      // sendAuthNotification("signin_notification").catch(() => {});
    }
  }, [isSignedIn]);

  return null;
}
