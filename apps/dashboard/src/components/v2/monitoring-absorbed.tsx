"use client";

import { useState } from "react";
import { CompanyLogo } from "@/components/company-logo";
import { Figure, SectionTitle } from "@/components/v2/ui";
import type { AbsorbedCosts, AbsorbedCustomer } from "@/lib/monitoring/monitoring";
import { DailyLines, Dash, PeriodBars, TD, TDR, TH, THR, dayLabel, dollars, dollarsExact, monthLabel, n, type Line } from "@/components/v2/monitoring-charts";

/**
 * Monitoring > Customers > Absorbed (staff only): the cost the platform takes on for each customer
 * (owner 2026-10-13: a customer pays only what its campaigns spend). Absorbed = spend with no
 * campaign (Copilot chat, onboarding, setup, A/B work) + card fees, since inception.
 * Every total, average, median and bucket is billing-service's; this file formats, picks a row
 * and draws. It never adds, averages or buckets a figure.
 */

const usd = (c: string | null) => (c == null ? null : dollars(Number(c) / 100));
const usdExact = (c: string | null) => (c == null ? null : dollarsExact(Number(c) / 100));
const PAGE = 25;

/** billing's verdict on the customer, named and coloured here (owner 2026-10-13: a churned customer never reads "Paying"). */
const STATUS_LOOK = {
  current: { word: "Current", color: "var(--run)" },
  churned: { word: "Churned", color: "var(--data-rose)" },
  never_paid: { word: "Never paid", color: "var(--data-amber)" },
  unknown: { word: "Unknown", color: "var(--fg-4)" },
} as const;

function StatusDot({ status }: { status: AbsorbedCustomer["customerStatus"] }) {
  const look = STATUS_LOOK[status ?? "unknown"];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: look.color }} aria-hidden="true" />
      {look.word}
    </span>
  );
}

/** Fees an acquirer took in another currency, while billing still serves them apart. */
function otherFees(list: { currency: string; feeCents: string }[] | undefined) {
  return (list ?? []).map((o) => `${(Number(o.feeCents) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${o.currency.toUpperCase()}`).join(", ");
}

