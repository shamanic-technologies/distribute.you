"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getStaffCapacityDaily, getStaffPlacementTest, getStaffPlacementTests, getStaffQueuedSteps, getStaffSchedule } from "@/lib/api";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { SentPerDayChart } from "@/components/v2/monitoring-emails";
import {
  Dash,
  EntityLink,
  Failed,
  InboxCell,
  LatestEmails,
  Loading,
  RED,
  StatusWord,
  TD,
  TDR,
  TH,
  THR,
  Table,
  n,
  pct,
  shortDay,
  useLifecycleRules,
  useOpsAddresses,
  useOpsDomains,
  useOpsMailboxes,
  useMonitoringBase,
  useShowAll,
  vendorName,
} from "@/components/v2/monitoring-sending";
import { TEST_PROVIDERS, type CapacityDay, type EntityGrain, type EntityScope, type ProviderCounts, type ScheduleDay } from "@/lib/monitoring/sending";

/**
 * Monitoring > Emails, per entity (staff only): one page per domain, mailbox and sending address,
 * the placement tests (list, then one page per test), warmup and the queued sequence steps. Every
 * figure is instantly-service's (`/v1/instantly/ops/*`, MAILBOX-MONITORING-1019): the scoped
 * series are served per account / mailbox / domain, queued steps sit on their THEORETICAL date as
 * the producer computes it (owner's choice: no real-send-date maths), and the capacity ahead is
 * the producer's ramp projection. This file draws and looks up; it never sums or re-dates.
 */

const ONCE = { staleTime: 60_000, retry: false } as const;
const TESTS_PAGE = 50;
const STEPS_PAGE = 100;


const scopeKey = (scope: EntityScope) => (scope ? [scope.grain, scope.key] : ["fleet"]);

export function usePlacementTests(scope: EntityScope, limit = TESTS_PAGE) {
  return useAuthQuery(["staffPlacementTests", ...scopeKey(scope), limit], () => getStaffPlacementTests(limit, scope), ONCE);
}
export function useCapacityDaily(scope: EntityScope) {
  return useAuthQuery(["staffCapacityDaily", ...scopeKey(scope)], () => getStaffCapacityDaily(scope), ONCE);
}
export function useSchedule(scope: EntityScope) {
  return useAuthQuery(["staffSchedule", ...scopeKey(scope)], () => getStaffSchedule(scope), ONCE);
}

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const GRAIN_WORD: Record<EntityGrain, string> = { domain: "Domain", mailbox: "Mailbox", account: "Sending address" };


// ─── Day bars (past solid, today and the days ahead dashed) ────────────────

type DayPart = { label: string; value: number; color: string };
type DaySlot = { day: string; ahead: boolean; parts: DayPart[]; extra?: string };

