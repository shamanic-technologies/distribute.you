"use client";

import { useUser } from "@clerk/nextjs";
import { isBetaEmail } from "./beta-allowlist";

/**
 * True when the signed-in user's email is on the beta allowlist (Kevin).
 * Gates the beta optimization goals in the shared Brand Sales Economics card.
 *
 * Default-hidden: returns false until Clerk resolves the user, so non-beta users
 * never see a flash of the gated surface.
 */
export function useIsBetaUser(): boolean {
  const { user } = useUser();
  return isBetaEmail(user?.primaryEmailAddress?.emailAddress);
}
