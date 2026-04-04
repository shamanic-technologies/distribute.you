/** Shared outlet status constants and helpers. */

export type ReplyClassification = "positive" | "negative" | "neutral";

/**
 * "Display status" combines `status` + `replyClassification` for replied outlets.
 * E.g. status "replied" with classification "positive" → display key "replied-positive".
 */
export type OutletDisplayStatus =
  | "replied-positive"
  | "replied-negative"
  | "replied-neutral"
  | "contacted"
  | "delivered"
  | "served"
  | "ended"
  | "denied"
  | "open"
  | "skipped";

/** Most-advanced → least-advanced. Unknown statuses sort to the end. */
export const STATUS_PRIORITY: string[] = [
  "replied-positive",
  "replied-negative",
  "replied-neutral",
  "contacted",
  "delivered",
  "served",
  "ended",
  "denied",
  "open",
  "skipped",
];

export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  "replied-positive": { label: "Reply +", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  "replied-negative": { label: "Reply −", color: "bg-red-100 text-red-600 border-red-200" },
  "replied-neutral": { label: "Reply", color: "bg-purple-100 text-purple-700 border-purple-200" },
  contacted: { label: "Contacted", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  delivered: { label: "Delivered", color: "bg-teal-100 text-teal-700 border-teal-200" },
  served: { label: "Served", color: "bg-green-100 text-green-700 border-green-200" },
  ended: { label: "Ended", color: "bg-gray-100 text-gray-500 border-gray-200" },
  denied: { label: "Denied", color: "bg-red-100 text-red-600 border-red-200" },
  open: { label: "Open", color: "bg-blue-100 text-blue-700 border-blue-200" },
  skipped: { label: "Skipped", color: "bg-orange-100 text-orange-600 border-orange-200" },
};

/**
 * Resolve the display status key from raw backend fields.
 * For "replied" status, splits into replied-positive/negative/neutral.
 */
export function resolveDisplayStatus(
  status: string,
  replyClassification?: string | null,
): string {
  if (status === "replied" && replyClassification) {
    return `replied-${replyClassification}`;
  }
  return status;
}

export function statusBadgeColor(displayStatus: string): string {
  return STATUS_LABELS[displayStatus]?.color ?? "bg-gray-100 text-gray-500 border-gray-200";
}

export function statusLabel(displayStatus: string): string {
  return STATUS_LABELS[displayStatus]?.label ?? displayStatus;
}
