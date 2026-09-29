"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useIsAdminUser } from "@/lib/use-admin-user";
import { staffModeCookieAssignment, staffModeFromCookie } from "@/lib/staff-mode-cookie";

// Every mounted reader re-reads the cookie when the mode changes in THIS tab (the event), or
// when the reader comes back to a tab after flipping it in another one (focus).
const EVENT = "distribute-staff-mode";
function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("focus", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("focus", onChange);
  };
}
const read = (): boolean => staffModeFromCookie(document.cookie);
// Server render and first hydration read OFF, so a staff surface never flashes for a
// customer and a staff reader sees it one frame later.
const readServer = (): boolean => false;

/**
 * The ONE staff gate of the customer dashboard. `staffMode` is true only for a staff email
 * whose Staff mode switch is on; every staff-only surface reads it, and none carries a
 * "staff" tag any more (the switch is what says which world you are in). `isStaff` is the
 * email alone, for the switch itself.
 */
export function useStaffMode(): { isStaff: boolean; staffMode: boolean; setStaffMode: (on: boolean) => void } {
  const isStaff = useIsAdminUser();
  const on = useSyncExternalStore(subscribe, read, readServer);
  const setStaffMode = useCallback((next: boolean) => {
    document.cookie = staffModeCookieAssignment(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { isStaff, staffMode: isStaff && on, setStaffMode };
}
