"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRoutePrefetch } from "@/lib/use-route-prefetch";
import { getOfferFunnels } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { formatUsdAdaptive } from "@/lib/format-number";
import { channelSlugLabel } from "@/lib/campaign-title";
import { campaignFunnel } from "@/lib/campaign-funnel";
import { normalizeSalesFunnelKey, type SalesFunnelKeyWire } from "@/lib/sales-funnels";
import { SalesFunnelMark } from "@/components/marks/sales-funnel-mark";
import { RoiCell, useCampaignRows } from "@/components/campaigns/campaigns-table";
import { getBrandSpendableBudget } from "@/lib/api";
import { spendableCampaignsForFunnel } from "@/lib/use-running-daily-budget";
import { fmtDailyBudgetUsd } from "@/lib/campaign-budget";
import { rollupStatus, ROLLUP_LABEL, ROLLUP_STYLE } from "@/lib/campaign-controls";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import { scopeIsLearning } from "@/lib/learning-threshold";
import { LearningTag } from "@/components/learning-tag";
import { usePausedByFunnel } from "@/lib/use-scope-paused";
import { scopePausedFor } from "@/lib/scope-paused";
import {
  funnelViews,
  costCoverageNote,
  summariseFunnels,
  unpricedFunnelReasonLabel,
} from "@/lib/offer-funnels";

const COLUMN_COUNT = 8;

const INVESTED_TIP =
  "What this funnel has cost all in: what we charged you, plus what you recorded for the steps your own team worked. The second half is never billed; it is here because a funnel you finish yourself would otherwise look cheaper than it is.";

const BUDGET_TIP =
  "The most this funnel may spend in a day: the ceilings of the campaigns selling it that are running right now. A paused campaign's ceiling is not in it — it still exists, but nothing will draw on it today. You change it in each campaign's settings.";

const STATUS_TIP =
  "Whether this funnel is reaching people right now. It is Active as soon as one campaign selling it is running, because that is the question a glance is asking; which campaigns run is what their own rows say.";

const FUNNEL_TIP =
  "A sales funnel is the path from a first signal to a paying client. It is the smallest scope whose money divides into a return, because what a customer is worth is only known at the end of it.";

function fmtUsd(value: number | null): string {
  return value === null ? "—" : formatUsdAdaptive(value);
}

