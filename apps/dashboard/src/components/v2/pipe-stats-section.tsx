"use client";

import { useState } from "react";
import Link from "next/link";
import { useStaffCatalogueList } from "@/components/v2/staff-catalogue-data";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getStaffPipeStats } from "@/lib/api";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { formatUsdAdaptive } from "@/lib/format-number";
import {
  endToEndRate,
  impactWords,
  teamOnOurLeadsRate,
  teamReasonWords,
  formatRatePct,
  mergeHistories,
  outcomeVolume,
  pipeStatsQuery,
  periodRows,
  periodsHaveSpend,
  unavailableWords,
  PIPE_STATS_SCOPE_LABELS,
  type PeriodGrain,
  type PipePeriodRow,
  type PipePeriods,
  type PipeStats,
  type PipeStatsRate,
  type TeamImpact,
  type PipeStatsScope,
} from "@/lib/pipe-stats";
import { EmptyNote, SectionTitle, Shimmer } from "@/components/v2/ui";
import { RoiLabel } from "@/components/v2/roi-label";

/** One colour per scope, the same in the table header dot and on every line. */
const SCOPE_COLOR: Record<PipeStatsScope, string> = {
  fleet: "var(--fg-3)",
  brand: "var(--data-teal)",
  offer: "var(--accent)",
};

/** One colour per volume role, in the producer's order (input, action, outcome): none shared with a scope. */
const ROLE_COLOR: Record<string, string> = {
  input: "var(--data-sky)",
  action: "var(--data-violet)",
  outcome: "var(--data-amber)",
};

const TH = "k-label px-3 py-2.5 text-right font-medium first:pl-4 first:text-left last:pr-4";
const TD = "px-3 py-2 text-right tabular-nums first:pl-4 first:text-left last:pr-4";

/**
 * The pipe's own figures since inception (owner 2026-10-12): a table comparing all clients,
 * this brand and this offer (volumes in the pipe's own words, spend, cost per outcome, ROI),
 * then the same figures over time. Every number is features-service's (lib/pipe-stats.ts).
 */
