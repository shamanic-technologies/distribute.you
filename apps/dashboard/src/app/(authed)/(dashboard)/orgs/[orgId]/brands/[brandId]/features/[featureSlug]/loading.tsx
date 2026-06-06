import { DashboardPageSkeleton } from "@/components/dashboard-page-skeleton";

// Route-transition boundary for feature-level pages (overview / leads / emails /
// outlets / journalists / articles / campaigns / …). This is the boundary the
// reported "click sidebar → nothing for seconds" case hits: clicking between
// feature pages now paints an instant skeleton while the leaf RSC resolves,
// instead of blocking on the old page. Sidebar/header persist above it.
export default function Loading() {
  return <DashboardPageSkeleton />;
}
