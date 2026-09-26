"use client";

import { getBrandConversionRates } from "@/lib/api";
import { useAuthQuery } from "@/lib/use-auth-query";
import { LegRatesEditor } from "@/components/settings/leg-rates-editor";

// THE BRAND'S CONVERSION RATES, one row per LEG. Owner-decided 2026-09-25: a rate
// describes how a BRAND sells, so it is stated once here and shared by every offer
// (lifetime revenue stays on each offer's own Settings).
//
// The rate every money figure is priced on is resolved by features-service —
// measured on the brand's own leads once enough of them reached the step, else the
// brand's own value, else the median of our clients — and each row says which.
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

  const { legs, minMeasuredFromReached } = ratesQ.data;

  if (legs.length === 0) {
    return (
      <p className="p-5 text-sm text-gray-500">
        No conversion rate yet. Once one of your offers runs a campaign, its rates show up here.
      </p>
    );
  }

  return (
    <div className="p-5">
      <LegRatesEditor brandId={brandId} legs={legs} minMeasured={minMeasuredFromReached} />
    </div>
  );
}