export function PipeStatsSection({ pipeId, brandId, offerId }: { pipeId: string; brandId: string; offerId: string | null }) {
  const fleet = usePipeStats(pipeId, "fleet", brandId, offerId);
  const brand = usePipeStats(pipeId, "brand", brandId, offerId);
  const offer = usePipeStats(pipeId, "offer", brandId, offerId);
  const reads = { fleet, brand, offer };
  const scopes = (["fleet", "brand", "offer"] as const).filter((s) => reads[s].enabled);
  const data: Partial<Record<PipeStatsScope, PipeStats | null>> = Object.fromEntries(scopes.map((s) => [s, reads[s].data ?? null]));
  const reference = fleet.data ?? brand.data ?? offer.data ?? null;
  const outcomeLabel = reference ? (outcomeVolume(reference)?.label ?? "outcome") : "outcome";
  const answered = scopes.every((s) => reads[s].answered);

  return (
    <section className="space-y-6">
      <div>
        <SectionTitle right={<span>Whole pipe since inception, net</span>}>Since inception</SectionTitle>
        <div className="k-card overflow-hidden">
          <div className="k-scroll overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="k-line-subtle border-b">
                  <th className={TH} />
                  {scopes.map((s) => (
                    <th key={s} className={TH}>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: SCOPE_COLOR[s] }} />
                        {PIPE_STATS_SCOPE_LABELS[s]}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(reference?.volumes ?? []).map((v) => (
                  <Row key={v.key} label={v.label} scopes={scopes} reads={reads}>
                    {(s) => {
                      const total = s.volumes.find((x) => x.key === v.key)?.total;
                      return total == null ? <span className="k-fg4">—</span> : total.toLocaleString("en-US");
                    }}
                  </Row>
                ))}
                {(reference?.conversionRates ?? []).map((r) => (
                  <Row key={r.key} label={r.label} scopes={scopes} reads={reads}>
                    {(s) => {
                      const x = s.conversionRates?.find((y) => y.key === r.key);
                      if (!x) return <span className="k-fg4">—</span>;
                      if (x.ratePct == null) return <span className="k-fg3 text-[12px]">{unavailableWords(x.unavailableReason)}</span>;
                      return (
                        <RateCell rate={x} />
                      );
                    }}
                  </Row>
                ))}
                <Row label="Spent" scopes={scopes} reads={reads}>
                  {(s) => (s.spendUsd == null ? <span className="k-fg4">—</span> : formatUsdAdaptive(s.spendUsd))}
                </Row>
                <Row label={`Cost per ${outcomeLabel.toLowerCase()}`} scopes={scopes} reads={reads}>
                  {(s) =>
                    s.costPerOutcomeUsd == null ? (
                      <span className="k-fg3 text-[12px]">{unavailableWords(s.costPerOutcomeUnavailableReason)}</span>
                    ) : (
                      formatUsdAdaptive(s.costPerOutcomeUsd)
                    )
                  }
                </Row>
                <Row label={<RoiLabel />} scopes={scopes} reads={reads}>
                  {(s) =>
                    s.roi == null ? (
                      <span className="k-fg3 text-[12px]">{unavailableWords(s.roiUnavailableReason)}</span>
                    ) : (
                      <span className={roiIsGood(s.roi) ? "text-[var(--run)]" : ""}>{formatRoi(s.roi)}</span>
                    )
                  }
                </Row>
              </tbody>
            </table>
          </div>
          <p className="k-fg3 k-line-subtle border-t px-4 py-2.5 text-[12px]">
            {!offerId ? "Pick an offer to compare it too. " : ""}
            The cost at the top of the page is the best workflow&apos;s; these are every workflow of this pipe
            {reference?.firstActivityDay ? `, since ${reference.firstActivityDay}` : ""}.
          </p>
        </div>
        {!answered && scopes.some((s) => reads[s].failed) && <p className="k-fg3 mt-2 text-[12px]">Some figures could not be read. Retrying.</p>}
      </div>

      {scopes.some((x) => data[x]?.periods) && <PeriodsSection data={data} scopes={scopes} />}

      {scopes.some((x) => data[x]?.teamImpact) && <TeamImpactSection data={data} scopes={scopes} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <ScopeChart
          title={`Cost per ${outcomeLabel.toLowerCase()} over time`}
          rows={mergeHistories(data, (p) => p.costPerOutcomeUsd)}
          scopes={scopes}
          answered={answered}
          format={formatUsdAdaptive}
          empty={`No ${outcomeLabel.toLowerCase()} yet, so no cost per one.`}
        />
        <ScopeChart
          title={<RoiLabel>ROI over time</RoiLabel>}
          rows={mergeHistories(data, (p) => p.roi)}
          scopes={scopes}
          answered={answered}
          format={formatRoi}
          log
          empty="No return to show yet."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <VolumesChart data={data} scopes={scopes} answered={answered} />
        <ConversionChart data={data} scopes={scopes} answered={answered} />
      </div>
    </section>
  );
}

function usePipeStats(pipeId: string, scope: PipeStatsScope, brandId: string, offerId: string | null) {
  const query = pipeStatsQuery(scope, brandId, offerId);
  const q = useAuthQuery(["staffPipeStats", pipeId, scope, query], () => getStaffPipeStats(pipeId, query as Record<string, string>), {
    ...pollOptions,
    enabled: query != null,
  });
  // Answered once stays answered: a failed poll must not repaint a skeleton.
  return { enabled: query != null, data: q.data, answered: q.data !== undefined || (q.isFetchedAfterMount && q.isError), failed: q.isError && !q.data };
}

type Reads = Record<PipeStatsScope, ReturnType<typeof usePipeStats>>;

function Row({
  label,
  scopes,
  reads,
  children,
}: {
  label: React.ReactNode;
  scopes: PipeStatsScope[];
  reads: Reads;
  children: (s: PipeStats) => React.ReactNode;
}) {
  return (
    <tr className="k-line-subtle border-b last:border-b-0">
      <td className={`${TD} k-fg2`}>{label}</td>
      {scopes.map((s) => {
        const r = reads[s];
        return (
          <td key={s} className={TD}>
            {r.data ? children(r.data) : r.failed && r.answered ? <span className="k-fg4">—</span> : <Shimmer className="ml-auto h-4 w-12" />}
          </td>
        );
      })}
    </tr>
  );
}

function ChartFrame({ title, right, children }: { title: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <SectionTitle right={right}>{title}</SectionTitle>
      <div className="k-card px-4 pb-3 pt-3">
        <div className="h-[200px]">{children}</div>
      </div>
    </div>
  );
}

const AXIS = { fontSize: 11, fill: "var(--fg-3)" };
const day = (t: number) => new Date(t).toISOString().slice(5, 10);

function ScopeChart({
  title,
  rows,
  scopes,
  answered,
  format,
  log,
  empty,
}: {
  title: React.ReactNode;
  rows: ReturnType<typeof mergeHistories>;
  scopes: PipeStatsScope[];
  answered: boolean;
  format: (v: number) => string;
  /** A return can start in the thousands on the first outcome: a log axis keeps the later days readable. */
  log?: boolean;
  empty: string;
}) {
  return (
    <ChartFrame title={title}>
      {!answered ? (
        <Shimmer className="h-full w-full rounded-[8px]" />
      ) : rows.length === 0 ? (
        <EmptyNote>{empty}</EmptyNote>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            {/* A served history skips quiet days: a real time axis, never a category one. */}
            <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tick={AXIS} tickLine={false} axisLine={false} minTickGap={40} tickFormatter={day} />
            <YAxis
              tick={AXIS}
              tickLine={false}
              axisLine={false}
              width={52}
              tickCount={4}
              tickFormatter={(v: number) => format(v)}
              {...(log ? { scale: "log" as const, domain: ["auto", "auto"] as [string, string], allowDataOverflow: true } : {})}
            />
            {log && <ReferenceLine y={1} stroke="var(--line-strong)" strokeDasharray="3 3" />}
            <Tooltip cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }} content={<ScopeTooltip names={PIPE_STATS_SCOPE_LABELS} format={format} />} />
            {scopes.map((s) => (
              <Line key={s} type="stepAfter" dataKey={s} stroke={SCOPE_COLOR[s]} strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartFrame>
  );
}

/** Volumes differ by orders of magnitude across scopes, so one scope at a time, every volume of it. */
function VolumesChart({ data, scopes, answered }: { data: Partial<Record<PipeStatsScope, PipeStats | null>>; scopes: PipeStatsScope[]; answered: boolean }) {
  const [picked, setPicked] = useState<PipeStatsScope>("fleet");
  const scope = scopes.includes(picked) ? picked : "fleet";
  const s = data[scope] ?? null;
  const rows = (s?.history ?? []).map((p) => ({ t: Date.parse(`${p.date}T00:00:00Z`), date: p.date, ...p.volumes }));
  const names = Object.fromEntries((s?.volumes ?? []).map((v) => [v.key, v.label]));
  return (
    <ChartFrame
      title="Volumes over time"
      right={<ScopeSwitch scopes={scopes} scope={scope} onPick={setPicked} />}
    >
      {!answered ? (
        <Shimmer className="h-full w-full rounded-[8px]" />
      ) : rows.length === 0 ? (
        <EmptyNote>Nothing handled yet.</EmptyNote>
      ) : null}
      {answered && rows.length > 0 && (
        <div className="flex h-full flex-col">
          <div className="k-fg2 mb-2 flex flex-wrap gap-4 text-[12px]">
            {(s?.volumes ?? []).map((v) => (
              <span key={v.key} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: ROLE_COLOR[v.role] ?? "var(--fg-3)" }} />
                {v.label}
              </span>
            ))}
          </div>
          <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tick={AXIS} tickLine={false} axisLine={false} minTickGap={40} tickFormatter={day} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} tickCount={4} tickFormatter={(v: number) => v.toLocaleString("en-US")} />
            <Tooltip cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }} content={<ScopeTooltip names={names} format={(v) => v.toLocaleString("en-US")} />} />
            {(s?.volumes ?? []).map((v) => (
              <Line key={v.key} type="stepAfter" dataKey={v.key} stroke={ROLE_COLOR[v.role] ?? "var(--fg-3)"} strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
          </div>
        </div>
      )}
    </ChartFrame>
  );
}

/**
 * The client's team is always on (owner 2026-10-12: "il faut toujours comparer YOUR TEAM alone avec
 * YOUR TEAM et this PIPE being ON, pour voir l'impact relatif de cette pipe"). Served by
 * features-service on every platform pipe whose step a client team also works; the columns are the
 * pipe's own steps. One scope at a time, then both rates over time.
 */
function TeamImpactSection({ data, scopes }: { data: Partial<Record<PipeStatsScope, PipeStats | null>>; scopes: PipeStatsScope[] }) {
  const served = scopes.filter((x) => data[x]?.teamImpact);
  const [picked, setPicked] = useState<PipeStatsScope>("brand");
  const scope = served.includes(picked) ? picked : served[0];
  const t = data[scope]?.teamImpact as TeamImpact;
  const words = impactWords(t.impact);
  const toLower = t.toStepLabel.toLowerCase();
  const points = t.history
    .map((h) => ({ t: Date.parse(`${h.date}T00:00:00Z`), alone: h.teamAlone.ratePct, plus: h.teamPlusPipe.ratePct }))
    .filter((p) => p.alone != null || p.plus != null);
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle right={<ScopeSwitch scopes={served} scope={scope} onPick={setPicked} />}>Impact of this pipe on the client&apos;s team</SectionTitle>
        <div className="k-card overflow-hidden">
          {!t.available ? (
            <EmptyNote>{teamReasonWords(t.unavailableReason)}</EmptyNote>
          ) : (
            <div className="k-scroll overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="k-line-subtle border-b">
                    <th className={TH} />
                    <th className={TH}>{t.fromStepLabel ?? "Start"}</th>
                    <th className={TH}>{t.toStepLabel}</th>
                    <th className={TH}>Rate</th>
                    <th className={TH}>Cost per {toLower}</th>
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((r) => (
                    <tr key={r.key} className="k-line-subtle border-b">
                      <td className={`${TD} ${r.key === "team_plus_pipe" ? "font-medium" : "k-fg2"}`}>{r.label}</td>
                      <td className={TD}>{r.fromCount == null ? <span className="k-fg4">—</span> : r.fromCount.toLocaleString("en-US")}</td>
                      <td className={TD}>{r.toCount == null ? <span className="k-fg4">—</span> : r.toCount.toLocaleString("en-US")}</td>
                      <td className={TD}>
                        {r.ratePct == null ? <span className="k-fg3 text-[12px]">{teamReasonWords(r.rateUnavailableReason)}</span> : formatRatePct(r.ratePct)}
                      </td>
                      <td className={TD}>
                        {r.costPerOutcomeUsd == null ? (
                          <span className="k-fg3 text-[12px]">{teamReasonWords(r.costPerOutcomeUnavailableReason)}</span>
                        ) : (
                          formatUsdAdaptive(r.costPerOutcomeUsd)
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td className={`${TD} font-medium`}>Impact of this pipe</td>
                    <td className={TD} />
                    <td className={TD} />
                    <td className={TD}>
                      {words.points ? (
                        <span className={`font-medium ${(t.impact.pointsDiff ?? 0) > 0 ? "text-[var(--run)]" : ""}`}>
                          {words.points}
                          {words.ratio && <span className="k-fg3 ml-1.5 text-[12px] font-normal">{words.ratio}</span>}
                        </span>
                      ) : (
                        <span className="k-fg3 text-[12px]">{teamReasonWords(t.impact.pointsDiffUnavailableReason)}</span>
                      )}
                    </td>
                    <td className={TD} />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          <p className="k-fg3 k-line-subtle border-t px-4 py-2.5 text-[12px]">
            People our campaigns brought to {(t.fromStepLabel ?? "the first step").toLowerCase()}. Their team is always on; this pipe works on top of it.
          </p>
        </div>
      </div>
      {t.available && t.periods && <TeamImpactPeriods t={t} periods={t.periods} scope={scope} />}
      {t.available && (
        <ChartFrame title="Team alone vs team + this pipe over time" right={<span className="k-fg3 text-[12px]">{PIPE_STATS_SCOPE_LABELS[scope]}</span>}>
          {points.length === 0 ? (
            <EmptyNote>No history yet.</EmptyNote>
          ) : (
            <div className="flex h-full flex-col">
              <div className="k-fg2 mb-2 flex flex-wrap gap-4 text-[12px]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: "var(--fg-3)" }} />
                  {t.rows[0]?.label}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: "var(--accent)" }} />
                  {t.rows[1]?.label}
                </span>
              </div>
              <div className="min-h-0 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tick={AXIS} tickLine={false} axisLine={false} minTickGap={40} tickFormatter={day} />
                    <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: number) => formatRatePct(v)} />
                    <Tooltip
                      cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }}
                      content={<ScopeTooltip names={{ alone: t.rows[0]?.label ?? "", plus: t.rows[1]?.label ?? "" }} format={formatRatePct} />}
                    />
                    <Line type="stepAfter" dataKey="alone" stroke="var(--fg-3)" strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
                    <Line type="stepAfter" dataKey="plus" stroke="var(--accent)" strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </ChartFrame>
      )}
    </div>
  );
}

/** A served rate with the two counts it is made of ("20%  2 of 10"). */
function RateCell({ rate }: { rate: PipeStatsRate }) {
  if (rate.ratePct == null) return <span className="k-fg3 text-[12px]">{unavailableWords(rate.unavailableReason)}</span>;
  return (
    <span className="whitespace-nowrap">
      {formatRatePct(rate.ratePct)}
      {rate.numerator != null && rate.denominator != null && (
        <span className="k-fg3 ml-1.5 text-[12px]">
          {rate.numerator.toLocaleString("en-US")} of {rate.denominator.toLocaleString("en-US")}
        </span>
      )}
    </span>
  );
}

/**
 * Every pipe on the same leg, side by side (owner 2026-10-12: "comment compare ce channel versus
 * d'autres channels du même leg, comme done by their team"): our AI, an agency, the customer's own
 * team (its figures read from the brand's own tools by crm-service). One served end-to-end rate per
 * pipe and scope; a team whose tools do not record a step says so, never 0.
 */
export function SameLegSection({
  pipeId,
  legKey,
  brandId,
  hrefOf,
}: {
  pipeId: string;
  legKey: string;
  brandId: string;
  hrefOf: (pipeId: string) => string;
}) {
  const list = useStaffCatalogueList("pipes", { legKeys: legKey, limit: "25" });
  const rows = list.data?.rows ?? [];
  return (
    <section>
      <SectionTitle count={list.data ? rows.length : null} right={<span>Same step, since inception</span>}>
        Who else works this step
      </SectionTitle>
      <div className="k-card overflow-hidden">
        <div className="k-scroll overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="k-line-subtle border-b">
                <th className={TH}>Pipe</th>
                <th className={TH}>All clients</th>
                <th className={TH}>This brand</th>
              </tr>
            </thead>
            <tbody>
              {!list.data && !list.isFetchedAfterMount ? (
                <tr>
                  <td className={TD} colSpan={3}>
                    <Shimmer className="h-4 w-40" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className={`${TD} k-fg3`} colSpan={3}>
                    {list.isError ? "Could not read the pipes on this step." : "No other pipe works this step."}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <SameLegRow
                    key={r.id}
                    id={r.id}
                    name={r.name}
                    line={r.line}
                    current={r.id === pipeId}
                    brandId={brandId}
                    href={hrefOf(r.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="k-fg3 k-line-subtle border-t px-4 py-2.5 text-[12px]">
          A client team is read from their tools, on the replies we brought that our AI did not take, and on their own leads we never contacted.
        </p>
      </div>
    </section>
  );
}

function SameLegRow({
  id,
  name,
  line,
  current,
  brandId,
  href,
}: {
  id: string;
  name: string;
  line: string;
  current: boolean;
  brandId: string;
  href: string;
}) {
  const fleet = usePipeStats(id, "fleet", brandId, null);
  const brand = usePipeStats(id, "brand", brandId, null);
  return (
    <tr className="k-line-subtle border-b last:border-b-0">
      <td className={TD}>
        <div className="min-w-0">
          {current ? <span className="font-medium">{name}</span> : <Link href={href} className="font-medium hover:underline">{name}</Link>}
          {current && <span className="k-chip ml-2">This pipe</span>}
          <p className="k-fg3 truncate text-[12px]">{line}</p>
        </div>
      </td>
      {[fleet, brand].map((r, i) => (
        <td key={i} className={TD}>
          {r.data ? <SameLegCell stats={r.data} /> : r.failed && r.answered ? <span className="k-fg4">—</span> : <Shimmer className="ml-auto h-4 w-12" />}
        </td>
      ))}
    </tr>
  );
}

/**
 * A client team reads two populations (owner 2026-10-12): the replies OUR campaigns brought that our
 * AI did not take (the fair comparison, first), then the people we never contacted.
 */
function SameLegCell({ stats }: { stats: PipeStats }) {
  const onOurs = teamOnOurLeadsRate(stats);
  const own =
    stats.teamSource && !stats.teamSource.available ? (
      <span className="k-fg3 text-[12px]">{teamReasonWords(stats.teamSource.unavailableReason)}</span>
    ) : endToEndRate(stats) ? (
      <RateCell rate={endToEndRate(stats) as PipeStatsRate} />
    ) : (
      <span className="k-fg4">—</span>
    );
  if (!stats.teamSource) return own;
  return (
    <div className="space-y-1">
      <div>
        {onOurs ? <RateCell rate={onOurs} /> : <span className="k-fg3 text-[12px]">{teamReasonWords(stats.ourLeadsToTeam?.unavailableReason)}</span>}
        <p className="k-fg3 text-[11px]">team alone, on replies we brought</p>
      </div>
      <div>
        {own}
        <p className="k-fg3 text-[11px]">on their own leads</p>
      </div>
    </div>
  );
}

/** The pipe's served conversion rates over time (cumulative, percent), one scope at a time like the volumes. */
function ConversionChart({ data, scopes, answered }: { data: Partial<Record<PipeStatsScope, PipeStats | null>>; scopes: PipeStatsScope[]; answered: boolean }) {
  const [picked, setPicked] = useState<PipeStatsScope>("fleet");
  const scope = scopes.includes(picked) ? picked : "fleet";
  const s = data[scope] ?? null;
  const rates = s?.conversionRates ?? [];
  const rows = (s?.history ?? []).map((p) => ({ t: Date.parse(`${p.date}T00:00:00Z`), date: p.date, ...(p.conversionRates ?? {}) }));
  const names = Object.fromEntries(rates.map((r) => [r.key, r.label]));
  const colorOf = (i: number) => RATE_COLORS[i % RATE_COLORS.length];
  return (
    <ChartFrame title="Conversion over time" right={<ScopeSwitch scopes={scopes} scope={scope} onPick={setPicked} />}>
      {!answered ? (
        <Shimmer className="h-full w-full rounded-[8px]" />
      ) : rows.length === 0 || rates.length === 0 ? (
        <EmptyNote>No conversion to show yet.</EmptyNote>
      ) : (
        <div className="flex h-full flex-col">
          <div className="k-fg2 mb-2 flex flex-wrap gap-4 text-[12px]">
            {rates.map((r, i) => (
              <span key={r.key} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: colorOf(i) }} />
                {r.label}
              </span>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tick={AXIS} tickLine={false} axisLine={false} minTickGap={40} tickFormatter={day} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: number) => formatRatePct(v)} />
                <Tooltip cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }} content={<ScopeTooltip names={names} format={formatRatePct} />} />
                {rates.map((r, i) => (
                  <Line key={r.key} type="stepAfter" dataKey={r.key} stroke={colorOf(i)} strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </ChartFrame>
  );
}

const RATE_COLORS = ["var(--data-sky)", "var(--data-violet)", "var(--data-amber)", "var(--data-lime)", "var(--data-rose)"];

function ScopeSwitch({ scopes, scope, onPick }: { scopes: PipeStatsScope[]; scope: PipeStatsScope; onPick: (s: PipeStatsScope) => void }) {
  return (
    <span className="inline-flex gap-1">
      {scopes.map((x) => (
        <button key={x} type="button" onClick={() => onPick(x)} className={`k-btn-ghost ${x === scope ? "k-selected" : ""}`}>
          {PIPE_STATS_SCOPE_LABELS[x]}
        </button>
      ))}
    </span>
  );
}

function ScopeTooltip({
  active,
  payload,
  label,
  names,
  format,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: unknown; value?: unknown; color?: string }>;
  label?: unknown;
  names: Record<string, string>;
  format: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="k-popover px-2.5 py-1.5 text-[12px]">
      <p className="k-fg3 k-mono">{new Date(Number(label)).toISOString().slice(0, 10)}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-1.5 tabular-nums">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="k-fg2">{names[String(p.dataKey)] ?? String(p.dataKey)}</span>
          <span className="ml-auto pl-3 font-medium">{format(Number(p.value))}</span>
        </p>
      ))}
    </div>
  );
}

/** A missing value: the served reason on hover, never a 0. */
function Dash({ reason }: { reason?: string | null }) {
  return (
    <span className="k-fg4" title={reason ? teamReasonWords(reason) : undefined}>
      —
    </span>
  );
}

const count = (v: number | null | undefined) => (v == null ? <Dash /> : v.toLocaleString("en-US"));
const rate = (v: number | null | undefined, reason?: string | null) => (v == null ? <Dash reason={reason} /> : formatRatePct(v));
const usd = (v: number | null | undefined) => (v == null ? <Dash /> : formatUsdAdaptive(v));

function GrainSwitch({ grain, onPick }: { grain: PeriodGrain; onPick: (g: PeriodGrain) => void }) {
  return (
    <span className="inline-flex gap-1">
      {(["quarters", "months"] as const).map((g) => (
        <button key={g} type="button" onClick={() => onPick(g)} className={`k-btn-ghost ${g === grain ? "k-selected" : ""}`}>
          {g === "quarters" ? "Quarters" : "Months"}
        </button>
      ))}
    </span>
  );
}

/** The "Since …" row reads as the table's headline; each period row counts its own period only. */
function PeriodTr({ row, children }: { row: PipePeriodRow; children: React.ReactNode }) {
  const total = row.kind === "since_inception";
  return (
    <tr className={`k-line-subtle border-b last:border-b-0 ${total ? "font-medium" : ""}`}>
      <td className={`${TD} whitespace-nowrap ${total ? "" : "k-fg2"}`}>{row.label}</td>
      {children}
    </tr>
  );
}

/**
 * The pipe's figures per calendar period (owner 2026-10-12: Doc Dinners' "Since Dec 2024, Q1 2026, …,
 * Oct 2026" table, "pour les stats de ce pipe, pas de leur équipe"). Columns are the pipe's own volumes
 * and rates; money only when the pipe spends ours. Every cell is served (features-service PIPE-PERIODS-1012).
 */
function PeriodsSection({ data, scopes }: { data: Partial<Record<PipeStatsScope, PipeStats | null>>; scopes: PipeStatsScope[] }) {
  const served = scopes.filter((x) => data[x]?.periods);
  const [picked, setPicked] = useState<PipeStatsScope>("brand");
  const [grain, setGrain] = useState<PeriodGrain>("quarters");
  const scope = served.includes(picked) ? picked : served[0];
  const s = data[scope] as PipeStats;
  const periods = s.periods as PipePeriods;
  const money = periodsHaveSpend(periods);
  const outcome = outcomeVolume(s)?.label.toLowerCase() ?? "outcome";
  const rates = s.conversionRates ?? [];
  return (
    <div>
      <SectionTitle
        right={
          <span className="inline-flex items-center gap-3">
            <GrainSwitch grain={grain} onPick={setGrain} />
            <ScopeSwitch scopes={served} scope={scope} onPick={setPicked} />
          </span>
        }
      >
        By period
      </SectionTitle>
      <div className="k-card overflow-hidden">
        <div className="k-scroll overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="k-line-subtle border-b align-bottom">
                <th className={TH}>Period</th>
                {s.volumes.map((v) => (
                  <th key={v.key} className={TH}>
                    {v.label}
                  </th>
                ))}
                {rates.map((r) => (
                  <th key={r.key} className={TH}>
                    {rates.length === 1 ? "Rate" : r.label}
                  </th>
                ))}
                {money && <th className={TH}>Spent</th>}
                {money && <th className={TH}>Cost per {outcome}</th>}
              </tr>
            </thead>
            <tbody>
              {periodRows(periods, grain).map((row) => (
                <PeriodTr key={row.period} row={row}>
                  {s.volumes.map((v) => (
                    <td key={v.key} className={TD}>
                      {count(row.counts[v.key])}
                    </td>
                  ))}
                  {rates.map((r) => (
                    <td key={r.key} className={TD}>
                      {rate(row.ratesPct[r.key], row.rateUnavailableReasons?.[r.key])}
                    </td>
                  ))}
                  {money && <td className={TD}>{usd(row.spendUsd)}</td>}
                  {money && <td className={TD}>{usd(row.costPerOutcomeUsd)}</td>}
                </PeriodTr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="k-fg3 k-line-subtle border-t px-4 py-2.5 text-[12px]">
          {PIPE_STATS_SCOPE_LABELS[scope]}. Each row counts the people who entered the pipe in that period, not a running total.
          {rates.length === 1 ? ` Rate: ${rates[0].label}.` : ""}
        </p>
      </div>
    </div>
  );
}

/** Team alone vs team + this pipe, per period, with the pipe's impact in points (all served). */
function TeamImpactPeriods({ t, periods, scope }: { t: TeamImpact; periods: PipePeriods; scope: PipeStatsScope }) {
  const [grain, setGrain] = useState<PeriodGrain>("quarters");
  const money = periodsHaveSpend(periods);
  const from = t.fromStepLabel ?? "Start";
  const sides = [
    { label: t.rows[0]?.label ?? "Team alone", from: "teamAloneFrom", to: "teamAloneTo", rate: "teamAlone" },
    { label: t.rows[1]?.label ?? "Team + this pipe", from: "teamPlusPipeFrom", to: "teamPlusPipeTo", rate: "teamPlusPipe" },
  ];
  const sub = "k-label px-3 pb-2.5 text-right font-medium";
  return (
    <div>
      <SectionTitle right={<GrainSwitch grain={grain} onPick={setGrain} />}>Impact by period</SectionTitle>
      <div className="k-card overflow-hidden">
        <div className="k-scroll overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr>
                <th className={TH} />
                {sides.map((x) => (
                  <th key={x.rate} colSpan={3} className={`${TH} !text-center normal-case`}>
                    {x.label}
                  </th>
                ))}
                <th className={TH} />
                {money && <th className={TH} colSpan={2} />}
              </tr>
              <tr className="k-line-subtle border-b align-bottom">
                <th className="k-label pb-2.5 pl-4 pr-3 text-left font-medium">Period</th>
                {sides.map((x) => (
                  <ImpactSubHeads key={x.rate} cls={sub} from={from} to={t.toStepLabel} />
                ))}
                <th className={sub}>Impact</th>
                {money && <th className={sub}>Spent</th>}
                {money && <th className="k-label pb-2.5 pl-3 pr-4 text-right font-medium">Cost per {t.toStepLabel.toLowerCase()}</th>}
              </tr>
            </thead>
            <tbody>
              {periodRows(periods, grain).map((row) => {
                const pts = periods.impactPointsDiff?.[row.period] ?? null;
                return (
                  <PeriodTr key={row.period} row={row}>
                    {sides.map((x) => (
                      <ImpactCells key={x.rate} row={row} side={x} />
                    ))}
                    <td className={TD}>
                      {pts == null ? <Dash /> : <span className={pts > 0 ? "text-[var(--run)]" : ""}>{`${pts > 0 ? "+" : ""}${pts.toFixed(1).replace(/\.0$/, "")} pts`}</span>}
                    </td>
                    {money && <td className={TD}>{usd(row.spendUsd)}</td>}
                    {money && <td className={TD}>{usd(row.costPerOutcomeUsd)}</td>}
                  </PeriodTr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="k-fg3 k-line-subtle border-t px-4 py-2.5 text-[12px]">
          {PIPE_STATS_SCOPE_LABELS[scope]}. Each row counts its own period, not a running total.
        </p>
      </div>
    </div>
  );
}

function ImpactSubHeads({ cls, from, to }: { cls: string; from: string; to: string }) {
  return (
    <>
      <th className={cls}>{from}</th>
      <th className={cls}>{to}</th>
      <th className={cls}>Rate</th>
    </>
  );
}

function ImpactCells({ row, side }: { row: PipePeriodRow; side: { from: string; to: string; rate: string } }) {
  return (
    <>
      <td className={TD}>{count(row.counts[side.from])}</td>
      <td className={TD}>{count(row.counts[side.to])}</td>
      <td className={TD}>{rate(row.ratesPct[side.rate], row.rateUnavailableReasons?.[side.rate])}</td>
    </>
  );
}
