"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { formatCentsAsUsd } from "@/lib/format-number";
import { EmptyNote } from "@/components/v2/ui";
import { costItemNames, versionInForce, versionsOf, type CostItemMargin, type CostMargin, type CurrentPrice, type PriceVersion } from "@/lib/monitoring/monitoring";

/**
 * Monitoring > Price > Billed to users (staff only): one row per cost item with what we billed
 * for it since inception and the price in force now; a row opens a side panel with the item's
 * billed figures and its whole price history. It absorbed "Current prices" and "Prices since
 * inception" (owner 2026-10-01: one page, details in a side panel).
 *
 * Rows are a merge of two served lists, keyed on (provider, cost item): the catalogue's items and
 * runs-service's billed rows (a legacy row can carry another provider, it gets its own line).
 * Every money figure is served; this file formats and looks up, it never adds or divides money.
 */

const usd = (cents: string | number) => formatCentsAsUsd(cents, 0);
const unitUsd = (cents: number | null) => {
  if (cents == null) return null;
  const v = cents / 100;
  if (v === 0) return "$0";
  return `$${v.toLocaleString("en-US", v >= 1 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumSignificantDigits: 4 })}`;
};
const markup = (m: number | null) => (m == null ? null : `×${m.toLocaleString("en-US", { maximumFractionDigits: 3 })}`);
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
const providerName = (p: string | null) => p ?? "Unknown provider";
const dash = <span className="k-fg4">{"—"}</span>;

const TH = "k-label whitespace-nowrap px-3 py-2.5 text-left font-medium first:pl-4 last:pr-4";
const THR = `${TH} text-right`;
const TD = "px-3 py-2 first:pl-4 last:pr-4";
const TDR = `${TD} whitespace-nowrap text-right tabular-nums`;

interface Row {
  key: string;
  name: string;
  provider: string | null;
  /** The catalogue's versions of this item under this provider; empty for a billed row the catalogue does not list. */
  versions: PriceVersion[];
  price: CurrentPrice | null;
  billed: CostItemMargin | null;
}

/** Billed rows first, in runs-service's order (billed, largest first), then catalogue items never billed, by name. */
function rowsOf(margin: CostMargin | undefined, versions: PriceVersion[], prices: CurrentPrice[] | undefined): Row[] {
  const priceOf = (name: string, provider: string | null) => prices?.find((p) => p.name === name && p.provider === provider) ?? null;
  const versionsFor = (name: string, provider: string | null) => versionsOf(versions, name).filter((v) => v.provider === provider);
  const rows: Row[] = (margin?.costItems ?? []).map((c) => ({
    key: `${c.provider}|${c.costName}`,
    name: c.costName,
    provider: c.provider,
    versions: versionsFor(c.costName, c.provider),
    price: priceOf(c.costName, c.provider),
    billed: c,
  }));
  const seen = new Set(rows.map((r) => r.key));
  for (const i of costItemNames(versions)) {
    const key = `${i.provider}|${i.name}`;
    if (seen.has(key)) continue;
    rows.push({ key, name: i.name, provider: i.provider, versions: versionsFor(i.name, i.provider), price: priceOf(i.name, i.provider), billed: null });
  }
  return rows;
}

export function BillingTable({
  margin,
  marginError,
  versions,
  prices,
  pricesError,
}: {
  margin: CostMargin | undefined;
  marginError: boolean;
  versions: PriceVersion[];
  prices: CurrentPrice[] | undefined;
  pricesError: boolean;
}) {
  const rows = useMemo(() => rowsOf(margin, versions, prices), [margin, versions, prices]);
  const [open, setOpen] = useState<string | null>(null);
  const [cursor, setCursor] = useState(-1);

  // J/K move the highlighted row, Enter opens it. Keys stand down while typing, on a focused
  // control, or while the panel is open (it owns the keys).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (open !== null) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "BUTTON" || t.tagName === "A" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || !rows.length) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(rows.length - 1, c + 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === "Enter" && cursor >= 0) setOpen(rows[cursor].key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, cursor, open]);

  const openRow = open === null ? null : (rows.find((r) => r.key === open) ?? null);
  const billedCell = (r: Row, v: (b: CostItemMargin) => React.ReactNode) => (r.billed ? v(r.billed) : marginError ? <span className="k-fg3 text-[12px]">not readable</span> : dash);

  return (
    <>
      <div className="k-card overflow-hidden">
        <div className="k-scroll overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-b border-[var(--line-subtle)]">
              <tr>
                <th className={TH}>Cost item</th>
                <th className={TH}>Provider</th>
                <th className={THR}>Billed, net</th>
                <th className={`${THR} hidden xl:table-cell`}>Billed, gross</th>
                <th className={THR}>Price now</th>
                <th className={`${THR} hidden md:table-cell`}>Versions</th>
                <th className="w-8 pr-4" aria-hidden="true" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line-subtle)]">
              {rows.map((r, i) => (
                <tr
                  key={r.key}
                  onClick={() => {
                    setCursor(i);
                    setOpen(r.key);
                  }}
                  className={`k-row group h-10 cursor-pointer ${i === cursor || open === r.key ? "k-selected" : ""}`}
                >
                  <td className={`${TD} k-mono text-[12px]`}>{r.name}</td>
                  <td className={`${TD} k-fg2`}>{providerName(r.provider)}</td>
                  <td className={TDR}>{billedCell(r, (b) => usd(b.netBilledCostInUsdCents))}</td>
                  <td className={`${TDR} hidden xl:table-cell`}>{billedCell(r, (b) => usd(b.billedCostInUsdCents))}</td>
                  <td className={TDR}>
                    {r.price ? (
                      <>
                        {unitUsd(r.price.pricePerUnitInUsdCents)}
                        <span className="k-fg3"> / {r.price.unit ?? "unit"}</span>
                      </>
                    ) : pricesError ? (
                      <span className="k-fg3 text-[12px]">not readable</span>
                    ) : (
                      <span className="k-fg3">not priced</span>
                    )}
                  </td>
                  <td className={`${TDR} k-fg2 hidden md:table-cell`}>{r.versions.length || dash}</td>
                  <td className="pr-4 text-right">
                    <span className="k-btn-ghost inline-flex h-6 w-6 justify-center px-0 opacity-0 group-hover:opacity-100" aria-hidden="true">
                      <svg width="12" height="12" viewBox="0 0 12 12">
                        <path d="M4.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="k-fg3 flex items-center justify-between border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px] tabular-nums">
          <span>
            {rows.length} cost item{rows.length === 1 ? "" : "s"}
          </span>
          <span className="hidden sm:inline">
            <kbd className="k-kbd">J</kbd> <kbd className="k-kbd">K</kbd> to move, <kbd className="k-kbd">Enter</kbd> to open
          </span>
        </div>
      </div>
      {openRow && <CostItemDrawer row={openRow} onClose={() => setOpen(null)} />}
    </>
  );
}

