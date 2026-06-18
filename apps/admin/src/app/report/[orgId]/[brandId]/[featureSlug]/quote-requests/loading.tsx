// Skeleton for the HITL Quote-requests queue (list + draft panel) — NOT the
// sales stats/CPA funnel. Matches the two-column PublicHitlQueue layout so the
// swap to real data causes no layout shift.
export default function QuoteRequestsLoading() {
  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 space-y-2">
        <div className="h-6 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="h-4 w-96 max-w-full bg-gray-100 rounded animate-pulse" />
      </div>
      <div className="flex flex-col md:flex-row gap-4">
        {/* Queue list */}
        <div className="md:w-1/2 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-200 p-4 space-y-2"
            >
              <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-gray-100 rounded animate-pulse" />
              <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
            </div>
          ))}
        </div>
        {/* Draft panel */}
        <div className="md:w-1/2">
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3 h-64">
            <div className="h-4 w-2/3 bg-gray-100 rounded animate-pulse" />
            <div className="h-3 w-full bg-gray-100 rounded animate-pulse" />
            <div className="h-3 w-full bg-gray-100 rounded animate-pulse" />
            <div className="h-3 w-5/6 bg-gray-100 rounded animate-pulse" />
            <div className="h-9 w-32 bg-gray-100 rounded-lg animate-pulse mt-4" />
          </div>
        </div>
      </div>
    </div>
  );
}
