"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getInstantlyAccountDetail,
  getOpsAddresses,
  type InstantlyAccountDetail,
  type InstantlyAccountInboxPlacement,
  type OpsAddressRow,
  type OpsAddresses,
} from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { QueueDistributionChart, type QueueDistributionBin } from "@/components/audit/queue-distribution-chart";
import { ProviderLogo, InstantlyLogo } from "@/components/audit/provider-logo";
import {
  AsOf,
  LifecyclePill,
  PageHeader,
  PanelGroup,
  PanelRow,
  RampLine,
  Section,
  SlideOver,
  VolumeCell,
  num,
  utc,
  utcDay,
} from "@/components/cold-email/primitives";
import { lifecycleLabel } from "@/lib/instantly-ops";

/**
 * Cold email — Accounts (one row per SENDING ADDRESS).
 *
 * This is the old `/audit/instantly` "Sending accounts" table, fed by
 * `/instantly/ops/addresses` instead of `/instantly/audit/account-health`. That
 * read is a strict SUPERSET — the same field names carrying the same values — so
 * every column, sort, tab and panel row shows exactly what it showed before, and
 * the mailbox, transport, evidence expiry, next seed test, ramp, 7-day volume
 * and lifecycle history are new rows on top.
 */

// Tab / grouping key = the address's lifecycle state (which IS the send gate).
function statusKey(row: OpsAddressRow): string {
  if (row.lifecycleStatus) return row.lifecycleStatus;
  if (!row.blocked) return "in_production";
  return row.blockReason ?? "unclassified";
}

/**
 * The one honest "how full is this account today" figure, and the exact quantity
 * the send selector counts toward an account's daily load. A never-started lead
 * owes ONE email today, not one per remaining step — so this reads the LEAD
 * count, never `queuedFirstUnsent` (which counts every remaining step).
 */
function queuedTodayFor(r: OpsAddressRow): number {
  return r.queuedFirstUnsentSequences + r.queuedNextToday;
}

/**
 * The daily max send this address ACTUALLY has today: the producer's ramp-aware
 * cap, falling back to the configured limit only when it omits the field.
 * `dailyLimit` alone is the number BEFORE the ramp, so a table reading it says 50
 * for a mailbox the selector is holding at 23.
 */
function dailyMaxFor(r: OpsAddressRow): number | null {
  return r.effectiveDailyCap ?? r.dailyLimit;
}

const COLUMNS = [
  { key: "fillRank", label: "#", align: "right" },
  { key: "email", label: "Account", align: "left" },
  { key: "mailboxLogin", label: "Mailbox", align: "left" },
  { key: "lifecycleStatus", label: "Lifecycle", align: "left" },
  { key: "warmupScore", label: "Health", align: "left" },
  { key: "nextSeedTest", label: "Next seed test", align: "left" },
  { key: "sentYesterday", label: "Sent D-1", align: "right" },
  { key: "sentToday", label: "Sent today", align: "right" },
  { key: "dailyLimit", label: "Daily max send", align: "right" },
  { key: "queuedToday", label: "Queued today", align: "right" },
  { key: "queuedOverdue", label: "Overdue", align: "right" },
  { key: "queuedNextTomorrow", label: "Queued tomorrow", align: "right" },
  { key: "queuedNextLater", label: "Queued later", align: "right" },
  { key: "volume7d", label: "Volume 7d", align: "right" },
  // DEBUG (temporary, carried over from the old page): the backend's own
  // `queueSize` plus a reconciliation against the four visible date buckets.
  { key: "queuedTotal", label: "Queued total", align: "right" },
] as const;

type SortKey = (typeof COLUMNS)[number]["key"];

