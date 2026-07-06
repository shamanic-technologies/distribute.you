"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  SparklesIcon,
  PauseIcon,
  PlayIcon,
  XMarkIcon,
} from "@heroicons/react/20/solid";
import { Skeleton } from "@/components/skeleton";
import {
  getBrandPause,
  setBrandPause,
  getBrandDailyBudget,
  saveBrandDailyBudget,
  getBrandSalesEconomics,
  saveBrandSalesEconomics,
  getWorkflowProjection,
  keepLastGoodWorkflowProjection,
  salesObjectiveForOptimizationGoal,
  isVisitDrivenGoal,
  type BrandOptimizationGoal,
  type BrandSalesEconomics,
  type BrandSalesEconomicsInput,
  type WorkflowProjectionResponse,
} from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { useSoleFeatureSlug } from "@/lib/sole-feature";
import {
  selectWorkflowForOptimizationGoal,
  workflowOutcomeUnitCost,
} from "@/lib/workflow-projection-choice";
import { useIsBetaUser } from "@/lib/use-beta-user";
import { MaturityBadge } from "@/components/maturity-badge";

const PROJECTION_REF_BUDGET = 100;
const COUNT_TIERS = [5, 25, 125] as const;

const DEFAULT_SALES_ECONOMICS = {
  lifetimeRevenueUsd: 4000,
  replyToMeetingPct: 40,
  visitToMeetingPct: 20,
  meetingToClosePct: 25,
  visitToSignupPct: 25,
  signupToPaidClientPct: 20,
} as const;

// What the brand is currently maximising — the brand-level optimization goal.
const GOAL_LABEL: Record<BrandOptimizationGoal, string> = {
  signups: "Maximising signups conversions",
  sales_meetings: "Maximising sales meetings",
  website_visits: "Maximising website visits",
  positive_replies: "Maximising positive replies",
  form_submissions: "Maximising form submissions",
};

const GOAL_OPTIONS: {
  value: BrandOptimizationGoal;
  label: string;
  description: string;
  beta?: boolean;
}[] = [
  {
    value: "signups",
    label: "# Signups",
    description: "Optimize outreach toward website signups and trial starts.",
  },
  {
    value: "sales_meetings",
    label: "# Sales Meetings",
    description: "Optimize outreach toward booked sales conversations.",
  },
  {
    value: "website_visits",
    label: "# Website visits",
    description: "Optimize outreach toward website visits that convert to paid clients.",
    beta: true,
  },
  {
    value: "positive_replies",
    label: "# Positive Replies",
    description: "Optimize outreach toward positive replies that convert to paid clients.",
    beta: true,
  },
];

function budgetLabel(cents: number | null): string | null {
  if (cents === null || cents <= 0) return null;
  return `$${(cents / 100).toLocaleString("en-US")}/day`;
}

