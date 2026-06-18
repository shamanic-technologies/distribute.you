import type { QuotePitchStatus } from "./api";

/**
 * Pitch statuses that BLOCK a re-reply on the originating opportunity, mirroring
 * journalists-quotes-service reply idempotency (POST /orgs/opportunities/:id/reply
 * "Block statuses: drafted/submitted/selected/published/not_selected"). An
 * opportunity whose GET /orgs/opportunities `pitchStatus` annotation is one of
 * these has already been acted on for the brand-set → hide it from the
 * opportunities / quote-requests surfaces; it now lives on the pitches surface.
 *
 * `null` (no pitch yet) and the failure statuses (error / length_violation /
 * template_missing / brand_missing_fields / insufficient_credits) are NOT
 * blocked — the backend still accepts a fresh reply for them, so they stay
 * visible as actionable. Hidden ⟺ Send would be rejected: the filter is the
 * exact complement of what the pitches page shows.
 */
export const BLOCKED_PITCH_STATUSES: readonly QuotePitchStatus[] = [
  "drafted",
  "submitted",
  "selected",
  "published",
  "not_selected",
];

/** True when an opportunity has no blocking pitch yet (still actionable). */
export function isOpportunityOpen(
  pitchStatus: QuotePitchStatus | null,
): boolean {
  return pitchStatus === null || !BLOCKED_PITCH_STATUSES.includes(pitchStatus);
}
