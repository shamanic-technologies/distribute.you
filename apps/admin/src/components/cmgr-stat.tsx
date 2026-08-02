import { formatGrowthPct } from "@/lib/format-number";

function formatCmgr(value: number | null): string {
  if (value === null) return "—";
  return formatGrowthPct(value);
}

/** The period noun read off the unit, so the two can never name different periods. */
const PERIOD_NOUN: Record<CmgrUnit, string> = { weekly: "Week", monthly: "Month" };

type CmgrUnit = "weekly" | "monthly";

/**
 * Compound-growth headline shown above a period chart. The big number is the
 * CMGR/CWGR up to the last CONCLUDED period; the faint line below is the average
 * of the whole plotted line — both excluding the current (partial) period. The
 * `label` (e.g. "CMGR" / "CWGR") sits beside the number so the reader knows what
 * the percentage is, and `barsUsed` states how many bars that rate spans
 * ("CWGR (Week #5)") — a compound rate means nothing without its span. It is
 * dropped when null: there is no rate to qualify.
 */
export function CmgrStat({
  latestPct,
  avgPct,
  label,
  unit,
  barsUsed,
}: {
  latestPct: number | null;
  avgPct: number | null;
  label: string;
  unit: CmgrUnit;
  barsUsed: number | null;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-semibold text-gray-950">{formatCmgr(latestPct)}</p>
        <span className="text-sm font-semibold text-brand-500">
          {label}
          {barsUsed !== null && ` (${PERIOD_NOUN[unit]} #${barsUsed})`}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-gray-400">
        {formatCmgr(avgPct)} average {unit} since inception
      </p>
    </div>
  );
}
