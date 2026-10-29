"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getStaffStuckOccurrences } from "@/lib/api";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { DailyLines, PeriodBars, dayLabel } from "@/components/v2/monitoring-charts";
import { Dash, Failed, Loading, OK, RED } from "@/components/v2/monitoring-sending";
import { longestWaitIsRed, waitLabel, waitReasonName, waitingPerson, type StuckOccurrences } from "@/lib/monitoring/stuck-occurrences";

/**
 * Monitoring > Triggers > Prospects waiting (staff only, REACTIVE-THROUGHPUT-1028). campaign-service serves whether a
 * prospect who acted (form, reply, number given) waits on a blocked campaign answer: the verdict, the people stuck now
 * with their campaign and why, the people simply queued in a moving queue (not a problem), and a daily series. Red on the
 * hub IS the alert (no email). This file draws served values in the served order; it computes no figure.
 */

export const WAITING_DAYS = 30;

export function useStuckOccurrences() {
  return useAuthQuery(["staffStuckOccurrences", WAITING_DAYS], () => getStaffStuckOccurrences(WAITING_DAYS), { ...pollOptions, retry: false });
}

const utcTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });

const people = (v: number) => `${v.toLocaleString("en-US")} ${v === 1 ? "person" : "people"}`;

export function ProspectsWaitingView({ data }: { data: StuckOccurrences }) {
  const red = data.status === "red";
  // Axis unit only: hours once a served wait passes 2 h, so ticks read "5 h", never "16.7 h" (the values are served).
  const unit = data.byDay.some((d) => (d.waitMinutes.p90 ?? 0) > 120) ? 60 : 1;
  const inUnit = (m: number | null) => (m == null ? null : m / unit);
  return (
    <div className="space-y-8">
      <div className="k-card flex items-start gap-3 px-4 py-3">
        <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: red ? RED : OK }} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[14px] font-medium">
            {red
              ? `${people(data.stuck)} waiting on a blocked answer (${data.stuckByReason.map((b) => `${b.count} ${waitReasonName(b.reason).toLowerCase()}`).join(", ")})`
              : "Every prospect who acted got an answer or is in a moving queue."}
          </p>
          <p className="k-fg3 mt-0.5 text-[12px]">
            {people(data.queued)} in a moving queue, not a problem. Red when a prospect still waits {data.stuckAfterMinutes} min after they
            acted and the campaign is blocked. Read {utcTime(data.generatedAt)} UTC.
          </p>
        </div>
      </div>

      <section>
        <SectionTitle right={<span>Days are UTC</span>}>Answers per day</SectionTitle>
        <PeriodBars
          periods={data.byDay.map((d) => ({ ...d, period: d.day }))}
          grouped
          series={[
            { key: "answered", label: "Answered", color: "var(--data-teal)", get: (d) => d.answered },
            { key: "answeredLate", label: "Answered late", color: "var(--data-amber)", get: (d) => d.answeredLate },
            { key: "failed", label: "Failed", color: RED, get: (d) => d.failed },
            { key: "waiting", label: "Still waiting", color: "var(--data-sky)", get: (d) => d.waiting },
          ]}
          // Skipped on purpose (nobody due, another campaign answered) can dwarf the rest: read, never drawn.
          caption={(d) => `${d.skipped.toLocaleString("en-US")} skipped on purpose`}
          format={(v) => v.toLocaleString("en-US")}
          label={(d, short) => dayLabel(d, short ? { month: "short", day: "numeric" } : undefined)}
          empty={`Nobody acted in the last ${WAITING_DAYS} days.`}
        />
        <p className="k-fg3 mt-2 text-[12px]">Late = answered more than {data.stuckAfterMinutes} min after the person acted.</p>
      </section>

      <section>
        <SectionTitle right={<span>Days are UTC</span>}>How long people wait</SectionTitle>
        <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
          <LongestWait data={data} />
          <DailyLines
            points={data.byDay}
            lines={[
              { key: "p90", label: "9 in 10 answered within", color: "var(--data-amber)", get: (d) => inUnit(d.waitMinutes.p90) },
              { key: "p50", label: "Half answered within", color: "var(--data-teal)", get: (d) => inUnit(d.waitMinutes.p50) },
              { key: "limit", label: "Red above", color: "var(--fg-3)", dashed: true, get: () => inUnit(data.queuedTooLongMinutes) },
            ]}
            caption={(d) => (d.waitMinutes.max == null ? "nobody answered" : `longest ${waitLabel(d.waitMinutes.max)}, ${people(d.answered)} answered`)}
            format={(v) => waitLabel(v * unit)}
            windows={[{ key: "all", label: `${WAITING_DAYS} days`, days: null }]}
            empty={`Nobody was answered in the last ${WAITING_DAYS} days.`}
            label="Wait before the answer, per day"
          />
        </div>
      </section>

      <section>
        <SectionTitle count={data.stuck}>Waiting on a blocked answer</SectionTitle>
        {data.stuckOccurrences.length === 0 ? (
          <div className="k-card">
            <EmptyNote>Nobody is waiting on a blocked answer.</EmptyNote>
          </div>
        ) : (
          <div className="k-card overflow-hidden">
            <div className="k-scroll overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="k-line-subtle border-b text-left">
                    <th className="k-label px-3 py-2.5 first:pl-4">Prospect</th>
                    <th className="k-label px-3 py-2.5">Campaign</th>
                    <th className="k-label px-3 py-2.5">Why</th>
                    <th className="k-label px-3 py-2.5">Waiting since</th>
                    <th className="k-label px-3 py-2.5 text-right last:pr-4">Tries</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stuckOccurrences.map((o) => {
                    const who = waitingPerson(o);
                    const contact = o.person && who !== (o.person.email ?? o.person.phone) ? o.person.email ?? o.person.phone : null;
                    return (
                      <tr key={o.occurrenceId} className="k-row k-line-subtle border-b last:border-b-0">
                        <td className="px-3 py-2 align-top first:pl-4">
                          {who ? <span className="font-medium">{who}</span> : <Dash />}
                          {contact && <span className="k-fg3 block text-[12px]">{contact}</span>}
                        </td>
                        <td className="px-3 py-2 align-top" title={o.campaignId ? `campaign ${o.campaignId}` : undefined}>
                          {o.campaignName ?? <Dash />}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span>{(o.reasons.length ? o.reasons : ["unnamed"]).map(waitReasonName).join(", ")}</span>
                          {o.lastError && <span className="k-fg3 block max-w-[420px] truncate text-[12px]" title={o.lastError}>{o.lastError}</span>}
                        </td>
                        <td className="k-mono k-fg2 whitespace-nowrap px-3 py-2 align-top text-[12px]">{utcTime(o.waitingSince)} UTC</td>
                        <td className="px-3 py-2 text-right align-top tabular-nums last:pr-4">{o.attempts}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {data.stuckOccurrences.length < data.stuck && (
              <p className="k-fg3 k-line-subtle border-t px-4 py-2.5 text-[12px] tabular-nums">
                Showing the {data.stuckOccurrences.length} longest waits of {data.stuck}.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

/** The one figure: how long the person waiting longest has waited now, red past the served limit. */
function LongestWait({ data }: { data: StuckOccurrences }) {
  const m = data.oldestWaitingMinutes;
  const red = longestWaitIsRed(data);
  return (
    <div className="k-card h-fit p-4">
      <p className="k-label">Longest wait now</p>
      <p className="mt-2 text-[28px] font-medium leading-8 tabular-nums" style={{ color: red ? RED : undefined }}>
        {m == null ? "Nobody" : waitLabel(m)}
      </p>
      <p className="k-fg3 mt-1 text-[12px]">
        {m == null ? `Nobody waits past ${data.stuckAfterMinutes} min.` : `Red past ${waitLabel(data.queuedTooLongMinutes)}.`}
      </p>
    </div>
  );
}

export function ProspectsWaitingPage() {
  const q = useStuckOccurrences();
  if (q.isError && !q.data) return <Failed what="the prospects waiting" />;
  if (!q.data) return <Loading />;
  return <ProspectsWaitingView data={q.data} />;
}

/** The hub's one-second read: how many prospects wait on a blocked answer, red when the served verdict is red. */
export function ProspectsWaitingTile({ href }: { href: string }) {
  const q = useStuckOccurrences();
  const data = q.data;
  const red = data?.status === "red";
  return (
    <StatTile label="Prospects waiting" note={data ? `${data.queued.toLocaleString("en-US")} in a moving queue` : undefined} href={href}>
      <Figure
        value={
          q.isError && !data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : !data ? (
            <Shimmer className="h-6 w-16" />
          ) : (
            <span style={{ color: red ? RED : undefined }}>{red ? `${data.stuck.toLocaleString("en-US")} blocked` : "None blocked"}</span>
          )
        }
        sub={data && red ? data.stuckByReason.map((b) => waitReasonName(b.reason)).join(", ") : undefined}
      />
    </StatTile>
  );
}
