"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getStaffTriggerReports } from "@/lib/api";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { PeriodBars, dayLabel } from "@/components/v2/monitoring-charts";
import { Failed, Loading, OK, RED } from "@/components/v2/monitoring-sending";
import { reasonName, triggerName, type TriggerReport, type TriggerReports } from "@/lib/monitoring/trigger-reports";

/**
 * Monitoring > Triggers > Reports (staff only, TRIGGER-REPORTS-MONITORING-1027). crm-service reports four facts to
 * their campaigns (a form filled, a WhatsApp number given, a positive reply, an account event) and serves, per trigger,
 * the verdict, the reports stuck past its limit with their reason, and a daily series. Red on the hub IS the alert
 * (no email). This file draws served values in the served order; it computes no figure.
 */

export const TRIGGER_DAYS = 30;
const SENT = "var(--data-teal)";

export function useTriggerReports() {
  return useAuthQuery(["staffTriggerReports", TRIGGER_DAYS], () => getStaffTriggerReports(TRIGGER_DAYS), { ...pollOptions, retry: false });
}

const utcTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });

/** One trigger: its verdict, a bar per day (sent, not sent; skipped on purpose in the day's caption), and every report stuck now. */
function TriggerBlock({ t, limit }: { t: TriggerReport; limit: number }) {
  const red = t.status === "red";
  return (
    <section>
      <SectionTitle
        count={t.stuck}
        right={
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: red ? RED : OK }} aria-hidden="true" />
            {red ? `${t.stuck} stuck` : "Nothing stuck"}
          </span>
        }
      >
        {triggerName(t.trigger)}
      </SectionTitle>
      <PeriodBars
        periods={t.byDay.map((d) => ({ ...d, period: d.day }))}
        series={[
          { key: "sent", label: "Sent", color: SENT, get: (d) => d.sent },
          { key: "notSent", label: "Not sent", color: RED, get: (d) => d.notSent },
        ]}
        // Skipped on purpose (a number known before the watch, a person who is no lead) can be thousands on one day: read, never drawn.
        caption={(d) => `${d.skipped.toLocaleString("en-US")} skipped on purpose`}
        format={(v) => v.toLocaleString("en-US")}
        label={(d, short) => dayLabel(d, short ? { month: "short", day: "numeric" } : undefined)}
        empty={`No report in the last ${TRIGGER_DAYS} days.`}
      />
      {t.stuckReports.length > 0 && (
        <div className="k-card mt-3 overflow-hidden">
          <div className="k-scroll overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="k-line-subtle border-b text-left">
                  <th className="k-label px-3 py-2.5 first:pl-4">Why</th>
                  <th className="k-label px-3 py-2.5">Seen</th>
                  <th className="k-label px-3 py-2.5 text-right">Tries</th>
                  <th className="k-label px-3 py-2.5 last:pr-4">Brand</th>
                </tr>
              </thead>
              <tbody>
                {t.stuckReports.map((r) => (
                  <tr key={r.reportId} className="k-row k-line-subtle border-b last:border-b-0">
                    <td className="px-3 py-2 first:pl-4">
                      <span className="font-medium">{reasonName(r.reason)}</span>
                      {r.lastError && <span className="k-fg3 block text-[12px]">{r.lastError}</span>}
                    </td>
                    <td className="k-mono k-fg2 whitespace-nowrap px-3 py-2 text-[12px]">{utcTime(r.detectedAt)} UTC</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.attempts}</td>
                    <td className="k-mono k-fg3 px-3 py-2 text-[12px] last:pr-4" title={`org ${r.orgId}`}>
                      {r.brandId.slice(0, 8)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="k-fg3 k-line-subtle border-t px-4 py-2.5 text-[12px]">Stuck = not sent {limit} min after we saw it.</p>
        </div>
      )}
    </section>
  );
}

export function TriggerReportsView({ data }: { data: TriggerReports }) {
  const red = data.status === "red";
  const redOnes = data.triggers.filter((t) => t.status === "red");
  return (
    <div className="space-y-8">
      <div className="k-card flex items-start gap-3 px-4 py-3">
        <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: red ? RED : OK }} aria-hidden="true" />
        <div className="min-w-0">
          {red ? (
            redOnes.map((t) => (
              <p key={t.trigger} className="text-[14px] font-medium">
                {triggerName(t.trigger)}: {t.stuck} not sent ({t.stuckByReason.map((b) => `${b.count} ${reasonName(b.reason).toLowerCase()}`).join(", ")})
              </p>
            ))
          ) : (
            <p className="text-[14px] font-medium">Every trigger reached its campaign.</p>
          )}
          <p className="k-fg3 mt-0.5 text-[12px]">
            Read {utcTime(data.generatedAt)} UTC. Red when a report is still not sent {data.stuckAfterMinutes} min after we saw it.
          </p>
        </div>
      </div>
      {data.triggers.length === 0 ? (
        <div className="k-card">
          <EmptyNote>No trigger served.</EmptyNote>
        </div>
      ) : (
        data.triggers.map((t) => <TriggerBlock key={t.trigger} t={t} limit={data.stuckAfterMinutes} />)
      )}
    </div>
  );
}

export function TriggerReportsPage() {
  const q = useTriggerReports();
  if (q.isError && !q.data) return <Failed what="the trigger reports" />;
  if (!q.data) return <Loading />;
  return <TriggerReportsView data={q.data} />;
}

/** The hub's one-second read: how many reports are stuck, red when the served verdict is red, which triggers under it. */
export function TriggerReportsTile({ href }: { href: string }) {
  const q = useTriggerReports();
  const data = q.data;
  const red = data?.status === "red";
  const stuck = data?.triggers.filter((t) => t.stuck > 0) ?? [];
  return (
    <StatTile label="Triggers reaching campaigns" note={data ? `last ${data.days} days` : undefined} href={href}>
      <Figure
        value={
          q.isError && !data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : !data ? (
            <Shimmer className="h-6 w-16" />
          ) : (
            <span style={{ color: red ? RED : undefined }}>{red ? `${stuck.map((t) => t.stuck).join(" + ")} stuck` : "All sent"}</span>
          )
        }
        sub={data && red ? stuck.map((t) => triggerName(t.trigger)).join(", ") : undefined}
      />
    </StatTile>
  );
}
