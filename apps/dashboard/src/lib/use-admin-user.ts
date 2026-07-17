"use client";

import { useUser } from "@clerk/nextjs";
import { isAdminEmail } from "./admin-allowlist";

/**
 * True when the signed-in user's email is on the staff (god-mode) allowlist.
 * Gates staff-only PREVIEW surfaces in the customer dashboard — both their
 * sidebar entries and the pages themselves (e.g. the campaign-centered "v2"
 * Campaigns page). See `admin-allowlist.ts`: in the dashboard this list is NOT
 * an edge gate, so a page gated only on this hook is a UI-visibility gate over
 * the viewer's OWN org data, never a data-security boundary.
 *
 * Default-hidden: returns false until Clerk resolves the user, so non-staff
 * users never see a flash of the gated surface.
 */
export function useIsAdminUser(): boolean {
  const { user } = useUser();
  return isAdminEmail(user?.primaryEmailAddress?.emailAddress);
}
