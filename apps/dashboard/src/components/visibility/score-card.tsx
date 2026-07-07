"use client";

import type { ReactNode } from "react";
import { Skeleton } from "../skeleton";
import { InfoTooltip } from "./metric-info";

export type DeltaFormat = "percent" | "absolute";

type ScoreCardCommon = {
  label: string;
  value: string;
  subtitle?: ReactNode;
  tooltip?: string;
  /** Optional pill rendered after the label (e.g. a `beta` maturity badge). */
  badge?: ReactNode;
  /**
   * Rendered in the VALUE position instead of `value` (e.g. a setup-tracker
   * ghost button when the metric has no data yet). Skeleton still wins while
   * `pending`; `value` is the fallback when `action` is absent.
   */
  action?: ReactNode;
  pending?: boolean;
};

type ScoreCardProps =
  | (ScoreCardCommon & { delta?: null | undefined; deltaFormat?: never; deltaInverted?: never })
  | (ScoreCardCommon & { delta: number | null; deltaFormat: DeltaFormat; deltaInverted?: boolean });

export function formatDelta(
  delta: number | null | undefined,
  format: DeltaFormat,
  inverted: boolean,
): {
  text: string;
  className: string;
  arrow: string;
} | null {
  if (delta === null || delta === undefined || delta === 0) return null;
  const positive = inverted ? delta < 0 : delta > 0;
  const arrow = delta > 0 ? "▲" : "▼";
  const className = positive ? "text-green-600" : "text-red-600";
  const abs = Math.abs(delta);
  const text = format === "percent" ? `${(abs * 100).toFixed(1)}pp` : abs.toFixed(2);
  return { text: `${arrow} ${text}`, className, arrow };
}

export function ScoreCard(props: ScoreCardProps) {
  const { label, value, subtitle, tooltip, badge, action, pending = false } = props;
  const fmt =
    "deltaFormat" in props && props.deltaFormat
      ? formatDelta(props.delta, props.deltaFormat, props.deltaInverted ?? false)
      : null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 inline-flex items-center gap-1">
        {label}
        {tooltip && <InfoTooltip tip={tooltip} placement="top" />}
        {badge}
      </p>
      <div className="flex items-baseline gap-2">
        {pending ? (
          <Skeleton className="h-6 w-16" />
        ) : action ? (
          action
        ) : (
          <p className="text-2xl font-semibold text-gray-800">{value}</p>
        )}
        {pending ? (
          <Skeleton className="h-3 w-10 mt-1" />
        ) : (
          fmt && (
            <span className={`text-xs font-medium ${fmt.className}`} title={`Delta vs previous run: ${fmt.text}`}>
              {fmt.text}
            </span>
          )
        )}
      </div>
      {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
  );
}

export function parseDecimal(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

export function formatScore(value: number | null): string {
  if (value === null) return "—";
  return `${(value * 100).toFixed(1)}%`;
}

export function formatPosition(value: number | null): string {
  if (value === null) return "—";
  return value.toFixed(2);
}

export function formatSentiment(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}`;
}
