import { Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <Skeleton className="h-8 w-48 rounded" />
        <Skeleton className="mt-2 h-4 w-96 rounded" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5">
            <Skeleton className="h-3 w-24 rounded" />
            <Skeleton className="mt-2 h-8 w-24 rounded" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="mt-4 h-64 w-full rounded" />
      </div>
    </div>
  );
}