const COLUMN_HINT: Partial<Record<SortKey, string>> = {
  fillRank:
    "Position in send selection's fill order over the in-production pool (vendor, then domain rank, then age). Rank 1 is offered every new sequence first and is filled to its cap before rank 2 is touched. Dash = not in that pool.",
  mailboxLogin:
    "The real mailbox this address sends through. Several addresses can share one mailbox, and one mailbox is one subscription.",
  nextSeedTest:
    "When the placement evidence is refreshed next, and why it is due. Stale evidence is what demotes an address out of production.",
  dailyLimit:
    "The daily max send this account actually has today: its configured limit capped by the age ramp. This is the ceiling send selection compares today's load against.",
  queuedToday:
    "Emails actually due today = Initial (one first email per never-started lead) + Followups (steps projected today/overdue).",
  queuedOverdue:
    "Backlog: the part of Followups we owed on an EARLIER day and never dispatched. A subset of Queued today, never added to it.",
  queuedNextTomorrow: "Steps projected tomorrow (UTC)",
  queuedNextLater: "Steps projected after tomorrow",
  volume7d: "What this address actually sent and received over the last 7 days, by typology.",
  queuedTotal:
    "DEBUG \u2014 backend Queued steps (queueSize), a STEP total, not a due-today one. Green when it equals first-unsent steps + Followups + tomorrow + later.",
};

function compareRows(a: OpsAddressRow, b: OpsAddressRow, key: SortKey, dir: "asc" | "desc"): number {
  const sign = dir === "asc" ? 1 : -1;
  if (key === "lifecycleStatus") return statusKey(a).localeCompare(statusKey(b)) * sign;
  // Health is a composite: inbox placement first, Health Score as tiebreak. A
  // null (never tested) is worse than 0, so asc surfaces untested first.
  if (key === "warmupScore") {
    const level = (av: number | null, bv: number | null): number => {
      if (av === null && bv === null) return 0;
      const aN = av ?? -Infinity;
      const bN = bv ?? -Infinity;
      return dir === "asc" ? aN - bN : bN - aN;
    };
    const byInbox = level(a.inboxPlacement?.inboxPct ?? null, b.inboxPlacement?.inboxPct ?? null);
    if (byInbox !== 0) return byInbox;
    return level(a.warmupScore, b.warmupScore);
  }
  // Merged "Queued today" sorts on the same value the column renders.
  if (key === "queuedToday") {
    const av = queuedTodayFor(a);
    const bv = queuedTodayFor(b);
    return (av - bv) * sign;
  }
  if (key === "volume7d") return (a.volume7d.outreach - b.volume7d.outreach) * sign;
  if (key === "queuedTotal") return (a.queueSize - b.queueSize) * sign;
  if (key === "nextSeedTest") {
    // Due first in asc: an address owing a test is what an operator acts on.
    const rank = (r: OpsAddressRow) => (r.nextSeedTest?.due ? 0 : 1);
    const byDue = (rank(a) - rank(b)) * sign;
    if (byDue !== 0) return byDue;
    const av = a.nextSeedTest?.expectedAt ? Date.parse(a.nextSeedTest.expectedAt) : null;
    const bv = b.nextSeedTest?.expectedAt ? Date.parse(b.nextSeedTest.expectedAt) : null;
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return (av - bv) * sign;
  }
  if (key === "dailyLimit") {
    const av = dailyMaxFor(a);
    const bv = dailyMaxFor(b);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return (av - bv) * sign;
  }
  const av = (a as unknown as Record<string, unknown>)[key];
  const bv = (b as unknown as Record<string, unknown>)[key];
  const aNull = av === null || av === undefined || av === "";
  const bNull = bv === null || bv === undefined || bv === "";
  if (aNull && bNull) return 0;
  if (aNull) return 1; // nulls always last, whichever direction
  if (bNull) return -1;
  if (typeof av === "number" && typeof bv === "number") return (av - bv) * sign;
  return String(av).localeCompare(String(bv)) * sign;
}

// Queued-today histogram bins, over the same `queuedTodayFor` value the column
// shows. `0` is standalone so an empty queue reads distinctly from a small one.
const QUEUE_BINS: { label: string; lo: number; hi: number }[] = [
  { label: "0", lo: 0, hi: 0 },
  { label: "1–50", lo: 1, hi: 50 },
  { label: "51–100", lo: 51, hi: 100 },
  { label: "101–150", lo: 101, hi: 150 },
  { label: "151+", lo: 151, hi: Infinity },
];

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-gray-400">—</span>;
  const cls =
    score >= 90
      ? "bg-emerald-100 text-emerald-800"
      : score >= 70
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";
  return (
    <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${cls}`}>
      {score}
    </span>
  );
}

function InboxPlacementCell({ placement }: { placement: InstantlyAccountInboxPlacement | null }) {
  if (placement === null) return <span className="text-gray-400">—</span>;
  const inbox = Math.round(placement.inboxPct);
  const cls =
    inbox >= 80
      ? "bg-emerald-100 text-emerald-800"
      : inbox >= 50
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";
  return (
    <span className="inline-flex flex-col items-start gap-0.5" title={`Placement test as of ${utc(placement.testedAt)}`}>
      <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${cls}`}>
        {inbox}% inbox
      </span>
      <span className="text-[10px] tabular-nums text-gray-400">
        {Math.round(placement.spamPct)}% spam · {Math.round(placement.missingPct)}% missing
      </span>
    </span>
  );
}

