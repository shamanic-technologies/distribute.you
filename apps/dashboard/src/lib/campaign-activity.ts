import type { RunEvent } from "@/lib/api";

/**
 * Live campaign-activity feed — maps a small allowlist of run-event slugs to a
 * reassuring present-tense ("-ing") phrase shown on the campaign overview while
 * a run is in flight. Keyed on the event SLUG (consistent, finite, namespaced),
 * never on `detail` (free-form: nice English / param-dump / NULL — not
 * display-ready).
 *
 * Deliberately partial: only the high-signal cold-email funnel steps are mapped.
 * Infra / polling / orchestration events (billing, feature-stats, leads-query,
 * windmill-dispatch, gate-check, llm-call) are intentionally absent so the feed
 * shows the user's work, not plumbing. Errors are NEVER surfaced here — this
 * surface reassures, it does not debug.
 *
 * The map is presentation and lives entirely on the client (no backend column
 * for a status label — it's derivable from the slug). Add a row only for an
 * event that represents a user-meaningful step "happening now" (a `*-start`).
 */
interface ActivityStep {
  /** Service that emits this event — guards against a future slug collision. */
  service: string;
  /** Present-tense phrase shown to the user. */
  label: string;
}

const ACTIVITY_STEPS: Record<string, ActivityStep> = {
  "extract-fields-request": { service: "brand-service", label: "Analyzing your brand" },
  "buffer-next-start": { service: "lead-service", label: "Finding your next lead" },
  "enrich-start": { service: "apollo-service", label: "Finding the lead's email" },
  "generate-start": { service: "content-generation-service", label: "Writing a personalized email" },
  "send-start": { service: "instantly-service", label: "Sending the email" },
};

/** Shown when no mapped activity has streamed yet — the feed is never an empty card. */
export const ACTIVITY_PLACEHOLDER = "Starting your campaign…";

/** How many activity lines the overview feed shows at once. */
export const ACTIVITY_FEED_SIZE = 3;

/**
 * Reassuring phrase for a run-event, or null when the event is not an allowlisted
 * user-meaningful step (infra / polling / error → hidden).
 */
export function toActivityLabel(
  event: Pick<RunEvent, "service" | "event" | "level">,
): string | null {
  if (event.level === "error") return null;
  const step = ACTIVITY_STEPS[event.event];
  if (!step || step.service !== event.service) return null;
  return step.label;
}

export interface ActivityItem {
  id: string;
  label: string;
  createdAt: string;
}

/**
 * Maps a `createdAt DESC` event list (as returned by the backend) to the most
 * recent N displayable activity lines, newest first. Non-allowlisted events are
 * dropped, so the recent window can be noise-heavy without starving the feed —
 * within the client `limit`, the last real funnel steps still surface.
 */
export function toActivityFeed(events: RunEvent[], size = ACTIVITY_FEED_SIZE): ActivityItem[] {
  const feed: ActivityItem[] = [];
  for (const event of events) {
    const label = toActivityLabel(event);
    if (!label) continue;
    feed.push({ id: event.id, label, createdAt: event.createdAt });
    if (feed.length >= size) break;
  }
  return feed;
}
