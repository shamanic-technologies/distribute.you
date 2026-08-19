import { DashboardPageSkeleton } from "@/components/dashboard-page-skeleton";

// Route-transition boundary for offer-level pages (offer overview + audiences +
// leads + the campaigns list). Sibling navigation under the offer segment paints
// this skeleton instantly; the persistent sidebar/header stay live.
export default function Loading() {
  return <DashboardPageSkeleton />;
}
