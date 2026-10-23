"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { EmptyNote, Initials, Shimmer } from "@/components/v2/ui";
import { RoiLabel } from "@/components/v2/roi-label";
import { formatRoi, roiIsGood } from "@/lib/format-roi";
import { RecordsTabs } from "@/components/v2/records";
import type { AbsorbedCosts, AbsorbedCustomer, CustomerHealth, CustomerHealthBrand, CustomerHealthOrg } from "@/lib/monitoring/monitoring";
import { Dash, PeriodBars, TD, TDR, TH, THR, dayLabel, dollarsExact, monthLabel, n } from "@/components/v2/monitoring-charts";

/**
 * Monitoring > Customers > Accounts (staff only, owner 2026-10-23): one row per customer, tabs
 * Active | Churned, the health of each account at a glance; a row opens a right panel with the
 * detail. The verdict (current / churned / never paid) and every figure are billing-service's
 * (its staff absorbed-costs read); this file picks the tab, formats and draws, it never adds,
 * averages or re-grades a figure. Never-paid signups are not customers and stay off the page.
 * The health columns (badge, running $/day, balance, ROI, audience, last visit) and the panel's
 * per-brand detail are features-service's customer-health board (served from its last build),
 * joined on the org id: a display lookup, never a figure made here. A customer on several brands
 * reads its per-brand ROI and audience in the panel, never a blend.
 */

type Tab = "current" | "churned";

const usdExact = (c: string | null) => (c == null ? null : dollarsExact(Number(c) / 100));
const PAYMENT_MODE: Record<string, string> = { prepaid: "Prepaid", postpaid: "Postpaid", subscription: "Subscription" };
const modeWord = (m: string | null) => (m == null ? null : (PAYMENT_MODE[m] ?? m.charAt(0).toUpperCase() + m.slice(1)));
const nameOf = (c: AbsorbedCustomer) => c.orgName ?? c.orgDomain ?? null;
const usdWhole = (v: number | null) => (v == null ? null : `$${Math.round(v).toLocaleString("en-US")}`);
const daysAgo = (d: number | null) => (d == null ? null : d === 0 ? "today" : `${n(d)}d ago`);

/** The board's state for the whole page: its body, still on its first build, or unreadable. */
export type HealthState = { data: CustomerHealth | undefined; isError: boolean; computing: boolean };

/** features-service's badge, named and coloured here (same words as the admin board). */
const BADGE_LOOK = {
  green: { word: "Healthy", color: "var(--run)" },
  yellow: { word: "At risk", color: "var(--data-amber)" },
  red: { word: "Not active", color: "var(--data-rose)" },
} as const;

function Badge({ badge }: { badge: keyof typeof BADGE_LOOK }) {
  const look = BADGE_LOOK[badge];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: look.color }} aria-hidden="true" />
      {look.word}
    </span>
  );
}

/** features-service's account status token, capitalised for reading ("out_of_credit" -> "Out of credit"). */
const statusWord = (s: string) => (s.charAt(0).toUpperCase() + s.slice(1)).replace(/_/g, " ");

function RoiValue({ v }: { v: number | null }) {
  return <span style={roiIsGood(v) ? { color: "var(--run)" } : undefined}>{formatRoi(v)}</span>;
}

/** A cell fed by the health board: shimmer until it answers, a word when it cannot. */
function HealthCell({ health, org, children }: { health: HealthState; org: CustomerHealthOrg | null; children: (o: CustomerHealthOrg) => React.ReactNode }) {
  if (health.isError) return <span className="k-fg3 text-[12px]">not readable</span>;
  if (health.data === undefined) return <Shimmer className="ml-auto h-4 w-12" />;
  if (!org) return <Dash />;
  return <>{children(org)}</>;
}

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

