"use client";

import { CmgrStat } from "@/components/cmgr-stat";
import { PeriodCompoundChart, type PeriodCompoundPoint } from "@/components/period-compound-chart";
import { Skeleton } from "@/components/skeleton";
import type { CompoundGrowthSummary } from "@/lib/compound-growth";

/**
 * The one chart card every period surface on /metrics draws: a title, the
 * compound-growth headline, and the bar+line chart under it.
 *
 * It exists because the Overview states the same eight charts the four other tabs
 * state, and a second copy of a card is how two surfaces come to render one figure
 * two different ways within a release. Every tab now calls this, so a change to the
 * card reaches all of them at once.
 *
 * Callers map their own buckets to points and pass their own summary — the card
 * derives nothing, which is what keeps it usable for counts, rates and money alike.
 */
export function PeriodCompoundCard({
  title,
  subtitle,
  cmgrLabel,
  cmgrUnit,
  summary,
  data,
  valueLabel,
  growthLabel,
  formatValue,
  formatAxis,
  pending = false,
}: {
  title: string;
  subtitle: string;
  cmgrLabel: string;
  cmgrUnit: "weekly" | "monthly";
  summary: CompoundGrowthSummary;
  data: PeriodCompoundPoint[];
  valueLabel: string;
  growthLabel: string;
  formatValue?: (n: number) => string;
  formatAxis?: (n: number) => string;
  pending?: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
      <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      <div className="mt-4">
        {pending ? (
          <Skeleton className="h-16 w-32 rounded" />
        ) : (
          <CmgrStat
            latestPct={summary.latestPct}
            avgPct={summary.avgPct}
            barsUsed={summary.barsUsed}
            label={cmgrLabel}
            unit={cmgrUnit}
          />
        )}
      </div>
      <div className="mt-5">
        {pending ? (
          <Skeleton className="h-[280px] w-full rounded" />
        ) : (
          <PeriodCompoundChart
            data={data}
            valueLabel={valueLabel}
            growthLabel={growthLabel}
            formatValue={formatValue}
            formatAxis={formatAxis}
          />
        )}
      </div>
    </div>
  );
}
