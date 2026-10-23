"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { EmptyNote, Initials } from "@/components/v2/ui";
import { RecordsTabs } from "@/components/v2/records";
import type { AbsorbedCosts, AbsorbedCustomer } from "@/lib/monitoring/monitoring";
import { Dash, PeriodBars, TD, TDR, TH, THR, dayLabel, dollarsExact, monthLabel, n } from "@/components/v2/monitoring-charts";

/**
 * Monitoring > Customers > Accounts (staff only, owner 2026-10-23): one row per customer, tabs
 * Active | Churned, the health of each account at a glance; a row opens a right panel with the
 * detail. The verdict (current / churned / never paid) and every figure are billing-service's
 * (its staff absorbed-costs read); this file picks the tab, formats and draws, it never adds,
 * averages or re-grades a figure. Never-paid signups are not customers and stay off the page.
 * The health columns (budget, balance, ROI, audience, last visit) wait on features-service's
 * customer-health board, whose read crashed features-service when asked (2026-10-23).
 */

type Tab = "current" | "churned";

const usdExact = (c: string | null) => (c == null ? null : dollarsExact(Number(c) / 100));
const PAYMENT_MODE: Record<string, string> = { prepaid: "Prepaid", postpaid: "Postpaid", subscription: "Subscription" };
const modeWord = (m: string | null) => (m == null ? null : (PAYMENT_MODE[m] ?? m.charAt(0).toUpperCase() + m.slice(1)));
const nameOf = (c: AbsorbedCustomer) => c.orgName ?? c.orgDomain ?? null;

/** billing's verdict, named and coloured as on the Absorbed page. */
const STATUS_LOOK = {
  current: { word: "Current", color: "var(--run)" },
  churned: { word: "Churned", color: "var(--data-rose)" },
} as const;

function StatusDot({ tab }: { tab: Tab }) {
  const look = STATUS_LOOK[tab];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: look.color }} aria-hidden="true" />
      {look.word}
    </span>
  );
}

function LastPayment({ c }: { c: AbsorbedCustomer }) {
  if (!c.lastPaymentAt) return <Dash />;
  return (
    <>
      {dayLabel(c.lastPaymentAt)}
      {c.daysSinceLastPayment != null && <span className="k-fg3"> · {c.daysSinceLastPayment === 0 ? "today" : `${n(c.daysSinceLastPayment)}d ago`}</span>}
    </>
  );
}

