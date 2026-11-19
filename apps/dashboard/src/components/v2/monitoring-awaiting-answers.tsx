"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getStaffAwaitingAnswers } from "@/lib/api";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { PeriodBars, dayLabel } from "@/components/v2/monitoring-charts";
import { Failed, Loading, OK, RED, n, shortDay } from "@/components/v2/monitoring-sending";
import { useBrandName } from "@/components/v2/monitoring-unsent-answers";
import { messageKindName, waitedFor, type AwaitingAnswers, type AwaitingDay } from "@/lib/monitoring/awaiting-answers";

/**
 * Monitoring > Triggers > Waiting on us (staff only, REPLY-NO-BALANCE-1118). lead-service serves every person who wrote to
 * a brand and has waited on our answer for more than an hour (its latest sweep), the verdict (red while anyone waits, or
 * while the sweep itself is silent) and a stored daily series. Red on the hub IS the alert (no email). This file draws
 * served values in the served order; it computes no figure.
 */

export const AWAITING_ANSWERS_DAYS = 30;

export function useAwaitingAnswers() {
  return useAuthQuery(["staffAwaitingAnswers", AWAITING_ANSWERS_DAYS], () => getStaffAwaitingAnswers(AWAITING_ANSWERS_DAYS), { ...pollOptions, retry: false });
}

const utcTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });

const people = (v: number) => `${n(v)} ${v === 1 ? "person" : "people"}`;

type Bar = AwaitingDay & { period: string };

export function AwaitingAnswersChart({ data }: { data: AwaitingAnswers }) {
  const periods: Bar[] = data.byDay.map((d) => ({ ...d, period: d.day }));
  return (
    <PeriodBars
      periods={periods}
      series={[{ key: "maxWaitingOverHour", label: "Waiting over an hour", color: RED, get: (m) => m.maxWaitingOverHour }]}
      caption={(m) => `${people(m.waitingOverHour)} at the day's last check`}
      format={n}
      label={(d, short) => (short ? shortDay(d) : dayLabel(d))}
      empty="No check has run in this window yet."
    />
  );
}

export function AwaitingAnswersView({ data, brand }: { data: AwaitingAnswers; brand: (brandId: string) => string }) {
  const red = data.status === "red";
  return (
    <div className="space-y-8">
      <div className="k-card flex items-start gap-3 px-4 py-3">
        <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: red ? RED : OK }} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[14px] font-medium">
            {data.sweepStale
              ? "The check has not run for 2 hours: nobody can tell who is waiting."
              : data.waiting.length > 0
                ? `${people(data.waiting.length)} waiting on our answer for more than an hour.`
                : "Everyone who wrote to a brand got an answer within the hour."}
          </p>
          <p className="k-fg3 mt-0.5 text-[12px]">
            A person waits when their last message asks something of us and came after our last answer. Checked every 15 minutes
            {data.lastSweepAt ? `, last at ${utcTime(data.lastSweepAt)} UTC` : ""}
            {data.lastSweepFailedBrands > 0 ? `, ${n(data.lastSweepFailedBrands)} brand(s) unreadable` : ""}.
          </p>
        </div>
      </div>

      <section>
        <SectionTitle right={<span>Days are UTC</span>}>People waiting over an hour, per day</SectionTitle>
        <AwaitingAnswersChart data={data} />
      </section>

      <section>
        <SectionTitle count={data.waiting.length}>Waiting now</SectionTitle>
        {data.waiting.length === 0 ? (
          <div className="k-card">
            <EmptyNote>Nobody waits on our answer for more than an hour.</EmptyNote>
          </div>
        ) : (
          <div className="k-card overflow-hidden">
            <div className="k-scroll overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="k-line-subtle border-b text-left">
                    <th className="k-label px-3 py-2.5 first:pl-4">Person</th>
                    <th className="k-label px-3 py-2.5">Brand</th>
                    <th className="k-label px-3 py-2.5">Their last message</th>
                    <th className="k-label px-3 py-2.5 text-right last:pr-4">Waiting for</th>
                  </tr>
                </thead>
                <tbody>
                  {data.waiting.map((p) => (
                    <tr key={`${p.brandId}:${p.leadId}`} className="k-row k-line-subtle border-b last:border-b-0">
                      <td className="px-3 py-2 align-top first:pl-4">
                        <span className="font-medium">{p.name ?? p.email}</span>
                        {p.name && <span className="k-fg3 block text-[12px]">{p.email}</span>}
                      </td>
                      <td className="px-3 py-2 align-top">{brand(p.brandId)}</td>
                      <td className="px-3 py-2 align-top">
                        {messageKindName(p.lastMessageKind)}
                        <span className="k-mono k-fg3 block text-[12px]">{utcTime(p.lastMessageAt)} UTC</span>
                      </td>
                      <td className="tabular-nums whitespace-nowrap px-3 py-2 text-right align-top last:pr-4" style={{ color: RED }}>
                        {waitedFor(p.waitingSince, data.generatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export function AwaitingAnswersPage() {
  const q = useAwaitingAnswers();
  const brand = useBrandName();
  if (q.isError && !q.data) return <Failed what="the people waiting on our answer" />;
  if (!q.data) return <Loading />;
  return <AwaitingAnswersView data={q.data} brand={brand} />;
}

/** The hub's one-second read: people waiting on our answer for more than an hour, red when the served verdict is red. */
export function AwaitingAnswersTile({ href }: { href: string }) {
  const q = useAwaitingAnswers();
  const data = q.data;
  const red = data?.status === "red";
  return (
    <StatTile label="Waiting on us" note="over 1 h" href={href}>
      <Figure
        value={
          q.isError && !data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : !data ? (
            <Shimmer className="h-6 w-16" />
          ) : (
            <span style={{ color: red ? RED : undefined }}>{data.sweepStale ? "Check silent" : data.waiting.length > 0 ? people(data.waiting.length) : "Nobody"}</span>
          )
        }
        sub={data ? (red ? "a person who wrote has no answer" : "everyone who wrote got an answer") : undefined}
      />
    </StatTile>
  );
}
