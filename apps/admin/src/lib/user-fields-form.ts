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
 * Build the extract-fields request defs for a card's subset. When `servicesContext`
 * is non-empty, it is prepended to every field's description — so the offer-lever
 * extraction is CONDITIONED on the services the user entered. The description is part
 * of the extract-fields cache key, so a changed services context forces a fresh
 * extraction (no stale collision), which is exactly what we want.
 */
export function buildExtractDefs(defs: FieldDef[], servicesContext?: string[]): ExtractFieldDef[] {
  const services = (servicesContext ?? []).map((s) => s.trim()).filter(Boolean);
  const prefix = services.length
    ? `This brand sells the following services/products: ${services.join("; ")}. Using that as context, `
    : "";
  return defs.map((f) => {
    const extractKey = EXTRACT_KEY_FOR_FIELD[f.key] ?? f.key;
    const base = DESCRIPTION_BY_EXTRACT_KEY[extractKey] ?? f.label;
    // Keep the ORIGINAL user-field key on the returned def so the response maps back
    // to the field; the description carries the (optionally services-conditioned) prompt.
    return { key: extractKey, description: prefix ? `${prefix}${base}` : base };
  });
}