export function AccountsView({ data }: { data: AbsorbedCosts }) {
  // Our own orgs (billing's `ownOrg`: platform or staff-only) are never customers.
  const customers = useMemo(() => data.customers.filter((c) => !c.platformOrg && !c.ownOrg), [data.customers]);
  const byTab = useMemo(
    () => ({
      current: customers.filter((c) => c.customerStatus === "current"),
      churned: customers.filter((c) => c.customerStatus === "churned"),
    }),
    [customers],
  );
  const [tab, setTab] = useState<Tab>("current");
  const [open, setOpen] = useState<string | null>(null);
  const [cursor, setCursor] = useState(-1);
  const rows = byTab[tab];
  const openRow = open ? (customers.find((c) => c.orgId === open) ?? null) : null;

  // J/K move the highlighted row, Enter opens it; never while typing, on a control, or with the panel open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (open) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "BUTTON" || t.tagName === "A" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || !rows.length) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(rows.length - 1, c + 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === "Enter" && cursor >= 0) setOpen(rows[cursor].orgId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, cursor, open]);

  return (
    <>
      <div className="k-card overflow-hidden">
        <RecordsTabs
          tabs={[
            { key: "current", label: "Active", count: byTab.current.length },
            { key: "churned", label: "Churned", count: byTab.churned.length },
          ]}
          active={tab}
          onPick={(k) => {
            setTab(k as Tab);
            setCursor(-1);
          }}
          right={<span>{tab === "current" ? "A campaign is running" : "Paid before, nothing running now"}</span>}
        />
        {rows.length === 0 ? (
          <EmptyNote>{tab === "current" ? "No active customer." : "No churned customer."}</EmptyNote>
        ) : (
          <div className="k-scroll overflow-x-auto">
            <table className="w-full text-[13px] md:min-w-[860px]">
              <thead className="border-b border-[var(--line-subtle)]">
                <tr>
                  <th className={TH}>Customer</th>
                  <th className={TH}>Payment</th>
                  <th className={THR}>Paid to date</th>
                  <th className={THR}>Campaign spend</th>
                  <th className={`${THR} hidden md:table-cell`}>Absorbed</th>
                  <th className={TH}>Last payment</th>
                  <th className={`${TH} hidden lg:table-cell`}>Customer since</th>
                  <th className="w-8 pr-4" aria-hidden="true" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line-subtle)]">
                {rows.map((c, i) => {
                  const name = nameOf(c);
                  return (
                    <tr
                      key={c.orgId}
                      onClick={() => {
                        setCursor(i);
                        setOpen(c.orgId);
                      }}
                      className={`k-row group h-11 cursor-pointer ${i === cursor || open === c.orgId ? "k-selected" : ""}`}
                    >
                      <td className={`${TD} max-w-[280px]`}>
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Initials name={name ?? "?"} size={20} />
                          {name ? <span className="truncate font-medium">{name}</span> : <span className="k-mono k-fg3 truncate text-[12px]">{c.orgId}</span>}
                        </span>
                      </td>
                      <td className={TD}>{modeWord(c.paymentMode) ? <span className="k-chip text-[12px]">{modeWord(c.paymentMode)}</span> : <Dash />}</td>
                      <td className={`${TDR} font-medium`}>{usdExact(c.cashPaidCents) ?? <Dash />}</td>
                      <td className={`${TDR} k-fg2`}>{usdExact(c.campaignSpendCents)}</td>
                      <td className={`${TDR} k-fg2 hidden md:table-cell`}>{usdExact(c.absorbedCents)}</td>
                      <td className={`${TD} k-mono k-fg2 whitespace-nowrap text-[12px]`}>
                        <LastPayment c={c} />
                      </td>
                      <td className={`${TD} k-mono k-fg2 hidden whitespace-nowrap text-[12px] lg:table-cell`}>{c.createdAt ? dayLabel(c.createdAt) : <Dash />}</td>
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
        )}
        <div className="k-fg3 flex items-center justify-between border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px] tabular-nums">
          <span>
            {n(rows.length)} customer{rows.length === 1 ? "" : "s"}. Signups who never paid and our own accounts are left out.
          </span>
          <span className="hidden sm:inline">
            <kbd className="k-kbd">J</kbd> <kbd className="k-kbd">K</kbd> to move, <kbd className="k-kbd">Enter</kbd> to open
          </span>
        </div>
      </div>
      {openRow && <AccountPanel c={openRow} months={data.months} onClose={() => setOpen(null)} />}
    </>
  );
}

// ─── Right panel ───────────────────────────────────────────────────────────

function AccountPanel({ c, months, onClose }: { c: AbsorbedCustomer; months: string[]; onClose: () => void }) {
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

  const name = nameOf(c);
  const tab: Tab | null = c.customerStatus === "current" || c.customerStatus === "churned" ? c.customerStatus : null;
  // The customer's served months laid on the served month list: a month it is absent from reads $0.
  const byMonth = new Map(c.byMonth.map((m) => [m.month, m]));
  const periods = months.map((m) => ({ period: m, row: byMonth.get(m) ?? null }));

  const cells: [string, React.ReactNode][] = [
    ["Paid to date", usdExact(c.cashPaidCents)],
    ["Campaign spend", usdExact(c.campaignSpendCents)],
    ["Absorbed", usdExact(c.absorbedCents)],
    ["Last payment", c.daysSinceLastPayment == null ? null : c.daysSinceLastPayment === 0 ? "Today" : `${n(c.daysSinceLastPayment)}d ago`],
  ];
  const facts: [string, React.ReactNode][] = [
    ["Payment", modeWord(c.paymentMode)],
    ["Last payment", c.lastPaymentAt ? dayLabel(c.lastPaymentAt) : null],
    ["Customer since", c.createdAt ? dayLabel(c.createdAt) : null],
    ["Spend with no campaign", usdExact(c.noCampaignSpendCents)],
    ["Card fees", usdExact(c.cardFeesCents)],
    ["Org id", <span key="id" className="k-mono text-[12px]">{c.orgId}</span>],
  ];

  return createPortal(
    <aside role="dialog" aria-label={`${name ?? c.orgId} account`} className="k-popover fixed inset-y-2 right-2 z-[80] flex w-[min(560px,calc(100vw-16px))] flex-col overflow-hidden">
      <div className="k-line-subtle flex h-11 shrink-0 items-center justify-between border-b px-4">
        <span className="k-label">Customer</span>
        <button type="button" onClick={onClose} aria-label="Close" className="k-btn-ghost h-7 w-7 justify-center px-0">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="k-scroll min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
        <div className="flex min-w-0 items-center gap-3">
          <Initials name={name ?? "?"} size={40} />
          <div className="min-w-0">
            <h2 className="truncate text-[16px] font-medium leading-6">{name ?? <span className="k-mono k-fg2 text-[13px]">{c.orgId}</span>}</h2>
            <div className="mt-0.5 flex items-center gap-2">
              {tab && <StatusDot tab={tab} />}
              {modeWord(c.paymentMode) && <span className="k-chip text-[11px]">{modeWord(c.paymentMode)}</span>}
            </div>
          </div>
        </div>

        <div className="k-inset grid grid-cols-2 overflow-hidden rounded-[10px] shadow-[inset_0_0_0_1px_var(--line-subtle)]">
          {cells.map(([label, v], i) => (
            <div key={label} className={`min-w-0 px-3 py-2.5 ${i % 2 === 0 ? "border-r border-[var(--line-subtle)]" : ""} ${i < 2 ? "border-b border-[var(--line-subtle)]" : ""}`}>
              <p className="k-label">{label}</p>
              <p className="mt-1 text-[18px] font-medium tabular-nums">{v ?? <Dash />}</p>
            </div>
          ))}
        </div>

        <section>
          <p className="k-label mb-2">Per month</p>
          <PeriodBars
            periods={periods}
            series={[
              { key: "campaign", label: "Campaign spend", color: "var(--accent)", get: (p) => (p.row ? Number(p.row.campaignSpendCents) / 100 : 0) },
              { key: "absorbed", label: "Absorbed", color: "var(--data-rose)", get: (p) => (p.row ? Number(p.row.absorbedCents) / 100 : 0) },
            ]}
            format={dollarsExact}
            label={monthLabel}
            empty="No month yet."
          />
        </section>

        <section>
          <p className="k-label mb-2">Account</p>
          <dl className="k-card divide-y divide-[var(--line-subtle)]">
            {facts.map(([label, v]) => (
              <div key={label} className="flex h-10 items-center justify-between gap-3 px-3 text-[13px]">
                <dt className="k-fg2">{label}</dt>
                <dd className="tabular-nums">{v ?? <Dash />}</dd>
              </div>
            ))}
          </dl>
        </section>

        <p className="k-fg3 text-[12px]">Budget, balance, ROI, audience left and last visit come next.</p>
      </div>
    </aside>,
    host,
  );
}
