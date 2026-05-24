import { SectionCard } from "./section-card";

export function HeaderSkeleton() {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-5">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-lg bg-gray-100 animate-pulse" />
          <div className="space-y-2">
            <div className="h-6 w-48 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
        <div className="space-y-1 text-right">
          <div className="h-3 w-40 bg-gray-100 rounded animate-pulse ml-auto" />
          <div className="h-3 w-24 bg-gray-100 rounded animate-pulse ml-auto" />
        </div>
      </div>
    </header>
  );
}

function TableRowSkeleton({ cols, isFirst }: { cols: number; isFirst: boolean }) {
  return (
    <tr className={isFirst ? "" : "border-t border-gray-100"}>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 bg-gray-100 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

interface TableSectionSkeletonProps {
  title: string;
  description?: string;
  columnLabels: string[];
  rowCount?: number;
}

export function TableSectionSkeleton({ title, description, columnLabels, rowCount = 5 }: TableSectionSkeletonProps) {
  return (
    <SectionCard title={title} description={description}>
      {/* Mirror ReportTable's filter bar so the swap to real data
          doesn't cause layout shift. */}
      <div className="px-5 py-3 border-b border-gray-200 flex flex-wrap gap-3 items-center bg-gray-50/40">
        <div className="flex-1 min-w-[200px] h-7 bg-gray-100 rounded-lg animate-pulse" />
        <div className="h-7 w-28 bg-gray-100 rounded-lg animate-pulse" />
      </div>
      <table className="w-full text-sm border-collapse">
        <thead className="bg-gray-50">
          <tr>
            {columnLabels.map((label) => (
              <th key={label} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }).map((_, i) => (
            <TableRowSkeleton key={i} cols={columnLabels.length} isFirst={i === 0} />
          ))}
        </tbody>
      </table>
    </SectionCard>
  );
}

export function ListSectionSkeleton({ title, description, rowCount = 4 }: { title: string; description?: string; rowCount?: number }) {
  return (
    <SectionCard title={title} description={description}>
      <ul className="divide-y divide-gray-100">
        {Array.from({ length: rowCount }).map((_, i) => (
          <li key={i} className="px-5 py-4 space-y-2">
            <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse" />
            <div className="h-3 w-1/2 bg-gray-100 rounded animate-pulse" />
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

export function OverviewSkeleton() {
  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl">
      <div>
        <div className="h-6 w-32 bg-gray-100 rounded animate-pulse mb-2" />
        <div className="h-4 w-96 bg-gray-100 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
            <div className="h-7 w-12 bg-gray-100 rounded animate-pulse" />
            <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
