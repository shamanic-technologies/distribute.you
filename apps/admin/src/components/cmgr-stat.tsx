import { formatGrowthPct } from "@/lib/format-number";

function formatCmgr(value: number | null): string {
  if (value === null) return "—";
  return formatGrowthPct(value);
}

/**
 * Compound-growth headline shown above a period chart. The big number is the
 * CMGR/CWGR up to the last CONCLUDED period; the faint line below is the average
 * of the whole plotted line — both excluding the current (partial) period. The
 * `label` (e.g. "CMGR" / "CWGR") sits beside the number so the reader knows what
 * the percentage is.
 */
export function CmgrStat({
  latestPct,
  avgPct,
  label,
  unit,
}: {
  latestPct: number | null;
  avgPct: number | null;
  label: string;
  unit: string;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-semibold text-gray-950">{formatCmgr(latestPct)}</p>
        <span className="text-sm font-semibold text-brand-500">{label}</span>
      </div>
      <p className="mt-0.5 text-xs text-gray-400">
        {formatCmgr(avgPct)} average {unit} since inception
      </p>
    </div>
  );
}
