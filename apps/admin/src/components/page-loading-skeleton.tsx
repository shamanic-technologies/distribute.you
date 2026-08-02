import { Skeleton } from "@/components/skeleton";

/**
 * The fallback every top-level admin page shows the instant it is clicked.
 *
 * Without a `loading.tsx` boundary, Next 16 does NOT prefetch a dynamic route
 * and BLOCKS on the page you are leaving until the new one's full server render
 * returns. Every admin route is dynamic (Clerk `auth()`), and some await a
 * multi-service fan-out server-side, so a sidebar click did nothing at all for
 * seconds: no paint, no route change, and the old page still under the cursor.
 *
 * A boundary flips that. The route commits immediately and this renders while
 * the page resolves behind it, which is the difference between "instant, loading
 * in place" and "the app is frozen".
 *
 * Deliberately generic: it stands in for pages with quite different layouts, so
 * it sketches a heading and a body rather than pretending to match any one of
 * them. It must NEVER be placed at the `(dashboard)` segment itself — that would
 * blank the sidebar and the header on every navigation.
 */
export function PageLoadingSkeleton() {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <Skeleton className="h-8 w-56 rounded" />
        <Skeleton className="mt-2 h-4 w-96 rounded" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="mt-2 h-8 w-24 rounded" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="mt-4 h-56 w-full rounded" />
      </div>
    </div>
  );
}
