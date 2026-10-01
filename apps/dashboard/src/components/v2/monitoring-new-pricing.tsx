"use client";

import { useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getStaffRealCostSeries, getStaffRealCosts } from "@/lib/api";
import { EmptyNote, SectionTitle, Shimmer } from "@/components/v2/ui";
import type { RealCostItem, RealCostSeries, RealCosts } from "@/lib/monitoring/monitoring";
import { DailyLines, Dash, TD, TDR, TH, THR, cents, dayLabel, dollars, pct, type Line } from "@/components/v2/monitoring-charts";

/**
 * Monitoring > Price > New pricing (staff only): every cost item's REAL cost per unit and the
 * price proposed from it (real cost x2 for production tools, x1 for Stripe and media; owner
 * 2026-10-01), on any day since 2026-01-01, beside today's catalogue price. Display only: nothing
 * bills from it until the owner's go. Every price, ratio and change is costs-service's; this file
 * picks a day, filters by method and draws.
 */

const ONCE = { staleTime: 5 * 60_000, retry: false } as const;

const METHOD_LABEL: Record<string, string> = {
  "email-send-price": "Email sending",
  subscription: "Subscription",
  "pay-as-you-go-ratio": "Pay as you go",
  "pass-through": "Stripe and media",
  "catalogue-vendor-cost": "Catalogue cost",
};
const FLAG_LABEL: Record<string, string> = {
  "no-email-sent-yet": "no email sent yet",
  "not-a-subscription-credit": "not a subscription credit",
  "no-real-cost-per-credit": "no real cost per credit, price kept",
  "no-payment-yet": "no payment yet",
  "no-recorded-usage-yet": "no recorded usage yet",
  "no-ledger-line": "no bank line, catalogue cost",
  "declared-catalogue-vendor-cost": "catalogue cost by rule",
  "no-vendor-cost": "no vendor cost",
};
const BASIS_LABEL: Record<string, string> = {
  "real-cost-x2": "real cost ×2",
  "real-cost-x1": "real cost ×1",
  "current-price-kept": "current price kept",
  "no-price": "no price",
};
const label = (map: Record<string, string>, k: string | null) => (k == null ? null : (map[k] ?? k));
const ratio = (v: number | null) => (v == null ? null : `×${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`);
/** A change in % with its sign; a falling price reads in teal, a rising one in rose. */
function Change({ v }: { v: number | null }) {
  if (v == null) return <Dash />;
  const color = v > 0 ? "var(--data-rose)" : v < 0 ? "var(--data-teal)" : undefined;
  return <span style={{ color }}>{`${v > 0 ? "+" : ""}${pct(v)}`}</span>;
}

export function NewPricingView() {
  const [day, setDay] = useState<string | null>(null);
  const q = useAuthQuery(["staffRealCosts", day], () => getStaffRealCosts(day), ONCE);
  const d = q.data;
  if (q.isError) {
    return (
      <div className="k-card">
        <EmptyNote>Could not read the real costs from production: {q.error?.message ?? "unknown error"}.</EmptyNote>
      </div>
    );
  }
  if (!d) {
    return (
      <div className="k-card space-y-2 p-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <Shimmer key={i} className="h-4 w-full" />
        ))}
      </div>
    );
  }
  return <Body d={d} day={day} setDay={setDay} fetching={q.isFetching} />;
}

