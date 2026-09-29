"use client";

import { Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BotTrafficPoint } from "@/lib/bot-traffic";

// Takes DATA only (no function props): it is rendered by the server metrics
// page, and a function cannot cross the server/client boundary.
const SERIES: Array<{ key: keyof Omit<BotTrafficPoint, "date">; color: string; width: number }> = [
  { key: "AI Assistant", color: "#7c3aed", width: 2.5 },
  { key: "AI Search", color: "#0ea5e9", width: 1.5 },
  { key: "AI Crawler", color: "#94a3b8", width: 1.5 },
];

function formatDateShort(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function AiBotReadsChart({ data }: { data: BotTrafficPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            labelFormatter={(label) => formatDateShort(String(label))}
            formatter={(value) => Number(value).toLocaleString("en-US")}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {SERIES.map((s) => (
            <Line key={s.key} type="linear" dataKey={s.key} stroke={s.color} strokeWidth={s.width} dot={false} connectNulls={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
