function SkeletonBar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-[var(--dy-surface-hi)] ${className}`} />;
}

function ProviderSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <SkeletonBar className="w-9 h-9 !rounded" />
        <SkeletonBar className="h-7 w-40" />
      </div>
      <div className="dy-card overflow-hidden">
        <div className="flex bg-[var(--dy-surface-hi)] px-4 py-3">
          <SkeletonBar className="h-3 w-20 mr-auto" />
          <SkeletonBar className="h-3 w-12 mr-auto" />
          <SkeletonBar className="h-3 w-12" />
        </div>
        <div className="divide-y divide-[var(--dy-border)]">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex items-center">
              <SkeletonBar className="h-4 w-48 mr-auto" />
              <SkeletonBar className="h-4 w-16 mr-auto" />
              <SkeletonBar className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ProviderTablesSkeleton() {
  return (
    <div className="space-y-10">
      <ProviderSkeleton rows={5} />
      <ProviderSkeleton rows={4} />
      <ProviderSkeleton rows={3} />
    </div>
  );
}
