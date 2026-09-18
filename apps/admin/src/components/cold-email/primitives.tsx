"use client";

import type { ReactNode } from "react";
import { Skeleton } from "@/components/skeleton";
import {
  dnsBadges,
  formatCents,
  formatPct,
  lifecycleLabel,
  PAID_TO_DATE_NOTE,
  paidToDateQualifier,
  rampReaches,
  type DnsVerdict,
} from "@/lib/instantly-ops";
import type { OpsDelivery, OpsDns, OpsPaidToDate, OpsRampPoint, OpsVolume } from "@/lib/api";

/**
 * Shared chrome for the cold-email section. One copy of every primitive the six
 * pages draw, so a domain, a mailbox and an address cannot end up wearing three
 * different badges for one lifecycle state.
 */

export function num(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US");
}

/** A served instant in UTC. Absent stays a dash — never "now", never a guess. */
export function utc(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  return `${new Date(t).toLocaleString("en-US", { timeZone: "UTC" })} UTC`;
}

/** Date only, for a renewal / expiry / projection day. */
export function utcDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = Date.parse(iso.length === 10 ? `${iso}T00:00:00.000Z` : iso);
  if (Number.isNaN(t)) return "—";
  return new Date(t).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function PageHeader({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
      <p className="mt-1 text-sm text-gray-500">{blurb}</p>
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  pending,
  hint,
}: {
  label: string;
  value: string;
  sub?: string;
  pending?: boolean;
  hint?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5" title={hint}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      {pending ? (
        <Skeleton className="mt-2 h-8 w-24 rounded" />
      ) : (
        <p className="mt-2 text-2xl font-semibold text-gray-900 tabular-nums">{value}</p>
      )}
      {sub && !pending && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

/**
 * A card with its own heading and its own failure line.
 *
 * `isError` renders the reason rather than a skeleton: a gate that waits on a
 * read which already failed is the eternal-skeleton bug, and a staff console
 * that says nothing about a broken producer is worse than one that names it.
 */
export function Section({
  title,
  blurb,
  action,
  isPending,
  isError,
  error,
  empty,
  children,
}: {
  title: string;
  blurb?: string;
  action?: ReactNode;
  isPending?: boolean;
  isError?: boolean;
  error?: Error | null;
  empty?: string | null;
  children?: ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {blurb && <p className="mt-1 text-xs text-gray-500">{blurb}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">
        {isError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">Couldn&apos;t load {title.toLowerCase()}.</p>
            <p className="mt-1 text-xs text-red-500">{error?.message ?? "Unknown error"}</p>
          </div>
        ) : isPending ? (
          <Skeleton className="h-48 w-full rounded" />
        ) : empty ? (
          <p className="py-6 text-center text-sm text-gray-400">{empty}</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

const LIFECYCLE_TINT: Record<string, string> = {
  in_production: "bg-emerald-100 text-emerald-800",
  in_recovery: "bg-amber-100 text-amber-800",
  deactivated_by_instantly: "bg-red-100 text-red-800",
  deactivated_by_user: "bg-gray-200 text-gray-700",
};

export function LifecyclePill({ status }: { status: string | null }) {
  const key = status ?? "unclassified";
  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${
        LIFECYCLE_TINT[key] ?? "bg-gray-100 text-gray-500"
      }`}
    >
      {lifecycleLabel(key)}
    </span>
  );
}

const DNS_TINT: Record<DnsVerdict, string> = {
  ok: "bg-emerald-100 text-emerald-800",
  weak: "bg-amber-100 text-amber-800",
  missing: "bg-red-100 text-red-800",
};

/** SPF / DMARC / DKIM / MX as four words, each carrying what the record says. */
export function DnsBadges({ dns }: { dns: OpsDns }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {dnsBadges(dns).map((b) => (
        <span
          key={b.label}
          title={b.detail ?? `No ${b.label} record found`}
          className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${DNS_TINT[b.verdict]}`}
        >
          {b.label}
        </span>
      ))}
    </span>
  );
}

