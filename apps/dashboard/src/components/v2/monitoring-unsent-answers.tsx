"use client";

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getStaffBrands, getStaffUnsentAnswers } from "@/lib/api";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { PeriodBars, dayLabel } from "@/components/v2/monitoring-charts";
import { Dash, Failed, Loading, OK, RED, n, shortDay } from "@/components/v2/monitoring-sending";
import {
  campaignShortName,
  refusalCodeName,
  unsentPerson,
  unsentWhy,
  type UnsentAnswerDay,
  type UnsentAnswers,
} from "@/lib/monitoring/unsent-answers";

/**
 * Monitoring > Triggers > Unsent answers (staff only, ONE-AI-REFUSED-ANSWERS-1029). campaign-service serves, for every
 * person who wrote to a brand, whether the answer we owed them was sent: the verdict (red while one was refused by the
 * sender or given up after failed runs in the last 24 h), the list of unsent answers with the sender's own sentence, and a
 * daily series. Answered by the brand's team, or held while the channel is replayed, is normal. Red on the hub IS the
 * alert (no email). This file draws served values in the served order; it computes no figure.
 */

export const UNSENT_ANSWERS_DAYS = 30;

export function useUnsentAnswers() {
  return useAuthQuery(["staffUnsentAnswers", UNSENT_ANSWERS_DAYS], () => getStaffUnsentAnswers(UNSENT_ANSWERS_DAYS), { ...pollOptions, retry: false });
}

/** A brand named from the staff brand list, a display lookup; an unknown one by its id's head. */
function useBrandName() {
  const brands = useAuthQuery(["staffBrands"], getStaffBrands, { staleTime: Infinity, retry: false });
  return useMemo(() => {
    const names = new Map<string, string>();
    for (const b of brands.data ?? []) names.set(b.id, b.name ?? b.domain ?? b.id);
    return (id: string) => names.get(id) ?? id.slice(0, 8);
  }, [brands.data]);
}

const utcTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });

const answers = (v: number) => `${n(v)} ${v === 1 ? "answer" : "answers"}`;
// Refused and failed are both broken: one red, the other a lighter red so the two read apart.
const REFUSED = "color-mix(in srgb, var(--data-rose) 55%, transparent)";

type Bar = UnsentAnswerDay & { period: string };

/**
 * Two charts side by side: Not sent alone on its own scale (a 468-answer day would flatten 2 failed answers to a pixel),
 * then every answer owed that day, the normal ones in calm colours under the broken ones in red.
 */
export function UnsentAnswersChart({ data }: { data: UnsentAnswers }) {
  const periods: Bar[] = data.byDay.map((d) => ({ ...d, period: d.day }));
  const label = (d: string, short?: boolean) => (short ? shortDay(d) : dayLabel(d));
  const empty = "Nobody wrote to a brand in this window.";
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <PeriodBars
        periods={periods}
        series={[
          { key: "failed", label: "Failed", color: RED, get: (m) => m.failed },
          { key: "refused", label: "Refused", color: REFUSED, get: (m) => m.refused },
        ]}
        caption={(m) => (m.refusedByCode.length ? m.refusedByCode.map((c) => `${c.count} ${refusalCodeName(c.code).toLowerCase()}`).join(", ") : "not sent")}
        format={n}
        label={label}
        empty={empty}
      />
      <PeriodBars
        periods={periods}
        series={[
          { key: "answered", label: "Sent", color: OK, get: (m) => m.answered },
          { key: "answeredByTeam", label: "By their team", color: "var(--data-teal)", get: (m) => m.answeredByTeam },
          { key: "replaying", label: "Replaying", color: "var(--data-sky)", get: (m) => m.replaying },
          { key: "failed", label: "Failed", color: RED, get: (m) => m.failed },
          { key: "refused", label: "Refused", color: REFUSED, get: (m) => m.refused },
        ]}
        format={n}
        label={label}
        empty={empty}
      />
    </div>
  );
}

