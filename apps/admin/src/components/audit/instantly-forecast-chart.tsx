"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { InstantlyForecastDay } from "@/lib/api";

function formatDateShort(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function ForecastTooltip({
  active,
  payload,
  dailyCapacity,
}: {
  active?: boolean;
  payload?: Array<{ payload: InstantlyForecastDay; value: number }>;
  dailyCapacity: number;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const scheduled = Number(payload[0].value);
  const overCapacity = scheduled > dailyCapacity;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="text-gray-500">{formatDateShort(point.date)}</p>
      <p className="mt-1 font-semibold text-gray-900">
        {scheduled.toLocaleString("en-US")} scheduled
      </p>
      <p className="text-gray-500">
        {dailyCapacity.toLocaleString("en-US")} daily capacity
      </p>
      {overCapacity && (
        <p className="mt-1 font-medium text-amber-600">Over capacity</p>
      )}
    </div>
  );
}

/**
 * Fleet cold-email forecast. One bar per upcoming day = emails scheduled to
 * send; a flat horizontal reference line = the current available daily capacity
 * (healthy, warmed, non-blacklisted accounts). Bars above the line are days the
 * scheduled volume exceeds what the fleet can currently send.
 */
export function InstantlyForecastChart({
  days,
  dailyCapacity,
}: {
  days: InstantlyForecastDay[];
  dailyCapacity: number;
}) {
  if (days.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-gray-400">
        Nothing scheduled to send.
      </div>
    );
  }

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
            tickFormatter={(value) => Number(value).toLocaleString("en-US")}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            width={54}
          />
          <Tooltip
            cursor={{ fill: "#f8fafc" }}
            content={<ForecastTooltip dailyCapacity={dailyCapacity} />}
          />
          <ReferenceLine
            y={dailyCapacity}
            stroke="#0ea5e9"
            strokeDasharray="5 4"
            strokeWidth={2}
            label={{
              value: `Capacity ${dailyCapacity.toLocaleString("en-US")}/day`,
              position: "insideTopRight",
              fill: "#0284c7",
              fontSize: 11,
            }}
          />
          <Bar dataKey="scheduledCount" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {days.map((day) => (
              <Cell
                key={day.date}
                fill={day.scheduledCount > dailyCapacity ? "#f59e0b" : "#6366f1"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
