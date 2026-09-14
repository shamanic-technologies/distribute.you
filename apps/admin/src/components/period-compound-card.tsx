"use client";

import type { ReactNode } from "react";
import { CmgrStat } from "@/components/cmgr-stat";
import { PeriodCompoundChart, type PeriodCompoundPoint } from "@/components/period-compound-chart";
import { Skeleton } from "@/components/skeleton";
import type { CompoundGrowthSummary } from "@/lib/compound-growth";

/**
 * Exactly ONE headline shape, and the union is what enforces it.
 *
 * Nearly every chart on /metrics headlines a compound growth rate, so that stays
 * the default: pass the summary and the two labels and the card renders `CmgrStat`.
 * A run-rate chart headlines its latest VALUE instead (see `RunRateStat`), which is
 * a different statement rather than a different wording — so it passes a ready
 * `headline` and none of the CMGR props. `never` on the other branch's fields is
 * what stops a caller passing both and leaving which-one-wins to whoever next reads
 * this file.
 */
type HeadlineProps =
  | {
      summary: CompoundGrowthSummary;
      cmgrLabel: string;
      cmgrUnit: "weekly" | "monthly";
      headline?: never;
    }
  | {
      headline: ReactNode;
      summary?: never;
      cmgrLabel?: never;
      cmgrUnit?: never;
    };

type PeriodCompoundCardProps = {
  title: string;
  subtitle: string;
  data: PeriodCompoundPoint[];
  valueLabel: string;
  growthLabel: string;
  formatValue?: (n: number) => string;
  formatAxis?: (n: number) => string;
  pending?: boolean;
} & HeadlineProps;

/**
 * The one chart card every period surface on /metrics draws: a title, a headline,
 * and the bar+line chart under it.
 *
 * It exists because the Overview states the same eight charts the four other tabs
 * state, and a second copy of a card is how two surfaces come to render one figure
 * two different ways within a release. Every tab calls this, so a change to the
 * card reaches all of them at once.
 *
 * Callers map their own buckets to points and pass their own summary — the card
 * derives nothing, which is what keeps it usable for counts, rates and money alike.
 */
export function PeriodCompoundCard(props: PeriodCompoundCardProps) {
  const { title, subtitle, data, valueLabel, growthLabel, formatValue, formatAxis, pending = false } = props;

  // Narrowed on `summary`, never on `headline`: `ReactNode` already includes
  // `undefined`, so a `headline !== undefined` test cannot separate the branches
  // and the CMGR side would come out possibly-undefined.
  const headline =
    props.summary !== undefined ? (
      <CmgrStat
        latestPct={props.summary.latestPct}
        avgPct={props.summary.avgPct}
        barsUsed={props.summary.barsUsed}
        label={props.cmgrLabel}
        unit={props.cmgrUnit}
      />
    ) : (
      props.headline
    );

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
      <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
      <div className="mt-4">{pending ? <Skeleton className="h-16 w-32 rounded" /> : headline}</div>
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
