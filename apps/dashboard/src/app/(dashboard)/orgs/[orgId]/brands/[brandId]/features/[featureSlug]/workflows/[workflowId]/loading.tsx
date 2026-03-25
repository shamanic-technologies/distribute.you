export default function WorkflowDetailLoading() {
  return (
    <div className="flex h-full overflow-hidden bg-white dark:bg-gray-900">
      {/* Desktop sidebar skeleton */}
      <aside className="hidden lg:flex w-[400px] flex-shrink-0 flex-col border-r border-gray-200 dark:border-white/[0.06] bg-gray-50/50 dark:bg-gray-900/50">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-white/[0.06] animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-100 dark:bg-white/[0.06] rounded-md w-3/4 animate-pulse" />
              <div className="flex gap-1.5">
                <div className="h-5 w-16 bg-gray-100 dark:bg-white/[0.06] rounded-md animate-pulse" />
                <div className="h-5 w-12 bg-gray-100 dark:bg-white/[0.06] rounded-md animate-pulse" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 p-5 space-y-3">
          <div className="h-3 bg-gray-100 dark:bg-white/[0.06] rounded w-full animate-pulse" />
          <div className="h-3 bg-gray-100 dark:bg-white/[0.06] rounded w-5/6 animate-pulse" />
          <div className="h-3 bg-gray-100 dark:bg-white/[0.06] rounded w-2/3 animate-pulse" />
        </div>
      </aside>
      {/* Chat area skeleton */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/[0.06] animate-pulse mb-4" />
        <div className="h-4 w-48 bg-gray-100 dark:bg-white/[0.06] rounded animate-pulse mb-2" />
        <div className="h-3 w-64 bg-gray-100 dark:bg-white/[0.06] rounded animate-pulse" />
      </div>
    </div>
  );
}
