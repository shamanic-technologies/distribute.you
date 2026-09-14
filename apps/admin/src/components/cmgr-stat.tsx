import { formatGrowthPct } from "@/lib/format-number";

function formatCmgr(value: number | null): string {
  if (value === null) return "—";
  return formatGrowthPct(value);
}

/** The period noun read off the unit, so the two can never name different periods. */
const PERIOD_NOUN: Record<CmgrUnit, string> = { weekly: "Week", monthly: "Month" };

type CmgrUnit = "weekly" | "monthly";

/**
 * Compound-growth headline shown above a period chart: ONE rate, the CMGR/CWGR
 * since inception, up to the last CONCLUDED period.
 *
 * The `label` (e.g. "CMGR" / "CWGR") sits beside the number so the reader knows
 * what the percentage is, `since inception` states the anchor it compounds from,
 * and `periodsSpanned` states how far that reaches ("CWGR since inception
 * (Week #10)") — a compound rate means nothing without its span. The span is
 * dropped when null: there is no rate to qualify.
 *
 * There is deliberately NO second line. It used to read "N% average <unit> since
 * inception" over the arithmetic mean of the plotted curve, which is not a
 * statistic (see `compound-growth.ts`) and printed the opposite sign to the
 * headline an inch above it.
 */
export function CmgrStat({
  latestPct,
  label,
  unit,
  periodsSpanned,
}: {
  latestPct: number | null;
  label: string;
  unit: CmgrUnit;
  periodsSpanned: number | null;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <p className="text-2xl font-semibold text-gray-950">{formatCmgr(latestPct)}</p>
      <span className="text-sm font-semibold text-brand-500">
        {label} since inception
        {periodsSpanned !== null && ` (${PERIOD_NOUN[unit]} #${periodsSpanned})`}
      </span>
    </div>
  );
}
