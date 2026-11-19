"use client";

import { useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getStaffDistrySpend } from "@/lib/api";
import { BarSpark, Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { dayLabel, dollars, dollarsExact, n } from "@/components/v2/monitoring-charts";
import { Failed, Loading, OK, RED, shortDay } from "@/components/v2/monitoring-sending";
import { cappedToday, todayRow, type DistrySpend, type DistrySpendDay } from "@/lib/monitoring/distry-spend";

/**
 * Monitoring > Copilot > Distry spend on non-clients (staff only, DISTRY-SPEND-CHART-1119). Per UTC day, what Distry
 * spent answering people with no account, against chat-service's day cap, with the visitors it cut at their own cap and
 * the turns it refused once the day cap was reached. Red on the hub IS the alert: only today's row served `alertFired`.
 * This file draws the served values in served order; it computes no figure.
 */

export const DISTRY_SPEND_DAYS = 30;

export function useDistrySpend() {
  return useAuthQuery(["staffDistrySpend", DISTRY_SPEND_DAYS], () => getStaffDistrySpend(DISTRY_SPEND_DAYS), { ...pollOptions, retry: false });
}

const BAR = "var(--data-teal)";
const H = 140;
const visitors = (v: number) => (v === 1 ? "visitor" : "visitors");
const turns = (v: number) => (v === 1 ? "turn" : "turns");
const utcTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });

/**
 * One bar per served day: its non-client spend, red when chat-service served `alertFired` (the day hit the cap), and a
 * dashed line at that day's served cap. The scale is the larger of the served spends and caps, so the line always shows.
 */
export function DistrySpendChart({ data }: { data: DistrySpend }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1e-9, ...data.days.flatMap((d) => [d.nonClientSpendUsd, d.thresholdUsd])) * 1.08;
  const shown = data.days.find((d) => d.day === hover) ?? todayRow(data);
  if (!shown) {
    return (
      <div className="k-card">
        <p className="k-fg3 px-4 py-6 text-[13px]">chat-service has stored no day yet.</p>
      </div>
    );
  }
  return (
    <div className="k-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="k-fg2 text-[12px]">
          {dayLabel(shown.day)}
          {shown.alertFired && shown.alertFiredAt ? ` · cap reached at ${utcTime(shown.alertFiredAt)} UTC` : ""}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px]" style={{ background: shown.alertFired ? RED : BAR }} aria-hidden="true" />
            <span className="k-fg3">Spent</span>
            <span className="tabular-nums" style={{ color: shown.alertFired ? RED : undefined }}>
              {dollarsExact(shown.nonClientSpendUsd)}
            </span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 border-t border-dashed border-[var(--fg-3)]" aria-hidden="true" />
            <span className="k-fg3">Day cap</span>
            <span className="tabular-nums">{dollars(shown.thresholdUsd)}</span>
          </span>
        </span>
      </div>
      <div className="mt-3 flex items-end gap-[3px]" style={{ height: H }} onMouseLeave={() => setHover(null)}>
        {data.days.map((d) => {
          const h = (d.nonClientSpendUsd / max) * 100;
          return (
            <button
              key={d.day}
              type="button"
              aria-label={`${dayLabel(d.day)}: ${dollarsExact(d.nonClientSpendUsd)} of ${dollars(d.thresholdUsd)}${d.alertFired ? ", cap reached" : ""}`}
              onMouseEnter={() => setHover(d.day)}
              onFocus={() => setHover(d.day)}
              className="relative flex h-full min-w-0 flex-1 flex-col justify-end"
              style={{ opacity: hover && hover !== d.day ? 0.5 : 1 }}
            >
              <span
                className="pointer-events-none absolute -left-[2px] -right-[2px] border-t border-dashed border-[var(--fg-3)]"
                style={{ bottom: `${(d.thresholdUsd / max) * 100}%` }}
                aria-hidden="true"
              />
              {d.nonClientSpendUsd > 0 ? (
                <span className="block w-full rounded-t-[2px]" style={{ height: `${Math.max(h, 1.5)}%`, background: d.alertFired ? RED : BAR }} />
              ) : (
                <span className="block h-[3px] w-full rounded-[2px]" style={{ background: "var(--data-track)" }} />
              )}
            </button>
          );
        })}
      </div>
      <div className="k-fg3 mt-1.5 flex justify-between text-[11px] tabular-nums">
        <span>{shortDay(data.days[0].day)}</span>
        <span>{shortDay(data.days[data.days.length - 1].day)}</span>
      </div>
    </div>
  );
}

