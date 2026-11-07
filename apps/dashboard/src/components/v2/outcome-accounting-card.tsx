"use client";

import { formatCount, formatUsdAdaptive } from "@/lib/format-number";
import { formatRatePct } from "@/lib/brand-conversion-rates";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { stepLabel } from "@/lib/legs";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { accountingReasonWords, varianceTone, type OutcomeAccounting } from "@/lib/v2/outcome-accounting";
import { RoiLabel } from "@/components/v2/roi-label";

/**
 * OUTCOME-ACCOUNTING-1107 (owner 2026-11-07, « comptabilité analytique industrielle … les chiffres réels comme les
 * chiffres expected », every Outcome page): ONE card, each served figure ACTUAL beside EXPECTED with the gap between them.
 * Rows: cost per Unit (gap split into yield and mix), cost from Start, yield into the next milestone, expected NET value,
 * and a return ONLY when the outcome is a campaign's Target (framework: never a return below a Target). Our Units only;
 * the client's team's Units are counted apart. Nothing is computed here.
 */

const DASH = <span className="k-fg4">—</span>;

function Reason({ reason }: { reason: string | null | undefined }) {
  if (!reason) return DASH;
  return <span className="k-fg3 text-[12px] font-normal">{accountingReasonWords(reason)}</span>;
}

function Usd({ usd, reason }: { usd: number | null; reason?: string | null }) {
  return usd == null ? <Reason reason={reason} /> : <>{formatUsdAdaptive(usd)}</>;
}

function Pct({ pct, reason }: { pct: number | null; reason?: string | null }) {
  return pct == null ? <Reason reason={reason} /> : <>{formatRatePct(pct)}</>;
}

function Gap({ usd }: { usd: number | null }) {
  if (usd == null) return DASH;
  const tone = varianceTone(usd);
  const color = tone === "good" ? "text-[var(--run)]" : tone === "bad" ? "text-[var(--data-rose)]" : "";
  return (
    <span className={color}>
      {usd > 0 ? "+" : usd < 0 ? "−" : ""}
      {formatUsdAdaptive(Math.abs(usd))}
    </span>
  );
}

function Row({ label, sub, actual, expected, gap }: { label: React.ReactNode; sub?: React.ReactNode; actual: React.ReactNode; expected: React.ReactNode; gap?: React.ReactNode }) {
  return (
    <tr className="k-line-subtle border-b align-top last:border-b-0">
      <td className="px-3 py-2.5 pl-4">
        <div className="text-[13px]">{label}</div>
        {sub && <div className="k-fg3 mt-0.5 text-[12px]">{sub}</div>}
      </td>
      <td className="px-3 py-2.5 text-right text-[15px] font-medium tabular-nums">{actual}</td>
      <td className="px-3 py-2.5 text-right text-[15px] tabular-nums">{expected}</td>
      <td className="px-3 py-2.5 pr-4 text-right text-[13px] tabular-nums">{gap ?? DASH}</td>
    </tr>
  );
}