function Body({ d, day, setDay, fetching }: { d: RealCosts; day: string | null; setDay: (v: string | null) => void; fetching: boolean }) {
  const [method, setMethod] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const methods = [...new Set(d.items.map((i) => i.method))];
  const rows = d.items.filter((i) => (method == null || i.method === method) && (!search || i.costName.includes(search.toLowerCase()) || (i.provider ?? "").includes(search.toLowerCase())));
  const count = (m: string | null) => (m == null ? d.items.length : d.items.filter((i) => i.method === m).length);
  return (
    <div className="space-y-8">
      <div className="k-fg2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: d.stale ? "var(--data-amber)" : "var(--data-teal)" }} />
          {d.stale ? "Not refreshed today" : "Refreshed today"} · prices of {dayLabel(d.day)}
        </span>
        <label className="inline-flex items-center gap-2">
          <span className="k-label">Day</span>
          <input
            type="date"
            className="k-input w-[150px]"
            min={d.rules.since}
            max={d.asOf}
            value={day ?? d.day}
            onChange={(e) => setDay(e.target.value && e.target.value !== d.asOf ? e.target.value : null)}
          />
        </label>
        {fetching && <span className="k-fg3">Reading…</span>}
        <span className="k-chip" style={{ color: "var(--data-amber)" }}>
          Not billed: shown until the owner&apos;s go
        </span>
      </div>

      <div className="k-card grid grid-cols-2 divide-[var(--line-subtle)] md:grid-cols-4 md:divide-x">
        {[
          { l: "Cost items", v: d.items.length, s: "in the catalogue" },
          { l: "Real cost ×2", v: d.items.filter((i) => i.proposedBasis === "real-cost-x2").length, s: "production tools" },
          { l: "Real cost ×1", v: d.items.filter((i) => i.proposedBasis === "real-cost-x1").length, s: "Stripe and media" },
          { l: "Flagged", v: d.items.filter((i) => i.flag != null).length, s: "a figure is missing" },
        ].map((c) => (
          <div key={c.l} className="min-w-0 p-4">
            <p className="k-label">{c.l}</p>
            <p className="mt-1.5 text-[22px] font-medium leading-7 tabular-nums">{c.v}</p>
            <p className="k-fg3 mt-0.5 text-[12px]">{c.s}</p>
          </div>
        ))}
        <p className="k-fg3 col-span-2 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px] md:col-span-4">{d.formula}. {d.rules.x1Rule}.</p>
      </div>

      <section>
        <SectionTitle count={rows.length} right={<span>Pick a row for its history</span>}>
          Price per cost item
        </SectionTitle>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {[null, ...methods].map((m) => (
            <button key={m ?? "all"} type="button" aria-pressed={method === m} onClick={() => setMethod(m)} className={method === m ? "k-btn h-7 px-2 text-[12px]" : "k-btn-ghost h-7 px-2 text-[12px]"}>
              {m == null ? "All" : label(METHOD_LABEL, m)} <span className="k-fg3 tabular-nums">{count(m)}</span>
            </button>
          ))}
          <input className="k-input ml-auto w-[220px]" placeholder="Search a cost item" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search a cost item" />
        </div>
        <div className="k-card overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-b border-[var(--line-subtle)]">
              <tr>
                <th className={TH}>Cost item</th>
                <th className={TH}>How the real cost is read</th>
                <th className={THR}>Vendor list cost</th>
                <th className={THR}>Real cost</th>
                <th className={THR}>Current price</th>
                <th className={THR}>Current markup</th>
                <th className={THR}>Proposed</th>
                <th className={THR}>Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line-subtle)]">
              {rows.map((i) => (
                <ItemRow key={i.costName} i={i} open={open === i.costName} onToggle={() => setOpen(open === i.costName ? null : i.costName)} />
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <EmptyNote>No cost item matches.</EmptyNote>}
        </div>
      </section>

      <section>
        <SectionTitle count={d.payAsYouGo.length} right={<span>What we paid for usage over what our runs recorded</span>}>
          Pay-as-you-go correction
        </SectionTitle>
        <div className="k-card overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-b border-[var(--line-subtle)]">
              <tr>
                <th className={TH}>Vendor</th>
                <th className={TH}>Bank lines</th>
                <th className={THR}>Paid</th>
                <th className={THR}>Refunded</th>
                <th className={THR}>Net paid</th>
                <th className={THR}>Counted as usage</th>
                <th className={THR}>Recorded by our runs</th>
                <th className={THR}>Correction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line-subtle)]">
              {d.payAsYouGo.map((v) => (
                <PaygRows key={v.provider} v={v} />
              ))}
            </tbody>
          </table>
          <p className="k-fg3 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px]">
            The correction multiplies the vendor&apos;s list cost by what we paid for usage over what our runs recorded. A split vendor counts only its metered part; the other parts are shown under it and price no unit. Not counted as API usage:{" "}
            {d.rules.payAsYouGoVendors.flatMap((v) => v.excludedLedgerVendors.map((e) => `${e.key} (${e.reason})`)).join(", ") || "none"}.
          </p>
        </div>
      </section>
    </div>
  );
}

const PART_LABEL: Record<string, string> = {
  metered: "Metered usage",
  "other-services": "Other services",
  rental: "Phone number rental",
  other: "Other usage",
  "unconsumed-balance": "Prepaid, not consumed",
  tax: "Tax",
  adjustments: "Adjustments",
  prepayments: "Prepayments",
};

