"use client";

import { useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getStaffBasisSummary } from "@/lib/api";
import { EmptyNote, Figure, SectionTitle, Shimmer } from "@/components/v2/ui";
import type { BasisSummary } from "@/lib/monitoring/monitoring";
import { Dash, PeriodBars, TD, TDR, TH, THR, dayLabel, dollars, n, pct } from "@/components/v2/monitoring-charts";

/**
 * Monitoring > Price > Pricing basis (staff only, owner 2026-10-01): which cost items are re-billed
 * on an AVERAGE (what we paid over what we used: email infrastructure, subscriptions) and which at
 * the vendor's catalogue list cost (APIs), x2 for production tools and x1 for Stripe and media.
 * Fleet since 2026-01-01: real cost, what it bills at today's catalogue, what it would bill at the
 * proposed list. What the bank paid API vendors beyond list cost is internal, outside clients.
 * Every figure is costs-service's; this file picks a day, labels and draws.
 */

const ONCE = { staleTime: 5 * 60_000, retry: false } as const;

const BASIS: Record<string, { label: string; how: string }> = {
  "email-infrastructure-averaged": { label: "Email sending, averaged", how: "Email infrastructure paid / emails sent to leads, x2" },
  "subscription-averaged": { label: "Subscriptions, averaged", how: "Subscription paid / credits used, x2" },
  "api-list-cost": { label: "APIs, list cost", how: "Vendor catalogue list cost per unit, x2" },
  "pass-through-x1": { label: "Stripe and media", how: "Re-billed at cost, x1" },
  "catalogue-vendor-cost-flagged": { label: "Catalogue cost, flagged", how: "No bank line or no measure: catalogue cost, x2" },
  "included-at-vendor": { label: "Included at the vendor", how: "Already inside another cost: $0" },
  "not-on-the-day-list": { label: "Not on that day's list", how: "Consumed but not priced that day" },
};
const label = (b: string) => BASIS[b]?.label ?? b;
const usdC = (c: number) => dollars(c / 100);

export function PricingBasisView() {
  const [day, setDay] = useState<string | null>(null);
  const q = useAuthQuery(["staffBasisSummary", day], () => getStaffBasisSummary(day), ONCE);
  if (q.isError) {
    return (
      <div className="k-card">
        <EmptyNote>Could not read the pricing basis from production: {q.error?.message ?? "unknown error"}.</EmptyNote>
      </div>
    );
  }
  if (!q.data) {
    return (
      <div className="k-card space-y-2 p-4">
        {[0, 1, 2, 3].map((i) => (
          <Shimmer key={i} className="h-4 w-full" />
        ))}
      </div>
    );
  }
  return <Body d={q.data} day={day} setDay={setDay} fetching={q.isFetching} />;
}

