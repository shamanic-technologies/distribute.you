"use client";

import { AccountDetails, DomainDetails, MailboxDetails } from "@/components/v2/monitoring-details";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getStaffCapacityDaily,
  getStaffMessageBody,
  getStaffOpsMessagesScoped,
  getStaffPlacementTest,
  getStaffPlacementTests,
  getStaffQueuedSteps,
  getStaffSchedule,
  getStaffSentPerDayScoped,
} from "@/lib/api";
import { EmptyNote, SectionTitle, Shimmer } from "@/components/v2/ui";
import { ALL_KINDS, PeriodChart, type Series } from "@/components/v2/monitoring-emails";
import {
  Dash,
  Failed,
  Loading,
  OK,
  RED,
  StatusWord,
  TD,
  TDR,
  TH,
  THR,
  Table,
  useShowAll,
  n,
  pct,
  shortDay,
  useOpsAddresses,
  useOpsDomains,
  useOpsMailboxes,
  vendorName,
} from "@/components/v2/monitoring-sending";
import {
  ENTITY_WORD,
  MESSAGE_KIND_WORD,
  TEST_PROVIDERS,
  TEST_SOURCE_WORD,
  entityPath,
  placementTestPath,
  scopeQuery,
  windowSince,
  type EntityKind,
  type EntityScope,
  backlogVerdict,
  capacityVsPlanned,
  type ProviderCounts,
  type ScheduleDay,
} from "@/lib/monitoring/sending";

/**
 * Monitoring > Emails, drilled down (staff only): one account, one mailbox or one domain, what it
 * sent per day by kind, what it could send per day (past and ahead, with the ramp rule in the
 * producer's words), what is planned ahead, and its unit events (emails, placement tests, queued
 * steps), each row leading to its own page. The fleet pages Placement tests, Warmup and Queued
 * sequences are the same blocks with no filter.
 *
 * Every figure is instantly-service's `/v1/instantly/ops/*` read, filtered by `account|mailbox|domain`
 * at the producer; this file draws and links, it never sums, averages or derives a figure shown.
 */

const ONCE = { staleTime: 60_000, retry: false } as const;
/** Days of history the per-day charts read (the producer's `since`), so the served totals ARE the chart's sums. */
export const HISTORY_DAYS = 30;
/** Days ahead the capacity and schedule reads project. */
export const HORIZON_DAYS = 30;

const AMBER = "var(--data-amber)";
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

/** A link to another Monitoring page, built from the Monitoring base the page was opened under. */
function To({ base, path, children, mono = true }: { base: string; path: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <Link href={`${base}/${path}`} className={`${mono ? "k-mono text-[12px]" : ""} hover:underline`} onClick={(e) => e.stopPropagation()}>
      {children}
    </Link>
  );
}

// ─── Sent per day ──────────────────────────────────────────────────────────

/** Sent per day by kind for a scope, the last HISTORY_DAYS days (today "so far"). */
export function ScopedSentPerDay({ scope, series = ALL_KINDS }: { scope: EntityScope; series?: Series[] }) {
  // One `since` per UTC day, so the producer's cache key holds for the day.
  const since = windowSince(HISTORY_DAYS, new Date());
  const q = useAuthQuery(["staffSentPerDayScoped", scopeQuery(scope), since], () => getStaffSentPerDayScoped(scope, since), ONCE);
  return <PeriodChart periods={q.data?.periods} error={q.isError} grain="day" series={series} progressWord="so far" />;
}

// ─── Capacity per day ──────────────────────────────────────────────────────

const PHASE_WORD: Record<string, string> = { past: "", today: "today", future: "planned" };

/**
 * Capacity per day: the last HISTORY_DAYS measured days, today, and the ramp ahead, one bar per day
 * (future dashed), the hovered day's served parts above, the ramp rule as the producer words it.
 */
