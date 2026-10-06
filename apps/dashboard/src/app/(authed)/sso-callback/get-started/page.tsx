"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

/**
 * Google's way back into the `/get-started` wall. A NEW Google account finishes as a
 * sign-up; an EXISTING one is turned into a sign-in by Clerk, which ignores the
 * sign-up's `redirectUrlComplete` and falls back to the dashboard, leaving the walk
 * unclaimed. Both branches return to the wall here; `returning=1` tells it the account
 * already existed, so the brand gets an org of its own.
 */
export default function GetStartedSSOCallback() {
  return (
    <AuthenticateWithRedirectCallback
      signUpForceRedirectUrl="/get-started?resume=1"
      signInForceRedirectUrl="/get-started?resume=1&returning=1"
    />
  );
}
