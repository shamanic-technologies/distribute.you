function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`bg-gray-200 rounded animate-pulse ${className}`} />;
}

function SkeletonStatsBar() {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 px-4 bg-gray-50 rounded-lg border border-gray-200">
      <SkeletonBar className="h-4 w-10" />
      <div className="h-4 w-px bg-gray-300 hidden sm:block" />
      <SkeletonBar className="h-4 w-24" />
      <div className="h-4 w-px bg-gray-300 hidden sm:block" />
      <SkeletonBar className="h-4 w-20" />
      <div className="h-4 w-px bg-gray-300 hidden sm:block" />
      <SkeletonBar className="h-4 w-24" />
      <div className="h-4 w-px bg-gray-300 hidden sm:block" />
      <SkeletonBar className="h-4 w-20" />
    </div>
  );
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

function SkeletonTable({ rows = 3 }: { rows?: number }) {
  return (
    <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3"><SkeletonBar className="h-3 w-16" /></th>
            <th className="px-4 py-3"><SkeletonBar className="h-3 w-16" /></th>
            <th className="px-4 py-3"><SkeletonBar className="h-3 w-16" /></th>
            <th className="px-4 py-3"><SkeletonBar className="h-3 w-16" /></th>
            <th className="px-4 py-3"><SkeletonBar className="h-3 w-14" /></th>
            <th className="px-4 py-3"><SkeletonBar className="h-3 w-14" /></th>
            <th className="px-4 py-3"><SkeletonBar className="h-3 w-14" /></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonTableRow key={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SkeletonSection() {
  return (
    <section className="py-10 px-4 border-b border-gray-100">
      <div className="max-w-6xl mx-auto">
        <SkeletonBar className="h-6 w-48 mb-4" />
        <div className="flex gap-1 mb-4">
          <SkeletonBar className="h-9 w-20 !rounded-lg" />
          <SkeletonBar className="h-9 w-24 !rounded-lg" />
        </div>
        <SkeletonStatsBar />
        <div className="mt-4">
          <SkeletonTable />
        </div>
      </div>
    </section>
  );
}

export default function HomeLoading() {
  return (
    <main className="min-h-screen">
      {/* Hero — static, renders immediately */}
      <section className="py-12 md:py-16 px-4 gradient-bg">
        <div className="max-w-6xl mx-auto text-center">
          <div className="inline-block bg-accent-100 text-accent-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6 border border-accent-200">
            100% Transparent
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4 text-gray-800">
            Real Performance, <span className="gradient-text">Real Data</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Every metric from every campaign. No cherry-picking, no hidden numbers.
          </p>
        </div>
      </section>

      {/* Skeleton category sections */}
      <div className="bg-white">
        <SkeletonSection />
        <SkeletonSection />
      </div>
    </main>
  );
}
