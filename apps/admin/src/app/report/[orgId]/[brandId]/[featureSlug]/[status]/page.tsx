import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PitchStatusView } from "@/components/report/pitch-status-view";
import { TableSectionSkeleton } from "@/components/report/skeletons";
import { isExpertQuoteFeature } from "@/lib/expert-quote-feature";
import { tabForSlug } from "@/lib/report-pitch-tabs";

// Read-only press-tracker tab (Published / Selected / In Review / Pitched).
// One dynamic segment renders every tab — the status slug selects which pitch
// statuses to show. Interactive ISR window matches the other report surfaces.
export const revalidate = 14400;
export const maxDuration = 300;

const COLUMN_LABELS = ["Publication", "Article", "DR", "Attribution", "Updated"];

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
  // slug hitting this route is a 404 (the sidebar only renders it for the
  // HITL feature). An unknown status slug is a 404 too.
  const tab = tabForSlug(status);
  if (!isExpertQuoteFeature(featureSlug) || !tab) {
    notFound();
  }

  return (
    <Suspense
      fallback={
        <TableSectionSkeleton title={tab.label} columnLabels={COLUMN_LABELS} />
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
