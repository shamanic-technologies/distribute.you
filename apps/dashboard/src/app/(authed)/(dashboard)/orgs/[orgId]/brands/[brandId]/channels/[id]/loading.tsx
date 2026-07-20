import { DashboardPageSkeleton } from "@/components/dashboard-page-skeleton";

// Route-transition boundary for campaign-level pages (campaign overview + leads).
// Sibling navigation under the campaign segment paints this skeleton instantly;
// the persistent sidebar/header stay live. See dashboard-page-skeleton.
export default function Loading() {
  return <DashboardPageSkeleton />;
}
