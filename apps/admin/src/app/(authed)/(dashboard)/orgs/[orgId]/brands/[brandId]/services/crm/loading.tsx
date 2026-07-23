import { DashboardPageSkeleton } from "@/components/dashboard-page-skeleton";

// Route-transition boundary for the brand-level CRM surface (Leads + Sources).
// Sibling navigation under the CRM level paints this instantly; the persistent
// sidebar/header stay live. See dashboard-page-skeleton.
export default function Loading() {
  return <DashboardPageSkeleton />;
}
