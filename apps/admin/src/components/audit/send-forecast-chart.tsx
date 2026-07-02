"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SendForecastDay } from "@/lib/api";

function formatDateShort(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function num(n: number | null | undefined): string {
  // Projected email counts arrive fractional; display as whole emails.
  return Math.round(n ?? 0).toLocaleString("en-US");
}

const SERIES = [
  { key: "actualSent", label: "Sent (actual)", color: "#6366f1" },
  { key: "inFlightSent", label: "Scheduled follow-ups", color: "#0ea5e9" },
  { key: "forecastNew", label: "New (projected)", color: "#f59e0b" },
] as const;

function ForecastTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: SendForecastDay }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="text-gray-500">
        {formatDateShort(point.date)}
        {point.isToday ? " · today" : ""}
      </p>
      {SERIES.map((s) => {
        const v = point[s.key];
        if (v === null || v === undefined) return null;
        return (
          <p key={s.key} className="mt-1 flex items-center gap-1.5 text-gray-700">
            <span
              className="h-2 w-2 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            {s.label}: <span className="font-medium">{num(v)}</span>
          </p>
        );
      })}
      <p className="mt-1.5 border-t border-gray-100 pt-1 font-semibold text-gray-900">
        Total: {point.total === null ? "—" : num(point.total)}
      </p>
    </div>
  );
}

/**
 * Stacked fleet SEND forecast. One bar per calendar day, three stacked EMAIL-grain
 * series: actual sends (past), scheduled follow-ups (in-flight), and projected new
 * sequence emails (future). A dashed reference line marks today. Values are null on
 * the days they don't apply (past has no forecast, future has no actual), so the
 * stacks read as: past = actual only, future = in-flight + projected-new.
 */
export function SendForecastChart({ days }: { days: SendForecastDay[] }) {
  if (days.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-gray-400">
        No forecast data.
      </div>
    );
  }

  const todayDate = days.find((d) => d.isToday)?.date;

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={days} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateShort}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
            minTickGap={16}
          />
          <YAxis
            tickFormatter={(value) => Math.round(Number(value)).toLocaleString("en-US")}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            width={54}
          />
          <Tooltip cursor={{ fill: "#f8fafc" }} content={<ForecastTooltip />} />
          {todayDate && (
            <ReferenceLine
              x={todayDate}
              stroke="#94a3b8"
              strokeDasharray="5 4"
              strokeWidth={1.5}
              label={{
                value: "Today",
                position: "insideTopRight",
                fill: "#64748b",
                fontSize: 11,
              }}
            />
          )}
          {SERIES.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId="sends"
              fill={s.color}
              maxBarSize={48}
              radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
