/**
 * HOW LONG A NAME MAY BE, AND HOW MANY CHARACTERS THE PERSON TYPING HAS LEFT.
 *
 * Two names in this product are typed by a customer and stored by a service
 * that will refuse them past a ceiling: the OFFER's name and the BRAND's. The
 * refusal is still the answer — brand-service decides, and its 400 is what the
 * card renders — but a person should never have to discover a limit by being
 * refused. So the field shows what is left, the way X does: quiet until the end
 * is in sight, then a number, then red once it is negative.
 *
 * ── Why the counter measures the NORMALIZED string ──────────────────────────
 *
 * The producer measures what it STORES, not what was typed. An offer name is
 * trimmed and its internal whitespace collapsed before the length is taken, so
 * `"Self  Serve"` is ten characters to brand-service and eleven to a naive
 * count. A counter that measured the raw value would disagree with the refusal
 * at exactly the moment a person is up against the limit and looking at it —
 * which is worse than no counter, because it is a number that lies. Each field
 * therefore passes the normalizer its own producer applies.
 *
 * Consequence, and it is correct: typing a trailing space does not move the
 * count. The space is not going to be stored.
 *
 * ── Alias-free on purpose ───────────────────────────────────────────────────
 *
 * No `@/…` import, so this carries real unit tests rather than source-substring
 * guards. Keep it that way.
 */

/**
 * The ceiling on an OFFER name. Mirrors brand-service's own supplied-name
 * limit, which is the authority; this copy exists only so the field can show a
 * counter, and the service's refusal still decides.
 *
 * There is deliberately NO word limit. A customer naming their own proposition
 * knows what it is called, and a compound name is one word to them and three to
 * us — a real customer was refused `Psylium-Swiss-Bio-Drogerien` under the rule
 * this replaces. The tighter 2-word / 20-character rule survives upstream for a
 * name brand-service GENERATES for itself, which is a different question and
 * never reaches a field a person types into.
 */
export const OFFER_NAME_MAX_CHARS = 60;

/** The ceiling on a BRAND name. brand-service's own, unchanged and untouched. */
export const BRAND_NAME_MAX_CHARS = 255;

/**
 * What brand-service stores for an offer name: outer whitespace removed, every
 * internal run collapsed to one space. Byte-equal to its own `normalizeOfferName`
 * — if that ever changes, this moves with it or the counter starts lying.
 */
export function normalizeOfferName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** What brand-service stores for a brand name: trimmed, nothing else. */
export function normalizeBrandName(value: string): string {
  return value.trim();
}

/** How the remaining count should read. */
export type NameCounterTone = "quiet" | "close" | "over";

export interface NameCounterState {
  /** Characters that would be STORED — the normalized length. */
  readonly count: number;
  /** How many are left. NEGATIVE past the ceiling, which is the whole point. */
  readonly remaining: number;
  /** Past the ceiling: the write would be refused. */
  readonly over: boolean;
  /** Whether to render at all — see `REVEAL_AT_REMAINING`. */
  readonly reveal: boolean;
  readonly tone: NameCounterTone;
}

/**
 * A counter shown from the first keystroke is noise for 235 of a brand name's
 * 255 characters. X reveals its own near the end and that is the behaviour this
 * mirrors: the number appears when the end is in sight, so its appearance is
 * itself the warning.
 */
export const REVEAL_AT_REMAINING = 20;

/** Where the number stops being informational and starts being a warning. */
export const CLOSE_AT_REMAINING = 10;

/**
 * The counter for one field.
 *
 * An EMPTY field reveals nothing whatever the ceiling — there is nothing to warn
 * about yet, and a `60` under a blank input reads as an instruction to write
 * sixty characters.
 */
export function nameCounter(
  value: string,
  max: number,
  normalize: (value: string) => string,
): NameCounterState {
  const count = normalize(value).length;
  const remaining = max - count;
  const over = remaining < 0;
  return {
    count,
    remaining,
    over,
    reveal: count > 0 && remaining <= REVEAL_AT_REMAINING,
    tone: over ? "over" : remaining <= CLOSE_AT_REMAINING ? "close" : "quiet",
  };
}
