import { Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <Skeleton className="h-8 w-72 rounded" />
        <Skeleton className="mt-2 h-4 w-96 rounded" />
      </div>
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-72 shrink-0 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Skeleton key={i} className="h-5 w-full rounded" />
            ))}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <Skeleton className="h-4 w-48 rounded" />
            <Skeleton className="mt-4 h-96 w-full rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
