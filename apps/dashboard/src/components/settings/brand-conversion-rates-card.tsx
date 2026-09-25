"use client";

import { getBrandConversionRates } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { SalesFunnelMark } from "@/components/marks/sales-funnel-mark";
import { salesFunnelByKey } from "@/lib/sales-funnels";
import { FunnelRatesEditor } from "@/components/settings/funnel-rates-editor";

// THE BRAND'S CONVERSION RATES, one block per sales funnel the brand declared on
// any offer. Owner-decided 2026-09-25: a rate describes how a BRAND sells, so it
// is stated once here and shared by every offer selling that funnel (lifetime
// revenue and the booking link stay on each offer's own Settings).
//
// The rate every money figure is priced on is resolved by features-service —
// measured on the brand's own leads once enough of them reached the step, else
// the brand's own value, else the median of our clients — and each row says which.
// Nothing here re-derives it.

export function BrandConversionRatesCard({ brandId }: { brandId: string }) {
  const ratesQ = useAuthQuery(["brandConversionRates", brandId], () => getBrandConversionRates(brandId));

  if (ratesQ.isPending && !ratesQ.isError) {
    return (
      <div className="space-y-3 p-5">
        <div className="h-4 w-48 animate-pulse rounded bg-gray-100" />
        <div className="h-10 w-full animate-pulse rounded bg-gray-100" />
        <div className="h-10 w-full animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  if (ratesQ.isError || !ratesQ.data) {
    return <p className="p-5 text-sm text-gray-500">We could not read your conversion rates right now.</p>;
  }

  const { funnels, minMeasuredFromReached } = ratesQ.data;

  if (funnels.length === 0) {
    return (
      <p className="p-5 text-sm text-gray-500">
        No sales funnel yet. Pick how an offer sells on its Settings, and its rates show up here.
      </p>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {funnels.map((funnel) => (
        <div key={funnel.funnelKey} className="p-5" data-conversion-funnel={funnel.funnelKey}>
          <div className="mb-2 flex items-center gap-3">
            <SalesFunnelMark def={salesFunnelByKey(funnel.funnelKey)} size="sm" />
            <p className="text-sm font-medium text-gray-900">{funnel.name}</p>
          </div>
          <FunnelRatesEditor brandId={brandId} funnel={funnel} minMeasured={minMeasuredFromReached} />
        </div>
      ))}
    </div>
  );
}
