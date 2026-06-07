"use client";

import type { FunnelStep, StatsRegistry } from "@/lib/api";
import { Skeleton } from "@/components/skeleton";

interface FunnelMetricsProps {
  steps: FunnelStep[];
  stats: Record<string, number>;
  registry: StatsRegistry;
  pending?: boolean;
}

export function FunnelMetricsSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 min-h-[200px]">
      <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-6" />
      <div className="flex items-start justify-between gap-3">
        {[100, 85, 65, 50, 25, 10].map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div className="w-full flex justify-center" style={{ height: 128 }}>
              <div
                className="w-full max-w-14 bg-gray-100 rounded-t animate-pulse self-end"
                style={{ height: `${h}%` }}
              />
            </div>
            <div className="mt-2 h-5 w-8 bg-gray-200 rounded animate-pulse" />
            <div className="mt-1 h-3 w-12 bg-gray-100 rounded animate-pulse" />
            {i > 0 && <div className="mt-1 h-3 w-10 bg-gray-100 rounded animate-pulse" />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function FunnelMetrics({ steps, stats, registry, pending = false }: FunnelMetricsProps) {
  const resolved = (pending && steps.length === 0
    ? [0, 1, 2, 3].map((i) => ({ key: `placeholder-${i}` }))
    : steps
  ).map((step, i) => {
    const value = stats[step.key] ?? 0;
    const prevValue = i > 0 && steps[i - 1] ? (stats[steps[i - 1].key] ?? 0) : 0;
    const rate = i > 0 && prevValue > 0 ? (value / prevValue * 100) : null;
    const label = registry[step.key]?.label ?? step.key;
    return { key: step.key, label, value, rate };
  });

  const maxValue = Math.max(...resolved.map(s => s.value), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 min-h-[200px]">
      <h3 className="font-medium text-gray-800 mb-4 md:mb-6">Campaign Funnel</h3>

      {/* items-start + fixed-height bar containers → every bar bottom lands on
          one baseline regardless of how many lines a label wraps to. */}
      <div className="flex items-start justify-between gap-3">
        {resolved.map((step) => {
          const barHeight = Math.max((step.value / maxValue) * 100, 4);
          return (
            <div key={step.key} className="flex-1 flex flex-col items-center">
              {/* Bar — fixed-height container, bar grows from bottom */}
              <div className="w-full flex justify-center" style={{ height: 128 }}>
                {pending ? (
                  <Skeleton className="w-full max-w-14 h-1/2 rounded-t self-end" />
                ) : (
                  <div
                    className="w-full max-w-14 bg-brand-500 rounded-t self-end transition-all duration-500 ease-out"
                    style={{ height: `${barHeight}%` }}
                  />
                )}
              </div>

              {/* Labels — fixed layout so all columns align */}
              <p className="mt-2 text-lg font-bold text-gray-800 leading-tight">
                {pending ? <Skeleton className="h-5 w-8" /> : step.value.toLocaleString()}
              </p>
              {/* Fixed two-line height so the value + %-rate rows stay aligned
                  across columns whether a label wraps to one line or two. */}
              <p className="text-xs text-gray-500 leading-tight mt-0.5 h-8">{step.label}</p>
              <p className="text-xs font-medium leading-tight mt-0.5 h-4">
                {pending ? (
                  <Skeleton className="h-3 w-10" />
                ) : step.rate !== null ? (
                  <span className="text-brand-600">{step.rate.toFixed(1)}%</span>
                ) : (
                  <span>&nbsp;</span>
                )}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
