"use client";

import { useCallback } from "react";
import { reportUnit } from "@/lib/api";
import { useStaffMode } from "@/lib/use-staff-mode";
import { DASHBOARD_REPORT_SOURCE, type UnitRef, type UnitReportKind, type UnitReportResponse } from "@/lib/unit-reports";

/**
 * Send one client report of one Unit (SCRIPT-VALUE-RATING-1113, `lib/unit-reports.ts`).
 *
 * Staff acting on a client's account is not the client: a staff email with Staff mode ON sends
 * nothing (returns null). Staff mode OFF reads the account as its client does (our own brands
 * included), so it reports.
 */
export function useUnitReport(): (unit: UnitRef, kind: UnitReportKind, note?: string | null) => Promise<UnitReportResponse | null> {
  const { staffMode } = useStaffMode();
  return useCallback(
    async (unit, kind, note = null) => {
      if (staffMode) {
        console.info("[dashboard] unit report not sent: staff mode", { ...unit, kind });
        return null;
      }
      return reportUnit({ ...unit, kind, source: DASHBOARD_REPORT_SOURCE, note: note && note.trim() ? note.trim() : null });
    },
    [staffMode],
  );
}

/**
 * An edit report sent beside a save that already landed: it never undoes or blocks the save, so
 * a failure is logged loud and the save stands.
 */
export function logReportFailure(context: string, unit: UnitRef) {
  return (err: unknown) => console.error(`[dashboard] ${context}: unit report not stored`, { ...unit, err });
}
