"use client";

import { Bar, BarChart, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getOfferOutcomeCostSeries } from "@/lib/api";
import { formatCount, formatUsdAdaptive } from "@/lib/format-number";
import { costStepOf, monthLabel, monthTick, type OutcomeCostStep } from "@/lib/v2/outcome-cost-series";
import type { OutcomeStepStat } from "@/lib/v2/outcome-people";
import { EmptyNote, Figure, Shimmer, StatTile } from "@/components/v2/ui";
import { LearningFigure } from "@/components/v2/roi-label";

/**
 * ONE OUTCOME, OVER TIME (owner 2026-10-27): above the people table of an outcome page, four cards
 * (People, Contacted by us, $ / outcome, This month) then four charts: people per month and since
 * inception (crm-service, everyone vs contacted by us), $ / outcome per month and since inception
 * (features-service: the client's spend ÷ outcomes of people WE contacted, owner's choice "A").
 * Every figure is served; nothing is summed or divided here.
 */

const DASH = <span className="k-fg4">—</span>;
const TICK = { fontSize: 11, fill: "var(--fg-3)" };
const EVERYONE = "var(--data-teal)";
const OURS = "var(--accent)";
const LEARNING = "var(--fg-4)";

export function useOutcomeCostSeries(brandId: string, offerId: string | null) {
  return useAuthQuery(["outcomeCostSeries", brandId, offerId ?? ""], () => getOfferOutcomeCostSeries(offerId!, brandId), {
    ...pollOptions,
    enabled: !!offerId,
  });
}

