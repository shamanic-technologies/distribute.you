"use client";

import { useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getStaffBoxChecks } from "@/lib/api";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { DailyLines, dayLabel } from "@/components/v2/monitoring-charts";
import { Failed, Loading, OK, RED } from "@/components/v2/monitoring-sending";
import { agoLabel, boxCheckName, cadenceLabel, durationLabel, type BoxCheck, type BoxCheckDay, type BoxCheckRun, type BoxChecks } from "@/lib/monitoring/box-checks";

/**
 * Monitoring > Box > Watchdogs (staff only, BOX-WATCHDOGS-1030). Every watchdog cron on the production box posts one run
 * per tick to features-service, which serves each check's verdict, its reason in plain words, the daily series and the
 * last 48 h, broken checks first. Red on the hub IS the alert: the watchdogs mail nobody (owner 2026-10-22 « no email in
 * my inbox please »). This file draws served values in the served order; it computes no figure.
 */

export const WATCHDOG_DAYS = 30;
const ACCENT = "var(--accent)";
const AMBER = "var(--data-amber)";
const GREY = "var(--fg-4)";

export function useBoxChecks() {
  return useAuthQuery(["staffBoxChecks", WATCHDOG_DAYS], () => getStaffBoxChecks(WATCHDOG_DAYS), { ...pollOptions, retry: false });
}

const utcTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
const utcHour = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "2-digit", hourCycle: "h23", timeZone: "UTC" }) + "h";
const value = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 1 });

const verdictColor = (c: BoxCheck) => (c.verdict === "broken" ? RED : c.verdict === "ok" ? OK : GREY);

type Range = "recent" | "daily";
type RecentP = BoxCheckRun & { day: string };

/** One check: its served verdict and reason, then its measured value over the last 48 h or per day. */
function CheckSection({ check, recentHours }: { check: BoxCheck; recentHours: number }) {
  const [range, setRange] = useState<Range>("recent");
  const name = boxCheckName(check);
  const every = cadenceLabel(check.cadenceMinutes);
  const recent: RecentP[] = check.recent.map((r) => ({ ...r, day: r.ranAt }));
  return (
    <section>
      <SectionTitle
        right={
          check.verdict === "not_yet" ? undefined : (
            <span className="inline-flex items-center gap-1.5" role="group" aria-label="Range">
              {(["recent", "daily"] as const).map((r) => (
                <button key={r} type="button" aria-pressed={range === r} onClick={() => setRange(r)} className={range === r ? "k-btn h-7 px-2 text-[12px]" : "k-btn-ghost h-7 px-2 text-[12px]"}>
                  {r === "recent" ? `Last ${recentHours} hours` : "Per day"}
                </button>
              ))}
            </span>
          )
        }
      >
        {name}
      </SectionTitle>
      <div className="k-card mb-3 flex items-start gap-3 px-4 py-3">
        <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: verdictColor(check) }} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[14px] font-medium" style={{ color: check.verdict === "broken" ? RED : undefined }}>
            {check.verdict === "broken" ? check.reason : check.verdict === "ok" ? "Working" : "Not run yet"}
          </p>
          <p className="k-fg3 mt-0.5 text-[12px]">
            {check.lastRunAt ? `Last run ${utcTime(check.lastRunAt)} UTC, ${agoLabel(check.minutesSinceLastRun)}` : "No run reported yet"}
            {every && `. Runs ${every}`}
            {check.brokenSince && `. Broken since ${utcTime(check.brokenSince)} UTC`}
            {check.staleAfterMinutes != null && `. Red if silent for ${durationLabel(check.staleAfterMinutes)}`}.
          </p>
        </div>
      </div>
      {check.verdict === "not_yet" ? null : range === "recent" ? (
        <DailyLines
          points={recent}
          lines={[{ key: "v", label: check.unit ?? "Value", color: ACCENT, get: (p) => p.value }]}
          format={value}
          windows={[{ key: "all", label: "All", days: null }]}
          label={`${name}, last ${recentHours} hours`}
          empty={`Fewer than two runs in the last ${recentHours} hours.`}
          pointLabel={(d) => `${utcTime(d)} UTC`}
          tickLabel={utcHour}
          caption={(p) => (p.ok ? "OK" : <span style={{ color: RED }}>Broken</span>)}
        />
      ) : (
        <DailyLines<BoxCheckDay>
          points={check.daily}
          lines={[
            { key: "max", label: "Highest", color: AMBER, get: (p) => p.valueMax },
            { key: "mean", label: "Average", color: ACCENT, get: (p) => p.valueMean },
          ]}
          format={value}
          windows={[{ key: "all", label: "All", days: null }]}
          label={`${name}, per day`}
          empty="Fewer than two days with runs."
          pointLabel={(d) => dayLabel(d)}
          caption={(p) => (
            <>
              {p.runs} runs{p.failedRuns > 0 && <span style={{ color: RED }}>, {p.failedRuns} broken</span>}
            </>
          )}
        />
      )}
      {check.unit && check.verdict !== "not_yet" && <p className="k-fg3 mt-1.5 text-[12px]">Plotted: {check.unit}.</p>}
    </section>
  );
}

export function BoxChecksView({ data }: { data: BoxChecks }) {
  if (data.checks.length === 0) return <EmptyNote>No watchdog has reported yet.</EmptyNote>;
  return (
    <div className="space-y-8">
      <div className="k-card flex items-start gap-3 px-4 py-3">
        <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: data.status === "red" ? RED : OK }} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[14px] font-medium">{data.status === "red" ? `${data.brokenCount} of ${data.checks.length} watchdogs broken` : `All ${data.checks.length} watchdogs working`}</p>
          <p className="k-fg3 mt-0.5 text-[12px]">
            Each cron on the production server reports every run here instead of sending an email. A watchdog is red when its last run found a problem, or when it stays silent for {data.staleCadenceMultiplier}x its own interval.
          </p>
        </div>
      </div>
      {data.checks.map((c) => (
        <CheckSection key={c.check} check={c} recentHours={data.recentHours} />
      ))}
    </div>
  );
}

export function BoxChecksPage() {
  const q = useBoxChecks();
  if (q.isError && !q.data) return <Failed what="the box watchdogs" />;
  if (!q.data) return <Loading />;
  return <BoxChecksView data={q.data} />;
}

/** The hub's one-second read: how many watchdogs are broken, red when the served status is red, the served reason under it. */
export function BoxChecksTile({ href }: { href: string }) {
  const q = useBoxChecks();
  const data = q.data;
  const red = data?.status === "red";
  return (
    <StatTile label="Box watchdogs" note={data ? `${data.checks.length} crons` : undefined} href={href}>
      <Figure
        value={
          q.isError && !data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : !data ? (
            <Shimmer className="h-6 w-16" />
          ) : red ? (
            <span style={{ color: RED }}>{data.brokenCount} broken</span>
          ) : (
            <span>All working</span>
          )
        }
      />
      {data && red && (
        <p className="k-fg3 mt-0.5 line-clamp-2 text-[12px]" title={data.reason}>
          {data.reason}
        </p>
      )}
    </StatTile>
  );
}