function fmtUsd0(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function fmtCount(n: number): string {
  return n.toLocaleString("en-US");
}

function salesEconomicsInputForGoal(
  current: BrandSalesEconomics | null | undefined,
  optimizationGoal: BrandOptimizationGoal,
): BrandSalesEconomicsInput {
  return {
    lifetimeRevenueUsd:
      current?.lifetimeRevenueUsd ?? DEFAULT_SALES_ECONOMICS.lifetimeRevenueUsd,
    replyToMeetingPct:
      current?.replyToMeetingPct ?? DEFAULT_SALES_ECONOMICS.replyToMeetingPct,
    visitToMeetingPct:
      current?.visitToMeetingPct ?? DEFAULT_SALES_ECONOMICS.visitToMeetingPct,
    meetingToClosePct:
      current?.meetingToClosePct ?? DEFAULT_SALES_ECONOMICS.meetingToClosePct,
    visitToSignupPct:
      current?.visitToSignupPct ?? DEFAULT_SALES_ECONOMICS.visitToSignupPct,
    signupToPaidClientPct:
      current?.signupToPaidClientPct ?? DEFAULT_SALES_ECONOMICS.signupToPaidClientPct,
    businessModel: current?.businessModel ?? null,
    optimizationGoal,
  };
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
  const isBeta = useIsBetaUser();
  const queryClient = useQueryClient();
  const featureSlug = useSoleFeatureSlug();
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] =
    useState<BrandOptimizationGoal>("sales_meetings");
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [selectedCount, setSelectedCount] = useState<number | null>(null);
  const [customCount, setCustomCount] = useState("");

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
  const paused = pauseData?.paused;
  const pauseReady = typeof paused === "boolean";
  const goal =
    econ === undefined
      ? null
      : econ.salesEconomics?.optimizationGoal ?? "sales_meetings";
  const budget = budgetLabel(budgetData?.dailyBudgetCents ?? null);
  const goalForBudget = goal ?? "sales_meetings";

  const { data: projection, isPending: projectionPending, error: projectionError } =
    useAuthQuery(
      [
        "workflowProjection",
        brandId,
        featureSlug,
        "brand-status-budget",
        goalForBudget,
        econ?.salesEconomics?.updatedAt ?? "no-economics",
      ],
      () =>
        getWorkflowProjection({
          featureSlug,
          brandId,
          objective: salesObjectiveForOptimizationGoal(goalForBudget),
          budgetUsd: PROJECTION_REF_BUDGET,
        }),
      {
        enabled: budgetDialogOpen && econ !== undefined,
        placeholderData: undefined,
        structuralSharing: (prev, next) =>
          keepLastGoodWorkflowProjection(
            prev as WorkflowProjectionResponse | undefined,
            next as WorkflowProjectionResponse,
          ),
      },
    );

  const { mutate: setPaused, isPending: savingPause } = useMutation({
    mutationFn: (next: boolean) => setBrandPause(brandId, next),
    onSuccess: (res) => {
      queryClient.setQueryData(["brandPause", brandId], res);
    },
  });
  const {
    mutate: saveGoal,
    isPending: savingGoal,
    error: goalError,
  } = useMutation({
    mutationFn: (next: BrandOptimizationGoal) =>
      saveBrandSalesEconomics(
        brandId,
        salesEconomicsInputForGoal(econ?.salesEconomics, next),
      ),
    onSuccess: (res) => {
      queryClient.setQueryData(["brandSalesEconomics", brandId], res);
      queryClient.invalidateQueries({ queryKey: ["featureRevenue"] });
      queryClient.invalidateQueries({ queryKey: ["featurePipelineActivity"] });
      queryClient.invalidateQueries({ queryKey: ["workflowProjection", brandId, featureSlug] });
      setGoalDialogOpen(false);
    },
  });
  const {
    mutate: saveBudget,
    isPending: savingBudget,
    error: budgetError,
  } = useMutation({
    mutationFn: (dailyBudgetUsd: number) =>
      saveBrandDailyBudget(brandId, Math.round(dailyBudgetUsd * 100)),
    onSuccess: (res) => {
      queryClient.setQueryData(["brandDailyBudget", brandId], {
        brandId: res.brandId,
        dailyBudgetCents: res.dailyBudgetCents,
        updatedAt: res.updatedAt,
      });
      setBudgetDialogOpen(false);
    },
  });

  function openGoalDialog() {
    if (goal) setSelectedGoal(goal);
    setGoalDialogOpen(true);
  }

  function openBudgetDialog() {
    setSelectedCount(null);
    setCustomCount("");
    setBudgetDialogOpen(true);
  }

  const selectedGoalOption = GOAL_OPTIONS.find((g) => g.value === selectedGoal);
  const visitToSignupPct =
    econ?.salesEconomics?.visitToSignupPct ??
    DEFAULT_SALES_ECONOMICS.visitToSignupPct;
  const replyToMeetingPct =
    econ?.salesEconomics?.replyToMeetingPct ??
    DEFAULT_SALES_ECONOMICS.replyToMeetingPct;
  const visitToMeetingPct =
    econ?.salesEconomics?.visitToMeetingPct ??
    DEFAULT_SALES_ECONOMICS.visitToMeetingPct;
  const activeWorkflow = selectWorkflowForOptimizationGoal(projection, goalForBudget, {
    visitToSignupPct,
    replyToMeetingPct,
    visitToMeetingPct,
  });
  const outcomeUnit =
    goalForBudget === "signups"
      ? "signups"
      : goalForBudget === "website_visits"
        ? "website visits"
        : goalForBudget === "positive_replies"
          ? "positive replies"
          : "meetings";
  const unitCost = activeWorkflow
    ? workflowOutcomeUnitCost(activeWorkflow, goalForBudget, {
        visitToSignupPct,
        replyToMeetingPct,
        visitToMeetingPct,
      })
    : null;

  function budgetForCount(n: number): number | null {
    if (unitCost == null || unitCost <= 0) return null;
    return Math.max(1, Math.round((n * unitCost) / 30));
  }

  const selectedBudget =
    selectedCount == null
      ? null
      : budgetForCount(selectedCount) ??
        (projection?.recommendedBudgetUsd && projection.recommendedBudgetUsd > 0
          ? Math.round(projection.recommendedBudgetUsd)
          : null);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* Maximising tag — the brand's current optimization goal. */}
      {goal ? (
        <button
          type="button"
          onClick={openGoalDialog}
          className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:border-brand-300 hover:bg-brand-100"
        >
          <SparklesIcon className="h-3.5 w-3.5" />
          {GOAL_LABEL[goal]}
        </button>
      ) : (
        <span />
      )}

      <div className="flex items-center gap-3">
        {/* Budget / active indicator — mirrors the campaign-page status pill. */}
        {!pauseReady ? (
          <Skeleton className="h-8 w-32 rounded-lg" />
        ) : paused ? (
          <button
            type="button"
            onClick={openBudgetDialog}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-500 transition hover:border-gray-300 hover:bg-gray-200"
          >
            <span className="inline-flex h-2 w-2 rounded-full bg-current opacity-50" />
            Paused
            {budget && (
              <>
                <span className="opacity-40">&middot;</span>
                <span className="font-semibold">{budget}</span>
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={openBudgetDialog}
            className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 transition hover:border-green-300 hover:bg-green-100"
          >
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
          </button>
        )}

        {/* Pause / Restart toggle — in-flight label stays full opacity (CLAUDE.md
            mutation-button rule): fade only the genuinely-disabled state. */}
        {pauseReady ? (
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

      {goalDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !savingGoal && setGoalDialogOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Optimization goal
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Choose the outcome this brand should maximize.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGoalDialogOpen(false)}
                disabled={savingGoal}
                className="rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
                aria-label="Close"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              {GOAL_OPTIONS.filter(
                (option) => !option.beta || isBeta || option.value === selectedGoal,
              ).map((option) => {
                const active = selectedGoal === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectedGoal(option.value)}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      active
                        ? "border-brand-300 bg-brand-50 ring-1 ring-brand-200"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                      {option.label}
                      {option.beta && <MaturityBadge level="beta" />}
                    </div>
                    <div className="mt-0.5 text-xs leading-5 text-gray-500">
                      {option.description}
                    </div>
                  </button>
                );
              })}
            </div>

            {goalError && (
              <p className="mt-4 text-sm text-red-600">
                Could not save:{" "}
                {goalError instanceof Error ? goalError.message : "unknown error"}
              </p>
            )}

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setGoalDialogOpen(false)}
                disabled={savingGoal}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveGoal(selectedGoal)}
                disabled={savingGoal || selectedGoal === goal}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {savingGoal
                  ? "Saving..."
                  : `Save ${selectedGoalOption?.label ?? "goal"}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {budgetDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !savingBudget && setBudgetDialogOpen(false)}
          />
          <div className="relative w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Daily budget
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Pick how many {outcomeUnit} you want each month. We set the daily
                  cap to match.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBudgetDialogOpen(false)}
                disabled={savingBudget}
                className="rounded-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
                aria-label="Close"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {budget && (
              <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                Current daily budget:{" "}
                <span className="font-semibold text-gray-900">{budget}</span>
              </div>
            )}

            {projectionPending ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32 rounded-xl" />
                ))}
              </div>
            ) : projectionError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                Could not load budget options: {projectionError.message}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {COUNT_TIERS.map((n, i) => {
                  const b = budgetForCount(n);
                  const active = selectedCount === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setSelectedCount(n);
                        setCustomCount("");
                      }}
                      className={`rounded-xl border-2 p-4 text-left transition ${
                        active
                          ? "border-brand-400 bg-brand-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      {i === 1 ? (
                        <div className="mb-1 inline-block rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                          Recommended
                        </div>
                      ) : (
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          {i === 0 ? "Starter" : "Growth"}
                        </div>
                      )}
                      <div className="text-xl font-bold text-gray-950">
                        {fmtCount(n)}
                      </div>
                      <div className="text-xs text-gray-500">{outcomeUnit} / mo</div>
                      <div className="mt-2 text-xs text-gray-400">
                        {b != null ? `~${fmtUsd0(b)} / day` : "-"}
                      </div>
                    </button>
                  );
                })}

                {(() => {
                  const customN = Number(customCount);
                  const isCustom = customCount !== "" && customN > 0;
                  const active = isCustom && selectedCount === customN;
                  const b = isCustom ? budgetForCount(customN) : null;
                  return (
                    <div
                      className={`rounded-xl border-2 p-4 transition ${
                        active
                          ? "border-brand-400 bg-brand-50"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        Other
                      </div>
                      <input
                        type="number"
                        min={1}
                        value={customCount}
                        onChange={(e) => {
                          setCustomCount(e.target.value);
                          const v = Number(e.target.value);
                          setSelectedCount(v > 0 ? v : null);
                        }}
                        placeholder="Custom"
                        className="w-full bg-transparent text-xl font-bold text-gray-950 placeholder-gray-300 focus:outline-none"
                      />
                      <div className="text-xs text-gray-500">
                        {outcomeUnit} / mo
                      </div>
                      <div className="mt-2 text-xs text-gray-400">
                        {b != null ? `~${fmtUsd0(b)} / day` : "-"}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {selectedBudget != null && (
              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                Daily budget:{" "}
                <strong className="text-gray-900">{fmtUsd0(selectedBudget)} / day</strong>
                {unitCost != null && (
                  <span className="mt-1 block text-gray-400 sm:mt-0 sm:inline">
                    {" "}
                    ~{fmtUsd0(unitCost)} / {outcomeUnit.replace(/s$/, "")}
                  </span>
                )}
              </div>
            )}

            {budgetError && (
              <p className="mt-4 text-sm text-red-600">
                Could not save:{" "}
                {budgetError instanceof Error ? budgetError.message : "unknown error"}
              </p>
            )}

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setBudgetDialogOpen(false)}
                disabled={savingBudget}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => selectedBudget != null && saveBudget(selectedBudget)}
                disabled={savingBudget || selectedBudget == null}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {savingBudget ? "Saving..." : "Save budget"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
