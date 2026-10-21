"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import {
  getStaffLifecycleRules,
  getStaffOpsAddresses,
  getStaffOpsDomains,
  getStaffOpsMailboxes,
  getStaffOpsMessages,
  getStaffPlacementAlerts,
  getStaffSeedPlacementDaily,
  getStaffSenderHealth,
} from "@/lib/api";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import {
  ALERT_PROVIDERS,
  INBOX_PROVIDERS,
  alertSeries,
  entityPath,
  MESSAGE_KIND_WORD,
  latestMeasured,
  underBar,
  latestSenderHealthDay,
  lifecycleWord,
  ADDRESS_TABS,
  addressTab,
  bucketQueued,
  mailboxInProduction,
  type AddressTabKey,
  type InboxProvider,
  type SeedPlacementCell,
} from "@/lib/monitoring/sending";

/**
 * Monitoring > Emails (staff only): is our sending healthy, readable in one second, then the
 * detail per inbox provider, domain, mailbox and sending address. Every figure is
 * instantly-service's (see lib/monitoring/sending): the inbox % per provider per day is its stored
 * seed-placement series, the bar is its own lifecycle rule (`bars.deliveryPctBar`), the mailboxes
 * kept out of prospect mail are its sender-health series. This file draws, looks up the latest
 * measured day, and colours a value red under the producer's bar; it never sums or averages.
 */

const ONCE = { staleTime: 60_000, retry: false } as const;
/** The window the health charts read: 30 days, the producer's daily rows. */
export const HEALTH_DAYS = 30;

export function useSeedPlacement() {
  return useAuthQuery(["staffSeedPlacementDaily", HEALTH_DAYS], () => getStaffSeedPlacementDaily(HEALTH_DAYS), pollOptions);
}
export function useSenderHealth() {
  return useAuthQuery(["staffSenderHealth", HEALTH_DAYS], () => getStaffSenderHealth(HEALTH_DAYS), pollOptions);
}
/** The inbox-placement alert's daily evaluation: the hub's red comes from here, one source with the alert email. */
export function usePlacementAlerts() {
  return useAuthQuery(["staffPlacementAlerts", HEALTH_DAYS], () => getStaffPlacementAlerts(HEALTH_DAYS), pollOptions);
}
export function useLifecycleRules() {
  return useAuthQuery(["staffLifecycleRules"], getStaffLifecycleRules, ONCE);
}
export function useOpsDomains() {
  return useAuthQuery(["staffOpsDomains"], getStaffOpsDomains, ONCE);
}
export function useOpsMailboxes() {
  return useAuthQuery(["staffOpsMailboxes"], getStaffOpsMailboxes, ONCE);
}
export function useOpsAddresses() {
  return useAuthQuery(["staffOpsAddresses"], getStaffOpsAddresses, ONCE);
}