function Body({ d, day, setDay, fetching }: { d: BasisSummary; day: string | null; setDay: (v: string | null) => void; fetching: boolean }) {
  const t = d.totals;
  const bases = d.bases.filter((b) => b.itemCount > 0);
  const kpis: { label: string; value: React.ReactNode; sub?: React.ReactNode }[] = [
    { label: "At today's catalogue", value: usdC(t.amount1UsdCents), sub: `margin ${pct(t.margin1Pct) ?? "—"}` },
    { label: "At the proposed list", value: usdC(t.amount2UsdCents), sub: `margin ${pct(t.margin2Pct) ?? "—"}` },
    {
      label: "Change for clients",
      value: (
        <span style={{ color: t.differenceUsdCents < 0 ? "var(--data-teal)" : t.differenceUsdCents > 0 ? "var(--data-rose)" : undefined }}>
          {t.differenceUsdCents > 0 ? "+" : ""}
          {usdC(t.differenceUsdCents)}
        </span>
      ),
      sub: t.differencePct == null ? undefined : `${t.differencePct > 0 ? "+" : ""}${pct(t.differencePct)}`,
    },
    { label: "Real cost", value: usdC(t.realCostUsdCents), sub: "what clients' usage cost us" },
    { label: "Internal, outside clients", value: usdC(d.internalCost.totalUsdCents), sub: "paid to API vendors beyond list cost" },
  ];
  return (
    <div className="space-y-8">
      <div className="k-fg2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: d.stale ? "var(--data-amber)" : "var(--data-teal)" }} />
          Fleet since Jan 1, 2026 · lists of {dayLabel(d.day)}
        </span>
        <label className="inline-flex items-center gap-2">
          <span className="k-label">Day</span>
          <input
            type="date"
            className="k-input w-[150px]"
            min="2026-01-01"
            max={d.asOf}
            value={day ?? d.day}
            onChange={(e) => setDay(e.target.value && e.target.value !== d.asOf ? e.target.value : null)}
            aria-label="Day of the price lists"
          />
        </label>
        {fetching && <span className="k-fg3">Reading…</span>}
        <span className="k-chip" style={{ color: "var(--data-amber)" }}>
          Not billed: shown until the owner&apos;s go
        </span>
      </div>

      <div className="k-card grid grid-cols-2 divide-[var(--line-subtle)] md:grid-cols-5 md:divide-x">
        {kpis.map((k) => (
          <div key={k.label} className="min-w-0 p-4">
            <p className="k-label">{k.label}</p>
            <div className="mt-1.5">
              <Figure value={k.value} />
            </div>
            {k.sub && <p className="k-fg3 mt-0.5 truncate text-[12px]">{k.sub}</p>}
          </div>
        ))}
        <p className="k-fg3 col-span-2 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px] md:col-span-5">{d.rule}</p>
      </div>

      <section>
        <SectionTitle count={bases.length} right={<span>Fleet since Jan 1, 2026</span>}>
          By pricing basis
        </SectionTitle>
        <div className="k-card overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-b border-[var(--line-subtle)]">
              <tr>
                <th className={TH}>Basis</th>
                <th className={TH}>Providers</th>
                <th className={THR}>Items used</th>
                <th className={THR}>Real cost</th>
                <th className={THR}>At catalogue</th>
                <th className={THR}>At proposed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line-subtle)]">
              {bases.map((b) => (
                <tr key={b.basis} className="k-row align-top">
                  <td className={TD}>
                    <p className="font-medium">{label(b.basis)}</p>
                    <p className="k-fg3 text-[12px]">{BASIS[b.basis]?.how ?? ""}</p>
                  </td>
                  <td className={TD}>
                    <span className="flex flex-wrap gap-1">
                      {b.providers.length ? b.providers.map((p) => <span key={p} className="k-chip">{p}</span>) : <Dash />}
                    </span>
                  </td>
                  <td className={TDR}>
                    {n(b.consumedItemCount)}
                    <span className="k-fg3"> of {n(b.itemCount)}</span>
                  </td>
                  <td className={TDR}>{usdC(b.realCostUsdCents)}</td>
                  <td className={`${TDR} k-fg2`}>{usdC(b.amountCatalogueUsdCents)}</td>
                  <td className={`${TDR} font-medium`}>{usdC(b.amountProposedUsdCents)}</td>
                </tr>
              ))}
              <tr className="border-t border-[var(--line)]">
                <td className={`${TD} font-medium`} colSpan={3}>
                  Total
                </td>
                <td className={`${TDR} font-medium`}>{usdC(t.realCostUsdCents)}</td>
                <td className={`${TDR} font-medium`}>{usdC(t.amount1UsdCents)}</td>
                <td className={`${TDR} font-medium`}>{usdC(t.amount2UsdCents)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionTitle>Side by side</SectionTitle>
        <PeriodBars
          periods={bases.map((b) => ({ ...b, period: b.basis }))}
          initial={bases[0] ? { ...bases[0], period: bases[0].basis } : null}
          grouped
          series={[
            { key: "real", label: "Real cost", color: "var(--data-rose)", get: (b) => b.realCostUsdCents / 100 },
            { key: "catalogue", label: "At catalogue", color: "var(--data-violet)", get: (b) => b.amountCatalogueUsdCents / 100 },
            { key: "proposed", label: "At proposed", color: "var(--accent)", get: (b) => b.amountProposedUsdCents / 100 },
          ]}
          format={(v) => dollars(v)}
          label={(p) => label(p)}
          empty="Nothing consumed."
        />
      </section>

      <section>
        <SectionTitle count={d.internalCost.byVendor.length} right={<span>Never loaded on a unit</span>}>
          Internal cost, outside clients
        </SectionTitle>
        <div className="k-card overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-b border-[var(--line-subtle)]">
              <tr>
                <th className={TH}>Vendor</th>
                <th className={THR}>Paid, excl. VAT</th>
                <th className={THR}>Our runs at list cost</th>
                <th className={THR}>Internal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line-subtle)]">
              {d.internalCost.byVendor.map((v) => (
                <tr key={v.provider} className="k-row">
                  <td className={TD}>{v.provider}</td>
                  <td className={TDR}>{usdC(v.netPaidUsdCents)}</td>
                  <td className={`${TDR} k-fg2`}>{usdC(v.vendorCostRecordedAtListUsdCents)}</td>
                  <td className={`${TDR} font-medium`}>{usdC(v.internalCostUsdCents)}</td>
                </tr>
              ))}
              <tr className="border-t border-[var(--line)]">
                <td className={`${TD} font-medium`} colSpan={3}>
                  Total
                </td>
                <td className={`${TDR} font-medium`}>{usdC(d.internalCost.totalUsdCents)}</td>
              </tr>
            </tbody>
          </table>
          <p className="k-fg3 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px]">
            {d.internalCost.byVendor[0]?.internalCostBasis ?? "What the bank paid an API vendor beyond the list cost of what our runs recorded."}
          </p>
        </div>
      </section>

      {(d.unpricedCostNames2.length > 0 || d.realCostUnknownCostNames.length > 0) && (
        <p className="k-card px-4 py-2.5 text-[12px]" style={{ color: "var(--data-amber)" }}>
          {d.unpricedCostNames2.length > 0 && `No proposed price: ${d.unpricedCostNames2.join(", ")}. `}
          {d.realCostUnknownCostNames.length > 0 && `Real cost unknown: ${d.realCostUnknownCostNames.join(", ")}.`}
        </p>
      )}
    </div>
  );
}
