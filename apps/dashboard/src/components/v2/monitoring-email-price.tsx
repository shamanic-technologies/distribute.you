"use client";

import { useState } from "react";
import { EmptyNote, Figure, SectionTitle } from "@/components/v2/ui";
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

const VENDOR_COLORS = ["var(--accent)", "var(--data-violet)", "var(--data-amber)", "var(--data-teal)", "var(--data-rose)", "var(--data-sky)"];

const n = (v: number) => v.toLocaleString("en-US");
const dollars = (v: number) => `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
/** A price per email in US cents: "3.06¢", or "$7.81" once it is a dollar or more. */
function cents(v: number | null): string | null {
  if (v == null) return null;
  if (v >= 100) return `$${(v / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}¢`;
}
/** The same price read per thousand emails: a unit change of the served figure ($0.0306 → $30.60). */
function perThousand(v: number | null): string | null {
  return v == null ? null : `$${(v * 10).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
const dayLabel = (d: string, opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" }) =>
  new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
const monthLabel = (m: string, short = false) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: short ? "2-digit" : "numeric", timeZone: "UTC" });

function Dash() {
  return <span className="k-fg4">{"—"}</span>;
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

// ─── Price chart ───────────────────────────────────────────────────────────

type Window = "90" | "180" | "all";
const WINDOWS: { key: Window; label: string; days: number | null }[] = [
  { key: "90", label: "90 days", days: 90 },
  { key: "180", label: "180 days", days: 180 },
  { key: "all", label: "Since the first send", days: null },
];

const LINES: { key: "priceUsdCents" | "grossPriceUsdCents"; label: string; color: string; dashed?: boolean }[] = [
  { key: "priceUsdCents", label: "Since inception", color: "var(--accent)" },
  { key: "grossPriceUsdCents", label: "Before refunds", color: "var(--fg-3)", dashed: true },
];

function PriceChart({ days, firstSendOn }: { days: EmailSendPriceDay[]; firstSendOn: string | null }) {
  const [win, setWin] = useState<Window>("90");
  const [hover, setHover] = useState<number | null>(null);
  const sent = firstSendOn ? days.filter((d) => d.day >= firstSendOn) : [];
  const w = WINDOWS.find((x) => x.key === win)!;
  const shown = w.days == null ? sent : sent.slice(-w.days);

  const toolbar = (
    <span className="inline-flex items-center gap-1.5" role="group" aria-label="Window">
      {WINDOWS.map((x) => (
        <button key={x.key} type="button" aria-pressed={win === x.key} onClick={() => setWin(x.key)} className={win === x.key ? "k-btn h-7 px-2 text-[12px]" : "k-btn-ghost h-7 px-2 text-[12px]"}>
          {x.label}
        </button>
      ))}
    </span>
  );

  if (shown.length < 2) {
    return (
      <div className="k-card">
        <EmptyNote>No email sent to a lead yet, so no price to draw.</EmptyNote>
      </div>
    );
  }

  // Geometry only: pixel positions of served values, never a figure shown.
  const W = 800;
  const H = 220;
  const PAD = { l: 0, r: 0, t: 8, b: 4 };
  const vals = shown.flatMap((d) => LINES.map((l) => d[l.key]).filter((v): v is number => v != null));
  const max = Math.max(...vals, 0.01);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const x = (i: number) => PAD.l + (i / (shown.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v / top) * (H - PAD.t - PAD.b);
  const path = (key: (typeof LINES)[number]["key"]) => {
    let d = "";
    let pen = false;
    shown.forEach((p, i) => {
      const v = p[key];
      if (v == null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      pen = true;
    });
    return d;
  };
  const at = shown[hover ?? shown.length - 1];
  const every = Math.ceil(shown.length / 6);

  return (
    <div className="k-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="k-fg2 text-[12px]">
          {dayLabel(at.day)} · {n(at.cumulativeEmailsToLeads)} emails, {dollars(at.cumulativeSpendUsd)} spent so far
        </span>
        {toolbar}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
        {LINES.map((l) => (
          <span key={l.key} className="inline-flex items-center gap-1.5">
            <span className="h-[2px] w-3" style={{ background: l.color, opacity: l.dashed ? 0.7 : 1 }} aria-hidden="true" />
            <span className="k-fg3">{l.label}</span>
            <span className="tabular-nums">{cents(at[l.key]) ?? "—"}</span>
          </span>
        ))}
      </div>
      <div className="relative mt-3 pl-[44px]" style={{ height: H }}>
        {ticks.map((t) => (
          <span key={t} className="k-fg3 absolute left-0 w-[38px] -translate-y-1/2 text-right text-[11px] tabular-nums" style={{ top: y(t) }}>
            {tickLabel(t)}
          </span>
        ))}
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="none" onMouseLeave={() => setHover(null)} role="img" aria-label="Price per email per day">
        {ticks.map((t) => (
          <line key={t} x1={0} x2={W} y1={y(t)} y2={y(t)} stroke="var(--line-subtle)" vectorEffect="non-scaling-stroke" />
        ))}
        {LINES.map((l) => (
          <path key={l.key} d={path(l.key)} fill="none" stroke={l.color} strokeWidth={l.key === "priceUsdCents" ? 2 : 1.5} strokeDasharray={l.dashed ? "4 3" : undefined} vectorEffect="non-scaling-stroke" opacity={l.dashed ? 0.7 : 1} />
        ))}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="var(--line)" vectorEffect="non-scaling-stroke" />}
        {shown.map((d, i) => (
          <rect
            key={d.day}
            x={x(i) - (W - PAD.l - PAD.r) / shown.length / 2}
            y={0}
            width={(W - PAD.l - PAD.r) / shown.length}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
      </div>
      <div className="k-line-subtle ml-[44px] flex border-t pt-1.5">
        {shown.map((d, i) => (
          <span key={d.day} className="k-fg3 w-0 min-w-0 flex-1 overflow-visible whitespace-nowrap text-[10.5px]">
            {i % every === 0 ? dayLabel(d.day, { month: "short", day: "numeric" }) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/** An axis tick: as few decimals as the step needs. */
function tickLabel(v: number): string {
  if (v >= 100) return `$${(v / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  return `${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}¢`;
}

/** Round axis ticks (0 and up to four steps) for the drawn range. */
function niceTicks(max: number): number[] {
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let v = 0; v < max + step * 0.999; v += step) out.push(Number(v.toPrecision(6)));
  return out;
}

// ─── Spend per vendor per month ────────────────────────────────────────────

function SpendChart({ p }: { p: EmailSendPrice }) {
  const [hover, setHover] = useState<string | null>(null);
  const months = p.monthly;
  if (!months.length) {
    return (
      <div className="k-card">
        <EmptyNote>No payment to an email infrastructure vendor yet.</EmptyNote>
      </div>
    );
  }
  const H = 140;
  const vendors = p.vendors.map((v, i) => ({ key: v.key, label: v.label, color: VENDOR_COLORS[i % VENDOR_COLORS.length] }));
  // Bar height only: a refund month can be net negative for a vendor, drawn at zero height.
  const max = Math.max(1, ...months.map((m) => vendors.reduce((t, v) => t + Math.max(0, m.spendByVendorUsd[v.key] ?? 0), 0)));
  // Unhovered, the legend reads the last full month: the current one has barely started.
  const shown = months.find((m) => m.month === hover) ?? lastFullMonth(p) ?? months[months.length - 1];
  return (
    <div className="k-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="k-fg2 text-[12px]">
          {monthLabel(shown.month)} · {dollars(shown.spendUsd)} net, {n(shown.emailsToLeads)} emails · {cents(shown.monthPriceUsdCents) ?? "—"} per email that month
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
          {vendors.map((v) => (
            <span key={v.key} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: v.color }} aria-hidden="true" />
              <span className="k-fg3">{v.label}</span>
              <span className="tabular-nums">{dollars(shown.spendByVendorUsd[v.key] ?? 0)}</span>
            </span>
          ))}
        </span>
      </div>
      <div className="mt-3 flex items-end gap-2" style={{ height: H }} onMouseLeave={() => setHover(null)}>
        {months.map((m) => (
          <button
            key={m.month}
            type="button"
            aria-label={`${monthLabel(m.month)}: ${vendors.map((v) => `${v.label} ${dollars(m.spendByVendorUsd[v.key] ?? 0)}`).join(", ")}`}
            onMouseEnter={() => setHover(m.month)}
            onFocus={() => setHover(m.month)}
            className="flex h-full min-w-0 flex-1 flex-col-reverse"
            style={{ opacity: hover && hover !== m.month ? 0.5 : 1 }}
          >
            {vendors.map((v) => {
              const val = m.spendByVendorUsd[v.key] ?? 0;
              if (val <= 0) return null;
              return <span key={v.key} className="block w-full first:rounded-b-[1px] last:rounded-t-[2px]" style={{ height: Math.max(1, (val / max) * H), background: v.color }} />;
            })}
          </button>
        ))}
      </div>
      <div className="k-line-subtle flex gap-2 border-t pt-1.5">
        {months.map((m) => (
          <span key={m.month} className="k-fg3 min-w-0 flex-1 text-center text-[10.5px]">
            {monthLabel(m.month, true)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Tables ────────────────────────────────────────────────────────────────

const TH = "k-label px-3 py-2.5 text-left font-medium first:pl-4 last:pr-4";
const THR = `${TH} text-right`;
const TD = "px-3 py-2.5 first:pl-4 last:pr-4";
const TDR = `${TD} text-right tabular-nums`;

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
