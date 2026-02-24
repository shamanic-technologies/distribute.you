import { formatPercent, formatCostCents, type CategorySectionStats } from "@/lib/fetch-leaderboard";

export function StatsBar({ stats }: { stats: CategorySectionStats }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm py-3 px-4 bg-gray-50 rounded-lg border border-gray-200">
      <span className="text-xs font-semibold uppercase tracking-wider text-primary-600">Best</span>
      <Divider />
      <Stat label="Open Rate" value={formatPercent(stats.openRate)} />
      <Divider />
      <Stat label="$/Open" value={formatCostCents(stats.costPerOpenCents)} />
      <Divider />
      <Stat label="Reply Rate" value={formatPercent(stats.replyRate)} />
      <Divider />
      <Stat label="$/Reply" value={formatCostCents(stats.costPerReplyCents)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="h-4 w-px bg-gray-300 hidden sm:block" />;
}
