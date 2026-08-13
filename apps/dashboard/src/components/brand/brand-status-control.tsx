"use client";

import { useMutation } from "@tanstack/react-query";
import {
  SparklesIcon,
  PauseIcon,
  PlayIcon,
  CreditCardIcon,
} from "@heroicons/react/20/solid";
import { Skeleton } from "@/components/skeleton";
import { InfoTooltip } from "@/components/visibility/metric-info";
import {
  getBrand,
  getBrandPause,
  setBrandPause,
  getBrandDailyBudget,
  getBrandSalesEconomics,
  keepLastGoodWorkflowProjection,
  type BrandOptimizationGoal,
  type WorkflowProjectionResponse,
} from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { useIsShareMode } from "@/components/share/share-mode-context";

// What the brand is currently maximising — the brand-level optimization goal.
const GOAL_LABEL: Record<BrandOptimizationGoal, string> = {
  signups: "Maximising signups conversions",
  sales_meetings: "Maximising sales meetings",
  website_visits: "Maximising website visits",
  positive_replies: "Maximising positive replies",
  form_submissions: "Maximising form submissions",
  website_purchase: "Maximising website purchases",
  sales: "Maximising sales",
};

// Daily budgets always render as whole dollars (no cents), regardless of magnitude.
function fmtUsdWhole(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function budgetLabel(cents: number | null): string | null {
  if (cents === null || cents <= 0) return null;
  return `${fmtUsdWhole(cents / 100)}/day`;
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
  // The public share view. The goal and the budget still SHOW — they are what the
  // numbers on this page are measured against — but they stop being controls, and
  // Pause / Restart is gone: whether the brand is sending is the owner's call.
  const readOnly = useIsShareMode();
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
  const { data: brandData } = useAuthQuery(
    ["brand", brandId],
    () => getBrand(brandId),
  );
  // A brand with no website (url == null) has no clicks/visits, so the only
  // supported optimization goal is positive_replies. Restrict the goal picker and
  // coerce the displayed goal to it (a brand stored on a visit-driven goal must
  // still show positive_replies without crashing). Only true once the brand resolved.
  const noWebsite = !!brandData?.brand && brandData.brand.url == null;
  const paused = pauseData?.paused;
  const pauseReady = typeof paused === "boolean";
  const storedGoal =
    econ === undefined
      ? null
      : econ.salesEconomics?.optimizationGoal ?? "positive_replies";
  const goal = noWebsite && storedGoal ? "positive_replies" : storedGoal;
  const budget = budgetLabel(budgetData?.dailyBudgetCents ?? null);
  const { mutate: setPaused, isPending: savingPause } = useMutation({
    mutationFn: (next: boolean) => setBrandPause(brandId, next),
    onSuccess: (res, next) => {
      queryClient.setQueryData(["brandPause", brandId], res);
      // Notify the user (staff BCC'd) that the brand just switched state.
      // Fire-and-forget: a failed send never blocks the toggle. `next` is the
      // NEW paused value (true = just paused, false = just resumed).
      void fetch("/api/brand-status-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId, paused: next }),
      }).catch((err) =>
        console.error("[brand-status-email] notify failed", err),
      );
    },
  });
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Maximising tag — STATED, never edited here. What a brand sells through is
          its declared sales funnels, and those are chosen on Settings. The goal this
          reads is the retired, lossier vocabulary that features-service no longer
          reads at all, so a control that wrote it would change a value with no
          consequence anywhere: a lie about what the click does. */}
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
        {!pauseReady ? (
          <Skeleton className="h-8 w-32 rounded-lg" />
        ) : readOnly ? (
          <span
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium ${
              paused
                ? "border-gray-200 bg-gray-100 text-gray-500"
                : "border-green-200 bg-green-50 text-green-700"
            }`}
          >
            <span className={`inline-flex h-2 w-2 rounded-full ${paused ? "bg-current opacity-50" : "bg-green-500"}`} />
            {paused ? "Paused" : "Active"}
            {budget && (
              <>
                <span className="opacity-40">&middot;</span>
                <span className="font-semibold">{budget}</span>
              </>
            )}
          </span>
        ) : paused ? (
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
        {pauseReady && !readOnly ? (
          <button
            onClick={() => setPaused(!paused)}
            disabled={savingPause}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition ${
              paused
                ? "bg-brand-500 text-white hover:bg-brand-600"
                : "bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200"
            } ${savingPause ? "cursor-wait" : "disabled:opacity-40 disabled:cursor-not-allowed"}`}
          >
            {savingPause ? (
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
        ) : (
          <Skeleton className="h-9 w-28 rounded-lg" />
        )}
      </div>


    </div>
  );
}
