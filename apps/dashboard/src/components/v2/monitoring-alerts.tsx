"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getStaffMonitoringAlerts } from "@/lib/api";
import { EmptyNote, Figure, Shimmer, StatTile } from "@/components/v2/ui";
import { PeriodBars, dayLabel } from "@/components/v2/monitoring-charts";
import { Failed, Loading, OK, RED, n, shortDay } from "@/components/v2/monitoring-sending";
import { useBrandName } from "@/components/v2/monitoring-unsent-answers";
import {
  brokenAlerts,
  fact,
  occurrenceClient,
  occurrenceEmail,
  occurrenceWords,
  reasonWords,
  type MonitoringAlert,
  type MonitoringAlerts,
} from "@/lib/monitoring/monitoring-alerts";

/**
 * Monitoring > Alerts > Raised (staff only, SIGNUP-EMAILS-1111-MONITORING; `lib/monitoring/monitoring-alerts.ts`).
 * transactional-email-service records every staff alert instead of emailing it (owner 2026-10-22, « no email in my inbox
 * please »): one block per alert type, in the served order (broken first), each with its daily chart and its latest
 * occurrences in plain words (which client, which campaign, what happened). Red ONLY where the served verdict is broken;
 * red on the hub IS the alert. This file draws served values; it computes no figure.
 */

export const MONITORING_ALERTS_DAYS = 30;

export function useMonitoringAlerts() {
  return useAuthQuery(["staffMonitoringAlerts", MONITORING_ALERTS_DAYS], () => getStaffMonitoringAlerts(MONITORING_ALERTS_DAYS), { ...pollOptions, retry: false });
}

/** A raise that is past (verdict ok) keeps a calm colour: only a broken type is red. */
const PAST = "var(--data-amber)";

const utcTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });

type Bar = { period: string; count: number };

function AlertChart({ alert }: { alert: MonitoringAlert }) {
  const periods: Bar[] = alert.daily.map((d) => ({ period: d.day, count: d.count }));
  const broken = alert.verdict === "broken";
  return (
    <PeriodBars
      periods={periods}
      series={[{ key: "raised", label: "Raised", color: broken ? RED : PAST, get: (m) => m.count }]}
      format={n}
      label={(d, short) => (short ? shortDay(d) : dayLabel(d))}
      empty="No day in this window."
    />
  );
}

function Occurrences({ alert, brand }: { alert: MonitoringAlert; brand: (id: string) => string }) {
  if (alert.recent.length === 0) {
    return (
      <div className="k-card">
        <EmptyNote>Not raised in the last {MONITORING_ALERTS_DAYS} days.</EmptyNote>
      </div>
    );
  }
  return (
    <div className="k-card overflow-hidden">
      <ul className="k-scroll max-h-[260px] divide-y divide-[var(--line-subtle)] overflow-y-auto">
        {alert.recent.map((o, i) => {
          const w = occurrenceWords(alert.eventType, o);
          const client = occurrenceClient(o, brand);
          const email = occurrenceEmail(o);
          const look = fact(o.metadata, "whereToLook");
          return (
            <li key={`${o.raisedAt}-${i}`} className="px-4 py-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 text-[13px]">
                  <span className="font-medium">{client ?? "Distribute"}</span>
                  {email && email !== client && <span className="k-fg3 text-[12px]"> · {email}</span>}
                  {w.campaign && (
                    <span className="k-fg2" title={w.campaign.full}>
                      {" "}· {w.campaign.short}
                    </span>
                  )}
                </p>
                <span className="k-mono k-fg2 shrink-0 whitespace-nowrap text-[12px]">{utcTime(o.raisedAt)} UTC</span>
              </div>
              <p className="mt-0.5 text-[13px]">{w.what}</p>
              {w.detail && <p className="k-fg3 mt-0.5 line-clamp-2 break-words text-[12px]" title={w.detail}>{w.detail}</p>}
              {look && (
                <details className="mt-1">
                  <summary className="k-fg3 cursor-pointer text-[12px]">Where to look</summary>
                  <p className="k-mono k-fg2 mt-1 break-all text-[11.5px]">{look}</p>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AlertBlock({ alert, brand }: { alert: MonitoringAlert; brand: (id: string) => string }) {
  const broken = alert.verdict === "broken";
  return (
    <section id={alert.eventType} className="scroll-mt-20">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="inline-flex items-center gap-2 text-[14px] font-medium">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: broken ? RED : OK }} aria-hidden="true" />
          <span style={{ color: broken ? RED : undefined }}>{alert.label}</span>
        </h2>
        <span className="k-fg3 text-[12px]">{reasonWords(alert.reason)}</span>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <AlertChart alert={alert} />
        <Occurrences alert={alert} brand={brand} />
      </div>
    </section>
  );
}

export function MonitoringAlertsView({ data, brand }: { data: MonitoringAlerts; brand: (id: string) => string }) {
  const broken = brokenAlerts(data);
  const red = broken.length > 0;
  return (
    <div className="space-y-8">
      <div className="k-card flex items-start gap-3 px-4 py-3">
        <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: red ? RED : OK }} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[14px] font-medium" style={{ color: red ? RED : undefined }}>
            {red ? `Raised in the last 24 h: ${broken.map((a) => a.label.toLowerCase()).join("; ")}` : "Nothing raised in the last 24 h"}
          </p>
          <p className="k-fg3 mt-0.5 text-[12px]">
            Our services raise these alerts and record them here. Nobody gets an email. Red means raised in the last 24 hours.
          </p>
        </div>
      </div>
      {data.alerts.length === 0 ? (
        <div className="k-card">
          <EmptyNote>No alert type served yet.</EmptyNote>
        </div>
      ) : (
        data.alerts.map((a) => <AlertBlock key={a.eventType} alert={a} brand={brand} />)
      )}
    </div>
  );
}

export function MonitoringAlertsPage() {
  const q = useMonitoringAlerts();
  const brand = useBrandName();
  if (q.isError && !q.data) return <Failed what="the alerts" />;
  if (!q.data) return <Loading />;
  return <MonitoringAlertsView data={q.data} brand={brand} />;
}

/** The hub's one-second read: which alert types were raised in the last 24 h, red when the served verdict says broken. */
export function MonitoringAlertsTile({ href }: { href: string }) {
  const q = useMonitoringAlerts();
  const data = q.data;
  const broken = data ? brokenAlerts(data) : [];
  return (
    <StatTile label="Alerts raised" note={data ? `${data.alerts.length} kinds` : undefined} href={href}>
      <Figure
        value={
          q.isError && !data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : !data ? (
            <Shimmer className="h-6 w-16" />
          ) : broken.length > 0 ? (
            <span style={{ color: RED }}>{broken.length} in 24 h</span>
          ) : (
            <span>None in 24 h</span>
          )
        }
      />
      {broken.length > 0 && <p className="mt-0.5 truncate text-[12px]" style={{ color: RED }}>{broken.map((a) => a.label).join(" · ")}</p>}
    </StatTile>
  );
}