export function OutcomeAccountingCard({
  accounting,
  unit,
  units,
  clientTeamUnits,
}: {
  accounting: OutcomeAccounting;
  /** "post", "signup" */
  unit: string;
  /** "posts", "signups" */
  units: string;
  /** How many Units the client's own team made (counted apart, $0 to us); omitted when the outcome has none. */
  clientTeamUnits?: number;
}) {
  const catalogue = useLegCatalogue();
  const { costPerUnit: c, costFromStart: s, yieldToNext: y, value: v, returns: r } = accounting;
  const next = y.nextStep ? (stepLabel(catalogue, y.nextStep) ?? y.nextStep) : null;
  const split = c.variance.yieldUsd != null && c.variance.mixUsd != null;
  // The return's two sides, realized and planned.
  const { measured: realized, expected: planned } = r;
  return (
    <div className="k-card overflow-hidden">
      <div className="flex flex-wrap items-baseline gap-x-2 px-4 pb-1 pt-3.5">
        <h2 className="text-[14px] font-medium">Actual and expected</h2>
        <span className="k-fg3 text-[12px]">
          {formatCount(c.actualUnits)} {c.actualUnits === 1 ? unit : units} made by us
        </span>
      </div>
      <div className="k-scroll overflow-x-auto">
        <table className="w-full min-w-[560px] table-fixed text-[13px]">
          <thead>
            <tr className="k-line-subtle border-b">
              <th className="k-label px-3 py-2.5 pl-4 text-left font-normal" />
              <th className="k-label w-[130px] px-3 py-2.5 text-right font-normal">Actual</th>
              <th className="k-label w-[130px] px-3 py-2.5 text-right font-normal">Expected</th>
              <th className="k-label w-[130px] px-3 py-2.5 pr-4 text-right font-normal">Gap</th>
            </tr>
          </thead>
          <tbody>
            <Row
              label={`Cost per ${unit}`}
              sub={
                split ? (
                  <>
                    Fewer or more {units} out: <Gap usd={c.variance.yieldUsd} /> · Price of the work: <Gap usd={c.variance.mixUsd} />
                  </>
                ) : (
                  `${formatUsdAdaptive(c.actualSpentUsd)} spent by us`
                )
              }
              actual={<Usd usd={c.actualUsd} reason={c.actualUnavailableReason} />}
              expected={<Usd usd={c.expectedUsd} reason={c.expectedUnavailableReason} />}
              gap={<Gap usd={c.variance.usd} />}
            />
            <Row
              label="Cost from the start"
              sub={s.rolledYieldPct != null ? `${formatRatePct(s.rolledYieldPct)} of tries end as a ${unit}` : undefined}
              actual={<Usd usd={s.actualUsd} reason={s.actualUnavailableReason} />}
              expected={<Usd usd={s.expectedUsd} reason={s.expectedUnavailableReason} />}
            />
            <Row
              label={next ? `Go on to ${next}` : "Go on to the next step"}
              sub={y.measuredNextUnits != null && y.measuredTrials != null ? `${formatCount(y.measuredNextUnits)} of ${formatCount(Math.round(y.measuredTrials))} so far` : undefined}
              actual={<Pct pct={y.measuredPct} reason={y.measuredUnavailableReason} />}
              expected={<Pct pct={y.expectedPct} reason={y.expectedUnavailableReason} />}
            />
            <Row
              label={`Value of one ${unit}`}
              sub="After the cost of the next steps"
              actual={<span className="k-fg3 text-[12px] font-normal">Expected only</span>}
              expected={<Usd usd={v.expectedNetPerUnitUsd} reason={v.unavailableReason} />}
            />
            {r.isCampaignTarget && (
              <Row
                label={<RoiLabel />}
                sub={realized.learning ? "Learning" : undefined}
                actual={realized.roiMultiple == null ? <Reason reason={realized.unavailableReason} /> : <span className={roiIsGood(realized.roiMultiple) ? "text-[var(--run)]" : ""}>{formatRoi(realized.roiMultiple)}</span>}
                expected={planned.roiMultiple == null ? <Reason reason={planned.unavailableReason} /> : <span className={roiIsGood(planned.roiMultiple) ? "text-[var(--run)]" : ""}>{formatRoi(planned.roiMultiple)}</span>}
              />
            )}
          </tbody>
        </table>
      </div>
      <div className="k-fg3 k-line-subtle border-t px-4 py-2.5 text-[12px] tabular-nums">
        {r.isCampaignTarget ? "Return counts what our campaigns made of this outcome." : `A return shows on the campaigns that aim at ${units}.`}
        {clientTeamUnits ? ` ${formatCount(clientTeamUnits)} ${clientTeamUnits === 1 ? unit : units} by your team sit apart, at $0 to us.` : ""}
      </div>
    </div>
  );
}
