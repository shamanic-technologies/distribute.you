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
// key. Each is the concrete "what this lever is" instruction; it travels as the field
// description while brand-service `suggest` mode applies the Alex-Hormozi framing.
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

// The lever description carries only WHAT the lever is (guidance) + the entered
// services as context. The Alex-Hormozi framing + infer-don't-fabricate rule now
// lives SERVER-SIDE in brand-service's `suggest`-mode system prompt (the levers
// card requests mode "suggest"), so it is applied once for every lever instead of
// being duplicated into each field description.
function leverDescription(guidance: string, services: string[]): string {
  const ctx = services.length
    ? `This brand sells the following services / products: ${services.join("; ")}. `
    : "";
  return `${ctx}${guidance}`;
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

/** Clone only the given field subset, normalised to each field's declared KIND
 *  (list default [], text default "").
 *
 *  Coercing by kind is load-bearing, not defensive polish: extraction is generative and
 *  free-form, so a stored value's shape does not track the field's kind (a text-kind
 *  lever regularly arrives as string[], a list-kind one as a bare string). This is the
 *  ONE boundary this card reads through, so normalising here fixes both the render
 *  (TextEditor gets a real string instead of "") and the SAVE (profileToPayload's text
 *  branch would otherwise coerce the array to "" and write a confirmed-empty row over a
 *  value the user never touched). It also heals the stored row on the next save. */
export function cloneSubset(fields: ProfileFields, defs: FieldDef[]): ProfileFields {
  const out: ProfileFields = {};
  for (const f of defs) {
    const v = fields[f.key];
    out[f.key] = f.kind === "list" ? coerceListField(v) : coerceTextField(v);
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
 *  keys.
 *
 *  EVERY key this card owns is sent, INCLUDING when the user emptied it. The PUT
 *  replaces the value of each key it receives and leaves an omitted key untouched,
 *  and a key with no confirmed row falls back to the AI `suggested` prefill on the
 *  next read — so omitting empties (the old behaviour) made "clear this field"
 *  impossible: the deleted entry came straight back on the next read. Sending the
 *  empty value writes a confirmed-empty row, which both clears the field and stops
 *  the suggestion resurfacing. `cloneSubset` guarantees every def key is present in
 *  the bag, so this never invents a key the card does not render. */
export function profileToPayload(
  fields: ProfileFields,
  defs: FieldDef[],
): Partial<Record<UserFieldKey, UserFieldValue>> {
  const out: Partial<Record<UserFieldKey, UserFieldValue>> = {};
  for (const f of defs) {
    const key = f.key as UserFieldKey;
    if (!(USER_FIELD_KEYS as readonly string[]).includes(key)) continue;
    const v = fields[key];
    // Coerce by kind on the way OUT too. cloneSubset already normalised the bag, so this
    // is belt-and-braces — but the old `typeof v === "string" ? v.trim() : ""` was the
    // destructive half of the shape-mismatch bug: an array in a text-kind lever was
    // written back as a confirmed-EMPTY row, silently deleting a value the user never
    // touched. Coercing heals the row instead of blanking it.
    out[key] = f.kind === "list" ? coerceListField(v) : coerceTextField(v).trim();
  }
  return out;
}

/** Coerce a user-field LIST-kind value to a string[] for display / editing. Always
 *  returns a NEW array (cloneSubset relies on that so an edit never mutates the saved
 *  baseline). A legacy bare STRING is split on newlines / commas rather than kept as one
 *  blob, so a clobbered list still reads as its items. Byte-equal with the dashboard's
 *  coerceListField (lib/strategy-model.ts) — keep the twins in lockstep. */
export const coerceListField = (v: string | string[] | undefined | null): string[] => {
  if (Array.isArray(v)) return v.map((s) => s.trim()).filter((s) => s.length > 0);
  if (typeof v !== "string") return [];
  return v
    .split(/\r?\n|,/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
};

/** Coerce a user-field TEXT-kind value to a string — the mirror of coerceListField and
 *  the other half of the same bug. Extraction is generative and free-form, so a
 *  text-kind lever (riskReversal, urgency, scarcity, perceivedLikelihood) regularly
 *  comes back as string[]; the raw `typeof v === "string" ? v : ""` in the editors and
 *  in profileToPayload turned that into "not set" on screen and, on the next save, into
 *  a confirmed-EMPTY row. Joined on newline because these levers are proof points that
 *  read as lines. Byte-equal with the dashboard's coerceTextField. */
export const coerceTextField = (v: string | string[] | undefined | null): string => {
  if (Array.isArray(v)) {
    return v
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .join("\n");
  }
  return typeof v === "string" ? v : "";
};

/**
 * Build the extract-fields request defs for a card's subset. Offer levers send their
 * per-lever guidance (what the lever is) CONDITIONED on the entered services; the
 * generative Hormozi framing is applied server-side via brand-service `suggest` mode
 * (the levers card passes mode "suggest"). The services card keeps the plain literal-
 * extraction description (default "extract" mode). The description is part of the
 * extract-fields cache key, so a changed services context forces a fresh extraction.
 */
export function buildExtractDefs(defs: FieldDef[], servicesContext?: string[]): ExtractFieldDef[] {
  const services = (servicesContext ?? []).map((s) => s.trim()).filter(Boolean);
  return defs.map((f) => {
    const extractKey = EXTRACT_KEY_FOR_FIELD[f.key] ?? f.key;
    const guidance = HORMOZI_LEVER_GUIDANCE[f.key];
    // Levers → per-lever guidance + services context (framing is server-side);
    // services (or any non-lever) → plain extraction description.
    const description = guidance
      ? leverDescription(guidance, services)
      : (DESCRIPTION_BY_EXTRACT_KEY[extractKey] ?? f.label);
    return { key: extractKey, description };
  });
}