/** A vendor's row; a split vendor lists what its bank money paid for under it, counted or not. */
function PaygRows({ v }: { v: RealCosts["payAsYouGo"][number] }) {
  const counted = v.split ? v.meteredUsdCents : v.netPaidUsdCents;
  return (
    <>
      <tr className="k-row">
        <td className={TD}>{v.provider}</td>
        <td className={`${TD} k-mono k-fg2 text-[12px]`}>{v.ledgerVendors.join(", ") || <Dash />}</td>
        <td className={TDR}>{dollars(v.paidUsdCents / 100)}</td>
        <td className={`${TDR} k-fg2`}>{v.refundedUsdCents ? dollars(v.refundedUsdCents / 100) : <Dash />}</td>
        <td className={TDR}>{dollars(v.netPaidUsdCents / 100)}</td>
        <td className={`${TDR} font-medium`}>{counted == null ? <Dash /> : dollars(counted / 100)}</td>
        <td className={`${TDR} k-fg2`}>{dollars(v.vendorCostRecordedUsdCents / 100)}</td>
        <td className={`${TDR} font-medium`}>{ratio(v.ratio) ?? <Dash />}</td>
      </tr>
      {v.split &&
        [...v.split.parts, { part: "unexplained", ...v.split.unexplained }].map((p) => (
          <tr key={`${v.provider}:${p.part}`} className="k-row">
            <td className={`${TD} k-fg3 pl-8 text-[12px]`} colSpan={2}>
              {p.part === "unexplained" ? "Not explained by the vendor" : (PART_LABEL[p.part] ?? p.part)}
              {p.basis && <span className="k-fg4 ml-2 line-clamp-1 inline">{p.basis.split(" | ")[0]}</span>}
            </td>
            <td className={`${TDR} k-fg2 text-[12px]`} colSpan={3}>
              {dollars(p.usdCents / 100)}
            </td>
            <td className={`${TDR} text-[12px]`} colSpan={3}>
              {p.loadedOnUnits ? <span style={{ color: "var(--data-teal)" }}>Counted</span> : <span className="k-fg3">Not counted</span>}
            </td>
          </tr>
        ))}
    </>
  );
}

function ItemRow({ i, open, onToggle }: { i: RealCostItem; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr
        className={`k-row cursor-pointer ${open ? "k-selected" : ""}`}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onToggle();
        }}
        tabIndex={0}
        aria-expanded={open}
      >
        <td className={TD}>
          <span className="k-mono text-[12px]">{i.costName}</span>
          <span className="k-fg3 ml-2 text-[12px]">{i.provider ?? "legacy name"}</span>
        </td>
        <td className={`${TD} k-fg2`}>
          {label(METHOD_LABEL, i.method)}
          {i.ratio != null && <span className="k-fg3"> {ratio(i.ratio)}</span>}
          {i.flag && <span className="k-fg3"> · {label(FLAG_LABEL, i.flag)}</span>}
        </td>
        <td className={`${TDR} k-fg2`}>{cents(i.catalogueVendorCostPerUnitUsdCents) ?? <Dash />}</td>
        <td className={TDR}>{cents(i.realCostPerUnitUsdCents) ?? <Dash />}</td>
        <td className={TDR}>{cents(i.cataloguePricePerUnitUsdCents) ?? <span className="k-fg3">no price</span>}</td>
        <td className={`${TDR} k-fg2`}>{ratio(i.catalogueMarkupOnRealCost) ?? <Dash />}</td>
        <td className={`${TDR} font-medium`}>
          {cents(i.proposedPricePerUnitUsdCents) ?? <Dash />}
          <span className="k-fg3 block text-[11px] font-normal">{label(BASIS_LABEL, i.proposedBasis)}</span>
        </td>
        <td className={TDR}>
          <Change v={i.proposedVsCataloguePct} />
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={8} className="bg-[var(--bg-inset,transparent)] p-3">
            <ItemHistory costName={i.costName} />
          </td>
        </tr>
      )}
    </>
  );
}

const HISTORY_LINES: Line<RealCostSeries["daily"][number]>[] = [
  { key: "proposed", label: "Proposed", color: "var(--accent)", get: (d) => d.proposedPricePerUnitUsdCents },
  { key: "catalogue", label: "Catalogue price", color: "var(--data-violet)", get: (d) => d.cataloguePricePerUnitUsdCents },
  { key: "real", label: "Real cost", color: "var(--data-teal)", get: (d) => d.realCostPerUnitUsdCents },
];

function ItemHistory({ costName }: { costName: string }) {
  const q = useAuthQuery(["staffRealCostSeries", costName], () => getStaffRealCostSeries(costName), ONCE);
  if (q.isError) return <EmptyNote>Could not read this item&apos;s history: {q.error?.message ?? "unknown error"}.</EmptyNote>;
  if (!q.data) return <Shimmer className="h-[260px] w-full" />;
  return (
    <DailyLines
      points={q.data.daily}
      lines={HISTORY_LINES}
      caption={(d) => `${label(METHOD_LABEL, d.method)}${d.flag ? ` · ${label(FLAG_LABEL, d.flag)}` : ""}`}
      format={cents}
      empty="No history for this cost item yet."
      label={`${costName} price per day`}
    />
  );
}
