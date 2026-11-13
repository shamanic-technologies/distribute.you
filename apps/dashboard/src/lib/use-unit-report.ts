"use client";

import { useCallback } from "react";
import { reportUnit } from "@/lib/api";
import { useStaffMode } from "@/lib/use-staff-mode";
import {
  DASHBOARD_REPORT_SOURCE,
  draftedEdits,
  editedNote,
  type DraftedFields,
  type UnitRef,
  type UnitReportKind,
  type UnitReportResponse,
} from "@/lib/unit-reports";

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

/**
 * After a save that landed: ONE `edited` report per draft of ours the save changed, naming the
 * Unit brand-service states beside the field (`draftUnit`, `unitAt` included). `before` = the
 * fields as known before the save, `sent` = what the save wrote. Nothing changed, the client's
 * own value, or a draft naming no Unit: nothing sent.
 */
export function useDraftEditReports(): (context: string, before: DraftedFields | undefined, sent: Record<string, string | string[] | null | undefined>) => void {
  const sendReport = useUnitReport();
  return useCallback(
    (context, before, sent) => {
      for (const edit of draftedEdits(before, sent)) {
        sendReport(edit.unit, "edited", editedNote(edit.keys)).catch(logReportFailure(context, edit.unit));
      }
    },
    [sendReport],
  );
}