// --- Raw Instantly config ---------------------------------------------------
// The legacy `account-detail` read, unchanged: the FULL raw Instantly account
// object so staff can audit every mailbox setting the ops model does not model.
type RawLeaf = string | number | boolean | null;

function flattenRawConfig(obj: Record<string, unknown>): Array<{ key: string; value: RawLeaf }> {
  const out: Array<{ key: string; value: RawLeaf }> = [];
  const walk = (value: unknown, prefix: string): void => {
    if (value === null || value === undefined) {
      out.push({ key: prefix, value: null });
      return;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        out.push({ key: prefix, value: null });
        return;
      }
      const allPrimitive = value.every(
        (v) => v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean",
      );
      if (allPrimitive) {
        out.push({ key: prefix, value: value.map((v) => (v === null ? "—" : String(v))).join(", ") });
        return;
      }
      value.forEach((v, i) => walk(v, `${prefix}[${i}]`));
      return;
    }
    if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) {
        out.push({ key: prefix, value: null });
        return;
      }
      for (const [k, v] of entries) walk(v, prefix ? `${prefix}.${k}` : k);
      return;
    }
    out.push({ key: prefix, value: value as RawLeaf });
  };
  for (const [k, v] of Object.entries(obj)) walk(v, k);
  return out;
}

