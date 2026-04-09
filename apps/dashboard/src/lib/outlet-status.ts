/**
 * Shared outlet status constants and helpers.
 *
 * Outlet status is now derived from the most-advanced journalist status,
 * so these must exactly mirror the journalist status list.
 */

export type ReplyClassification = "positive" | "negative" | "neutral";

/** Canonical journalist/outlet outreach statuses, most-advanced first. */
export const STATUS_PRIORITY: string[] = [
  "replied",
  "delivered",
  "bounced",
  "contacted",
  "served",
  "claimed",
  "buffered",
  "skipped",
];

export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  replied:   { label: "Replied",     color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  delivered: { label: "Delivered",   color: "bg-green-100 text-green-700 border-green-200" },
  bounced:   { label: "Bounced",     color: "bg-red-100 text-red-600 border-red-200" },
  contacted: { label: "Contacted",   color: "bg-teal-100 text-teal-700 border-teal-200" },
  served:    { label: "Processing",  color: "bg-orange-100 text-orange-700 border-orange-200" },
  claimed:   { label: "Claimed",     color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  buffered:  { label: "In queue",    color: "bg-blue-100 text-blue-600 border-blue-200" },
  skipped:   { label: "Skipped",     color: "bg-gray-100 text-gray-500 border-gray-200" },
};

/**
 * Resolve the display status key from raw backend fields.
 * Now that outlet statuses match journalist statuses, this is a passthrough
 * (reply classification is not used for outlet-level display).
 */
export function resolveDisplayStatus(
  status: string,
  _replyClassification?: string | null,
): string {
  return status;
}

export function statusBadgeColor(displayStatus: string): string {
  return STATUS_LABELS[displayStatus]?.color ?? "bg-gray-100 text-gray-500 border-gray-200";
}

export function statusLabel(displayStatus: string): string {
  return STATUS_LABELS[displayStatus]?.label ?? displayStatus;
}
