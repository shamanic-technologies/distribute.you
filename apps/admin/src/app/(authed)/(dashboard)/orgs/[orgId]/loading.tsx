import { DashboardPageSkeleton } from "@/components/dashboard-page-skeleton";

// Route-transition boundary for org-level pages and every nested route that
// lacks a closer loading.tsx. Makes a sidebar click paint an instant skeleton
// instead of freezing the old page until the dynamic RSC resolves. The shared
// (dashboard) layout sidebar/header sit ABOVE this boundary and stay mounted.
export default function Loading() {
  return <DashboardPageSkeleton />;
}
