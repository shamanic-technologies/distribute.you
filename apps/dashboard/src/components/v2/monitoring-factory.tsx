"use client";

import { Fragment, useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getStaffBrands, getStaffFactoryShadowMonitoring, getStaffPlanFollowing } from "@/lib/api";
import { planStateWords, type PlanFollowing } from "@/lib/plan-following";
import type { StaffBrand } from "@/lib/monitoring/monitoring";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { PeriodBars, SERIES_COLORS, dayLabel } from "@/components/v2/monitoring-charts";
import { Failed, Loading, OK, RED } from "@/components/v2/monitoring-sending";
import {
  changingCampaigns,
  notYetCampaigns,
  problemCampaigns,
  stateSentence,
  unavailableWords,
  verdictReasonWords,
  type FactoryChangeSide,
  type FactoryShadowMonitoring,
  type FactoryShadowMonitoringCampaign,
} from "@/lib/factory-shadow";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { formatUsdAdaptive } from "@/lib/format-number";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { stepLabel } from "@/lib/legs";
import { ServedPipeMark } from "@/components/v2/served-pipe-mark";
import { RoiLabel } from "@/components/v2/roi-label";
import { ExpectedLabel } from "@/components/v2/offer-sales-paths";

/**
 * Monitoring > Factory plan (staff only, FACTORY-P1-DASH). features-service's GTM Factory shadow pass runs every 3 hours
 * over every live funnel campaign: per client and UTC day, how many campaigns would run differently if they followed
 * their plan (the best line to their Target, the plays Jev picks from their brief), and how many the judge or the plan
 * failed on. Red = the served verdict (a judge or plan failure on the last pass, a pass older than 7 h, or none ever).
 * Red on the hub IS the alert (no email). This file draws served values in the served order; it computes no figure.
 */

export const FACTORY_DAYS = 30;

export function useFactoryShadowMonitoring() {
  return useAuthQuery(["staffFactoryShadow", FACTORY_DAYS], () => getStaffFactoryShadowMonitoring(FACTORY_DAYS), { ...pollOptions, retry: false });
}

const utcTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });

