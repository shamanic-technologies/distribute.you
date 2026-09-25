"use client";

import { useEffect } from "react";
import { getBrandConversionRates } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { salesFunnelByKey, type SalesFunnelKey } from "@/lib/sales-funnels";
import { unmeasuredArrows } from "@/lib/brand-conversion-rates";
import { SalesFunnelMark } from "@/components/marks/sales-funnel-mark";
import { FunnelRatesEditor } from "@/components/settings/funnel-rates-editor";

// Shown ONCE, the moment an offer starts selling through a funnel the brand has
// not measured yet. It states the numbers the product will price this funnel on
// (the brand's own values, else the median of our clients), plus the booking link
// and lifetime revenue this offer just stated, and lets the person correct any
// rate on the spot.
//
// A rate corrected here is the BRAND's rate: it is the same write Brand Settings
// makes, so every offer selling this funnel moves with it. Closing without saving
// writes nothing — a median shown as a prefill is never stored as a statement.
//
// A funnel whose every arrow is already measured has nothing to confirm, so the
// modal closes itself rather than asking about numbers nobody typed.

export function FunnelActivationModal({
  brandId,
  funnelKey,
  lifetimeRevenueUsd,
  bookingUrl,
  onClose,
}: {
  brandId: string;
  funnelKey: SalesFunnelKey;
  lifetimeRevenueUsd: number | null;
  bookingUrl: string | null;
  onClose: () => void;
}) {
  const def = salesFunnelByKey(funnelKey);
  const ratesQ = useAuthQuery(["brandConversionRates", brandId], () => getBrandConversionRates(brandId));
  const funnel = ratesQ.data?.funnels.find((f) => f.funnelKey === funnelKey) ?? null;
  const nothingToConfirm = funnel !== null && unmeasuredArrows(funnel.arrows).length === 0;

  useEffect(() => {
    if (nothingToConfirm) onClose();
  }, [nothingToConfirm, onClose]);

  if (nothingToConfirm) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="funnel-activation-title"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-xl border border-gray-200 bg-white shadow-xl sm:max-w-lg sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 id="funnel-activation-title" className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <SalesFunnelMark def={def} size="sm" />
            {def.name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <p className="text-sm text-gray-600">
            We have not measured this funnel on your own leads yet, so these are the numbers we
            will price it on until we have. Change any rate that looks wrong: it applies to every
            offer of this brand.
          </p>

          <div className="mt-4">
            {ratesQ.isPending && !ratesQ.isError ? (
              <div className="space-y-2">
                <div className="h-10 w-full animate-pulse rounded bg-gray-100" />
                <div className="h-10 w-full animate-pulse rounded bg-gray-100" />
              </div>
            ) : funnel === null ? (
              <p className="text-sm text-gray-500">We could not read this funnel&apos;s rates right now.</p>
            ) : (
              <FunnelRatesEditor
                brandId={brandId}
                funnel={funnel}
                minMeasured={ratesQ.data?.minMeasuredFromReached ?? 10}
                saveLabel="Save rates"
                onSaved={onClose}
              />
            )}
          </div>

          <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-gray-500">Customer lifetime revenue</dt>
              <dd className="text-gray-800">
                {lifetimeRevenueUsd === null ? "Not set" : `$${lifetimeRevenueUsd.toLocaleString("en-US")}`}
              </dd>
            </div>
            {def.bookingLink && (
              <div className="min-w-0">
                <dt className="text-xs text-gray-500">Booking link</dt>
                <dd className="truncate text-gray-800" title={bookingUrl ?? undefined}>
                  {bookingUrl ?? "Not set"}
                </dd>
              </div>
            )}
          </dl>
          <p className="mt-2 text-xs text-gray-400">
            Lifetime revenue and the booking link belong to this offer. Change them in its funnel card.
          </p>

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-100"
            >
              Keep these numbers
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
