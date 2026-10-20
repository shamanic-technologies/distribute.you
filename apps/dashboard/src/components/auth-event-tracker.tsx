"use client";

import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { isStaffEmail, STAFF_BROWSER_KEY } from "@/lib/owner-ping";
import { isGetStartedPath, isNewAccount } from "@/lib/new-account";
import { sendSignupEmailsOnce } from "@/lib/signup-emails";

const SIGNIN_TRACKED_KEY = "distribute_signin_tracked";
const PROMO_KEY = "distribute_promo_code";

/**
 * Fires the signup emails (signup_notification + welcome) or the sign-in ping once per visit.
 * - A NEW account (Clerk `createdAt` inside `NEW_ACCOUNT_WINDOW_MS`, lib/new-account.ts) gets
 *   the signup emails, whatever page it signed up on; both once-only dedup server-side.
 *   Never on `/get-started`: there the wall sends them itself, after its claim.
 * - Otherwise → signin_notification (deduped per browser session via sessionStorage).
 */
export function AuthEventTracker() {
  const { isSignedIn, orgId } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const pathname = usePathname();
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
    // The emails are org-scoped: wait for the user AND the org Clerk creates at signup.
    if (!isSignedIn || !userLoaded || !user || !orgId || hasFired.current) return;
    if (isGetStartedPath(pathname ?? "")) return;
    hasFired.current = true;

    if (isNewAccount(user.createdAt)) {
      const promoCode = sessionStorage.getItem(PROMO_KEY);
      sendSignupEmailsOnce({ userId: user.id, createdAt: user.createdAt, promoCode })
        .then(() => {
          if (promoCode) sessionStorage.removeItem(PROMO_KEY);
        })
        .catch((e) => console.error("[auth-event-tracker] signup emails failed:", e));
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
  }, [isSignedIn, userLoaded, user, orgId, pathname]);

  return null;
}
