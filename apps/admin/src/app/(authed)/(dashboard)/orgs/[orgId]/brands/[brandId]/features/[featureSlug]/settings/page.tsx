"use client";

import { useParams } from "next/navigation";
import { useFeatures } from "@/lib/features-context";
import { CrmSourceAudiencesCard } from "@/components/settings/crm-source-audiences-card";
import { isCrmOutreachFeature } from "@/lib/crm-outreach-feature";

// Feature Settings landing. Lifetime revenue and conversion rates live on the
// offer now (dashboard Sales path page), so nothing economic is edited here.
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

      {/* Audiences — CRM-outreach only: the people come from the brand's own
          imported CSVs, so the audiences ARE those files. Other features source
          their audiences from a provider search and have their own surface. */}
      {isCrmOutreachFeature(featureSlug) && (
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Audiences</h2>
          <p className="text-sm text-gray-500 mb-3">
            Which of this brand&apos;s imported CRM files are used as audiences for{" "}
            {featureName}. Brand-scoped.
          </p>
          <CrmSourceAudiencesCard brandId={brandId} />
        </div>
      )}
    </div>
  );
}
