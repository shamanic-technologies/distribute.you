"use client";

import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RevenueBucket, DailyLinePoint } from "@/lib/revenue-buckets";

const BAR_COLOR = "#6366f1";
const LINE_COLOR = "#f59e0b";
const AREA_COLOR = "#6366f1";

function formatUsdCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  if (abs >= 10) return `$${Math.round(value).toLocaleString("en-US")}`;
  return `$${value.toFixed(2)}`;
}

function formatUsdFull(value: number): string {
  const decimals = Math.abs(value) < 10 ? 2 : 0;
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function formatGrowth(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function EmptyChart() {
  return (
    <div className="flex h-[280px] items-center justify-center text-sm text-gray-400">No data yet.</div>
  );
}

/** Bars = realized revenue (USD), line = compound growth since inception (CMGR/CWGR). */
function RevenueCmgrTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: RevenueBucket }>;
}) {
  if (!active || !payload?.length) return null;
  const bucket = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="text-gray-500">{bucket.label}</p>
      <p className="mt-1 flex items-center gap-2 font-semibold text-gray-900">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: BAR_COLOR }} />
        {formatUsdFull(bucket.value)} revenue
      </p>
      {bucket.cmgrPct !== null && (
        <p className="mt-1 flex items-center gap-2 font-semibold text-gray-900">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: LINE_COLOR }} />
          {formatGrowth(bucket.cmgrPct)} since inception
        </p>
      )}
    </div>
  );
}

export function RevenuePeriodChart({ data, growthLabel }: { data: RevenueBucket[]; growthLabel: string }) {
  if (data.length === 0) return <EmptyChart />;
  return (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} minTickGap={16} />
          <YAxis yAxisId="value" tickFormatter={(v) => formatUsdCompact(Number(v))} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={52} />
          <YAxis yAxisId="growth" orientation="right" tickFormatter={(v) => `${Math.round(Number(v))}%`} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={44} />
          <Tooltip content={<RevenueCmgrTooltip />} cursor={{ fill: "#f8fafc" }} />
          <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: 12, paddingBottom: 8 }} />
          <Bar yAxisId="value" dataKey="value" name="Revenue" fill={BAR_COLOR} radius={[3, 3, 0, 0]} maxBarSize={48} />
          <Line yAxisId="growth" type="monotone" dataKey="cmgrPct" name={growthLabel} dot={false} activeDot={{ r: 4 }} stroke={LINE_COLOR} strokeWidth={2} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Bars = an avg-revenue-per-X (USD) value per month. No secondary line. */
function RevenueAvgTooltip({
  active,
  payload,
  valueLabel,
}: {
  active?: boolean;
  payload?: Array<{ payload: RevenueBucket }>;
  valueLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const bucket = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="text-gray-500">{bucket.label}</p>
      <p className="mt-1 flex items-center gap-2 font-semibold text-gray-900">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: BAR_COLOR }} />
        {formatUsdFull(bucket.value)} {valueLabel}
      </p>
    </div>
  );
}

export function RevenueAvgChart({ data, valueLabel }: { data: RevenueBucket[]; valueLabel: string }) {
  if (data.length === 0) return <EmptyChart />;
  return (
    <div className="h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} minTickGap={16} />
          <YAxis tickFormatter={(v) => formatUsdCompact(Number(v))} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={52} />
          <Tooltip content={<RevenueAvgTooltip valueLabel={valueLabel} />} cursor={{ fill: "#f8fafc" }} />
          <Bar dataKey="value" name={valueLabel} fill={BAR_COLOR} radius={[3, 3, 0, 0]} maxBarSize={48} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Daily MRR-over-time area line (realized fleet spend per day since inception). */
function DailyLineTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DailyLinePoint }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="text-gray-500">{point.label}</p>
      <p className="mt-1 flex items-center gap-2 font-semibold text-gray-900">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: AREA_COLOR }} />
        {formatUsdFull(point.value)} / day
      </p>
    </div>
  );
}

export function RevenueDailyLineChart({ data }: { data: DailyLinePoint[] }) {
  if (data.length === 0) return <EmptyChart />;
  return (
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={AREA_COLOR} stopOpacity={0.25} />
              <stop offset="100%" stopColor={AREA_COLOR} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} minTickGap={24} />
          <YAxis tickFormatter={(v) => formatUsdCompact(Number(v))} tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} width={52} />
          <Tooltip content={<DailyLineTooltip />} cursor={{ stroke: "#e2e8f0" }} />
          <Area type="monotone" dataKey="value" name="MRR" stroke={AREA_COLOR} strokeWidth={2} fill="url(#mrrFill)" dot={false} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
