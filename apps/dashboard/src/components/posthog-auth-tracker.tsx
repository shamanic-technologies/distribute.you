"use client";

import { useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import posthog from "posthog-js";
import {
  DISTRIBUTE_CONVERSION_TOKEN,
  DISTRIBUTE_CONVERSION_INGEST_URL,
} from "@/lib/distribute-conversion";
import { gclidFromCookie } from "@/lib/gclid-cookie";
import { isStaffEmail } from "@/lib/owner-ping";
import { isGetStartedPath, isNewAccount } from "@/lib/new-account";

const INTENT_KEY = "distribute_auth_intent";
const POSTHOG_AUTH_KEY_PREFIX = "distribute_posthog_auth";

export function PostHogAuthTracker() {
  const { isSignedIn, orgId, userId } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const identified = useRef<string | null>(null);

  useEffect(() => {
    // Wait for Clerk to load the profile: `useAuth` resolves before `useUser`,
    // and identifying on that first render sent an empty email that was never
    // re-sent, so a third of signed-in people had no email in PostHog and the
    // visit recap read them as "Not signed up" (owner 2026-10-12). The signup
    // pings below need the email too.
    if (!isSignedIn || !userId || !userLoaded || !user) return;

    const email = user.primaryEmailAddress?.emailAddress;
    // Identify again whenever the email or the org changes.
    const identity = `${userId}|${email ?? ""}|${orgId ?? ""}`;
    if (identified.current !== identity) {
      identified.current = identity;
      posthog.identify(userId, {
        email,
        name: user.fullName,
        org_id: orgId,
      });
      // Our own sessions are not worth a replay from the free quota; events still count.
      if (isStaffEmail(email)) posthog.stopSessionRecording();
    }

    // A signup is a NEW account (lib/new-account.ts), whatever page made it: the
    // `/sign-up` flag alone missed every `/get-started` signup (GET-STARTED-NO-WELCOME-EMAIL-1020).
    // On `/get-started` the org is not theirs until the wall's claim: the signup is
    // recorded where they land next, so nothing below writes to a pre-claim org.
    const newAccount = isNewAccount(user.createdAt);
    if (newAccount && isGetStartedPath(window.location.pathname)) return;
    const authType = sessionStorage.getItem(INTENT_KEY) === "signup" || newAccount ? "signup" : "signin";
    if (authType === "signup") sessionStorage.removeItem(INTENT_KEY);
    // A signup is recorded once per browser (localStorage), a sign-in once per tab.
    const trackedKey = `${POSTHOG_AUTH_KEY_PREFIX}_${authType}_${userId}`;
    const latch = authType === "signup" ? localStorage : sessionStorage;
    if (latch.getItem(trackedKey)) return;

    latch.setItem(trackedKey, "1");
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

      // Record WHICH ad click brought this org, on the org itself, so the
      // offline-conversion feed can later tell Google "this click signed up /
      // paid" — the gtag event above reaches Google for about one signup in
      // six (ad blockers, consent), which is too little signal to bid on.
      // First-touch: the route keeps an existing gclid. Fire-and-forget.
      const click = gclidFromCookie(document.cookie);
      if (click) {
        void fetch("/api/ads/attribution", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gclid: click.gclid }),
        }).catch(() => {});
      }

      // Which channel brought this org — the server reads the first-touch
      // cookie and hands it to client-service, where the first hand-over wins.
      // Fire-and-forget: attribution must never block the signup flow.
      void fetch("/api/attribution/first-touch", { method: "POST" }).catch(() => {});

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

      // Partnero affiliate attribution — if this signup came via a partner
      // referral link, the partner key was captured on the landing and
      // forwarded to the dashboard (?via=), persisted in the `partnero_via`
      // cookie by `PartneroViaCapture`. Register the customer with Partnero
      // server-to-server so the partner gets credited (their lifetime
      // commission tracks off this customer's Stripe purchases).
      // Fire-and-forget: a failed report must never block the signup flow.
      const via = document.cookie.match(/(?:^|; )partnero_via=([^;]+)/)?.[1];
      if (via && email && userId) {
        void fetch("/api/partnero/customer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            via: decodeURIComponent(via),
            key: userId,
            email,
            name: user?.fullName ?? undefined,
          }),
        }).catch(() => {});
      }
    }
  }, [isSignedIn, orgId, user, userId, userLoaded]);

  return null;
}