/** Pooled seed-test placement. Never tested reads as a dash, never as 0% inbox. */
export function DeliveryCell({ delivery }: { delivery: OpsDelivery }) {
  const pct = formatPct(delivery.inboxPct);
  if (pct === null) {
    return <span className="text-gray-400" title="No placement test on record">—</span>;
  }
  const inbox = delivery.inboxPct ?? 0;
  const tint =
    inbox >= 90
      ? "bg-emerald-100 text-emerald-800"
      : inbox >= 50
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";
  return (
    <span
      className="inline-flex flex-col items-start gap-0.5"
      title={`${num(delivery.inboxCount)} of ${num(delivery.seedTotal)} seeds inboxed, tested ${utc(delivery.testedAt)}`}
    >
      <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${tint}`}>
        {pct} inbox
      </span>
      <span className="text-[10px] tabular-nums text-gray-400">
        {num(delivery.inboxCount)}/{num(delivery.seedTotal)} seeds
      </span>
    </span>
  );
}

/** The volume rollup as one compact cell: what went out, what came back. */
export function VolumeCell({ volume }: { volume: OpsVolume }) {
  const bounce = volume.bounceRatePerMille;
  return (
    <span className="inline-flex flex-col items-end gap-0.5 tabular-nums">
      <span className="text-sm text-gray-900">{num(volume.outreach)} outreach</span>
      <span className="text-[10px] text-gray-400">
        {num(volume.warmup)} warmup · {num(volume.seed)} seed
      </span>
      <span className="text-[10px] text-gray-400">
        {num(volume.repliesIn)} in ·{" "}
        <span className={bounce !== null && bounce > 30 ? "text-red-600" : ""}>
          {num(volume.bouncesIn)} bounced
          {bounce === null ? "" : ` (${bounce.toFixed(1)}‰)`}
        </span>
      </span>
    </span>
  );
}

/**
 * An amount the producer labelled an ESTIMATE, rendered with that word attached.
 * There is no branch that prints it bare — see `PAID_TO_DATE_NOTE`.
 */
export function PaidToDate({ paid }: { paid: OpsPaidToDate | null }) {
  if (!paid) return <span className="text-gray-400">—</span>;
  const amount = formatCents(paid.cents, paid.currency);
  const qualifier = paidToDateQualifier(paid);
  return (
    <span className="inline-flex flex-col items-end gap-0.5" title={PAID_TO_DATE_NOTE}>
      <span className="tabular-nums text-gray-900">{amount ?? "—"}</span>
      <span className="text-[10px] uppercase tracking-wide text-amber-600">
        {qualifier ?? "unqualified"}
        {paid.months > 0 ? ` · ${num(paid.months)}mo` : ""}
      </span>
    </span>
  );
}

/**
 * The ramp stated as a sentence plus its own bars — "reaches 50 on Sep 24" is
 * what an operator acts on, and the bars show the shape without spending a row
 * per day.
 */
export function RampLine({ projection }: { projection: readonly OpsRampPoint[] }) {
  const peak = rampReaches(projection);
  if (!peak) return <span className="text-gray-400">—</span>;
  const max = peak.cap || 1;
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span className="text-xs tabular-nums text-gray-700">
        reaches {num(peak.cap)} on {utcDay(peak.date)}
      </span>
      <span className="flex items-end gap-0.5" aria-hidden>
        {projection.map((p) => (
          <span
            key={p.date}
            title={`${utcDay(p.date)}: ${num(p.cap)}/day`}
            className="w-1.5 rounded-sm bg-indigo-300"
            style={{ height: `${Math.max(2, Math.round((p.cap / max) * 18))}px` }}
          />
        ))}
      </span>
    </span>
  );
}

/** Right-hand slide-over. One implementation for every detail panel in the section. */
export function SlideOver({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/20" />
      <div className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-200 bg-white p-5">
          <div className="min-w-0">
            <p className="break-all text-sm font-semibold text-gray-900">{title}</p>
            {subtitle && <p className="break-all text-xs text-gray-400">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close panel"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="flex flex-col gap-3 p-5">{children}</div>
      </div>
    </div>
  );
}

export function PanelGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-t border-gray-100 pt-3 first:border-0 first:pt-0">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{title}</p>
      {children}
    </div>
  );
}

export function PanelRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="shrink-0 text-xs text-gray-500">{label}</span>
      <span className="break-all text-right text-sm tabular-nums text-gray-900">{children}</span>
    </div>
  );
}

/** A sortable table header cell. Same behaviour on every table in the section. */
export function SortHeader<K extends string>({
  col,
  label,
  hint,
  align,
  sortKey,
  sortDir,
  onSort,
}: {
  col: K;
  label: string;
  hint?: string;
  align?: "left" | "right";
  sortKey: K;
  sortDir: "asc" | "desc";
  onSort: (key: K) => void;
}) {
  return (
    <th className={`bg-white py-2 px-2 font-medium ${align === "right" ? "text-right" : ""}`}>
      <button
        type="button"
        onClick={() => onSort(col)}
        title={hint}
        className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-gray-700"
      >
        {label}
        <span className="text-[10px] text-gray-400">
          {sortKey === col ? (sortDir === "asc" ? "▲" : "▼") : ""}
        </span>
      </button>
    </th>
  );
}

/** `As of <instant>` under a table. Always the producer's own timestamp. */
export function AsOf({ iso }: { iso: string }) {
  return <p className="mt-3 text-xs text-gray-400">As of {utc(iso)}.</p>;
}
