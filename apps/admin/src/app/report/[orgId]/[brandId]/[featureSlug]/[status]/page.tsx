import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { PitchStatusView } from "@/components/report/pitch-status-view";
import { TableSectionSkeleton } from "@/components/report/skeletons";
import { isExpertQuoteFeature } from "@/lib/expert-quote-feature";
import { tabForSlug } from "@/lib/report-pitch-tabs";

// Read-only press-tracker tab (Published / Selected / Pitched). One dynamic
// segment renders every tab — the status slug selects which pitch statuses to
// show. Interactive ISR window matches the other report surfaces.
export const revalidate = 14400;
export const maxDuration = 300;

interface PageProps {
  params: Promise<{
    orgId: string;
    brandId: string;
    featureSlug: string;
    status: string;
  }>;
}

export default async function PitchStatusPage({ params }: PageProps) {
  const { orgId, brandId, featureSlug, status } = await params;

  // Only the PR-Expert quote family uses the status-tab surface; any other
  // feature hitting this route is a 404 (the sidebar only renders it there).
  if (!isExpertQuoteFeature(featureSlug)) {
    notFound();
  }
  // A retired/unknown status slug (e.g. the old `in-review`) redirects to the
  // canonical first tab instead of 404-ing a bookmarked link.
  const tab = tabForSlug(status);
  if (!tab) {
    redirect(`/report/${orgId}/${brandId}/${featureSlug}/published`);
  }

  const columnLabels = ["Publication", "Article", "DR", "Attribution", tab.dateLabel];

  return (
    <Suspense
      fallback={
        <TableSectionSkeleton title={tab.label} columnLabels={columnLabels} />
      }
    >
      <PitchStatusView
        orgId={orgId}
        brandId={brandId}
        featureSlug={featureSlug}
        tab={tab}
      />
    </Suspense>
  );
}
