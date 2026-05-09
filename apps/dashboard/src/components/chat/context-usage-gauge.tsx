"use client";

/**
 * Thin gauge that displays per-turn context-window usage emitted by
 * chat-service v0.19.0 (`context_usage` SSE event, forwarded by the
 * dashboard chat proxy as a `data-context-usage` UI part).
 *
 * The gauge is intentionally minimal: a `inputTokens / maxTokens` label
 * plus an integer percent. chat-service pins `maxTokens` at 200000 for
 * both Anthropic and Gemini.
 */

export interface ContextUsage {
  inputTokens: number;
  outputTokens: number;
  maxTokens: number;
  percent: number;
}

export function formatUsageLabel(
  inputTokens: number,
  maxTokens: number,
): string {
  return `${inputTokens.toLocaleString("en-US")} / ${maxTokens.toLocaleString("en-US")}`;
}

export function clampPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

export function ContextUsageGauge({
  usage,
  className = "",
}: {
  usage: ContextUsage | null;
  className?: string;
}) {
  if (!usage) return null;

  const pct = clampPercent(usage.percent);
  const label = formatUsageLabel(usage.inputTokens, usage.maxTokens);
  const barColor =
    pct >= 90
      ? "bg-red-500"
      : pct >= 75
        ? "bg-amber-500"
        : "bg-brand-500";

  return (
    <div
      className={`flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400 ${className}`}
      title={`Context window: ${label} tokens (${pct}%)`}
    >
      <span className="tabular-nums whitespace-nowrap">{label}</span>
      <div className="w-16 h-1 rounded-full bg-gray-200 dark:bg-white/[0.08] overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="tabular-nums">{`${pct}%`}</span>
    </div>
  );
}
