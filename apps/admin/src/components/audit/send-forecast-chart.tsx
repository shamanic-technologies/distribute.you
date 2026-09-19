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
import { chartDomain } from "@/lib/chart-domain";

function formatDateShort(iso: string): string {
  return new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function num(n: number | null | undefined): string {
  // Projected counts arrive fractional; display as whole units.
  return String(Math.round(n ?? 0));
}

/**
 * ⚠️ TWO CHARTS, because the fleet runs two processes on two calendars and one series cannot carry
 * both. CREATION is budget-driven and runs seven days a week; SENDING is throughput-driven and runs
 * Monday to Friday. Measured 2026-09-19: the fleet created 801 sequences on a Saturday and sent zero.
 * A single "emails per day" chart draws that Saturday as an empty day, hiding a day the budget was
 * spent — and it makes "why are no new sequences created on Monday" unanswerable, because the series
 * that looked like creation was really *which of Monday's sends happened to be first touches*.
 *
 * The gap between the two charts is the backlog, which the page states as its own number.
 */

function tooltipShell(children: React.ReactNode) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm">
      {children}
    </div>
  );
}

function swatch(color: string) {
  return <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: color }} />;
}

// ── Chart 1: what the budget CREATES ─────────────────────────────────────────

const CREATED_ACTUAL = "#7c3aed";
const CREATED_PROJECTED = "#c4b5fd";

function CreatedTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: SendForecastDay }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const rows: Array<[string, string, number]> = [];
  if (point.createdActual !== null && point.createdActual !== undefined) {
    rows.push(["Created", CREATED_ACTUAL, point.createdActual]);
  }
  if (point.createdProjected !== null && point.createdProjected !== undefined) {
    rows.push(["Projected", CREATED_PROJECTED, point.createdProjected]);
  }
  return tooltipShell(
    <>
      <p className="text-gray-500">
        {formatDateShort(point.date)}
        {point.isToday ? " · today" : ""}
      </p>
      {rows.map(([label, color, value]) => (
        <p key={label} className="mt-1 flex items-center gap-1.5 text-gray-700">
          {swatch(color)}
          {label}: <span className="font-medium">{num(value)}</span>
        </p>
      ))}
      {rows.length === 0 && <p className="mt-1 text-gray-400">No sequences</p>}
    </>,
  );
}

/**
 * Sequences the fleet launches per day — the budget's own output. No capacity line: mailbox capacity
 * bounds SENDING, not creation, so drawing it here would invite exactly the comparison that is wrong.
 */
export function CreatedForecastChart({ days }: { days: SendForecastDay[] }) {
  if (days.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-gray-400">
        No forecast data.
      </div>
    );
  }

  const todayDate = days.find((d) => d.isToday)?.date;
  const { max: yMax } = chartDomain(days.map((d) => (d.createdActual ?? 0) + (d.createdProjected ?? 0)));

  return (
    <div className="h-[240px]">
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
            domain={[0, yMax]}
            allowDataOverflow={false}
            tickFormatter={(value) => String(Math.round(Number(value)))}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            width={54}
          />
          <Tooltip cursor={{ fill: "#f8fafc" }} content={<CreatedTooltip />} />
          {todayDate && (
            <ReferenceLine
              x={todayDate}
              stroke="#94a3b8"
              strokeDasharray="5 4"
              strokeWidth={1.5}
              label={{ value: "Today", position: "insideTopRight", fill: "#64748b", fontSize: 11 }}
            />
          )}
          <Bar dataKey="createdActual" stackId="created" fill={CREATED_ACTUAL} maxBarSize={48} />
          <Bar
            dataKey="createdProjected"
            stackId="created"
            fill={CREATED_PROJECTED}
            maxBarSize={48}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Chart 2: what the fleet SENDS ────────────────────────────────────────────

const SENT_ACTUAL = "#6366f1";
const SENT_PROJECTED = "#0ea5e9";

function SentTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: SendForecastDay }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  // The producer splits the projection into already-provisioned follow-ups and new-cohort emails.
  // That split is a PROVENANCE detail with no action attached, and showing it is what made a reader
  // ask why no new sequences were created next week — so the chart states one projected number.
  const projected =
    point.inFlightSent === null && point.forecastNew === null
      ? null
      : (point.inFlightSent ?? 0) + (point.forecastNew ?? 0);
  return tooltipShell(
    <>
      <p className="text-gray-500">
        {formatDateShort(point.date)}
        {point.isToday ? " · today" : ""}
      </p>
      {point.actualSent !== null && point.actualSent !== undefined && (
        <p className="mt-1 flex items-center gap-1.5 text-gray-700">
          {swatch(SENT_ACTUAL)}
          Sent: <span className="font-medium">{num(point.actualSent)}</span>
        </p>
      )}
      {projected !== null && (
        <p className="mt-1 flex items-center gap-1.5 text-gray-700">
          {swatch(SENT_PROJECTED)}
          Projected: <span className="font-medium">{num(projected)}</span>
        </p>
      )}
      <p className="mt-1.5 border-t border-gray-100 pt-1 font-semibold text-gray-900">
        Total: {point.total === null ? "—" : num(point.total)}
      </p>
    </>,
  );
}

/**
 * Emails going out per day. The dashed line is the fleet's physical CEILING — it is not the rate the
 * bars drain at, which is the fleet's own measured throughput and sits well below it.
 */
export function SendForecastChart({
  days,
  dailyCapacity,
}: {
  days: SendForecastDay[];
  dailyCapacity?: number;
}) {
  if (days.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-gray-400">
        No forecast data.
      </div>
    );
  }

  const todayDate = days.find((d) => d.isToday)?.date;

  // The capacity line is the thing the chart exists to compare against, so the ceiling has to CLEAR
  // it: recharts' automatic domain reads the bars only, and a ReferenceLine above that domain is
  // silently discarded — the line simply is not there on exactly the days that matter.
  const hasCapacity = dailyCapacity !== undefined && dailyCapacity > 0;
  const { max: yMax } = chartDomain(
    days.map((d) => d.total ?? 0),
    { floor: hasCapacity ? dailyCapacity : undefined },
  );

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
            domain={[0, yMax]}
            allowDataOverflow={false}
            tickFormatter={(value) => String(Math.round(Number(value)))}
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            width={54}
          />
          <Tooltip cursor={{ fill: "#f8fafc" }} content={<SentTooltip />} />
          {hasCapacity && (
            <ReferenceLine
              y={dailyCapacity}
              stroke="#0ea5e9"
              strokeDasharray="5 4"
              strokeWidth={2}
              label={{
                value: `Capacity ${Math.round(dailyCapacity)}/day`,
                position: "insideTopRight",
                fill: "#0284c7",
                fontSize: 11,
              }}
            />
          )}
          {todayDate && (
            <ReferenceLine
              x={todayDate}
              stroke="#94a3b8"
              strokeDasharray="5 4"
              strokeWidth={1.5}
              label={{ value: "Today", position: "insideTopRight", fill: "#64748b", fontSize: 11 }}
            />
          )}
          <Bar dataKey="actualSent" stackId="sends" fill={SENT_ACTUAL} maxBarSize={48} radius={[4, 4, 0, 0]} />
          {/* The two projected series share ONE fill, so recharts stacks them into a single visible
              bar. Stacking rather than summing keeps every number on screen a served one. */}
          <Bar dataKey="inFlightSent" stackId="sends" fill={SENT_PROJECTED} maxBarSize={48} />
          <Bar
            dataKey="forecastNew"
            stackId="sends"
            fill={SENT_PROJECTED}
            maxBarSize={48}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