// ─── Side panel ────────────────────────────────────────────────────────────

function CostItemDrawer({ row, onClose }: { row: Row; onClose: () => void }) {
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

  const b = row.billed;
  const inForce = row.price ? versionInForce(row.versions, row.price) : null;
  const cells: [string, React.ReactNode | null][] = [
    ["Billed, net", b && usd(b.netBilledCostInUsdCents)],
    ["Billed, gross", b && usd(b.billedCostInUsdCents)],
    ["Price now", row.price && `${unitUsd(row.price.pricePerUnitInUsdCents)} / ${row.price.unit ?? "unit"}`],
    ["Markup now", inForce && markup(inForce.markupMultiplier)],
  ];

  return createPortal(
    <aside role="dialog" aria-label={`${row.name} cost item`} className="k-popover fixed inset-y-2 right-2 z-[80] flex w-[min(560px,calc(100vw-16px))] flex-col overflow-hidden">
      <div className="k-line-subtle flex h-11 shrink-0 items-center justify-between border-b px-4">
        <span className="k-label">Cost item</span>
        <button type="button" onClick={onClose} aria-label="Close" className="k-btn-ghost h-7 w-7 justify-center px-0">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="k-scroll min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
        <div className="min-w-0">
          <h2 className="k-mono truncate text-[15px] font-medium leading-6">{row.name}</h2>
          <p className="k-fg3 text-[12px]">
            {providerName(row.provider)}
            {row.price?.effectiveFrom ? ` · priced since ${day(row.price.effectiveFrom)}` : ""}
          </p>
        </div>

        <div className="k-inset grid grid-cols-2 overflow-hidden rounded-[10px] shadow-[inset_0_0_0_1px_var(--line-subtle)]">
          {cells.map(([label, v], i) => (
            <div key={label} className={`min-w-0 px-3 py-2.5 ${i % 2 === 0 ? "border-r border-[var(--line-subtle)]" : ""} ${i < 2 ? "border-b border-[var(--line-subtle)]" : ""}`}>
              <p className="k-label">{label}</p>
              <p className="mt-1 text-[18px] font-medium tabular-nums">{v ?? dash}</p>
            </div>
          ))}
        </div>
        {b && Number(b.refundedCostInUsdCents) > 0 && <p className="k-fg3 -mt-4 text-[12px]">{usd(b.refundedCostInUsdCents)} refunded: spent, not charged.</p>}

        <section>
          <p className="k-label mb-2">Price since inception</p>
          {row.versions.length === 0 ? (
            <div className="k-card">
              <EmptyNote>This cost item has no version in the price catalogue.</EmptyNote>
            </div>
          ) : (
            <div className="k-card overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="border-b border-[var(--line-subtle)]">
                  <tr>
                    <th className={TH}>From</th>
                    <th className={TH}>Plan</th>
                    <th className={THR}>We charge</th>
                    <th className={THR}>Vendor</th>
                    <th className={THR}>Markup</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line-subtle)]">
                  {row.versions.map((v) => (
                    <tr key={v.id}>
                      <td className={`${TD} k-mono k-fg2 whitespace-nowrap text-[12px]`}>
                        {day(v.effectiveFrom)}
                        {v.reconstructed && <span className="k-fg3 ml-1.5">reconstructed</span>}
                      </td>
                      <td className={`${TD} k-fg3`}>{[v.planTier, v.billingCycle].filter(Boolean).join(" · ") || dash}</td>
                      <td className={TDR}>{unitUsd(v.billedPricePerUnitInUsdCents) ?? dash}</td>
                      <td className={`${TDR} k-fg2`}>{v.vendorCostKnown ? (unitUsd(v.vendorCostPerUnitInUsdCents) ?? dash) : "unknown"}</td>
                      <td className={`${TDR} k-fg2`}>{markup(v.markupMultiplier) ?? dash}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </aside>,
    host,
  );
}
