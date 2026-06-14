import { Skeleton } from "@/components/skeleton";

/**
 * Generic content-area skeleton rendered by the route-segment `loading.tsx`
 * boundaries (org / brand / feature / campaign). It is the INSTANT nav-transition
 * fallback Next.js paints the moment a sidebar link is clicked — the shared
 * sidebar + header (which live in the persistent `(dashboard)` layout, above
 * these boundaries) stay mounted and interactive while the destination route's
 * RSC + chunk resolve. Without a `loading.tsx`, a click on a DYNAMIC dashboard
 * route blocks on a full server roundtrip with the old page frozen on screen.
 *
 * Shape-matches the dense-page container (`p-4 md:p-8 max-w-7xl mx-auto`,
 * header + stat-card row + a main block) so the transition into each page's own
 * per-card React-Query skeletons is seamless (no layout shift / double flash).
 * It only shows during the navigation fetch; warm-cache pages reveal instantly.
 */
export function DashboardPageSkeleton() {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      {/* Stat-card row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-2"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      {/* Main block */}
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
