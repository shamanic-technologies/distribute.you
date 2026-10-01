"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ApiError, getOfferEconomics, saveOfferLifetimeRevenue } from "@/lib/api";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { invalidateConversionRates } from "@/lib/write-invalidation";
import { SettingsSaveRow } from "@/components/settings/settings-save-row";
import { Skeleton } from "@/components/skeleton";

/** A refusal is OUR copy, keyed on the status; `err.message` is a downstream body. */
function lifetimeRevenueErrorMessage(err: unknown): string {
  const status = err instanceof ApiError ? err.status : null;
  if (status === 403) return "You do not have access to this offer.";
  if (status === 404) return "This offer no longer exists.";
  if (status === 400) return "A lifetime revenue is a whole number of dollars.";
  return "We could not save the lifetime revenue. Try again in a moment.";
}

export function OfferLifetimeRevenue({ brandId, offerId }: { brandId: string; offerId: string }) {
  const queryClient = useQueryClient();
  const economicsQ = useAuthQuery(["offerEconomics", brandId, offerId], () =>
    getOfferEconomics(brandId, offerId),
  );

  // Seeded from the read and RE-SEEDED on a new payload, never a once-per-mount latch
  // (the disk snapshot paints first); a field the user touched outranks the server.
  const [value, setValue] = useState("");
  const [baseline, setBaseline] = useState("");
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(false);
  const seededFrom = useRef<unknown>(null);
  useEffect(() => {
    const data = economicsQ.data;
    if (!data || seededFrom.current === data) return;
    seededFrom.current = data;
    const next = data.lifetimeRevenueUsd == null ? "" : String(data.lifetimeRevenueUsd);
    setBaseline(next);
    if (!touched) setValue(next);
  }, [economicsQ.data, touched]);

  const trimmed = value.replace(/,/g, "").trim();
  const parsed = trimmed === "" ? null : /^\d+$/.test(trimmed) ? Number(trimmed) : undefined;
  const dirty = value.trim() !== baseline.trim();

  const mutation = useMutation({
    mutationFn: () => saveOfferLifetimeRevenue(brandId, offerId, parsed ?? null),
    onSuccess: (data) => {
      queryClient.setQueryData(["offerEconomics", brandId, offerId], data);
      seededFrom.current = data;
      const next = data.lifetimeRevenueUsd == null ? "" : String(data.lifetimeRevenueUsd);
      setBaseline(next);
      setValue(next);
      setTouched(false);
      setSaved(true);
      // Every money figure divides by it, so the priced surfaces are re-read now.
      invalidateConversionRates(queryClient);
    },
    onError: (err) => console.error("[dashboard] saveOfferLifetimeRevenue failed", err),
  });

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5" data-offer-lifetime-revenue>
      <h2 className="text-sm font-semibold text-gray-800">Lifetime revenue</h2>
      <p className="mt-0.5 mb-3 text-xs text-gray-500">
        What a client won through this offer is worth to you over their lifetime. Every
        return we show is priced on it.
      </p>
      {economicsQ.isPending && !economicsQ.isError ? (
        <Skeleton className="h-9 w-40" />
      ) : economicsQ.isError ? (
        <p className="text-sm text-gray-500">We could not read this offer right now.</p>
      ) : (
        <label className="flex w-48 items-center gap-1 rounded-md border border-gray-200 px-2 py-1.5 text-sm focus-within:ring-2 focus-within:ring-brand-300">
          <span className="text-gray-400">$</span>
          <input
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => {
              setTouched(true);
              setSaved(false);
              setValue(e.target.value);
            }}
            aria-label="Lifetime revenue in dollars"
            className="w-full text-right tabular-nums outline-none"
          />
        </label>
      )}
      {parsed === undefined && (
        <p className="mt-2 text-xs text-red-600">Enter a whole number of dollars, or leave it empty.</p>
      )}
      {mutation.isError && (
        <p className="mt-2 text-xs text-red-600">{lifetimeRevenueErrorMessage(mutation.error)}</p>
      )}
      <SettingsSaveRow
        dirty={dirty}
        saving={mutation.isPending}
        saved={saved}
        disabled={parsed === undefined}
        onSave={() => mutation.mutate()}
      />
    </section>
  );
}

