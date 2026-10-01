"use client";

import { useState } from "react";
import { Figure, SectionTitle } from "@/components/v2/ui";
import type { SubscriptionCost, SubscriptionCosts } from "@/lib/monitoring/monitoring";
import { DailyLines, Dash, PeriodBars, SERIES_COLORS, TD, TDR, TH, THR, cents, dayLabel, dollars, monthLabel, n, type Line } from "@/components/v2/monitoring-charts";

/**
 * Monitoring > Cost > Subscriptions (staff only): the REAL cost of one credit of each vendor
 * subscription (owner 2026-10-01): net paid to the vendor since 2026-01-01 (bank ledger) over the
 * credits consumed through our own account, recomputed daily by costs-service, beside what the
 * catalogue records and bills per unit. Every price and total is the producer's; this file
 * formats, picks a row and draws. It never divides.
 */

const NULL_REASON: Record<string, string> = {
  "no-ledger-line": "no payment found in the bank ledger",
  "no-credit-consumed": "no credit consumed yet",
  "negative-net-paid": "refunds exceed payments",
};

const money = (v: number | null) => (v == null ? <span className="k-fg3">unknown</span> : dollars(v));

/** The catalogue figures of a subscription's first credit item: a lookup, the item the price is quoted on. */
function mainItem(s: SubscriptionCost) {
  return s.costItems.find((c) => c.isCredit && c.billedPricePerUnitInUsdCents != null) ?? s.costItems.find((c) => c.isCredit) ?? null;
}