export function OutcomeStats({
  brandId,
  offerId,
  stepKey,
  label,
  plural,
  all,
}: {
  brandId: string;
  offerId: string | null;
  stepKey: string;
  /** "Signup" */
  label: string;
  /** "Signups" */
  plural: string;
  all: OutcomeStepStat;
}) {
  const q = useOutcomeCostSeries(brandId, offerId);
  const costAnswered = q.data !== undefined || (q.isFetchedAfterMount && q.isError);
  const cost = costStepOf(q.data, stepKey);
  const months = all.months ?? [];
  const thisMonth = months.length > 0 ? months[months.length - 1] : null;
  return (
    <div className="mb-6 space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="People" note={<Wide>Everyone</Wide>}>
          <Figure value={formatCount(all.people)} unit={all.people === 1 ? "person" : "people"} />
        </StatTile>
        <StatTile label="Contacted by us" note={<Wide>We wrote to them</Wide>}>
          <Figure value={formatCount(all.contactedByUs)} unit={all.contactedByUs === 1 ? "person" : "people"} />
        </StatTile>
        <StatTile label={`$ / ${label}`} note={<Wide>Since you started</Wide>}>
          <CostFigure answered={costAnswered} cost={cost} />
          {cost && (
            <p className="k-fg3 mt-0.5 truncate text-[12px]">
              {formatUsdAdaptive(cost.sinceInception.spendUsd)} spent for {formatCount(cost.sinceInception.outcomes)}{" "}
              {(cost.sinceInception.outcomes === 1 ? label : plural).toLowerCase()}
            </p>
          )}
        </StatTile>
        <StatTile label="This month" note={thisMonth ? monthLabel(thisMonth.month) : undefined}>
          {thisMonth ? (
            <>
              <Figure value={formatCount(thisMonth.people)} unit={thisMonth.people === 1 ? "person" : "people"} />
              <p className="k-fg3 mt-0.5 truncate text-[12px]">{formatCount(thisMonth.contactedByUs)} contacted by us</p>
            </>
          ) : (
            <Figure value={DASH} />
          )}
        </StatTile>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard title={`${plural} per month`} legend={<PeopleLegend />}>
          {months.length === 0 ? (
            <EmptyNote>No dated {plural.toLowerCase()} yet.</EmptyNote>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={months} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barGap={1} barCategoryGap="20%">
                <XAxis dataKey="month" tick={TICK} tickLine={false} axisLine={false} minTickGap={24} tickFormatter={monthTick} />
                <YAxis tick={TICK} tickLine={false} axisLine={false} width={36} tickCount={4} allowDecimals={false} />
                <Tooltip cursor={{ fill: "var(--data-track)" }} content={({ active, payload }) => (active && payload?.length ? <PeopleTip row={payload[0].payload as PeopleRow} /> : null)} />
                <Bar dataKey="people" name="Everyone" fill={EVERYONE} isAnimationActive={false} />
                <Bar dataKey="contactedByUs" name="Contacted by us" fill={OURS} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
        <CumulativePeopleCard plural={plural} all={all} />
        <ChartCard title={`$ / ${label} per month`} legend={<CostLegend />}>
          <CostMonthsChart answered={costAnswered} failed={!q.data && q.isError} cost={cost} plural={plural} />
        </ChartCard>
        <ChartCard title={`$ / ${label} since you started`} legend={<CostLegend expected={cost?.expected.costPerOutcomeUsd != null} />}>
          <CostCumulativeChart answered={costAnswered} failed={!q.data && q.isError} cost={cost} plural={plural} />
        </ChartCard>
      </div>
    </div>
  );
}

type PeopleRow = NonNullable<OutcomeStepStat["months"]>[number];

function PeopleTip({ row, cumulative = false }: { row: PeopleRow; cumulative?: boolean }) {
  const everyone = cumulative ? row.cumulativePeople : row.people;
  const ours = cumulative ? row.cumulativeContactedByUs : row.contactedByUs;
  return (
    <div className="k-popover px-2.5 py-1.5 text-[12px]">
      <p className="k-fg3 k-mono">
        {monthLabel(row.month)}
        {cumulative ? ", in total" : ""}
      </p>
      <p className="tabular-nums">
        <Dot color={EVERYONE} /> {formatCount(everyone)} everyone
      </p>
      <p className="tabular-nums">
        <Dot color={OURS} /> {formatCount(ours)} contacted by us
      </p>
    </div>
  );
}

/** People in total as of each month end: crm-service's served running totals. */
function CumulativePeopleCard({ plural, all }: { plural: string; all: OutcomeStepStat }) {
  const rows = all.months ?? [];
  return (
    <ChartCard title={`${plural} since you started`} legend={<PeopleLegend />}>
      {rows.length === 0 ? (
        <EmptyNote>No dated {plural.toLowerCase()} yet.</EmptyNote>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis dataKey="month" tick={TICK} tickLine={false} axisLine={false} minTickGap={24} tickFormatter={monthTick} />
            <YAxis tick={TICK} tickLine={false} axisLine={false} width={36} tickCount={4} allowDecimals={false} />
            <Tooltip cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }} content={({ active, payload }) => (active && payload?.length ? <PeopleTip row={payload[0].payload as PeopleRow} cumulative /> : null)} />
            <Line type="monotone" dataKey="cumulativePeople" stroke={EVERYONE} strokeWidth={1.75} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="cumulativeContactedByUs" stroke={OURS} strokeWidth={1.75} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

function CostFigure({ answered, cost }: { answered: boolean; cost: OutcomeCostStep | null }) {
  if (!answered) return <Shimmer className="h-7 w-20" />;
  if (!cost) return <Figure value={DASH} />;
  const measured = cost.sinceInception.costPerOutcomeUsd;
  const expected = cost.expected.costPerOutcomeUsd;
  if (measured == null) {
    return (
      <Figure
        value={expected != null ? formatUsdAdaptive(expected) : DASH}
        sub={expected != null ? "expected" : cost.sinceInception.outcomes === 0 ? "Learning" : undefined}
      />
    );
  }
  if (cost.sinceInception.learning) {
    return <Figure value={<LearningFigure measured={formatUsdAdaptive(measured)} expected={expected != null ? formatUsdAdaptive(expected) : null} />} />;
  }
  return <Figure value={formatUsdAdaptive(measured)} />;
}

function CostMonthsChart({ answered, failed, cost, plural }: { answered: boolean; failed: boolean; cost: OutcomeCostStep | null; plural: string }) {
  if (!answered) return <Shimmer className="h-full w-full rounded-[8px]" />;
  if (failed) return <EmptyNote>Could not read the cost per month. Retrying.</EmptyNote>;
  const months = cost?.months ?? [];
  if (!cost || months.every((m) => m.costPerOutcomeUsd == null)) return <EmptyNote>No {plural.toLowerCase()} from people we contacted yet.</EmptyNote>;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={months} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap="20%">
        <XAxis dataKey="month" tick={TICK} tickLine={false} axisLine={false} minTickGap={24} tickFormatter={monthTick} />
        <YAxis tick={TICK} tickLine={false} axisLine={false} width={44} tickCount={4} tickFormatter={(v: number) => formatUsdAdaptive(v)} />
        <Tooltip
          cursor={{ fill: "var(--data-track)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const m = payload[0].payload as OutcomeCostStep["months"][number];
            return (
              <div className="k-popover px-2.5 py-1.5 text-[12px]">
                <p className="k-fg3 k-mono">{monthLabel(m.month)}</p>
                <p className="font-medium tabular-nums">{m.costPerOutcomeUsd == null ? "—" : formatUsdAdaptive(m.costPerOutcomeUsd)}</p>
                <p className="k-fg3 tabular-nums">
                  {formatUsdAdaptive(m.spendUsd)} spent, {formatCount(m.outcomes)} {plural.toLowerCase()}
                </p>
                {m.learning && <p className="k-fg3">Learning</p>}
              </div>
            );
          }}
        />
        <Bar dataKey="costPerOutcomeUsd" isAnimationActive={false}>
          {months.map((m) => (
            <Cell key={m.month} fill={m.learning ? LEARNING : OURS} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function CostCumulativeChart({ answered, failed, cost, plural }: { answered: boolean; failed: boolean; cost: OutcomeCostStep | null; plural: string }) {
  if (!answered) return <Shimmer className="h-full w-full rounded-[8px]" />;
  if (failed) return <EmptyNote>Could not read the cost since you started. Retrying.</EmptyNote>;
  const months = cost?.months ?? [];
  if (!cost || months.every((m) => m.cumulativeCostPerOutcomeUsd == null)) return <EmptyNote>No {plural.toLowerCase()} from people we contacted yet.</EmptyNote>;
  const expected = cost.expected.costPerOutcomeUsd;
  // Grey while the served `learning` holds, in colour once mature; the boundary month sits on both lines so they join.
  const rows = months.map((m, i) => {
    const next = months[i + 1];
    const v = m.cumulativeCostPerOutcomeUsd;
    return {
      ...m,
      learningLine: m.learning || (next && next.learning === false && m.learning) ? v : null,
      matureLine: !m.learning || (next && !next.learning) ? v : null,
    };
  });
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <XAxis dataKey="month" tick={TICK} tickLine={false} axisLine={false} minTickGap={24} tickFormatter={monthTick} />
        <YAxis tick={TICK} tickLine={false} axisLine={false} width={44} tickCount={4} tickFormatter={(v: number) => formatUsdAdaptive(v)} />
        {expected != null && <ReferenceLine y={expected} stroke="var(--fg-3)" strokeDasharray="4 4" ifOverflow="extendDomain" />}
        <Tooltip
          cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const m = payload[0].payload as OutcomeCostStep["months"][number];
            return (
              <div className="k-popover px-2.5 py-1.5 text-[12px]">
                <p className="k-fg3 k-mono">{monthLabel(m.month)}, in total</p>
                <p className="font-medium tabular-nums">{m.cumulativeCostPerOutcomeUsd == null ? "—" : formatUsdAdaptive(m.cumulativeCostPerOutcomeUsd)}</p>
                <p className="k-fg3 tabular-nums">
                  {formatUsdAdaptive(m.cumulativeSpendUsd)} spent, {formatCount(m.cumulativeOutcomes)} {plural.toLowerCase()}
                </p>
                {m.learning && <p className="k-fg3">Learning</p>}
              </div>
            );
          }}
        />
        <Line type="linear" dataKey="learningLine" stroke={LEARNING} strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
        <Line type="linear" dataKey="matureLine" stroke={OURS} strokeWidth={1.75} dot={false} connectNulls={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ChartCard({ title, legend, children }: { title: string; legend?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="k-card flex min-w-0 flex-col p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="k-label min-w-0">{title}</span>
        {legend}
      </div>
      <div className="mt-3 h-[170px]">{children}</div>
    </div>
  );
}

/** A tile note only where the tile is wide enough to hold it beside its label. */
function Wide({ children }: { children: React.ReactNode }) {
  return <span className="hidden sm:inline">{children}</span>;
}

function Dot({ color }: { color: string }) {
  return <span className="inline-block h-2 w-2 shrink-0 rounded-[2px]" style={{ background: color }} />;
}

function PeopleLegend() {
  return (
    <span className="k-fg3 flex shrink-0 items-center gap-3 text-[12px]">
      <span className="inline-flex items-center gap-1.5">
        <Dot color={EVERYONE} /> Everyone
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Dot color={OURS} /> Contacted by us
      </span>
    </span>
  );
}

function CostLegend({ expected = false }: { expected?: boolean }) {
  return (
    <span className="k-fg3 flex shrink-0 items-center gap-3 text-[12px]">
      <span className="inline-flex items-center gap-1.5">
        <Dot color={LEARNING} /> Learning
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Dot color={OURS} /> Measured
      </span>
      {expected && (
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-3 border-t-2 border-dashed" style={{ borderColor: "var(--fg-3)" }} /> Expected
        </span>
      )}
    </span>
  );
}