/** Stacked bars, one per day, the hovered (else today's) day's counts above. Heights only scale. */
function DayChart({ title, note, slots, empty }: { title: string; note: string; slots: DaySlot[]; empty: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const H = 120;
  if (!slots.length) {
    return (
      <div className="k-card">
        <EmptyNote>{empty}</EmptyNote>
      </div>
    );
  }
  // Bar height only: the tallest stack in pixels, never a figure shown.
  const max = Math.max(1, ...slots.map((s) => s.parts.reduce((t, p) => t + p.value, 0)));
  const firstAhead = slots.findIndex((s) => s.ahead);
  const shown = slots.find((s) => s.day === hover) ?? (firstAhead >= 0 ? slots[firstAhead] : slots[slots.length - 1]);
  const legend = slots[0].parts;
  return (
    <div className="k-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[13px] font-medium">{title}</p>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
          <span className="k-fg2">
            {shortDay(shown.day)}
            {shown.extra ? ` · ${shown.extra}` : ""}
          </span>
          {legend.map((l, i) => (
            <span key={l.label} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: l.color }} aria-hidden="true" />
              <span className="k-fg3">{l.label}</span>
              <span className="tabular-nums">{n(shown.parts[i]?.value ?? 0)}</span>
            </span>
          ))}
        </span>
      </div>
      <p className="k-fg3 mt-0.5 text-[12px]">{note}</p>
      <div className="mt-3 flex items-end gap-[2px]" style={{ height: H }} onMouseLeave={() => setHover(null)}>
        {slots.map((s) => (
          <button
            key={s.day}
            type="button"
            aria-label={`${shortDay(s.day)}: ${s.parts.map((p) => `${p.label} ${n(p.value)}`).join(", ")}`}
            onMouseEnter={() => setHover(s.day)}
            onFocus={() => setHover(s.day)}
            className="flex h-full min-w-0 flex-1 flex-col-reverse"
            style={{ opacity: hover && hover !== s.day ? 0.5 : 1 }}
          >
            {s.parts.every((p) => p.value <= 0) ? (
              <span className="block w-full" style={{ height: 2, background: "var(--data-track)" }} />
            ) : (
              s.parts.map((p) =>
                p.value > 0 ? (
                  <span
                    key={p.label}
                    className="block w-full"
                    style={
                      s.ahead
                        ? { height: Math.max(1, (p.value / max) * H), background: `color-mix(in oklab, ${p.color} 30%, transparent)`, boxShadow: `inset 0 0 0 1px ${p.color}` }
                        : { height: Math.max(1, (p.value / max) * H), background: p.color }
                    }
                  />
                ) : null,
              )
            )}
          </button>
        ))}
      </div>
      <div className="k-line-subtle k-fg3 mt-1.5 flex justify-between border-t pt-1.5 text-[10.5px]">
        <span>{shortDay(slots[0].day)}</span>
        {firstAhead > 0 && <span>Today on: planned</span>}
        <span>{shortDay(slots[slots.length - 1].day)}</span>
      </div>
    </div>
  );
}

// ─── Capacity (past and the ramp ahead) ────────────────────────────────────

const CAPACITY_PAST_DAYS = 60;

export function CapacityChart({ scope }: { scope: EntityScope }) {
  const q = useCapacityDaily(scope);
  if (q.isError) return <Failed what="the capacity" />;
  if (!q.data) return <Shimmer className="h-[200px] w-full" />;
  const past = q.data.days.filter((d) => d.phase === "past").slice(-CAPACITY_PAST_DAYS);
  const rest = q.data.days.filter((d) => d.phase !== "past");
  const slot = (d: CapacityDay): DaySlot => ({
    day: d.date,
    ahead: d.phase !== "past",
    parts: [{ label: "Capacity", value: d.capacity, color: "var(--data-sky)" }],
    extra: `${d.phase === "today" ? "today, " : d.phase === "future" ? "projected, " : ""}ramp ${n(d.rampCap)} · limit ${n(d.operatorLimit)} · sustained ${n(d.sustained)} · ${n(d.mailboxesInProduction)} mailboxes`,
  });
  return (
    <DayChart
      title="Capacity per day"
      note={`${q.data.rampRules.rule} The days ahead assume each mailbox uses its room: a projection, never a promise.${q.data.additive === false ? " Aliases share their mailbox's quota." : ""}`}
      slots={[...past, ...rest].map(slot)}
      empty="No capacity recorded yet."
    />
  );
}

// ─── From today on (queued steps, planned warmups, planned tests) ──────────

const scheduleParts = (d: ScheduleDay): DayPart[] => [
  { label: "First emails", value: d.queuedFirstEmails, color: "var(--accent)" },
  { label: "Follow-ups", value: d.queuedFollowUps, color: "var(--data-sky)" },
  { label: "Warmup", value: d.warmupsPlanned, color: "var(--data-teal)" },
  { label: "Placement tests", value: d.seedsPlanned, color: "var(--data-violet)" },
];

