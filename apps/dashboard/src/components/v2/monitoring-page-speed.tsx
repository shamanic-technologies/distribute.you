"use client";

import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getStaffPageSpeed } from "@/lib/api";
import { Figure, Shimmer, SparkLine, StatTile } from "@/components/v2/ui";
import { Dash, TD, TDR, TH, THR } from "@/components/v2/monitoring-charts";
import { Failed, Loading, OK, RED } from "@/components/v2/monitoring-sending";
import { agoLabel } from "@/lib/monitoring/box-checks";
import type { BoxCheck, BoxChecks } from "@/lib/monitoring/box-checks";
import { pageName, pageSpeedDetails, secondsLabel } from "@/lib/monitoring/page-speed";

/**
 * Monitoring > Box > Page speed (staff only, DASH-SPEED-MONITOR-1110; `lib/monitoring/page-speed.ts`). One row per
 * dashboard v2 page the daily robot timed, in the served order (broken first): a bar of its reload time from the saved
 * copy against the 1 s budget, the click time from the page that links to it, the slowest server read, and its reload
 * time per day. Red only when a page is over budget or its timing stopped arriving. This file draws served values only.
 */

export const PAGE_SPEED_DAYS = 30;

export function usePageSpeed() {
  // Same root as the watchdogs read (`staffBoxChecks`, never persisted to disk), its own key.
  return useAuthQuery(["staffBoxChecks", "page-speed", PAGE_SPEED_DAYS], () => getStaffPageSpeed(PAGE_SPEED_DAYS), { ...pollOptions, retry: false });
}

const utcTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });

/** The reload time as a bar on one shared scale, the 1 s budget as a tick: the page's one-second read. */
function ReloadBar({ check, scaleMs }: { check: BoxCheck; scaleMs: number }) {
  const d = pageSpeedDetails(check);
  if (check.latestValue == null || d == null) return <Dash />;
  const broken = check.verdict === "broken";
  const width = Math.max(2, Math.min(100, (check.latestValue / scaleMs) * 100));
  const budget = Math.min(100, (d.limit / scaleMs) * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-2 min-w-0 flex-1 rounded-full bg-[var(--line-subtle)]">
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${width}%`, background: broken ? RED : OK }} />
        <div className="absolute -inset-y-1 w-px bg-[var(--fg-3)]" style={{ left: `${budget}%` }} aria-hidden="true" />
      </div>
      <span className="w-[68px] shrink-0 text-right tabular-nums" style={{ color: broken ? RED : undefined }}>
        {secondsLabel(check.latestValue, d.warmCapped)}
      </span>
    </div>
  );
}

function PageRow({ check, scaleMs }: { check: BoxCheck; scaleMs: number }) {
  const d = pageSpeedDetails(check);
  const stale = check.stale;
  return (
    <tr className="k-row align-middle">
      <td className={TD}>
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: check.verdict === "broken" ? RED : OK }} aria-hidden="true" />
          {d ? (
            <Link href={d.path} className="truncate hover:underline">
              {pageName(check)}
            </Link>
          ) : (
            <span className="truncate">{pageName(check)}</span>
          )}
        </div>
        {stale && <p className="mt-0.5 text-[12px]" style={{ color: RED }}>{check.reason}</p>}
      </td>
      <td className={TD}>
        <ReloadBar check={check} scaleMs={scaleMs} />
      </td>
      <td className={TDR}>{d?.inAppMs != null ? secondsLabel(d.inAppMs) : <Dash />}</td>
      <td className={TD}>
        {d?.slowestRead ? (
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="k-mono k-fg2 truncate text-[12px]" title={d.slowestRead.path}>
              {d.slowestRead.path}
            </span>
            <span className="shrink-0 tabular-nums">{secondsLabel(d.slowestRead.ms)}</span>
          </span>
        ) : (
          <Dash />
        )}
      </td>
      <td className={TD}>
        {check.daily.length < 2 ? <Dash /> : <SparkLine values={check.daily.map((p) => p.valueLast ?? 0)} className="h-6" color={check.verdict === "broken" ? RED : undefined} />}
      </td>
    </tr>
  );
}

export function PageSpeedView({ data }: { data: BoxChecks }) {
  if (data.checks.length === 0) {
    return (
      <div className="k-card">
        <p className="k-fg3 px-4 py-6 text-[13px]">No page timed yet. The robot runs every day at 04:10 UTC.</p>
      </div>
    );
  }
  const last = data.checks[0].lastRunAt;
  // One scale for every bar: the slowest served reload, never under 2x the budget so the budget tick stays readable.
  const limit = pageSpeedDetails(data.checks[0])?.limit ?? 1000;
  const scaleMs = Math.max(limit * 2, ...data.checks.map((c) => c.latestValue ?? 0));
  return (
    <div className="space-y-6">
      <div className="k-card flex items-start gap-3 px-4 py-3">
        <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: data.status === "red" ? RED : OK }} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[14px] font-medium" style={{ color: data.status === "red" ? RED : undefined }}>
            {data.status === "red" ? `${data.brokenCount} of ${data.checks.length} pages take over 1 s` : `All ${data.checks.length} pages open in under 1 s`}
          </p>
          <p className="k-fg3 mt-0.5 text-[12px]">
            Every day at 04:10 UTC a robot member of our org opens each page of the Distribute.you brand, then reloads it from the saved copy.
            {last && ` Last run ${utcTime(last)} UTC.`}
          </p>
        </div>
      </div>
      <div className="k-card overflow-hidden">
        <div className="k-scroll overflow-x-auto">
          <table className="w-full min-w-[920px] table-fixed text-[13px]">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[26%]" />
              <col className="w-[10%]" />
              <col />
              <col className="w-[12%]" />
            </colgroup>
            <thead>
              <tr className="k-line-subtle border-b">
                <th className={TH}>Page</th>
                <th className={TH}>Reload, budget 1 s</th>
                <th className={THR}>Click</th>
                <th className={TH}>Slowest server read</th>
                <th className={TH}>{PAGE_SPEED_DAYS} days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line-subtle)]">
              {data.checks.map((c) => (
                <PageRow key={c.check} check={c} scaleMs={scaleMs} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function PageSpeedPage() {
  const q = usePageSpeed();
  if (q.isError && !q.data) return <Failed what="the page speed check" />;
  if (!q.data) return <Loading />;
  return <PageSpeedView data={q.data} />;
}

/** The hub's one-second read: how many pages are over budget, red when the served status is red. */
export function PageSpeedTile({ href }: { href: string }) {
  const q = usePageSpeed();
  const data = q.data;
  const red = data?.status === "red";
  const lastMinutes = data?.checks[0]?.minutesSinceLastRun ?? null;
  return (
    <StatTile label="Page speed" note={data ? `${data.checks.length} pages` : undefined} href={href}>
      <Figure
        value={
          q.isError && !data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : !data ? (
            <Shimmer className="h-6 w-16" />
          ) : data.checks.length === 0 ? (
            <span className="k-fg3 text-[13px]">not run yet</span>
          ) : red ? (
            <span style={{ color: RED }}>{data.brokenCount} slow</span>
          ) : (
            <span>All under 1 s</span>
          )
        }
      />
      {data && data.checks.length > 0 && <p className="k-fg3 mt-0.5 text-[12px]">Timed {agoLabel(lastMinutes)}</p>}
    </StatTile>
  );
}
