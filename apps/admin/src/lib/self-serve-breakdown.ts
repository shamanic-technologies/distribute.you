/**
 * THE TERMS BEHIND THE SaaS RUN-RATE — one row per self-serve brand, and which of
 * the four conditions kept each one out.
 *
 * The figure above this table is a SUM over the customers who were earning, so the
 * only honest way to explain it is to show the addends. A brand's budget counts on
 * a day only when ALL of: billing is active, its campaign is running, an amount is
 * in force, and it still has people to contact. features-service evaluates that
 * rule and serves the rows; this module orders them and turns the producer's
 * exclusion token into a sentence. It computes NO money — the reconciliation check
 * below exists to prove that, not to derive anything.
 *
 * WHY ONLY THE FUNDED ROWS ARE SHOWN. The producer serves every self-serve brand
 * it knows about, and most carry no budget at all — 30 of 37 in production the day
 * this shipped. A brand with no amount configured cannot contribute to a run-rate
 * whatever its other conditions say, so listing it is noise on a table whose whole
 * subject is money. The count is STATED rather than dropped silently, because a
 * table that quietly shows 7 of 37 rows invites the reader to wonder what it hid.
 *
 * Alias-free on purpose (the one import is type-only and erased at build), so it
 * carries real unit tests rather than source-substring guards. Keep it that way.
 */

/** A row exactly as features-service serves it. Structural, so this module imports nothing. */
export interface SelfServeBrandRow {
  orgId: string;
  brandId: string;
  brandName: string | null;
  brandDomain: string | null;
  /** The amount in force on the reference date. `null` = the producer holds no amount. */
  configuredDailyBudgetUsd: number | null;
  paymentActive: boolean;
  campaignRunning: boolean;
  /** `null` when the producer never got far enough to ask — an earlier condition already failed. */
  audienceAvailable: boolean | null;
  amountInForce: boolean;
  countedMrrUsd: number;
  /** The producer's own token for the condition that excluded the row; `null` when counted. */
  excludedBy: string | null;
  basis: "recorded" | "approximated";
}

export interface SelfServeBreakdown {
  referenceDate: string;
  countedMrrUsd: number;
  configuredMrrUsd: number;
  rows: SelfServeBrandRow[];
}

/**
 * The producer's exclusion tokens, in sentences a reader can act on.
 *
 * An UNKNOWN token is rendered verbatim rather than blanked: the producer owns this
 * vocabulary and may widen it, and a row that reads "" says the brand was excluded
 * for no reason — which is the one thing that is never true.
 */
const EXCLUSION_SENTENCE: Record<string, string> = {
  campaign_not_running: "No campaign running",
  payment_stopped: "Payment stopped",
  no_recent_activity: "No recent activity",
  no_recorded_amount: "No amount recorded",
  audience_exhausted: "Audiences exhausted",
};

/** The sentence for a row's exclusion, or null when the row is counted. Pure. */
export function exclusionReason(row: SelfServeBrandRow): string | null {
  if (row.excludedBy === null) return null;
  return EXCLUSION_SENTENCE[row.excludedBy] ?? row.excludedBy;
}

/** What to call a brand: its name, else its domain, else its id. Never blank. Pure. */
export function brandLabel(row: SelfServeBrandRow): string {
  return row.brandName?.trim() || row.brandDomain?.trim() || row.brandId;
}

/**
 * The rows with money at stake — a budget actually in force. Ordered so the reader
 * meets the customers who ARE the run-rate first: counted money descending, then
 * the excluded ones by what they would have been worth, then by name so the order
 * is stable between polls rather than shuffling on ties. Pure.
 */
export function fundedRows(breakdown: SelfServeBreakdown): SelfServeBrandRow[] {
  return breakdown.rows
    .filter((r) => (r.configuredDailyBudgetUsd ?? 0) > 0)
    .slice()
    .sort(
      (a, b) =>
        b.countedMrrUsd - a.countedMrrUsd ||
        (b.configuredDailyBudgetUsd ?? 0) - (a.configuredDailyBudgetUsd ?? 0) ||
        brandLabel(a).localeCompare(brandLabel(b))
    );
}

/** How many self-serve brands carry no budget at all — stated under the table, never hidden. Pure. */
export function unfundedCount(breakdown: SelfServeBreakdown): number {
  return breakdown.rows.filter((r) => (r.configuredDailyBudgetUsd ?? 0) <= 0).length;
}

/**
 * Do the rows add up to the total the producer serves beside them?
 *
 * This is the table's whole claim — it explains a figure, so it has to reproduce it.
 * It is a CHECK, never a source: the displayed total is always the producer's own
 * `countedMrrUsd`, and a false here means the rows are wrong, not the total. Summed
 * over EVERY row, including the unfunded ones the table does not draw, because a
 * row contributing money while carrying no budget would be exactly the bug worth
 * catching. Compared on whole cents so floating-point noise is not read as drift.
 */
export function breakdownReconciles(breakdown: SelfServeBreakdown): boolean {
  const summed = breakdown.rows.reduce((sum, r) => sum + r.countedMrrUsd, 0);
  return Math.round(summed * 100) === Math.round(breakdown.countedMrrUsd * 100);
}
