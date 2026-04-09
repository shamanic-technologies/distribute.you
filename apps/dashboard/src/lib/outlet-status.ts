/**
 * Shared outreach status constants and helpers.
 *
 * Used by BOTH outlet and journalist pages. The display status list must be
 * identical across both pages. "replied" is split into replied-positive,
 * replied-negative, replied-neutral based on replyClassification.
 */

export type ReplyClassification = "positive" | "negative" | "neutral";

/**
 * "Display status" combines `status` + `replyClassification` for replied entries.
 * E.g. status "replied" with classification "positive" → display key "replied-positive".
 */
export type DisplayStatus =
  | "replied-positive"
  | "replied-negative"
  | "replied-neutral"
  | "delivered"
  | "bounced"
  | "contacted"
  | "served"
  | "claimed"
  | "buffered"
  | "skipped";

/** Most-advanced → least-advanced. Unknown statuses sort to the end. */
export const STATUS_PRIORITY: string[] = [
  "replied-positive",
  "replied-negative",
  "replied-neutral",
  "delivered",
  "bounced",
  "contacted",
  "served",
  "claimed",
  "buffered",
  "skipped",
];

export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  "replied-positive": { label: "Reply +",    color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  "replied-negative": { label: "Reply −",    color: "bg-red-100 text-red-600 border-red-200" },
  "replied-neutral":  { label: "Reply",      color: "bg-purple-100 text-purple-700 border-purple-200" },
  delivered:          { label: "Delivered",   color: "bg-green-100 text-green-700 border-green-200" },
  bounced:            { label: "Bounced",     color: "bg-red-100 text-red-600 border-red-200" },
  contacted:          { label: "Contacted",   color: "bg-teal-100 text-teal-700 border-teal-200" },
  served:             { label: "Processing",  color: "bg-orange-100 text-orange-700 border-orange-200" },
  claimed:            { label: "Claimed",     color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  buffered:           { label: "In queue",    color: "bg-blue-100 text-blue-600 border-blue-200" },
  skipped:            { label: "Skipped",     color: "bg-gray-100 text-gray-500 border-gray-200" },
};

/**
 * Resolve the display status key from raw backend fields.
 * For "replied" status, splits into replied-positive/negative/neutral.
 */
export function resolveDisplayStatus(
  status: string,
  replyClassification?: string | null,
): string {
  if (status === "replied") {
    if (replyClassification === "positive" || replyClassification === "negative") {
      return `replied-${replyClassification}`;
    }
    return "replied-neutral";
  }
  return status;
}

export const STATUS_DESCRIPTIONS: Record<string, string> = {
  "replied-positive": "Replied positively to the outreach email",
  "replied-negative": "Replied negatively to the outreach email",
  "replied-neutral": "Replied to the outreach email",
  delivered: "Outreach email was delivered",
  bounced: "Outreach email bounced and was not delivered",
  contacted: "Has been contacted with outreach email",
  served: "Outreach is currently being processed",
  claimed: "Has been claimed for outreach",
  buffered: "Waiting in the outreach queue",
  skipped: "Skipped (not relevant or unreachable)",
};

export function statusBadgeColor(displayStatus: string): string {
  return STATUS_LABELS[displayStatus]?.color ?? "bg-gray-100 text-gray-500 border-gray-200";
}

export function statusLabel(displayStatus: string): string {
  return STATUS_LABELS[displayStatus]?.label ?? displayStatus;
}
