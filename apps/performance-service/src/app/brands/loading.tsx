function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`bg-gray-200 rounded animate-pulse ${className}`} />;
}

function SkeletonTableRow() {
  return (
    <tr>
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <SkeletonBar className="w-7 h-7 !rounded" />
          <SkeletonBar className="h-4 w-28" />
        </div>
      </td>
      <td className="px-4 py-4"><SkeletonBar className="h-4 w-12" /></td>
      <td className="px-4 py-4"><SkeletonBar className="h-4 w-12" /></td>
      <td className="px-4 py-4"><SkeletonBar className="h-4 w-12" /></td>
      <td className="px-4 py-4"><SkeletonBar className="h-4 w-14" /></td>
      <td className="px-4 py-4"><SkeletonBar className="h-4 w-14" /></td>
      <td className="px-4 py-4"><SkeletonBar className="h-4 w-14" /></td>
    </tr>
  );
}

export default function BrandsLoading() {
  return (
    <main className="min-h-screen bg-white">
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="font-display text-3xl font-bold mb-2 text-gray-800">
            Brand Leaderboard
          </h1>
          <p className="text-gray-600 mb-8">
            Performance data for every brand running campaigns through MCP Factory.
            Click column headers to sort.
          </p>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
                    <th className="px-4 py-3"><SkeletonBar className="h-3 w-16" /></th>
                    <th className="px-4 py-3"><SkeletonBar className="h-3 w-16" /></th>
                    <th className="px-4 py-3"><SkeletonBar className="h-3 w-16" /></th>
                    <th className="px-4 py-3"><SkeletonBar className="h-3 w-14" /></th>
                    <th className="px-4 py-3"><SkeletonBar className="h-3 w-14" /></th>
                    <th className="px-4 py-3"><SkeletonBar className="h-3 w-14" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <SkeletonTableRow key={i} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
