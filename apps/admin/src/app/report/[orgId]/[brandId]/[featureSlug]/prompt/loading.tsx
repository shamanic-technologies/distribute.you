import { SectionCard } from "@/components/report/section-card";

export default function PromptLoading() {
  return (
    <div className="p-4 sm:p-6 md:p-8 space-y-6">
      <SectionCard
        title="Generation prompt"
        description="The prompt used to draft each quote pitch from a journalist's request."
      >
        <div className="px-5 py-4 space-y-4">
          <div className="h-6 w-40 bg-gray-100 rounded animate-pulse" />
          <div className="flex gap-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-5 w-24 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-gray-50 border border-gray-200 rounded-lg animate-pulse" />
        </div>
      </SectionCard>
    </div>
  );
}
