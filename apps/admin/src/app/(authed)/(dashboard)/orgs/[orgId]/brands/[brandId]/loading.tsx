import { DashboardPageSkeleton } from "@/components/dashboard-page-skeleton";

// Route-transition boundary for brand-level pages (brand overview + the Database
// entity pages). Sibling navigation under the brand layout paints this skeleton
// instantly; the persistent sidebar/header stay live. See dashboard-page-skeleton.
export default function Loading() {
  return <DashboardPageSkeleton />;
}
