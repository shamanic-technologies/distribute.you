"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/**
 * One monitored sub-topic, one small daily bar chart: readable in a second.
 *
 * `null` on a day means nobody looked yet (before the first honest check), so
 * the bar is absent and the tooltip says so, never a zero.
 */
export interface DailySeriesKey {
  key: string;
  label: string;
  color: string;
}

export type DailyPoint = { day: string } & Record<string, number | null | string>;

function shortDay(day: string): string {
  return new Date(`${day}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function DailyTooltip({
  active,
  payload,
  keys,
  unit = "",
  emptyLabel = "Not checked yet",
}: {
  active?: boolean;
  payload?: Array<{ payload: DailyPoint }>;
  keys: DailySeriesKey[];
  unit?: string;
  emptyLabel?: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const notChecked = keys.every((k) => p[k.key] === null);
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="text-gray-500">{shortDay(p.day)} (UTC)</p>
      {notChecked ? (
        <p className="mt-1 text-gray-400">{emptyLabel}</p>
      ) : (
        keys.map((k) => (
          <p key={k.key} className="mt-1 text-gray-700">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-sm" style={{ background: k.color }} />
            {k.label}: <span className="font-medium tabular-nums">{Number(p[k.key] ?? 0).toLocaleString("en-US")}
              {unit}</span>
          </p>
        ))
      )}
    </div>
  );
}

export function BlocklistDailyChart({
  title,
  now,
  data,
  keys,
  unit,
  yMax,
  emptyLabel,
}: {
  title: string;
  /** The headline beside the title: today's value, in words. */
  now: string;
  data: DailyPoint[];
  keys: DailySeriesKey[];
  /** Suffix on tooltip values and Y ticks ("%" for a rate). */
  unit?: string;
  /** Fixed top of the Y axis (100 for a percentage); data-driven when absent. */
  yMax?: number;
  /** Tooltip text for a day the producer serves as null. */
  emptyLabel?: string;
}) {
  const stacked = keys.length > 1;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <h3 className="text-sm font-medium text-gray-700">{title}</h3>
        <p className="text-lg font-semibold tabular-nums text-gray-900">{now}</p>
      </div>
      {stacked && (
        <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-gray-500">
          {keys.map((k) => (
            <span key={k.key} className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: k.color }} />
              {k.label}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2">
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: unit ? -14 : -24 }}>
            <XAxis
              dataKey="day"
              tickFormatter={shortDay}
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
              minTickGap={28}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              domain={yMax !== undefined ? [0, yMax] : undefined}
              tickFormatter={unit ? (v: number) => `${v}${unit}` : undefined}
            />
            <Tooltip cursor={{ fill: "#f3f4f6" }} content={<DailyTooltip keys={keys} unit={unit} emptyLabel={emptyLabel} />} />
            {keys.map((k) => (
              <Bar
                key={k.key}
                dataKey={k.key}
                stackId={stacked ? "day" : undefined}
                fill={k.color}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
