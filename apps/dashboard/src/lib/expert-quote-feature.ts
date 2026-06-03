/**
 * The PR-Expert quote feature is a HITL (human-in-the-loop) ranked-queue
 * feature: the operator reviews scored journalist quote opportunities,
 * generates a pitch, and sends it. It has shipped under more than one slug as
 * the workflow dynasty was re-versioned — `pr-expert-quote-opportunities`
 * (original) and `pr-expert-quote-outreach` (current) — with an identical
 * feature definition (same `entities`, `charts`, and expert `featureInputs`
 * contract).
 *
 * Every consumer that special-cases this feature — the campaign HITL queue, the
 * public-report draft/reply routes, the Prompt editor button, the report
 * sidebar / base-route redirect / "view report" link gating — keys on THIS
 * helper instead of a hardcoded slug, so the next re-version does not silently
 * rot the consumers again. (Incident 2026-06-03: `pr-expert-quote-outreach`
 * campaigns rendered the wrong flat quote-requests page and lost the
 * Generate / Prompt affordances because every gate was pinned to the old
 * `pr-expert-quote-opportunities` literal.)
 */
export function isExpertQuoteFeature(featureSlug: string): boolean {
  return featureSlug.startsWith("pr-expert-quote");
}