function fmtPct(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

/**
 * An offer's sales funnels, one row each.
 *
 * The grain between the offer and its campaigns. A campaign buys one LEG of a funnel,
 * so it has a cost per step and no return of its own; the funnel is where a return
 * exists.
 *
 * Every figure is a served field. The rows deliberately do NOT sum to the offer: money
 * adds across funnels but people do not (a lead worked through two funnels is one lead)
 * and no ratio does, so the offer's own Overview stays the number to trust for "what did
 * this offer do".
 */
export function OfferFunnelsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const params = useParams<{ orgId: string; brandId: string; offerId: string }>();
  const orgId = params?.orgId ?? "";
  const brandId = params?.brandId ?? "";
  const offerId = params?.offerId ?? "";
  const featureSlug = useSoleFeatureSlug();
  const router = useRouter();
  const prefetch = useRoutePrefetch();
  const basePath = `/orgs/${orgId}/brands/${brandId}/offers/${offerId}`;

  const funnels = useAuthQuery(
    ["offerFunnels", brandId, offerId],
    () => getOfferFunnels(offerId, brandId),
    { enabled: Boolean(brandId && offerId), ...pollOptions },
  );

  const rows = useMemo(() => funnelViews(funnels.data?.funnels ?? []), [funnels.data]);
  const summary = useMemo(() => summariseFunnels(rows), [rows]);
  const coverage = costCoverageNote(funnels.data?.costCoverage);

  // Reveal on SETTLE: a read that errors falls through to a stated empty table rather
  // than holding the page in a skeleton forever.
  const pending = funnels.isPending && !funnels.isError;

  // How many campaigns carry a funnel, counted the way the Campaigns table counts
  // them: ONE per campaign IDENTITY. campaign-service keeps every superseded row a
  // workflow switch produced, so the ids the producer sends are the stored rows —
  // 47 of them for a funnel a customer knows as two campaigns.
  const { rows: campaignRows } = useCampaignRows(brandId, featureSlug, offerId);
  const campaignCountFor = (key: string) => {
    const wanted = normalizeSalesFunnelKey(key as SalesFunnelKeyWire);
    return campaignRows.filter(
      (r) =>
        r.campaign.funnelKey != null &&
        normalizeSalesFunnelKey(r.campaign.funnelKey) === wanted,
    ).length;
  };
  // Its mark, off the shared catalogue — the same one the campaigns table draws.
  const funnelDefFor = (key: string) => campaignFunnel(key as SalesFunnelKeyWire);
  // A funnel states `Learning` on its RATIOS while every campaign carrying it is still
  // learning, and clears the moment ONE of them is measured — the same rule the offer
  // and the brand headline use, one grain down. A funnel with no campaign at all is
  // UNMEASURED rather than learning: there is nothing to have an opinion about.
  const funnelLearningFor = (key: string) => {
    const wanted = normalizeSalesFunnelKey(key as SalesFunnelKeyWire);
    return scopeIsLearning(
      campaignRows.filter(
        (r) =>
          r.campaign.funnelKey != null &&
          normalizeSalesFunnelKey(r.campaign.funnelKey) === wanted,
      ),
    );
  };

  // ...and whether every campaign carrying it is STOPPED, in which case the withheld
  // ratios read `Paused` rather than `Learning`: nothing is landing, so the tag would
  // promise a number that cannot arrive until the customer restarts something. It is the
  // word that funnel's own page states, so a row and the page it opens agree — the map is
  // built from the SAME rows the pill there is built from. A funnel with NO campaign at
  // all is unmeasured rather than stopped and reads exactly as it did before.
  const { pausedByFunnelKey, settled: pausedSettled } = usePausedByFunnel(brandId, offerId);
  const funnelPausedFor = (key: string) =>
    scopePausedFor(
      pausedByFunnelKey,
      normalizeSalesFunnelKey(key as SalesFunnelKeyWire),
      pausedSettled,
    );

  // What each funnel may spend TODAY, and whether it is running at all. Both come off
  // ONE served answer (`["brandSpendableBudget", brandId]`, the key the offer Overview
  // and every campaign surface already poll, so this costs no request) — which is what
  // makes the two columns coherent by construction: a row cannot state a ceiling from
  // one source beside a status from another. The question is a JOIN neither producer
  // can answer alone, and campaign-service serves the join.
  const spendableQ = useAuthQuery(
    ["brandSpendableBudget", brandId],
    () => getBrandSpendableBudget(brandId),
    { enabled: Boolean(brandId) },
  );
  // Reveal on SETTLE, like the table above it: a failed read renders the dash these
  // cells already have for "we have no figure", never an eternal skeleton.
  const budgetSettled = spendableQ.data !== undefined || spendableQ.isError;
  const campaignsForFunnel = (key: string) =>
    spendableCampaignsForFunnel(spendableQ.data, key, offerId);
  // `null` while the read is in flight or has failed — deliberately NOT zero, because
  // "we could not measure this" and "this funnel spends nothing" are different
  // statements and the cell prints a different thing for each.
  const funnelBudgetCentsFor = (key: string) =>
    spendableQ.data === undefined
      ? null
      : campaignsForFunnel(key).reduce((sum, c) => sum + c.runningDailyBudgetCents, 0);
  // The SAME two-state roll-up the controls modal states one grain up, from the same
  // function: active as soon as one campaign selling this funnel is running, `none`
  // kept as its own answer because "there is nothing here" is not "everything is
  // stopped".
  const funnelRollupFor = (key: string) => rollupStatus(campaignsForFunnel(key));

  return (
    // EMBEDDED is how the offer Overview renders it: an offer sells through funnels,
    // so the Overview lists those rather than the campaigns two levels down. It then
    // owns the page chrome and the heading, and this contributes the table alone.
    <div className={embedded ? "space-y-3" : "p-4 md:p-8 max-w-7xl mx-auto space-y-6"}>
      {!embedded && (
        <header>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-1.5">
            Sales funnels
            <InfoTooltip tip={FUNNEL_TIP} />
          </h1>
          <p className="mt-1 text-sm text-gray-500 max-w-3xl">
            Each way this offer turns a stranger into a paying client, and what each one
            returned. A campaign buys one step of a funnel, so the return lives here.
          </p>
          {!pending && summary.total > 0 && (
            <p className="mt-2 text-sm text-gray-600">
              {summary.total} funnel{summary.total === 1 ? "" : "s"}, and{" "}
              {summary.priced === 0
                ? "none of them can be priced yet"
                : `${summary.priced} of them priced`}
              .
            </p>
          )}
        </header>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full md:min-w-[1060px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
              <th className="px-4 py-2 font-medium">Funnel</th>
              <th className="px-4 py-2 font-medium text-right">ROI</th>
              <th className="px-4 py-2 font-medium text-right">% CAC</th>
              <th className="px-4 py-2 font-medium text-right">$ CAC</th>
              <th className="px-4 py-2 font-medium text-right">$ Revenue</th>
              <th className="px-4 py-2 font-medium text-right">
                <span className="inline-flex items-center gap-1">
                  $ Invested
                  <InfoTooltip tip={INVESTED_TIP} />
                </span>
              </th>
              {/* The ceiling sits beside the status because the two answer one question
                  together — is this funnel running, and how hard. Deliberately NOT in
                  the money block on its left: those are charges and projections of
                  charges, and a ceiling is neither. Same order, same pairing and the
                  same words as the Campaigns table one click down. */}
              <th className="px-4 py-2 font-medium text-right">
                <span className="inline-flex items-center gap-1">
                  $ Budget
                  <InfoTooltip tip={BUDGET_TIP} />
                </span>
              </th>
              <th className="px-4 py-2 font-medium">
                <span className="inline-flex items-center gap-1">
                  Status
                  <InfoTooltip tip={STATUS_TIP} />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {pending ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="px-4 py-3" colSpan={COLUMN_COUNT}>
                    <Skeleton className="h-4 w-full rounded" />
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-gray-400" colSpan={COLUMN_COUNT}>
                  {funnels.isError
                    ? "Couldn\u2019t read this offer\u2019s sales funnels."
                    : "This offer sells through no sales funnel yet."}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.funnelKey}
                  // The whole row is the control, and it responds the way a campaign row
                  // does: the surface tints, nothing underlines. A link inside a
                  // clickable row is two affordances for one action.
                  onClick={() =>
                    router.push(`${basePath}/funnels/${encodeURIComponent(row.funnelKey)}`)
                  }
                  // Warm the funnel's route on hover. Without it the click waits on a
                  // dynamic RSC render and the nearest loading boundary is the OFFER's,
                  // so drilling into a funnel blanked this whole page to a skeleton.
                  onMouseEnter={() =>
                    prefetch(`${basePath}/funnels/${encodeURIComponent(row.funnelKey)}`)
                  }
                  onFocus={() =>
                    prefetch(`${basePath}/funnels/${encodeURIComponent(row.funnelKey)}`)
                  }
                  className="border-b border-gray-50 cursor-pointer transition hover:bg-gray-50"
                >
                  <td className="px-4 py-3">
                    {/* The SAME shape a campaign row wears: the mark, the name, and
                        the quieter line under it. A funnel reads one way on this table
                        and the same way in the campaigns table one click down. */}
                    <span className="flex min-w-0 items-center gap-2.5">
                      {funnelDefFor(row.funnelKey) && (
                        <SalesFunnelMark def={funnelDefFor(row.funnelKey)!} size="sm" />
                      )}
                      <span className="flex h-8 min-w-0 flex-col justify-center">
                        <span className="truncate leading-[14px] text-gray-800">
                          {row.name}
                        </span>
                        <span className="truncate text-xs leading-[18px] text-gray-500">
                          {row.steps.join("  \u2192  ")}
                        </span>
                      </span>
                    </span>
                    {!row.priced && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        {unpricedFunnelReasonLabel(row.unpricedReason)}
                      </p>
                    )}
                  </td>
                  {/* The three RATIOS each state the tag in their OWN column, the way
                      the Campaigns table does. One tag spanning them reads as a note
                      about the table rather than as the answer in each cell, and it
                      leaves two columns blank, which is a different claim. Each divides
                      by an outcome count, so at a low count each is decided by whichever
                      outcome happened to land. The TOTALS beside them are never gated:
                      money already spent and pipeline already earned are facts. */}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {/* The SAME `RoiCell` the Campaigns table renders, so a return reads
                        one way on this page and the same way one click down: semibold,
                        green above break-even, ordinary text below it (never red — a
                        funnel still learning is under 1x by construction). */}
                    {funnelLearningFor(row.funnelKey) ? (
                      <LearningTag withInfo={false} paused={funnelPausedFor(row.funnelKey)} />
                    ) : (
                      <RoiCell multiple={row.roiMultiple} />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">
                    {funnelLearningFor(row.funnelKey) ? (
                      <LearningTag withInfo={false} paused={funnelPausedFor(row.funnelKey)} />
                    ) : (
                      fmtPct(row.costOfAcquisitionPct)
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">
                    {funnelLearningFor(row.funnelKey) ? (
                      <LearningTag withInfo={false} paused={funnelPausedFor(row.funnelKey)} />
                    ) : (
                      fmtUsd(row.costPerAcquisitionUsd)
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">
                    {fmtUsd(row.pipelineUsd)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">
                    {fmtUsd(row.investedUsd)}
                    {/* The split, only where there is one to state. What we charged and
                        what you recorded are two questions with two owners, and one of
                        them is what we bill. */}
                    {row.customerCostUsd !== null && row.customerCostUsd > 0 && (
                      <p className="text-[11px] text-gray-400">
                        {fmtUsd(row.platformCostUsd)} us · {fmtUsd(row.customerCostUsd)} you
                      </p>
                    )}
                  </td>
                  {/* Whole dollars, always: a ceiling is a configured whole-dollar
                      value. `$0` is a real answer — nothing selling this funnel is
                      running — and a dash means we could not read it, which is a
                      different statement. The `/ day` rider is what the campaign rows
                      and the funnel's own header state: a ceiling is a RATE, and the
                      bare figure reads as a total beside the two money columns to its
                      left, which really are totals. Withheld on the dash. */}
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700 whitespace-nowrap">
                    {!budgetSettled ? (
                      <Skeleton className="h-4 w-14 rounded ml-auto" />
                    ) : funnelBudgetCentsFor(row.funnelKey) == null ? (
                      fmtDailyBudgetUsd(null)
                    ) : (
                      <>
                        {fmtDailyBudgetUsd(funnelBudgetCentsFor(row.funnelKey))}
                        <span className="text-gray-400"> / day</span>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!budgetSettled ? (
                      <Skeleton className="h-4 w-16 rounded" />
                    ) : (
                      <span
                        className={`text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full border whitespace-nowrap ${ROLLUP_STYLE[funnelRollupFor(row.funnelKey)]}`}
                      >
                        {ROLLUP_LABEL[funnelRollupFor(row.funnelKey)]}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {coverage && <p className="text-xs text-gray-500 max-w-3xl">{coverage}</p>}

    </div>
  );
}