export function CapacityChart({ scope }: { scope: EntityScope }) {
  const q = useAuthQuery(["staffCapacityDaily", scopeQuery(scope), HORIZON_DAYS], () => getStaffCapacityDaily(scope, HORIZON_DAYS), ONCE);
  const [hover, setHover] = useState<string | null>(null);
  if (q.isError) return <Failed what="the capacity per day" />;
  if (!q.data) {
    // The reconstruction takes ~30 s cold at the producer: a skeleton, never an error.
    return (
      <div className="k-card p-4">
        <p className="k-fg3 text-[12px]">Rebuilding capacity from every send since the first one…</p>
        <Shimmer className="mt-3 h-[140px] w-full" />
      </div>
    );
  }
  const data = q.data;
  const todayAt = data.days.findIndex((d) => d.phase === "today");
  // Display window only: the last HISTORY_DAYS past days, today and every day ahead.
  const days = todayAt < 0 ? data.days.slice(-HISTORY_DAYS) : data.days.slice(Math.max(0, todayAt - HISTORY_DAYS), todayAt + 1 + data.horizonDays);
  if (!days.length) {
    return (
      <div className="k-card">
        <EmptyNote>No capacity yet: nothing in production here.</EmptyNote>
      </div>
    );
  }
  const H = 140;
  // Bar height only, never a figure shown.
  const max = Math.max(1, ...days.map((d) => d.capacity));
  const shown = days.find((d) => d.date === hover) ?? days.find((d) => d.phase === "today") ?? days[days.length - 1];
  const every = Math.ceil(days.length / 6);
  return (
    <div className="k-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="k-fg2 text-[12px]">
          {shortDay(shown.date)}
          {PHASE_WORD[shown.phase] && ` · ${PHASE_WORD[shown.phase]}`}
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] tabular-nums">
          <span>
            <span className="k-fg3">Capacity </span>
            {n(shown.capacity)}
          </span>
          <span>
            <span className="k-fg3">Ramp allows </span>
            {n(shown.rampCap)}
          </span>
          <span>
            <span className="k-fg3">Our limit </span>
            {n(shown.operatorLimit)}
          </span>
          <span>
            <span className="k-fg3">Sustained </span>
            {n(shown.sustained)}
          </span>
          <span>
            <span className="k-fg3">Mailboxes in production </span>
            {n(shown.mailboxesInProduction)}
          </span>
        </span>
      </div>
      <div className="mt-3 flex items-end gap-[2px]" style={{ height: H }} onMouseLeave={() => setHover(null)}>
        {days.map((d) => (
          <button
            key={d.date}
            type="button"
            aria-label={`${shortDay(d.date)}${PHASE_WORD[d.phase] ? `, ${PHASE_WORD[d.phase]}` : ""}: capacity ${n(d.capacity)}`}
            onMouseEnter={() => setHover(d.date)}
            onFocus={() => setHover(d.date)}
            className="flex h-full min-w-0 flex-1 items-end"
            style={{ opacity: hover && hover !== d.date ? 0.5 : 1 }}
          >
            <span
              className="block w-full rounded-t-[2px]"
              style={
                d.phase === "future"
                  ? { height: Math.max(2, (d.capacity / max) * H), border: "1.5px dashed var(--data-teal)", background: "color-mix(in oklab, var(--data-teal) 14%, transparent)" }
                  : { height: Math.max(2, (d.capacity / max) * H), background: d.phase === "today" ? "var(--accent)" : "var(--data-teal)" }
              }
            />
          </button>
        ))}
      </div>
      <div className="k-line-subtle flex gap-[2px] border-t pt-1.5">
        {days.map((d, i) => (
          <span key={d.date} className="k-fg3 min-w-0 flex-1 overflow-visible whitespace-nowrap text-[10.5px]">
            {i % every === 0 ? shortDay(d.date) : ""}
          </span>
        ))}
      </div>
      <RampRule rules={data.rampRules} />
      {data.additive === false && <p className="k-fg3 mt-1 text-[12px]">This address shares its mailbox&apos;s quota with the mailbox&apos;s other addresses.</p>}
    </div>
  );
}

/** The producer's ramp parameters, said in words (its `rule` field is a formula, kept as the hover). */
function RampRule({ rules }: { rules: { floorPerDay: number; growthFactor: number; volumeWindowDays: number; ceilingPerDay: number; rule: string } }) {
  return (
    <p className="k-fg3 mt-3 text-[12px]" title={rules.rule}>
      Ramp rule: each day a mailbox may send {rules.growthFactor}× what it sent per day over the last {rules.volumeWindowDays} days, never under {rules.floorPerDay}, never over {rules.ceilingPerDay}, nor over the limit we set.
    </p>
  );
}

// ─── Planned ahead ─────────────────────────────────────────────────────────

type PlanKey = "queuedFirstEmails" | "queuedFollowUps" | "warmupsPlanned" | "seedsPlanned";
const PLAN_SERIES: Array<{ key: PlanKey; label: string; color: string }> = [
  { key: "queuedFirstEmails", label: "First emails", color: "var(--accent)" },
  { key: "queuedFollowUps", label: "Follow-ups", color: "var(--data-sky)" },
  { key: "warmupsPlanned", label: "Warmup", color: "var(--data-teal)" },
  { key: "seedsPlanned", label: "Placement test emails", color: "var(--data-violet)" },
];
export const PLAN_QUEUED = PLAN_SERIES.slice(0, 2);
export const PLAN_WARMUP = PLAN_SERIES.slice(2, 3);

