"use client";

import type { ReactNode } from "react";

interface ScoreCardProps {
  label: string;
  value: string;
  delta?: number | null;
  deltaInverted?: boolean;
  subtitle?: ReactNode;
}

function formatDelta(delta: number | null | undefined, inverted: boolean): {
  text: string;
  className: string;
  arrow: string;
} | null {
  if (delta === null || delta === undefined || delta === 0) return null;
  const positive = inverted ? delta < 0 : delta > 0;
  const arrow = delta > 0 ? "▲" : "▼";
  const className = positive ? "text-green-600" : "text-red-600";
  const abs = Math.abs(delta);
  const text = abs >= 1 ? abs.toFixed(2) : `${(abs * 100).toFixed(1)}pp`;
  return { text: `${arrow} ${text}`, className, arrow };
}

export function ScoreCard({ label, value, delta, deltaInverted = false, subtitle }: ScoreCardProps) {
  const fmt = formatDelta(delta, deltaInverted);
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-semibold text-gray-800">{value}</p>
        {fmt && (
          <span className={`text-xs font-medium ${fmt.className}`} title={`Delta vs previous run: ${fmt.text}`}>
            {fmt.text}
          </span>
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
