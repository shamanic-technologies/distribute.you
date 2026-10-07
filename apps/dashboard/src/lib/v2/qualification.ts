/**
 * Words and formatting for an offer's qualification checks (Targeting > Qualification and a
 * person's Checks block). Alias-free so it carries real unit tests. Every figure here is
 * SERVED by lead-service; this module only formats it.
 */

export type QualificationModeWord = "mention" | "must_pass";
export type LeadCheckVerdictWord = "yes" | "no" | "unavailable" | "not_checked";

/**
 * The role a check plays (owner 2026-10-07): a HARD FILTER (a company that fails is skipped)
 * or a BONUS (a plus, never required). Either way the result is context for the writer, which
 * is never obliged to cite it: each template decides.
 */
export const ROLE_LABEL: Record<QualificationModeWord, string> = {
  must_pass: "Hard filter",
  mention: "Bonus",
};

/** One line under each role in its menu. */
export const ROLE_HINT: Record<QualificationModeWord, string> = {
  must_pass: "Companies that fail are skipped.",
  mention: "A plus, never required.",
};

/** The (i) on Cost per lead: the served figure is an estimate. */
export const COST_PER_LEAD_TIP = "An estimate. It changes over time and from one lead to another.";

/** Said where a Filter is turned on: it moves who is reached on every audience of the offer. */
export const FILTER_SCOPE_LINE = "Companies that fail are skipped on every audience of this offer, from now on.";

export const VERDICT_LABEL: Record<LeadCheckVerdictWord, string> = {
  yes: "Yes",
  no: "No",
  unavailable: "Could not check",
  not_checked: "Not checked yet",
};

/**
 * A check's cost per lead. It is a fraction of a cent most of the time, so it keeps two
 * significant digits under one cent ("$0.0042") instead of rounding to "$0.00".
 */
export function formatCostPerLead(usd: number): string {
  if (!Number.isFinite(usd) || usd < 0) throw new Error(`[qualification] cost per lead is not a price: ${usd}`);
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${Number(usd.toPrecision(2)).toString()}`;
  return `$${usd.toFixed(2)}`;
}

/** The served pass rate (0..1) as a whole percent; null when nobody was checked yet. */
export function formatPassRate(rate: number | null): string | null {
  if (rate == null) return null;
  return `${Math.round(rate * 100)}%`;
}

/** Status word of a check: what it is now, or Suggested for an AI pick never turned on. */
export function criterionStatusWord(c: { enabled: boolean; origin: string }): "On" | "Suggested" | "Off" {
  if (c.enabled) return "On";
  return c.origin === "suggested" ? "Suggested" : "Off";
}

/** On first, then the served order (stable). */
export function sortCriteria<T extends { enabled: boolean }>(rows: readonly T[]): T[] {
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => Number(b.row.enabled) - Number(a.row.enabled) || a.i - b.i)
    .map((x) => x.row);
}
