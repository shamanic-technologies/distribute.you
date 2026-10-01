"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useAuthQuery } from "@/lib/use-auth-query";
import { formatCentsAsUsd } from "@/lib/format-number";
import { getStaffMarginTimeseries, getStaffProviderSources } from "@/lib/api";
import { ProviderLogo } from "@/components/provider-logo";
import { EmptyNote, Shimmer } from "@/components/v2/ui";
import {
  versionsOf,
  type CostMargin,
  type PaidFrom,
  type ProviderSourcesRow,
  type PriceVersion,
  type ProviderMargin,
} from "@/lib/monitoring/monitoring";

/**
 * Monitoring's provider table and the drawer one row opens (staff only). One row per vendor:
 * its logo (logo.dev off costs-service's providerDomain), the accounts we pay it from, and
 * the since-inception figures runs-service serves. A row opens a drawer with the vendor's
 * monthly cost since inception (the month in progress drawn dashed), the accounts that pay
 * it (read from the bank ledger by costs-service, never typed here), and each cost item's
 * vendor cost timeline.
 *
 * Cost only (owner 2026-10-01): no price, markup or margin figure on any Cost page; those live
 * under Price and Margin. Every money figure is served: the vendor cost per provider, the dated
 * series per provider per month. This file formats and draws; it never adds, subtracts or
 * divides money.
 */

const ONCE = { staleTime: 5 * 60_000, retry: false } as const;

const usd = (cents: string | number) => formatCentsAsUsd(cents, 0);
const unitUsd = (cents: number | null) => {
  if (cents == null) return null;
  const v = cents / 100;
  if (v === 0) return "$0";
  return `$${v.toLocaleString("en-US", v >= 1 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumSignificantDigits: 4 })}`;
};
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
const providerName = (p: string | null) => p ?? "Unknown provider";
const dash = <span className="k-fg4">{"—"}</span>;

function useMarginTimeseries() {
  return useAuthQuery(["staffMarginTimeseries"], getStaffMarginTimeseries, ONCE);
}
function useProviderSources() {
  return useAuthQuery(["staffProviderSources"], getStaffProviderSources, ONCE);
}

// ─── Table ─────────────────────────────────────────────────────────────────

export type ProviderColumn = "items" | "vendor";

const COLUMN: Record<ProviderColumn, { label: string; cell: (p: ProviderMargin) => React.ReactNode; wide?: boolean }> = {
  items: { label: "Cost items", cell: () => null },
  vendor: { label: "Vendor cost", cell: (p) => usd(p.vendorCostInUsdCents) },
};

/** A provider as the table lists it: its name, and its margin row when it has spend. */
interface Row {
  provider: string | null;
  margin: ProviderMargin | null;
}

/**
 * The rows, in runs-service's order (billed, largest first), then, when `catalogue` is set,
 * the catalogue's providers that never billed anything, by name. A merge of two served
 * lists, no figure computed.
 */
function rowsOf(margin: CostMargin | undefined, versions: PriceVersion[] | undefined, catalogue: boolean): Row[] {
  const billed = margin?.providers ?? [];
  const rows: Row[] = billed.map((m) => ({ provider: m.provider, margin: m }));
  if (!catalogue) return rows;
  const seen = new Set(billed.map((m) => m.provider));
  const idle = [...new Set((versions ?? []).map((v) => v.provider))].filter((p) => !seen.has(p)).sort();
  return [...rows, ...idle.map((provider) => ({ provider, margin: null }))];
}

const TH = "k-label whitespace-nowrap px-3 py-2.5 text-left font-medium first:pl-4 last:pr-4";
const THR = `${TH} text-right`;
const TD = "px-3 py-2 first:pl-4 last:pr-4";
const TDR = `${TD} whitespace-nowrap text-right tabular-nums`;

