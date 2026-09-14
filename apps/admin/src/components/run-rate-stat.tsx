import { PERIOD_NOUN, type CmgrUnit } from "@/components/cmgr-stat";
import { formatGrowthPct } from "@/lib/format-number";

/**
 * Headline for a RUN-RATE chart (MRR): the value leads, the growth rate follows.
 *
 * `CmgrStat` beside it is the headline for a FLOW — cash collected, revenue
 * consumed — where the last bar is a period still filling up, so the number worth
 * stating is a rate and the current bar is excluded from it. A run-rate is a
 * STOCK: the last bar IS what the fleet is worth per month today, and it equals
 * the live figure the card above the chart already states. Leading with a rate
 * there described an old period and, on a three-month series, printed a trough as
 * though it were the trend.
 *
 * So: the value on top, formatted by the caller (the money formatter is the page's,
 * not this component's), and one compound rate under it — anchored on the first bar
 * and ending on the LAST bar, today included — with the span it compounds over. A
 * compound rate means nothing without its span, which is why the noun map is shared
 * with `CmgrStat` rather than restated here.
 */
export function RunRateStat({
  valueUsd,
  valueLabel,
  cmgrPct,
  cmgrLabel,
  unit,
  barsUsed,
  formatValue,
}: {
  valueUsd: number | null;
  valueLabel: string;
  cmgrPct: number | null;
  cmgrLabel: string;
  unit: CmgrUnit;
  barsUsed: number | null;
  formatValue: (n: number) => string;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-semibold text-gray-950">
          {valueUsd === null ? "—" : formatValue(valueUsd)}
        </p>
        <span className="text-sm font-semibold text-brand-500">{valueLabel}</span>
      </div>
      <p className="mt-0.5 text-xs text-gray-400">
        {cmgrPct === null ? (
          // Not "—": a dash beside a growth label reads as a rate we measured at
          // nothing. One bar of history is not a rate at all, and saying so is
          // shorter than a reader working it out from the chart.
          "Not enough history yet to state a growth rate"
        ) : (
          <>
            {formatGrowthPct(cmgrPct)} {cmgrLabel}
            {barsUsed !== null && ` (${PERIOD_NOUN[unit]} #${barsUsed})`} since inception
          </>
        )}
      </p>
    </div>
  );
}
