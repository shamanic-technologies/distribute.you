"use client";

import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import posthog from "posthog-js";
import {
  DISTRIBUTE_CONVERSION_TOKEN,
  DISTRIBUTE_CONVERSION_INGEST_URL,
} from "@/lib/distribute-conversion";

const INTENT_KEY = "distribute_auth_intent";
const POSTHOG_AUTH_KEY_PREFIX = "distribute_posthog_auth";

export function PostHogAuthTracker() {
  const { isSignedIn, orgId, userId } = useAuth();
  const { user } = useUser();
  const identifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !userId) return;

    const email = user?.primaryEmailAddress?.emailAddress;
    if (identifiedUserId.current !== userId) {
      identifiedUserId.current = userId;
      posthog.identify(userId, {
        email,
        name: user?.fullName,
        org_id: orgId,
      });
    }

    const authType = sessionStorage.getItem(INTENT_KEY) === "signup" ? "signup" : "signin";
    const trackedKey = `${POSTHOG_AUTH_KEY_PREFIX}_${authType}_${userId}`;
    if (sessionStorage.getItem(trackedKey)) return;

    sessionStorage.setItem(trackedKey, "1");
    posthog.capture(authType === "signup" ? "signup_completed" : "signin_completed", {
      auth_type: authType,
      provider: "google",
      org_id: orgId,
    });

    // Google Ads signup conversion — fires on the same once-per-user signup
    // signal as the PostHog event. The Ads conversion action must listen to the
    // event name `manual_event_SIGNUP`. The AW tag (config in app/layout.tsx)
    // reads the `_gcl_aw` gclid cookie set on the landing for attribution.
    if (authType === "signup") {
      const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
      gtag?.("event", "manual_event_SIGNUP");

      // distribute conversion tracking — reports the signup back to
      // api.distribute.you keyed on the real Clerk email (strongest match).
      // Fire-and-forget: a failed report must never block the signup flow.
      if (email) {
        void fetch(DISTRIBUTE_CONVERSION_INGEST_URL, {
          method: "POST",
          headers: {
            "x-conversion-token": DISTRIBUTE_CONVERSION_TOKEN,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            event: "signup",
            email,
            firstName: user?.firstName ?? "",
            lastName: user?.lastName ?? "",
          }),
        }).catch(() => {});
      }
    }
  }, [isSignedIn, orgId, user, userId]);

  return null;
}
