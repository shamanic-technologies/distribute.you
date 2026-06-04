// Assembles the `variables` payload for the content-generation-service
// `expert-quote-pitch` template (proxied via api-service
// `POST /v1/content/generate-expert-quote-pitch`).
//
// CONTRACT (content-generation-service PR #124 / v0.21.0 — EXPLICIT, ALL-REQUIRED):
// the template no longer takes the opaque `{brand, request, additionalContext}`
// set. Every declared variable must be present + non-empty or the route 400s
// (`assertExpertQuotePitchVariables`, fail-loud before any LLM spend). The set:
//
//   brands                 — ALWAYS an array (even for one brand). Each element
//                            MUST carry brandName, brandUrl, brandDescription,
//                            brandHeadquartersLocation, brandLogoUrl (all non-empty).
//   expertName             — single expert attribution …
//   expertTitle
//   expertBio
//   expertPhotoUrl
//   expertLinkedIn
//   journalistRequest      — { question, mediaOutlet, source, deadline }
//   expertAnswerContext    — brand evidence grounded on the journalist's
//                            question (replaces the old whyRelevant/category
//                            pair), plus the operator's revision instructions
//                            and the brand's recent submitted pitches (voice
//                            anchor / anti-repetition). Inner shape is the
//                            caller's choice per the upstream contract.
//
// Field names are byte-equal to the upstream contract + mirror the DIS-136
// campaign-input names (`expertName`/`expertTitle`/`expertPhotoUrl`/
// `expertLinkedIn`) so the authed page passes them straight through.
//
// `brandDescription`, `brandHeadquartersLocation`, `expertBio` are NOT carried by
// campaign inputs — callers source them via brand-service `extract-fields`. The
// public report (no campaign inputs) extracts ALL expert fields the same way.
//
// NO legacy fallback, NO empty/placeholder values: `buildExpertQuotePitchVariables`
// throws `ExpertQuotePitchInputError` naming the first missing/empty field rather
// than emitting an empty value the upstream validator would 400 on anyway.

/** Opportunity-derived context available on a ranked-queue row. */
export interface QuoteOpportunityContext {
  opportunityText: string;
  mediaOutlet?: string | null;
  journalistName?: string | null;
  deadline?: string | null;
  whyRelevant?: string | null;
  category?: string | null;
}

/** Brand identity from brand-service `GET /brands/:id` (name/url/logoUrl). */
export interface BrandIdentity {
  brandName: string | null;
  brandUrl: string | null;
  brandLogoUrl: string | null;
}

/** Brand + expert fields not carried by campaign inputs — sourced via
 *  brand-service `extract-fields`. */
export interface ExtractedQuoteFields {
  brandDescription: string | null;
  brandHeadquartersLocation: string | null;
  expertBio: string | null;
}

/** Expert attribution (DIS-136 campaign-input names). `expertBio` lives on
 *  `ExtractedQuoteFields`, not here — it has no campaign-input source. */
export interface ExpertAttribution {
  expertName: string | null;
  expertTitle: string | null;
  expertPhotoUrl: string | null;
  expertLinkedIn: string | null;
}

/** Thrown when a required expert-quote-pitch field is missing/empty. Mirrors
 *  content-generation-service `ExpertQuotePitchInputError` so the dashboard
 *  fails loud BEFORE the upstream call instead of eating a downstream 400. */
export class ExpertQuotePitchInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpertQuotePitchInputError";
  }
}

/** Mirrors the upstream `isProvided` for string values: present + non-empty
 *  after trim. Throws naming the field otherwise. */
function requireNonEmpty(value: string | null | undefined, field: string): string {
  if (value == null || value.trim().length === 0) {
    throw new ExpertQuotePitchInputError(
      `Required expert-quote-pitch field "${field}" is missing or empty.`,
    );
  }
  return value;
}

/** Flatten an `extract-fields` value (string | object | array | null) to a
 *  trimmed string. Empty input → "". Keeps object/array content readable for
 *  the bio/description fields the model grounds on. */
