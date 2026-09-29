"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useStaffMode } from "@/lib/use-staff-mode";
import type { StatBasis } from "@/lib/maturity";
import { statBasisCookieAssignment, statBasisFromCookie } from "@/lib/stat-basis-cookie";

// Every mounted reader re-reads the cookie when the basis changes in THIS tab (the event), or
// when the reader comes back to a tab after flipping it in another one (focus).
const EVENT = "distribute-stat-basis";
function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("focus", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("focus", onChange);
  };
}
const read = (): StatBasis => statBasisFromCookie(document.cookie);
const readServer = (): StatBasis => "mature";

/**
 * The half of every served maturity pair the page states. `flash` only for a staff reader
 * who picked it; everyone else, and a staff reader who did not, reads `mature`. See
 * stat-basis-cookie.ts.
 */
export function useStatBasis(): { isStaff: boolean; basis: StatBasis; setBasis: (b: StatBasis) => void } {
  // Staff mode, not the email alone: with the switch off a staff reader sees the customer's figures.
  const { staffMode: isStaff } = useStaffMode();
  const stored = useSyncExternalStore(subscribe, read, readServer);
  const basis: StatBasis = isStaff ? stored : "mature";
  const setBasis = useCallback((b: StatBasis) => {
    document.cookie = statBasisCookieAssignment(b);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { isStaff, basis, setBasis };
}
