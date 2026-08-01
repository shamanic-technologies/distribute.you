// Shared model for the two "Update from my website" buttons on the offer card
// (brand Strategy page in the dashboard, brand Settings in admin).
//
// Two buttons, not one, because the two halves of the offer are generated from
// DIFFERENT inputs: the services are read off the site, and the six Alex Hormozi
// value-equation levers are written FROM those services. Running them together
// would ask the model to invent the levers before it has settled what the brand
// actually sells.
//
// Alias-free on purpose (the field definitions arrive as an argument rather than
// being imported from `@/lib/api`), so vitest — which has no path-alias config in
// this repo — can import this module and run REAL unit tests against it instead of
// source-substring guards. Do not add an `@/…` import here.

/** The services half. Its own button: what the brand sells is read off the site. */
export const SERVICES_PREFILL_KEYS: readonly string[] = ["services"];

/**
 * The Hormozi half. Its own button because these are generated FROM the services,
 * so the services must be confirmed before this runs.
 *
 * `dreamOutcome` is the real key. The admin console used to ask brand-service for
 * `valueProposition` here and map the answer onto `dreamOutcome`: the model is told
 * verbatim which JSON keys to return, so it wrote a generic value proposition
 * instead of the dream outcome the lever asks for. `valueProposition` still exists
 * as a separate backend-extract field (features-service reads it for the
 * "value for the target" email input) — it is simply not this.
 */
export const LEVER_PREFILL_KEYS: readonly string[] = [
  "dreamOutcome",
  "perceivedLikelihood",
  "socialProof",
  "riskReversal",
  "urgency",
  "scarcity",
];

export interface PrefillFieldDef {
  key: string;
  description: string;
}

/**
 * Pick the extraction defs for one button, from the ONE shared set of field
 * descriptions (`USER_PROFILE_FIELDS`) that onboarding already uses.
 *
 * Sharing that set is the point. The admin console carried its own per-lever
 * guidance strings AND prepended the brand's services into every one of the six,
 * which put the same sentence in front of the model six times and duplicated a
 * framing brand-service's own `suggest` prompt already applies (it answers as Alex
 * Hormozi with a panel of the brand's industry experts). Onboarding's terser
 * descriptions are the ones producing the output we want, so both surfaces read
 * them and there is one place to change what a lever means.
 *
 * Keys absent from `defs` are dropped rather than invented — a button can only ask
 * for a field the shared set actually describes.
 */
export function prefillDefsFor(
  keys: readonly string[],
  defs: readonly PrefillFieldDef[],
): PrefillFieldDef[] {
  const byKey = new Map(defs.map((d) => [d.key, d]));
  return keys.map((k) => byKey.get(k)).filter((d): d is PrefillFieldDef => d != null);
}

export type PrefillFieldKind = "text" | "list";

export interface PrefillTargetDef {
  key: string;
  kind: PrefillFieldKind;
}

export type PrefillDraft = Record<string, string | string[]>;

/**
 * Fold an extraction result into the draft the user is editing.
 *
 * This is a RESET, not a top-up: every key the button asked for takes the value the
 * extraction produced, and a key the extraction did not answer is CLEARED. So what
 * is on screen after a prefill is exactly what came back, which is the only reading
 * that makes "update from my website" mean what it says. Nothing is persisted here
 * — the user reviews the draft and saves separately.
 *
 * Keys outside `defs` are carried through untouched, so the services button cannot
 * disturb the levers and vice versa.
 */
export function applyExtractionToDraft(
  draft: PrefillDraft,
  defs: readonly PrefillTargetDef[],
  results: Record<string, unknown>,
): PrefillDraft {
  const next: PrefillDraft = { ...draft };
  for (const def of defs) {
    const raw = results[def.key];
    next[def.key] = def.kind === "list" ? toListValue(raw) : toTextValue(raw);
  }
  return next;
}

/** An extracted value → list items. A bare string is split, never kept as one blob. */
function toListValue(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }
  if (typeof raw !== "string") return [];
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** An extracted value → free text. An array is joined on newlines (these levers are
 *  proof points that read as lines, and the editors render `whitespace-pre-line`). */
function toTextValue(raw: unknown): string {
  if (raw == null) return "";
  if (Array.isArray(raw)) {
    return raw
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .join("\n");
  }
  return typeof raw === "string" ? raw.trim() : "";
}