export function SubscriptionsView({ data }: { data: SubscriptionCosts }) {
  const first = data.subscriptions.find((s) => s.costPerCreditUsdCents != null) ?? data.subscriptions[0];
  const [key, setKey] = useState(first?.key ?? null);
  const sel = data.subscriptions.find((s) => s.key === key) ?? null;
  return (
    <div className="space-y-8">
      <div className="k-fg2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: data.stale ? "var(--data-amber)" : "var(--data-teal)" }} />
          {data.stale ? "Not refreshed today" : "Refreshed today"} · as of {dayLabel(data.asOf)} · since {dayLabel(data.since)}
        </span>
        <span className="k-fg3">{data.formula}</span>
        {data.lastRefresh?.status === "failed" && data.lastRefresh.error && <span style={{ color: "var(--data-rose)" }}>Last refresh failed: {data.lastRefresh.error}</span>}
      </div>

      <section>
        <SectionTitle count={data.subscriptions.length} right={<span>Pick a row for its detail</span>}>
          Real cost per credit
        </SectionTitle>
        <div className="k-card overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-b border-[var(--line-subtle)]">
              <tr>
                <th className={TH}>Subscription</th>
                <th className={THR}>Net paid</th>
                <th className={THR}>Credits used</th>
                <th className={THR}>Real cost / credit</th>
                <th className={THR}>Before refunds</th>
                <th className={THR}>Vendor cost on record</th>
                <th className={THR}>Billed / credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line-subtle)]">
              {data.subscriptions.map((s, i) => {
                const item = mainItem(s);
                return (
                  <tr
                    key={s.key}
                    className={`k-row cursor-pointer ${s.key === key ? "k-selected" : ""}`}
                    onClick={() => setKey(s.key)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setKey(s.key);
                    }}
                    tabIndex={0}
                    aria-selected={s.key === key}
                  >
                    <td className={TD}>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-[2px]" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} aria-hidden="true" />
                        {s.label}
                      </span>
                    </td>
                    <td className={TDR}>{money(s.netUsd)}</td>
                    <td className={TDR}>{n(s.credits)}</td>
                    <td className={`${TDR} font-medium`}>
                      {cents(s.costPerCreditUsdCents) ?? <span className="k-fg3 font-normal">{NULL_REASON[s.costPerCreditNullReason ?? ""] ?? "—"}</span>}
                    </td>
                    <td className={`${TDR} k-fg2`}>{cents(s.grossCostPerCreditUsdCents) ?? <Dash />}</td>
                    <td className={`${TDR} k-fg2`}>{cents(item?.vendorCostPerUnitInUsdCents) ?? <Dash />}</td>
                    <td className={TDR}>{cents(item?.billedPricePerUnitInUsdCents) ?? <Dash />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="k-fg3 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px]">
            Vendor cost on record and Billed are the catalogue&apos;s current figures for the subscription&apos;s main credit item. Real cost is what the bank paid over what we used.
          </p>
        </div>
      </section>

      {sel && <Detail s={sel} />}
    </div>
  );
}

function Detail({ s }: { s: SubscriptionCost }) {
  const lines: Line<SubscriptionCost["daily"][number]>[] = [
    { key: "costPerCreditUsdCents", label: "Real cost / credit", color: "var(--accent)", get: (d) => d.costPerCreditUsdCents },
    { key: "grossCostPerCreditUsdCents", label: "Before refunds", color: "var(--fg-3)", dashed: true, get: (d) => d.grossCostPerCreditUsdCents },
  ];
  const months = s.monthly.map((m) => ({ ...m, period: m.month }));
  const lastFull = months.length >= 2 ? months[months.length - 2] : null;
  const kpis: { label: string; value: React.ReactNode; sub?: React.ReactNode }[] = [
    { label: "Real cost / credit", value: cents(s.costPerCreditUsdCents) ?? <Dash />, sub: s.costPerCreditUsdCents == null ? NULL_REASON[s.costPerCreditNullReason ?? ""] : "net of refunds" },
    { label: "Net paid", value: money(s.netUsd), sub: s.paidUsd == null ? s.ledgerNote ?? undefined : `${dollars(s.paidUsd)} paid, ${dollars(s.refundedUsd ?? 0)} refunded` },
    { label: "Credits used", value: n(s.credits), sub: s.creditDefinition },
    { label: "Before refunds", value: cents(s.grossCostPerCreditUsdCents) ?? <Dash />, sub: s.firstPaymentOn ? `paid since ${dayLabel(s.firstPaymentOn)}` : undefined },
  ];
  return (
    <div className="space-y-8">
      <section>
        <SectionTitle right={<span className="k-mono">{s.provider}</span>}>{s.label}</SectionTitle>
        <div className="k-card grid grid-cols-2 divide-[var(--line-subtle)] md:grid-cols-4 md:divide-x">
          {kpis.map((c) => (
            <div key={c.label} className="min-w-0 p-4">
              <p className="k-label">{c.label}</p>
              <div className="mt-1.5">
                <Figure value={c.value} />
              </div>
              {c.sub && <p className="k-fg3 mt-0.5 line-clamp-2 text-[12px]">{c.sub}</p>}
            </div>
          ))}
          {s.orgKeyUnitsNote && <p className="k-fg3 col-span-2 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px] md:col-span-4">{s.orgKeyUnitsNote}</p>}
        </div>
      </section>

      <section>
        <SectionTitle right={<span>Per day, US cents per credit</span>}>Real cost per credit over time</SectionTitle>
        <DailyLines
          points={s.daily}
          lines={lines}
          caption={(d) => `${n(d.cumulativeCredits)} credits, ${d.cumulativeNetUsd == null ? "spend unknown" : `${dollars(d.cumulativeNetUsd)} net`} so far`}
          format={cents}
          empty="No credit consumed yet, so no cost per credit to draw."
          label={`${s.label} real cost per credit per day`}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle right={<span>Net of refunds</span>}>Paid per month</SectionTitle>
          <PeriodBars
            periods={months}
            series={[{ key: "net", label: "Net paid", color: "var(--data-rose)", get: (m) => m.netUsd ?? 0 }]}
            initial={lastFull}
            format={dollars}
            label={monthLabel}
            empty="No payment in the bank ledger."
          />
        </section>
        <section>
          <SectionTitle>Credits used per month</SectionTitle>
          <PeriodBars
            periods={months}
            series={[{ key: "credits", label: "Credits", color: "var(--accent)", get: (m) => m.credits }]}
            initial={lastFull}
            caption={(m) => `${cents(m.monthCostPerCreditUsdCents) ?? "—"} per credit that month`}
            format={n}
            label={monthLabel}
            empty="No credit consumed."
          />
        </section>
      </div>

      <section>
        <SectionTitle count={s.monthly.length}>Month by month</SectionTitle>
        <div className="k-card overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-b border-[var(--line-subtle)]">
              <tr>
                <th className={TH}>Month</th>
                <th className={THR}>Paid</th>
                <th className={THR}>Refunded</th>
                <th className={THR}>Net</th>
                <th className={THR}>Credits</th>
                <th className={THR}>Month alone</th>
                <th className={THR}>Since Jan 1</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line-subtle)]">
              {s.monthly.map((m) => (
                <tr key={m.month} className="k-row">
                  <td className={TD}>{monthLabel(m.month)}</td>
                  <td className={`${TDR} k-fg2`}>{m.paidUsd ? dollars(m.paidUsd) : <Dash />}</td>
                  <td className={`${TDR} k-fg2`}>{m.refundedUsd ? dollars(m.refundedUsd) : <Dash />}</td>
                  <td className={TDR}>{m.netUsd == null ? <Dash /> : dollars(m.netUsd)}</td>
                  <td className={TDR}>{n(m.credits)}</td>
                  <td className={TDR}>{cents(m.monthCostPerCreditUsdCents) ?? <Dash />}</td>
                  <td className={`${TDR} font-medium`}>{cents(m.costPerCreditUsdCents) ?? <Dash />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionTitle count={s.costItems.length} right={<span>What counts as a credit</span>}>
          Cost items
        </SectionTitle>
        <div className="k-card overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-b border-[var(--line-subtle)]">
              <tr>
                <th className={TH}>Cost item</th>
                <th className={TH}>Counted</th>
                <th className={THR}>Our key</th>
                <th className={THR}>Org key</th>
                <th className={THR}>Credits counted</th>
                <th className={THR}>Vendor cost on record</th>
                <th className={THR}>Billed / unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line-subtle)]">
              {s.costItems.map((c) => (
                <tr key={c.costName} className="k-row">
                  <td className={`${TD} k-mono text-[12px]`}>{c.costName}</td>
                  <td className={`${TD} k-fg2`}>{c.isCredit ? "Yes" : <span className="k-fg3">No · {c.excludedReason ?? "excluded"}</span>}</td>
                  <td className={TDR}>{n(c.quantityPlatformKey)}</td>
                  <td className={`${TDR} k-fg2`}>{c.quantityOrgKey ? n(c.quantityOrgKey) : <Dash />}</td>
                  <td className={TDR}>{n(c.creditsCounted)}</td>
                  <td className={`${TDR} k-fg2`}>{cents(c.vendorCostPerUnitInUsdCents) ?? <span className="k-fg3">{c.catalogueNote ? "not in catalogue" : "—"}</span>}</td>
                  <td className={TDR}>{cents(c.billedPricePerUnitInUsdCents) ?? <Dash />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionTitle count={s.ledgerVendors.length} right={<span>Read from the bank ledger</span>}>
          Payments
        </SectionTitle>
        <div className="k-card overflow-x-auto">
          {s.ledgerVendors.length === 0 ? (
            <p className="k-fg3 px-4 py-6 text-center text-[13px]">{s.ledgerNote ?? "No payment to this vendor in the bank ledger."}</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead className="border-b border-[var(--line-subtle)]">
                <tr>
                  <th className={TH}>Bank line</th>
                  <th className={TH}>First paid</th>
                  <th className={TH}>Last paid</th>
                  <th className={THR}>Payments</th>
                  <th className={THR}>Paid</th>
                  <th className={THR}>Refunded</th>
                  <th className={THR}>Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line-subtle)]">
                {s.ledgerVendors.map((v) => (
                  <tr key={v.key} className="k-row">
                    <td className={`${TD} k-mono text-[12px]`}>{v.key}</td>
                    <td className={`${TD} k-mono k-fg2 text-[12px]`}>{v.firstPaidOn ? dayLabel(v.firstPaidOn) : <Dash />}</td>
                    <td className={`${TD} k-mono k-fg2 text-[12px]`}>{v.lastPaidOn ? dayLabel(v.lastPaidOn) : <Dash />}</td>
                    <td className={TDR}>
                      {n(v.payments)}
                      {v.refunds > 0 && <span className="k-fg3"> · {n(v.refunds)} back</span>}
                    </td>
                    <td className={TDR}>{dollars(v.paidUsd)}</td>
                    <td className={`${TDR} k-fg2`}>{v.refundedUsd ? dollars(v.refundedUsd) : <Dash />}</td>
                    <td className={`${TDR} font-medium`}>{dollars(v.netUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
