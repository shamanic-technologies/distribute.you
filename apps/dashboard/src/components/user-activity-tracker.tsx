"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
// import { trackActivity } from "@/lib/api"; // restore with the paused call below

/**
 * Fires a "user_active" lifecycle email once per dashboard visit.
 * The lifecycle-emails-service dedupes per user per day.
 */
export function UserActivityTracker() {
  const { isSignedIn } = useAuth();
  const hasFired = useRef(false);

  useEffect(() => {
    if (!isSignedIn || hasFired.current) return;
    hasFired.current = true;

    // PAUSED while the platform sits on Postmark's free plan (100 emails/month,
    // hard stop, no overages). This was the single largest consumer of the quota:
    // ~389 sends a month, all of them to one person, and roughly half of those
    // were that same person browsing their own dashboard. The staff digest now
    // carries the same signal once a day. Restore this call when the account is
    // back on a paid plan.
    // trackActivity().catch(() => {
    //   // Silent fail — activity tracking is best-effort
    // });
  }, [isSignedIn]);

  return null;
}
