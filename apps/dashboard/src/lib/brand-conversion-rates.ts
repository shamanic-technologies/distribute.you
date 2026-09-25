/**
 * The brand-grain conversion rates, as the Brand Settings section and the
 * funnel-activation modal edit them. Pure and alias-free (its only import is
 * type-only and erased at build), so it carries real unit tests — keep it that way.
 *
 * Owner-decided 2026-09-25: a conversion rate describes how a BRAND sells, so
 * there is one stated rate per (brand, funnel, arrow), shared by every offer
 * selling that funnel. The number the product prices on is decided upstream —
 * measured when enough people reached the step, else what the brand stated, else
 * the cross-org median — and this module never re-derives it. It only turns what
 * a person typed into the partial write brand-service expects.
 */

import type { BrandArrowRatePatch, EffectiveArrowRate } from "./api";

/** What the brand has STATED for one arrow, whichever read it came from. */
export type StatedArrowRate = {
  fromStep: string;
  toStep: string;
  stated: boolean;
  ratePct: number | null;
};

/** One arrow's identity, as brand-service names it: its two step labels. */
export function arrowId(arrow: { fromStep: string; toStep: string }): string {
  return `${arrow.fromStep}\u0000${arrow.toStep}`;
}

/**
 * What a typed value means: a blank field clears the brand's statement, a number
 * states it, anything else is not a rate and returns `undefined` so the caller can
 * refuse it rather than guess. Commas are read as decimal separators, since the
 * inputs are locale text fields.
 */
export function parseRateInput(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 100) return undefined;
  return n;
}

/**
 * The PARTIAL write: exactly the arrows whose typed value differs from what the
 * brand has stated. An untouched arrow is omitted, so editing one rate never
 * restates the others from a possibly stale copy; a field emptied on an arrow the
 * brand had stated sends `null`, which clears it. A draft that is not a rate is
 * reported, not dropped, so the form can say which field is wrong.
 */
export function arrowRatePatch(
  arrows: StatedArrowRate[],
  drafts: Record<string, string>,
): { patch: BrandArrowRatePatch[]; invalid: string[] } {
  const patch: BrandArrowRatePatch[] = [];
  const invalid: string[] = [];
  for (const arrow of arrows) {
    const id = arrowId(arrow);
    if (!(id in drafts)) continue;
    const next = parseRateInput(drafts[id]);
    if (next === undefined) {
      invalid.push(id);
      continue;
    }
    const current = arrow.stated ? arrow.ratePct : null;
    if (next !== current) patch.push({ fromStep: arrow.fromStep, toStep: arrow.toStep, ratePct: next });
  }
  return { patch, invalid };
}

/** A rate as a customer reads it: at most one decimal, never trailing zeros. */
export function formatRatePct(pct: number): string {
  const rounded = Math.round(pct * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

/** The brand's own statement, read off the effective-rate row that carries it. */
export function statedFromEffective(arrow: EffectiveArrowRate): StatedArrowRate {
  return {
    fromStep: arrow.fromStep,
    toStep: arrow.toStep,
    stated: arrow.manualRatePct !== null,
    ratePct: arrow.manualRatePct,
  };
}

/**
 * The value a rate field OPENS with: the brand's own statement, else the
 * cross-org median as a prefill. A prefill is only shown; it is written only if
 * the person edits the field or confirms it (see `arrowRatePatch`, which sends
 * nothing for an arrow the form never touched).
 */
export function rateFieldSeed(arrow: EffectiveArrowRate): string {
  const value = arrow.manualRatePct ?? arrow.median.ratePct;
  return value === null ? "" : String(Math.round(value * 10) / 10);
}

/**
 * Where the number the product prices on came from, in words. Read off the
 * producer's `source`; a source this app does not know yet is named as it came,
 * rather than dressed as one it does.
 */
export function rateSourceLabel(arrow: EffectiveArrowRate): string {
  switch (arrow.source) {
    case "measured":
      return `Measured on ${arrow.measured.fromReached ?? 0} leads`;
    case "manual":
      return "Your value";
    case "median":
      return `Median of ${arrow.median.brandCount} ${arrow.median.brandCount === 1 ? "client" : "clients"}`;
    case null:
      return "No rate yet";
    default:
      return arrow.source;
  }
}

/**
 * The arrows of a funnel that have nothing MEASURED behind them, i.e. whose number
 * rests on a statement or a median. This is what the activation modal asks about;
 * a funnel whose every arrow is measured has nothing to confirm.
 */
export function unmeasuredArrows(arrows: EffectiveArrowRate[]): EffectiveArrowRate[] {
  return arrows.filter((a) => a.source !== "measured");
}