/** One served count: today's figure, a spark of every served day beside it. */
function CountTile({ label, note, today, values, word }: { label: string; note: string; today: DistrySpendDay; values: number[]; word: (v: number) => string }) {
  const v = values[values.length - 1];
  return (
    <div className="k-card flex flex-col p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="k-label">{label}</span>
        <span className="k-fg3 text-[12px]">{shortDay(today.day)}</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <Figure value={n(v)} unit={word(v)} />
        <BarSpark values={values} />
      </div>
      <p className="k-fg3 mt-2 text-[12px]">{note}</p>
    </div>
  );
}

export function DistrySpendView({ data }: { data: DistrySpend }) {
  const today = todayRow(data);
  const red = cappedToday(data);
  return (
    <div className="space-y-6">
      <div className="k-card flex items-start gap-3 px-4 py-3">
        <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: red ? RED : OK }} aria-hidden="true" />
        <div className="min-w-0">
          {!today ? (
            <p className="text-[14px] font-medium">chat-service has stored no day yet.</p>
          ) : red ? (
            <p className="text-[14px] font-medium" style={{ color: RED }}>
              Today non-clients reached the {dollars(today.thresholdUsd)} cap
              {today.alertFiredAt ? ` at ${utcTime(today.alertFiredAt)} UTC` : ""}: Distry answers them again at midnight UTC.
            </p>
          ) : (
            <p className="text-[14px] font-medium">
              Today Distry spent {dollarsExact(today.nonClientSpendUsd)} of {dollars(today.thresholdUsd)} on non-clients.
            </p>
          )}
          <p className="k-fg3 mt-0.5 text-[12px]">Red only on a day that reached the cap. Each visitor with no account is cut at $5.</p>
        </div>
      </div>

      <section>
        <SectionTitle right={<span>One bar per UTC day. Red = the day reached the cap</span>}>Spend on non-clients</SectionTitle>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <DistrySpendChart data={data} />
          {today && (
            <div className="grid grid-cols-1 gap-3">
              <CountTile
                label="Visitors cut at $5"
                note="Visitors with no account who reached their own $5 cap."
                today={today}
                values={data.days.map((d) => d.visitorsCut)}
                word={visitors}
              />
              <CountTile
                label="Turns refused"
                note="Messages Distry did not answer once the day cap was reached."
                today={today}
                values={data.days.map((d) => d.turnsRefusedByDayCap)}
                word={turns}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function DistrySpendPage() {
  const q = useDistrySpend();
  if (q.isError && !q.data) return <Failed what="Distry's spend on non-clients" />;
  if (!q.data) return <Loading />;
  return <DistrySpendView data={q.data} />;
}

/** The hub's one-second read: today's non-client spend against the cap, red only when today reached it. */
export function DistrySpendTile({ href }: { href: string }) {
  const q = useDistrySpend();
  const data = q.data;
  const today = data ? todayRow(data) : undefined;
  const red = data ? cappedToday(data) : false;
  return (
    <StatTile label="Distry spend on non-clients" note="today, UTC" href={href}>
      <Figure
        value={
          q.isError && !data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : !data ? (
            <Shimmer className="h-6 w-16" />
          ) : !today ? (
            <span className="k-fg4">{"—"}</span>
          ) : (
            <span style={{ color: red ? RED : undefined }}>{dollarsExact(today.nonClientSpendUsd)}</span>
          )
        }
        sub={today ? (red ? "cap reached" : `of ${dollars(today.thresholdUsd)} cap`) : undefined}
      />
    </StatTile>
  );
}