export function ScheduleChart({ scope, only }: { scope: EntityScope; only?: "queued" | "warmup" }) {
  const q = useSchedule(scope);
  if (q.isError) return <Failed what="the schedule" />;
  if (!q.data) return <Shimmer className="h-[200px] w-full" />;
  const t = q.data.totals;
  const pick = (d: ScheduleDay) => {
    const all = scheduleParts(d);
    return only === "queued" ? all.slice(0, 2) : only === "warmup" ? all.slice(2, 3) : all;
  };
  const late = [t.overdueQueuedSteps ? `${n(t.overdueQueuedSteps)} steps past their date` : null, t.undatedQueuedSteps ? `${n(t.undatedQueuedSteps)} with no date` : null, t.beyondHorizonQueuedSteps ? `${n(t.beyondHorizonQueuedSteps)} after day ${q.data.horizonDays}` : null].filter(Boolean);
  return (
    <DayChart
      title={only === "warmup" ? "Warmup planned per day" : only === "queued" ? "Queued steps per day" : "Planned per day, from today"}
      note={
        only === "warmup"
          ? "The warmup budget on each mailbox's projected cap, for mailboxes that warmed up in the last 7 days. Replies come on top."
          : `Queued steps sit on their theoretical date: the previous send plus the step delay. No sending window applied.${late.length ? ` Not on a day: ${late.join(", ")}.` : ""}`
      }
      slots={q.data.days.map((d) => ({ day: d.date, ahead: true, parts: pick(d), extra: d.isToday ? "today, what is left" : d.seedTestsPlanned ? `${n(d.seedTestsPlanned)} tests` : undefined }))}
      empty="Nothing planned."
    />
  );
}

// ─── Placement tests ───────────────────────────────────────────────────────

function CountsCell({ c }: { c: ProviderCounts }) {
  if (c.seeds === 0) return <Dash />;
  return (
    <span className="whitespace-nowrap">
      <InboxCell value={c.inboxPct} bar={null} />
      <span className="k-fg3 ml-1 text-[11px]">of {n(c.seeds)}</span>
    </span>
  );
}

const SOURCE_WORD = { seed: "Our seeds", instantly: "Instantly" } as const;

export function PlacementTestsTable({ scope, first = TESTS_PAGE }: { scope: EntityScope; first?: number }) {
  const [limit, setLimit] = useState(first);
  const q = usePlacementTests(scope, limit);
  const base = useMonitoringBase();
  if (q.isError) return <Failed what="the placement tests" />;
  if (!q.data) return <Loading />;
  if (!q.data.tests.length) {
    return (
      <div className="k-card">
        <EmptyNote>No placement test yet.</EmptyNote>
      </div>
    );
  }
  return (
    <>
      <Table
        head={
          <>
            <th className={TH}>Tested</th>
            <th className={TH}>Test</th>
            <th className={THR}>Senders</th>
            <th className={THR}>Inbox, all</th>
            {TEST_PROVIDERS.slice(0, 3).map((p) => (
              <th key={p.key} className={THR}>
                {p.name}
              </th>
            ))}
            <th className={THR}>Spam</th>
            <th className={THR}>Missing</th>
          </>
        }
      >
        {q.data.tests.map((t) => (
          <tr key={t.testId} className="k-row">
            <td className={`${TD} k-mono k-fg2 whitespace-nowrap text-[12px]`}>
              <Link href={`${base}/emails/placement-tests/${encodeURIComponent(t.testId)}`} className="hover:underline">
                {when(t.testedAt)}
              </Link>
            </td>
            <td className={`${TD} text-[12px]`}>{SOURCE_WORD[t.source]}</td>
            <td className={TDR}>{n(t.senders)}</td>
            <td className={TDR}>
              <CountsCell c={t.total} />
            </td>
            {TEST_PROVIDERS.slice(0, 3).map((p) => (
              <td key={p.key} className={TDR}>
                <CountsCell c={t.byProvider[p.key]} />
              </td>
            ))}
            <td className={TDR}>{n(t.total.spam)}</td>
            <td className={TDR}>{n(t.total.missing)}</td>
          </tr>
        ))}
      </Table>
      {q.data.nextCursor && limit < 500 && (
        <div className="k-fg3 flex justify-end px-1 py-2 text-[12px]">
          <button type="button" className="k-btn-ghost h-6 px-2 text-[12px]" onClick={() => setLimit(500)}>
            Show all
          </button>
        </div>
      )}
    </>
  );
}

export function PlacementTestsPage() {
  return (
    <section>
      <SectionTitle right={<span>Newest first · a row opens the test</span>}>Every placement test</SectionTitle>
      <PlacementTestsTable scope={null} />
    </section>
  );
}

