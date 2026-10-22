"use client";

import { formatUsdAdaptive } from "@/lib/format-number";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { formatRatePct } from "@/lib/brand-conversion-rates";
import type { LiveWorkflowRow } from "@/lib/live-workflow-rows";
import { CatalogueName } from "@/components/v2/catalogue-name";

/**
 * The live-ranking cells, drawn ONE way for both tables that state them: Research (the fleet)
 * and the brand's Workflows page (one campaign). Two copies of a Status or ROI cell is how the
 * two surfaces would come to state one workflow two ways.
 */

export const LIVE_TH = "k-label px-3 py-2.5 text-left font-medium first:pl-4 last:pr-4";

/** The strip above a live table: it is live, what goes first, where the money goes. */
export function LiveRankingStrip({
  rows,
  moneyNote,
  nameOf = (r) => r.name ?? r.slug,
}: {
  rows: readonly LiveWorkflowRow[];
  moneyNote: string;
  nameOf?: (r: LiveWorkflowRow) => string;
}) {
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
          Goes first: <CatalogueName kind="workflow" name={firstRow.name ?? firstRow.slug} label={nameOf(firstRow)} className="k-fg align-middle font-medium" />
        </span>
      )}
      <span>
        Money goes to:{" "}
        {cashRow ? (
          <CatalogueName kind="workflow" name={cashRow.name ?? cashRow.slug} label={nameOf(cashRow)} className="k-fg align-middle font-medium" />
        ) : (
          <span className="k-fg3">{moneyNote}</span>
        )}
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

/** The live-ranking column heads, in their one order. No `costLabel` means no cost column: the
 *  brand's Workflows page already states the campaign's cost in its Offer column, so a second
 *  column there repeats it (owner, 2026-09-30). */
export function LiveWorkflowHeads({
  costLabel,
  compact = false,
  maturityLabel = "Status",
}: {
  costLabel?: string;
  compact?: boolean;
  /** Research names it "Maturity": its own Status column is the workflow's Active / Deprecated. */
  maturityLabel?: string;
}) {
  // `compact`: the narrower widths a fixed-layout table needs to fit the viewport (Research).
  const w = compact
    ? { cost: "w-20", status: "w-24", roi: "w-14", rate: "w-14", outcomes: "w-20", invested: "w-20" }
    : { cost: "w-32", status: "w-28", roi: "w-20", rate: "w-20", outcomes: "w-24", invested: "w-24" };
  return (
    <>
      {costLabel && <th className={`${LIVE_TH} ${w.cost} text-right`}>{costLabel}</th>}
      <th className={`${LIVE_TH} ${w.status}`}>{maturityLabel}</th>
      <th className={`${LIVE_TH} ${w.roi} text-right`}>ROI</th>
      <th className={`${LIVE_TH} ${w.rate} text-right`}>Rate</th>
      <th className={`${LIVE_TH} ${w.outcomes} text-right`}>Outcomes</th>
      <th className={`${LIVE_TH} ${w.invested} text-right`}>Invested</th>
    </>
  );
}

const DASH = <span className="k-fg4">—</span>;

/** The live-ranking cells, in the heads' order. The status is the workflow's verdict and is always
 *  stated; the figures are the scope's own, and a scope that never ran the workflow states dashes. */
export function LiveWorkflowCells({ row, showCost = true }: { row: LiveWorkflowRow | undefined; showCost?: boolean }) {
  const ran = Boolean(row?.ran);
  return (
    <>
      {showCost && (
        <td className="px-3 text-right tabular-nums">{!ran || row!.costPerOutcomeUsd == null ? DASH : formatUsdAdaptive(row!.costPerOutcomeUsd)}</td>
      )}
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
      <td className="px-3 text-right tabular-nums">{!ran || row!.conversionRatePct == null ? DASH : formatRatePct(row!.conversionRatePct)}</td>
      <td className="px-3 text-right tabular-nums">{!ran || row!.outcomes == null ? DASH : Math.round(row!.outcomes).toLocaleString("en-US")}</td>
      <td className="px-3 pr-4 text-right tabular-nums">{!ran || row!.spentUsd == null ? DASH : formatUsdAdaptive(row!.spentUsd)}</td>
    </>
  );
}
