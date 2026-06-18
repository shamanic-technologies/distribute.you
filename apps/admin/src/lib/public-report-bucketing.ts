import type { LeadRow } from "@/components/report/leads-table";

/** Bucket keys used by the public-report leads view. Each key is either a
 *  boolean-flag predicate (a lead appears in every bucket whose flag is true,
 *  so funnel counts and tab counts match by construction) or an intake-stage
 *  predicate keyed on `LeadRow.intakeStatus`. */
export type PublicReportStatus =
  | "positive-reply"
  | "clicked"
  | "opened"
  | "delivered"
  | "sent"
  | "bounced"
  | "unsubscribed"
  | "contacted"
  | "served"
  | "skipped"
  | "claimed"
  | "buffered";

const INTAKE_STATUSES = new Set<PublicReportStatus>([
  "served",
  "skipped",
  "claimed",
  "buffered",
]);

/** Predicate per bucket. Boolean predicates make tabs CUMULATIVE — every
 *  lead with `sent=true` appears in the Sent tab regardless of whether it
 *  later got delivered/opened/clicked/replied. Tab counts therefore equal
 *  the funnel's lead* counts (which use the same cumulative semantics on
 *  the backend). Intake predicates use `intakeStatus` so a served lead
 *  stays in the Served tab even after it progresses through the funnel. */
export function matchesPublicReportStatus(
  row: LeadRow,
  status: PublicReportStatus,
): boolean {
  switch (status) {
    case "positive-reply":
      return row.replied && row.replyClassification === "positive";
    case "clicked":
      return row.clicked;
    case "opened":
      return row.opened;
    case "delivered":
      return row.delivered;
    case "sent":
      return row.sent;
    case "bounced":
      return row.bounced;
    case "unsubscribed":
      return row.unsubscribed;
    case "contacted":
      return row.contacted;
    case "served":
    case "skipped":
    case "claimed":
    case "buffered":
      return row.intakeStatus === status;
  }
}

export function isIntakeStatus(status: PublicReportStatus): boolean {
  return INTAKE_STATUSES.has(status);
}

/** Build a map { status → leads matching that status }. A single lead may
 *  appear in many buckets (multi-status), which is the whole point: each
 *  bucket reflects "every lead that ever reached this milestone", matching
 *  the cumulative lead* counts the funnel renders. */
export function bucketRowsByStatus(
  rows: readonly LeadRow[],
  statusOrder: readonly PublicReportStatus[],
): Map<PublicReportStatus, LeadRow[]> {
  const groups = new Map<PublicReportStatus, LeadRow[]>();
  for (const s of statusOrder) groups.set(s, []);
  for (const row of rows) {
    for (const s of statusOrder) {
      if (matchesPublicReportStatus(row, s)) {
        groups.get(s)!.push(row);
      }
    }
  }
  return groups;
}
