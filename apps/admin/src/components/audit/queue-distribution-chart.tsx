"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface QueueDistributionBin {
  label: string; // bin label, e.g. "0", "1–5", "51+"
  pct: number; // share of allowed accounts in this bin (0–100)
  count: number; // number of allowed accounts in this bin
}

function DistributionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: QueueDistributionBin }>;
}) {
  if (!active || !payload?.length) return null;
  const bin = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="text-gray-500">Queue size {bin.label}</p>
      <p className="mt-1 text-gray-700">
        <span className="font-medium">{bin.pct.toFixed(1)}%</span> of allowed accounts
      </p>
      <p className="text-gray-500">
        {bin.count.toLocaleString("en-US")} account{bin.count === 1 ? "" : "s"}
      </p>
    </div>
  );
}

/**
 * Distribution of queue size across ALLOWED (send-eligible) accounts. The `0`
 * bin is standalone so an empty queue reads distinctly from a small one; Y axis
 * is the share of allowed accounts (%).
 */
export function QueueDistributionChart({ data }: { data: QueueDistributionBin[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip cursor={{ fill: "#f8fafc" }} content={<DistributionTooltip />} />
        <Bar dataKey="pct" fill="#6366f1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
