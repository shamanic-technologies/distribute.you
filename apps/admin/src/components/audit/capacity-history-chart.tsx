"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { InstantlyCapacityHistoryPoint } from "@/lib/api";

function formatDateShort(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function CapacityTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: InstantlyCapacityHistoryPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="text-gray-500">{formatDateShort(p.date)} (UTC)</p>
      <p className="mt-1 text-gray-700">
        <span className="font-medium tabular-nums">
          {p.dailyCapacity.toLocaleString("en-US")}
        </span>{" "}
        emails/day capacity
      </p>
      <p className="text-gray-500 tabular-nums">
        {p.inProductionCount.toLocaleString("en-US")} in-production account
        {p.inProductionCount === 1 ? "" : "s"}
      </p>
    </div>
  );
}

/**
 * Fleet in-production daily send capacity over time. Filled area = capacity
 * (emails/day, left axis); overlaid line = number of in-production accounts
 * driving it (right axis). One point per UTC calendar day, oldest first.
 */
export function CapacityHistoryChart({
  data,
}: {
  data: InstantlyCapacityHistoryPoint[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="capacityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis
          dataKey="date"
          tickFormatter={formatDateShort}
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
          minTickGap={24}
        />
        <YAxis
          yAxisId="capacity"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => v.toLocaleString("en-US")}
        />
        <YAxis
          yAxisId="accounts"
          orientation="right"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip cursor={{ stroke: "#e5e7eb" }} content={<CapacityTooltip />} />
        <Area
          yAxisId="capacity"
          type="monotone"
          dataKey="dailyCapacity"
          stroke="#6366f1"
          strokeWidth={2}
          fill="url(#capacityFill)"
        />
        <Line
          yAxisId="accounts"
          type="monotone"
          dataKey="inProductionCount"
          stroke="#0ea5e9"
          strokeWidth={1.5}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