function BoolPill({ value }: { value: boolean }) {
  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${
        value ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
      }`}
    >
      {value ? "true" : "false"}
    </span>
  );
}

function RawConfigSection({ email }: { email: string }) {
  const { data, isPending, isError, error } = useAuthQuery<InstantlyAccountDetail>(
    ["instantlyAccountDetail", email],
    () => getInstantlyAccountDetail(email),
  );
  const entries = useMemo(() => (data ? flattenRawConfig(data.account) : []), [data]);

  return (
    <PanelGroup title="Raw Instantly config">
      {isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-medium text-red-700">Couldn&apos;t load the raw Instantly config.</p>
          <p className="mt-1 text-[11px] text-red-500">{error?.message ?? "Unknown error"}</p>
        </div>
      ) : isPending ? (
        <div className="flex flex-col gap-2 py-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full rounded" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="py-2 text-xs text-gray-400">No config fields returned.</p>
      ) : (
        <div className="flex flex-col">
          {entries.map(({ key, value }) => (
            <div
              key={key}
              className="flex items-start justify-between gap-4 border-b border-gray-50 py-1.5 last:border-0"
            >
              <span className="break-all font-mono text-[11px] text-gray-500">{key}</span>
              <span className="break-all text-right text-sm tabular-nums text-gray-900">
                {value === null ? (
                  <span className="text-gray-400">—</span>
                ) : typeof value === "boolean" ? (
                  <BoolPill value={value} />
                ) : (
                  String(value)
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </PanelGroup>
  );
}

function AddressPanel({ row, onClose }: { row: OpsAddressRow; onClose: () => void }) {
  const seed = row.nextSeedTest;
  return (
    <SlideOver title={row.email} subtitle={row.domain ?? "—"} onClose={onClose}>
      <PanelGroup title="Where it lives">
        <PanelRow label="Mailbox">{row.mailboxLogin ?? "—"}</PanelRow>
        <PanelRow label="Domain">{row.domain ?? "—"}</PanelRow>
        <PanelRow label="Transport">{row.sendTransport ?? "—"}</PanelRow>
        <PanelRow label="Account type">{row.accountType ?? "—"}</PanelRow>
      </PanelGroup>

      <PanelGroup title="Lifecycle">
        <PanelRow label="State">
          <LifecyclePill status={statusKey(row)} />
        </PanelRow>
        <PanelRow label="Status">{row.status}</PanelRow>
        <PanelRow label="Reason">{row.lifecycleReason ?? "—"}</PanelRow>
        <PanelRow label="Block reason">{row.blockReason ?? "—"}</PanelRow>
        <PanelRow label="Last transition">{utc(row.lifecycleUpdatedAt)}</PanelRow>
      </PanelGroup>

      <PanelGroup title="Health">
        <PanelRow label="Health Score">
          <ScoreBadge score={row.warmupScore} />
        </PanelRow>
        <PanelRow label="Inbox placement">
          <InboxPlacementCell placement={row.inboxPlacement} />
        </PanelRow>
        <PanelRow label="Evidence expires">{utc(row.evidenceExpiresAt)}</PanelRow>
        <PanelRow label="Next seed test">
          {seed ? (
            <span className="inline-flex flex-col items-end">
              <span>{seed.due ? "due now" : "not due"}</span>
              <span className="text-[10px] text-gray-400">
                {seed.reason ?? "no reason given"}
                {seed.expectedAt ? ` · ${utcDay(seed.expectedAt)}` : ""}
                {seed.ageDays === null ? "" : ` · evidence ${num(seed.ageDays)}d old`}
              </span>
            </span>
          ) : (
            "—"
          )}
        </PanelRow>
      </PanelGroup>

      <PanelGroup title="Send limits">
        <PanelRow label="Fill order">
          {row.fillRank === null || row.fillRank === undefined ? "—" : num(row.fillRank)}
        </PanelRow>
        <PanelRow label="Daily max send">{num(dailyMaxFor(row))}</PanelRow>
        {/* The configured limit is stated ONLY while the age ramp holds the
            account below it, or the panel says one number twice under two labels. */}
        {row.effectiveDailyCap !== null &&
          row.effectiveDailyCap !== undefined &&
          row.effectiveDailyCap !== row.dailyLimit && (
            <PanelRow label="— configured limit (before age ramp)">{num(row.dailyLimit)}</PanelRow>
          )}
        <PanelRow label="Daily warmup send">{num(row.warmupLimit)}</PanelRow>
        <PanelRow label="Ramp">
          <RampLine projection={row.rampProjection} />
        </PanelRow>
      </PanelGroup>

      <PanelGroup title="Sent">
        <PanelRow label="Sent D-1">{num(row.sentYesterday)}</PanelRow>
        <PanelRow label="Sent today">{num(row.sentToday)}</PanelRow>
        <PanelRow label="Volume 7d">
          <VolumeCell volume={row.volume7d} />
        </PanelRow>
      </PanelGroup>

      {/* Due-today LEADS and the step partition sit under separate headings — a
          never-started lead owes one email today but several steps overall, so the
          two totals differ on purpose and must never be read as one number. */}
      <PanelGroup title="Due today">
        <PanelRow label="Queued today (Initial + Followups)">{num(queuedTodayFor(row))}</PanelRow>
        <PanelRow label="— Initial (leads not yet contacted)">{num(row.queuedFirstUnsentSequences)}</PanelRow>
        <PanelRow label="— Followups (steps today/overdue)">{num(row.queuedNextToday)}</PanelRow>
        <PanelRow label="— of which overdue (owed before today)">
          {row.queuedOverdue === undefined ? "—" : num(row.queuedOverdue)}
        </PanelRow>
      </PanelGroup>

      <PanelGroup title="Queue (all remaining steps)">
        <PanelRow label="Queued steps">{num(row.queueSize)}</PanelRow>
        <PanelRow label="Queued sequences">{num(row.queuedSequences)}</PanelRow>
        <PanelRow label="— First-unsent steps">{num(row.queuedFirstUnsent)}</PanelRow>
        <PanelRow label="— Steps today/overdue">{num(row.queuedNextToday)}</PanelRow>
        <PanelRow label="— Steps tomorrow">{num(row.queuedNextTomorrow)}</PanelRow>
        <PanelRow label="— Steps later">{num(row.queuedNextLater)}</PanelRow>
      </PanelGroup>

      <PanelGroup title={`Lifecycle history (${num(row.lifecycleHistory.length)})`}>
        {row.lifecycleHistory.length === 0 ? (
          <p className="py-1 text-xs text-gray-400">No transition on record.</p>
        ) : (
          <ol className="flex flex-col">
            {row.lifecycleHistory.map((h, i) => (
              <li key={`${h.at}:${i}`} className="border-b border-gray-50 py-2 last:border-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  {h.fromStatus && (
                    <>
                      <LifecyclePill status={h.fromStatus} />
                      <span className="text-[10px] text-gray-400" aria-hidden>
                        →
                      </span>
                    </>
                  )}
                  <LifecyclePill status={h.toStatus} />
                </div>
                <p className="mt-0.5 text-[10px] text-gray-400">
                  {utc(h.at)}
                  {h.reason ? ` · ${h.reason}` : ""}
                  {h.healthScore === null ? "" : ` · health ${num(h.healthScore)}`}
                  {h.deliveryPct === null ? "" : ` · ${h.deliveryPct.toFixed(1)}% inbox`}
                </p>
              </li>
            ))}
          </ol>
        )}
      </PanelGroup>

      <RawConfigSection email={row.email} />
    </SlideOver>
  );
}

export default function ColdEmailAccountsPage() {
  const { data, isPending, isError, error } = useAuthQuery<OpsAddresses>(
    ["opsAddresses"],
    () => getOpsAddresses(),
    pollOptionsSlower,
  );

  const accounts = useMemo(() => data?.accounts ?? [], [data]);

  const tabs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of accounts) {
      const k = statusKey(r);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const rest = [...counts.keys()]
      .filter((k) => k !== "in_production")
      .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
    const ordered = counts.has("in_production") ? ["in_production", ...rest] : rest;
    return ordered.map((k) => ({ key: k, label: lifecycleLabel(k), count: counts.get(k) ?? 0 }));
  }, [accounts]);

  const [tab, setTab] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("fillRank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<OpsAddressRow | null>(null);

  const activeTab = tab && tabs.some((t) => t.key === tab) ? tab : (tabs[0]?.key ?? null);

  // Queue health over the whole in-production set, independent of the active tab.
  const allowed = useMemo(() => accounts.filter((r) => !r.blocked), [accounts]);
  const pctWithQueue = allowed.length
    ? (allowed.filter((r) => r.queueSize > 0).length / allowed.length) * 100
    : 0;
  const avgQueue = allowed.length ? allowed.reduce((s, r) => s + r.queueSize, 0) / allowed.length : 0;
  const queueBins: QueueDistributionBin[] = QUEUE_BINS.map((b) => {
    const count = allowed.filter((r) => {
      const q = queuedTodayFor(r);
      return q >= b.lo && q <= b.hi;
    }).length;
    return { label: b.label, count, pct: allowed.length ? (count / allowed.length) * 100 : 0 };
  });

  const q = query.trim().toLowerCase();
  const rows = accounts
    .filter((r) => statusKey(r) === activeTab)
    .filter(
      (r) =>
        !q ||
        r.email.toLowerCase().includes(q) ||
        (r.domain ?? "").toLowerCase().includes(q) ||
        (r.mailboxLogin ?? "").toLowerCase().includes(q),
    )
    .slice()
    .sort((a, b) => compareRows(a, b, sortKey, sortDir));

  function onSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const blockedCount = accounts.filter((r) => r.blocked).length;
  const seedDue = accounts.filter((r) => r.nextSeedTest?.due).length;

  const Cell = ({ children, align }: { children: ReactNode; align?: "right" }) => (
    <td className={`py-2.5 px-2 ${align === "right" ? "text-right tabular-nums text-gray-700" : ""}`}>
      {children}
    </td>
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Cold email: accounts"
        blurb="Every sending address across the shared Instantly workspace: the mailbox it sends through, its lifecycle and why, its health and placement evidence, the cap it is held to, what it owes today, and what it sent last week."
      />

      <Section
        title="Sending accounts"
        blurb="Tabbed by lifecycle. Sort any column, filter by address, mailbox or domain, and open a row for the ramp, the lifecycle history and the raw Instantly config."
        isPending={isPending}
        isError={isError}
        error={error}
        empty={data && accounts.length === 0 ? "No sending accounts found." : null}
        action={
          !isPending && !isError ? (
            <span className="flex flex-wrap items-center gap-2">
              {seedDue > 0 && (
                <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                  {num(seedDue)} seed test{seedDue === 1 ? "" : "s"} due
                </span>
              )}
              <span
                className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${
                  blockedCount > 0
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
              >
                {num(accounts.length)} account{accounts.length === 1 ? "" : "s"}
                {blockedCount > 0 ? ` · ${num(blockedCount)} blocked` : " · all sendable"}
              </span>
            </span>
          ) : undefined
        }
      >
        {data && accounts.length > 0 && (
          <>
            <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  In-production accounts: queue health
                </h3>
                <span className="text-xs text-gray-400">{num(allowed.length)} in production</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">With a queue</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">
                    {pctWithQueue.toFixed(0)}%
                  </p>
                  <p className="text-xs text-gray-400">have un-sent steps &gt; 0</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Avg in queue</p>
                  <p className="mt-1 text-2xl font-semibold text-gray-900 tabular-nums">
                    {avgQueue.toFixed(1)}
                  </p>
                  <p className="text-xs text-gray-400">un-sent steps per allowed account</p>
                </div>
              </div>
              <div className="mt-4">
                <p className="text-xs font-medium text-gray-500">
                  Queued-today distribution (% of in-production accounts)
                </p>
                <div className="mt-2">
                  {allowed.length === 0 ? (
                    <p className="py-8 text-center text-sm text-gray-400">No in-production accounts.</p>
                  ) : (
                    <QueueDistributionChart data={queueBins} />
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-1 border-b border-gray-200">
              {tabs.map((t) => {
                const active = t.key === activeTab;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setTab(t.key);
                      setQuery("");
                    }}
                    className={`-mb-px rounded-t-md border-b-2 px-3 py-2 text-sm font-medium ${
                      active
                        ? "border-indigo-500 text-indigo-700"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {t.label}
                    <span
                      className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                        active ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {num(t.count)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter by address, mailbox or domain…"
                className="w-full max-w-xs rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="min-w-[1460px] w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    {COLUMNS.map((c) => (
                      <th
                        key={c.key}
                        className={`bg-white py-2 px-2 font-medium ${c.align === "right" ? "text-right" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => onSort(c.key)}
                          title={COLUMN_HINT[c.key]}
                          className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-gray-700"
                        >
                          {c.label}
                          <span className="text-[10px] text-gray-400">
                            {sortKey === c.key ? (sortDir === "asc" ? "▲" : "▼") : ""}
                          </span>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={COLUMNS.length} className="py-6 text-center text-sm text-gray-400">
                        No accounts match.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => {
                      const dailyMax = dailyMaxFor(r);
                      const queuedToday = queuedTodayFor(r);
                      const overLimit = dailyMax !== null && queuedToday > dailyMax;
                      const ramping =
                        r.dailyLimit !== null &&
                        r.effectiveDailyCap !== null &&
                        r.effectiveDailyCap !== undefined &&
                        r.effectiveDailyCap !== r.dailyLimit;
                      const seed = r.nextSeedTest;
                      return (
                        <tr
                          key={r.email}
                          onClick={() => setSelected(r)}
                          className="cursor-pointer border-b border-gray-100 last:border-0 align-top hover:bg-gray-50"
                        >
                          <Cell align="right">
                            <span className="text-gray-500">
                              {r.fillRank === null || r.fillRank === undefined ? "—" : num(r.fillRank)}
                            </span>
                          </Cell>
                          <Cell>
                            <div className="flex items-center gap-2">
                              <ProviderLogo type={r.accountType} />
                              <span className="break-all font-medium text-gray-900">{r.email}</span>
                            </div>
                          </Cell>
                          <Cell>
                            <span className="break-all text-gray-700">{r.mailboxLogin ?? "—"}</span>
                            {r.sendTransport && (
                              <span className="block text-[10px] text-gray-400">via {r.sendTransport}</span>
                            )}
                          </Cell>
                          <Cell>
                            <LifecyclePill status={statusKey(r)} />
                            <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-gray-400">
                              {r.lifecycleReason && <span>{r.lifecycleReason}</span>}
                              {r.lifecycleReason && <span aria-hidden>·</span>}
                              <span>{r.status}</span>
                            </span>
                          </Cell>
                          <Cell>
                            <div className="flex items-center gap-2">
                              <InstantlyLogo />
                              <ScoreBadge score={r.warmupScore} />
                            </div>
                            <div className="mt-0.5">
                              <InboxPlacementCell placement={r.inboxPlacement} />
                            </div>
                          </Cell>
                          <Cell>
                            {seed ? (
                              <>
                                <span
                                  className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                                    seed.due ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-500"
                                  }`}
                                >
                                  {seed.due ? "due" : "not due"}
                                </span>
                                <span className="mt-0.5 block text-[10px] text-gray-400">
                                  {seed.expectedAt ? utcDay(seed.expectedAt) : "no date"}
                                  {seed.reason ? ` · ${seed.reason}` : ""}
                                </span>
                              </>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </Cell>
                          <Cell align="right">{num(r.sentYesterday)}</Cell>
                          <Cell align="right">{num(r.sentToday)}</Cell>
                          <Cell align="right">
                            <div className="tabular-nums text-gray-700">
                              {dailyMax === null ? "—" : num(dailyMax)}
                            </div>
                            {ramping && (
                              <div className="text-[10px] tabular-nums text-amber-600">
                                ramping up from {num(r.dailyLimit)} configured
                              </div>
                            )}
                            {r.warmupLimit !== null && r.warmupLimit > 0 && (
                              <div className="text-[10px] tabular-nums text-gray-400">
                                + {num(r.warmupLimit)} daily warmup send
                              </div>
                            )}
                          </Cell>
                          <Cell align="right">
                            <div
                              className={`tabular-nums font-medium ${
                                dailyMax === null
                                  ? "text-gray-900"
                                  : overLimit
                                    ? "text-red-600"
                                    : "text-emerald-600"
                              }`}
                            >
                              {num(queuedToday)}
                            </div>
                            <div className="text-[10px] tabular-nums text-gray-400">
                              Initial: {num(r.queuedFirstUnsentSequences)}
                            </div>
                            <div className="text-[10px] tabular-nums text-gray-400">
                              Followups: {num(r.queuedNextToday)}
                            </div>
                          </Cell>
                          <Cell align="right">
                            {r.queuedOverdue === undefined ? (
                              <span className="text-gray-400">—</span>
                            ) : (
                              <span
                                className={`tabular-nums ${
                                  r.queuedOverdue > 0 ? "font-medium text-red-600" : "text-gray-400"
                                }`}
                                title={
                                  r.queuedOverdue > 0
                                    ? `${num(r.queuedOverdue)} of the ${num(r.queuedNextToday)} followups were due before today`
                                    : "Nothing owed from an earlier day"
                                }
                              >
                                {num(r.queuedOverdue)}
                              </span>
                            )}
                          </Cell>
                          <Cell align="right">{num(r.queuedNextTomorrow)}</Cell>
                          <Cell align="right">{num(r.queuedNextLater)}</Cell>
                          <Cell align="right">
                            <VolumeCell volume={r.volume7d} />
                          </Cell>
                          {/* DEBUG: the backend's Queued steps total, with a
                              reconciliation against exactly the four visible
                              date buckets. `queuedOverdue` is deliberately NOT
                              in this sum: it re-counts steps already inside
                              queuedNextToday, so adding it would break the
                              queueSize invariant. */}
                          <Cell align="right">
                            {(() => {
                              const visibleSum =
                                r.queuedFirstUnsent +
                                r.queuedNextToday +
                                r.queuedNextTomorrow +
                                r.queuedNextLater;
                              const ok = r.queueSize === visibleSum;
                              return (
                                <span
                                  className={`inline-flex items-center gap-1 tabular-nums ${
                                    ok ? "text-emerald-700" : "text-red-700"
                                  }`}
                                  title={
                                    ok
                                      ? "Matches Initial + Followups + tomorrow + later"
                                      : `Mismatch: backend queueSize ${num(r.queueSize)} vs visible sum ${num(visibleSum)}`
                                  }
                                >
                                  {num(r.queueSize)} {ok ? "\u2705" : "\u274c"}
                                </span>
                              );
                            })()}
                          </Cell>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
              <AsOf iso={data.asOf} />
            </div>
          </>
        )}
      </Section>

      {selected && <AddressPanel row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
