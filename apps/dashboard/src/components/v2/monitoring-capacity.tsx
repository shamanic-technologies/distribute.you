"use client";

import { useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getStaffCapacityHistory, getStaffOpsInfra, getStaffReconcile, getStaffSendForecast } from "@/lib/api";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import {
  CAPACITY_WINDOWS,
  byCountDesc,
  poolWord,
  refusalSentence,
  signed,
  stackHeight,
  utcMoment,
  vendorRefusals,
  vendorWord,
  whole,
  type CapacityWindow,
  type SendForecastDay,
} from "@/lib/monitoring/capacity";
import {
  Dash,
  Failed,
  InboxCell,
  Loading,
  RED,
  StatusWord,
  TD,
  TDR,
  TH,
  THR,
  Table,
  n,
  shortDay,
  useLifecycleRules,
  useShowAll,
} from "@/components/v2/monitoring-sending";

/**
 * Monitoring > Emails > Capacity and Rules (staff only), ported from the admin console's cold-email
 * Overview and Rules pages (MONITORING-ADMIN-PORT-1019). Every figure is the producer's
 * (lib/monitoring/capacity, lib/monitoring/sending): this file draws, looks up and formats.
 *
 * The capacity tile and the capacity line on "Emails sent per day" read the SAME served
 * `infra.fleet.dailyCapacity`: two reads of "how much can we send" is how a tile and the chart
 * under it come to state different numbers for one fleet.
 */

const ONCE = { staleTime: 60_000, retry: false } as const;

export function useOpsInfra() {
  return useAuthQuery(["staffOpsInfra"], getStaffOpsInfra, ONCE);
}
function useSendForecast() {
  return useAuthQuery(["staffSendForecast"], getStaffSendForecast, ONCE);
}

const usd = (v: number) => v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** A tile figure: shimmer while unanswered, a plain word on failure, a dash for a served null. */
function TileValue({ error, pending, value }: { error: boolean; pending: boolean; value: React.ReactNode | null }) {
  if (error) return <span className="k-fg3 text-[13px]">not readable</span>;
  if (pending) return <Shimmer className="h-6 w-16" />;
  return value == null ? <Dash /> : <>{value}</>;
}

// ─── Day chart (hand-drawn bars, like CountChart) ──────────────────────────

type Part = { label: string; value: number | null; color: string; faded?: boolean };
type ChartDay = { day: string; isToday: boolean; parts: Part[]; extra?: string };

/**
 * Stacked bars per day, an optional dashed line (a served ceiling), today marked under its bar.
 * The hover line reads each served part; nothing is added up for display.
 */
