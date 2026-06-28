"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { PauseIcon, XMarkIcon } from "@heroicons/react/20/solid";
import { getBrandDailyBudget, saveBrandDailyBudget, setBrandPause } from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";

// Wire value is cents; the input edits whole dollars. Empty input = "never set".
const centsToDollars = (cents: number | null): string =>
  cents === null ? "" : String(cents / 100);
const dollarsToCents = (dollars: string): number =>
  Math.round((parseFloat(dollars) || 0) * 100);

// A budget below $1/day means "spend nothing", which does NOT pause the campaign —
// it just starves outreach silently. Block it; the real lever is pausing the brand.
const MIN_BUDGET_CENTS = 100;

type BrandDailyBudgetCardProps = {
  brandId: string;
  variant?: "card" | "section";
};

export function BrandDailyBudgetCard({ brandId, variant = "card" }: BrandDailyBudgetCardProps) {
  const queryClient = useQueryClient();
  const isSection = variant === "section";

  const { data, isPending } = useAuthQuery(
    ["brandDailyBudget", brandId],
    () => getBrandDailyBudget(brandId),
  );

  // null until hydrated from the query; "" = unset (empty input, placeholder shows).
  const [dollars, setDollars] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const hydrated = useRef(false);

  // Seed once from the saved value (or "" when unset). Mark hydrated even when unset
  // so a later background refetch never clobbers in-progress edits.
  useEffect(() => {
    if (hydrated.current || data === undefined) return;
    setDollars(centsToDollars(data.dailyBudgetCents));
    hydrated.current = true;
  }, [data]);

  const { mutate, isPending: saving, error } = useMutation({
    mutationFn: (cents: number) => saveBrandDailyBudget(brandId, cents),
    onSuccess: (res) => {
      // Write the fresh value to the shared cache so a reload/other reader sees it
      // without waiting on a refetch.
      queryClient.setQueryData(["brandDailyBudget", brandId], {
        brandId: res.brandId,
        dailyBudgetCents: res.dailyBudgetCents,
        updatedAt: res.updatedAt,
      });
      setDirty(false);
      setSaved(true);
    },
  });

  const { mutate: pauseBrand, isPending: pausing, error: pauseError } = useMutation({
    mutationFn: () => setBrandPause(brandId, true),
    onSuccess: (res) => {
      queryClient.setQueryData(["brandPause", brandId], res);
      // Revert the input to the last saved budget — we did NOT save the sub-$1 value.
      setDollars(centsToDollars(data?.dailyBudgetCents ?? null));
      setDirty(false);
      setPauseModalOpen(false);
    },
  });

  function update(value: string) {
    setDollars(value);
    setDirty(true);
    setSaved(false);
  }

  function handleSave() {
    if (dollars === null) return;
    const cents = dollarsToCents(dollars);
    // $0 / empty / negative / sub-$1 doesn't pause anything — surface the real lever.
    if (cents < MIN_BUDGET_CENTS) {
      setPauseModalOpen(true);
      return;
    }
    mutate(cents);
  }

  if (isPending || dollars === null) {
    return (
      <div className={isSection ? "p-5" : "bg-white rounded-xl border border-gray-200 p-5"}>
        <div className="h-4 w-48 bg-gray-100 rounded animate-pulse mb-4" />
        <div className="h-3 w-32 bg-gray-100 rounded animate-pulse mb-2" />
        <div className="h-9 w-48 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className={isSection ? "p-5" : "bg-white rounded-xl border border-gray-200"}>
      <div className={isSection ? "" : "p-5"}>
        <h3 className="mb-1 text-sm font-semibold text-gray-900">Daily Budget</h3>
        <p className="text-sm text-gray-500 mb-4">
          The most this brand spends per day across its active campaigns. Used to pace
          outreach — separate from your credit balance.
        </p>

        <div className="max-w-xs">
          <label className="block text-xs text-gray-500 mb-1">Daily budget</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              $
            </span>
            <input
              type="number"
              min="1"
              step="1"
              value={dollars}
              placeholder="e.g. 50"
              onChange={(e) => update(e.target.value)}
              className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>
          <p className="mt-1.5 text-xs text-gray-400">
            Use the brand overview control to pause or restart spend.
          </p>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-600">
            Could not save: {error instanceof Error ? error.message : "unknown error"}
          </p>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          {saved && !dirty && <span className="text-sm text-green-600">Saved ✓</span>}
        </div>
      </div>

      {pauseModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => !pausing && setPauseModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-xl shadow-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-900">
                Set a budget of at least $1/day
              </h3>
              <button
                onClick={() => !pausing && setPauseModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600">
              A budget of $0 doesn&apos;t stop outreach — it just starves it without
              actually pausing your campaigns. To stop spending, pause outreach for this
              brand instead. You can restart it anytime.
            </p>

            {pauseError && (
              <p className="mt-4 text-sm text-red-600">
                Could not pause:{" "}
                {pauseError instanceof Error ? pauseError.message : "unknown error"}
              </p>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setPauseModalOpen(false)}
                disabled={pausing}
                className="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-100 disabled:opacity-40 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => pauseBrand()}
                disabled={pausing}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <PauseIcon className="h-4 w-4" />
                {pausing ? "Pausing..." : "Pause outreach"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
