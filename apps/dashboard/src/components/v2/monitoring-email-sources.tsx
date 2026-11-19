"use client";

import { useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getStaffEmailSources } from "@/lib/api";
import { formatRatePct } from "@/lib/pipe-stats";
import { BarSpark, Figure, SectionTitle, Shimmer, SparkLine, StatTile } from "@/components/v2/ui";
import { dayLabel, n } from "@/components/v2/monitoring-charts";
import { Failed, Loading, OK, shortDay } from "@/components/v2/monitoring-sending";
import { EMAIL_PATHS, emailsFound, todayRow, withoutApolloPct, type EmailSources, type EmailSourcesDay } from "@/lib/monitoring/email-sources";

/**
 * Monitoring > Cost > Email sources (staff only, APOLLO-ZERO-COST-1119). Per UTC day, the emails apollo-service found
 * by path (our stock, a format guess, treg, a paid Apollo reveal) stacked in that order, the share found without
 * Apollo, and the people our free sources found. A high Apollo share is not broken: nothing here is red except an
 * unreadable route. This file draws the served values in served order; the only figure it derives is 1 - apolloShare.
 */

export const EMAIL_SOURCES_DAYS = 30;

export function useEmailSources() {
  return useAuthQuery(["staffEmailSources", EMAIL_SOURCES_DAYS], () => getStaffEmailSources(EMAIL_SOURCES_DAYS), { ...pollOptions, retry: false });
}

const H = 160;
const emails = (v: number) => (v === 1 ? "email" : "emails");
const people = (v: number) => (v === 1 ? "person" : "people");
const pctOrDash = (d: EmailSourcesDay | undefined) => {
  const p = d ? withoutApolloPct(d) : null;
  return p == null ? null : formatRatePct(p);
};

/** One stacked bar per served day, bottom to top in EMAIL_PATHS order; hovering a day puts its counts in the legend. */
export function EmailSourcesChart({ data }: { data: EmailSources }) {
  const [hover, setHover] = useState<string | null>(null);
  const shown = data.days.find((d) => d.day === hover) ?? todayRow(data);
  if (!shown) {
    return (
      <div className="k-card">
        <p className="k-fg3 px-4 py-6 text-[13px]">apollo-service has no day to show yet.</p>
      </div>
    );
  }
  const max = Math.max(1, ...data.days.map(emailsFound)) * 1.08;
  return (
    <div className="k-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="k-fg2 text-[12px]">
          {dayLabel(shown.day)} · {n(emailsFound(shown))} {emails(emailsFound(shown))}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
          {EMAIL_PATHS.map((p) => (
            <span key={p.key} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: p.color }} aria-hidden="true" />
              <span className="k-fg3">{p.label}</span>
              <span className="tabular-nums">{n(shown[p.key])}</span>
            </span>
          ))}
        </span>
      </div>
      <div className="mt-3 flex items-end gap-[3px]" style={{ height: H }} onMouseLeave={() => setHover(null)}>
        {data.days.map((d) => {
          const total = emailsFound(d);
          return (
            <button
              key={d.day}
              type="button"
              aria-label={`${dayLabel(d.day)}: ${EMAIL_PATHS.map((p) => `${p.label} ${n(d[p.key])}`).join(", ")}`}
              onMouseEnter={() => setHover(d.day)}
              onFocus={() => setHover(d.day)}
              className="flex h-full min-w-0 flex-1 flex-col-reverse"
              style={{ opacity: hover && hover !== d.day ? 0.5 : 1 }}
            >
              {total === 0 ? (
                <span className="block h-[3px] w-full rounded-[2px]" style={{ background: "var(--data-track)" }} />
              ) : (
                EMAIL_PATHS.map((p) =>
                  d[p.key] > 0 ? (
                    <span key={p.key} className="block w-full first:rounded-b-[1px] last:rounded-t-[2px]" style={{ height: `${Math.max((d[p.key] / max) * 100, 1)}%`, background: p.color }} />
                  ) : null,
                )
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

/** Today's share found without Apollo, its 30-day line beside it (days with no email left out of the line). */
function ShareTile({ data, today }: { data: EmailSources; today: EmailSourcesDay }) {
  const series = data.days.map(withoutApolloPct).filter((v): v is number => v != null);
  const pct = pctOrDash(today);
  return (
    <div className="k-card flex flex-col p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="k-label">Found without Apollo</span>
        <span className="k-fg3 text-[12px]">{shortDay(today.day)}</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <Figure value={pct ?? <span className="k-fg4">{"—"}</span>} unit={pct ? `of ${n(emailsFound(today))} ${emails(emailsFound(today))}` : undefined} />
        <div className="w-28 shrink-0">
          <SparkLine values={series} className="h-8" color="var(--data-teal)" />
        </div>
      </div>
      <p className="k-fg3 mt-2 text-[12px]">Our stock, a format guess or treg, over the last 30 days.</p>
    </div>
  );
}

/** People our free sources found per day: a small secondary series. */
function FreePeopleTile({ data, today }: { data: EmailSources; today: EmailSourcesDay }) {
  return (
    <div className="k-card flex flex-col p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="k-label">Free people found</span>
        <span className="k-fg3 text-[12px]">{shortDay(today.day)}</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <Figure value={n(today.freeSourcePeople)} unit={people(today.freeSourcePeople)} />
        <BarSpark values={data.days.slice(-14).map((d) => d.freeSourcePeople)} />
      </div>
      <p className="k-fg3 mt-2 text-[12px]">People Leadsforge and Dropleads found for free.</p>
    </div>
  );
}

export function EmailSourcesView({ data }: { data: EmailSources }) {
  const today = todayRow(data);
  const pct = pctOrDash(today);
  return (
    <div className="space-y-6">
      <div className="k-card flex items-start gap-3 px-4 py-3">
        <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: OK }} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[14px] font-medium">
            {!today ? "apollo-service has no day to show yet." : pct ? `Today ${pct} of our emails were found without Apollo.` : "No email found yet today."}
          </p>
          <p className="k-fg3 mt-0.5 text-[12px]">Apollo is our last resort: the lower its share, the cheaper each email.</p>
        </div>
      </div>

      <section>
        <SectionTitle right={<span>One bar per UTC day. Apollo (paid) on top</span>}>Emails found per day</SectionTitle>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <EmailSourcesChart data={data} />
          {today && (
            <div className="grid grid-cols-1 gap-3">
              <ShareTile data={data} today={today} />
              <FreePeopleTile data={data} today={today} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function EmailSourcesPage() {
  const q = useEmailSources();
  if (q.isError && !q.data) return <Failed what="where our emails come from" />;
  if (!q.data) return <Loading />;
  return <EmailSourcesView data={q.data} />;
}

/** The hub's one-second read: today's share found without Apollo. Red only when the route cannot be read. */
export function EmailSourcesTile({ href }: { href: string }) {
  const q = useEmailSources();
  const data = q.data;
  const today = data ? todayRow(data) : undefined;
  const pct = pctOrDash(today);
  return (
    <StatTile label="Emails found without Apollo" note="today, UTC" href={href}>
      <Figure
        value={
          q.isError && !data ? (
            <span className="text-[13px]" style={{ color: "var(--data-rose)" }}>not readable</span>
          ) : !data ? (
            <Shimmer className="h-6 w-16" />
          ) : pct == null ? (
            <span className="k-fg4">{"—"}</span>
          ) : (
            pct
          )
        }
        sub={today && pct ? `of ${n(emailsFound(today))} ${emails(emailsFound(today))}` : undefined}
      />
    </StatTile>
  );
}
