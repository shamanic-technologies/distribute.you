"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getOfferPipelineGenerated } from "@/lib/api";
import { formatUsdAdaptive } from "@/lib/format-number";
import type { PipelineGenerated } from "@/lib/deals-board";
import { Figure, Shimmer, StatTile } from "@/components/v2/ui";

/**
 * TODAY'S MAIN CHART: PIPELINE GENERATED OVER TIME (owner 2026-11-07, PIPELINE-GENERATED-1107: « le main
 * graphe tout en haut ne doit pas être un graphe de cost »). The measured total is the headline, the
 * expected one sits smaller beside it; the measured cumulative line is solid, the expected days after
 * today dotted. Every figure is features-service's (`columns=pipeline_generated`, net): drawn, never summed.
 */
export function usePipelineGenerated(brandId: string, offerId: string | null) {
  return useAuthQuery(["pipelineGenerated", brandId, offerId ?? ""], () => getOfferPipelineGenerated(offerId!, brandId), {
    ...pollOptions,
    enabled: !!offerId,
  });
}

/** Served reasons in words, one short line each. */
function unvaluedWords(reason: string | null): string {
  if (reason === "no_client_value") return "Add what a client is worth to see it.";
  return "Not available yet.";
}

export function PipelineGeneratedTile({ brandId, offerId, className = "" }: { brandId: string; offerId: string | null; className?: string }) {
  const q = usePipelineGenerated(brandId, offerId);
  const d = q.data ?? null;
  const answered = q.data !== undefined;
  const failed = !answered && q.isFetchedAfterMount && q.isError;
  const expectedAhead = d && d.expectedUsd != null && d.measuredUsd != null && d.expectedUsd > d.measuredUsd;
  return (
    <StatTile label="Pipeline generated" note="Since you started" className={className}>
      {!answered ? (
        failed ? (
          <p className="k-fg3 text-[12px]">Could not read the pipeline. Retrying.</p>
        ) : (
          <Shimmer className="h-16 w-full" />
        )
      ) : !d || d.measuredUsd == null ? (
        <>
          <Figure value="—" />
          <p className="k-fg3 mt-1 text-[12px] leading-4">{unvaluedWords(d?.unvaluedReason ?? null)}</p>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <Figure value={formatUsdAdaptive(d.measuredUsd)} />
            {expectedAhead && (
              <span className="k-fg3 text-[12px] tabular-nums">
                {formatUsdAdaptive(d.expectedUsd!)} expected in {d.expectedHorizonDays} days
              </span>
            )}
          </div>
          <PipelineLine points={d.points} className="mt-auto h-14 pt-2" />
        </>
      )}
    </StatTile>
  );
}

/** Measured cumulative line solid, its expected continuation dotted from the last measured day. */
function PipelineLine({ points, className = "" }: { points: PipelineGenerated extends { points: infer P } ? P : never; className?: string }) {
  if (points.length < 2) return <div className={className} />;
  const w = 400;
  const h = 48;
  const max = Math.max(...points.map((p) => p.cumulativeUsd), 0) || 1;
  const xy = points.map((p, i) => [(i / (points.length - 1)) * w, h - 3 - (p.cumulativeUsd / max) * (h - 6)] as const);
  const lastMeasured = points.reduce((at, p, i) => (p.kind === "measured" ? i : at), -1);
  const path = (from: number, to: number) =>
    xy
      .slice(from, to + 1)
      .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");
  const measured = lastMeasured >= 1 ? path(0, lastMeasured) : null;
  const expected = lastMeasured >= 0 && lastMeasured < points.length - 1 ? path(lastMeasured, points.length - 1) : null;
  return (
    <div className={className}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-full w-full text-[var(--accent)]" aria-hidden="true">
        {measured && <path d={measured} fill="none" stroke="currentColor" strokeWidth="1.75" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />}
        {expected && (
          <path d={expected} fill="none" stroke="var(--fg-3)" strokeWidth="1.5" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        )}
      </svg>
    </div>
  );
}
