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

import type { BrandArrowRatePatch, BrandFunnelArrowRate } from "./api";

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
  arrows: BrandFunnelArrowRate[],
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
