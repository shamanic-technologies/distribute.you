/**
 * Compound growth rate (CMGR / CWGR) of a per-period value series, since inception.
 *
 * For each index i: `((v_i / v_base) ^ (1/n) - 1) * 100`, where `v_base` is the
 * first value > 0 (the anchor) and `n` is the number of periods since the anchor.
 * Anchoring on the first non-zero value avoids the zero-base blowup. Values are
 * per-period counts (a flow), never cumulative. Null for the anchor itself and
 * any leading zero periods.
 */
export function compoundGrowthSeries(values: number[]): Array<number | null> {
  const baseIndex = values.findIndex((v) => v > 0);
  const baseValue = baseIndex >= 0 ? values[baseIndex] : 0;
  return values.map((value, index) => {
    const periods = baseIndex >= 0 ? index - baseIndex : -1;
    if (!(baseValue > 0) || periods < 1) return null;
    return Number(((Math.pow(value / baseValue, 1 / periods) - 1) * 100).toFixed(1));
  });
}

/**
 * Headline + average compound growth rate for a series, excluding the current
 * (still-in-progress, partial) period = the last element.
 * - `latestPct` — compound rate up to the last CONCLUDED period.
 * - `avgPct` — mean of every non-null compound-rate point, excluding the current period.
 */
export function compoundGrowthSummary(
  cmgr: Array<number | null>,
): { latestPct: number | null; avgPct: number | null } {
  if (cmgr.length < 2) return { latestPct: null, avgPct: null };
  const concluded = cmgr.slice(0, -1); // drop the current partial period
  const latestPct = concluded[concluded.length - 1] ?? null;
  const points = concluded.filter((v): v is number => v !== null);
  const avgPct =
    points.length > 0
      ? Number((points.reduce((sum, v) => sum + v, 0) / points.length).toFixed(1))
      : null;
  return { latestPct, avgPct };
}
