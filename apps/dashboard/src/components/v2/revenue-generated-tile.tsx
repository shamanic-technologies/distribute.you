"use client";

import { formatUsdAdaptive } from "@/lib/format-number";
import { realUnavailableWords, revenueLines, type RevenueGenerated, type RevenueGeneratedPoint } from "@/lib/revenue-generated";
import { Figure, Shimmer, StatTile } from "@/components/v2/ui";

/**
 * TODAY'S MAIN CHART: REVENUE GENERATED (owner 2026-11-07, REVENUE-GENERATED-1107: « le principal
 * chiffre [est] le réel revenu généré, et seulement secondaire est le expected. Idem avec la curve
 * solid or dotted »). The REAL revenue won is the headline and the solid line; the EXPECTED revenue
 * (the expected ROI beside it × the spend, so the two never contradict) sits smaller and dotted.
 * Every figure is features-service's (`revenueGenerated` on the offer's revenue read): drawn, never summed.
 */
export function RevenueGeneratedTile({
  pending,
  data,
  className = "",
}: {
  pending: boolean;
  data: RevenueGenerated | null;
  className?: string;
}) {
  return (
    <StatTile label="Revenue generated" note="Since you started" className={className}>
      {pending ? (
        <Shimmer className="h-16 w-full" />
      ) : !data || data.realUsd == null ? (
        <>
          <Figure value="—" />
          <p className="k-fg3 mt-1 text-[12px] leading-4">{realUnavailableWords(data?.realUnavailableReason ?? null)}</p>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <Figure value={formatUsdAdaptive(data.realUsd)} />
            {data.expectedToDateUsd != null && (
              <span className="k-fg3 text-[12px] tabular-nums">{formatUsdAdaptive(data.expectedToDateUsd)} expected</span>
            )}
          </div>
          <RevenueLines points={data.points} className="mt-auto h-14 pt-2" />
        </>
      )}
    </StatTile>
  );
}

/** Real revenue solid, expected revenue dotted, on one scale. */
function RevenueLines({ points, className = "" }: { points: RevenueGeneratedPoint[]; className?: string }) {
  const { real, expected } = revenueLines(points);
  if (points.length < 2) return <div className={className} />;
  const w = 400;
  const h = 48;
  const max = Math.max(0, ...real.map(([, v]) => v), ...expected.map(([, v]) => v)) || 1;
  const path = (line: Array<[number, number]>) =>
    line
      .map(([i, v], k) => `${k ? "L" : "M"}${((i / (points.length - 1)) * w).toFixed(1)},${(h - 3 - (v / max) * (h - 6)).toFixed(1)}`)
      .join(" ");
  return (
    <div className={className}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full text-[var(--accent)]" aria-hidden="true">
        {expected.length >= 2 && (
          <path d={path(expected)} fill="none" stroke="var(--fg-3)" strokeWidth="1.5" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        )}
        {real.length >= 2 && <path d={path(real)} fill="none" stroke="currentColor" strokeWidth="1.75" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />}
      </svg>
    </div>
  );
}