const PLACEMENT_WORD = { inbox: "Inbox", spam: "Spam", missing: "Missing" } as const;
const PLACEMENT_COLOR = { inbox: "var(--run)", spam: RED, missing: "var(--fg-3)" } as const;
const pass = (v: boolean | null) => (v == null ? "—" : v ? "pass" : "fail");

export function PlacementTestPage({ testId }: { testId: string }) {
  const q = useAuthQuery(["staffPlacementTest", testId], () => getStaffPlacementTest(testId), ONCE);
  const seeds = useShowAll(q.data?.seeds.length ?? 0, 100);
  const senders = useShowAll(q.data?.bySender.length ?? 0, 50);
  if (q.isError) return <Failed what="this placement test" />;
  if (!q.data) return <Loading />;
  const t = q.data;
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Inbox, all" note={t.testedAt ? when(t.testedAt) : undefined}>
          <Figure value={pct(t.total.inboxPct) ?? <Dash />} sub={`of ${n(t.total.seeds)} seeds`} />
        </StatTile>
        {TEST_PROVIDERS.slice(0, 3).map((p) => (
          <StatTile key={p.key} label={`Inbox at ${p.name}`}>
            <Figure value={t.byProvider[p.key].seeds ? (pct(t.byProvider[p.key].inboxPct) ?? <Dash />) : <Dash />} sub={`${n(t.byProvider[p.key].spam)} spam · ${n(t.byProvider[p.key].missing)} missing`} />
          </StatTile>
        ))}
      </div>
      <p className="k-fg3 -mt-5 text-[12px]">
        {SOURCE_WORD[t.source]}
        {t.missingSeedsListed ? ". Seeds never found are listed as missing." : ". Instantly lists only the seeds it found; its missing seeds are in the counts only."}
      </p>
      <section>
        <SectionTitle count={t.bySender.length}>Per sender</SectionTitle>
        <Table
          head={
            <>
              <th className={TH}>Sender</th>
              <th className={THR}>Inbox, all</th>
              {TEST_PROVIDERS.slice(0, 3).map((p) => (
                <th key={p.key} className={THR}>
                  {p.name}
                </th>
              ))}
            </>
          }
        >
          {t.bySender.slice(0, senders.limit).map((s) => (
            <tr key={s.sender} className="k-row">
              <td className={TD}>
                <EntityLink grain="account" value={s.sender} />
              </td>
              <td className={TDR}>
                <CountsCell c={s.total} />
              </td>
              {TEST_PROVIDERS.slice(0, 3).map((p) => (
                <td key={p.key} className={TDR}>
                  <CountsCell c={s.byProvider[p.key]} />
                </td>
              ))}
            </tr>
          ))}
        </Table>
        {senders.footer}
      </section>
      <section>
        <SectionTitle count={t.seeds.length}>Every seed</SectionTitle>
        <Table
          head={
            <>
              <th className={TH}>Sender</th>
              <th className={TH}>Seed inbox</th>
              <th className={TH}>Provider</th>
              <th className={TH}>Landed</th>
              <th className={TH}>Folder</th>
              <th className={TH}>SPF / DKIM / DMARC</th>
              <th className={TH}>Sent</th>
            </>
          }
        >
          {t.seeds.slice(0, seeds.limit).map((s, i) => (
            <tr key={`${s.sender}|${s.receiver}|${i}`} className="k-row">
              <td className={`${TD} k-mono text-[12px]`}>{s.sender}</td>
              <td className={`${TD} k-mono k-fg2 text-[12px]`}>{s.receiver ?? <Dash />}</td>
              <td className={`${TD} text-[12px]`}>{s.providerLabel}</td>
              <td className={`${TD} text-[12px]`}>
                {s.placement ? <span style={{ color: PLACEMENT_COLOR[s.placement] }}>{PLACEMENT_WORD[s.placement]}</span> : <span className="k-fg3">Never left ({s.dispatchOutcome})</span>}
              </td>
              <td className={`${TD} k-fg2 text-[12px]`}>{s.folder ?? <Dash />}</td>
              <td className={`${TD} k-mono k-fg2 text-[12px]`}>
                {pass(s.spfPass)} / {pass(s.dkimPass)} / {pass(s.dmarcPass)}
              </td>
              <td className={`${TD} k-mono k-fg2 whitespace-nowrap text-[12px]`}>{s.dispatchedAt ? when(s.dispatchedAt) : <Dash />}</td>
            </tr>
          ))}
        </Table>
        {seeds.footer}
      </section>
    </div>
  );
}

