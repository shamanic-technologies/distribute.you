"use client";

import { EmptyNote, Figure, SectionTitle } from "@/components/v2/ui";
import {
  DEFAULT_WINDOWS,
  DailyLines,
  Dash,
  PeriodBars,
  SERIES_COLORS,
  TD,
  TDR,
  TH,
  THR,
  cents,
  dayLabel,
  dollars,
  monthLabel,
  n,
  type BarSeries,
  type Line,
} from "@/components/v2/monitoring-charts";
import { versionsOf, type EmailSendPrice, type EmailSendPriceDay, type PriceVersion } from "@/lib/monitoring/monitoring";

/**
 * Monitoring > Price > Email sending (staff only): what sending ONE cold email to a lead really
 * cost us, the price we would re-bill for sending. Owner formula (2026-10-01): everything ever
 * paid to the email-infrastructure vendors (bank ledger, net of refunds) over every email ever
 * sent to a lead, recomputed daily by costs-service. Every price, total and running figure here
 * is the producer's; this file formats, slices a window and draws. It never adds or divides.
 */

/** The catalogue item sending was billed under, for the "what we billed before" comparison. */
const SENDING_COST_ITEM = "instantly-account-email-sent";

const VENDOR_COLORS = SERIES_COLORS;

/** The same price read per thousand emails: a unit change of the served figure ($0.0306 → $30.60). */
function perThousand(v: number | null): string | null {
  return v == null ? null : `$${(v * 10).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** The last month the producer marks closed: every month but the one running to today. */
function lastFullMonth(p: EmailSendPrice) {
  return p.monthly.length >= 2 ? p.monthly[p.monthly.length - 2] : null;
}

export function EmailPriceView({ p, versions }: { p: EmailSendPrice; versions: PriceVersion[] | undefined }) {
  return (
    <div className="space-y-8">
      <Freshness p={p} />
      <Kpis p={p} />
      <section>
        <SectionTitle right={<span>Per day, US cents per email</span>}>Price since the first send</SectionTitle>
        <PriceChart days={p.daily} firstSendOn={p.firstSendOn} />
      </section>
      <section>
        <SectionTitle right={<span>Net of refunds, per month</span>}>What we paid, per vendor</SectionTitle>
        <SpendChart p={p} />
      </section>
      <section>
        <SectionTitle count={p.monthly.length}>Month by month</SectionTitle>
        <MonthlyTable p={p} />
      </section>
      <section>
        <SectionTitle count={p.vendors.length} right={<span>Read from the bank ledger</span>}>
          Vendors counted as email infrastructure
        </SectionTitle>
        <VendorsTable p={p} />
      </section>
      <section>
        <SectionTitle>Timeline</SectionTitle>
        <Timeline p={p} />
      </section>
      <section>
        <SectionTitle right={<span className="k-mono">{SENDING_COST_ITEM}</span>}>What we billed for sending so far</SectionTitle>
        <BilledBefore p={p} versions={versions} />
      </section>
    </div>
  );
}

/** As of when, and whether today's refresh ran: a stale series is said, never hidden. */
function Freshness({ p }: { p: EmailSendPrice }) {
  const failed = p.lastRefresh?.status === "failed";
  return (
    <div className="k-fg2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
      <span className="inline-flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.stale ? "var(--data-amber)" : "var(--data-teal)" }} />
        {p.stale ? "Not refreshed today" : "Refreshed today"} · as of {dayLabel(p.asOf)}
      </span>
      <span className="k-fg3">{p.formula}</span>
      {failed && p.lastRefresh?.error && <span style={{ color: "var(--data-rose)" }}>Last refresh failed: {p.lastRefresh.error}</span>}
    </div>
  );
}

function Kpis({ p }: { p: EmailSendPrice }) {
  const cells: { label: string; value: React.ReactNode; sub?: React.ReactNode }[] = [
    { label: "Price per email", value: cents(p.currentPriceUsdCents) ?? <Dash />, sub: perThousand(p.currentPriceUsdCents) && `${perThousand(p.currentPriceUsdCents)} per 1,000` },
    { label: "Last full month", value: cents(lastFullMonth(p)?.monthPriceUsdCents ?? null) ?? <Dash />, sub: lastFullMonth(p) ? `${monthLabel(lastFullMonth(p)!.month)} alone` : undefined },
    { label: "Infra spend, net", value: dollars(p.totals.spendUsd), sub: `${dollars(p.totals.paidUsd)} paid, ${dollars(p.totals.refundedUsd)} refunded` },
    { label: "Emails to leads", value: n(p.totals.emailsToLeads), sub: p.firstSendOn ? `since ${dayLabel(p.firstSendOn)}` : undefined },
  ];
  return (
    <div className="k-card grid grid-cols-2 divide-[var(--line-subtle)] md:grid-cols-4 md:divide-x">
      {cells.map((c) => (
        <div key={c.label} className="min-w-0 p-4">
          <p className="k-label">{c.label}</p>
          <div className="mt-1.5">
            <Figure value={c.value} />
          </div>
          {c.sub && <p className="k-fg3 mt-0.5 truncate text-[12px]">{c.sub}</p>}
        </div>
      ))}
      <p className="k-fg3 col-span-2 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px] md:col-span-4">
        Gross, before refunds: {cents(p.currentGrossPriceUsdCents) ?? "—"} per email. Warmup, warmup replies, placement tests and replies by hand are not counted as emails to leads.
      </p>
    </div>
  );
}

// ─── Charts ────────────────────────────────────────────────────────────────

const LINES: Line<EmailSendPriceDay>[] = [
  { key: "priceUsdCents", label: "Since inception", color: "var(--accent)", get: (d) => d.priceUsdCents },
  { key: "grossPriceUsdCents", label: "Before refunds", color: "var(--fg-3)", dashed: true, get: (d) => d.grossPriceUsdCents },
];

function PriceChart({ days, firstSendOn }: { days: EmailSendPriceDay[]; firstSendOn: string | null }) {
  return (
    <DailyLines
      points={firstSendOn ? days.filter((d) => d.day >= firstSendOn) : []}
      lines={LINES}
      caption={(d) => `${n(d.cumulativeEmailsToLeads)} emails, ${dollars(d.cumulativeSpendUsd)} spent so far`}
      format={cents}
      windows={[...DEFAULT_WINDOWS.slice(0, 2), { key: "all", label: "Since the first send", days: null }]}
      empty="No email sent to a lead yet, so no price to draw."
      label="Price per email per day"
    />
  );
}

function SpendChart({ p }: { p: EmailSendPrice }) {
  const series: BarSeries<EmailSendPrice["monthly"][number] & { period: string }>[] = p.vendors.map((v, i) => ({
    key: v.key,
    label: v.label,
    color: SERIES_COLORS[i % SERIES_COLORS.length],
    get: (m) => m.spendByVendorUsd[v.key] ?? 0,
  }));
  const months = p.monthly.map((m) => ({ ...m, period: m.month }));
  const last = lastFullMonth(p);
  return (
    <PeriodBars
      periods={months}
      series={series}
      // Unhovered, the legend reads the last full month: the current one has barely started.
      initial={last ? { ...last, period: last.month } : null}
      caption={(m) => `${dollars(m.spendUsd)} net, ${n(m.emailsToLeads)} emails · ${cents(m.monthPriceUsdCents) ?? "—"} per email that month`}
      format={dollars}
      label={monthLabel}
      empty="No payment to an email infrastructure vendor yet."
    />
  );
}

// ─── Tables ────────────────────────────────────────────────────────────────

function MonthlyTable({ p }: { p: EmailSendPrice }) {
  return (
    <div className="k-card overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead className="border-b border-[var(--line-subtle)]">
          <tr>
            <th className={TH}>Month</th>
            {p.vendors.map((v) => (
              <th key={v.key} className={THR}>
                {v.label}
              </th>
            ))}
            <th className={THR}>Spend, net</th>
            <th className={THR}>Emails to leads</th>
            <th className={THR}>Month alone</th>
            <th className={THR}>Since inception</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--line-subtle)]">
          {p.monthly.map((m) => (
            <tr key={m.month} className="k-row">
              <td className={TD}>{monthLabel(m.month)}</td>
              {p.vendors.map((v) => (
                <td key={v.key} className={`${TDR} k-fg2`}>
                  {m.spendByVendorUsd[v.key] ? dollars(m.spendByVendorUsd[v.key]) : <Dash />}
                </td>
              ))}
              <td className={TDR}>{dollars(m.spendUsd)}</td>
              <td className={TDR}>{n(m.emailsToLeads)}</td>
              <td className={TDR}>{cents(m.monthPriceUsdCents) ?? <Dash />}</td>
              <td className={`${TDR} font-medium`}>{cents(m.priceUsdCents) ?? <Dash />}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="k-fg3 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px]">
        &ldquo;Since inception&rdquo; is the running price at the month&apos;s last day: all net spend so far over all emails so far. The current month runs to today.
      </p>
    </div>
  );
}

function VendorsTable({ p }: { p: EmailSendPrice }) {
  return (
    <div className="k-card overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead className="border-b border-[var(--line-subtle)]">
          <tr>
            <th className={TH}>Vendor</th>
            <th className={TH}>What for</th>
            <th className={TH}>First paid</th>
            <th className={TH}>Last paid</th>
            <th className={THR}>Payments</th>
            <th className={THR}>Paid</th>
            <th className={THR}>Refunded</th>
            <th className={THR}>Net</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--line-subtle)]">
          {p.vendors.map((v, i) => (
            <tr key={v.key} className="k-row">
              <td className={TD}>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-[2px]" style={{ background: VENDOR_COLORS[i % VENDOR_COLORS.length] }} aria-hidden="true" />
                  {v.label}
                </span>
              </td>
              <td className={`${TD} k-fg2`}>{v.what}</td>
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
      {p.excludedVendors.length > 0 && (
        <div className="k-fg3 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px]">
          Not counted:{" "}
          {p.excludedVendors.map((e, i) => (
            <span key={e.key}>
              {i > 0 && " · "}
              <span className="k-fg2">{e.key}</span> ({e.reason})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Dated facts the producer serves, in date order: when each vendor started, the first send, today's price. */
function Timeline({ p }: { p: EmailSendPrice }) {
  const events: { on: string; title: string; note: string; color: string }[] = [];
  p.vendors.forEach((v, i) => {
    if (v.firstPaidOn) events.push({ on: v.firstPaidOn, title: `First payment to ${v.label}`, note: v.what, color: VENDOR_COLORS[i % VENDOR_COLORS.length] });
  });
  if (p.firstSendOn) events.push({ on: p.firstSendOn, title: "First email sent to a lead", note: "The price exists from this day", color: "var(--run)" });
  events.push({ on: p.asOf, title: `Price today: ${cents(p.currentPriceUsdCents) ?? "—"} per email`, note: `${n(p.totals.emailsToLeads)} emails, ${dollars(p.totals.spendUsd)} net spend`, color: "var(--accent)" });
  events.sort((a, b) => a.on.localeCompare(b.on));
  return (
    <ol className="k-card p-4">
      {events.map((e, i) => (
        <li key={`${e.on}-${e.title}`} className="relative flex gap-3 pb-4 last:pb-0">
          {i < events.length - 1 && <span className="absolute left-[4px] top-4 h-[calc(100%-8px)] w-px bg-[var(--line-subtle)]" aria-hidden="true" />}
          <span className="mt-1.5 h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: e.color }} aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[13px]">
              <span className="k-mono k-fg3 mr-2 text-[12px]">{dayLabel(e.on)}</span>
              {e.title}
            </p>
            <p className="k-fg3 text-[12px]">{e.note}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** The catalogue's billed price per email over time, beside the measured price: a lookup, no arithmetic. */
function BilledBefore({ p, versions }: { p: EmailSendPrice; versions: PriceVersion[] | undefined }) {
  if (!versions) {
    return (
      <div className="k-card">
        <EmptyNote>Reading the price catalogue…</EmptyNote>
      </div>
    );
  }
  const vs = versionsOf(versions, SENDING_COST_ITEM).filter((v) => !v.reconstructed);
  return (
    <div className="k-card overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead className="border-b border-[var(--line-subtle)]">
          <tr>
            <th className={TH}>From</th>
            <th className={TH}>Plan</th>
            <th className={THR}>Billed per email</th>
            <th className={THR}>Vendor cost on record</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--line-subtle)]">
          {vs.map((v) => (
            <tr key={v.id} className="k-row">
              <td className={`${TD} k-mono k-fg2 text-[12px]`}>{dayLabel(v.effectiveFrom)}</td>
              <td className={`${TD} k-fg2`}>{v.planTier ?? <Dash />}</td>
              <td className={TDR}>{cents(v.billedPricePerUnitInUsdCents) ?? <span className="k-fg3">no price</span>}</td>
              <td className={`${TDR} k-fg2`}>{cents(v.vendorCostPerUnitInUsdCents) ?? <Dash />}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="k-fg3 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px]">
        Measured today: {cents(p.currentPriceUsdCents) ?? "—"} per email. Shown only: no billed price reads it yet.
      </p>
    </div>
  );
}
