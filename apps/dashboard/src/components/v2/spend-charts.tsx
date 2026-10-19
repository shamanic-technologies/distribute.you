"use client";

import { Bar, BarChart, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getFunnelCampaignSpendCharts, getOfferSpendCharts } from "@/lib/api";
import { formatUsdAdaptive, formatCount } from "@/lib/format-number";
import { formatRatePct } from "@/lib/pipe-stats";
import { stepLabel, stepPluralLabel } from "@/lib/legs";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import {
  actionKeysOf,
  convergenceRows,
  dayInWords,
  firstMaturingDay,
  formatPerActionUsd,
  latestSpendDay,
  unitPlural,
  type SpendChart,
  type SpendChartPoint,
} from "@/lib/spend-charts";
import { EmptyNote, SectionTitle, Shimmer } from "@/components/v2/ui";
import { LearningFigure } from "@/components/v2/roi-label";

/**
 * WHY A DAY COSTS WHAT IT COSTS, AND WHETHER IT IS CONVERGING (owner 2026-10-19, SPEND-CHARTS-1019).
 *
 * One block, the same at every grain (the offer on Today, a campaign, each pipe of it) and for every
 * channel: what each day's spend bought (per action, the producer's own units), the cost per outcome
 * and the % conversion over time. The measured curve is drawn from day one, GREY while the scope is
 * Learning and in colour once mature, with a dotted line toward the served Expected value (owner: "plus
 * de learning qui offusque la data"). Every figure is served by features-service; nothing is divided
 * or summed here.
 */

const DASH = <span className="k-fg4">—</span>;
const TICK = { fontSize: 11, fill: "var(--fg-3)" };
const shortDate = (t: number) => new Date(t).toISOString().slice(5, 10);

/** One colour per served action kind (the same whatever the channel); an unknown kind reads neutral. */
const ACTION_COLOR: Record<string, string> = {
  prospects_found: "var(--data-sky)",
  first_contacts: "var(--accent)",
  follow_ups: "var(--data-violet)",
  messages_written: "var(--data-teal)",
  replies_read: "var(--data-amber)",
  notifications: "var(--data-lime)",
  other: "var(--fg-4)",
};
const actionColor = (key: string) => ACTION_COLOR[key] ?? "var(--fg-4)";

/** The campaign's own chart and one per pipe, keyed by the pipe's campaign id. */
export function useFunnelCampaignSpendCharts(brandId: string, salesFunnelCampaignId: string) {
  return useAuthQuery(
    ["spendCharts", "campaign", brandId, salesFunnelCampaignId],
    () => getFunnelCampaignSpendCharts(brandId, salesFunnelCampaignId),
    pollOptions,
  );
}

/** The state a block is drawn from: answered once stays answered (a failed poll never repaints a skeleton). */
export interface SpendChartState {
  chart: SpendChart | null;
  answered: boolean;
  failed: boolean;
}

export function spendChartState<T>(q: { data: T | undefined; isFetchedAfterMount: boolean; isError: boolean }, pick: (d: T) => SpendChart | null): SpendChartState {
  const answered = q.data !== undefined;
  return { chart: q.data !== undefined ? pick(q.data) : null, answered, failed: !answered && q.isFetchedAfterMount && q.isError };
}

/** Today: the selected offer's block. Renders nothing while the offer runs no campaign. */
export function OfferSpendChartsSection({ brandId, offerId }: { brandId: string; offerId: string | null }) {
  const q = useAuthQuery(["spendCharts", "offer", brandId, offerId ?? ""], () => getOfferSpendCharts(offerId!, brandId), {
    ...pollOptions,
    enabled: !!offerId,
  });
  if (!offerId || q.data === null) return null;
  const state = spendChartState(q, (d) => d?.offer ?? null);
  return (
    <section>
      <SectionTitle right={<span>Since you started</span>}>Your spend, day by day</SectionTitle>
      <SpendChartsBlock {...state} />
    </section>
  );
}

