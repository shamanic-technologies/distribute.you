/**
 * Accounting cost-per-outcome "so far" floor (USD cents).
 *
 * features-service returns the REAL cost-per-outcome (`cpprCents`, …) as
 * committed-net-spend ÷ outcomes, and NULLs it when the outcome count is 0 (no
 * denominator). On an ACCOUNTING surface (brand Overview outreach cards, top of
 * Leads, the Top-3-audiences card, the Audiences table) a null there renders "—",
 * which HIDES real money already spent — the exact bug the brand Overview shows
 * ("Total spent $94" next to "Cost per positive reply —").
 *
 * When the outcome count is 0 but net committed spend exists, the honest "cost so
 * far" IS the net committed spend itself (spent ÷ max(count, 1) = spent) — the SAME
 * net figure the page already renders as "Total spent". This floors the DISPLAY to
 * that value. It is a pure re-display of a net-spend field already in the payload:
 * at 0 outcomes NO ratio is computed (floor === spend), so this is not a client-side
 * metric derivation. Once a real outcome lands, features' non-null ratio wins
 * automatically (the raw `costCents` is returned unchanged). Returns null only when
 * there is genuinely no spend to report.
 *
 * NB: `netSpentCents` must be the SAME committed-net basis as `costCents` (both
 * come from a `pricing=net` payload), so the floor is coherent with billing and with
 * the "Total spent" tile.
 */
export function costSoFarFloorCents(
  costCents: number | null | undefined,
  netSpentCents: number | null | undefined,
  outcomeCount: number | null | undefined,
): number | null {
  if (costCents != null) return costCents;
  if ((outcomeCount ?? 0) === 0 && (netSpentCents ?? 0) > 0) {
    return netSpentCents as number;
  }
  return null;
}
