"use client";

import { Skeleton } from "@/components/skeleton";
import type { BreakdownSegment, StatsRegistry } from "@/lib/api";

interface ReplyBreakdownProps {
  segments: BreakdownSegment[];
  stats: Record<string, number | null>;
  registry: StatsRegistry;
  pending?: boolean;
}

const COLOR_MAP: Record<string, { bar: string; bg: string; icon: string }> = {
  green:  { bar: "bg-green-500",  bg: "bg-green-100",  icon: "\u{1F7E2}" },
  blue:   { bar: "bg-blue-500",   bg: "bg-blue-100",   icon: "\u{1F535}" },
  red:    { bar: "bg-red-500",    bg: "bg-red-100",    icon: "\u{1F534}" },
  gray:   { bar: "bg-gray-400",   bg: "bg-gray-100",   icon: "\u26AA" },
  orange: { bar: "bg-orange-500", bg: "bg-orange-100", icon: "\u{1F7E0}" },
};

export function ReplyBreakdownSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 min-h-[200px]">
      <div className="h-5 w-36 bg-gray-200 rounded animate-pulse mb-4" />
      <div className="space-y-3">
        {[70, 50, 35, 20, 10].map((w, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-5 h-5 bg-gray-100 rounded-full animate-pulse" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-6 bg-gray-100 rounded animate-pulse" />
              </div>
              <div className="h-2 bg-gray-100 rounded-full">
                <div className="h-full bg-gray-200 rounded-full animate-pulse" style={{ width: `${w}%` }} />
              </div>
            </div>
            <div className="h-3 w-10 bg-gray-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

const PLACEHOLDER_SEGMENTS: Pick<BreakdownSegment, "key" | "color">[] = [
  { key: "positive",  color: "green"  },
  { key: "neutral",   color: "blue"   },
  { key: "negative",  color: "red"    },
  { key: "ooo",       color: "gray"   },
  { key: "unsubscribe", color: "orange" },
];

export function ReplyBreakdown({ segments, stats, registry, pending = false }: ReplyBreakdownProps) {
  const source: Pick<BreakdownSegment, "key" | "color">[] =
    pending && (!segments || segments.length === 0) ? PLACEHOLDER_SEGMENTS : (segments ?? []);
  const resolved = source
    .map((seg) => ({
      key: seg.key,
      label: registry?.[seg.key]?.label ?? seg.key,
      // LEDGER-ONLY-1107-P2: a reply kind with no ledger figure is null: left out, never a 0 slice.
      value: stats?.[seg.key] ?? null,
      colors: COLOR_MAP[seg.color] ?? COLOR_MAP.gray,
    }))
    .filter((c): c is typeof c & { value: number } => pending || (c.value != null && c.value > 0))
    .map((c) => ({ ...c, value: c.value ?? 0 }));
  // Every kind null = the ledger counts none of them: say so rather than "No replies yet".
  const notCounted = !pending && source.length > 0 && source.every((seg) => stats?.[seg.key] == null);

  const total = resolved.reduce((sum, c) => sum + c.value, 0);

  if (!pending && total === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 min-h-[200px] flex flex-col">
        <h3 className="font-medium text-gray-800 mb-4">Reply Breakdown</h3>
        <p className="text-sm text-gray-500 text-center py-4 flex-1 flex items-center justify-center">{notCounted ? "Not counted" : "No replies yet"}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 min-h-[200px]">
      <h3 className="font-medium text-gray-800 mb-4">Reply Breakdown</h3>

      <div className="space-y-3">
        {resolved.map((cat) => {
          const percentage = total > 0 ? (cat.value / total) * 100 : 0;
          return (
            <div key={cat.key} className="flex items-center gap-3">
              <span className="text-sm">{cat.colors.icon}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-700">{cat.label}</span>
                  {pending ? (
                    <Skeleton className="h-4 w-6" />
                  ) : (
                    <span className="text-sm font-medium text-gray-800">{cat.value}</span>
                  )}
                </div>
                <div className={`h-2 ${cat.colors.bg} rounded-full overflow-hidden`}>
                  {pending ? (
                    <Skeleton className="h-full w-1/2 rounded-full" />
                  ) : (
                    <div
                      className={`h-full ${cat.colors.bar} rounded-full transition-all duration-500 ease-out`}
                      style={{ width: `${percentage}%` }}
                    />
                  )}
                </div>
              </div>
              {pending ? (
                <Skeleton className="h-3 w-12" />
              ) : (
                <span className="text-xs text-gray-500 w-12 text-right">
                  {percentage.toFixed(0)}%
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
