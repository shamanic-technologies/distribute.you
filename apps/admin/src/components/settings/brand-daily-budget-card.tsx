"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { getBrandDailyBudget, saveBrandDailyBudget } from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";

// Wire value is cents; the input edits whole dollars. Empty input = "never set".
const centsToDollars = (cents: number | null): string =>
  cents === null ? "" : String(cents / 100);
const dollarsToCents = (dollars: string): number =>
  Math.round((parseFloat(dollars) || 0) * 100);

export function BrandDailyBudgetCard({ brandId }: { brandId: string }) {
  const queryClient = useQueryClient();

  const { data, isPending } = useAuthQuery(
    ["brandDailyBudget", brandId],
    () => getBrandDailyBudget(brandId),
  );

  // null until hydrated from the query; "" = unset (empty input, placeholder shows).
  const [dollars, setDollars] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
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

  function update(value: string) {
    setDollars(value);
    setDirty(true);
    setSaved(false);
  }

  function handleSave() {
    if (dollars === null) return;
    mutate(dollarsToCents(dollars));
  }

  if (isPending || dollars === null) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="h-4 w-48 bg-gray-100 rounded animate-pulse mb-4" />
        <div className="h-3 w-32 bg-gray-100 rounded animate-pulse mb-2" />
        <div className="h-9 w-48 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="p-5">
        <p className="text-sm text-gray-500 mb-4">
          The most this brand spends per day across its active campaigns. Used to pace
          outreach -- separate from your credit balance.
        </p>

        <div className="max-w-xs">
          <label className="block text-xs text-gray-500 mb-1">Daily budget</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              $
            </span>
            <input
              type="number"
              min="0"
              step="1"
              value={dollars}
              placeholder="e.g. 50"
              onChange={(e) => update(e.target.value)}
              className="w-full pl-7 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>
          <p className="mt-1.5 text-xs text-gray-400">Set 0 to pause spend.</p>
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
          {saved && !dirty && <span className="text-sm text-green-600">Saved</span>}
        </div>
      </div>
    </div>
  );
}