// ─── Queued sequences ──────────────────────────────────────────────────────

export function QueuedStepsTable({ scope, page = STEPS_PAGE }: { scope: EntityScope; page?: number }) {
  const [offset, setOffset] = useState(0);
  const q = useAuthQuery(["staffQueuedSteps", ...scopeKey(scope), page, offset], () => getStaffQueuedSteps(page, offset, scope), pollOptions);
  if (q.isError) return <Failed what="the queued steps" />;
  if (!q.data) return <Loading />;
  if (!q.data.steps.length) {
    return (
      <div className="k-card">
        <EmptyNote>Nothing queued.</EmptyNote>
      </div>
    );
  }
  return (
    <>
      <Table
        head={
          <>
            <th className={TH}>Theoretical date</th>
            <th className={TH}>Step</th>
            <th className={TH}>Lead</th>
            <th className={TH}>From</th>
            <th className={TH}>After the send of</th>
          </>
        }
      >
        {q.data.steps.map((s) => (
          <tr key={`${s.instantlyCampaignId}|${s.leadEmail}|${s.step}`} className="k-row">
            <td className={`${TD} k-mono whitespace-nowrap text-[12px]`} style={{ color: s.overdue ? RED : undefined }}>
              {s.theoreticalAt ? when(s.theoreticalAt) : <Dash />}
              {s.overdue && <span className="ml-1.5 text-[11px]">past</span>}
            </td>
            <td className={`${TD} whitespace-nowrap text-[12px]`}>{s.isFirstEmail ? "First email" : `Follow-up, step ${s.step}`}</td>
            <td className={`${TD} k-mono k-fg2 text-[12px]`}>{s.leadEmail}</td>
            <td className={TD}>
              <EntityLink grain="account" value={s.account} />
            </td>
            <td className={`${TD} k-mono k-fg2 whitespace-nowrap text-[12px]`}>{s.anchoredOn ? when(s.anchoredOn) : <Dash />}</td>
          </tr>
        ))}
      </Table>
      <div className="k-fg3 flex items-center justify-between px-1 py-2 text-[12px] tabular-nums">
        <span>
          {n(offset + 1)} to {n(offset + q.data.steps.length)} of {n(q.data.total)}
        </span>
        <span className="flex gap-1">
          <button type="button" className="k-btn-ghost h-6 px-2 text-[12px]" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - page))}>
            Previous
          </button>
          <button type="button" className="k-btn-ghost h-6 px-2 text-[12px]" disabled={q.data.nextOffset == null} onClick={() => q.data?.nextOffset != null && setOffset(q.data.nextOffset)}>
            Next
          </button>
        </span>
      </div>
    </>
  );
}

export function QueuedPage() {
  return (
    <div className="space-y-8">
      <section>
        <ScheduleChart scope={null} only="queued" />
      </section>
      <section>
        <SectionTitle right={<span>Oldest first</span>}>Every queued step</SectionTitle>
        <QueuedStepsTable scope={null} />
      </section>
    </div>
  );
}

// ─── Warmup ────────────────────────────────────────────────────────────────

