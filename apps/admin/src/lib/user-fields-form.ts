// Shared pure helpers for the Brand Settings user-field editor cards (Services sold
// + the Hormozi offer levers). Both read/write the SAME brand user-fields store
// (getBrandUserFields / saveBrandUserFields); each card owns a SUBSET of the 7 keys.

import {
  SALES_PROFILE_FIELDS,
  USER_FIELD_KEYS,
  type BrandUserFields,
  type ExtractFieldDef,
  type UserFieldKey,
  type UserFieldValue,
} from "@/lib/api";
import { ALL_FIELDS, type FieldDef, type ProfileFields } from "@/components/brand-profile/field-editor";

// Field subsets, one per card.
export const SERVICES_FIELDS: FieldDef[] = ALL_FIELDS.filter((f) => f.key === "services");
export const LEVER_FIELDS: FieldDef[] = ALL_FIELDS.filter((f) => f.key !== "services");

// The extract-fields key that seeds each user-field. dreamOutcome is seeded from the
// `valueProposition` extraction (it REPLACED valueProposition); the rest match 1:1.
export const EXTRACT_KEY_FOR_FIELD: Record<string, string> = {
  dreamOutcome: "valueProposition",
};

// extract-fields description per extract-key (drives the extraction + is the cache key).
const DESCRIPTION_BY_EXTRACT_KEY: Record<string, string> = Object.fromEntries(
  SALES_PROFILE_FIELDS.map((f) => [f.key, f.description]),
);

// Per-lever guidance for the Hormozi offer-lever generation. Keyed by the user-field
// key. Each is the concrete "what this lever is" instruction; the shared template
// below wraps it with the Alex-Hormozi framing + the infer-don't-fabricate rule.
const HORMOZI_LEVER_GUIDANCE: Record<string, string> = {
  dreamOutcome:
    "The single most desirable result the buyer wants from this kind of offer. Make it specific, tangible and worth wanting, not a generic slogan.",
  perceivedLikelihood:
    "The proof that the buyer will actually get that result: track record, numbers, named results, credentials, guarantees, or any evidence that raises belief.",
  socialProof:
    "Recognizable clients, testimonials, case studies and concrete results that make the promise credible. Return several short items, one per proof point.",
  riskReversal:
    "How the downside of saying yes is removed: a guarantee, free trial, refund policy, or done-with-you support that lowers the perceived risk.",
  urgency:
    "A genuine reason to act now rather than later: deadlines, cohorts, seasonal windows, or time-boxed offers.",
  scarcity:
    "Genuine limited availability that raises perceived value: limited seats, a waitlist, or capped capacity. Only what is plausibly true for this business.",
};

// Wrap a lever's guidance in the Alex-Hormozi framing + the infer-don't-fabricate rule.
// The user reviews and edits every output, so a smart best-effort beats a blank field.
function hormoziLeverDescription(
  fieldLabel: string,
  guidance: string,
  services: string[],
): string {
  const ctx = services.length
    ? `This brand sells the following services / products: ${services.join("; ")}. `
    : "";
  return [
    `Act as Alex Hormozi, a world-class offer strategist. ${ctx}`,
    `Scrape the brand's most relevant pages and, using them plus the services above, write the most relevant, logical and compelling "${fieldLabel}" for this brand's cold-email offer.`,
    guidance,
    "Ground it in concrete details found on the site. Where the site is silent or incomplete, infer the most sensible and likely answer from the business and its services — think like an expert marketer filling a reasonable gap. Never fabricate absurd, false, or unverifiable claims (no invented numbers, named customers, or guarantees that clearly do not exist).",
    "Keep it to 1-3 short, specific sentences. A reasonable best-effort is expected rather than a blank or 'Unknown' — the user will read and edit the result.",
  ].join(" ");
}

/** Confirmed user-fields map → the plain fields bag the inline editors work with. */
export function userFieldsToProfile(fields: BrandUserFields | undefined): ProfileFields {
  const out: ProfileFields = {};
  for (const key of USER_FIELD_KEYS) {
    const v = fields?.[key]?.value;
    if (v != null) out[key] = v;
  }
  return out;
}

/** Clone only the given field subset (list default [], text default ""). */
export function cloneSubset(fields: ProfileFields, defs: FieldDef[]): ProfileFields {
  const out: ProfileFields = {};
  for (const f of defs) {
    const v = fields[f.key];
    out[f.key] = Array.isArray(v) ? [...v] : (v ?? (f.kind === "list" ? [] : ""));
  }
  return out;
}

/** Structural equality over a field subset only. */
export function subsetEqual(a: ProfileFields, b: ProfileFields, defs: FieldDef[]): boolean {
  return defs.every((f) => {
    const av = a[f.key];
    const bv = b[f.key];
    if (Array.isArray(av) || Array.isArray(bv)) {
      const aa = Array.isArray(av) ? av : [];
      const bb = Array.isArray(bv) ? bv : [];
      return aa.length === bb.length && aa.every((v, i) => v === bb[i]);
    }
    return (av ?? "") === (bv ?? "");
  });
}

/** Fields bag → the saveBrandUserFields PUT body, restricted to the given subset's
 *  keys. Empty values are omitted so a blank field never clobbers a confirmed one. */
export function profileToPayload(
  fields: ProfileFields,
  defs: FieldDef[],
): Partial<Record<UserFieldKey, UserFieldValue>> {
  const out: Partial<Record<UserFieldKey, UserFieldValue>> = {};
  for (const f of defs) {
    const key = f.key as UserFieldKey;
    if (!(USER_FIELD_KEYS as readonly string[]).includes(key)) continue;
    const v = fields[key];
    if (Array.isArray(v)) {
      const cleaned = v.map((s) => s.trim()).filter(Boolean);
      if (cleaned.length) out[key] = cleaned;
    } else if (typeof v === "string" && v.trim()) {
      out[key] = v;
    }
  }
  return out;
}

export const coerceListField = (v: string | string[] | undefined): string[] =>
  Array.isArray(v) ? v : typeof v === "string" && v.trim() ? [v.trim()] : [];

export const isEmptyField = (v: string | string[] | undefined): boolean =>
  Array.isArray(v) ? v.length === 0 : !(typeof v === "string" && v.trim());

/**
 * Build the extract-fields request defs for a card's subset. Offer levers use a rich
 * Alex-Hormozi generation prompt (inferring a sensible answer from partial/absent
 * info, never fabricating) CONDITIONED on the entered services; the services card
 * keeps the plain literal-extraction description. The description is part of the
 * extract-fields cache key, so a changed services context (or the richer prompt)
 * forces a fresh extraction — no stale collision.
 */
export function buildExtractDefs(defs: FieldDef[], servicesContext?: string[]): ExtractFieldDef[] {
  const services = (servicesContext ?? []).map((s) => s.trim()).filter(Boolean);
  return defs.map((f) => {
    const extractKey = EXTRACT_KEY_FOR_FIELD[f.key] ?? f.key;
    const guidance = HORMOZI_LEVER_GUIDANCE[f.key];
    // Levers → rich Hormozi prompt; services (or any non-lever) → plain extraction.
    const description = guidance
      ? hormoziLeverDescription(f.label, guidance, services)
      : (DESCRIPTION_BY_EXTRACT_KEY[extractKey] ?? f.label);
    return { key: extractKey, description };
  });
}
