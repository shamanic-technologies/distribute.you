"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getStaffSecurityAdvisories } from "@/lib/api";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { PeriodBars, dayLabel, n } from "@/components/v2/monitoring-charts";
import { Dash, Failed, Loading, OK, RED, TD, TDR, TH, THR, Table, shortDay } from "@/components/v2/monitoring-sending";
import { statusWord, type AdvisoryPointStatus, type FleetDayPoint, type RepoDayPoint, type SecurityAdvisories, type SecurityRepo } from "@/lib/monitoring/security-advisories";

/**
 * Monitoring > Security > Advisories (staff only, SEC-ADVISORIES-MONITORING-1025). A daily audit job checks every
 * repo running in prod for open npm/pnpm advisories and stores the report in features-service, which serves the
 * verdict, its reason, the fleet totals per day and each repo red first. Red on the hub IS the alert (no email).
 * This file draws the served order, verdicts and counts; it computes no figure. A day with no report is a gap.
 */

export const SECURITY_DAYS = 30;
const AMBER = "var(--data-amber)";
const MUTED = "var(--fg-4)";

export function useSecurityAdvisories() {
  return useAuthQuery(["staffSecurityAdvisories", SECURITY_DAYS], () => getStaffSecurityAdvisories(SECURITY_DAYS), { ...pollOptions, retry: false });
}

const STATUS_COLOR: Record<AdvisoryPointStatus, string> = { red: RED, green: OK, missing: MUTED };

const plural = (v: number, w: string) => `${n(v)} ${w}${v === 1 ? "" : "s"}`;

/** A served count, or a dash when the audit gave none. */
function Count({ v, red = false }: { v: number | null | undefined; red?: boolean }) {
  if (v == null) return <Dash />;
  return <span style={{ color: red && v > 0 ? RED : undefined }}>{n(v)}</span>;
}

function StatusCell({ status }: { status: AdvisoryPointStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[status] }} aria-hidden="true" />
      <span style={{ color: status === "red" ? RED : undefined }}>{statusWord(status)}</span>
    </span>
  );
}

function pointTitle(p: RepoDayPoint): string {
  if (p.status === "missing") return `${shortDay(p.day)}: no report`;
  if (p.error) return `${shortDay(p.day)}: audit could not run (${p.error})`;
  const parts = [`${shortDay(p.day)}: ${p.critical ?? "—"} critical, ${p.high ?? "—"} high, ${p.moderate ?? "—"} moderate, ${p.low ?? "—"} low`];
  if (p.packages.length) parts.push(p.packages.join(", "));
  return parts.join("\n");
}

/** One cell per day of the window, oldest left: red, green, or a flat track where no report arrived. */
function DayStrip({ series }: { series: RepoDayPoint[] }) {
  return (
    <div className="flex h-5 items-end gap-[2px]" role="img" aria-label={`${series.filter((p) => p.status === "red").length} red days`}>
      {series.map((p) => (
        <span
          key={p.day}
          title={pointTitle(p)}
          className="w-[5px] rounded-[1px]"
          style={p.status === "missing" ? { height: 3, background: "var(--data-track)" } : { height: 20, background: STATUS_COLOR[p.status] }}
        />
      ))}
    </div>
  );
}

/** The first packages, then "+N more" with the full list on hover. */
function Packages({ list }: { list: string[] }) {
  if (!list.length) return <Dash />;
  const shown = list.slice(0, 3);
  return (
    <span className="k-mono text-[12px]" title={list.join(", ")}>
      {shown.join(", ")}
      {list.length > shown.length && <span className="k-fg3"> +{list.length - shown.length} more</span>}
    </span>
  );
}

function ReposTable({ repos }: { repos: SecurityRepo[] }) {
  return (
    <Table
      head={
        <>
          <th className={TH}>Repo</th>
          <th className={TH}>Status</th>
          <th className={THR}>Critical</th>
          <th className={THR}>High</th>
          <th className={THR}>Moderate</th>
          <th className={THR}>Low</th>
          <th className={TH}>Packages</th>
          <th className={TH}>Last {SECURITY_DAYS} days</th>
        </>
      }
    >
      {repos.map((r) => (
        <tr key={r.repo} className="k-row align-top">
          <td className={TD}>
            <span className="k-mono whitespace-nowrap text-[13px]">{r.repo}</span>
            {!r.inLatestReport && <p className="k-fg3 mt-0.5 text-[12px]">not in the latest report</p>}
            {r.latest?.error && (
              <p className="mt-0.5 line-clamp-2 max-w-[320px] text-[12px]" style={{ color: RED }} title={r.latest.error}>
                Audit could not run: {r.latest.error}
              </p>
            )}
          </td>
          <td className={TD}>
            <StatusCell status={r.status} />
          </td>
          <td className={TDR}>
            <Count v={r.latest?.critical} red />
          </td>
          <td className={TDR}>
            <Count v={r.latest?.high} red />
          </td>
          <td className={TDR}>
            <Count v={r.latest?.moderate} />
          </td>
          <td className={TDR}>
            <Count v={r.latest?.low} />
          </td>
          <td className={`${TD} max-w-[280px]`}>
            <Packages list={r.latest?.packages ?? []} />
          </td>
          <td className={TD}>
            <DayStrip series={r.series} />
          </td>
        </tr>
      ))}
    </Table>
  );
}

