import { DashboardPageSkeleton } from "@/components/dashboard-page-skeleton";

// Route-transition boundary for campaign-level pages (campaign overview +
// Outcomes/Settings entity pages under a campaign). Clicking between campaign
// sub-pages paints an instant skeleton while the leaf RSC resolves. The campaign
// sidebar/header persist above it. See dashboard-page-skeleton.
export default function Loading() {
  return <DashboardPageSkeleton />;
}