/** The three cards: spend per day by action, cost per outcome, % conversion. */
export function SpendChartsBlock({ chart, answered, failed }: SpendChartState) {
  const catalogue = useLegCatalogue();
  const outcome = chart?.outcomeStep ? stepLabel(catalogue, chart.outcomeStep) ?? chart.outcomeStep : null;
  const outcomes = outcome ? stepPluralLabel(catalogue, chart?.outcomeStep, outcome) : null;
  if (failed) {
    return (
      <div className="k-card">
        <EmptyNote>Could not read the spend per day. Retrying.</EmptyNote>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="grid gap-3 lg:grid-cols-3">
        <SpendCard chart={chart} answered={answered} />
        <CostCard chart={chart} answered={answered} outcome={outcome} outcomes={outcomes} />
        <ConversionCard chart={chart} answered={answered} outcome={outcome} />
      </div>
      {answered && chart && chart.daily.length > 0 && <Legend />}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="k-card flex min-w-0 flex-col p-4">
      <span className="k-label truncate">{title}</span>
      <div className="mt-2 flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}

function BigFigure({ children }: { children: React.ReactNode }) {
  return <div className="text-[22px] font-medium leading-7 tracking-[-0.02em] tabular-nums">{children}</div>;
}

function ChartBox({ answered, children }: { answered: boolean; children: React.ReactNode }) {
  return <div className="mt-3 h-[150px]">{!answered ? <Shimmer className="h-full w-full rounded-[8px]" /> : children}</div>;
}

/** Spend: the total, the last day that spent in words, then one stacked bar per day by action. */
function SpendCard({ chart, answered }: { chart: SpendChart | null; answered: boolean }) {
  const daily = chart?.daily ?? [];
  const last = latestSpendDay(daily);
  const words = last ? dayInWords(last) : null;
  const byActionUnread = chart?.spendByActionUnavailableReason != null;
  const keys = byActionUnread ? [{ key: "spent", label: "Spent" }] : actionKeysOf(daily);
  const rows = daily.map((p) => ({
    date: p.date,
    point: p,
    ...(byActionUnread ? { spent: p.spendUsd } : Object.fromEntries(p.byAction.map((a) => [a.key, a.spendUsd]))),
  }));
  return (
    <Card title="$ Spent">
      <BigFigure>{!answered ? <Shimmer className="h-7 w-20" /> : chart ? formatUsdAdaptive(chart.totals.spendUsd) : DASH}</BigFigure>
      <div className="k-fg3 mt-0.5 min-h-[48px] text-[12px] leading-4">
        {last && words?.counts ? (
          <>
            <p>
              <span className="k-mono">{last.date.slice(5)}</span>: {words.counts}
            </p>
            {words.prices && <p>{words.prices}</p>}
          </>
        ) : last ? (
          <p>
            <span className="k-mono">{last.date.slice(5)}</span>: {formatUsdAdaptive(last.spendUsd)} spent
          </p>
        ) : null}
      </div>
      <ChartBox answered={answered}>
        {daily.length === 0 || !last ? (
          <EmptyNote>Nothing spent yet.</EmptyNote>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap={1}>
              <XAxis dataKey="date" tick={TICK} tickLine={false} axisLine={false} minTickGap={40} tickFormatter={(d: string) => d.slice(5)} />
              <YAxis tick={TICK} tickLine={false} axisLine={false} width={44} tickCount={4} tickFormatter={(v: number) => formatUsdAdaptive(v)} />
              <Tooltip cursor={{ fill: "var(--data-track)" }} content={({ active, payload }) => (active && payload?.length ? <DayTip point={(payload[0].payload as { point: SpendChartPoint }).point} /> : null)} />
              {keys.map((k) => (
                <Bar key={k.key} dataKey={k.key} name={k.label} stackId="spend" fill={actionColor(k.key)} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartBox>
    </Card>
  );
}

/** A day's spend, action by action, in the producer's words and units. */
function DayTip({ point }: { point: SpendChartPoint }) {
  return (
    <div className="k-popover min-w-[200px] px-2.5 py-1.5 text-[12px]">
      <p className="k-fg3 k-mono">{point.date}</p>
      <p className="font-medium tabular-nums">{formatUsdAdaptive(point.spendUsd)} spent</p>
      {point.byAction.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {point.byAction.map((a) => (
            <li key={a.key} className="flex items-baseline gap-1.5">
              <span className="inline-block h-2 w-2 shrink-0 rounded-[2px]" style={{ background: actionColor(a.key) }} />
              <span className="min-w-0 flex-1">
                {a.unit && a.actions != null && a.actions > 0 ? `${formatCount(a.actions)} ${unitPlural(a.unit, a.actions)}` : a.label}
                {a.unit && a.costPerActionUsd != null && <span className="k-fg3"> · {formatPerActionUsd(a.costPerActionUsd)} each</span>}
              </span>
              <span className="tabular-nums">{formatUsdAdaptive(a.spendUsd)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Words for a served reason a chart has no outcome or no conversion. */
function unavailableWords(reason: string): string {
  if (reason === "no_entry_population") return "This step finds new people. Its result is the people found, so there is no conversion to show.";
  if (reason === "no_leg") return "Nothing to chart yet.";
  if (reason === "outcome_step_not_counted") return "This result is not counted yet.";
  return "Not available yet.";
}

function CostCard({ chart, answered, outcome, outcomes }: { chart: SpendChart | null; answered: boolean; outcome: string | null; outcomes: string | null }) {
  const t = chart?.totals;
  const expected = chart?.expected.costPerOutcomeUsd ?? null;
  const unavailable = chart?.outcomeUnavailableReason ?? null;
  return (
    <Card title={outcome ? `$ / ${outcome}` : "$ / Result"}>
      <BigFigure>
        {!answered ? (
          <Shimmer className="h-7 w-20" />
        ) : !t || t.costPerOutcomeUsd == null ? (
          expected != null ? (
            <span className="whitespace-nowrap">
              {formatUsdAdaptive(expected)}
              <span className="k-fg3 ml-1 text-[11px] font-normal">expected</span>
            </span>
          ) : (
            DASH
          )
        ) : t.learning ? (
          <LearningFigure measured={formatUsdAdaptive(t.costPerOutcomeUsd)} expected={expected != null ? formatUsdAdaptive(expected) : null} />
        ) : (
          formatUsdAdaptive(t.costPerOutcomeUsd)
        )}
      </BigFigure>
      <p className="k-fg3 mt-0.5 min-h-[48px] text-[12px] leading-4">
        {t && outcome && outcomes ? `${formatUsdAdaptive(t.spendUsd)} spent for ${formatCount(t.outcomes)} ${(t.outcomes === 1 ? outcome : outcomes).toLowerCase()}` : null}
      </p>
      <ChartBox answered={answered}>
        {unavailable ? (
          <EmptyNote>{unavailableWords(unavailable)}</EmptyNote>
        ) : !chart || chart.daily.every((p) => p.costPerOutcomeUsd == null) ? (
          <EmptyNote>
            {t && t.outcomes > 0
              ? "Nothing spent on this step yet, so it has no cost per result."
              : outcome
                ? `No ${outcome.toLowerCase()} yet: the line starts with the first one.`
                : "Nothing to chart yet."}
          </EmptyNote>
        ) : (
          <ConvergenceChart daily={chart.daily} pick={(p) => p.costPerOutcomeUsd} expected={expected} format={formatUsdAdaptive} />
        )}
      </ChartBox>
    </Card>
  );
}

function ConversionCard({ chart, answered, outcome }: { chart: SpendChart | null; answered: boolean; outcome: string | null }) {
  const t = chart?.totals;
  const expected = chart?.expected.conversionRatePct ?? null;
  const unavailable = chart?.conversionUnavailableReason ?? null;
  const maturingFrom = chart ? firstMaturingDay(chart.daily) : null;
  return (
    <Card title={outcome ? `% to ${outcome}` : "% Conversion"}>
      <BigFigure>
        {!answered ? (
          <Shimmer className="h-7 w-20" />
        ) : unavailable || !t || t.conversionRatePct == null ? (
          !unavailable && expected != null ? (
            <span className="whitespace-nowrap">
              {formatRatePct(expected)}
              <span className="k-fg3 ml-1 text-[11px] font-normal">expected</span>
            </span>
          ) : (
            DASH
          )
        ) : t.learning ? (
          <LearningFigure measured={formatRatePct(t.conversionRatePct)} expected={expected != null ? formatRatePct(expected) : null} />
        ) : (
          formatRatePct(t.conversionRatePct)
        )}
      </BigFigure>
      <p className="k-fg3 mt-0.5 min-h-[48px] text-[12px] leading-4">
        {t && outcome && !unavailable && t.entered > 0 ? `${formatCount(t.converted)} of ${formatCount(t.entered)} people went on to ${outcome}` : null}
      </p>
      <ChartBox answered={answered}>
        {unavailable ? (
          <EmptyNote>{unavailableWords(unavailable)}</EmptyNote>
        ) : !chart || chart.daily.every((p) => p.conversionRatePct == null) ? (
          <EmptyNote>Nobody reached yet: the line starts with the first person.</EmptyNote>
        ) : (
          <ConvergenceChart daily={chart.daily} pick={(p) => p.conversionRatePct} expected={expected} format={formatRatePct} maturingFrom={maturingFrom} />
        )}
      </ChartBox>
    </Card>
  );
}

/**
 * A served metric over time: grey while Learning, in colour once measured, a dotted line from the last
 * point toward the served Expected value, and (conversion) a band over the days whose people have not
 * had the time to convert yet.
 */
function ConvergenceChart({
  daily,
  pick,
  expected,
  format,
  maturingFrom,
}: {
  daily: SpendChartPoint[];
  pick: (p: SpendChartPoint) => number | null;
  expected: number | null;
  format: (n: number) => string;
  maturingFrom?: string | null;
}) {
  const rows = convergenceRows(daily, pick, expected);
  const lastDayT = Date.parse(`${daily[daily.length - 1].date}T00:00:00Z`);
  const bandFrom = maturingFrom ? Date.parse(`${maturingFrom}T00:00:00Z`) : null;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tick={TICK} tickLine={false} axisLine={false} minTickGap={40} tickFormatter={shortDate} />
        <YAxis tick={TICK} tickLine={false} axisLine={false} width={44} tickCount={4} tickFormatter={(v: number) => format(v)} />
        {bandFrom != null && (
          <ReferenceArea
            x1={bandFrom}
            x2={lastDayT}
            fill="var(--data-track)"
            fillOpacity={1}
            ifOverflow="extendDomain"
            label={{ value: "Still maturing", position: "insideTop", fontSize: 11, fill: "var(--fg-3)" }}
          />
        )}
        {expected != null && <ReferenceLine y={expected} stroke="var(--line-strong)" strokeDasharray="2 4" />}
        <Tooltip
          cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const r = payload[0].payload as ReturnType<typeof convergenceRows>[number];
            if (!r.date) {
              return r.expected != null ? (
                <div className="k-popover px-2.5 py-1.5 text-[12px]">
                  <p className="k-fg3">Expected</p>
                  <p className="font-medium tabular-nums">{format(r.expected)}</p>
                </div>
              ) : null;
            }
            const v = r.mature ?? r.learning;
            return (
              <div className="k-popover px-2.5 py-1.5 text-[12px]">
                <p className="k-fg3 k-mono">{r.date}</p>
                <p className="font-medium tabular-nums">{v == null ? "—" : format(v)}</p>
                {r.mature == null && r.learning != null && <p className="k-fg3">Learning</p>}
                {bandFrom != null && r.maturing && <p className="k-fg3">Still maturing</p>}
              </div>
            );
          }}
        />
        <Line type="linear" dataKey="learning" stroke="var(--fg-4)" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
        <Line type="linear" dataKey="mature" stroke="var(--accent)" strokeWidth={1.75} dot={false} connectNulls={false} isAnimationActive={false} />
        <Line type="linear" dataKey="expected" stroke="var(--fg-3)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function Legend() {
  return (
    <div className="k-fg3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[12px]">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-[2px] w-4" style={{ background: "var(--fg-4)" }} />
        Learning
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-[2px] w-4" style={{ background: "var(--accent)" }} />
        Measured
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: "var(--fg-3)" }} />
        Expected
      </span>
    </div>
  );
}
