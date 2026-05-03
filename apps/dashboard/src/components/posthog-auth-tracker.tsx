"use client";

import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import posthog from "posthog-js";

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
  }, [isSignedIn, orgId, user, userId]);

  return null;
}
