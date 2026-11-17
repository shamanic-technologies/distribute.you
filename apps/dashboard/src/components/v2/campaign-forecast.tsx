"use client";

import { useState } from "react";
import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuthQuery } from "@/lib/use-auth-query";
import { slowServerReadOptions } from "@/lib/query-options";
import { getFunnelCampaignOutcomeForecast } from "@/lib/api";
import { formatCount, formatUsdAdaptive } from "@/lib/format-number";
import { formatRatePct } from "@/lib/pipe-stats";
import { pausedWords } from "@/lib/campaign-targets";
import {
  delayWords,
  forecastUnavailableWords,
  monthYearWords,
  nextTargetWords,
  sourceWords,
  type CampaignOutcomeForecast,
  type ForecastNextTarget,
  type ForecastTunnel,
} from "@/lib/outcome-forecast";
import { StepMark } from "@/components/marks/step-mark";
import { EmptyNote, SectionTitle, Shimmer } from "@/components/v2/ui";

/**
 * WHERE A CAMPAIGN IS GOING (owner 2026-11-17: « du Woow, de la projection, du rêve, de la clarté et transparence »).
 * One section, read top to bottom, off features-service's `outcome-forecast` (OUTCOME-FORECAST-1117):
 * 1. the promise: what one Target brings in and when the next one is expected;
 * 2. the curve: expected revenue ahead with its range, what is invested under it;
 * 3. the lever: the same forecast at bigger budgets (served alternatives);
 * 4. the road: each outcome to date, what one is worth, the rate to the next;
 * 5. the assumptions, folded: where each rate and delay comes from.
 * Every figure is served; nothing is divided, summed or simulated here.
 */

const TICK = { fontSize: 11, fill: "var(--fg-3)" };

export function CampaignForecast({ brandId, campaignId }: { brandId: string; campaignId: string }) {
  const q = useAuthQuery(["campaignOutcomeForecast", brandId, campaignId], () => getFunnelCampaignOutcomeForecast(brandId, campaignId), slowServerReadOptions);
  const settled = q.data !== undefined || q.isFetchedAfterMount;
  const data = q.data ?? null;
  return (
    <section>
      <SectionTitle right={<span>Where this campaign is going</span>}>Forecast</SectionTitle>
      {!settled ? (
        <Shimmer className="h-[420px] w-full rounded-xl" />
      ) : !data ? (
        <div className="k-card">
          <EmptyNote>Could not read the forecast right now. Retrying.</EmptyNote>
        </div>
      ) : !data.forecast ? (
        <div className="k-card">
          <EmptyNote>{forecastUnavailableWords(data.unavailableReason)}</EmptyNote>
        </div>
      ) : (
        <ForecastBody data={data} forecast={data.forecast} />
      )}
    </section>
  );
}

type Forecast = NonNullable<CampaignOutcomeForecast["forecast"]>;

/** The budget the reader looks at: the campaign's own (multiplier 1) or one of the served alternatives. */
type View = { multiplier: number; monthlyUsd: number | null; next: ForecastNextTarget; revenue: ForecastTunnel | null; spend: number[] };

