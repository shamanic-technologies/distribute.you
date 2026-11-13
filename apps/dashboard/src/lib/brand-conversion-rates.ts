/**
 * The brand-grain conversion rates, as the Brand Settings section edits them. Pure and alias-free (its only import is
 * type-only and erased at build), so it carries real unit tests — keep it that way.
 *
 * Owner-decided 2026-09-25: a conversion rate describes how a BRAND sells, so
 * there is one stated rate per (brand, leg), shared by every offer. The number the product prices on is decided upstream —
 * measured when enough people reached the step, else what the brand stated, else
 * the industry benchmark (owner 2026-10-14: never another client's numbers) — and this module never re-derives it. It only turns what
 * a person typed into the partial write brand-service expects.
 */

import type { BrandLegRatePatch, EffectiveLegRate, RateSourceLeg } from "./api";

/** What the brand has STATED for one leg, whichever read it came from. */
export type StatedLegRate = {
  fromStep: string;
  toStep: string;
  stated: boolean;
  ratePct: number | null;
};

/** One leg's identity, as brand-service names it: its two step labels. */
export function legId(leg: { fromStep: string; toStep: string }): string {
  return `${leg.fromStep}\u0000${leg.toStep}`;
}

/**
 * What a typed value means: a blank field clears the brand's statement, a number
 * states it, anything else is not a rate and returns `undefined` so the caller can
 * refuse it rather than guess. Commas are read as decimal separators, since the
 * inputs are locale text fields.
 */
export function parseRateInput(raw: string): number | null | undefined {
  const trimmed = raw.trim().replace(/%$/, "").trim();
  if (trimmed === "") return null;
  const n = Number(trimmed.replace(",", "."));
  if (!isLegRatePct(n)) return undefined;
  return n;
}

/**
 * The precision a leg rate carries (owner, 2026-10-01): a whole percent from 1% up,
 * since the rate is an approximation; below 1% a decimal is kept (0.5%), because a
 * whole percent would read 0% and empty the rest of the path.
 */
export function isLegRatePct(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= 100 && (n < 1 || Number.isInteger(n));
}

/** What a field refusing a rate says. */
export const LEG_RATE_RULE = "A whole percent from 1 to 100, or a decimal below 1.";

/** A leg rate at the precision it is shown and typed at (see `isLegRatePct`). */
export function roundLegRatePct(pct: number): number {
  if (pct >= 0.95) return Math.round(pct);
  const tenth = Math.round(pct * 10) / 10;
  return tenth > 0 || pct <= 0 ? tenth : Math.round(pct * 100) / 100;
}

/**
 * The PARTIAL write: exactly the legs whose typed value differs from what the
 * brand has stated. An untouched leg is omitted, so editing one rate never
 * restates the others from a possibly stale copy; a field emptied on an leg the
 * brand had stated sends `null`, which clears it. A draft that is not a rate is
 * reported, not dropped, so the form can say which field is wrong.
 */
export function legRatePatch(
  legs: StatedLegRate[],
  drafts: Record<string, string>,
): { patch: BrandLegRatePatch[]; invalid: string[] } {
  const patch: BrandLegRatePatch[] = [];
  const invalid: string[] = [];
  for (const leg of legs) {
    const id = legId(leg);
    if (!(id in drafts)) continue;
    const next = parseRateInput(drafts[id]);
    if (next === undefined) {
      invalid.push(id);
      continue;
    }
    const current = leg.stated ? leg.ratePct : null;
    if (next !== current) patch.push({ fromStep: leg.fromStep, toStep: leg.toStep, ratePct: next });
  }
  return { patch, invalid };
}

/** A rate as a customer reads it: a whole percent, a decimal only below 1%. */
export function formatRatePct(pct: number): string {
  return `${roundLegRatePct(pct)}%`;
}

