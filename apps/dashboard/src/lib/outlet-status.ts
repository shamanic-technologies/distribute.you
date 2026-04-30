import type { OutletStatusCounts, JournalistStatusBooleans } from "@/lib/api";

/**
 * Shared outreach status constants and helpers.
 *
 * Used by BOTH outlet and journalist pages. This file covers the UNION of
 * statuses from both entity types:
 *   - Outlet-only: open, denied, ended
 *   - Journalist-only: bounced
 *   - Shared: replied, delivered, contacted, served, claimed, buffered, skipped
 *
 * "replied" is split into replied-positive/negative/neutral based on replyClassification.
 * Statuses match the backend exactly — no aggregation, no renaming.
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
  | "opened"
  | "delivered"
  | "sent"
  | "contacted"
  | "served"
  | "claimed"
  | "buffered"
  | "open"
  | "skipped"
  | "denied"
  | "ended"
  | "bounced";

/** Most-advanced → least-advanced. Unknown statuses sort to the end. */
export const STATUS_PRIORITY: string[] = [
  "replied-positive",
  "replied-negative",
  "replied-neutral",
  "opened",
  "delivered",
  "sent",
  "bounced",
  "contacted",
  "served",
  "claimed",
  "buffered",
  "open",
  "skipped",
  "denied",
  "ended",
];

export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  "replied-positive": { label: "Reply +",    color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  "replied-negative": { label: "Reply −",    color: "bg-red-100 text-red-600 border-red-200" },
  "replied-neutral":  { label: "Reply",      color: "bg-purple-100 text-purple-700 border-purple-200" },
  opened:             { label: "Opened",     color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  delivered:          { label: "Delivered",   color: "bg-green-100 text-green-700 border-green-200" },
  sent:               { label: "Sent",       color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  bounced:            { label: "Bounced",     color: "bg-red-100 text-red-600 border-red-200" },
  contacted:          { label: "Contacted",   color: "bg-teal-100 text-teal-700 border-teal-200" },
  served:             { label: "Served",      color: "bg-orange-100 text-orange-700 border-orange-200" },
  claimed:            { label: "Claimed",     color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  buffered:           { label: "Buffered",    color: "bg-blue-100 text-blue-600 border-blue-200" },
  open:               { label: "Open",        color: "bg-slate-100 text-slate-600 border-slate-200" },
  skipped:            { label: "Skipped",     color: "bg-gray-100 text-gray-500 border-gray-200" },
  denied:             { label: "Denied",      color: "bg-red-100 text-red-600 border-red-200" },
  ended:              { label: "Ended",       color: "bg-stone-100 text-stone-600 border-stone-200" },
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

/**
 * High-watermark status priority for deriving display status from StatusCounts.
 * Maps count field names → display status, ordered most-advanced first.
 */
const COUNTS_WATERMARK: Array<{ key: string; display: string }> = [
  { key: "repliesPositive", display: "replied-positive" },
  { key: "repliesNegative", display: "replied-negative" },
  { key: "repliesNeutral", display: "replied-neutral" },
  { key: "opened", display: "opened" },
  { key: "delivered", display: "delivered" },
  { key: "sent", display: "sent" },
  { key: "bounced", display: "bounced" },
  { key: "contacted", display: "contacted" },
  { key: "served", display: "served" },
  { key: "claimed", display: "claimed" },
  { key: "buffered", display: "buffered" },
  { key: "skipped", display: "skipped" },
];

/**
 * Derive display status from structured OutletStatusCounts.
 * Picks the most advanced status that has count > 0.
 * Returns "open" if no counts are positive or counts is null.
 */
export function deriveDisplayStatusFromCounts(
  counts: OutletStatusCounts | null | undefined,
): string {
  if (!counts) return "open";
  for (const { key, display } of COUNTS_WATERMARK) {
    if ((counts[key as keyof OutletStatusCounts] ?? 0) > 0) return display;
  }
  return "open";
}

export const STATUS_DESCRIPTIONS: Record<string, string> = {
  "replied-positive": "Replied positively to the outreach email",
  "replied-negative": "Replied negatively to the outreach email",
  "replied-neutral": "Replied to the outreach email",
  opened: "Outreach email was opened by the recipient",
  delivered: "Outreach email was delivered",
  sent: "Outreach email was sent",
  bounced: "Outreach email bounced (journalist-only)",
  contacted: "Has been contacted with outreach email",
  served: "Served to the email sending pipeline",
  claimed: "Claimed by the sending workflow, not yet served",
  buffered: "Created but not yet processed",
  open: "Waiting in buffer, not yet claimed by the workflow",
  skipped: "Skipped (duplicate, blocked, or low relevance)",
  denied: "Denied",
  ended: "Ended manually",
};

/**
 * Derive display status from cumulative JournalistStatusBooleans.
 * Picks the most advanced status that is true.
 */
const BOOLEANS_WATERMARK: Array<{ key: string; display: string }> = [
  { key: "replied", display: "replied" },
  { key: "opened", display: "opened" },
  { key: "delivered", display: "delivered" },
  { key: "sent", display: "sent" },
  { key: "bounced", display: "bounced" },
  { key: "contacted", display: "contacted" },
  { key: "served", display: "served" },
  { key: "claimed", display: "claimed" },
  { key: "buffered", display: "buffered" },
  { key: "skipped", display: "skipped" },
];

export function deriveDisplayStatusFromBooleans(
  booleans: JournalistStatusBooleans | null | undefined,
): string {
  if (!booleans) return "buffered";
  for (const { key, display } of BOOLEANS_WATERMARK) {
    if (booleans[key as keyof JournalistStatusBooleans] === true) {
      if (display === "replied") {
        const rc = booleans.replyClassification;
        if (rc === "positive" || rc === "negative") return `replied-${rc}`;
        return "replied-neutral";
      }
      return display;
    }
  }
  return "buffered";
}

export function statusBadgeColor(displayStatus: string): string {
  return STATUS_LABELS[displayStatus]?.color ?? "bg-gray-100 text-gray-500 border-gray-200";
}

export function statusLabel(displayStatus: string): string {
  return STATUS_LABELS[displayStatus]?.label ?? displayStatus;
}
