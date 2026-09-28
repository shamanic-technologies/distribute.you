/**
 * An archive or restore refusal from brand-service, as a sentence for the owner.
 *
 * Keyed on the STATUS and the producer's `reason`, never on its message: the 409
 * `offer_has_ongoing_campaign` (with `campaignIds`) is the one refusal the owner can
 * act on, so it says what to do. Pure and import-free so it carries real unit tests.
 */
export function offerArchiveRefusalSentence(
  status: number | null,
  body: Record<string, unknown> | null | undefined,
  archiving: boolean,
): string {
  if (status === 409 && body?.reason === "offer_has_ongoing_campaign") {
    const n = Array.isArray(body.campaignIds) ? body.campaignIds.length : 0;
    return n > 1
      ? `${n} campaigns are still running on this offer. Stop them first, then archive the offer.`
      : "A campaign is still running on this offer. Stop it first, then archive the offer.";
  }
  if (status === 404) return "This offer no longer exists on this brand.";
  return archiving
    ? "We could not archive this offer. Try again in a moment."
    : "We could not restore this offer. Try again in a moment.";
}