/**
 * `margin` undefined with `marginError` false = still reading; with `marginError` true = the
 * figures are not readable, the catalogue rows still list (Providers page). `catalogue`
 * adds the providers that never billed; Spend leaves it off so its counts match the table.
 */
export function ProvidersTable({
  margin,
  marginError = false,
  versions,
  columns,
  catalogue,
}: {
  margin: CostMargin | undefined;
  marginError?: boolean;
  versions: PriceVersion[] | undefined;
  columns: ProviderColumn[];
  catalogue: boolean;
}) {
  const sources = useProviderSources();
  const rows = useMemo(() => rowsOf(margin, versions, catalogue), [margin, versions, catalogue]);
  const [open, setOpen] = useState<string | null | undefined>(undefined);
  const [cursor, setCursor] = useState(-1);
  // costs-service's per-provider row carries the vendor's domain for every catalogue provider
  // (the current-price list only covers what is billed today).
  const domainOf = (p: string | null) => (p ? (sources.data?.find((s) => s.provider === p)?.providerDomain ?? null) : null);
  const itemsOf = (p: string | null) => (p && versions ? new Set(versions.filter((v) => v.provider === p).map((v) => v.name)).size : null);
  const sourcesOf = (p: string | null) => (p ? (sources.data?.find((s) => s.provider === p) ?? null) : null);

  // J/K move the highlighted row, Enter opens it. Keys never fire while typing, on a focused
  // control (its own Enter belongs to it), or while the drawer is open (it owns the keys).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (open !== undefined) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "BUTTON" || t.tagName === "A" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || !rows.length) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(rows.length - 1, c + 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === "Enter" && cursor >= 0) setOpen(rows[cursor].provider);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, cursor, open]);

  const openRow = open === undefined ? null : (rows.find((r) => r.provider === open) ?? null);

  return (
    <>
      <div className="k-card overflow-hidden">
        <div className="k-scroll overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-b border-[var(--line-subtle)]">
              <tr>
                <th className={TH}>Provider</th>
                <th className={TH}>Sources</th>
                {columns.map((c) => (
                  <th key={c} className={`${THR} ${COLUMN[c].wide ? "hidden 2xl:table-cell" : ""}`}>
                    {COLUMN[c].label}
                  </th>
                ))}
                <th className="w-8 pr-4" aria-hidden="true" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line-subtle)]">
              {rows.map((r, i) => {
                const items = itemsOf(r.provider);
                return (
                  <tr
                    key={r.provider ?? "null"}
                    onClick={() => {
                      setCursor(i);
                      setOpen(r.provider);
                    }}
                    className={`k-row group h-11 cursor-pointer ${i === cursor || (open !== undefined && open === r.provider) ? "k-selected" : ""}`}
                  >
                    <td className={TD}>
                      <span className="flex min-w-0 items-center gap-2.5">
                        <LogoSlot domain={domainOf(r.provider)} size={20} />
                        <span className="truncate font-medium">{providerName(r.provider)}</span>
                      </span>
                    </td>
                    <td className={`${TD} whitespace-nowrap`}>
                      <SourceTags row={sourcesOf(r.provider)} loading={sources.data === undefined && !sources.isError} error={sources.isError} />
                    </td>
                    {columns.map((c) => (
                      <td key={c} className={`${TDR} ${COLUMN[c].wide ? "hidden 2xl:table-cell" : ""} ${c === "items" ? "k-fg2" : ""}`}>
                        {c === "items" ? (items ?? dash) : r.margin ? (COLUMN[c].cell(r.margin) ?? dash) : marginError ? <span className="k-fg3 text-[12px]">not readable</span> : dash}
                      </td>
                    ))}
                    <td className="pr-4 text-right">
                      <span className="k-btn-ghost inline-flex h-6 w-6 justify-center px-0 opacity-0 group-hover:opacity-100" aria-hidden="true">
                        <svg width="12" height="12" viewBox="0 0 12 12">
                          <path d="M4.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="k-fg3 flex items-center justify-between border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px] tabular-nums">
          <span>
            {rows.length} provider{rows.length === 1 ? "" : "s"}
          </span>
          <span className="hidden sm:inline">
            <kbd className="k-kbd">J</kbd> <kbd className="k-kbd">K</kbd> to move, <kbd className="k-kbd">Enter</kbd> to open
          </span>
        </div>
      </div>
      {openRow && (
        <ProviderDrawer
          row={openRow}
          domain={domainOf(openRow.provider)}
          versions={versions ?? []}
          sources={sourcesOf(openRow.provider)}
          sourcesState={sources.isError ? "error" : sources.data === undefined ? "loading" : "ok"}
          onClose={() => setOpen(undefined)}
        />
      )}
    </>
  );
}

/** A logo slot of fixed width, so names line up whether logo.dev has the vendor or not. */
function LogoSlot({ domain, size }: { domain: string | null; size: number }) {
  return (
    <span className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-[var(--bg-inset)]" style={{ width: size, height: size }}>
      <ProviderLogo domain={domain} size={size} className="rounded-[6px]" />
    </span>
  );
}

/**
 * The accounts paying a vendor, read from the bank ledger, as tags with their bank's logo.
 * A provider the ledger cannot match says so: an empty cell would read as "nobody pays it".
 */
function SourceTags({ row, loading, error }: { row: ProviderSourcesRow | null; loading: boolean; error: boolean }) {
  if (error) return <span className="k-fg3 text-[12px]">not readable</span>;
  if (loading) return <Shimmer className="h-4 w-24" />;
  if (!row) return dash;
  if (row.match === "unmatched") return <span className="text-[12px] text-[var(--data-rose)]">Not found in the bank</span>;
  if (!row.paidFrom.length) return dash;
  return (
    <span className="flex gap-1">
      {row.paidFrom.map((a) => (
        <span key={a.accountId} className="k-chip inline-flex items-center gap-1.5 whitespace-nowrap text-[12px]">
          <ProviderLogo domain={a.institutionDomain} size={12} className="rounded-[3px]" />
          {a.label}
        </span>
      ))}
    </span>
  );
}

/** The drawer's list: one line per paying account, its scope and the last payment from it. */
function PaidFromList({ row, state }: { row: ProviderSourcesRow | null; state: "loading" | "error" | "ok" }) {
  if (state === "error") return <EmptyNote>Could not read the bank ledger.</EmptyNote>;
  if (state === "loading") return <Shimmer className="m-4 h-4 w-48" />;
  if (!row) return <EmptyNote>This provider is not in the cost catalogue.</EmptyNote>;
  if (row.match === "unmatched") return <EmptyNote>Not found in the bank: no payment in the ledger matches this provider.</EmptyNote>;
  if (!row.paidFrom.length) return <EmptyNote>No payment to this vendor in the bank yet.</EmptyNote>;
  return (
    <ul className="divide-y divide-[var(--line-subtle)]">
      {row.paidFrom.map((a: PaidFrom) => (
        <li key={a.accountId} className="flex h-10 items-center justify-between gap-3 px-3">
          <span className="flex min-w-0 items-center gap-2">
            <LogoSlot domain={a.institutionDomain} size={18} />
            <span className="truncate text-[13px]">{a.label}</span>
            <span className="k-chip text-[11px]">{a.scope === "business" ? "Business" : "Personal"}</span>
          </span>
          <span className="k-mono k-fg2 shrink-0 text-[12px]">{a.lastPaidOn ? `last paid ${day(a.lastPaidOn)}` : dash}</span>
        </li>
      ))}
    </ul>
  );
}

// ─── Drawer ────────────────────────────────────────────────────────────────

function ProviderDrawer({
  row,
  domain,
  versions,
  sources,
  sourcesState,
  onClose,
}: {
  row: Row;
  domain: string | null;
  versions: PriceVersion[];
  sources: ProviderSourcesRow | null;
  sourcesState: "loading" | "error" | "ok";
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  // Read after mount: the shell's #v2-portal is not committed on the first paint.
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.getElementById("v2-portal")), []);
  if (!host) return null;

  const m = row.margin;
  const items = [...new Set(versions.filter((v) => v.provider === row.provider).map((v) => v.name))].sort();

  return createPortal(
    <aside role="dialog" aria-label={`${providerName(row.provider)} provider`} className="k-popover fixed inset-y-2 right-2 z-[80] flex w-[min(560px,calc(100vw-16px))] flex-col overflow-hidden">
      <div className="k-line-subtle flex h-11 shrink-0 items-center justify-between border-b px-4">
        <span className="k-label">Provider</span>
        <button type="button" onClick={onClose} aria-label="Close" className="k-btn-ghost h-7 w-7 justify-center px-0">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="k-scroll min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
        <div className="flex min-w-0 items-center gap-3">
          <LogoSlot domain={domain} size={40} />
          <div className="min-w-0">
            <h2 className="truncate text-[16px] font-medium leading-6">{providerName(row.provider)}</h2>
            <p className="k-fg3 text-[12px]">
              {items.length} cost item{items.length === 1 ? "" : "s"}
              {domain ? ` · ${domain}` : ""}
            </p>
          </div>
        </div>

        <div className="k-inset grid grid-cols-2 overflow-hidden rounded-[10px] shadow-[inset_0_0_0_1px_var(--line-subtle)]">
          {(
            [
              ["Vendor cost", m && usd(m.vendorCostInUsdCents)],
              ["Paid from", sources && sources.match !== "unmatched" ? `${sources.paidFrom.length} account${sources.paidFrom.length === 1 ? "" : "s"}` : null],
            ] as const
          ).map(([label, v], i) => (
            <div key={label} className={`min-w-0 px-3 py-2.5 ${i % 2 === 0 ? "border-r border-[var(--line-subtle)]" : ""}`}>
              <p className="k-label">{label}</p>
              <p className="mt-1 text-[18px] font-medium tabular-nums">{v ?? dash}</p>
            </div>
          ))}
        </div>

        <MonthlyCost provider={row.provider} />

        <section>
          <p className="k-label mb-2">Paid from</p>
          <div className="k-card">
            <PaidFromList row={sources} state={sourcesState} />
          </div>
        </section>

        <section>
          <p className="k-label mb-2">Vendor cost timeline</p>
          {items.length === 0 ? (
            <div className="k-card">
              <EmptyNote>This provider has no cost item in the catalogue.</EmptyNote>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((name) => (
                <CostTimeline key={name} name={name} versions={versionsOf(versions, name)} />
              ))}
            </div>
          )}
        </section>
      </div>
    </aside>,
    host,
  );
}

