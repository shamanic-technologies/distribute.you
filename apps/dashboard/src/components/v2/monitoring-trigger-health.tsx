"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getStaffTriggerHealth } from "@/lib/api";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { dayLabel } from "@/components/v2/monitoring-charts";
import { Failed, Loading, OK, RED } from "@/components/v2/monitoring-sending";
import { redTriggers, verdictColor, verdictWord, watchedTriggers, type TriggerHealth, type TriggerHealthItem } from "@/lib/monitoring/trigger-health";

/**
 * Monitoring > Triggers > Firing (staff only, TRIGGER-HEALTH-1028-DASH). campaign-service serves, per trigger a live
 * campaign waits on, whether it is BROKEN (never fired while campaigns waited, or people reached its step with no event),
 * its verdict in one sentence, and a daily series of events with that day's stored verdict. Red on the hub IS the alert
 * (no email). This file draws served values in the served order; it computes no figure.
 */

export const TRIGGER_HEALTH_DAYS = 30;

export function useTriggerHealth() {
  return useAuthQuery(["staffTriggerHealth", TRIGGER_HEALTH_DAYS], () => getStaffTriggerHealth(TRIGGER_HEALTH_DAYS), { ...pollOptions, retry: false });
}

const utcTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
const shortDay = (d: string) => dayLabel(d, { month: "short", day: "numeric" });
const campaigns = (v: number) => `${v.toLocaleString("en-US")} live ${v === 1 ? "campaign waits" : "campaigns wait"} on it`;
const people = (v: number) => `${v.toLocaleString("en-US")} ${v === 1 ? "person" : "people"}`;

/** One bar per served day: height = events, colour = that day's stored verdict; a day with no event keeps a stub. */
function DayBars({ t }: { t: TriggerHealthItem }) {
  const max = Math.max(1, ...t.byDay.map((d) => d.events));
  return (
    <div className="flex h-12 items-end gap-[2px]" role="img" aria-label={`${t.label}: events per day`}>
      {t.byDay.map((d) => (
        <span
          key={d.day}
          className="min-w-0 flex-1 rounded-[2px]"
          title={`${dayLabel(d.day)}: ${d.events.toLocaleString("en-US")} ${d.events === 1 ? "event" : "events"}, ${verdictWord(d.status)}`}
          style={{
            height: d.events > 0 ? `${Math.max(4, (d.events / max) * 48)}px` : "3px",
            background: d.status == null ? (d.events > 0 ? "var(--fg-4)" : "var(--data-track)") : verdictColor(d.status),
          }}
        />
      ))}
    </div>
  );
}

