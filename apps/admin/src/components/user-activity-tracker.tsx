"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { trackActivity } from "@/lib/api";

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

    trackActivity().catch(() => {
      // Silent fail — activity tracking is best-effort
    });
  }, [isSignedIn]);

  return null;
}