export function AccountsView({ data, health }: { data: AbsorbedCosts; health: HealthState }) {
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
  const orgOf = useMemo(() => new Map((health.data?.orgs ?? []).map((o) => [o.orgId, o])), [health.data]);
  const brandsOf = useMemo(() => {
    const m = new Map<string, CustomerHealthBrand[]>();
    for (const b of health.data?.customers ?? []) m.set(b.orgId, [...(m.get(b.orgId) ?? []), b]);
    return m;
  }, [health.data]);

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
                  <th className={TH}>Health</th>
                  <th className={THR}>$ / day</th>
                  <th className={THR}>Balance</th>
                  <th className={THR}>
                    <RoiLabel />
                  </th>
                  <th className={`${THR} hidden lg:table-cell`}>Audience left</th>
                  <th className={`${TH} hidden md:table-cell`}>Last visit</th>
                  <th className={THR}>Paid to date</th>
                  <th className={`${TH} hidden xl:table-cell`}>Last payment</th>
                  <th className="w-8 pr-4" aria-hidden="true" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line-subtle)]">
                {rows.map((c, i) => {
                  const name = nameOf(c);
                  const org = orgOf.get(c.orgId) ?? null;
                  const brands = brandsOf.get(c.orgId) ?? [];
                  const one = brands.length === 1 ? brands[0] : null;
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
                      <td className={TD}>
                        <HealthCell health={health} org={org}>
                          {(o) => <Badge badge={o.healthBadge} />}
                        </HealthCell>
                      </td>
                      <td className={TDR}>
                        <HealthCell health={health} org={org}>
                          {(o) => (o.runningDailyBudgetUsd > 0 ? usdWhole(o.runningDailyBudgetUsd) : <Dash />)}
                        </HealthCell>
                      </td>
                      <td className={TDR}>
                        <HealthCell health={health} org={org}>
                          {(o) => (
                            <span className="inline-flex items-center justify-end gap-1.5">
                              {o.orgBalanceUsd == null ? <Dash /> : dollarsExact(o.orgBalanceUsd)}
                              {o.autoTopupEnabled && <span className="k-chip text-[11px]">Auto</span>}
                            </span>
                          )}
                        </HealthCell>
                      </td>
                      <td className={TDR}>
                        <HealthCell health={health} org={org}>
                          {() => (one ? <RoiValue v={one.currentEconomics.roiMultiple} /> : brands.length > 1 ? <span className="k-fg3 text-[12px]">{brands.length} brands</span> : <Dash />)}
                        </HealthCell>
                      </td>
                      <td className={`${TDR} hidden lg:table-cell`}>
                        <HealthCell health={health} org={org}>
                          {() =>
                            one && one.audiences.totalRemaining != null ? (
                              <>
                                {n(one.audiences.totalRemaining)}
                                {one.audiences.pctUsed != null && <span className="k-fg3"> · {Math.round(one.audiences.pctUsed)}% used</span>}
                              </>
                            ) : brands.length > 1 ? (
                              <span className="k-fg3 text-[12px]">{brands.length} brands</span>
                            ) : (
                              <Dash />
                            )
                          }
                        </HealthCell>
                      </td>
                      <td className={`${TD} k-mono k-fg2 hidden whitespace-nowrap text-[12px] md:table-cell`}>
                        <HealthCell health={health} org={org}>
                          {(o) => daysAgo(o.dashboardReturnFrequency?.daysSinceLastSeen ?? null) ?? <Dash />}
                        </HealthCell>
                      </td>
                      <td className={`${TDR} font-medium`}>{usdExact(c.cashPaidCents) ?? <Dash />}</td>
                      <td className={`${TD} k-mono k-fg2 hidden whitespace-nowrap text-[12px] xl:table-cell`}>
                        <LastPayment c={c} />
                      </td>
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
            {health.data?.freshness && ` Health as of ${new Date(health.data.freshness.computedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}, rebuilt every ${health.data.freshness.refreshEveryMinutes} min.`}
          </span>
          <span className="hidden sm:inline">
            <kbd className="k-kbd">J</kbd> <kbd className="k-kbd">K</kbd> to move, <kbd className="k-kbd">Enter</kbd> to open
          </span>
        </div>
      </div>
      {openRow && (
        <AccountPanel c={openRow} months={data.months} health={health} org={orgOf.get(openRow.orgId) ?? null} brands={brandsOf.get(openRow.orgId) ?? []} onClose={() => setOpen(null)} />
      )}
    </>
  );
}

// ─── Right panel ───────────────────────────────────────────────────────────

function AccountPanel({
  c,
  months,
  health,
  org,
  brands,
  onClose,
}: {
  c: AbsorbedCustomer;
  months: string[];
  health: HealthState;
  org: CustomerHealthOrg | null;
  brands: CustomerHealthBrand[];
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
              {org && <Badge badge={org.healthBadge} />}
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

        <HealthSection health={health} org={org} brands={brands} />

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
      </div>
    </aside>,
    host,
  );
}

// ─── Health detail (features-service board) ────────────────────────────────

function Facts({ rows }: { rows: [React.ReactNode, React.ReactNode][] }) {
  return (
    <dl className="k-card divide-y divide-[var(--line-subtle)]">
      {rows.map(([label, v], i) => (
        <div key={i} className="flex min-h-10 items-center justify-between gap-3 px-3 py-2 text-[13px]">
          <dt className="k-fg2">{label}</dt>
          <dd className="min-w-0 truncate text-right tabular-nums">{v ?? <Dash />}</dd>
        </div>
      ))}
    </dl>
  );
}

function HealthSection({ health, org, brands }: { health: HealthState; org: CustomerHealthOrg | null; brands: CustomerHealthBrand[] }) {
  if (health.isError) return <EmptyNote>Could not read the account health board.</EmptyNote>;
  if (health.computing) return <EmptyNote>Account health is being computed. Back in a few minutes.</EmptyNote>;
  if (health.data === undefined) return <Shimmer className="h-24 w-full" />;
  if (!org) return <EmptyNote>Not on the account health board.</EmptyNote>;
  const visits = org.dashboardReturnFrequency;
  return (
    <>
      <section>
        <p className="k-label mb-2">Account health</p>
        <Facts
          rows={[
            ["Running", org.runningDailyBudgetUsd > 0 ? `${usdWhole(org.runningDailyBudgetUsd)}/day` : null],
            ["Budget set", org.configuredDailyBudgetUsd > 0 ? `${usdWhole(org.configuredDailyBudgetUsd)}/day` : null],
            ["Balance", org.orgBalanceUsd == null ? null : `${dollarsExact(org.orgBalanceUsd)}${org.autoTopupEnabled ? " · auto reload on" : ""}`],
            ["Last active day", org.lastActiveDay ? dayLabel(org.lastActiveDay) : null],
            ["Dashboard visits", visits ? `${n(visits.sessions7d)} this week · ${n(visits.sessions30d)} in 30 days` : null],
            ["Last visit", visits?.lastSeen ? `${dayLabel(visits.lastSeen)} · ${daysAgo(visits.daysSinceLastSeen)}` : null],
          ]}
        />
      </section>
      {brands.map((b) => (
        <BrandHealth key={b.brandId} b={b} />
      ))}
    </>
  );
}

function BrandHealth({ b }: { b: CustomerHealthBrand }) {
  const e = b.currentEconomics;
  const budgets = b.notTrackedYet.budgetChangeHistory;
  const pauses = b.notTrackedYet.pauseHistory;
  const history = [
    ...(budgets ?? []).map((h) => ({ at: h.changedAt, what: h.dailyBudgetUsd > 0 ? `Budget set to ${usdWhole(h.dailyBudgetUsd)}/day` : "Budget set to $0" })),
    ...(pauses ?? []).map((h) => ({ at: h.transitionedAt, what: h.paused ? "Paused" : "Resumed" })),
  ]
    .sort((x, y) => y.at.localeCompare(x.at))
    .slice(0, 6);
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="k-label truncate">{b.brandName ?? b.brandDomain ?? "Brand"}</p>
        <span className="flex shrink-0 items-center gap-2 text-[12px]">
          <span className="k-chip text-[11px]">{statusWord(b.status)}</span>
          <Badge badge={b.health.badge} />
        </span>
      </div>
      <Facts
        rows={[
          [<RoiLabel key="roi" />, <RoiValue key="v" v={e.roiMultiple} />],
          ["Cost per client", e.currentCacUsd == null ? null : `${dollarsExact(e.currentCacUsd)}${b.breakevenCacUsd != null ? ` · break-even ${dollarsExact(b.breakevenCacUsd)}` : ""}`],
          // The brand's whole history (a brand moved between orgs keeps it); the org's own campaign spend is billing's, above.
          ["Spent on this brand", e.committedSpendUsd == null ? null : dollarsExact(e.committedSpendUsd)],
          [
            "Audience left",
            b.audiences.totalRemaining == null
              ? null
              : `${n(b.audiences.totalRemaining)} of ${b.audiences.totalSize == null ? "?" : n(b.audiences.totalSize)} · ${b.audiences.count} list${b.audiences.count === 1 ? "" : "s"}`,
          ],
          ["Best audience", b.bestAudience ? b.bestAudience.name : null],
          ["Best workflow", b.bestWorkflow ? (b.bestWorkflow.name ?? b.bestWorkflow.workflowDynastySlug) : null],
        ]}
      />
      {history.length > 0 && (
        <ul className="k-card mt-2 divide-y divide-[var(--line-subtle)]">
          {history.map((h) => (
            <li key={`${h.at}-${h.what}`} className="flex h-9 items-center justify-between gap-3 px-3 text-[13px]">
              <span>{h.what}</span>
              <span className="k-mono k-fg2 text-[12px]">{dayLabel(h.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
