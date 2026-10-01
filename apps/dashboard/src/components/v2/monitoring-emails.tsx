"use client";

import { useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getStaffSentPerPeriod } from "@/lib/api";
import { EmptyNote, SectionTitle, Shimmer } from "@/components/v2/ui";
import { SENT_GRAINS, type SentGrain, type SentPeriod } from "@/lib/monitoring/monitoring";

/**
 * Monitoring > Emails (staff only): what actually reached LEADS, apart from the mail we send
 * for our own infrastructure (warmup, warmup replies, inbox-placement seeds), as bar charts
 * per day, week or month. Every count is instantly-service's, per period and per purpose;
 * this file draws and never adds them up. The period still filling is the one the producer
 * flags `inProgress`, drawn dashed.
 */

const ONCE = { staleTime: 5 * 60_000, retry: false } as const;

const GRAIN_LABEL: Record<SentGrain, string> = { day: "Daily", week: "Weekly", month: "Monthly" };
/** How many of the served periods a chart shows: a bar per day since February does not read. */
const WINDOW: Record<SentGrain, number | null> = { day: 90, week: 52, month: null };
const WINDOW_NOTE: Record<SentGrain, string> = { day: "last 90 days", week: "last 52 weeks", month: "since the first send" };

type Series = { key: keyof SentPeriod & ("toLeads" | "manualReplies" | "warmup" | "warmupReplies" | "seeds" | "leadsEmailed"); label: string; color: string };

const LEADS: Series[] = [
  { key: "toLeads", label: "Cold emails", color: "var(--accent)" },
  { key: "manualReplies", label: "Replies by hand", color: "var(--data-sky)" },
];
const OWN: Series[] = [
  { key: "warmup", label: "Warmup", color: "var(--data-teal)" },
  { key: "warmupReplies", label: "Warmup replies", color: "var(--data-lime)" },
  { key: "seeds", label: "Placement tests", color: "var(--data-violet)" },
];

const n = (v: number) => v.toLocaleString("en-US");

function periodLabel(start: string, grain: SentGrain, short = false) {
  const d = new Date(`${start}T00:00:00Z`);
  if (grain === "month") return d.toLocaleDateString("en-US", { month: "short", year: short ? "2-digit" : "numeric", timeZone: "UTC" });
  const md = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return grain === "week" && !short ? `Week of ${md}` : md;
}

export function EmailsCharts() {
  const [grain, setGrain] = useState<SentGrain>("week");
  const q = useAuthQuery(["staffSentPerPeriod", grain], () => getStaffSentPerPeriod(grain), ONCE);
  const all = q.data?.grain === grain ? q.data.periods : undefined;
  const w = WINDOW[grain];
  const periods = all && w != null ? all.slice(-w) : all;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="k-fg2 text-[13px]">Emails we sent, {WINDOW_NOTE[grain]}. Times are UTC.</p>
        <span className="inline-flex items-center gap-1.5" role="group" aria-label="Period">
          {SENT_GRAINS.map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={grain === g}
              onClick={() => setGrain(g)}
              className={grain === g ? "k-btn h-7 px-2 text-[12px]" : "k-btn-ghost h-7 px-2 text-[12px]"}
            >
              {GRAIN_LABEL[g]}
            </button>
          ))}
        </span>
      </div>
      <section>
        <SectionTitle>Sent to leads</SectionTitle>
        <PeriodChart periods={periods} error={q.isError} grain={grain} series={LEADS} extra={(p) => `${n(p.leadsEmailed)} people emailed`} />
      </section>
      <section>
        <SectionTitle>Our own mail</SectionTitle>
        <PeriodChart periods={periods} error={q.isError} grain={grain} series={OWN} />
      </section>
    </div>
  );
}

/**
 * Stacked bars, one per period, a legend with the hovered (else latest) period's counts per
 * series. Heights scale to the tallest bar; the in-progress period is dashed.
 */
function PeriodChart({
  periods,
  error,
  grain,
  series,
  extra,
}: {
  periods: SentPeriod[] | undefined;
  error: boolean;
  grain: SentGrain;
  series: Series[];
  extra?: (p: SentPeriod) => string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const H = 140;
  let body: React.ReactNode;
  if (error) body = <EmptyNote>Could not read the emails sent from production.</EmptyNote>;
  else if (!periods) body = <Shimmer className="m-4 h-[180px]" />;
  else if (!periods.length) body = <EmptyNote>No email sent yet.</EmptyNote>;
  else {
    // Bar height only: the stack's pixel height, never a figure shown.
    const max = Math.max(1, ...periods.map((p) => series.reduce((t, s) => t + p[s.key], 0)));
    const shown = periods.find((p) => p.periodStart === hover) ?? periods[periods.length - 1];
    const every = Math.ceil(periods.length / 6);
    body = (
      <div className="p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="k-fg2 text-[12px]">
            {periodLabel(shown.periodStart, grain)}
            {shown.inProgress && " · in progress"}
            {extra && ` · ${extra(shown)}`}
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
            {series.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-[2px]" style={{ background: s.color }} aria-hidden="true" />
                <span className="k-fg3">{s.label}</span>
                <span className="tabular-nums">{n(shown[s.key])}</span>
              </span>
            ))}
          </span>
        </div>
        <div className="mt-3 flex items-end gap-[2px]" style={{ height: H }} onMouseLeave={() => setHover(null)}>
          {periods.map((p) => (
            <button
              key={p.periodStart}
              type="button"
              aria-label={`${periodLabel(p.periodStart, grain)}: ${series.map((s) => `${s.label} ${n(p[s.key])}`).join(", ")}${p.inProgress ? ", in progress" : ""}`}
              onMouseEnter={() => setHover(p.periodStart)}
              onFocus={() => setHover(p.periodStart)}
              className="flex h-full min-w-0 flex-1 flex-col-reverse"
              style={{ opacity: hover && hover !== p.periodStart ? 0.5 : 1 }}
            >
              {series.map((s) => {
                const v = p[s.key];
                if (v <= 0) return null;
                const h = Math.max(1, (v / max) * H);
                return (
                  <span
                    key={s.key}
                    className="block w-full first:rounded-b-[1px] last:rounded-t-[2px]"
                    style={
                      p.inProgress
                        ? { height: h, border: `1.5px dashed ${s.color}`, background: `color-mix(in oklab, ${s.color} 14%, transparent)` }
                        : { height: h, background: s.color }
                    }
                  />
                );
              })}
            </button>
          ))}
        </div>
        <div className="k-line-subtle flex gap-[2px] border-t pt-1.5">
          {periods.map((p, i) => (
            <span key={p.periodStart} className="k-fg3 min-w-0 flex-1 overflow-visible whitespace-nowrap text-[10.5px]">
              {i % every === 0 ? periodLabel(p.periodStart, grain, true) : ""}
            </span>
          ))}
        </div>
      </div>
    );
  }
  return <div className="k-card">{body}</div>;
}