/** Per day from today, what is planned, stacked by kind; queued steps at their planned date. */
export function ScheduleChart({ scope, series = PLAN_SERIES }: { scope: EntityScope; series?: typeof PLAN_SERIES }) {
  const q = useAuthQuery(["staffSchedule", scopeQuery(scope), HORIZON_DAYS], () => getStaffSchedule(scope, HORIZON_DAYS), ONCE);
  const [hover, setHover] = useState<string | null>(null);
  if (q.isError) return <Failed what="what is planned ahead" />;
  if (!q.data) return <Loading />;
  const { days, totals } = q.data;
  const H = 120;
  // Bar height only, never a figure shown.
  const max = Math.max(1, ...days.map((d) => series.reduce((t, s) => t + d[s.key], 0)));
  const shown: ScheduleDay | undefined = days.find((d) => d.date === hover) ?? days[0];
  const every = Math.ceil(days.length / 6);
  const queued = series.some((s) => s.key === "queuedFirstEmails" || s.key === "queuedFollowUps");
  return (
    <div className="k-card p-4">
      {shown && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="k-fg2 text-[12px]">
            {shortDay(shown.date)}
            {shown.isToday && " · rest of today"}
            {series.some((s) => s.key === "seedsPlanned") && ` · ${n(shown.seedTestsPlanned)} placement ${shown.seedTestsPlanned === 1 ? "test" : "tests"}`}
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
      )}
      <div className="mt-3 flex items-end gap-[2px]" style={{ height: H }} onMouseLeave={() => setHover(null)}>
        {days.map((d) => (
          <button
            key={d.date}
            type="button"
            aria-label={`${shortDay(d.date)}: ${series.map((s) => `${s.label} ${n(d[s.key])}`).join(", ")}`}
            onMouseEnter={() => setHover(d.date)}
            onFocus={() => setHover(d.date)}
            className="flex h-full min-w-0 flex-1 flex-col-reverse"
            style={{ opacity: hover && hover !== d.date ? 0.5 : 1 }}
          >
            {series.map((s) =>
              d[s.key] > 0 ? <span key={s.key} className="block w-full" style={{ height: Math.max(1, (d[s.key] / max) * H), background: s.color }} /> : null,
            )}
          </button>
        ))}
      </div>
      <div className="k-line-subtle flex gap-[2px] border-t pt-1.5">
        {days.map((d, i) => (
          <span key={d.date} className="k-fg3 min-w-0 flex-1 overflow-visible whitespace-nowrap text-[10.5px]">
            {i % every === 0 ? shortDay(d.date) : ""}
          </span>
        ))}
      </div>
      {queued && (
        <p className="k-fg3 mt-3 text-[12px] tabular-nums">
          Planned date = the previous send plus the step&apos;s delay, before any sending window or cap. Not shown: {n(totals.overdueQueuedSteps)} overdue, {n(totals.undatedQueuedSteps)} without a date,{" "}
          {n(totals.beyondHorizonQueuedSteps)} after {days.length ? shortDay(days[days.length - 1].date) : "the horizon"}.
        </p>
      )}
    </div>
  );
}

// ─── Capacity vs planned, cumulated ────────────────────────────────────────

/**
 * Per day from today: what the mailboxes can send (bars, cumulated from today) against the queued
 * steps planned (line, cumulated from today, starting with the steps already overdue), so the day the
 * backlog is absorbed, or still runs ahead, reads at a glance. Both reads are the producer's (the same
 * keys as the capacity and planned charts, so nothing is fetched twice); only the running totals are
 * added up here (`capacityVsPlanned`).
 */
