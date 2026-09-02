"use client";

import { FeatureWorkflowsPage } from "@/components/feature-stats/feature-workflows-page";

/**
 * Workflow — the AI Meeting Booking workflows, scored across all client brands.
 *
 * The body is the SHARED `FeatureWorkflowsPage`; the only thing this route owns
 * is which feature it is about.
 */
export default function AiMeetingBookingWorkflowsPage() {
  return <FeatureWorkflowsPage featureSlug="ai-meeting-booking" />;
}
