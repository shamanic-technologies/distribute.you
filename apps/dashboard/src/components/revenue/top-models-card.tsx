"use client";

import { Skeleton } from "@/components/skeleton";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { ProviderLogo } from "@/components/provider-logo";
import { formatUsdAdaptive } from "@/lib/format-number";
import { workflowModelMark } from "@/lib/workflow-model-marks";
import type { TopModelRow } from "@/lib/top-models";

/**
 * THE THREE LLMs WRITING THIS CAMPAIGN'S EMAILS FOR THE LEAST MONEY.
 *
 * A campaign on a cold-email channel buys its outcome with a written email, so the model
 * that writes it is the lever a reader can act on — and several of the campaign's
 * workflows name the SAME model (five of twenty-two name `pro` on the campaign this was
 * built against), so the Workflows page answers "which workflow" and leaves the reader to
 * group by eye. This states the model directly.
 *
 * ONE VALUE COLUMN, the cost per outcome — the same figure the card beside it charts over
 * time, and the same one the Workflows page prints in its Campaign column. A return has
 * no business here for the same reason it has none on the campaign's audiences: a
 * campaign buys ONE outcome and is run to make that outcome cheaper.
 *
 * Every figure and every position is READ (`lib/top-models.ts` — nothing ranked, divided
 * or compared here); this file decides only what a model is CALLED and whose logo sits
 * beside it, through the one catalogue that already answers that (`workflowModelMark`).
 * An alias the catalogue has never heard of renders VERBATIM with no logo: a mark we
 * would have to invent would attribute a customer's spend to the wrong company.
 */
export function TopModelsCard({
  models,
  outcomeLabel,
  pending = false,
}: {
  /** Already ordered and capped by `topModels`. */
  models?: readonly TopModelRow[];
  /**
   * What ONE outcome is, in the producer's own words — the column header. Null while the
   * scope has not named one, and the header then states the generic word rather than a
   * noun this card picked.
   */
  outcomeLabel?: string | null;
  pending?: boolean;
}) {
  const label = outcomeLabel ? `Cost per ${outcomeLabel.toLowerCase()}` : "Cost per outcome";
  const tip =
    "The model each of this campaign's workflows writes its emails with, and what one outcome has cost through the best workflow naming that model. Read from the same ranking the campaign's Workflows page uses — the price and the position come from one workflow, never a cheapest price paired with another workflow's rank. Models this campaign's step cannot use are left out.";

  const rows = models ?? [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Top 3 LLMs</p>
        <p className="flex items-center gap-1 text-xs font-medium text-gray-500">
          <span className="truncate">{label}</span>
          <InfoTooltip tip={tip} placement="bottom" />
        </p>
      </div>
      {pending ? (
        [0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))
      ) : rows.length === 0 ? (
        // "We could not place a model" and "no model is cheap" are different statements,
        // and only the first can be true here: a campaign whose ranking states no usable
        // model says so rather than drawing an empty list.
        <p className="py-2 text-sm text-gray-500">
          We cannot tell which model is cheapest here yet.
        </p>
      ) : (
        rows.map((row) => {
          const mark = workflowModelMark(row.alias);
          return (
            <div
              key={row.alias}
              className="-mx-1 flex items-center gap-2 rounded-lg px-1 py-0.5"
              title={`Best through ${row.workflowDynastySlug}`}
            >
              {mark?.providerDomain ? (
                <ProviderLogo
                  domain={mark.providerDomain}
                  size={20}
                  className="h-5 w-5 shrink-0 rounded border border-gray-200 bg-white object-contain"
                />
              ) : (
                <span className="h-5 w-5 shrink-0 rounded border border-gray-200 bg-gray-50" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-gray-700">
                  {mark?.label ?? row.alias}
                </span>
                {row.workflowCount > 1 && (
                  <span className="block truncate text-[11px] text-gray-400">
                    {row.workflowCount.toLocaleString("en-US")} workflows
                  </span>
                )}
              </span>
              <span className="text-sm font-medium text-gray-800 tabular-nums">
                {row.costPerOutcomeUsd != null ? formatUsdAdaptive(row.costPerOutcomeUsd) : "-"}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