/** One cost item's catalogue versions, oldest first, as a vertical timeline of vendor cost. */
function CostTimeline({ name, versions }: { name: string; versions: PriceVersion[] }) {
  const latest = versions.length ? versions[versions.length - 1] : null;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="k-mono truncate text-[12px]">{name}</p>
        <p className="k-fg3 shrink-0 text-[12px] tabular-nums">{latest?.vendorCostKnown ? `${unitUsd(latest.vendorCostPerUnitInUsdCents)} / unit latest` : "vendor cost unknown"}</p>
      </div>
      <ol className="mt-2 space-y-0">
        {versions.map((v, i) => (
          <li key={v.id} className="relative grid grid-cols-[14px_minmax(0,1fr)] gap-2 pb-2.5 last:pb-0">
            <span className="relative flex justify-center" aria-hidden="true">
              <span className={`mt-[5px] h-2 w-2 rounded-full ${i === versions.length - 1 ? "bg-[var(--accent)]" : "bg-[var(--fg-4)]"}`} />
              {i < versions.length - 1 && <span className="absolute bottom-[-6px] top-[15px] w-px bg-[var(--line)]" />}
            </span>
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 text-[12px]">
              <span className="k-mono k-fg2">
                {day(v.effectiveFrom)}
                {v.reconstructed && <span className="k-fg3 ml-1.5">reconstructed</span>}
              </span>
              <span className="tabular-nums">
                {v.vendorCostKnown ? unitUsd(v.vendorCostPerUnitInUsdCents) : "unknown"}
                <span className="k-fg3"> / unit</span>
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ─── Monthly cost chart ────────────────────────────────────────────────────

const ROSE = "var(--data-rose)";

/**
 * The vendor cost of one provider, one bar per month since its first month, served per
 * (provider, month) by runs-service. The month in progress is drawn dashed: it is not over.
 * The months are runs-service's (dense, zeros included); the dashed one is the bucket it marks
 * incomplete.
 */
function MonthlyCost({ provider }: { provider: string | null }) {
  const series = useMarginTimeseries();
  const buckets = series.data ? (series.data.providers.find((p) => p.provider === provider)?.buckets ?? []) : undefined;
  const [hover, setHover] = useState<string | null>(null);

  let body: React.ReactNode;
  if (series.isError) body = <EmptyNote>Could not read the monthly cost from production.</EmptyNote>;
  else if (!buckets) body = <Shimmer className="m-4 h-[140px]" />;
  else if (!buckets.length) body = <EmptyNote>No cost on record for this provider.</EmptyNote>;
  else {
    const max = Math.max(...buckets.map((b) => Number(b.vendorCostInUsdCents)), 1);
    const last = buckets[buckets.length - 1];
    const shown = buckets.find((b) => b.period === hover) ?? last;
    const label = (period: string, short = false) =>
      new Date(`${period.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: short ? "2-digit" : "numeric", timeZone: "UTC" });
    // At most six labels: the drawer is ~360px wide on a phone, a short month label is ~44px.
    const every = Math.ceil(buckets.length / 6);
    body = (
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[18px] font-medium tabular-nums">{usd(shown.vendorCostInUsdCents)}</span>
          <span className="k-fg3 text-[12px]">
            {label(shown.period)}
            {!shown.complete && " · in progress"}
          </span>
        </div>
        <div className="mt-3 flex h-[120px] items-end gap-[3px]" onMouseLeave={() => setHover(null)}>
          {buckets.map((b) => {
            const v = Number(b.vendorCostInUsdCents);
            const h = v > 0 ? Math.max(2, (v / max) * 120) : 0;
            return (
              <button
                key={b.period}
                type="button"
                aria-label={`${label(b.period)}: ${usd(b.vendorCostInUsdCents)}${b.complete ? "" : ", in progress"}`}
                onMouseEnter={() => setHover(b.period)}
                onFocus={() => setHover(b.period)}
                className="flex h-full min-w-0 flex-1 items-end"
              >
                <span
                  className="block w-full rounded-t-[3px]"
                  style={
                    b.complete
                      ? { height: h, background: ROSE, opacity: hover && hover !== b.period ? 0.45 : 0.85 }
                      : { height: h, border: `1.5px dashed ${ROSE}`, borderBottom: "none", background: `color-mix(in oklab, ${ROSE} 12%, transparent)` }
                  }
                />
              </button>
            );
          })}
        </div>
        <div className="k-line-subtle flex gap-[3px] border-t pt-1.5">
          {buckets.map((b, i) => (
            <span key={b.period} className="k-fg3 min-w-0 flex-1 overflow-visible whitespace-nowrap text-[10.5px]">
              {i % every === 0 ? label(b.period, true) : ""}
            </span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="k-label">Vendor cost per month</p>
        <p className="k-fg3 text-[12px]">since inception</p>
      </div>
      <div className="k-card">{body}</div>
    </section>
  );
}
