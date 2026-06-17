"use client";

import { useMutation } from "@tanstack/react-query";
import { SparklesIcon, PauseIcon, PlayIcon } from "@heroicons/react/20/solid";
import {
  getBrandPause,
  setBrandPause,
  getBrandDailyBudget,
  getBrandSalesEconomics,
  type BrandOptimizationGoal,
} from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";

// What the brand is currently maximising — the brand-level optimization goal.
const GOAL_LABEL: Record<BrandOptimizationGoal, string> = {
  signups: "Maximising signups conversions",
  sales_meetings: "Maximising sales meetings",
};

function budgetLabel(cents: number | null): string | null {
  if (cents === null || cents <= 0) return null;
  return `$${(cents / 100).toLocaleString("en-US")}/day`;
}

/**
 * Brand-level control bar on the brand overview — replaces the old "New Campaign"
 * button. Shows the brand's current "Maximising X" goal, a budget/active indicator
 * (same aesthetic as the campaign-page status pill), and a Pause / Restart toggle.
 *
 * Pause/Restart flips a single org×brand boolean (campaign-service). Paused HOLDS
 * the brand's ongoing campaigns (the scheduler skips them) so a Restart resumes
 * instantly — and with no outreach there is no spend, so the recurring charge
 * stops too. Queries reuse the shared keys (pause / daily-budget / sales-economics)
 * so they dedupe with the page's own fetches.
 */
export function BrandStatusControl({ brandId }: { brandId: string }) {
  const queryClient = useQueryClient();

  const { data: pauseData } = useAuthQuery(
    ["brandPause", brandId],
    () => getBrandPause(brandId),
    pollOptions,
  );
  const { data: budgetData } = useAuthQuery(
    ["brandDailyBudget", brandId],
    () => getBrandDailyBudget(brandId),
  );
  const { data: econ } = useAuthQuery(
    ["brandSalesEconomics", brandId],
    () => getBrandSalesEconomics(brandId),
  );

  const paused = pauseData?.paused ?? false;
  const goal =
    econ === undefined ? null : econ.salesEconomics?.optimizationGoal ?? "sales_meetings";
  const budget = budgetLabel(budgetData?.dailyBudgetCents ?? null);

  const { mutate, isPending: saving } = useMutation({
    mutationFn: (next: boolean) => setBrandPause(brandId, next),
    onSuccess: (res) => {
      queryClient.setQueryData(["brandPause", brandId], res);
    },
  });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Maximising tag — the brand's current optimization goal. */}
      {goal ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700">
          <SparklesIcon className="h-3.5 w-3.5" />
          {GOAL_LABEL[goal]}
        </span>
      ) : (
        <span />
      )}

      <div className="flex items-center gap-3">
        {/* Budget / active indicator — mirrors the campaign-page status pill. */}
        {paused ? (
          <span className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-500">
            <span className="inline-flex h-2 w-2 rounded-full bg-current opacity-50" />
            Paused
            {budget && (
              <>
                <span className="opacity-40">&middot;</span>
                <span className="font-semibold">{budget}</span>
              </>
            )}
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            Active
            {budget && (
              <>
                <span className="text-green-300">&middot;</span>
                <span className="font-semibold">{budget}</span>
              </>
            )}
          </span>
        )}

        {/* Pause / Restart toggle — in-flight label stays full opacity (CLAUDE.md
            mutation-button rule): fade only the genuinely-disabled state. */}
        <button
          onClick={() => mutate(!paused)}
          disabled={saving}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition ${
            paused
              ? "bg-brand-500 text-white hover:bg-brand-600"
              : "bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200"
          } ${saving ? "cursor-wait" : "disabled:opacity-40 disabled:cursor-not-allowed"}`}
        >
          {saving ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : paused ? (
            <PlayIcon className="h-4 w-4" />
          ) : (
            <PauseIcon className="h-4 w-4" />
          )}
          {paused ? "Restart" : "Pause"}
        </button>
      </div>
    </div>
  );
}
