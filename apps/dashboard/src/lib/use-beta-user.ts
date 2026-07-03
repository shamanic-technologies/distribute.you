"use client";

import { useUser } from "@clerk/nextjs";
import { isBetaEmail } from "./beta-allowlist";

/**
 * True when the signed-in user's email is on the beta allowlist (Kevin).
 * Gates the dashboard beta surfaces (Signups / Booked Meetings / Sales) — both
 * their sidebar entries and the pages themselves. See `beta-allowlist.ts` for
 * why this exists instead of `useFeatureFlag` in the dashboard app.
 *
 * Default-hidden: returns false until Clerk resolves the user, so non-beta users
 * never see a flash of the gated surface.
 */
export function useIsBetaUser(): boolean {
  const { user } = useUser();
  return isBetaEmail(user?.primaryEmailAddress?.emailAddress);
}