export function WarmupPage() {
  const q = useOpsMailboxes();
  const { limit, footer } = useShowAll(q.data?.mailboxes.length ?? 0);
  return (
    <div className="space-y-8">
      <section>
        <SectionTitle right={<span>Times are UTC</span>}>Warmup sent per day</SectionTitle>
        <SentPerDayChart kinds="warmup" />
      </section>
      <section>
        <ScheduleChart scope={null} only="warmup" />
      </section>
      <section>
        <SectionTitle count={q.data?.mailboxes.length}>Per mailbox</SectionTitle>
        {q.isError ? (
          <Failed what="the mailboxes" />
        ) : !q.data ? (
          <Loading />
        ) : (
          <>
            <Table
              head={
                <>
                  <th className={TH}>Mailbox</th>
                  <th className={TH}>Status</th>
                  <th className={THR}>Warmup budget today</th>
                  <th className={THR}>Warmup, 7 days</th>
                  <th className={THR}>Campaign, 7 days</th>
                </>
              }
            >
              {q.data.mailboxes.slice(0, limit).map((m) => (
                <tr key={m.login} className="k-row">
                  <td className={TD}>
                    <EntityLink grain="mailbox" value={m.login} />
                  </td>
                  <td className={TD}>{m.absentSince ? <span className="k-fg3 text-[12px]">Gone since {shortDay(m.absentSince)}</span> : <StatusWord status={m.addresses[0]?.lifecycleStatus ?? null} />}</td>
                  <td className={TDR}>{m.warmupBudgetToday == null ? <Dash /> : n(m.warmupBudgetToday)}</td>
                  <td className={TDR}>{n(m.volume7d.warmup)}</td>
                  <td className={TDR}>{n(m.volume7d.outreach)}</td>
                </tr>
              ))}
            </Table>
            {footer}
          </>
        )}
      </section>
    </div>
  );
}

// ─── One domain / mailbox / sending address ────────────────────────────────