export const RED = "var(--data-rose)";
export const OK = "var(--run)";
export const n = (v: number) => v.toLocaleString("en-US");
export const pct = (v: number | null) => (v == null ? null : `${v.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`);
export const shortDay = (day: string) => new Date(`${day.slice(0, 10)}T00:00:00.000Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
export const vendorName = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);
export const Dash = () => <span className="k-fg4">{"—"}</span>;

// ─── Health tiles (the hub's first row) ────────────────────────────────────

/** Small daily bars, red on a day the producer flags below its bar, empty slot on a day not measured. Draws only. */
function DayBars({ values, red, height = 24 }: { values: Array<number | null>; red: boolean[]; height?: number }) {
  return (
    <div className="flex items-end gap-[2px]" style={{ height }} aria-hidden="true">
      {values.map((v, i) => (
        <span
          key={i}
          className="w-[4px] rounded-[1px]"
          style={
            v == null
              ? { height: 2, background: "var(--data-track)" }
              : { height: Math.max(2, (v / 100) * height), background: red[i] ? RED : OK }
          }
        />
      ))}
    </div>
  );
}

/**
 * Inbox % at one provider on its latest measured day, over EVERY mailbox's seed tests (the seed
 * series: what the owner never saw at 40-60 % spam for weeks, 2026-10-19), red under the bar the
 * inbox-placement alert fires on (served `bar.inboxPctOfFound`, never typed). The alert itself
 * reads the mailboxes the automatic cut still lets mail that provider: that figure sits under it,
 * so a green alert never hides a spam-heavy fleet.
 */
function InboxTile({ provider, name }: { provider: string; name: string }) {
  const alerts = usePlacementAlerts();
  const series = alerts.data ? alertSeries(alerts.data, provider) : undefined;
  const latest = series?.latest;
  const recent = series?.days.slice(-14) ?? [];
  const bar = alerts.data?.bar.inboxPctOfFound ?? null;
  const red = latest && bar != null ? underBar(latest.fleet.inboxPct, bar) : false;
  return (
    <StatTile label={`Inbox at ${name}`} note={latest ? shortDay(latest.day) : undefined}>
      <div className="flex items-end justify-between gap-2">
        <Figure
          value={
            alerts.isError ? (
              <span className="k-fg3 text-[13px]">not readable</span>
            ) : series === undefined ? (
              <Shimmer className="h-6 w-16" />
            ) : !latest || latest.fleet.inboxPct == null ? (
              <Dash />
            ) : (
              <span style={{ color: red ? RED : undefined }}>{pct(latest.fleet.inboxPct)}</span>
            )
          }
          sub={latest ? "all our mailboxes" : undefined}
        />
        {series && bar != null && <DayBars values={recent.map((d) => (d.measured ? d.fleet.inboxPct : null))} red={recent.map((d) => d.measured && underBar(d.fleet.inboxPct, bar))} />}
      </div>
      <p className="k-fg3 mt-1 truncate text-[11px]">
        {series && !latest
          ? `No measured day in ${HEALTH_DAYS} days`
          : latest && bar != null
            ? `Bar ${bar}% · after the cut ${pct(latest.allowed.inboxPct) ?? "—"}${latest.below ? " (alert)" : ""} · ${n(latest.mailboxesCut)} cut`
            : " "}
      </p>
    </StatTile>
  );
}

function CutTile() {
  const health = useSenderHealth();
  const latest = health.data ? latestSenderHealthDay(health.data) : undefined;
  const spam = latest?.mostlySpamMailboxes ?? null;
  return (
    <StatTile label="Mailboxes cut from prospects" note={latest ? shortDay(latest.day) : undefined}>
      <div className="flex items-baseline gap-x-4">
        <Figure
          value={
            health.isError ? (
              <span className="k-fg3 text-[13px]">not readable</span>
            ) : latest === undefined ? (
              <Shimmer className="h-6 w-16" />
            ) : latest === null ? (
              <Dash />
            ) : (
              <span style={{ color: spam && spam.google > 0 ? RED : undefined }}>{spam ? n(spam.google) : <Dash />}</span>
            )
          }
          sub={latest ? "mostly spam at Google" : undefined}
        />
      </div>
      <p className="k-fg3 mt-1 truncate text-[11px]">
        {latest && spam
          ? `${n(spam.microsoft)} at Microsoft 365 · ${n(spam.microsoft_consumer)} at Outlook.com · ${latest.refusedMailboxes == null ? "—" : n(latest.refusedMailboxes)} refused by the mail server`
          : latest === null
            ? `No check in ${HEALTH_DAYS} days`
            : " "}
      </p>
    </StatTile>
  );
}

/** The one-second read: inbox % at every provider the alert measures, red when it flags the day below, and the mailboxes cut. */
export function SendingHealthTiles() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {ALERT_PROVIDERS.map((p) => (
        <InboxTile key={p.key} provider={p.key} name={p.name} />
      ))}
      <CutTile />
    </div>
  );
}

/** The hub's headline: at which inbox providers every mailbox's tests sit under the alert's bar on their latest measured day. */
export function useSendingVerdict(): string | null {
  const alerts = usePlacementAlerts();
  if (!alerts.data) return null;
  const data = alerts.data;
  const measured = ALERT_PROVIDERS.map((p) => ({ p, latest: alertSeries(data, p.key).latest })).filter((x) => x.latest !== null);
  if (!measured.length) return `No inbox test in ${HEALTH_DAYS} days`;
  const under = measured.filter((x) => underBar(x.latest!.fleet.inboxPct, data.bar.inboxPctOfFound));
  if (!under.length) return `Inbox at or above the ${data.bar.inboxPctOfFound}% bar at every provider tested`;
  const names = under.map((x) => x.p.name);
  return `Inbox under the ${data.bar.inboxPctOfFound}% bar at ${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0]}`;
}

// ─── Tables ────────────────────────────────────────────────────────────────

export const TH = "k-label px-3 py-2.5 text-left font-medium first:pl-4 last:pr-4 whitespace-nowrap";
export const THR = `${TH} text-right`;
export const TD = "px-3 py-2 first:pl-4 last:pr-4";
export const TDR = `${TD} text-right tabular-nums`;

export function Table({ head, children }: { head: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="k-card k-scroll overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead className="k-line-subtle border-b">
          <tr>{head}</tr>
        </thead>
        <tbody className="divide-y divide-[var(--line-subtle)]">{children}</tbody>
      </table>
    </div>
  );
}

export function Loading() {
  return (
    <div className="k-card space-y-2 p-4">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Shimmer key={i} className="h-6 w-full" />
      ))}
    </div>
  );
}

export function Failed({ what }: { what: string }) {
  return (
    <div className="k-card">
      <EmptyNote>Could not read {what} from production.</EmptyNote>
    </div>
  );
}

/** An inbox % cell: red under the producer's bar, a dash when never tested. */
export function InboxCell({ value, bar }: { value: number | null; bar: number | null }) {
  if (value == null) return <Dash />;
  return <span style={{ color: bar != null && value < bar ? RED : undefined }}>{pct(value)}</span>;
}

export function StatusWord({ status }: { status: string | null }) {
  const w = lifecycleWord(status);
  if (!w) return <Dash />;
  const color = status === "in_production" ? OK : status === "in_recovery" ? "var(--data-amber)" : "var(--fg-3)";
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px]">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {w}
    </span>
  );
}

/** "Show all N" under a long table: the rows stay in the producer's order. */
export function useShowAll(total: number, first = 50) {
  const [all, setAll] = useState(false);
  const limit = all ? total : first;
  const footer =
    total > first ? (
      <div className="k-fg3 k-line-subtle flex items-center justify-between border-t px-4 py-2.5 text-[12px] tabular-nums">
        <span>
          {n(Math.min(limit, total))} of {n(total)}
        </span>
        <button type="button" className="k-btn-ghost h-6 px-2 text-[12px]" onClick={() => setAll((v) => !v)}>
          {all ? "Show fewer" : `Show all ${n(total)}`}
        </button>
      </div>
    ) : null;
  return { limit, footer };
}

// ─── Inbox providers page ──────────────────────────────────────────────────

/** One provider's inbox % per day, a bar per day, red under the bar, the bar drawn as a line. */
function ProviderChart({ provider, name, bar }: { provider: InboxProvider; name: string; bar: number }) {
  const placement = useSeedPlacement();
  const [hover, setHover] = useState<string | null>(null);
  const days = placement.data?.days ?? [];
  const latest = placement.data ? latestMeasured(days, provider) : null;
  const shown = days.find((d) => d.day === hover) ?? [...days].reverse().find((d) => d[provider].inboxPct !== null) ?? null;
  const H = 120;
  const cell: SeedPlacementCell | null = shown ? shown[provider] : null;
  return (
    <div className="k-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-medium">Inbox at {name}</p>
        <span className="k-fg3 text-[12px] tabular-nums">
          {shown && cell && cell.inboxPct !== null
            ? `${shortDay(shown.day)} · ${pct(cell.inboxPct)} of ${n(cell.seeds)} tests`
            : shown
              ? `${shortDay(shown.day)} · no test`
              : "Never tested"}
        </span>
      </div>
      <div className="relative mt-3" style={{ height: H }} onMouseLeave={() => setHover(null)}>
        <span className="absolute inset-x-0 border-t border-dashed" style={{ bottom: (bar / 100) * H, borderColor: "var(--fg-4)" }} aria-hidden="true" />
        <div className="flex h-full items-end gap-[2px]">
          {days.map((d) => {
            const v = d[provider].inboxPct;
            return (
              <button
                key={d.day}
                type="button"
                aria-label={`${shortDay(d.day)}: ${v == null ? "no test" : `${pct(v)} in the inbox`}`}
                onMouseEnter={() => setHover(d.day)}
                onFocus={() => setHover(d.day)}
                className="flex h-full min-w-0 flex-1 items-end"
              >
                <span
                  className="block w-full rounded-t-[2px]"
                  style={v == null ? { height: 2, background: "var(--data-track)" } : { height: Math.max(2, (v / 100) * H), background: v < bar ? RED : OK, opacity: hover && hover !== d.day ? 0.5 : 1 }}
                />
              </button>
            );
          })}
        </div>
      </div>
      <div className="k-line-subtle k-fg3 mt-1.5 flex justify-between border-t pt-1.5 text-[10.5px]">
        <span>{days[0] ? shortDay(days[0].day) : ""}</span>
        <span>{bar}% bar</span>
        <span>{days.length ? shortDay(days[days.length - 1].day) : ""}</span>
      </div>
      {latest && latest.byVendor.length > 0 && (
        <p className="k-fg3 mt-2 text-[12px]">
          {shortDay(latest.day)} by mailbox vendor:{" "}
          {latest.byVendor.map((v, i) => (
            <span key={v.vendor}>
              {i > 0 && " · "}
              {vendorName(v.vendor)} <InboxCell value={v.cell.inboxPct} bar={bar} />
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

/** Counts per day as bars (mailboxes cut), a day with no check left empty. Draws only. */
export function CountChart({
  title,
  series,
  note,
  now,
  legend,
  emptyLabel = "no check",
}: {
  title: string;
  note: string;
  series: Array<{ day: string; parts: Array<{ label: string; value: number; color: string }> | null }>;
  /** The served latest figure, shown big under the title (a dash when the latest day is not checked). */
  now?: string | null;
  /** Colour key for a stacked chart. */
  legend?: Array<{ label: string; color: string }>;
  /** How a day with no check (a null point) reads. */
  emptyLabel?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const H = 100;
  // Bar height only: the tallest stack, never a figure shown.
  const max = Math.max(1, ...series.map((s) => (s.parts ?? []).reduce((t, p) => t + p.value, 0)));
  const shown = series.find((s) => s.day === hover) ?? [...series].reverse().find((s) => s.parts !== null) ?? null;
  const empty = emptyLabel.charAt(0).toUpperCase() + emptyLabel.slice(1);
  return (
    <div className="k-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] font-medium">{title}</p>
        <span className="k-fg3 text-[12px] tabular-nums">
          {shown ? `${shortDay(shown.day)} · ${shown.parts ? shown.parts.map((p) => `${p.label} ${n(p.value)}`).join(" · ") : emptyLabel}` : `${empty}`}
        </span>
      </div>
      {now !== undefined && <p className="mt-1 text-[22px] font-medium leading-7 tracking-[-0.02em] tabular-nums">{now ?? <Dash />}</p>}
      <p className="k-fg3 mt-0.5 text-[12px]">{note}</p>
      {legend && legend.length > 1 && (
        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
          {legend.map((l) => (
            <span key={l.label} className="k-fg3 inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: l.color }} aria-hidden="true" />
              {l.label}
            </span>
          ))}
        </p>
      )}
      <div className="mt-3 flex items-end gap-[2px]" style={{ height: H }} onMouseLeave={() => setHover(null)}>
        {series.map((s) => (
          <button
            key={s.day}
            type="button"
            aria-label={`${shortDay(s.day)}: ${s.parts ? s.parts.map((p) => `${p.label} ${n(p.value)}`).join(", ") : "no check"}`}
            onMouseEnter={() => setHover(s.day)}
            onFocus={() => setHover(s.day)}
            className="flex h-full min-w-0 flex-1 flex-col-reverse"
            style={{ opacity: hover && hover !== s.day ? 0.5 : 1 }}
          >
            {s.parts === null ? (
              <span className="block w-full" style={{ height: 2, background: "var(--data-track)" }} />
            ) : (
              s.parts.map((p) => (p.value > 0 ? <span key={p.label} className="block w-full" style={{ height: Math.max(1, (p.value / max) * H), background: p.color }} /> : null))
            )}
          </button>
        ))}
      </div>
      <div className="k-line-subtle k-fg3 mt-1.5 flex justify-between border-t pt-1.5 text-[10.5px]">
        <span>{series[0] ? shortDay(series[0].day) : ""}</span>
        <span>{series.length ? shortDay(series[series.length - 1].day) : ""}</span>
      </div>
    </div>
  );
}

export function InboxProvidersPage() {
  const placement = useSeedPlacement();
  const rules = useLifecycleRules();
  const health = useSenderHealth();
  if (placement.isError || rules.isError) return <Failed what="the placement tests" />;
  if (!placement.data || !rules.data) return <Loading />;
  const bar = rules.data.bars.deliveryPctBar;
  return (
    <div className="space-y-8">
      <section>
        <SectionTitle right={<span>Red under the {bar}% bar a mailbox needs for new prospects</span>}>Inbox placement, per day</SectionTitle>
        <p className="k-fg3 -mt-1 mb-3 text-[12px]">Our test emails to seed inboxes we own: the share that landed in the inbox. Each provider filters on its own, so each is measured apart.</p>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {INBOX_PROVIDERS.map((p) => (
            <ProviderChart key={p.key} provider={p.key} name={p.name} bar={bar} />
          ))}
        </div>
      </section>
      <section>
        <SectionTitle>Mailboxes cut from prospects</SectionTitle>
        {health.isError ? (
          <Failed what="the mailboxes cut" />
        ) : !health.data ? (
          <Loading />
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <CountChart
              title="Mostly in spam, by provider"
              note="More than half of a mailbox's tests in spam there: it sends nothing there, follow-ups included."
              series={health.data.days.map((d) => ({
                day: d.day,
                parts: d.mostlySpamMailboxes
                  ? [
                      { label: "Google", value: d.mostlySpamMailboxes.google, color: "var(--data-sky)" },
                      { label: "Microsoft 365", value: d.mostlySpamMailboxes.microsoft, color: "var(--data-teal)" },
                      { label: "Outlook.com", value: d.mostlySpamMailboxes.microsoft_consumer, color: "var(--data-violet)" },
                    ]
                  : null,
              }))}
            />
            <CountChart
              title="Refused by the mail server"
              note="Blacklisted or needs a reconnect: it comes back by itself once fixed."
              series={health.data.days.map((d) => ({ day: d.day, parts: d.refusedMailboxes === null ? null : [{ label: "Mailboxes", value: d.refusedMailboxes, color: RED }] }))}
            />
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Domains, mailboxes, accounts ──────────────────────────────────────────

export function DomainsPage({ base }: { base: string }) {
  const q = useOpsDomains();
  const rules = useLifecycleRules();
  const bar = rules.data?.bars.deliveryPctBar ?? null;
  const { limit, footer } = useShowAll(q.data?.domains.length ?? 0);
  if (q.isError) return <Failed what="the domains" />;
  if (!q.data) return <Loading />;
  return (
    <section>
      <SectionTitle count={q.data.domains.length}>Every sending domain</SectionTitle>
      <Table
        head={
          <>
            <th className={TH}>Domain</th>
            <th className={TH}>Vendor</th>
            <th className={TH}>Status</th>
            <th className={THR}>Mailboxes</th>
            <th className={THR}>Addresses</th>
            <th className={THR}>In production</th>
            <th className={THR}>Inbox %</th>
            <th className={TH}>Tested</th>
            <th className={THR}>Sent, 30 days</th>
            <th className={TH}>Expires</th>
          </>
        }
      >
        {q.data.domains.slice(0, limit).map((d) => (
          <tr key={`${d.provider}|${d.domain}`} className="k-row">
            <td className={`${TD} k-mono text-[12px]`}>
              <Link href={`${base}/${entityPath("domain", d.domain)}`} className="hover:underline">
                {d.domain}
              </Link>
            </td>
            <td className={TD}>{d.provider ? vendorName(d.provider) : <Dash />}</td>
            <td className={`${TD} text-[12px]`}>{d.absentSince ? `Gone since ${shortDay(d.absentSince)}` : d.status ? vendorName(d.status) : <Dash />}</td>
            <td className={TDR}>{n(d.mailboxes)}</td>
            <td className={TDR}>{n(d.addresses.total)}</td>
            <td className={TDR}>{n(d.addresses.byLifecycle.in_production ?? 0)}</td>
            <td className={TDR}>
              <InboxCell value={d.delivery.inboxPct} bar={bar} />
            </td>
            <td className={`${TD} k-mono k-fg2 text-[12px]`}>{d.delivery.testedAt ? shortDay(d.delivery.testedAt) : <Dash />}</td>
            <td className={TDR}>{n(d.sentLast30d)}</td>
            <td className={`${TD} k-mono k-fg2 text-[12px]`}>{d.expiresAt ? shortDay(d.expiresAt) : <Dash />}</td>
          </tr>
        ))}
      </Table>
      {footer}
    </section>
  );
}

export function MailboxesPage({ base }: { base: string }) {
  const q = useOpsMailboxes();
  const rules = useLifecycleRules();
  const bar = rules.data?.bars.deliveryPctBar ?? null;
  const { limit, footer } = useShowAll(q.data?.mailboxes.length ?? 0);
  if (q.isError) return <Failed what="the mailboxes" />;
  if (!q.data) return <Loading />;
  return (
    <section>
      <SectionTitle count={q.data.mailboxes.length} right={<span>Capacity ramps up each day toward its ceiling</span>}>
        Every mailbox
      </SectionTitle>
      <Table
        head={
          <>
            <th className={TH}>Mailbox</th>
            <th className={TH}>Vendor</th>
            <th className={TH}>Status</th>
            <th className={THR}>Inbox %</th>
            <th className={TH}>Tested</th>
            <th className={THR}>Cap today</th>
            <th className={TH}>Ramp</th>
            <th className={THR}>Campaign, 7 days</th>
            <th className={THR}>Warmup, 7 days</th>
            <th className={THR}>Tests, 7 days</th>
          </>
        }
      >
        {q.data.mailboxes.slice(0, limit).map((m) => {
          const ramp = m.rampProjection;
          const last = ramp[ramp.length - 1];
          return (
            <tr key={m.login} className="k-row">
              <td className={`${TD} k-mono text-[12px]`}>
                <Link href={`${base}/${entityPath("mailbox", m.login)}`} className="hover:underline">
                  {m.login}
                </Link>
              </td>
              <td className={TD}>{m.provider ? vendorName(m.provider) : <Dash />}</td>
              <td className={TD}>{m.absentSince ? <span className="k-fg3 text-[12px]">Gone since {shortDay(m.absentSince)}</span> : <StatusWord status={m.addresses[0]?.lifecycleStatus ?? null} />}</td>
              <td className={TDR}>
                <InboxCell value={m.delivery.inboxPct} bar={bar} />
              </td>
              <td className={`${TD} k-mono k-fg2 text-[12px]`}>{m.delivery.testedAt ? shortDay(m.delivery.testedAt) : <Dash />}</td>
              <td className={TDR}>{m.effectiveDailyCap == null ? <Dash /> : n(m.effectiveDailyCap)}</td>
              <td className={`${TD} k-fg2 whitespace-nowrap text-[12px] tabular-nums`} title={ramp.map((r) => `${shortDay(r.date)} ${r.cap}`).join(", ")}>
                {ramp.length > 1 && last ? `${ramp[0].cap} → ${last.cap} by ${shortDay(last.date)}` : ramp[0] ? `${ramp[0].cap} a day` : <Dash />}
              </td>
              <td className={TDR}>{n(m.volume7d.outreach)}</td>
              <td className={TDR}>{n(m.volume7d.warmup)}</td>
              <td className={TDR}>{n(m.volume7d.seed)}</td>
            </tr>
          );
        })}
      </Table>
      {footer}
    </section>
  );
}

/**
 * Every sending address, one tab per lifecycle family (In production first), the table in the left
 * 2/3 and the charts in the right 1/3 (`aside`: the page passes the capacity vs planned chart, which
 * lives with the drill-down reads). Tabs filter the served rows on the served `lifecycleStatus`.
 */
export function AccountsPage({ base, aside }: { base: string; aside?: React.ReactNode }) {
  const q = useOpsAddresses();
  const [tab, setTab] = useState<AddressTabKey>("production");
  const rows = (q.data?.accounts ?? []).filter((a) => addressTab(a.lifecycleStatus) === tab);
  const { limit, footer } = useShowAll(rows.length);
  const rules = useLifecycleRules();
  const bar = rules.data?.bars.deliveryPctBar ?? null;
  const counts = new Map<AddressTabKey, number>();
  for (const a of q.data?.accounts ?? []) counts.set(addressTab(a.lifecycleStatus), (counts.get(addressTab(a.lifecycleStatus)) ?? 0) + 1);
  // A lifecycle value no tab names gets its own tab, so the counts always add up to every address.
  // One status per tab except Deactivated (by Instantly / by us) and Other: the column shows only there.
  const showStatus = tab === "deactivated" || tab === "other";
  const tabs = [...ADDRESS_TABS.map((t) => ({ key: t.key as AddressTabKey, label: t.label })), ...(counts.get("other") ? [{ key: "other" as AddressTabKey, label: "Other" }] : [])];
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section className="min-w-0">
        <SectionTitle count={q.data?.accounts.length}>Every sending address</SectionTitle>
        {q.isError ? (
          <Failed what="the sending addresses" />
        ) : !q.data ? (
          <Loading />
        ) : (
          <div className="k-card overflow-hidden">
            <div className="k-line-subtle flex gap-5 overflow-x-auto border-b px-4" role="tablist">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={t.key === tab}
                  aria-current={t.key === tab ? "page" : undefined}
                  onClick={() => setTab(t.key)}
                  className="k-tab shrink-0 text-[13px]"
                >
                  {t.label}
                  <span className="k-fg3 tabular-nums">{n(counts.get(t.key) ?? 0)}</span>
                </button>
              ))}
            </div>
            {rows.length === 0 ? (
              <EmptyNote>No address here.</EmptyNote>
            ) : (
              <div className="k-scroll overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="k-line-subtle border-b">
                    <tr>
                      <th className={TH}>Address</th>
                      {showStatus && <th className={TH}>Status</th>}
                      <th className={THR}>Inbox %</th>
                      <th className={THR}>Daily limit</th>
                      <th className={THR}>Sent today</th>
                      <th className={THR}>Yesterday</th>
                      <th className={THR}>Queued</th>
                      <th className={TH}>Next test</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line-subtle)]">
                    {rows.slice(0, limit).map((a) => (
                      <tr key={a.email} className="k-row">
                        <td className={`${TD} k-mono text-[12px]`}>
                          <Link href={`${base}/${entityPath("account", a.email)}`} className="hover:underline">
                            {a.email}
                          </Link>
                        </td>
                        {showStatus && (
                          <td className={TD}>
                            <StatusWord status={a.lifecycleStatus} />
                          </td>
                        )}
                        <td className={TDR}>
                          <InboxCell value={a.inboxPlacement?.inboxPct ?? null} bar={bar} />
                        </td>
                        <td className={TDR}>{a.dailyLimit == null ? <Dash /> : n(a.dailyLimit)}</td>
                        <td className={TDR}>{n(a.sentToday)}</td>
                        <td className={TDR}>{n(a.sentYesterday)}</td>
                        <td className={TDR}>{n(a.queueSize)}</td>
                        <td className={`${TD} k-mono k-fg2 text-[12px]`}>
                          {a.nextSeedTest == null ? <Dash /> : a.nextSeedTest.due ? "Due now" : a.nextSeedTest.expectedAt ? shortDay(a.nextSeedTest.expectedAt) : <Dash />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {footer}
          </div>
        )}
      </section>
      <aside className="min-w-0 space-y-8">
        <section>
          <SectionTitle>Emails queued per mailbox</SectionTitle>
          <QueuedBuckets />
        </section>
        {aside}
      </aside>
    </div>
  );
}

/**
 * Share of IN-PRODUCTION mailboxes (real mailboxes, never alias addresses) by emails queued: the
 * mailbox's served `queuedSteps`. Grouping served rows into buckets, nothing summed here.
 */
export function QueuedBuckets() {
  const q = useOpsMailboxes();
  if (q.isError) return <Failed what="the queued emails" />;
  if (!q.data) return <Loading />;
  const prod = q.data.mailboxes.filter(mailboxInProduction);
  if (!prod.length) {
    return (
      <div className="k-card">
        <EmptyNote>No mailbox in production.</EmptyNote>
      </div>
    );
  }
  const missing = prod.filter((m) => m.queuedSteps == null);
  if (missing.length) {
    console.error("[monitoring] /ops/mailboxes serves no queuedSteps on", missing.length, "production mailboxes, e.g.", missing[0].login);
    return (
      <div className="k-card">
        <EmptyNote>Queued emails per mailbox are not served yet.</EmptyNote>
      </div>
    );
  }
  const values = prod.map((m) => m.queuedSteps as number);
  const buckets = bucketQueued(values);
  // Bar length only, never a figure shown.
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div className="k-card p-4">
      <p className="k-fg3 text-[12px] tabular-nums">
        {n(values.length)} {values.length === 1 ? "mailbox" : "mailboxes"} in production
      </p>
      <div className="mt-3 space-y-2">
        {buckets.map((b) => (
          <div key={b.label} className="grid grid-cols-[64px_minmax(0,1fr)_88px] items-center gap-3 text-[12px]">
            <span className="k-fg2 tabular-nums">{b.label}</span>
            <span className="k-inset block h-2 rounded-[2px]">
              <span className="block h-2 rounded-[2px]" style={{ width: `${(b.count / max) * 100}%`, background: b.label === "0" ? "var(--fg-4)" : "var(--accent)" }} />
            </span>
            <span className="text-right tabular-nums">
              {b.count ? `${Math.round(b.pct) || "<1"}%` : "0%"} <span className="k-fg3">· {n(b.count)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Latest emails (unit events under the hub chart) ───────────────────────

export function LatestEmails() {
  const q = useAuthQuery(["staffOpsMessages", 25], () => getStaffOpsMessages(25), pollOptions);
  if (q.isError) return <Failed what="the latest emails" />;
  if (!q.data) return <Loading />;
  if (!q.data.messages.length) {
    return (
      <div className="k-card">
        <EmptyNote>No email yet.</EmptyNote>
      </div>
    );
  }
  return (
    <Table
      head={
        <>
          <th className={TH}>When</th>
          <th className={TH}>Kind</th>
          <th className={TH}>From</th>
          <th className={TH}>To</th>
          <th className={TH}>Subject</th>
        </>
      }
    >
      {q.data.messages.map((m) => (
        <tr key={m.id} className="k-row">
          <td className={`${TD} k-mono k-fg2 whitespace-nowrap text-[12px]`}>
            {new Date(m.occurredAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}
          </td>
          <td className={`${TD} whitespace-nowrap`}>{MESSAGE_KIND_WORD[m.kind] ?? m.kind}</td>
          <td className={`${TD} k-mono text-[12px]`}>{m.direction === "in" ? (m.counterparty ?? <Dash />) : (m.mailboxLogin ?? m.accountEmail ?? <Dash />)}</td>
          <td className={`${TD} k-mono text-[12px]`}>{m.direction === "in" ? (m.mailboxLogin ?? m.accountEmail ?? <Dash />) : (m.counterparty ?? <Dash />)}</td>
          <td className={`${TD} k-fg2 max-w-[360px] truncate`} title={m.subject ?? undefined}>
            {m.subject ?? <Dash />}
          </td>
        </tr>
      ))}
    </Table>
  );
}