/** A client named by its brands (the staff brand list), a display lookup; an unknown org by its id's head. */
function useClientNames() {
  const brands = useAuthQuery(["staffBrands"], getStaffBrands, { staleTime: Infinity, retry: false });
  return useMemo(() => {
    const byOrg = new Map<string, StaffBrand[]>();
    const brandName = new Map<string, string>();
    for (const b of brands.data ?? []) {
      brandName.set(b.id, b.name ?? b.domain ?? b.id);
      if (b.orgId) byOrg.set(b.orgId, [...(byOrg.get(b.orgId) ?? []), b]);
    }
    return {
      org: (id: string) => {
        const bs = byOrg.get(id);
        if (!bs?.length) return `Org ${id.slice(0, 8)}`;
        const names = bs.map((b) => b.name ?? b.domain ?? b.id);
        return names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2}` : names.join(", ");
      },
      brand: (id: string) => brandName.get(id) ?? id.slice(0, 8),
    };
  }, [brands.data]);
}

function Verdict({ data }: { data: FactoryShadowMonitoring }) {
  // Red ONLY for a real problem (owner 2026-10-29: « red only if broken »): the served verdict, never re-graded.
  const red = data.verdict.red;
  const waiting = notYetCampaigns(data).length;
  return (
    <div className="k-card flex items-start gap-3 px-4 py-3">
      <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: red ? RED : OK }} aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[14px] font-medium" style={red ? { color: RED } : undefined}>
          {red
            ? `Broken: ${data.verdict.reasons.map(verdictReasonWords).join("; ")}.`
            : waiting > 0
              ? `Nothing broken. ${waiting} campaign${waiting === 1 ? " waits" : "s wait"} on a first price.`
              : "Nothing broken: every live campaign was judged and planned."}
        </p>
        <p className="k-fg3 mt-0.5 text-[12px]">
          {data.lastPass
            ? `Last pass ${utcTime(data.lastPass.sweptAt)} UTC over ${data.lastPass.campaigns} live campaigns, every ${data.everyHours} h.`
            : "No pass has run yet."}
        </p>
      </div>
    </div>
  );
}

/** A campaign line whose sentence is the served `stateDetail`: red dot for a problem, a neutral one while it waits. */
function StateRows({ rows, names, red }: { rows: FactoryShadowMonitoringCampaign[]; names: ReturnType<typeof useClientNames>; red: boolean }) {
  return (
    <table className="w-full table-fixed text-[13px]">
      <thead>
        <tr className="k-line-subtle border-b">
          <th className="k-label w-[28%] px-3 py-2.5 pl-4 text-left font-medium">Campaign</th>
          <th className="k-label w-[22%] px-3 py-2.5 text-left font-medium">Client</th>
          <th className="k-label px-3 py-2.5 pr-4 text-left font-medium">{red ? "What is broken" : "What it waits for"}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => (
          <tr key={c.campaignId} className="k-line-subtle border-b last:border-b-0">
            <td className="px-3 py-2 pl-4">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: red ? RED : "var(--fg-4)" }} aria-hidden="true" />
                <span className="truncate">{c.salesFunnelName}</span>
              </span>
            </td>
            <td className="k-fg2 truncate px-3 py-2">{names.brand(c.brandId)}</td>
            <td className="px-3 py-2 pr-4" style={red ? { color: RED } : undefined}>
              {stateSentence(c)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** One side of a change: the differing pipes as chips (served name + served pipe mark). */
function ChangePipes({ side }: { side: FactoryChangeSide }) {
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {side.pipes.map((p, i) => (
        <Fragment key={`${p.legKey}-${i}`}>
          {i > 0 && <span className="k-fg3">→</span>}
          <span className="k-chip inline-flex items-center gap-1">
            <ServedPipeMark pipeId={p.pipeId} size={12} />
            {p.name}
          </span>
        </Fragment>
      ))}
    </span>
  );
}

const usd = (v: number | null) => (v == null ? null : formatUsdAdaptive(v));

/** "$3,042 → $3,413": the whole line's served $ per Target, before then after, "expected" when the served basis says so. */
function BeforeAfter({ running, best, fmt, good }: { running: FactoryChangeSide; best: FactoryChangeSide; fmt: (s: FactoryChangeSide) => string | null; good?: (s: FactoryChangeSide) => boolean }) {
  const cell = (s: FactoryChangeSide) => {
    const v = fmt(s);
    if (v == null) return <span className="k-fg3 text-[12px]">{unavailableWords(s.unavailableReason) ?? "—"}</span>;
    return <span className={good?.(s) ? "text-[var(--run)]" : ""}>{v}</span>;
  };
  return (
    <span className="inline-flex flex-wrap items-baseline justify-end gap-x-1.5 tabular-nums">
      <span className="k-fg2">{cell(running)}</span>
      <span className="k-fg3">→</span>
      {cell(best)}
      {(running.basis === "expected" || best.basis === "expected") && <span className="k-fg3 text-[11px]">expected</span>}
    </span>
  );
}

const COST_TIP = "What one Target costs on the whole line: each pipe's own cost per outcome times the outcomes it needs per Target. Expected until every input is measured.";

function ChangeRows({ rows, names, targetLabel }: { rows: FactoryShadowMonitoringCampaign[]; names: ReturnType<typeof useClientNames>; targetLabel: (key: string | null | undefined) => string }) {
  return (
    <div className="k-scroll overflow-x-auto">
      <table className="w-full min-w-[980px] text-[13px]">
        <thead>
          <tr className="k-line-subtle border-b">
            <th className="k-label w-[220px] px-3 py-2.5 pl-4 text-left font-medium">Campaign</th>
            <th className="k-label px-3 py-2.5 text-left font-medium">Runs now → Would run</th>
            <th className="k-label w-[190px] px-3 py-2.5 text-right font-medium">
              <span className="inline-flex justify-end">
                <ExpectedLabel tip={COST_TIP}>$ / Target</ExpectedLabel>
              </span>
            </th>
            <th className="k-label w-[150px] px-3 py-2.5 pr-4 text-right font-medium">
              <span className="inline-flex justify-end">
                <RoiLabel />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const ch = c.change!;
            return (
              <tr key={c.campaignId} className="k-line-subtle border-b align-top last:border-b-0">
                <td className="px-3 py-2.5 pl-4">
                  <p className="truncate">{c.salesFunnelName}</p>
                  <p className="k-fg3 truncate text-[12px]">
                    {names.brand(c.brandId)} · to {targetLabel(c.target)}
                  </p>
                </td>
                <td className="space-y-1.5 px-3 py-2.5 text-[12px]">
                  <div className="flex items-start gap-2">
                    <span className="k-label w-[70px] shrink-0 pt-[3px]">Runs now</span>
                    <ChangePipes side={ch.running} />
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="k-label w-[70px] shrink-0 pt-[3px]">Would run</span>
                    <ChangePipes side={ch.best} />
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <BeforeAfter running={ch.running} best={ch.best} fmt={(s) => usd(s.costPerTargetUsd)} />
                </td>
                <td className="px-3 py-2.5 pr-4 text-right">
                  <BeforeAfter running={ch.running} best={ch.best} fmt={(s) => (s.roi == null ? null : formatRoi(s.roi))} good={(s) => roiIsGood(s.roi)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function FactoryShadowView({ data }: { data: FactoryShadowMonitoring }) {
  const names = useClientNames();
  const catalogue = useLegCatalogue();
  const targetLabel = (key: string | null | undefined) => stepLabel(catalogue, key) ?? key ?? "its Target";
  // One bar segment per client, in the producer's order of first appearance (no sort).
  const orgIds = useMemo(() => {
    const seen = new Set<string>();
    for (const d of data.series) for (const o of d.orgs) seen.add(o.orgId);
    return [...seen];
  }, [data.series]);
  const periods = data.series.map((d) => ({ ...d, period: d.day }));
  const short = (d: string, s?: boolean) => dayLabel(d, s ? { month: "short", day: "numeric" } : undefined);
  const problems = problemCampaigns(data);
  const notYet = notYetCampaigns(data);
  const changing = changingCampaigns(data);
  return (
    <div className="space-y-8">
      <Verdict data={data} />

      {/* Real problems first, red; then what only waits, in normal colours (owner 2026-10-29). */}
      <section>
        <SectionTitle count={problems.length}>Broken</SectionTitle>
        <div className="k-card overflow-hidden">
          {problems.length === 0 ? <EmptyNote>Nothing broken on the last pass.</EmptyNote> : <StateRows rows={problems} names={names} red />}
        </div>
      </section>

      {notYet.length > 0 && (
        <section>
          <SectionTitle count={notYet.length}>Waiting on a first price</SectionTitle>
          <div className="k-card overflow-hidden">
            <StateRows rows={notYet} names={names} red={false} />
          </div>
        </section>
      )}

      <section>
        <SectionTitle count={changing.length}>What would change</SectionTitle>
        <div className="k-card overflow-hidden">
          {changing.length === 0 ? <EmptyNote>Every live campaign already runs its best line.</EmptyNote> : <ChangeRows rows={changing} names={names} targetLabel={targetLabel} />}
        </div>
      </section>

      <section>
        <SectionTitle right={<span>per client, per day</span>}>Campaigns that would change</SectionTitle>
        <PeriodBars
          periods={periods}
          series={orgIds.map((id, i) => ({
            key: id,
            label: names.org(id),
            color: SERIES_COLORS[i % SERIES_COLORS.length],
            get: (d: (typeof periods)[number]) => d.orgs.find((o) => o.orgId === id)?.differs ?? 0,
          }))}
          caption={(d) => `${d.differs} of ${d.campaigns} live campaigns`}
          format={(v) => v.toLocaleString("en-US")}
          label={short}
          empty={`No pass in the last ${FACTORY_DAYS} days.`}
        />
      </section>

      <section>
        <SectionTitle right={<span>per day</span>}>Broken or waiting</SectionTitle>
        <PeriodBars
          periods={periods}
          series={[
            { key: "judge", label: "Judge failed", color: "var(--data-amber)", get: (d) => d.judgeFailed },
            { key: "plan", label: "Plan broken", color: RED, get: (d) => d.planFailed },
            { key: "notYet", label: "Waiting on a first price", color: "var(--fg-4)", get: (d) => d.notYet ?? 0 },
          ]}
          caption={(d) => `${d.campaigns} live campaigns`}
          format={(v) => v.toLocaleString("en-US")}
          label={short}
          empty={`No pass in the last ${FACTORY_DAYS} days.`}
        />
      </section>
    </div>
  );
}

export function FactoryShadowPage() {
  const q = useFactoryShadowMonitoring();
  if (q.isError && !q.data) return <Failed what="the factory plan" />;
  if (!q.data) return <Loading />;
  return <FactoryShadowView data={q.data} />;
}

/** The hub's one-second read: the campaigns broken on the last pass, red ONLY when the served verdict is. */
export function FactoryShadowTile({ href }: { href: string }) {
  const q = useFactoryShadowMonitoring();
  const data = q.data;
  const problems = data ? problemCampaigns(data) : undefined;
  return (
    <StatTile label="Factory plan broken" note={data?.lastPass ? `of ${data.lastPass.campaigns} live` : undefined} href={href}>
      <Figure
        value={
          q.isError && !data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : !data || problems === undefined ? (
            <Shimmer className="h-6 w-16" />
          ) : (
            <span style={{ color: data.verdict.red ? RED : undefined }}>{problems.length}</span>
          )
        }
        sub={!data ? undefined : data.verdict.red ? data.verdict.reasons.map(verdictReasonWords).join(", ") : "nothing broken"}
      />
    </StatTile>
  );
}

// ─── Following its plan (campaign-service #808, FACTORY-P1-PLAN-FOLLOWING-DASH) ───

export function usePlanFollowing() {
  return useAuthQuery(["staffPlanFollowing", FACTORY_DAYS], () => getStaffPlanFollowing(FACTORY_DAYS), { ...pollOptions, retry: false });
}

/**
 * Campaigns switched to follow their plan: how many each day, how many were red, how many plan changes were applied,
 * then each red campaign with its served state in plain words. Red = the served status (a red state, or the follower
 * silent for 30 min). No sort, no sum.
 */
export function PlanFollowingView({ data }: { data: PlanFollowing }) {
  const names = useClientNames();
  const red = data.status === "red";
  const periods = data.byDay.map((d) => ({ ...d, period: d.day }));
  const short = (d: string, s?: boolean) => dayLabel(d, s ? { month: "short", day: "numeric" } : undefined);
  return (
    <div className="space-y-8">
      <div className="k-card flex items-start gap-3 px-4 py-3">
        <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: red ? RED : OK }} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[14px] font-medium" style={red ? { color: RED } : undefined}>
            {red
              ? data.staleReason ?? `${data.red.length} campaign${data.red.length === 1 ? "" : "s"} cannot follow ${data.red.length === 1 ? "its" : "their"} plan.`
              : data.following === 0
                ? "No campaign follows its plan yet."
                : `${data.following} campaign${data.following === 1 ? " follows its" : "s follow their"} plan, none in trouble.`}
          </p>
          <p className="k-fg3 mt-0.5 text-[12px]">Checked every 10 minutes. A campaign that cannot apply its plan keeps running what it ran.</p>
        </div>
      </div>

      <section>
        <SectionTitle count={data.red.length}>Cannot follow its plan</SectionTitle>
        <div className="k-card overflow-hidden">
          {data.red.length === 0 ? (
            <EmptyNote>None.</EmptyNote>
          ) : (
            <table className="w-full table-fixed text-[13px]">
              <thead>
                <tr className="k-line-subtle border-b">
                  <th className="k-label w-[28%] px-3 py-2.5 pl-4 text-left font-medium">Campaign</th>
                  <th className="k-label w-[20%] px-3 py-2.5 text-left font-medium">Client</th>
                  <th className="k-label px-3 py-2.5 text-left font-medium">Why</th>
                  <th className="k-label w-[130px] px-3 py-2.5 pr-4 text-right font-medium">Checked</th>
                </tr>
              </thead>
              <tbody>
                {data.red.map((c) => (
                  <tr key={c.salesFunnelCampaignId} className="k-line-subtle border-b last:border-b-0">
                    <td className="truncate px-3 py-2 pl-4">{c.salesFunnelName}</td>
                    <td className="k-fg2 truncate px-3 py-2">{names.brand(c.brandId)}</td>
                    <td className="px-3 py-2" title={c.detail}>
                      <span style={{ color: RED }}>{planStateWords(c.state).words}</span>
                      {c.detail && <span className="k-fg3 block truncate text-[12px]">{c.detail}</span>}
                    </td>
                    <td className="k-mono k-fg2 px-3 py-2 pr-4 text-right text-[12px]">{utcTime(c.checkedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section>
        <SectionTitle right={<span>per day</span>}>Following its plan</SectionTitle>
        <PeriodBars
          periods={periods}
          grouped
          series={[
            { key: "following", label: "Following", color: "var(--data-violet)", get: (d) => d.following },
            { key: "red", label: "Red", color: RED, get: (d) => d.red },
            { key: "changes", label: "Plan changes applied", color: "var(--data-teal)", get: (d) => d.changesApplied },
          ]}
          caption={(d) => `checked ${utcTime(d.checkedAt)} UTC`}
          format={(v) => v.toLocaleString("en-US")}
          label={short}
          empty={`No campaign followed its plan in the last ${FACTORY_DAYS} days.`}
        />
      </section>
    </div>
  );
}

export function PlanFollowingPage() {
  const q = usePlanFollowing();
  if (q.isError && !q.data) return <Failed what="the campaigns following their plan" />;
  if (!q.data) return <Loading />;
  return <PlanFollowingView data={q.data} />;
}

/** The hub's one-second read: campaigns that cannot follow their plan, red on the served status. */
export function PlanFollowingTile({ href }: { href: string }) {
  const q = usePlanFollowing();
  const data = q.data;
  return (
    <StatTile label="Plan not followed" note={data ? `of ${data.following} following` : undefined} href={href}>
      <Figure
        value={
          q.isError && !data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : !data ? (
            <Shimmer className="h-6 w-16" />
          ) : (
            <span style={{ color: data.status === "red" ? RED : undefined }}>{data.red.length}</span>
          )
        }
        sub={!data ? undefined : data.staleReason ?? (data.red.length ? data.red.map((c) => c.salesFunnelName).join(", ") : "every switched campaign runs its plan")}
      />
    </StatTile>
  );
}