/** One watched trigger: its name and verdict, the served sentence, its days, and the brands where facts came with no event. */
function TriggerCard({ t }: { t: TriggerHealthItem }) {
  const color = verdictColor(t.status);
  const first = t.byDay[0];
  const last = t.byDay[t.byDay.length - 1];
  return (
    <div className="k-card flex min-w-0 flex-col p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="min-w-0 truncate text-[14px] font-medium" title={t.triggerId}>
          {t.label}
        </h3>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px]" style={{ color: t.status === "red" ? RED : undefined }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden="true" />
          {verdictWord(t.status)}
        </span>
      </div>
      <p className="k-fg3 mt-0.5 text-[12px]">
        {campaigns(t.liveCampaigns)}, fired by {t.firedBy}
      </p>
      <p className="mt-2 text-[13px]" style={{ color: t.status === "red" ? RED : undefined }}>
        {t.sentence ?? <span className="k-fg4">—</span>}
      </p>
      <div className="mt-auto pt-3">
        <DayBars t={t} />
        <div className="k-fg3 mt-1.5 flex justify-between text-[11px] tabular-nums">
          <span>{first ? shortDay(first.day) : ""}</span>
          <span>{t.lastEventAt ? `Last event ${utcTime(t.lastEventAt)} UTC` : "Never fired"}</span>
          <span>{last ? shortDay(last.day) : ""}</span>
        </div>
      </div>
      {t.missing.length > 0 && (
        <table className="k-line-subtle mt-3 w-full border-t text-[12px]">
          <thead>
            <tr className="text-left">
              <th className="k-label pb-1 pt-2">Brand</th>
              <th className="k-label pb-1 pt-2 text-right">No event for</th>
              <th className="k-label pb-1 pt-2 text-right">Since</th>
            </tr>
          </thead>
          <tbody>
            {t.missing.map((m) => (
              <tr key={`${m.orgId}:${m.brandId}`}>
                <td className="k-mono k-fg2 py-0.5" title={`org ${m.orgId}, brand ${m.brandId}`}>
                  {m.brandId.slice(0, 8)}
                </td>
                <td className="py-0.5 text-right tabular-nums">{people(m.people)}</td>
                <td className="k-mono k-fg2 py-0.5 text-right">{utcTime(m.firstReachedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function TriggerHealthView({ data }: { data: TriggerHealth }) {
  const red = data.status === "red";
  const reds = redTriggers(data);
  const { watched, unwatched } = watchedTriggers(data);
  return (
    <div className="space-y-8">
      <div className="k-card flex items-start gap-3 px-4 py-3">
        <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: red ? RED : OK }} aria-hidden="true" />
        <div className="min-w-0">
          {red && reds.length > 0 ? (
            reds.map((t) => (
              <p key={t.triggerId} className="text-[14px] font-medium">
                {t.label}: {t.sentence ?? verdictWord(t.status)}
              </p>
            ))
          ) : (
            <p className="text-[14px] font-medium">Every trigger a campaign waits on is firing.</p>
          )}
          <p className="k-fg3 mt-0.5 text-[12px]">
            Red only on proof: it never fired while campaigns waited 3 days, or people reached its step with no event. A quiet trigger
            is OK. {data.checkedAt ? `Checked ${utcTime(data.checkedAt)} UTC.` : "Not checked yet."}
          </p>
        </div>
      </div>

      <section>
        <SectionTitle count={watched.length} right={<span>One bar per UTC day. Grey = not checked that day</span>}>
          Triggers a campaign waits on
        </SectionTitle>
        {watched.length === 0 ? (
          <div className="k-card">
            <EmptyNote>No live campaign waits on a trigger.</EmptyNote>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {watched.map((t) => (
              <TriggerCard key={t.triggerId} t={t} />
            ))}
          </div>
        )}
      </section>

      {unwatched.length > 0 && (
        <details className="group">
          <summary className="k-fg2 cursor-pointer text-[13px]">
            {unwatched.length} {unwatched.length === 1 ? "trigger" : "triggers"} no live campaign waits on
          </summary>
          <ul className="k-card mt-3 divide-y divide-[var(--line-subtle)]">
            {unwatched.map((t) => (
              <li key={t.triggerId} className="flex items-baseline justify-between gap-3 px-4 py-2 text-[13px]">
                <span>{t.label}</span>
                <span className="k-mono k-fg2 text-[12px]">{t.lastEventAt ? `Last event ${utcTime(t.lastEventAt)} UTC` : "Never fired"}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function TriggerHealthPage() {
  const q = useTriggerHealth();
  if (q.isError && !q.data) return <Failed what="the trigger health" />;
  if (!q.data) return <Loading />;
  return <TriggerHealthView data={q.data} />;
}

/** The hub's one-second read: how many triggers are broken, red when the served verdict is red, which ones under it. */
export function TriggerHealthTile({ href }: { href: string }) {
  const q = useTriggerHealth();
  const data = q.data;
  const red = data?.status === "red";
  const reds = data ? redTriggers(data) : [];
  return (
    <StatTile label="Triggers firing" note={data ? `${watchedTriggers(data).watched.length} watched` : undefined} href={href}>
      <Figure
        value={
          q.isError && !data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : !data ? (
            <Shimmer className="h-6 w-16" />
          ) : (
            <span style={{ color: red ? RED : undefined }}>{red ? `${reds.length} broken` : "All firing"}</span>
          )
        }
        sub={data && red ? reds.map((t) => t.label).join(", ") : undefined}
      />
    </StatTile>
  );
}
