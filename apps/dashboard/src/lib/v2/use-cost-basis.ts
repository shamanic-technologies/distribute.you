"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useStaffMode } from "@/lib/use-staff-mode";
import { costBasisCookieAssignment, costBasisFromCookie, type CostBasis } from "@/lib/v2/cost-basis-cookie";

// Every mounted reader re-reads the cookie when the basis changes in THIS tab (the event), or
// when the reader comes back to a tab after flipping it in another one (focus).
const EVENT = "distribute-cost-basis";
function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("focus", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("focus", onChange);
  };
}
const read = (): CostBasis => costBasisFromCookie(document.cookie);
const readServer = (): CostBasis => "user";

/**
 * The cost basis the page states. `actual` only for a staff reader who picked it; everyone
 * else, and a staff reader who did not, reads `user`. See cost-basis-cookie.ts.
 */
export function useCostBasis(): { isStaff: boolean; basis: CostBasis; actual: boolean; setBasis: (b: CostBasis) => void } {
  // Staff mode, not the email alone: with the switch off a staff reader sees the customer's figures.
  const { staffMode: isStaff } = useStaffMode();
  const stored = useSyncExternalStore(subscribe, read, readServer);
  const basis: CostBasis = isStaff ? stored : "user";
  const setBasis = useCallback((b: CostBasis) => {
    document.cookie = costBasisCookieAssignment(b);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { isStaff, basis, actual: basis === "actual", setBasis };
}
