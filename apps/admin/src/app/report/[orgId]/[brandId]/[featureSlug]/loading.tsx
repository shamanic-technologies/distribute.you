import { SectionCard } from "@/components/report/section-card";

export default function OverviewLoading() {
  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <div className="h-6 w-32 bg-gray-100 rounded animate-pulse mb-2" />
        <div className="h-4 w-96 bg-gray-100 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
            <div className="h-7 w-12 bg-gray-100 rounded animate-pulse" />
            <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
      <SectionCard title="Cost per acquisition" description="Effective cost to reach each milestone.">
        <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-gray-50 rounded-lg p-3 space-y-2">
              <div className="h-3 w-16 bg-gray-100 rounded animate-pulse mx-auto" />
              <div className="h-6 w-12 bg-gray-100 rounded animate-pulse mx-auto" />
              <div className="h-2 w-10 bg-gray-100 rounded animate-pulse mx-auto" />
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
