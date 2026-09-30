"use client";

import { formatUsdAdaptive } from "@/lib/format-number";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import type { LiveWorkflowRow } from "@/lib/live-workflow-rows";

/**
 * The live-ranking cells, drawn ONE way for both tables that state them: Research (the fleet)
 * and the brand's Workflows page (one mission). Two copies of a Status or ROI cell is how the
 * two surfaces would come to state one workflow two ways.
 */

export const LIVE_TH = "k-label px-3 py-2.5 text-left font-medium first:pl-4 last:pr-4";

/** The strip above a live table: it is live, what goes first, where the money goes. */
export function LiveRankingStrip({ rows, moneyNote }: { rows: readonly LiveWorkflowRow[]; moneyNote: string }) {
  const firstRow = rows.find((r) => r.first);
  const cashRow = rows.find((r) => r.cash);
  return (
    <div className="k-fg2 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--line-subtle)] px-4 py-2.5 text-[12px]">
      <span className="inline-flex items-center gap-1.5">
        <span className="k-dot-pulse h-1.5 w-1.5 rounded-full bg-[var(--run)] text-[var(--run)]" />
        Live ranking
      </span>
      {firstRow && (
        <span>
          Goes first: <span className="k-fg font-medium">{firstRow.name ?? firstRow.slug}</span>
        </span>
      )}
      <span>
        Money goes to:{" "}
        {cashRow ? <span className="k-fg font-medium">{cashRow.name ?? cashRow.slug}</span> : <span className="k-fg3">{moneyNote}</span>}
      </span>
    </div>
  );
}

/** The two chips a row may wear beside its name. */
export function LiveWorkflowChips({ row }: { row: LiveWorkflowRow }) {
  return (
    <>
      {row.first && <span className="k-chip shrink-0">Goes first</span>}
      {row.cash && <span className="k-chip shrink-0 text-[var(--run)]">Money goes here</span>}
    </>
  );
}

/** The live-ranking column heads, in their one order. */
export function LiveWorkflowHeads({ costLabel }: { costLabel: string }) {
  return (
    <>
      <th className={`${LIVE_TH} w-32 text-right`}>{costLabel}</th>
      <th className={`${LIVE_TH} w-28`}>Status</th>
      <th className={`${LIVE_TH} w-20 text-right`}>ROI</th>
      <th className={`${LIVE_TH} w-20 text-right`}>Rate</th>
      <th className={`${LIVE_TH} w-24 text-right`}>Outcomes</th>
      <th className={`${LIVE_TH} w-24 text-right`}>Invested</th>
    </>
  );
}

const DASH = <span className="k-fg4">—</span>;

/** The live-ranking cells, in the heads' order. The status is the workflow's verdict and is always
 *  stated; the figures are the scope's own, and a scope that never ran the workflow states dashes. */
export function LiveWorkflowCells({ row }: { row: LiveWorkflowRow | undefined }) {
  const ran = Boolean(row?.ran);
  return (
    <>
      <td className="px-3 text-right tabular-nums">{!ran || row!.costPerOutcomeUsd == null ? DASH : formatUsdAdaptive(row!.costPerOutcomeUsd)}</td>
      <td className="px-3">
        {row?.mature === true ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--data-teal)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--data-teal)]" />
            Mature
          </span>
        ) : row?.mature === false ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--data-amber)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--data-amber)]" />
            Learning
          </span>
        ) : (
          DASH
        )}
      </td>
      <td className={`px-3 text-right tabular-nums ${ran && roiIsGood(row!.roiMultiple) ? "text-[var(--data-teal)]" : ""}`}>
        {ran ? formatRoi(row!.roiMultiple, "—") : DASH}
      </td>
      <td className="px-3 text-right tabular-nums">{!ran || row!.conversionRatePct == null ? DASH : `${row!.conversionRatePct.toFixed(2)}%`}</td>
      <td className="px-3 text-right tabular-nums">{!ran || row!.outcomes == null ? DASH : Math.round(row!.outcomes).toLocaleString("en-US")}</td>
      <td className="px-3 pr-4 text-right tabular-nums">{!ran || row!.spentUsd == null ? DASH : formatUsdAdaptive(row!.spentUsd)}</td>
    </>
  );
}