/** The brand's own statement, read off the effective-rate row that carries it. */
export function statedFromEffective(leg: EffectiveLegRate): StatedLegRate {
  return {
    fromStep: leg.fromStep,
    toStep: leg.toStep,
    stated: leg.manualRatePct !== null,
    ratePct: leg.manualRatePct,
  };
}

/**
 * The value a rate field OPENS with: the brand's own statement, else the rate the
 * product prices on (measured or the industry benchmark) as a prefill, so the box and
 * the source line beside it always name the same number. A prefill is only shown; it is written only if
 * the person edits the field or confirms it (see `legRatePatch`, which sends
 * nothing for an leg the form never touched).
 */
export function rateFieldSeed(leg: EffectiveLegRate): string {
  const value = leg.manualRatePct ?? leg.effectiveRatePct;
  return value === null ? "" : String(roundLegRatePct(value));
}

/**
 * A measured rate names the population it was read on. A leg the client's own
 * sales team runs is measured on their whole CRM; a leg only our outreach can
 * observe is measured on our leads. With no basis stated it reads as it always did.
 */
function measuredLabel(measured: EffectiveLegRate["measured"]): string {
  const n = measured.fromReached ?? 0;
  if (measured.basis === "crm") return `Measured on ${n} contacts in your CRM`;
  if (measured.basis === "our_leads") return `Measured on ${n} of our leads`;
  return `Measured on ${n} leads`;
}

/**
 * Where the number the product prices on came from, in words. Read off the
 * producer's `source`; a source this app does not know yet is named as it came,
 * rather than dressed as one it does.
 */
export function rateSourceLabel(leg: EffectiveLegRate): string {
  switch (leg.source) {
    case "measured":
      return measuredLabel(leg.measured);
    case "manual":
      return "Your value";
    case "default":
      return "Industry benchmark";
    case null:
      return "No rate yet";
    default:
      return leg.source;
  }
}

// ─── Asked or measured (owner 2026-11-13, SCRIPT-VALUE-RATING-1113) ──────────
//
// The client types only the rates our ledger cannot measure for the brand; a measured
// rate is shown, never asked. features-service decides which (`ask`); this module only
// joins its legs to the editor's rows on brand-service's own step words.

/** The rate-sources legs keyed like the editor's rows (`legId`). */
export function rateSourcesByLeg(legs: RateSourceLeg[]): Map<string, RateSourceLeg> {
  const byLeg = new Map<string, RateSourceLeg>();
  for (const leg of legs) {
    const id = legId(leg);
    if (!byLeg.has(id)) byLeg.set(id, leg);
  }
  return byLeg;
}

/**
 * The value an ASKED rate field opens with: what the client stated, else the default
 * the producer serves as the prefill. Shown only; written when the person edits it.
 */
export function askedFieldSeed(src: RateSourceLeg): string {
  const value = src.statedRatePct ?? src.defaultRatePct;
  return value === null ? "" : String(roundLegRatePct(value));
}

/**
 * Where a MEASURED rate comes from, in one plain sentence, built on the brand's own
 * ledger counts and brand-service's step word: "Measured on your own results: 3 of 12
 * reached Meeting booked." `null` when the producer sent no counts (the caller says so).
 */
export function measuredSourceSentence(src: RateSourceLeg): string | null {
  if (!src.ledger) return null;
  return `Measured on your own results: ${src.ledger.ledUnits} of ${src.ledger.consumedUnits} reached ${src.toStep}.`;
}

/**
 * Where the number in an ASKED field comes from, in words: the client's own value, else
 * the default the producer prefills (the leg's industry benchmark, or what our campaigns
 * measured across clients on that step). A source this app does not know is named as it came.
 */
export function askedSourceLabel(src: RateSourceLeg): string {
  if (src.statedRatePct !== null) return "Your value";
  if (src.defaultRatePct === null) return "No rate yet";
  if (src.defaultSource === "fleet_measured") return "Measured across our campaigns";
  if (src.defaultSource === "leg_default") return "Industry benchmark";
  return src.defaultSource ?? "Default";
}