export function AbsorbedView({ data }: { data: AbsorbedCosts }) {
  const f = data.fleet;
  const thisMonth = data.fleetByMonth.at(-1) ?? null;
  // Our own orgs (billing's `ownOrg`: platform or staff-only) are listed apart, never as customers.
  const customers = data.customers.filter((c) => !c.platformOrg && !c.ownOrg);
  const [orgId, setOrgId] = useState<string | null>(customers.find((c) => Number(c.absorbedCents) > 0)?.orgId ?? null);
  const sel = customers.find((c) => c.orgId === orgId) ?? null;

  const kpis: { label: string; value: React.ReactNode; sub: React.ReactNode }[] = [
    {
      label: "Absorbed since inception",
      value: usd(f.absorbedCents),
      sub: `${usd(f.noCampaignSpendCents)} spend with no campaign, ${usd(f.cardFeesCents)} card fees`,
    },
    {
      label: "Average per customer",
      value: usdExact(f.averagePerCustomerWithCostCents) ?? <Dash />,
      sub: `over ${n(f.customersWithAbsorbedCost)} customers with a cost, median ${usdExact(f.medianPerCustomerWithCostCents) ?? "—"}`,
    },
    {
      label: "This month",
      value: thisMonth ? usd(thisMonth.absorbedCents) : <Dash />,
      sub: thisMonth ? `${monthLabel(thisMonth.month)}, ${n(thisMonth.customersWithAbsorbedCost)} customers, month in progress` : "no month yet",
    },
    {
      label: "Never-paid signups",
      value: usd(f.neverPaid.absorbedCents),
      sub: `${n(f.neverPaid.customersWithAbsorbedCost)} signups, ${usd(f.paying.absorbedCents)} on ${n(f.paying.customersWithAbsorbedCost)} paying customers`,
    },
  ];

  const months = data.fleetByMonth.map((m) => ({ ...m, period: m.month, day: `${m.month}-01` }));
  const avgLines: Line<(typeof months)[number]>[] = [
    { key: "month", label: "That month", color: "var(--accent)", get: (m) => (m.averagePerCustomerCents == null ? null : Number(m.averagePerCustomerCents) / 100) },
    { key: "inception", label: "Since inception", color: "var(--data-violet)", get: (m) => (m.averagePerCustomerSinceInceptionCents == null ? null : Number(m.averagePerCustomerSinceInceptionCents) / 100) },
    { key: "paying", label: "Paying", color: "var(--data-teal)", dashed: true, get: (m) => (m.averagePerPayingCustomerCents == null ? null : Number(m.averagePerPayingCustomerCents) / 100) },
    { key: "never", label: "Never paid", color: "var(--data-amber)", dashed: true, get: (m) => (m.averagePerNeverPaidCustomerCents == null ? null : Number(m.averagePerNeverPaidCustomerCents) / 100) },
  ];
  const buckets = data.distribution.map((b) => ({ ...b, period: b.label }));

  const notes = [
    Number(f.unattributedCardFeesCents) > 0 && `${usdExact(f.unattributedCardFeesCents)} more card fees are not tied to a customer and stay out of these figures.`,
    (f.cardFeesOtherCurrencies?.length ?? 0) > 0 && `Card fees taken in another currency are not converted: ${otherFees(f.cardFeesOtherCurrencies)}.`,
  ].filter(Boolean);

  return (
    <div className="space-y-8">
      <div className="k-fg2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--data-teal)]" />
          Customers pay campaign spend only since {dayLabel(data.basis.ruleSince)}
        </span>
        <span className="k-fg3">Before that day: what we would have absorbed under the same rule. Amounts at our catalogue price, net of discounts.</span>
      </div>

      <section>
        <div className="k-card grid grid-cols-2 divide-[var(--line-subtle)] md:grid-cols-4 md:divide-x">
          {kpis.map((c) => (
            <div key={c.label} className="min-w-0 p-4">
              <p className="k-label">{c.label}</p>
              <div className="mt-1.5">
                <Figure value={c.value} />
              </div>
              <p className="k-fg3 mt-0.5 line-clamp-2 text-[12px]">{c.sub}</p>
            </div>
          ))}
          {notes.length > 0 && <p className="k-fg3 col-span-2 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px] md:col-span-4">{notes.join(" ")}</p>}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle right={<span>Every customer, per month</span>}>Absorbed per month</SectionTitle>
          <PeriodBars
            periods={months}
            series={[
              { key: "noCampaign", label: "No campaign", color: "var(--data-rose)", get: (m) => Number(m.noCampaignSpendCents) / 100 },
              { key: "fees", label: "Card fees", color: "var(--data-sky)", get: (m) => Number(m.cardFeesCents) / 100 },
            ]}
            caption={(m) => `${usd(m.absorbedCents)} on ${n(m.customersWithAbsorbedCost)} customers`}
            format={dollars}
            label={monthLabel}
            empty="Nothing absorbed yet."
          />
        </section>
        <section>
          <SectionTitle right={<span>Customers by absorbed cost, since inception</span>}>Distribution</SectionTitle>
          <PeriodBars
            periods={buckets}
            series={[
              { key: "paying", label: "Paying", color: "var(--data-teal)", get: (b) => b.paying },
              { key: "never", label: "Never paid", color: "var(--data-amber)", get: (b) => b.neverPaid },
              { key: "unknown", label: "Unknown", color: "var(--fg-4)", get: (b) => b.payingUnknown },
            ]}
            caption={(b) => `${n(b.customers)} customers`}
            initial={buckets[0] ?? null}
            format={n}
            label={(p) => p}
            empty="No customer yet."
          />
        </section>
      </div>

      <section>
        <SectionTitle right={<span>Customers who cost something, per month</span>}>Average per customer over time</SectionTitle>
        <DailyLines
          points={months}
          lines={avgLines}
          caption={(m) => `${usd(m.absorbedCents)} absorbed, ${usd(m.cumulativeAbsorbedCents)} since inception`}
          format={(v) => dollarsExact(v)}
          windows={[{ key: "all", label: "All", days: null }]}
          pointLabel={(d) => monthLabel(d)}
          tickLabel={(d) => monthLabel(d, true)}
          empty="Not enough months to draw a line yet."
          label="Average absorbed cost per customer per month"
        />
      </section>

      <CustomersTable customers={customers} ownOrgs={data.ownOrgs ?? []} current={f.currentCustomers} churned={f.churnedCustomers} selected={orgId} onSelect={setOrgId} />

      {sel && <CustomerDetail c={sel} months={data.months} />}
    </div>
  );
}

