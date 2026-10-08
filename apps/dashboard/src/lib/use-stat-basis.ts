"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useStaffMode } from "@/lib/use-staff-mode";
import { autoStatBasis, type StatBasis, type StatBasisChoice } from "@/lib/maturity";
import { statBasisCookieAssignment, statBasisFromCookie } from "@/lib/stat-basis-cookie";
import { useOfferReturnPairIfAny } from "@/components/v2/data";

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
const read = (): StatBasisChoice => statBasisFromCookie(document.cookie);
const readServer = (): StatBasisChoice => "auto";

/**
 * The half of every served maturity pair the page states. Every customer, and a staff
 * reader who did not pin one, reads `auto`: the half whose RETURN is higher on the
 * selected offer (owner 2026-10-08, `autoStatBasis`), ONE basis for the whole dashboard so
 * a cost and the return beside it never sit on two bases. A staff reader can pin
 * `mature` or `flash`. See stat-basis-cookie.ts.
 */
export function useStatBasis(): {
  isStaff: boolean;
  choice: StatBasisChoice;
  basis: StatBasis;
  setBasis: (b: StatBasisChoice) => void;
} {
  // Staff mode, not the email alone: with the switch off a staff reader sees the customer's figures.
  const { staffMode: isStaff } = useStaffMode();
  const stored = useSyncExternalStore(subscribe, read, readServer);
  const choice: StatBasisChoice = isStaff ? stored : "auto";
  const pair = useOfferReturnPairIfAny();
  const basis: StatBasis = choice === "auto" ? autoStatBasis(pair) : choice;
  const setBasis = useCallback((b: StatBasisChoice) => {
    document.cookie = statBasisCookieAssignment(b);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { isStaff, choice, basis, setBasis };
}
