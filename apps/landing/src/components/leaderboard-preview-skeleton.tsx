function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`bg-gray-200 rounded animate-pulse ${className}`} />;
}

function FeatureCardSkeleton() {
  return (
    <div className="rounded-xl p-5 border border-gray-200 bg-white">
      <SkeletonBar className="h-4 w-32 mb-4" />
      <div className="space-y-3">
        <div>
          <SkeletonBar className="h-2.5 w-24 mb-1.5" />
          <SkeletonBar className="h-7 w-20" />
        </div>
        <div>
          <SkeletonBar className="h-2.5 w-28 mb-1.5" />
          <SkeletonBar className="h-7 w-24" />
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-100">
        <SkeletonBar className="h-2.5 w-32 mb-3" />
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <SkeletonBar className="h-3 w-3" />
              <SkeletonBar className="w-[18px] h-[18px]" />
              <SkeletonBar className="h-3 flex-1" />
              <SkeletonBar className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LeaderboardPreviewSkeleton() {
  return (
    <div>
      <div className="grid md:grid-cols-3 gap-4">
        <FeatureCardSkeleton />
        <FeatureCardSkeleton />
        <FeatureCardSkeleton />
      </div>
      <div className="text-center mt-4">
        <SkeletonBar className="h-4 w-48 mx-auto" />
      </div>
    </div>
  );
}
