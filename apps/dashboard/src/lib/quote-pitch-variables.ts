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
//   expertAnswerContext    — extra answer context (whyRelevant, category)
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

/**
 * `expertAnswerContext` — extra context the model should weave into the answer:
 * why this opportunity was matched to the brand, and its category.
 */
export function buildExpertAnswerContextVariable(opp: QuoteOpportunityContext) {
  return {
    whyRelevant: opp.whyRelevant ?? null,
    category: opp.category ?? null,
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
}): Record<string, unknown> {
  const { identity, extracted, expert, opportunity } = args;

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
    expertAnswerContext: buildExpertAnswerContextVariable(opportunity),
  };
}