function CustomersTable({
  customers,
  ownOrgs,
  current,
  churned,
  selected,
  onSelect,
}: {
  customers: AbsorbedCustomer[];
  ownOrgs: NonNullable<AbsorbedCosts["ownOrgs"]>;
  current: number | undefined;
  churned: number | undefined;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const [shown, setShown] = useState(PAGE);
  const rows = customers.slice(0, shown);
  return (
    <section>
      <SectionTitle
        count={customers.length}
        right={<span>{current !== undefined && churned !== undefined ? `${n(current)} current, ${n(churned)} churned. ` : ""}Largest first, pick a row for its months</span>}
      >
        Customers
      </SectionTitle>
      <div className="k-card overflow-hidden">
        <div className="k-scroll overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-b border-[var(--line-subtle)]">
              <tr>
                <th className={TH}>Customer</th>
                <th className={TH}>Status</th>
                <th className={TH}>Last paid</th>
                <th className={TH}>Signed up</th>
                <th className={THR}>Absorbed</th>
                <th className={THR}>No campaign</th>
                <th className={THR}>Card fees</th>
                <th className={THR}>Campaign spend</th>
                <th className={THR}>Paid us</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line-subtle)]">
              {rows.map((c) => (
                <tr
                  key={c.orgId}
                  className={`k-row cursor-pointer ${c.orgId === selected ? "k-selected" : ""}`}
                  onClick={() => onSelect(c.orgId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onSelect(c.orgId);
                  }}
                  tabIndex={0}
                  aria-selected={c.orgId === selected}
                >
                  <td className={`${TD} max-w-[320px]`}>
                    <span className="flex min-w-0 items-center gap-2">
                      {c.orgDomain ? <CompanyLogo domain={c.orgDomain} name={c.orgName} size={20} /> : <span className="k-inset h-5 w-5 shrink-0 rounded" aria-hidden="true" />}
                      <span className="truncate">{c.orgName ?? c.orgDomain ?? <span className="k-mono k-fg2 text-[12px]">{c.orgId}</span>}</span>
                      {c.orgName && c.orgDomain && <span className="k-fg3 truncate text-[12px]">{c.orgDomain}</span>}
                    </span>
                  </td>
                  <td className={TD}>
                    <StatusDot status={c.customerStatus} />
                  </td>
                  <td className={`${TD} k-mono k-fg2 whitespace-nowrap text-[12px]`}>
                    {c.lastPaymentAt ? (
                      <>
                        {dayLabel(c.lastPaymentAt)}
                        {c.daysSinceLastPayment != null && <span className="k-fg3"> · {n(c.daysSinceLastPayment)}d ago</span>}
                      </>
                    ) : (
                      <Dash />
                    )}
                  </td>
                  <td className={`${TD} k-mono k-fg2 whitespace-nowrap text-[12px]`}>{c.createdAt ? dayLabel(c.createdAt) : <Dash />}</td>
                  <td className={`${TDR} font-medium`}>{usdExact(c.absorbedCents)}</td>
                  <td className={`${TDR} k-fg2`}>{usdExact(c.noCampaignSpendCents)}</td>
                  <td className={`${TDR} k-fg2`}>{usdExact(c.cardFeesCents)}</td>
                  <td className={`${TDR} k-fg2`}>{usdExact(c.campaignSpendCents)}</td>
                  <td className={`${TDR} k-fg2`}>{usdExact(c.cashPaidCents) ?? <Dash />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="k-fg3 flex items-center justify-between border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px] tabular-nums">
          <span>
            {n(rows.length)} of {n(customers.length)} customers.{" "}
            {ownOrgs.length > 0 ? `Our own accounts are left out: ${ownOrgs.map((o) => o.orgName ?? o.orgId).join(", ")}.` : "Our own accounts are left out."}
          </span>
          {shown < customers.length && (
            <button type="button" className="k-btn-ghost h-6 px-2 text-[12px]" onClick={() => setShown((s) => s + PAGE)}>
              Show {Math.min(PAGE, customers.length - shown)} more
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function CustomerDetail({ c, months }: { c: AbsorbedCustomer; months: string[] }) {
  // The customer's served months laid on the served month list: a month it is absent from reads $0.
  const byMonth = new Map(c.byMonth.map((m) => [m.month, m]));
  const periods = months.map((m) => ({ period: m, row: byMonth.get(m) ?? null }));
  const name = c.orgName ?? c.orgDomain ?? c.orgId;
  return (
    <section>
      <SectionTitle right={<StatusDot status={c.customerStatus} />}>{name}, per month</SectionTitle>
      <PeriodBars
        periods={periods}
        series={[
          { key: "noCampaign", label: "No campaign", color: "var(--data-rose)", get: (p) => (p.row ? Number(p.row.noCampaignSpendCents) / 100 : 0) },
          { key: "fees", label: "Card fees", color: "var(--data-sky)", get: (p) => (p.row ? Number(p.row.cardFeesCents) / 100 : 0) },
        ]}
        caption={(p) => (p.row ? `${usdExact(p.row.absorbedCents)} absorbed, ${usdExact(p.row.campaignSpendCents)} campaign spend` : "nothing that month")}
        format={dollarsExact}
        label={monthLabel}
        empty="No month yet."
      />
      {(c.cardFeesOtherCurrencies?.length ?? 0) > 0 && <p className="k-fg3 mt-2 text-[12px]">Also card fees in another currency, not converted: {otherFees(c.cardFeesOtherCurrencies)}.</p>}
    </section>
  );
}
