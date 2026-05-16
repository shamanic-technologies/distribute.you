function ShimmerBlock({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`animate-pulse bg-gray-700/40 rounded ${className}`}
      style={style}
    />
  );
}

function StatCardSkeleton() {
  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
      <ShimmerBlock className="h-3 w-20 mb-3" />
      <ShimmerBlock className="h-7 w-24 mb-2" />
      <ShimmerBlock className="h-3 w-32" />
    </div>
  );
}

export function CompanyOverviewSkeleton() {
  return (
    <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6 space-y-3">
      <ShimmerBlock className="h-4 w-full" />
      <ShimmerBlock className="h-4 w-11/12" />
      <ShimmerBlock className="h-4 w-3/4" />
      <ShimmerBlock className="h-4 w-full mt-4" />
      <ShimmerBlock className="h-4 w-10/12" />
      <ShimmerBlock className="h-4 w-full mt-4" />
      <ShimmerBlock className="h-4 w-9/12" />
    </div>
  );
}

export function PlatformMetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function RevenueCreditsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: 2 }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

function TableSkeleton({ rows, cols }: { rows: number; cols: number }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4 border-b border-gray-700 pb-3">
        {Array.from({ length: cols }).map((_, i) => (
          <ShimmerBlock key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-4 border-b border-gray-800 py-3">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <ShimmerBlock key={colIdx} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function BarChartSkeleton() {
  return (
    <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-6">
      <ShimmerBlock className="h-3 w-24 mb-4" />
      <div className="flex items-end gap-1 h-48">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <ShimmerBlock className="h-2 w-8 mb-1" />
            <ShimmerBlock
              className="w-full"
              style={{ height: `${30 + ((i * 17) % 70)}%` }}
            />
            <ShimmerBlock className="h-2 w-6 mt-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

function GrowthCardSkeleton() {
  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
      <ShimmerBlock className="h-3 w-40 mb-3" />
      <ShimmerBlock className="h-7 w-20" />
    </div>
  );
}

function GrowthSectionSkeleton({
  tableRows,
  tableCols,
}: {
  tableRows: number;
  tableCols: number;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GrowthCardSkeleton />
        <GrowthCardSkeleton />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TableSkeleton rows={tableRows} cols={tableCols} />
        </div>
        <div className="space-y-6">
          <BarChartSkeleton />
          <BarChartSkeleton />
        </div>
      </div>
    </div>
  );
}

export function MonthlyGrowthSkeleton() {
  return <GrowthSectionSkeleton tableRows={3} tableCols={5} />;
}

export function WeeklyGrowthSkeleton() {
  return <GrowthSectionSkeleton tableRows={6} tableCols={4} />;
}
