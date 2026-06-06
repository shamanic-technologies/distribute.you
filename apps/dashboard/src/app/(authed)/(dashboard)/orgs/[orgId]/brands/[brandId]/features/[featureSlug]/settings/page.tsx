"use client";

import { useParams } from "next/navigation";
import { useFeatures } from "@/lib/features-context";
import { BrandSalesEconomicsCard } from "@/components/settings/brand-sales-economics-card";

// Feature Settings landing — mirrors the Brand Settings "Sales Economics"
// section. The economics are brand-scoped (one set per brand, reused across the
// brand's campaigns), so this renders the SAME BrandSalesEconomicsCard keyed on
// the route's brandId — editing here edits the same data as Brand Settings.
export default function FeatureSettingsPage() {
  const params = useParams();
  const brandId = params.brandId as string;
  const featureSlug = params.featureSlug as string;

  const { getFeature } = useFeatures();
  const feature = getFeature(featureSlug);
  const featureName = feature?.name ?? featureSlug;

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-8">Feature Settings</h1>

      {/* Sales Economics — same card + brand-scoped data as Brand Settings. */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Sales Economics</h2>
        <p className="text-sm text-gray-500 mb-3">
          Customer value + conversion funnel for {featureName}. Shared with this brand&apos;s
          other settings and every sales campaign.
        </p>
        <BrandSalesEconomicsCard brandId={brandId} />
      </div>
    </div>
  );
}