export function coerceExtractedToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value.map(coerceExtractedToString).filter(Boolean).join("\n");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v != null)
      .map(([k, v]) => {
        const flat = coerceExtractedToString(v);
        return flat ? `${k}: ${flat}` : "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return String(value);
}

/**
 * `journalistRequest` — the journalist's quote request. Sub-fields are not
 * individually required by the upstream validator (the object as a whole must
 * be non-empty), so `mediaOutlet` / `source` / `deadline` may be null.
 * `source` is the reporter (journalist) name.
 */
export function buildJournalistRequestVariable(opp: QuoteOpportunityContext) {
  return {
    question: opp.opportunityText,
    mediaOutlet: opp.mediaOutlet ?? null,
    source: opp.journalistName ?? null,
    deadline: opp.deadline ?? null,
  };
}

/** A past pitch the brand already submitted, fed back as a voice anchor. */
export interface PriorPitch {
  draft: string;
  status: string;
  submittedAt: string | null;
}

/** Minimal shape of a `quote_pitches` row needed to pick prior pitches.
 *  `QuotePitch` (api.ts) is structurally assignable to this. */
export interface PriorPitchInput {
  draft: string | null;
  status: string;
  submittedAt: string | null;
  createdAt: string;
  brandIds: string[];
}

/**
 * Voice-anchor priority, strongest proof of a winning pitch FIRST. A higher
 * tier fully fills the limit before any lower tier contributes, so a brand with
 * ≥3 published anchors never falls back to merely-submitted ones:
 *   `published` (made it into a real article — the gold standard)
 *   `selected`  (the journalist picked it, even if not yet published)
 *   `submitted` (merely sent — the fallback floor)
 * Only these statuses mean "this pitch was actually sent to Featured"; a
 * `drafted` row was never submitted and is never an anchor.
 */
export const PRIOR_PITCH_STATUS_PRIORITY = [
  "published",
  "selected",
  "submitted",
] as const;

/**
 * Pick the brand's most-credible recent pitches as a voice anchor for the next
 * generation. Selection is TIERED by `PRIOR_PITCH_STATUS_PRIORITY`: take the
 * most-recent `published` first, and only drop to `selected` then `submitted`
 * to fill the remaining slots up to `limit`. Filters to the atomic brand
 * (brandId ∈ brandIds) and to a non-empty draft; within each tier sorts by
 * submittedAt desc (createdAt fallback). Returns [] when none — never throws.
 *
 * NOTE: the wire row carries no `publishedAt`/`selectedAt` timestamp, so the
 * within-tier recency sort uses `submittedAt` (the only date available). A real
 * publication date would let us rank the published tier by when it ran — backend
 * follow-up tracked in Linear (non-blocking).
 */
export function selectPriorSubmittedPitches(
  pitches: PriorPitchInput[],
  brandId: string,
  limit = 3,
): PriorPitch[] {
  const eligible = pitches
    .filter((p) => p.brandIds.includes(brandId))
    .filter((p) => p.draft != null && p.draft.trim().length > 0);

  const byRecencyDesc = (a: PriorPitchInput, b: PriorPitchInput) =>
    (b.submittedAt ?? b.createdAt).localeCompare(a.submittedAt ?? a.createdAt);

  const picked: PriorPitch[] = [];
  for (const status of PRIOR_PITCH_STATUS_PRIORITY) {
    if (picked.length >= limit) break;
    const tier = eligible
      .filter((p) => p.status === status)
      .sort(byRecencyDesc)
      .slice(0, limit - picked.length)
      .map((p) => ({
        draft: p.draft as string,
        status: p.status,
        submittedAt: p.submittedAt,
      }));
    picked.push(...tier);
  }
  return picked;
}

/** Inputs assembled by the caller for the `expertAnswerContext` variable. */
export interface ExpertAnswerContextInputs {
  /** Brand facts extracted live, grounded on the journalist's question
   *  (brand-service extract-fields seeded with the question text). May be "". */
  brandEvidence: string;
  /** Page URLs the evidence was extracted from (provenance). */
  evidenceSourceUrls: string[];
  /** Free-text operator revision instructions from the "Edit with AI" modal,
   *  or null on a first/plain generation. */
  revisionInstructions: string | null;
  /** The brand's recent submitted pitches (voice anchor / anti-repetition). */
  priorSubmittedPitches: PriorPitch[];
}

/**
 * `expertAnswerContext` — grounded brand evidence for the journalist's question,
 * plus the operator's revision instructions and the brand's prior submitted
 * pitches. Replaces the old `{ whyRelevant, category }` pair.
 */
export function buildExpertAnswerContextVariable(input: ExpertAnswerContextInputs) {
  return {
    brandEvidence: input.brandEvidence.trim() || null,
    evidenceSourceUrls: input.evidenceSourceUrls,
    revisionInstructions: input.revisionInstructions,
    priorSubmittedPitches: input.priorSubmittedPitches,
  };
}

/**
 * Assemble the all-required `variables` body for the content-generation-service
 * `expert-quote-pitch` template (PR #124 / v0.21.0 contract). Throws
 * `ExpertQuotePitchInputError` naming the first missing/empty required field —
 * NEVER emits an empty/placeholder value (the upstream validator 400s on empties).
 */
export function buildExpertQuotePitchVariables(args: {
  identity: BrandIdentity;
  extracted: ExtractedQuoteFields;
  expert: ExpertAttribution;
  opportunity: QuoteOpportunityContext;
  answerContext: ExpertAnswerContextInputs;
}): Record<string, unknown> {
  const { identity, extracted, expert, opportunity, answerContext } = args;

  const brand = {
    brandName: requireNonEmpty(identity.brandName, "brandName"),
    brandUrl: requireNonEmpty(identity.brandUrl, "brandUrl"),
    brandDescription: requireNonEmpty(extracted.brandDescription, "brandDescription"),
    brandHeadquartersLocation: requireNonEmpty(
      extracted.brandHeadquartersLocation,
      "brandHeadquartersLocation",
    ),
    brandLogoUrl: requireNonEmpty(identity.brandLogoUrl, "brandLogoUrl"),
  };

  return {
    brands: [brand],
    expertName: requireNonEmpty(expert.expertName, "expertName"),
    expertTitle: requireNonEmpty(expert.expertTitle, "expertTitle"),
    expertBio: requireNonEmpty(extracted.expertBio, "expertBio"),
    expertPhotoUrl: requireNonEmpty(expert.expertPhotoUrl, "expertPhotoUrl"),
    expertLinkedIn: requireNonEmpty(expert.expertLinkedIn, "expertLinkedIn"),
    journalistRequest: buildJournalistRequestVariable(opportunity),
    expertAnswerContext: buildExpertAnswerContextVariable(answerContext),
  };
}