function ForecastBody({ data, forecast }: { data: CampaignOutcomeForecast; forecast: Forecast }) {
  const [multiplier, setMultiplier] = useState(1);
  const budget = data.hypotheses.budget;
  const views: View[] = [
    { multiplier: 1, monthlyUsd: budget.monthlyUsd, next: forecast.nextTarget, revenue: forecast.expectedRevenueUsd, spend: forecast.spendAheadUsd },
    ...data.alternatives.map((a) => ({ multiplier: a.budgetMultiplier, monthlyUsd: a.monthlyBudgetUsd, next: a.nextTarget, revenue: a.expectedRevenueUsd, spend: a.spendAheadUsd })),
  ];
  const view = views.find((v) => v.multiplier === multiplier) ?? views[0];
  const target = forecast.outcomes[forecast.outcomes.length - 1];
  const value = data.hypotheses.targetValue?.usd ?? null;
  const lastDay = forecast.days[forecast.days.length - 1];
  const revenueAtEnd = view.revenue ? view.revenue.expected[view.revenue.expected.length - 1] : null;
  const spendAtEnd = view.spend.length > 0 ? view.spend[view.spend.length - 1] : null;
  const paused = pausedWords(budget.pausedReason, budget.resumesAt);
  return (
    <div className="k-card overflow-hidden">
      {/* 1. The promise. */}
      <div className="grid gap-4 px-5 pb-4 pt-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="min-w-0">
          <p className="k-label">Next {target.label.toLowerCase()}</p>
          <p className="mt-1.5 text-[28px] font-medium leading-[34px] tracking-[-0.01em]">
            Expected {nextTargetWords(view.next)}
          </p>
          <p className="k-fg2 mt-1.5 text-[14px]">
            {value != null && (
              <>
                One {target.label.toLowerCase()} brings in <span className="k-fg font-medium tabular-nums">{formatUsdAdaptive(value)}</span>.{" "}
              </>
            )}
            {view.next.earlyDate && <>With a good run, as early as {monthYearWords(view.next.earlyDate)}.</>}
          </p>
          {paused && <p className="k-fg3 mt-1.5 text-[12px]">{paused}</p>}
        </div>
        {/* 3. The lever: served alternatives only. */}
        {views.length > 1 && (
          <div className="min-w-0">
            <p className="k-label mb-1.5">Monthly budget</p>
            <div className="flex flex-wrap gap-1.5">
              {views.map((v) => (
                <button
                  key={v.multiplier}
                  type="button"
                  aria-pressed={v.multiplier === view.multiplier}
                  className={v.multiplier === view.multiplier ? "k-btn-strong" : "k-btn"}
                  onClick={() => setMultiplier(v.multiplier)}
                >
                  <span className="tabular-nums">{v.monthlyUsd != null ? formatUsdAdaptive(v.monthlyUsd) : `${v.multiplier}x`}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. The curve. */}
      {view.revenue && (
        <div className="k-line-subtle border-t px-5 pb-4 pt-4">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p className="text-[14px]">
              <span className="k-fg2">Expected revenue by {monthYearWords(lastDay)}</span>{" "}
              <span className="font-medium tabular-nums text-[var(--run)]">{revenueAtEnd != null ? formatUsdAdaptive(revenueAtEnd) : "—"}</span>
            </p>
            <p className="k-fg2 text-[13px]">
              Invested by then <span className="k-fg tabular-nums">{spendAtEnd != null ? formatUsdAdaptive(spendAtEnd) : "—"}</span>
            </p>
          </div>
          <div className="mt-3 h-[220px]">
            <RevenueChart days={forecast.days} revenue={view.revenue} spend={view.spend} />
          </div>
          <p className="k-fg3 mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
            <LegendDot color="var(--run)" label="Expected revenue" />
            <LegendDot color="var(--run)" faded label="Likely range (8 cases in 10)" />
            <LegendDot color="var(--fg-3)" label="Invested" />
          </p>
        </div>
      )}

      {/* 4. The road to the Target. */}
      <div className="k-line-subtle border-t px-5 py-4">
        <p className="k-label mb-3">The road to {target.label.toLowerCase()}</p>
        <ol className="flex flex-col gap-2 md:flex-row md:items-stretch md:gap-0">
          {forecast.outcomes.map((o, i) => {
            const t = data.hypotheses.transitions[i];
            const worth = o.expectedRevenuePerUnitUsd?.median ?? null;
            return (
              <li key={o.step} className="flex min-w-0 flex-1 flex-col md:flex-row md:items-center">
                <div className="k-inset min-w-0 flex-1 rounded-[10px] px-3 py-2.5">
                  <p className="flex min-w-0 items-center gap-1.5 text-[12px]">
                    <StepMark stepKey={o.step} size="xs" />
                    <span className="k-fg2 truncate">{o.label}</span>
                    {o.isTarget && <span className="k-chip ml-auto shrink-0">Target</span>}
                  </p>
                  <p className="mt-1 text-[22px] font-medium leading-7 tabular-nums">{formatCount(o.unitsToDate)}</p>
                  <p className="k-fg3 text-[12px] tabular-nums">{o.isTarget && value != null ? `${formatUsdAdaptive(value)} each` : worth != null ? `each worth ${formatUsdAdaptive(worth)}` : " "}</p>
                </div>
                {t && (
                  <span className="k-fg2 flex shrink-0 items-center justify-center gap-1 px-2 py-0.5 text-[12px] tabular-nums md:flex-col md:gap-0" title={`${sourceWords(t.yield.source)}`}>
                    <span>{yieldWords(t.yield.unitsPerUnit)}</span>
                    <span className="k-fg3" aria-hidden="true">
                      →
                    </span>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* 5. The assumptions, folded. */}
      <details className="k-line-subtle border-t px-5 py-3 text-[13px]">
        <summary className="k-fg2 cursor-pointer select-none">How we forecast this</summary>
        <ul className="k-fg2 mt-2 space-y-1.5">
          {view.monthlyUsd != null && (
            <li>
              Budget: <span className="k-fg tabular-nums">{formatUsdAdaptive(view.monthlyUsd)}</span> a month, kept as it is.
            </li>
          )}
          {data.hypotheses.entryCost?.usdPerUnit != null && (
            <li>
              One {data.hypotheses.entryCost.label.toLowerCase()}: <span className="k-fg tabular-nums">{formatUsdAdaptive(data.hypotheses.entryCost.usdPerUnit)}</span>, {sourceWords(data.hypotheses.entryCost.source)}.
            </li>
          )}
          {data.hypotheses.transitions.map((t, i) => {
            const from = forecast.outcomes[i]?.label ?? t.fromStep;
            const to = forecast.outcomes[i + 1]?.label ?? t.toStep;
            const delay = delayWords(t.delay.medianHours);
            return (
              <li key={`${t.fromStep}>${t.toStep}`}>
                {from} to {to}: <span className="k-fg tabular-nums">{yieldWords(t.yield.unitsPerUnit)}</span>, {sourceWords(t.yield.source)}
                {delay ? `. Takes ${delay}, ${sourceWords(t.delay.source)}${t.delay.thinSample ? " (few cases so far)" : ""}` : ""}.
              </li>
            );
          })}
          <li className="k-fg3">A forecast, refreshed every day as results come in.</li>
        </ul>
      </details>
    </div>
  );
}

/** A served yield (units of the next outcome per unit of this one) as a rate; above one it reads as a multiple. */
function yieldWords(unitsPerUnit: number | null): string {
  if (unitsPerUnit == null) return "—";
  return unitsPerUnit <= 1 ? formatRatePct(unitsPerUnit * 100) : `${unitsPerUnit.toFixed(1)}x`;
}

function LegendDot({ color, label, faded = false }: { color: string; label: string; faded?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color, opacity: faded ? 0.25 : 1 }} />
      {label}
    </span>
  );
}

/** Revenue ahead: the expected line over its served p10-p90 range, the invested line under it. One point per served day. */
function RevenueChart({ days, revenue, spend }: { days: string[]; revenue: ForecastTunnel; spend: number[] }) {
  const rows = days.map((d, i) => ({ t: Date.parse(`${d}T00:00:00Z`), day: d, expected: revenue.expected[i], range: [revenue.p10[i], revenue.p90[i]] as [number, number], spend: spend[i] }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tick={TICK} tickLine={false} axisLine={false} minTickGap={60} tickFormatter={(t: number) => monthYearWords(new Date(t).toISOString())} />
        <YAxis tick={TICK} tickLine={false} axisLine={false} width={52} tickCount={4} tickFormatter={(v: number) => formatUsdAdaptive(v)} />
        <Tooltip
          cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const r = payload[0].payload as (typeof rows)[number];
            return (
              <div className="k-popover px-2.5 py-1.5 text-[12px] tabular-nums">
                <p className="k-fg3 k-mono">{r.day}</p>
                <p className="font-medium">{formatUsdAdaptive(r.expected)} expected</p>
                <p className="k-fg2">
                  {formatUsdAdaptive(r.range[0])} to {formatUsdAdaptive(r.range[1])}
                </p>
                <p className="k-fg2">{formatUsdAdaptive(r.spend)} invested</p>
              </div>
            );
          }}
        />
        <Area dataKey="range" stroke="none" fill="var(--run)" fillOpacity={0.14} isAnimationActive={false} />
        <Line dataKey="expected" stroke="var(--run)" strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line dataKey="spend" stroke="var(--fg-3)" strokeWidth={1.5} strokeDasharray="3 4" dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
