"use client";

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getStaffBrands, getStaffFactoryShadowMonitoring } from "@/lib/api";
import type { StaffBrand } from "@/lib/monitoring/monitoring";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { PeriodBars, SERIES_COLORS, dayLabel } from "@/components/v2/monitoring-charts";
import { Failed, Loading, OK, RED } from "@/components/v2/monitoring-sending";
import {
  changingCampaigns,
  failedCampaigns,
  unavailableWords,
  verdictReasonWords,
  type FactoryShadowMonitoring,
} from "@/lib/factory-shadow";

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
  const red = data.verdict.red;
  return (
    <div className="k-card flex items-start gap-3 px-4 py-3">
      <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: red ? RED : OK }} aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[14px] font-medium" style={red ? { color: RED } : undefined}>
          {red ? `Red: ${data.verdict.reasons.map(verdictReasonWords).join("; ")}.` : "Every live campaign was judged and planned on the last pass."}
        </p>
        <p className="k-fg3 mt-0.5 text-[12px]">
          {data.lastPass
            ? `Last pass ${utcTime(data.lastPass.sweptAt)} UTC over ${data.lastPass.campaigns} live campaigns, every ${data.everyHours} h.`
            : "No pass has run yet."}{" "}
          Shadow only: nothing runs from it.
        </p>
      </div>
    </div>
  );
}

export function FactoryShadowView({ data }: { data: FactoryShadowMonitoring }) {
  const names = useClientNames();
  // One bar segment per client, in the producer's order of first appearance (no sort).
  const orgIds = useMemo(() => {
    const seen = new Set<string>();
    for (const d of data.series) for (const o of d.orgs) seen.add(o.orgId);
    return [...seen];
  }, [data.series]);
  const periods = data.series.map((d) => ({ ...d, period: d.day }));
  const orgSeries = (pick: "differs" | "judgeFailed" | "planFailed") =>
    orgIds.map((id, i) => ({
      key: id,
      label: names.org(id),
      color: SERIES_COLORS[i % SERIES_COLORS.length],
      get: (d: (typeof periods)[number]) => d.orgs.find((o) => o.orgId === id)?.[pick] ?? 0,
    }));
  const short = (d: string, s?: boolean) => dayLabel(d, s ? { month: "short", day: "numeric" } : undefined);
  const failed = failedCampaigns(data);
  const changing = changingCampaigns(data);
  return (
    <div className="space-y-8">
      <Verdict data={data} />

      <section>
        <SectionTitle right={<span>per client, per day</span>}>Campaigns that would change</SectionTitle>
        <PeriodBars
          periods={periods}
          series={orgSeries("differs")}
          caption={(d) => `${d.differs} of ${d.campaigns} live campaigns`}
          format={(v) => v.toLocaleString("en-US")}
          label={short}
          empty={`No pass in the last ${FACTORY_DAYS} days.`}
        />
      </section>

      <section>
        <SectionTitle right={<span>per day</span>}>Judge or plan failed</SectionTitle>
        <PeriodBars
          periods={periods}
          series={[
            { key: "judge", label: "Judge failed", color: "var(--data-amber)", get: (d) => d.judgeFailed },
            { key: "plan", label: "Plan failed", color: RED, get: (d) => d.planFailed },
          ]}
          caption={(d) => `${d.campaigns} live campaigns`}
          format={(v) => v.toLocaleString("en-US")}
          label={short}
          empty={`No pass in the last ${FACTORY_DAYS} days.`}
        />
      </section>

      <section>
        <SectionTitle count={failed.length}>Failed on the last pass</SectionTitle>
        <div className="k-card overflow-hidden">
          {failed.length === 0 ? (
            <EmptyNote>None.</EmptyNote>
          ) : (
            <CampaignRows rows={failed.map((c) => ({ c, why: unavailableWords(c.failure) ?? c.status }))} names={names} red />
          )}
        </div>
      </section>

      <section>
        <SectionTitle count={changing.length}>Would change on the last pass</SectionTitle>
        <div className="k-card overflow-hidden">
          {changing.length === 0 ? (
            <EmptyNote>None.</EmptyNote>
          ) : (
            <CampaignRows
              rows={changing.map((c) => ({
                c,
                why: [c.planDiffers === true ? "another line to its Target" : null, c.pickDiffers ? "another play on a pipe" : null].filter(Boolean).join(", "),
              }))}
              names={names}
            />
          )}
        </div>
      </section>
    </div>
  );
}

function CampaignRows({
  rows,
  names,
  red = false,
}: {
  rows: { c: FactoryShadowMonitoring["campaigns"][number]; why: string }[];
  names: ReturnType<typeof useClientNames>;
  red?: boolean;
}) {
  return (
    <table className="w-full table-fixed text-[13px]">
      <thead>
        <tr className="k-line-subtle border-b">
          <th className="k-label w-[34%] px-3 py-2.5 pl-4 text-left font-medium">Campaign</th>
          <th className="k-label w-[26%] px-3 py-2.5 text-left font-medium">Client</th>
          <th className="k-label px-3 py-2.5 pr-4 text-left font-medium">{red ? "Why" : "What would change"}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ c, why }) => (
          <tr key={c.campaignId} className="k-line-subtle border-b last:border-b-0">
            <td className="truncate px-3 py-2 pl-4">{c.salesFunnelName}</td>
            <td className="k-fg2 truncate px-3 py-2">{names.brand(c.brandId)}</td>
            <td className="px-3 py-2 pr-4" style={red ? { color: RED } : undefined}>
              {why}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function FactoryShadowPage() {
  const q = useFactoryShadowMonitoring();
  if (q.isError && !q.data) return <Failed what="the factory plan" />;
  if (!q.data) return <Loading />;
  return <FactoryShadowView data={q.data} />;
}

/** The hub's one-second read: the campaigns the last pass failed on, red when the served verdict is, the reasons under it. */
export function FactoryShadowTile({ href }: { href: string }) {
  const q = useFactoryShadowMonitoring();
  const data = q.data;
  const failed = data ? failedCampaigns(data) : undefined;
  return (
    <StatTile label="Factory plan failed" note={data?.lastPass ? `of ${data.lastPass.campaigns} live` : undefined} href={href}>
      <Figure
        value={
          q.isError && !data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : !data || failed === undefined ? (
            <Shimmer className="h-6 w-16" />
          ) : (
            <span style={{ color: data.verdict.red ? RED : undefined }}>{failed.length}</span>
          )
        }
        sub={!data ? undefined : data.verdict.red ? data.verdict.reasons.map(verdictReasonWords).join(", ") : "judge and plan ran on every campaign"}
      />
    </StatTile>
  );
}
