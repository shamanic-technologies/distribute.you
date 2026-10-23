"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useStaffMode } from "@/lib/use-staff-mode";
import { maturityViewCookieAssignment, maturityViewFromCookie, type MaturityView } from "@/lib/v2/maturity-view-cookie";

// Every mounted reader re-reads the cookie when the view changes in THIS tab (the event), or
// when the reader comes back to a tab after flipping it in another one (focus).
const EVENT = "distribute-maturity-view";
function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("focus", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("focus", onChange);
  };
}
const read = (): MaturityView => maturityViewFromCookie(document.cookie);
const readServer = (): MaturityView => "mature";

/**
 * The view Research and Monitoring state. `flash` only for a staff reader who picked it; everyone
 * else, and a staff reader who did not, reads `mature`. See maturity-view-cookie.ts.
 */
export function useMaturityView(): { isStaff: boolean; view: MaturityView; setView: (v: MaturityView) => void } {
  const { staffMode: isStaff } = useStaffMode();
  const stored = useSyncExternalStore(subscribe, read, readServer);
  const view: MaturityView = isStaff ? stored : "mature";
  const setView = useCallback((v: MaturityView) => {
    document.cookie = maturityViewCookieAssignment(v);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { isStaff, view, setView };
}
