"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import {
  getWelcomePromo,
  setWelcomePromo,
  ApiError,
  type WelcomePromo,
} from "@/lib/api";

const QUERY_KEY = ["welcomePromo"] as const;

function dollarsFromCents(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}

/**
 * Staff-only control to read + re-price the welcome signup gift. Rendered inside
 * the already-staff-gated public-metrics home (the page redirects non-staff to
 * /orgs before this ever mounts), so visibility is gated by placement; the PATCH
 * is additionally staff-gated server-side at the gateway. Reads/edits in dollars,
 * PATCHes integer cents. No silent fallback — query/mutation errors surface inline.
 */
export function WelcomeGiftAdmin() {
  const queryClient = useQueryClient();

  const { data, isPending, error: queryError } = useAuthQuery<WelcomePromo>(
    QUERY_KEY,
    () => getWelcomePromo(),
  );

  // Local dollar input, seeded from the fetched amount. Reseeded whenever the
  // server value changes (initial load + after a successful save).
  const [dollars, setDollars] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  useEffect(() => {
    if (data) setDollars(dollarsFromCents(data.amountCents));
  }, [data]);

  const mutation = useMutation({
    mutationFn: (amountCents: number) => setWelcomePromo(amountCents),
    onSuccess: (saved) => {
      // Write the persisted value straight to the cache so the field reflects it
      // immediately, without waiting on a refetch that could 5xx.
      queryClient.setQueryData(QUERY_KEY, saved);
      setDollars(dollarsFromCents(saved.amountCents));
    },
  });

  const handleSave = () => {
    setValidationError(null);
    const parsed = Number(dollars);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setValidationError("Enter a non-negative dollar amount.");
      return;
    }
    const amountCents = Math.round(parsed * 100);
    mutation.mutate(amountCents);
  };

  const isSaving = mutation.isPending;
  const mutationErrorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error
        ? "Failed to save. Please retry."
        : null;
  const queryErrorMessage = queryError
    ? "Couldn't load the current welcome gift amount."
    : null;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-gray-950">Welcome signup gift</h2>
      <p className="mt-1 text-sm text-gray-500">
        Credit granted to every new signup on their first org. Re-pricing applies
        to the next signup immediately — existing orgs keep their grant.
      </p>

      {queryErrorMessage ? (
        <p className="mt-4 text-sm text-red-600">{queryErrorMessage}</p>
      ) : (
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="welcome-gift-amount"
              className="text-xs font-medium uppercase tracking-wide text-gray-500"
            >
              Amount (USD)
            </label>
            {isPending ? (
              <div className="h-10 w-40 animate-pulse rounded-lg bg-gray-100" />
            ) : (
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  $
                </span>
                <input
                  id="welcome-gift-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={dollars}
                  onChange={(e) => setDollars(e.target.value)}
                  disabled={isSaving}
                  className="w-40 rounded-lg border border-gray-200 py-2 pl-6 pr-3 text-sm text-gray-900 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:bg-gray-50"
                />
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || isSaving}
            className={`inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 ${
              isSaving
                ? "cursor-wait"
                : "disabled:cursor-not-allowed disabled:opacity-40"
            }`}
          >
            {isSaving && (
              <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            )}
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      )}

      {validationError && (
        <p className="mt-3 text-sm text-red-600">{validationError}</p>
      )}
      {mutationErrorMessage && (
        <p className="mt-3 text-sm text-red-600">{mutationErrorMessage}</p>
      )}
    </section>
  );
}
