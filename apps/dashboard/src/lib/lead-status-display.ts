// Display vocabulary for a lead's consolidated status — the badge label, the
// pill style, and the "most-advanced-first" priority used by the monotonic
// status latch (`useMonotonicStatuses`). Pure (no `@/lib/api` import) so it can
// be used from any client component. The derivation itself
// (`getLeadConsolidatedStatus`) lives in `@/lib/api` next to the `Lead` type.
//
// Mirrors the inline vocabulary on the operator `/orgs/.../leads` page so the
// outcome (Signups / Booked Meetings / Sales) Status column reads identically.

import type { LeadConsolidatedStatus } from "./api";

/** Most-advanced first → least-advanced. Index 0 outranks the rest. */
export const LEAD_STATUS_PRIORITY: readonly LeadConsolidatedStatus[] = [
  "replied",
  "clicked",
  "opened",
  "delivered",
  "sent",
  "bounced",
  "unsubscribed",
  "contacted",
  "served",
  "skipped",
  "claimed",
  "buffered",
];

export function leadStatusLabel(status: LeadConsolidatedStatus): string {
  switch (status) {
    case "replied": return "Replied";
    case "clicked": return "Clicked";
    case "opened": return "Opened";
    case "delivered": return "Delivered";
    case "sent": return "Sent";
    case "bounced": return "Bounced";
    case "unsubscribed": return "Unsubscribed";
    case "contacted": return "Contacted";
    case "served": return "Processing";
    case "skipped": return "Skipped";
    case "claimed": return "Claimed";
    case "buffered": return "Buffered";
  }
}

export function leadStatusStyle(status: LeadConsolidatedStatus): string {
  switch (status) {
    case "replied": return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "clicked": return "bg-violet-100 text-violet-700 border-violet-200";
    case "opened": return "bg-indigo-100 text-indigo-700 border-indigo-200";
    case "delivered": return "bg-green-100 text-green-700 border-green-200";
    case "sent": return "bg-cyan-100 text-cyan-700 border-cyan-200";
    case "bounced": return "bg-red-100 text-red-600 border-red-200";
    case "unsubscribed": return "bg-amber-100 text-amber-700 border-amber-200";
    case "contacted": return "bg-teal-100 text-teal-700 border-teal-200";
    case "served": return "bg-orange-100 text-orange-700 border-orange-200";
    case "skipped": return "bg-gray-100 text-gray-500 border-gray-200";
    case "claimed": return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "buffered": return "bg-blue-100 text-blue-600 border-blue-200";
  }
}