export function UnsentAnswersView({ data }: { data: UnsentAnswers }) {
  const red = data.status === "red";
  const brand = useBrandName();
  return (
    <div className="space-y-8">
      <div className="k-card flex items-start gap-3 px-4 py-3">
        <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: red ? RED : OK }} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[14px] font-medium">
            {red
              ? `${answers(data.brokenLast24h)} not sent in the last ${data.redWindowHours} h: the person who wrote got nothing.`
              : `Every person who wrote in the last ${data.redWindowHours} h got an answer.`}
          </p>
          <p className="k-fg3 mt-0.5 text-[12px]">
            Red when the sender refused an answer, or every run for it failed. Answered by the brand&apos;s team, or held while the
            channel comes back, is normal. Read {utcTime(data.generatedAt)} UTC.
          </p>
        </div>
      </div>

      <section>
        <SectionTitle right={<span>Days are UTC</span>}>Answers per day</SectionTitle>
        <UnsentAnswersChart data={data} />
      </section>

      <section>
        <SectionTitle count={data.unsent.length}>Not sent</SectionTitle>
        {data.unsent.length === 0 ? (
          <div className="k-card">
            <EmptyNote>Every answer owed in the last {data.days} days was sent.</EmptyNote>
          </div>
        ) : (
          <div className="k-card overflow-hidden">
            <div className="k-scroll overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="k-line-subtle border-b text-left">
                    <th className="k-label px-3 py-2.5 first:pl-4">Person</th>
                    <th className="k-label px-3 py-2.5">Brand · Campaign</th>
                    <th className="k-label px-3 py-2.5">Why not sent</th>
                    <th className="k-label px-3 py-2.5 text-right last:pr-4">When</th>
                  </tr>
                </thead>
                <tbody>
                  {data.unsent.map((a) => {
                    const who = unsentPerson(a);
                    const contact = a.person && who !== (a.person.email ?? a.person.phone) ? a.person.email ?? a.person.phone : null;
                    return (
                      <tr key={a.occurrenceId} className="k-row k-line-subtle border-b last:border-b-0">
                        <td className="px-3 py-2 align-top first:pl-4">
                          {who ? <span className="font-medium">{who}</span> : <Dash />}
                          {contact && <span className="k-fg3 block text-[12px]">{contact}</span>}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span>{brand(a.brandId)}</span>
                          <span className="k-fg3 block text-[12px]" title={a.campaignName ?? `campaign ${a.campaignId}`}>
                            {a.campaignName ? campaignShortName(a.campaignName) : `Campaign ${a.campaignId.slice(0, 8)}`}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: a.state === "failed" ? RED : REFUSED }} aria-hidden="true" />
                            {unsentWhy(a)}
                          </span>
                          {a.refusalReason && <span className="k-fg3 block max-w-[520px] text-[12px]">{a.refusalReason}</span>}
                        </td>
                        <td className="k-mono k-fg2 whitespace-nowrap px-3 py-2 text-right align-top text-[12px] last:pr-4">{utcTime(a.at)} UTC</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {data.unsent.length >= 100 && (
              <p className="k-fg3 k-line-subtle border-t px-4 py-2.5 text-[12px] tabular-nums">Showing the 100 most recent.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export function UnsentAnswersPage() {
  const q = useUnsentAnswers();
  if (q.isError && !q.data) return <Failed what="the unsent answers" />;
  if (!q.data) return <Loading />;
  return <UnsentAnswersView data={q.data} />;
}

/** The hub's one-second read: answers not sent in the last 24 h, red when the served verdict is red. */
export function UnsentAnswersTile({ href }: { href: string }) {
  const q = useUnsentAnswers();
  const data = q.data;
  const red = data?.status === "red";
  return (
    <StatTile label="Unsent answers" note={data ? `last ${data.redWindowHours} h` : undefined} href={href}>
      <Figure
        value={
          q.isError && !data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : !data ? (
            <Shimmer className="h-6 w-16" />
          ) : (
            <span style={{ color: red ? RED : undefined }}>{red ? `${n(data.brokenLast24h)} not sent` : "None"}</span>
          )
        }
        sub={data ? (red ? "the person who wrote got nothing" : "every person who wrote got an answer") : undefined}
      />
    </StatTile>
  );
}