function dayCaption(d: FleetDayPoint): string {
  if (!d.reported) return "no report";
  const parts = [`${plural(d.repoCount, "repo")} audited`, `${n(d.redRepoCount)} red`];
  if (d.failedAudits) parts.push(`${plural(d.failedAudits, "audit")} could not run`);
  return parts.join(", ");
}

export function SecurityAdvisoriesView({ data }: { data: SecurityAdvisories }) {
  const periods = data.daily.map((d) => ({ ...d, period: d.day }));
  const lastReported = [...periods].reverse().find((d) => d.reported) ?? null;
  const missingDays = data.daily.filter((d) => !d.reported).length;
  return (
    <div className="space-y-8">
      <div className="k-card flex items-start gap-3 px-4 py-3">
        <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: data.status === "red" ? RED : OK }} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[14px] font-medium">{data.reason}</p>
          <p className="k-fg3 mt-0.5 text-[12px]">
            {data.latestDay ? `Latest report ${shortDay(data.latestDay)}` : "No report yet"}
            {data.hoursSinceLastReport != null && `, ${n(data.hoursSinceLastReport)} h ago`}. Red when a repo has a critical or high advisory, an audit could not run, or no report came for {data.staleAfterHours} h.
          </p>
        </div>
      </div>

      <section>
        <SectionTitle
          right={
            <span className="inline-flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-[2px]" style={{ background: "var(--data-track)" }} aria-hidden="true" />
                No report
              </span>
              <span>per UTC day</span>
            </span>
          }
        >
          Open critical and high advisories, per day
        </SectionTitle>
        {missingDays > 0 && (
          <p className="k-card k-fg2 mb-3 px-4 py-2.5 text-[13px]">
            <span style={{ color: AMBER }}>{plural(missingDays, "day")} without a report.</span> Pale columns are days the audit did not report: they are not zero.
          </p>
        )}
        <PeriodBars
          periods={periods}
          series={[
            { key: "critical", label: "Critical", color: RED, get: (d: FleetDayPoint) => d.critical ?? 0 },
            { key: "high", label: "High", color: AMBER, get: (d: FleetDayPoint) => d.high ?? 0 },
          ]}
          format={n}
          label={(day, short) => (short ? shortDay(day) : dayLabel(day))}
          state={(d) => (d.reported ? null : "missing")}
          caption={dayCaption}
          initial={lastReported}
          empty="No day in the window."
        />
      </section>

      <section>
        <SectionTitle count={data.repos.length} right={data.latestDay ? <span>as of {shortDay(data.latestDay)}</span> : undefined}>
          Repos
        </SectionTitle>
        {data.repos.length === 0 ? (
          <div className="k-card">
            <EmptyNote>No repo reported yet.</EmptyNote>
          </div>
        ) : (
          <ReposTable repos={data.repos} />
        )}
      </section>
    </div>
  );
}

export function SecurityAdvisoriesPage() {
  const q = useSecurityAdvisories();
  if (q.isError && !q.data) return <Failed what="the security advisories" />;
  if (!q.data) return <Loading />;
  return <SecurityAdvisoriesView data={q.data} />;
}

/** The hub's one-second read: Clear, or how many repos are red (red), with the served reason under it. */
export function SecurityAdvisoriesTile({ href }: { href: string }) {
  const q = useSecurityAdvisories();
  const data = q.data;
  const red = data?.status === "red";
  return (
    <StatTile label="Security advisories" note={data?.latestDay ? shortDay(data.latestDay) : undefined} href={href}>
      <Figure
        value={
          q.isError && !data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : !data ? (
            <Shimmer className="h-6 w-16" />
          ) : !red ? (
            "Clear"
          ) : (
            <span style={{ color: RED }}>{data.redRepos.length ? `${plural(data.redRepos.length, "repo")} red` : "No report"}</span>
          )
        }
      />
      {data && <p className="k-fg3 mt-0.5 line-clamp-2 text-[12px]" title={data.reason}>{data.reason}</p>}
    </StatTile>
  );
}