export function CapacityPlanChart({ scope, lifecycle }: { scope: EntityScope; lifecycle?: "in_production" }) {
  const cap = useAuthQuery(["staffCapacityDaily", scopeQuery(scope), HORIZON_DAYS], () => getStaffCapacityDaily(scope, HORIZON_DAYS), ONCE);
  // `lifecycle` keeps the planned sends of addresses in production only (capacity already counts only those).
  const plan = useAuthQuery(["staffSchedule", scopeQuery(scope), HORIZON_DAYS, lifecycle ?? "all"], () => getStaffSchedule(scope, HORIZON_DAYS, lifecycle), ONCE);
  const [hover, setHover] = useState<string | null>(null);
  if (cap.isError) return <Failed what="the capacity per day" />;
  if (plan.isError) return <Failed what="what is planned ahead" />;
  if (!cap.data || !plan.data) {
    return (
      <div className="k-card p-4">
        <Shimmer className="h-[140px] w-full" />
      </div>
    );
  }
  const overdue = plan.data.totals.overdueQueuedSteps;
  const days = capacityVsPlanned(cap.data.days, plan.data.days, overdue);
  if (!days.length) {
    return (
      <div className="k-card">
        <EmptyNote>Nothing planned ahead.</EmptyNote>
      </div>
    );
  }
  const verdict = backlogVerdict(days);
  const H = 140;
  // Bar and line height only, never a figure shown. The scale follows the planned line (x1.6), so the
  // crossing stays readable when capacity cumulates far beyond the plan; taller bars stop at the top.
  const planMax = Math.max(...days.map((d) => d.cumulativePlanned));
  const allMax = Math.max(...days.map((d) => Math.max(d.cumulativeCapacity ?? 0, d.cumulativePlanned)));
  const max = Math.max(1, Math.min(planMax * 1.6, allMax));
  const y = (v: number) => H - (v / max) * H;
  const w = 100 / days.length;
  const shown = days.find((d) => d.date === hover) ?? days[0];
  const every = Math.ceil(days.length / 4);
  const fig = (v: number | null) => (v == null ? <Dash /> : n(v));
  return (
    <div className="k-card p-4">
      {verdict && (
        <p className="text-[13px]" style={{ color: verdict.kind === "overflow" ? RED : undefined }}>
          {verdict.kind === "covered"
            ? "Capacity covers every planned send."
            : verdict.kind === "absorbed"
              ? `Backlog absorbed by ${shortDay(verdict.date)}.`
              : `Planned sends still run ahead of capacity on ${shortDay(verdict.date)}.`}
        </p>
      )}
      <div className="k-fg2 mt-2 text-[12px]">{shortDay(shown.date)}{shown.date === days[0].date && " · today"}</div>
      <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[12px] tabular-nums">
        <div className="flex justify-between gap-2">
          <dt className="k-fg3">Capacity</dt>
          <dd>{fig(shown.capacity)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="k-fg3">Planned that day</dt>
          <dd>{n(shown.planned)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="inline-flex items-center gap-1.5 k-fg3">
            <span className="h-2 w-2 rounded-[2px]" style={{ background: "var(--data-teal)" }} aria-hidden="true" />
            Capacity, cumulated
          </dt>
          <dd>{fig(shown.cumulativeCapacity)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="inline-flex items-center gap-1.5 k-fg3">
            <span className="h-0.5 w-2.5 rounded-full" style={{ background: "var(--accent)" }} aria-hidden="true" />
            Planned, cumulated
          </dt>
          <dd>{n(shown.cumulativePlanned)}</dd>
        </div>
      </dl>
      <div className="relative mt-3" style={{ height: H }} onMouseLeave={() => setHover(null)}>
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {days.map((d) => (
            <button
              key={d.date}
              type="button"
              aria-label={`${shortDay(d.date)}: capacity ${d.capacity ?? "unknown"}, planned ${d.planned}, capacity cumulated ${d.cumulativeCapacity ?? "unknown"}, planned cumulated ${d.cumulativePlanned}`}
              onMouseEnter={() => setHover(d.date)}
              onFocus={() => setHover(d.date)}
              className="flex h-full min-w-0 flex-1 items-end"
              style={{ opacity: hover && hover !== d.date ? 0.5 : 1 }}
            >
              <span
                className="block w-full rounded-t-[2px]"
                style={{ height: Math.min(H, Math.max(2, ((d.cumulativeCapacity ?? 0) / max) * H)), background: "color-mix(in oklab, var(--data-teal) 55%, transparent)" }}
              />
            </button>
          ))}
        </div>
        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <polyline
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            points={days.map((d, i) => `${(i + 0.5) * w},${y(d.cumulativePlanned)}`).join(" ")}
          />
        </svg>
      </div>
      <div className="k-line-subtle flex gap-[2px] border-t pt-1.5">
        {days.map((d, i) => (
          <span key={d.date} className="k-fg3 min-w-0 flex-1 overflow-visible whitespace-nowrap text-[10.5px]">
            {i % every === 0 ? shortDay(d.date) : ""}
          </span>
        ))}
      </div>
      <p className="k-fg3 mt-3 text-[12px] tabular-nums">
        Planned = queued steps at their planned date, starting with {n(overdue)} overdue{lifecycle === "in_production" ? ", on addresses in production" : ""}.
      </p>
    </div>
  );
}

// ─── Unit events: emails ───────────────────────────────────────────────────

const KIND_FILTERS: Array<{ kind: string | null; label: string }> = [
  { kind: null, label: "All" },
  { kind: "outreach", label: MESSAGE_KIND_WORD.outreach },
  { kind: "manual_reply", label: MESSAGE_KIND_WORD.manual_reply },
  { kind: "warmup", label: MESSAGE_KIND_WORD.warmup },
  { kind: "warmup_reply", label: MESSAGE_KIND_WORD.warmup_reply },
  { kind: "seed", label: MESSAGE_KIND_WORD.seed },
];

/** The body of one email, read on open. */
function MessageBodyRow({ id, cols }: { id: string; cols: number }) {
  const q = useAuthQuery(["staffMessageBody", id], () => getStaffMessageBody(id), ONCE);
  return (
    <tr>
      <td colSpan={cols} className="k-inset px-4 py-3">
        {q.isError ? (
          <span className="k-fg3 text-[12px]">Could not read this email&apos;s body.</span>
        ) : !q.data ? (
          <Shimmer className="h-12 w-full" />
        ) : q.data.text ? (
          <pre className="k-fg2 max-h-[320px] overflow-auto whitespace-pre-wrap font-sans text-[12px] leading-[18px]">{q.data.text}</pre>
        ) : (
          <span className="k-fg3 text-[12px]">No body kept for this email ({q.data.source}).</span>
        )}
      </td>
    </tr>
  );
}

/** Emails of a scope, newest first, a kind filter on top; a row opens its body, an address its account page. */
export function MessagesTable({ base, scope, kinds = KIND_FILTERS }: { base: string; scope: EntityScope; kinds?: typeof KIND_FILTERS }) {
  const [kind, setKind] = useState<string | null>(kinds[0].kind);
  const [limit, setLimit] = useState(50);
  const [open, setOpen] = useState<string | null>(null);
  const q = useAuthQuery(["staffOpsMessagesScoped", scopeQuery(scope), kind, limit], () => getStaffOpsMessagesScoped(scope, kind, limit), ONCE);
  const ours = (m: { accountEmail: string | null; mailboxLogin: string | null }) =>
    m.accountEmail ? (
      <To base={base} path={entityPath("account", m.accountEmail)}>
        {m.accountEmail}
      </To>
    ) : (
      (m.mailboxLogin ?? <Dash />)
    );
  return (
    <div>
      {kinds.length > 1 && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Kind">
          {kinds.map((k) => (
            <button
              key={k.label}
              type="button"
              aria-pressed={kind === k.kind}
              onClick={() => {
                setKind(k.kind);
                setLimit(50);
              }}
              className={kind === k.kind ? "k-btn h-7 px-2 text-[12px]" : "k-btn-ghost h-7 px-2 text-[12px]"}
            >
              {k.label}
            </button>
          ))}
        </div>
      )}
      {q.isError ? (
        <Failed what="the emails" />
      ) : !q.data ? (
        <Loading />
      ) : !q.data.messages.length ? (
        <div className="k-card">
          <EmptyNote>No email of this kind here.</EmptyNote>
        </div>
      ) : (
        <>
          <Table
            head={
              <>
                <th className={TH}>When</th>
                <th className={TH}>Kind</th>
                <th className={TH}>From</th>
                <th className={TH}>To</th>
                <th className={TH}>Subject</th>
                <th className={TH}>Landed</th>
              </>
            }
          >
            {q.data.messages.map((m) => (
              <MessageRow key={m.id} m={m} open={open === m.id} onToggle={() => setOpen(open === m.id ? null : m.id)} ours={ours(m)} />
            ))}
          </Table>
          {q.data.nextCursor && limit < 500 && (
            <div className="k-fg3 flex justify-end px-1 pt-2 text-[12px]">
              <button type="button" className="k-btn-ghost h-6 px-2 text-[12px]" onClick={() => setLimit(Math.min(500, limit + 100))}>
                Show 100 more
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const PLACEMENT_WORD: Record<string, { word: string; color: string }> = {
  inbox: { word: "Inbox", color: OK },
  spam: { word: "Spam", color: RED },
  missing: { word: "Missing", color: AMBER },
};

function PlacementWord({ placement }: { placement: string | null }) {
  const p = placement ? PLACEMENT_WORD[placement] : undefined;
  if (!p) return <Dash />;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px]">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
      {p.word}
    </span>
  );
}

function MessageRow({
  m,
  open,
  onToggle,
  ours,
}: {
  m: { id: string; direction: string; kind: string; accountEmail: string | null; mailboxLogin: string | null; counterparty: string | null; subject: string | null; placement: string | null; occurredAt: string };
  open: boolean;
  onToggle: () => void;
  ours: React.ReactNode;
}) {
  const them = <span className="k-mono text-[12px]">{m.counterparty ?? <Dash />}</span>;
  return (
    <>
      <tr className={`k-row cursor-pointer ${open ? "k-selected" : ""}`} onClick={onToggle} aria-expanded={open}>
        <td className={`${TD} k-mono k-fg2 whitespace-nowrap text-[12px]`}>{when(m.occurredAt)}</td>
        <td className={`${TD} whitespace-nowrap`}>{MESSAGE_KIND_WORD[m.kind] ?? m.kind}</td>
        <td className={`${TD} k-mono text-[12px]`}>{m.direction === "in" ? them : ours}</td>
        <td className={`${TD} k-mono text-[12px]`}>{m.direction === "in" ? ours : them}</td>
        <td className={`${TD} k-fg2 max-w-[320px] truncate`} title={m.subject ?? undefined}>
          {m.subject ?? <Dash />}
        </td>
        <td className={TD}>
          <PlacementWord placement={m.placement} />
        </td>
      </tr>
      {open && <MessageBodyRow id={m.id} cols={6} />}
    </>
  );
}

// ─── Unit events: placement tests ──────────────────────────────────────────

function CountsCell({ c }: { c: ProviderCounts }) {
  if (!c.seeds) return <Dash />;
  return (
    <span className="whitespace-nowrap">
      {pct(c.inboxPct)}
      <span className="k-fg3 text-[11px]">
        {" "}
        {n(c.inbox)}/{n(c.seeds)}
      </span>
    </span>
  );
}

/** Placement tests of a scope, newest first, inbox share per provider; a row opens the test. */
export function PlacementTestsTable({ base, scope, first = 25 }: { base: string; scope: EntityScope; first?: number }) {
  const [limit, setLimit] = useState(first);
  const router = useRouter();
  const q = useAuthQuery(["staffPlacementTests", scopeQuery(scope), limit], () => getStaffPlacementTests(scope, limit, null), ONCE);
  if (q.isError) return <Failed what="the placement tests" />;
  if (!q.data) return <Loading />;
  if (!q.data.tests.length) {
    return (
      <div className="k-card">
        <EmptyNote>No placement test here yet.</EmptyNote>
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
            <th className={THR}>All</th>
            {TEST_PROVIDERS.map((p) => (
              <th key={p.key} className={THR}>
                {p.name}
              </th>
            ))}
          </>
        }
      >
        {q.data.tests.map((t) => (
          <tr key={t.testId} className="k-row cursor-pointer" onClick={() => router.push(`${base}/${placementTestPath(t.testId)}`)}>
            <td className={`${TD} k-mono k-fg2 whitespace-nowrap text-[12px]`}>
              <To base={base} path={placementTestPath(t.testId)}>
                {when(t.testedAt)}
              </To>
            </td>
            <td className={`${TD} whitespace-nowrap`}>{TEST_SOURCE_WORD[t.source] ?? t.source}</td>
            <td className={TDR}>{n(t.senders)}</td>
            <td className={TDR}>
              <CountsCell c={t.total} />
            </td>
            {TEST_PROVIDERS.map((p) => (
              <td key={p.key} className={TDR}>
                <CountsCell c={t.byProvider[p.key]} />
              </td>
            ))}
          </tr>
        ))}
      </Table>
      {q.data.nextCursor && limit < 500 && (
        <div className="k-fg3 flex justify-end px-1 pt-2 text-[12px]">
          <button type="button" className="k-btn-ghost h-6 px-2 text-[12px]" onClick={() => setLimit(Math.min(500, limit + 50))}>
            Show 50 more
          </button>
        </div>
      )}
    </>
  );
}

// ─── Unit events: queued steps ─────────────────────────────────────────────

/** Queued sequence steps of a scope at their planned date, oldest first; the address opens its page. */
export function QueuedStepsTable({ base, scope }: { base: string; scope: EntityScope }) {
  const [limit, setLimit] = useState(50);
  const q = useAuthQuery(["staffQueuedSteps", scopeQuery(scope), limit], () => getStaffQueuedSteps(scope, limit, 0), ONCE);
  if (q.isError) return <Failed what="the queued steps" />;
  if (!q.data) return <Loading />;
  if (!q.data.steps.length) {
    return (
      <div className="k-card">
        <EmptyNote>Nothing queued here.</EmptyNote>
      </div>
    );
  }
  return (
    <>
      <Table
        head={
          <>
            <th className={TH}>Planned date</th>
            <th className={TH}>Lead</th>
            <th className={TH}>Step</th>
            <th className={TH}>From</th>
            <th className={TH}>State</th>
          </>
        }
      >
        {q.data.steps.map((s) => (
          <tr key={`${s.leadEmail}|${s.account}|${s.step}|${s.campaignId ?? ""}`} className="k-row">
            <td className={`${TD} k-mono k-fg2 whitespace-nowrap text-[12px]`}>{s.theoreticalAt ? when(s.theoreticalAt) : <Dash />}</td>
            <td className={`${TD} k-mono text-[12px]`}>{s.leadEmail}</td>
            <td className={`${TD} whitespace-nowrap`}>{s.isFirstEmail ? "First email" : `Follow-up, step ${s.step}`}</td>
            <td className={TD}>
              <To base={base} path={entityPath("account", s.account)}>
                {s.account}
              </To>
            </td>
            <td className={TD}>
              {s.overdue ? (
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px]">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: AMBER }} />
                  Overdue
                </span>
              ) : (
                <span className="k-fg3 text-[12px]">Planned</span>
              )}
            </td>
          </tr>
        ))}
      </Table>
      <div className="k-fg3 flex items-center justify-between px-1 pt-2 text-[12px] tabular-nums">
        <span>
          {n(q.data.steps.length)} of {n(q.data.total)}
        </span>
        {q.data.nextOffset != null && limit < 1000 && (
          <button type="button" className="k-btn-ghost h-6 px-2 text-[12px]" onClick={() => setLimit(Math.min(1000, limit + 100))}>
            Show 100 more
          </button>
        )}
      </div>
    </>
  );
}

// ─── One account / mailbox / domain ────────────────────────────────────────

/** Where the entity sits: its mailbox, domain, addresses, status. Lookups in the list reads only. */
function EntityFacts({ base, kind, id }: { base: string; kind: EntityKind; id: string }) {
  const addresses = useOpsAddresses();
  const mailboxes = useOpsMailboxes();
  const domains = useOpsDomains();
  const key = id.toLowerCase();
  const chip = "k-chip inline-flex items-center gap-1.5";
  if (kind === "account") {
    const a = addresses.data?.accounts.find((x) => x.email.toLowerCase() === key);
    if (!a) return addresses.data ? <p className="k-fg3 mt-2 text-[12px]">Not in the current list of sending addresses.</p> : <Shimmer className="mt-2 h-5 w-64" />;
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
        <StatusWord status={a.lifecycleStatus} />
        {a.mailboxLogin && (
          <span className={chip}>
            Mailbox <To base={base} path={entityPath("mailbox", a.mailboxLogin)}>{a.mailboxLogin}</To>
          </span>
        )}
        {a.domain && (
          <span className={chip}>
            Domain <To base={base} path={entityPath("domain", a.domain)}>{a.domain}</To>
          </span>
        )}
        {a.dailyLimit != null && <span className={chip}>Daily limit {n(a.dailyLimit)}</span>}
      </div>
    );
  }
  if (kind === "mailbox") {
    const m = mailboxes.data?.mailboxes.find((x) => x.login.toLowerCase() === key);
    if (!m) return mailboxes.data ? <p className="k-fg3 mt-2 text-[12px]">Not in the current list of mailboxes.</p> : <Shimmer className="mt-2 h-5 w-64" />;
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
        {m.absentSince ? <span className="k-fg3">Gone since {shortDay(m.absentSince)}</span> : <StatusWord status={m.addresses[0]?.lifecycleStatus ?? null} />}
        <span className={chip}>
          Domain <To base={base} path={entityPath("domain", m.domain)}>{m.domain}</To>
        </span>
        {m.provider && <span className={chip}>{vendorName(m.provider)}</span>}
        {m.addresses.map((a) => (
          <span key={a.email} className={chip}>
            <To base={base} path={entityPath("account", a.email)}>{a.email}</To>
          </span>
        ))}
      </div>
    );
  }
  const d = domains.data?.domains.find((x) => x.domain.toLowerCase() === key);
  const its = mailboxes.data?.mailboxes.filter((x) => x.domain.toLowerCase() === key) ?? [];
  if (!d) return domains.data ? <p className="k-fg3 mt-2 text-[12px]">Not in the current list of domains.</p> : <Shimmer className="mt-2 h-5 w-64" />;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
      <span className="k-fg2">{d.absentSince ? `Gone since ${shortDay(d.absentSince)}` : d.status ? vendorName(d.status) : null}</span>
      {d.provider && <span className={chip}>{vendorName(d.provider)}</span>}
      {its.map((m) => (
        <span key={m.login} className={chip}>
          <To base={base} path={entityPath("mailbox", m.login)}>{m.login}</To>
        </span>
      ))}
    </div>
  );
}

/** One account, mailbox or domain: sent per day, capacity, planned ahead, and its unit events. */
export function EntityPage({ base, kind, id }: { base: string; kind: EntityKind; id: string }) {
  const scope: EntityScope = { [kind]: id };
  return (
    <div className="space-y-8">
      <EntityFacts base={base} kind={kind} id={id} />
      {kind === "domain" ? <DomainDetails base={base} id={id} /> : kind === "mailbox" ? <MailboxDetails base={base} id={id} /> : <AccountDetails base={base} id={id} />}
      <section>
        <SectionTitle right={<span>Last {HISTORY_DAYS} days, UTC</span>}>Sent per day, by kind</SectionTitle>
        <ScopedSentPerDay scope={scope} />
      </section>
      <section>
        <SectionTitle right={<span>Past and next {HORIZON_DAYS} days</span>}>Capacity per day</SectionTitle>
        <CapacityChart scope={scope} />
      </section>
      <section>
        <SectionTitle right={<span>Next {HORIZON_DAYS} days</span>}>Planned ahead</SectionTitle>
        <ScheduleChart scope={scope} />
      </section>
      <section>
        <SectionTitle right={<span>Next {HORIZON_DAYS} days</span>}>Capacity vs planned, cumulated</SectionTitle>
        <CapacityPlanChart scope={scope} />
      </section>
      <section>
        <SectionTitle>Emails</SectionTitle>
        <MessagesTable base={base} scope={scope} />
      </section>
      <section>
        <SectionTitle>Placement tests</SectionTitle>
        <PlacementTestsTable base={base} scope={scope} />
      </section>
      <section>
        <SectionTitle>Queued steps</SectionTitle>
        <QueuedStepsTable base={base} scope={scope} />
      </section>
    </div>
  );
}

export const entityTitle = (kind: EntityKind) => ENTITY_WORD[kind];

// ─── Fleet pages: Placement tests, Warmup, Queued sequences ────────────────

export function PlacementTestsPage({ base }: { base: string }) {
  return (
    <section>
      <SectionTitle>Every placement test</SectionTitle>
      <p className="k-fg3 -mt-1 mb-3 text-[12px]">Test emails to seed inboxes at each provider: the share that landed in the inbox, of the seeds sent. Open a test to see each seed.</p>
      <PlacementTestsTable base={base} scope={{}} first={50} />
    </section>
  );
}

const WARMUP_KINDS: Series[] = ALL_KINDS.filter((s) => s.key === "warmup" || s.key === "warmupReplies");

export function WarmupPage({ base }: { base: string }) {
  return (
    <div className="space-y-8">
      <section>
        <SectionTitle right={<span>Last {HISTORY_DAYS} days, UTC</span>}>Warmup sent per day</SectionTitle>
        <ScopedSentPerDay scope={{}} series={WARMUP_KINDS} />
      </section>
      <section>
        <SectionTitle right={<span>Next {HORIZON_DAYS} days</span>}>Warmup planned ahead</SectionTitle>
        <ScheduleChart scope={{}} series={PLAN_WARMUP} />
      </section>
      <section>
        <SectionTitle>Latest warmup emails</SectionTitle>
        <MessagesTable base={base} scope={{}} kinds={KIND_FILTERS.filter((k) => k.kind === "warmup" || k.kind === "warmup_reply")} />
      </section>
    </div>
  );
}

export function QueuedPage({ base }: { base: string }) {
  return (
    <div className="space-y-8">
      <section>
        <SectionTitle right={<span>Next {HORIZON_DAYS} days</span>}>Queued steps per planned day</SectionTitle>
        <ScheduleChart scope={{}} series={PLAN_QUEUED} />
      </section>
      <section>
        <SectionTitle>Every queued step</SectionTitle>
        <QueuedStepsTable base={base} scope={{}} />
      </section>
    </div>
  );
}

// ─── One placement test ────────────────────────────────────────────────────

/** Display order only: seeds grouped by provider, Google first. */
const providerRank = (p: string) => {
  const i = TEST_PROVIDERS.findIndex((x) => x.key === p);
  return i < 0 ? TEST_PROVIDERS.length : i;
};

const PASS = (v: boolean | null) => (v == null ? <Dash /> : v ? <span style={{ color: OK }}>Pass</span> : <span style={{ color: RED }}>Fail</span>);

export function PlacementTestPage({ base, testId }: { base: string; testId: string }) {
  const q = useAuthQuery(["staffPlacementTest", testId], () => getStaffPlacementTest(testId), ONCE);
  // One fleet test holds thousands of seeds (3,002 on Oct 19): the tables show a page, then all.
  const senders = useShowAll(q.data?.bySender.length ?? 0, 25);
  const seeds = useShowAll(q.data?.seeds.length ?? 0, 100);
  if (q.isError) return <Failed what="this placement test" />;
  if (!q.data) return <Loading />;
  const t = q.data;
  return (
    <div className="space-y-8">
      <p className="k-fg2 -mt-2 text-[13px]">
        {TEST_SOURCE_WORD[t.source] ?? t.source}
        {t.testedAt && `, ${when(t.testedAt)} UTC`}
        {!t.missingSeedsListed && ". Instantly lists only the seeds it found: missing seeds count here, not below."}
      </p>
      <div className="k-card grid grid-cols-2 divide-[var(--line-subtle)] md:grid-cols-5 md:divide-x">
        {[{ key: "all", name: "All providers", c: t.total }, ...TEST_PROVIDERS.map((p) => ({ key: p.key, name: p.name, c: t.byProvider[p.key] }))].map((x) => (
          <div key={x.key} className="p-4">
            <p className="k-label">{x.name}</p>
            <p className="mt-1 text-[22px] font-medium tabular-nums leading-[28px]">{x.c.seeds ? pct(x.c.inboxPct) : <Dash />}</p>
            <p className="k-fg3 mt-0.5 text-[12px] tabular-nums">
              {x.c.seeds ? `${n(x.c.inbox)} inbox · ${n(x.c.spam)} spam · ${n(x.c.missing)} missing` : "no seed"}
            </p>
          </div>
        ))}
      </div>
      <section>
        <SectionTitle count={t.bySender.length}>By sender</SectionTitle>
        <Table
          head={
            <>
              <th className={TH}>Sender</th>
              <th className={TH}>Mailbox</th>
              <th className={THR}>All</th>
              {TEST_PROVIDERS.map((p) => (
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
                <To base={base} path={entityPath("account", s.sender)}>{s.sender}</To>
              </td>
              <td className={TD}>
                <To base={base} path={entityPath("mailbox", s.senderMailbox)}>{s.senderMailbox}</To>
              </td>
              <td className={TDR}>
                <CountsCell c={s.total} />
              </td>
              {TEST_PROVIDERS.map((p) => (
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
        <SectionTitle count={t.seeds.length}>Each seed, by inbox provider</SectionTitle>
        <Table
          head={
            <>
              <th className={TH}>Provider</th>
              <th className={TH}>Landed</th>
              <th className={TH}>Folder</th>
              <th className={TH}>Seed inbox</th>
              <th className={TH}>Sender</th>
              <th className={TH}>SPF</th>
              <th className={TH}>DKIM</th>
              <th className={TH}>DMARC</th>
            </>
          }
        >
          {[...t.seeds].sort((a, b) => providerRank(a.provider) - providerRank(b.provider)).slice(0, seeds.limit).map((s, i) => (
            <tr key={`${s.sender}|${s.receiver ?? i}`} className="k-row">
              <td className={`${TD} whitespace-nowrap`}>{s.providerLabel}</td>
              <td className={TD}>{s.placement ? <PlacementWord placement={s.placement} /> : <span className="k-fg3 text-[12px]">Not sent ({s.dispatchOutcome})</span>}</td>
              <td className={`${TD} k-fg2 text-[12px]`}>{s.folder ?? <Dash />}</td>
              <td className={`${TD} k-mono text-[12px]`}>{s.receiver ?? <Dash />}</td>
              <td className={TD}>
                <To base={base} path={entityPath("account", s.sender)}>{s.sender}</To>
              </td>
              <td className={`${TD} text-[12px]`}>{PASS(s.spfPass)}</td>
              <td className={`${TD} text-[12px]`}>{PASS(s.dkimPass)}</td>
              <td className={`${TD} text-[12px]`}>{PASS(s.dmarcPass)}</td>
            </tr>
          ))}
        </Table>
        {seeds.footer}
      </section>
    </div>
  );
}