/** The served facts about one entity, read off the producer's row for it (lookup only). */
function EntityFacts({ grain, value }: { grain: EntityGrain; value: string }) {
  const domains = useOpsDomains();
  const mailboxes = useOpsMailboxes();
  const addresses = useOpsAddresses();
  const rules = useLifecycleRules();
  const bar = rules.data?.bars.deliveryPctBar ?? null;
  const key = value.toLowerCase();
  const tiles: Array<{ label: string; value: React.ReactNode; sub?: React.ReactNode }> = [];
  let related: React.ReactNode = null;
  if (grain === "domain") {
    const d = domains.data?.domains.find((r) => r.domain.toLowerCase() === key);
    if (domains.isError) return <Failed what="this domain" />;
    if (!domains.data) return <Shimmer className="h-[84px] w-full" />;
    if (!d) return <div className="k-card"><EmptyNote>No domain {value} in production.</EmptyNote></div>;
    tiles.push(
      { label: "Inbox %", value: <InboxCell value={d.delivery.inboxPct} bar={bar} />, sub: d.delivery.testedAt ? `tested ${shortDay(d.delivery.testedAt)}` : "never tested" },
      { label: "Mailboxes", value: n(d.mailboxes), sub: `${n(d.addresses.byLifecycle.in_production ?? 0)} addresses in production` },
      { label: "Sent, 30 days", value: n(d.sentLast30d), sub: `${n(d.volume30d.outreach)} campaign` },
      { label: "Vendor", value: d.provider ? vendorName(d.provider) : <Dash />, sub: d.expiresAt ? `expires ${shortDay(d.expiresAt)}` : undefined },
    );
    const own = mailboxes.data?.mailboxes.filter((m) => m.domain.toLowerCase() === key) ?? [];
    if (own.length) {
      related = (
        <section>
          <SectionTitle count={own.length}>Its mailboxes</SectionTitle>
          <Table head={<><th className={TH}>Mailbox</th><th className={TH}>Status</th><th className={THR}>Inbox %</th><th className={THR}>Cap today</th><th className={THR}>Campaign, 7 days</th></>}>
            {own.map((m) => (
              <tr key={m.login} className="k-row">
                <td className={TD}><EntityLink grain="mailbox" value={m.login} /></td>
                <td className={TD}><StatusWord status={m.addresses[0]?.lifecycleStatus ?? null} /></td>
                <td className={TDR}><InboxCell value={m.delivery.inboxPct} bar={bar} /></td>
                <td className={TDR}>{m.effectiveDailyCap == null ? <Dash /> : n(m.effectiveDailyCap)}</td>
                <td className={TDR}>{n(m.volume7d.outreach)}</td>
              </tr>
            ))}
          </Table>
        </section>
      );
    }
  } else if (grain === "mailbox") {
    const m = mailboxes.data?.mailboxes.find((r) => r.login.toLowerCase() === key);
    if (mailboxes.isError) return <Failed what="this mailbox" />;
    if (!mailboxes.data) return <Shimmer className="h-[84px] w-full" />;
    if (!m) return <div className="k-card"><EmptyNote>No mailbox {value} in production.</EmptyNote></div>;
    const ramp = m.rampProjection;
    const last = ramp[ramp.length - 1];
    tiles.push(
      { label: "Inbox %", value: <InboxCell value={m.delivery.inboxPct} bar={bar} />, sub: m.delivery.testedAt ? `tested ${shortDay(m.delivery.testedAt)}` : "never tested" },
      { label: "Cap today", value: m.effectiveDailyCap == null ? <Dash /> : n(m.effectiveDailyCap), sub: last && ramp.length > 1 ? `${n(last.cap)} by ${shortDay(last.date)}` : undefined },
      { label: "Campaign, 7 days", value: n(m.volume7d.outreach), sub: `${n(m.volume7d.warmup)} warmup · ${n(m.volume7d.seed)} tests` },
      { label: "Domain", value: <EntityLink grain="domain" value={m.domain} />, sub: m.provider ? vendorName(m.provider) : undefined },
    );
    related = (
      <section>
        <SectionTitle count={m.addresses.length}>Its sending addresses</SectionTitle>
        <Table head={<><th className={TH}>Address</th><th className={TH}>Status</th><th className={THR}>Daily limit</th></>}>
          {m.addresses.map((a) => (
            <tr key={a.email} className="k-row">
              <td className={TD}><EntityLink grain="account" value={a.email} /></td>
              <td className={TD}><StatusWord status={a.lifecycleStatus} /></td>
              <td className={TDR}>{a.dailyLimit == null ? <Dash /> : n(a.dailyLimit)}</td>
            </tr>
          ))}
        </Table>
      </section>
    );
  } else {
    const a = addresses.data?.accounts.find((r) => r.email.toLowerCase() === key);
    if (addresses.isError) return <Failed what="this sending address" />;
    if (!addresses.data) return <Shimmer className="h-[84px] w-full" />;
    if (!a) return <div className="k-card"><EmptyNote>No sending address {value} in production.</EmptyNote></div>;
    tiles.push(
      { label: "Inbox %", value: <InboxCell value={a.inboxPlacement?.inboxPct ?? null} bar={bar} />, sub: a.inboxPlacement ? `tested ${shortDay(a.inboxPlacement.testedAt)}` : "never tested" },
      { label: "Sent today", value: n(a.sentToday), sub: `${n(a.sentYesterday)} yesterday · limit ${a.dailyLimit == null ? "—" : n(a.dailyLimit)}` },
      { label: "Queued", value: n(a.queueSize), sub: a.nextSeedTest?.due ? "next test due now" : a.nextSeedTest?.expectedAt ? `next test ${shortDay(a.nextSeedTest.expectedAt)}` : undefined },
      { label: "Mailbox", value: a.mailboxLogin ? <EntityLink grain="mailbox" value={a.mailboxLogin} /> : <Dash />, sub: a.domain ?? undefined },
    );
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <StatTile key={t.label} label={t.label}>
            <Figure value={t.value} sub={t.sub} />
          </StatTile>
        ))}
      </div>
      {related && <div className="mt-8">{related}</div>}
    </>
  );
}

export function EntityPage({ grain, value }: { grain: EntityGrain; value: string }) {
  const scope: EntityScope = { grain, key: value };
  return (
    <div className="space-y-8">
      <EntityFacts grain={grain} value={value} />
      <section>
        <SectionTitle right={<span>Times are UTC</span>}>Sent per day, by kind</SectionTitle>
        <SentPerDayChart scope={scope} />
      </section>
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <CapacityChart scope={scope} />
        <ScheduleChart scope={scope} />
      </section>
      <section>
        <SectionTitle>Placement tests</SectionTitle>
        <PlacementTestsTable scope={scope} first={10} />
      </section>
      <section>
        <SectionTitle>Queued steps</SectionTitle>
        <QueuedStepsTable scope={scope} page={20} />
      </section>
      <section>
        <SectionTitle>Latest emails</SectionTitle>
        <LatestEmails scope={scope} />
      </section>
    </div>
  );
}

export const entityTitle = (grain: EntityGrain) => GRAIN_WORD[grain];