function DayChart({ title, note, days, line, legend }: { title: string; note: string; days: ChartDay[]; line?: { value: number; label: string }; legend: Part[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const H = 140;
  // Bar height only: the tallest stack (or the line), never a figure shown.
  const max = Math.max(1, line?.value ?? 0, ...days.map((d) => stackHeight(d.parts.map((p) => p.value))));
  const shown = days.find((d) => d.day === hover) ?? days.find((d) => d.isToday) ?? days[days.length - 1] ?? null;
  const read = (d: ChartDay) => {
    const present = d.parts.filter((p) => p.value != null);
    const words = present.length ? present.map((p) => `${p.label} ${whole(p.value)}`).join(" · ") : "nothing";
    return d.extra ? `${words} · ${d.extra}` : words;
  };
  return (
    <div className="k-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] font-medium">{title}</p>
        <span className="k-fg3 text-[12px] tabular-nums">{shown ? `${shortDay(shown.day)}${shown.isToday ? " (today)" : ""} · ${read(shown)}` : "No day served"}</span>
      </div>
      <p className="k-fg3 mt-0.5 text-[12px]">{note}</p>
      <div className="k-fg3 mt-2 flex flex-wrap items-center gap-3 text-[11px]">
        {legend.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-[2px]" style={{ background: p.color, opacity: p.faded ? 0.45 : 1 }} />
            {p.label}
          </span>
        ))}
        {line && (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 border-t border-dashed" style={{ borderColor: "var(--fg-3)" }} />
            {line.label}
          </span>
        )}
      </div>
      <div className="relative mt-3" style={{ height: H }} onMouseLeave={() => setHover(null)}>
        {line && <span className="absolute inset-x-0 border-t border-dashed" style={{ bottom: (line.value / max) * H, borderColor: "var(--fg-3)" }} aria-hidden="true" />}
        <div className="flex h-full items-end gap-[3px]">
          {days.map((d) => (
            <button
              key={d.day}
              type="button"
              aria-label={`${shortDay(d.day)}: ${read(d)}`}
              onMouseEnter={() => setHover(d.day)}
              onFocus={() => setHover(d.day)}
              className="flex h-full min-w-0 flex-1 flex-col-reverse"
              style={{ opacity: hover && hover !== d.day ? 0.5 : 1 }}
            >
              {d.parts.every((p) => p.value == null) ? (
                <span className="block w-full" style={{ height: 2, background: "var(--data-track)" }} />
              ) : (
                d.parts.map((p) =>
                  p.value != null && p.value > 0 ? <span key={p.label} className="block w-full" style={{ height: Math.max(1, (p.value / max) * H), background: p.color, opacity: p.faded ? 0.45 : 1 }} /> : null,
                )
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="k-line-subtle k-fg3 mt-1.5 flex gap-[3px] border-t pt-1.5 text-[10.5px]">
        {days.map((d, i) => (
          <span key={d.day} className="min-w-0 flex-1 truncate text-center">
            {d.isToday ? <span className="k-fg">Today</span> : i === 0 || i === days.length - 1 ? shortDay(d.day) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

const CREATED = "var(--data-violet)";
const SENT = "var(--data-sky)";

const createdParts = (d: SendForecastDay): Part[] => [
  { label: "Created", value: d.createdActual, color: CREATED },
  { label: "Planned", value: d.createdProjected, color: CREATED, faded: true },
];
// The producer splits what is planned into follow-ups already queued and new sequences' emails:
// both are drawn in one colour and read apart, never added up here.
const sentParts = (d: SendForecastDay): Part[] => [
  { label: "Sent", value: d.actualSent, color: SENT },
  { label: "Follow-ups planned", value: d.inFlightSent, color: SENT, faded: true },
  { label: "New planned", value: d.forecastNew, color: SENT, faded: true },
];

// ─── Capacity page ─────────────────────────────────────────────────────────

function CapacityTiles() {
  const infra = useOpsInfra();
  const forecast = useSendForecast();
  const fleet = infra.data?.fleet;
  const summary = forecast.data?.summary;
  const ip = !infra.data && !infra.isError;
  const fp = !forecast.data && !forecast.isError;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <StatTile label="Daily capacity">
        <Figure value={<TileValue error={infra.isError} pending={ip} value={fleet ? n(fleet.dailyCapacity) : null} />} unit={fleet ? "a day" : undefined} />
        <p className="k-fg3 mt-1 truncate text-[11px]">{fleet ? `${n(fleet.healthyAccountCount)} of ${n(fleet.totalAccountCount)} addresses healthy` : " "}</p>
      </StatTile>
      <StatTile label="Sending now">
        <Figure value={<TileValue error={forecast.isError} pending={fp} value={summary ? whole(summary.observedDailyThroughput) : null} />} unit={summary?.observedDailyThroughput != null ? "a day" : undefined} />
        <p className="k-fg3 mt-1 truncate text-[11px]">Median of our recent sending days</p>
      </StatTile>
      <StatTile label="Backlog">
        <Figure value={<TileValue error={forecast.isError} pending={fp} value={summary ? whole(summary.queuedSendingDays) : null} />} unit={summary?.queuedSendingDays != null ? "sending days" : undefined} />
        <p className="k-fg3 mt-1 truncate text-[11px]">{summary ? `${n(summary.queuedEmails)} emails waiting` : " "}</p>
      </StatTile>
      <StatTile label="Blocked domains">
        <Figure value={<TileValue error={infra.isError} pending={ip} value={fleet ? n(fleet.blockedDomainCount) : null} />} />
        <p className="k-fg3 mt-1 truncate text-[11px]">Our own domains, kept out of cold email</p>
      </StatTile>
      <StatTile label="Total daily budget">
        <Figure value={<TileValue error={forecast.isError} pending={fp} value={summary ? usd(summary.totalDailyBudgetUsd) : null} />} />
        <p className="k-fg3 mt-1 truncate text-[11px]">{summary ? `Across ${n(summary.activeBrandCount)} active brands` : " "}</p>
      </StatTile>
    </div>
  );
}

function FleetByLifecycle() {
  const infra = useOpsInfra();
  if (infra.isError) return <Failed what="the fleet" />;
  if (!infra.data) return <Loading />;
  const states = byCountDesc(infra.data.fleet.byLifecycle);
  if (!states.length) {
    return (
      <div className="k-card">
        <EmptyNote>No address has a state yet.</EmptyNote>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {states.map(([status, count]) => (
        <div key={status} className="k-card px-4 pb-3.5 pt-3">
          <StatusWord status={status} />
          <div className="mt-2">
            <Figure value={n(count)} unit="addresses" />
          </div>
        </div>
      ))}
    </div>
  );
}

function SendingPools() {
  const infra = useOpsInfra();
  const rules = useLifecycleRules();
  const bar = rules.data?.bars.deliveryPctBar ?? null;
  if (infra.isError) return <Failed what="the sending pools" />;
  if (!infra.data) return <Loading />;
  if (!infra.data.pools.length) {
    return (
      <div className="k-card">
        <EmptyNote>No pool reported.</EmptyNote>
      </div>
    );
  }
  return (
    <Table
      head={
        <>
          <th className={TH}>Pool</th>
          <th className={THR}>Mailboxes</th>
          <th className={THR}>Addresses</th>
          <th className={THR}>In production</th>
          <th className={THR}>Capacity a day</th>
          <th className={THR}>Queued</th>
          <th className={THR}>Inbox % (mean)</th>
          <th className={THR}>Campaign, 7 days</th>
          <th className={THR}>Warmup, 7 days</th>
          <th className={THR}>Tests, 7 days</th>
          <th className={THR}>Bounced, 7 days</th>
        </>
      }
    >
      {/* A pool at zero capacity stays listed: it is still bought, and it is why the fleet is smaller than the mailbox count. */}
      {infra.data.pools.map((p) => (
        <tr key={p.pool} className="k-row align-top">
          <td className={TD}>
            <span className="font-medium">{poolWord(p.pool)}</span>
            <span className="k-fg3 mt-0.5 flex flex-wrap gap-x-2 text-[11px] tabular-nums">
              {byCountDesc(p.byLifecycle).map(([status, count]) => (
                <span key={status}>
                  {n(count)} <StatusWord status={status} />
                </span>
              ))}
            </span>
          </td>
          <td className={TDR}>{n(p.mailboxes)}</td>
          <td className={TDR}>{n(p.addresses)}</td>
          <td className={TDR}>{n(p.inProduction)}</td>
          <td className={`${TDR} font-medium`}>{n(p.dailyCapacity)}</td>
          <td className={TDR}>{n(p.queuedSteps)}</td>
          <td className={TDR}>
            <InboxCell value={p.inboxPctMean} bar={bar} />
          </td>
          <td className={TDR}>{n(p.volume7d.outreach)}</td>
          <td className={TDR}>{n(p.volume7d.warmup)}</td>
          <td className={TDR}>{n(p.volume7d.seed)}</td>
          <td className={TDR}>
            {n(p.volume7d.bouncesIn)}
            {p.volume7d.bounceRatePerMille != null && <span className="k-fg3 ml-1 text-[11px]">({p.volume7d.bounceRatePerMille.toLocaleString("en-US", { maximumFractionDigits: 1 })}‰)</span>}
          </td>
        </tr>
      ))}
    </Table>
  );
}

function ForecastCharts() {
  const forecast = useSendForecast();
  const infra = useOpsInfra();
  if (forecast.isError) return <Failed what="the send forecast" />;
  if (!forecast.data) return <Loading />;
  const days = forecast.data.days;
  if (!days.length) {
    return (
      <div className="k-card">
        <EmptyNote>No forecast day served.</EmptyNote>
      </div>
    );
  }
  const capacity = infra.data?.fleet.dailyCapacity;
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      <DayChart
        title="Sequences created per day"
        note="What the daily budget launches, every day, weekends included. A sequence created on a Saturday waits for Monday to go out."
        days={days.map((d) => ({ day: d.date, isToday: d.isToday, parts: createdParts(d) }))}
        legend={createdParts(days[0])}
      />
      <DayChart
        title="Emails sent per day"
        note="What goes out, Monday to Friday. The plan drains the queue at our measured rate. The dashed line is the most we could send, not what we send."
        days={days.map((d) => ({ day: d.date, isToday: d.isToday, parts: sentParts(d) }))}
        legend={sentParts(days[0])}
        line={capacity != null && capacity > 0 ? { value: capacity, label: `Daily capacity ${n(capacity)}` } : undefined}
      />
    </div>
  );
}

function CapacityHistory() {
  const [days, setDays] = useState<CapacityWindow>(30);
  const q = useAuthQuery(["staffCapacityHistory", days], () => getStaffCapacityHistory(days), ONCE);
  const series = q.data?.series ?? [];
  const first = series[0];
  const latest = series[series.length - 1];
  return (
    <section>
      <SectionTitle
        right={
          <span className="inline-flex items-center gap-1.5" role="group" aria-label="Window">
            {CAPACITY_WINDOWS.map((w) => (
              <button key={w} type="button" aria-pressed={days === w} className={days === w ? "k-btn h-7 px-2 text-[12px]" : "k-btn-ghost h-7 px-2 text-[12px]"} onClick={() => setDays(w)}>
                {w} days
              </button>
            ))}
          </span>
        }
      >
        Daily limits over time
      </SectionTitle>
      <p className="k-fg3 -mt-1 mb-3 text-[12px]">The daily limits of the addresses in production, day by day.</p>
      {q.isError ? (
        <Failed what="the capacity history" />
      ) : !q.data || q.isPlaceholderData ? (
        <Loading />
      ) : !series.length ? (
        <div className="k-card">
          <EmptyNote>No capacity history yet.</EmptyNote>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile label="Daily limits now" note={shortDay(latest.date)}>
              <Figure value={n(latest.dailyCapacity)} unit="a day" />
            </StatTile>
            <StatTile label="In production now" note={shortDay(latest.date)}>
              <Figure value={n(latest.inProductionCount)} unit="addresses" />
            </StatTile>
            <StatTile label={`Daily limits ${days} days ago`} note={shortDay(first.date)}>
              <Figure value={n(first.dailyCapacity)} unit="a day" sub={`${n(first.inProductionCount)} addresses`} />
            </StatTile>
          </div>
          <DayChart
            title="Daily limits of the addresses in production"
            note="Hover a day to read how many addresses were in production."
            days={series.map((s) => ({ day: s.date, isToday: false, parts: [{ label: "Daily limits", value: s.dailyCapacity, color: "var(--data-teal)" }], extra: `${n(s.inProductionCount)} addresses` }))}
            legend={[{ label: "Daily limits", value: null, color: "var(--data-teal)" }]}
          />
        </div>
      )}
    </section>
  );
}

function DayByDay() {
  const forecast = useSendForecast();
  const total = forecast.data?.days.length ?? 0;
  const { limit, footer } = useShowAll(total, 10);
  if (forecast.isError) return <Failed what="the send forecast" />;
  if (!forecast.data) return <Loading />;
  const { days, summary } = forecast.data;
  const cell = (v: number | null) => whole(v) ?? <Dash />;
  return (
    <section>
      <SectionTitle count={days.length}>Day by day</SectionTitle>
      <p className="k-fg3 -mt-1 mb-3 text-[12px]">
        Created counts sequences, sent counts emails. One sequence owes several emails on the {summary.followupModel} cadence, so the two do not compare. A dash means the column does not apply that day.
      </p>
      <Table
        head={
          <>
            <th className={TH}>Day</th>
            <th className={THR}>Created</th>
            <th className={THR}>Created, planned</th>
            <th className={THR}>Sent</th>
            <th className={THR}>Follow-ups planned</th>
            <th className={THR}>New planned</th>
            <th className={THR}>Sent, total</th>
          </>
        }
      >
        {days.slice(0, limit).map((d) => (
          <tr key={d.date} className={`k-row ${d.isToday ? "k-selected" : ""}`}>
            <td className={`${TD} k-mono k-fg2 whitespace-nowrap text-[12px]`}>
              {shortDay(d.date)}
              {d.isToday && <span className="k-chip ml-2">Today</span>}
            </td>
            <td className={TDR}>{cell(d.createdActual)}</td>
            <td className={TDR}>{cell(d.createdProjected)}</td>
            <td className={TDR}>{cell(d.actualSent)}</td>
            <td className={TDR}>{cell(d.inFlightSent)}</td>
            <td className={TDR}>{cell(d.forecastNew)}</td>
            <td className={`${TDR} font-medium`}>{cell(d.total)}</td>
          </tr>
        ))}
      </Table>
      {footer}
      <p className="k-fg3 mt-2 text-[12px]">
        {whole(summary.totalNewSequencesPerDay)} new sequences a day across {n(summary.activeBrandCount)} active brands.
      </p>
    </section>
  );
}

function HeldOut() {
  const infra = useOpsInfra();
  if (infra.isError) return <Failed what="who is held out" />;
  if (!infra.data) return <Loading />;
  const { domainPolicy, featureReservations } = infra.data.exclusions;
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div className="k-card overflow-hidden">
        <p className="k-label k-line-subtle border-b px-4 py-2.5">Domain policy {domainPolicy.length}</p>
        {domainPolicy.length === 0 ? (
          <EmptyNote>No domain is kept out by policy.</EmptyNote>
        ) : (
          <ul className="divide-y divide-[var(--line-subtle)]">
            {domainPolicy.map((d) => (
              <li key={d.domain} className="px-4 py-2.5">
                <p className="k-mono text-[12px]">{d.domain}</p>
                <p className="k-fg3 text-[12px]">
                  {d.reason}
                  {d.note ? ` · ${d.note}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="k-card overflow-hidden">
        <p className="k-label k-line-subtle border-b px-4 py-2.5">Kept for one feature {featureReservations.length}</p>
        {featureReservations.length === 0 ? (
          <EmptyNote>No address is kept for one feature.</EmptyNote>
        ) : (
          <ul className="divide-y divide-[var(--line-subtle)]">
            {featureReservations.map((r) => (
              <li key={`${r.accountEmail}:${r.featureSlug}`} className="px-4 py-2.5">
                <p className="k-mono break-all text-[12px]">{r.accountEmail}</p>
                <p className="k-fg3 text-[12px]">Kept for {r.featureSlug}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ReconcileTable() {
  const q = useAuthQuery(["staffReconcile"], getStaffReconcile, ONCE);
  if (q.isError) return <Failed what="the reconciliation" />;
  if (!q.data) return <Loading />;
  return (
    <>
      <Table
        head={
          <>
            <th className={TH}>Fact</th>
            <th className={THR}>Our count</th>
            <th className={THR}>Instantly</th>
            <th className={THR}>Difference</th>
            <th className={TH}>State</th>
          </>
        }
      >
        {q.data.metrics.map((m) => (
          <tr key={m.key} className="k-row">
            <td className={TD}>{m.label}</td>
            <td className={TDR}>{n(m.local)}</td>
            <td className={TDR}>{n(m.instantly)}</td>
            <td className={TDR} style={{ color: m.delta !== 0 ? "var(--data-amber)" : undefined }}>
              {signed(m.delta)}
            </td>
            <td className={TD}>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px]">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.delta !== 0 ? "var(--data-amber)" : "var(--run)" }} />
                {m.delta !== 0 ? "Drifting" : "In sync"}
              </span>
            </td>
          </tr>
        ))}
      </Table>
      <p className="k-fg3 mt-2 text-[12px]">
        Instantly is the source of truth. Difference = our count minus Instantly&apos;s, as served at {new Date(q.data.asOf).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC.
      </p>
    </>
  );
}

// ─── A mailbox vendor refusing us (SEND-PRIMEFORGE-402-1030) ───────────────

/**
 * One card per vendor refusing our API: its mailboxes send nothing until it answers again. Drawn
 * only when instantly-service serves a refusal; nothing at all otherwise (an empty or absent field).
 */
function VendorRefusals() {
  const infra = useOpsInfra();
  const refusals = infra.data ? vendorRefusals(infra.data) : [];
  if (!refusals.length) return null;
  return (
    <section className="space-y-3">
      {refusals.map((r) => (
        <div key={r.vendor} className="k-card p-4">
          <p className="inline-flex items-center gap-2 text-[14px] font-medium" style={{ color: RED }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: RED }} />
            {refusalSentence(r)}
          </p>
          <p className="k-label mt-3">{vendorWord(r.vendor)} answered</p>
          <p className="k-inset k-mono mt-1 break-words rounded-[8px] px-3 py-2 text-[12px]">{r.error}</p>
          <p className="k-fg3 mt-2 text-[12px] tabular-nums">Last refused at {utcMoment(r.lastSeenAt)}. Turns normal the moment {vendorWord(r.vendor)} answers again.</p>
        </div>
      ))}
    </section>
  );
}

/** The hub tile: shown only while a vendor refuses us, red, naming it. Nothing otherwise. */
export function VendorRefusalTile({ href }: { href: string }) {
  const infra = useOpsInfra();
  const refusals = infra.data ? vendorRefusals(infra.data) : [];
  if (!refusals.length) return null;
  return (
    <StatTile label="Mailbox vendors" note="refusing us" href={href}>
      <Figure value={<span style={{ color: RED }}>{refusals.map((r) => vendorWord(r.vendor)).join(", ")}</span>} />
      {refusals.map((r) => (
        <p key={r.vendor} className="k-fg2 mt-1 text-[12px]">
          {refusalSentence(r)}
        </p>
      ))}
    </StatTile>
  );
}

export function CapacityPage({ base: _base }: { base: string }) {
  const infra = useOpsInfra();
  return (
    <div className="space-y-8">
      <VendorRefusals />
      <CapacityTiles />
      <section>
        <SectionTitle count={infra.data?.fleet.totalAccountCount ?? null}>Fleet by state</SectionTitle>
        <p className="k-fg3 -mt-1 mb-3 text-[12px]">Every sending address, by the state the rules put it in. Only addresses in production get new sequences.</p>
        <FleetByLifecycle />
      </section>
      <section>
        <SectionTitle count={infra.data?.pools.length ?? null}>Sending pools</SectionTitle>
        <p className="k-fg3 -mt-1 mb-3 text-[12px]">One row per pool of mailboxes. A pool with no capacity stays listed.</p>
        <SendingPools />
      </section>
      <section>
        <SectionTitle>Created and sent per day</SectionTitle>
        <ForecastCharts />
      </section>
      <CapacityHistory />
      <DayByDay />
      <section>
        <SectionTitle>Held out of the pool</SectionTitle>
        <p className="k-fg3 -mt-1 mb-3 text-[12px]">Why a mailbox that looks healthy never gets a sequence.</p>
        <HeldOut />
      </section>
      <section>
        <SectionTitle>Our counts against Instantly</SectionTitle>
        <ReconcileTable />
      </section>
    </div>
  );
}

// ─── Rules page ────────────────────────────────────────────────────────────

/** Who a rule applies to, in words. Unknown prints as served. */
const APPLIES_WORD: Record<string, string> = { all: "Every address", "instantly-transport-only": "Addresses sent through Instantly" };

function Fact({ label, value, unit, note }: { label: string; value: string; unit?: string; note: string }) {
  return (
    <StatTile label={label}>
      <Figure value={value} unit={unit} />
      <p className="k-fg3 mt-1 text-[11px]">{note}</p>
    </StatTile>
  );
}

const share = (v: number) => v.toLocaleString("en-US", { style: "percent", maximumFractionDigits: 0 });

export function RulesPage({ base: _base }: { base: string }) {
  const rules = useLifecycleRules();
  if (rules.isError) return <Failed what="the lifecycle rules" />;
  if (!rules.data) return <Loading />;
  const { order, states, bars, ramp, placement, warmup } = rules.data;
  const limit = (v: number | null) => (v == null ? <span className="k-fg3 text-[12px]">Unchanged</span> : n(v));
  return (
    <div className="space-y-8">
      <section>
        <SectionTitle count={order.length}>Rule order</SectionTitle>
        <p className="k-fg3 -mt-1 mb-3 text-[12px]">The first rule that matches decides the state. The rules below it are never read.</p>
        <ol className="k-card divide-y divide-[var(--line-subtle)] overflow-hidden">
          {order.map((r, i) => (
            <li key={`${r.rule}:${i}`} className="flex items-start gap-3 px-4 py-3">
              <span className="k-inset k-fg2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] tabular-nums">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px]">{r.rule}</span>
                <span className="k-fg3 mt-0.5 block text-[12px]">{APPLIES_WORD[r.appliesTo] ?? r.appliesTo}</span>
              </span>
              <StatusWord status={r.leadsTo} />
            </li>
          ))}
        </ol>
      </section>

      <section>
        <SectionTitle count={states.length}>States</SectionTitle>
        <p className="k-fg3 -mt-1 mb-3 text-[12px]">What each state means, and the limits an address keeps while in it.</p>
        <Table
          head={
            <>
              <th className={TH}>State</th>
              <th className={TH}>Means</th>
              <th className={TH}>New sequences</th>
              <th className={THR}>Campaign a day</th>
              <th className={THR}>Warmup a day</th>
            </>
          }
        >
          {states.map((s) => (
            <tr key={s.status} className="k-row align-top">
              <td className={TD}>
                <StatusWord status={s.status} />
              </td>
              <td className={`${TD} k-fg2 max-w-[520px]`}>{s.meaning}</td>
              <td className={TD}>
                <span className="inline-flex items-center gap-1.5 text-[12px]">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.newSends ? "var(--run)" : "var(--fg-4)" }} />
                  {s.newSends ? "Yes" : "No"}
                </span>
              </td>
              {/* null = the limit is left as it is in this state, a different fact from a limit of 0. */}
              <td className={TDR}>{limit(s.campaignDailyLimit)}</td>
              <td className={TDR}>{limit(s.warmupDaily)}</td>
            </tr>
          ))}
        </Table>
      </section>

      <section>
        <SectionTitle>Bars</SectionTitle>
        <p className="k-fg3 -mt-1 mb-3 text-[12px]">What a mailbox must clear to enter production.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Fact label="Warmup health" value={n(bars.healthEntryBar)} note="Score needed to enter production" />
          <Fact label="Inbox placement" value={`${n(bars.deliveryPctBar)}%`} note="A placement test must land above this" />
          <Fact label="Test valid for" value={n(bars.deliveryEvidenceMaxAgeDays)} unit="days" note="After that the test is too old" />
        </div>
      </section>

      <section>
        <SectionTitle>Ramp</SectionTitle>
        <p className="k-fg3 -mt-1 mb-3 text-[12px]">How fast a mailbox may grow what it sends each day.</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Fact label="Start" value={n(ramp.floorPerDay)} unit="a day" note="Where a new mailbox starts" />
          <Fact label="Growth" value={`×${ramp.growthFactor.toLocaleString("en-US")}`} unit="a day" note="Compounding" />
          <Fact label="Window" value={n(ramp.volumeWindowDays)} unit="days" note="Volume read over this window" />
          <Fact label="Ceiling" value={n(ramp.ceiling)} unit="a day" note="The cap it grows toward" />
          <Fact label="Grown up at" value={n(ramp.matureAgeDays)} unit="days" note="Past this age the ramp lets go" />
        </div>
        <p className="k-fg3 mt-3 text-[12px]">Growth is measured on the {ramp.statistic}.</p>
      </section>

      <section>
        <SectionTitle>Placement testing</SectionTitle>
        <p className="k-fg3 -mt-1 mb-3 text-[12px]">When a mailbox gets tested, and how often.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Fact label="First test at" value={n(placement.testableMinAgeDays)} unit="days old" note="Youngest mailbox we test" />
          <Fact label="Test every" value={n(placement.seedTestIntervalDays)} unit="days" note="Time between two tests" />
          <Fact label="Urgent at" value={n(placement.seedEvidenceUrgentAgeDays)} unit="days" note="A test this old is redone first" />
        </div>
      </section>

      <section>
        <SectionTitle>Warmup</SectionTitle>
        <p className="k-fg3 -mt-1 mb-3 text-[12px]">How much warmup a mailbox sends.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Fact label="Partners" value={n(warmup.partnersPerDay)} unit="a day" note="Mailboxes it warms up with each day" />
          <Fact label="Most warmup" value={n(warmup.maxPerDay)} unit="a day" note="Hard ceiling" />
          <Fact label="Share of its cap" value={share(warmup.maxShareOfCap)} note="Most of its own daily cap warmup may take" />
        </div>
      </section>
    </div>
  );
}
