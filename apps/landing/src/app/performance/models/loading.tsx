function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`bg-gray-200 rounded animate-pulse ${className}`} />;
}

function SkeletonTableRow() {
  return (
    <tr>
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          <SkeletonBar className="h-4 w-32" />
          <SkeletonBar className="h-5 w-16 !rounded-full" />
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

export default function ModelsLoading() {
  return (
    <main className="min-h-screen bg-white">
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="font-display text-3xl font-bold mb-2 text-gray-800">
            Workflow Leaderboard
          </h1>
          <p className="text-gray-600 mb-8">
            Compare outreach workflows by real campaign performance.
            Which workflow delivers the best open rates, visits, and replies?
          </p>

          <div className="flex gap-2 mb-4">
            <SkeletonBar className="h-7 w-12 !rounded-full" />
            <SkeletonBar className="h-7 w-24 !rounded-full" />
            <SkeletonBar className="h-7 w-28 !rounded-full" />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Workflow</th>
                    <th className="px-4 py-3"><SkeletonBar className="h-3 w-16" /></th>
                    <th className="px-4 py-3"><SkeletonBar className="h-3 w-16" /></th>
                    <th className="px-4 py-3"><SkeletonBar className="h-3 w-16" /></th>
                    <th className="px-4 py-3"><SkeletonBar className="h-3 w-14" /></th>
                    <th className="px-4 py-3"><SkeletonBar className="h-3 w-14" /></th>
                    <th className="px-4 py-3"><SkeletonBar className="h-3 w-14" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {Array.from({ length: 6 }).map((_, i) => (
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
