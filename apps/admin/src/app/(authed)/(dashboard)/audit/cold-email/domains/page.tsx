"use client";

import { useMemo, useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getOpsDomains, type OpsDomainRow, type OpsDomains } from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { DomainHealthCard } from "@/components/audit/domain-health-card";
import {
  AsOf,
  DeliveryCell,
  DnsBadges,
  PageHeader,
  PaidToDate,
  PanelGroup,
  PanelRow,
  Section,
  SlideOver,
  SortHeader,
  StatCard,
  VolumeCell,
  num,
  utc,
  utcDay,
} from "@/components/cold-email/primitives";
import {
  dnsBadges,
  dnsErrorCount,
  formatCents,
  lifecycleLabel,
  PAID_TO_DATE_NOTE,
} from "@/lib/instantly-ops";

/**
 * Cold email — Domains.
 *
 * A domain is the unit that BILLS and the unit you CANCEL, so it is graded here
 * first: what it is, who sold it, when it renews, what it publishes in DNS, how
 * it delivers, what it sent, and what it costs.
 *
 * The delete list (to-delete-now / soon / mixed / healthy / not-graded) is the
 * SAME `DomainHealthCard` the old page carried — that verdict lives in
 * `lib/domain-health.ts` and is unchanged.
 */

type SortKey =
  | "domain"
  | "provider"
  | "expiresAt"
  | "mailboxes"
  | "addresses"
  | "delivery"
  | "sentLast30d"
  | "monthly"
  | "paid";

const COLUMNS: { key: SortKey; label: string; align?: "right"; hint?: string }[] = [
  { key: "domain", label: "Domain" },
  { key: "provider", label: "Vendor" },
  { key: "expiresAt", label: "Renewal", hint: "When the registration expires, and whether it auto-renews." },
  { key: "mailboxes", label: "Mailboxes", align: "right", hint: "Real mailboxes we hold on this domain, against what the vendor reports." },
  { key: "addresses", label: "Addresses", align: "right" },
  { key: "delivery", label: "Delivery" },
  { key: "sentLast30d", label: "Sent 30d", align: "right" },
  { key: "monthly", label: "Monthly", align: "right", hint: "What this domain costs per month, from the vendor rate card." },
  {
    key: "paid",
    label: "Paid to date",
    align: "right",
    hint: PAID_TO_DATE_NOTE,
  },
];

function costMonthly(r: OpsDomainRow): number | null {
  return r.cost.monthlyCents;
}

function compare(a: OpsDomainRow, b: OpsDomainRow, key: SortKey, dir: "asc" | "desc"): number {
  const sign = dir === "asc" ? 1 : -1;
  const numeric = (av: number | null, bv: number | null) => {
    if (av === null && bv === null) return 0;
    if (av === null) return 1; // nulls always last, whichever direction
    if (bv === null) return -1;
    return (av - bv) * sign;
  };
  switch (key) {
    case "domain":
      return a.domain.localeCompare(b.domain) * sign;
    case "provider":
      return (a.provider ?? "").localeCompare(b.provider ?? "") * sign;
    case "expiresAt": {
      const av = a.expiresAt ? Date.parse(a.expiresAt) : null;
      const bv = b.expiresAt ? Date.parse(b.expiresAt) : null;
      return numeric(av, bv);
    }
    case "mailboxes":
      return numeric(a.mailboxes, b.mailboxes);
    case "addresses":
      return numeric(a.addresses.total, b.addresses.total);
    case "delivery":
      return numeric(a.delivery.inboxPct, b.delivery.inboxPct);
    case "sentLast30d":
      return numeric(a.sentLast30d, b.sentLast30d);
    case "monthly":
      return numeric(costMonthly(a), costMonthly(b));
    case "paid":
      return numeric(a.cost.paidToDate?.cents ?? null, b.cost.paidToDate?.cents ?? null);
  }
}

function DomainPanel({ row, onClose }: { row: OpsDomainRow; onClose: () => void }) {
  // A domain the sweep never probed has no records to show and none to grade.
  const badges = row.dns ? dnsBadges(row.dns) : [];
  const errors = row.dns ? Object.entries(row.dns.errors) : [];
  return (
    <SlideOver title={row.domain} subtitle={row.provider ?? "vendor unknown"} onClose={onClose}>
      <PanelGroup title="Registration">
        <PanelRow label="Vendor">{row.provider ?? "—"}</PanelRow>
        <PanelRow label="Role">{row.role ?? "—"}</PanelRow>
        <PanelRow label="Status">{row.status ?? "—"}</PanelRow>
        <PanelRow label="Purchased">{utc(row.purchasedAt)}</PanelRow>
        <PanelRow label="Expires">{utc(row.expiresAt)}</PanelRow>
        <PanelRow label="Auto-renew">
          {row.autorenew === null ? "—" : row.autorenew ? "yes" : "no"}
        </PanelRow>
        <PanelRow label="Deletion scheduled">
          {row.deletionScheduled === null ? "—" : row.deletionScheduled ? "yes" : "no"}
        </PanelRow>
        <PanelRow label="Cancelled">{utc(row.cancelledAt)}</PanelRow>
        <PanelRow label="Absent from vendor since">{utc(row.absentSince)}</PanelRow>
      </PanelGroup>

      <PanelGroup title="Cost">
        <PanelRow label="Monthly">{formatCents(row.cost.monthlyCents, row.cost.currency) ?? "—"}</PanelRow>
        <PanelRow label="Source">{row.cost.source ?? "—"}</PanelRow>
        <PanelRow label="Per email">
          {row.cost.perEmailCents === null ? "—" : `${row.cost.perEmailCents.toFixed(3)}¢`}
        </PanelRow>
        {/* Two different answers: one stops the moment you cancel, the other is
            already paid and is only avoided at the renewal date. */}
        <PanelRow label="Stops on cancel (recurring)">
          {formatCents(row.cost.recurringMonthlyCents, row.cost.currency) ?? "—"}
        </PanelRow>
        <PanelRow label="Avoided at renewal">
          {formatCents(row.cost.renewalCents, row.cost.currency) ?? "—"}
        </PanelRow>
        <PanelRow label="Renews on">{utcDay(row.cost.renewalAt)}</PanelRow>
        <PanelRow label="Paid to date">
          <PaidToDate paid={row.cost.paidToDate} />
        </PanelRow>
        <p className="pt-1 text-[10px] text-amber-600">{PAID_TO_DATE_NOTE}</p>
      </PanelGroup>

      <PanelGroup title="DNS">
        <div className="flex flex-wrap gap-1 pb-2">
          <DnsBadges dns={row.dns} />
        </div>
        {/* Never probed: say so once. Printing dashes for every record would read
            as "we looked and found nothing", which is the opposite of true. */}
        {row.dns === null ? (
          <p className="py-1 text-xs text-gray-500">
            This domain has never been DNS-probed, so nothing is known about its records. The sweep
            covers the domains we own or send from.
          </p>
        ) : (
          <>
            {badges.map((b) => (
              <PanelRow key={b.label} label={b.label}>
                <span className="break-all font-mono text-[11px] text-gray-600">{b.detail ?? "—"}</span>
              </PanelRow>
            ))}
            <PanelRow label="DMARC policy">{row.dns.dmarc.policy ?? "—"}</PanelRow>
            <PanelRow label="DMARC pct">
              {row.dns.dmarc.pct === null ? "—" : `${row.dns.dmarc.pct}%`}
            </PanelRow>
            <PanelRow label="DMARC rua">
              {row.dns.dmarc.rua.length ? row.dns.dmarc.rua.join(", ") : "—"}
            </PanelRow>
            <PanelRow label="SPF includes">
              {row.dns.spf.includes.length ? row.dns.spf.includes.join(", ") : "—"}
            </PanelRow>
          </>
        )}
        {/* An unread record is not an absent one, so a probe error is stated. */}
        {errors.length > 0 && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">
              {num(errors.length)} record{errors.length === 1 ? "" : "s"} could not be read
            </p>
            {errors.map(([record, message]) => (
              <p key={record} className="mt-0.5 break-all text-[11px] text-amber-700">
                {record}: {typeof message === "string" ? message : JSON.stringify(message)}
              </p>
            ))}
          </div>
        )}
      </PanelGroup>

      <PanelGroup title="Addresses">
        <PanelRow label="Total">{num(row.addresses.total)}</PanelRow>
        {Object.entries(row.addresses.byLifecycle)
          .sort((a, b) => b[1] - a[1])
          .map(([status, count]) => (
            <PanelRow key={status} label={`— ${lifecycleLabel(status)}`}>
              {num(count)}
            </PanelRow>
          ))}
        <PanelRow label="Mailboxes (ours)">{num(row.mailboxes)}</PanelRow>
        <PanelRow label="Mailboxes (vendor)">{num(row.vendorMailboxes)}</PanelRow>
      </PanelGroup>

      <PanelGroup title="Delivery">
        <PanelRow label="Inbox placement">
          <DeliveryCell delivery={row.delivery} />
        </PanelRow>
        <PanelRow label="Tested">{utc(row.delivery.testedAt)}</PanelRow>
        <PanelRow label="Measured accounts">{num(row.delivery.measuredAccounts)}</PanelRow>
      </PanelGroup>

      <PanelGroup title="Volume, last 30 days">
        <PanelRow label="Outreach">{num(row.volume30d.outreach)}</PanelRow>
        <PanelRow label="Warmup">{num(row.volume30d.warmup)}</PanelRow>
        <PanelRow label="Seed">{num(row.volume30d.seed)}</PanelRow>
        <PanelRow label="Replies in">{num(row.volume30d.repliesIn)}</PanelRow>
        <PanelRow label="Bounces in">{num(row.volume30d.bouncesIn)}</PanelRow>
        <PanelRow label="Bounce rate">
          {row.volume30d.bounceRatePerMille === null
            ? "—"
            : `${row.volume30d.bounceRatePerMille.toFixed(1)}‰`}
        </PanelRow>
      </PanelGroup>
    </SlideOver>
  );
}

export default function ColdEmailDomainsPage() {
  const { data, isPending, isError, error } = useAuthQuery<OpsDomains>(
    ["opsDomains"],
    () => getOpsDomains(),
    pollOptionsSlower,
  );

  const [sortKey, setSortKey] = useState<SortKey>("monthly");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<OpsDomainRow | null>(null);

  const domains = useMemo(() => data?.domains ?? [], [data]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return domains
      .filter((d) => !q || d.domain.toLowerCase().includes(q) || (d.provider ?? "").toLowerCase().includes(q))
      .slice()
      .sort((a, b) => compare(a, b, sortKey, sortDir));
  }, [domains, query, sortKey, sortDir]);

  // Display rollups over the rows the producer served — a count of what is on
  // screen, not a metric recomputed from parts.
  const monthlyTotal = domains.reduce((s, d) => s + (d.cost.monthlyCents ?? 0), 0);
  const unpriced = domains.filter((d) => d.cost.monthlyCents === null).length;
  // Counted over PROBED domains only. A domain nobody has looked at is not a
  // domain with a problem — it is a domain we know nothing about, so it is
  // stated separately rather than folded into either side.
  const dnsProblems = domains.filter(
    (d) => d.dns !== null && (dnsBadges(d.dns).some((b) => b.verdict !== "ok") || dnsErrorCount(d.dns) > 0),
  ).length;
  const dnsUnread = domains.filter((d) => d.dns === null).length;

  function onSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Cold email: domains"
        blurb="One row per domain we bought or send from: vendor, renewal, what it publishes in DNS, how it delivers, what it sent, and what it costs. A domain is the thing that bills and the thing you cancel."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Domains" value={num(domains.length)} pending={isPending} />
        <StatCard
          label="Monthly cost"
          value={formatCents(monthlyTotal, "USD") ?? "—"}
          sub={unpriced > 0 ? `${num(unpriced)} with no rate on record` : "every domain priced"}
          pending={isPending}
          hint="Sum of the per-domain monthly rate the vendor rate card states. A domain with no rate contributes nothing rather than a guessed one."
        />
        <StatCard
          label="DNS needs attention"
          value={num(dnsProblems)}
          sub={
            dnsUnread > 0
              ? `weak or missing record · ${num(dnsUnread)} never probed`
              : "weak or missing record"
          }
          pending={isPending}
          hint="Counted over the domains the sweep has probed. A domain it never looked at is stated separately, never graded."
        />
        <StatCard
          label="Sent last 30d"
          value={num(domains.reduce((s, d) => s + d.sentLast30d, 0))}
          pending={isPending}
        />
      </div>

      {/* The delete list, above the table: which domains are spent and what
          turning them off saves. Unchanged from the old page. */}
      <DomainHealthCard />

      <Section
        title="Every domain"
        blurb="Sort any column, filter by domain or vendor, open a row for the full DNS records, the cost split and the 30-day volume."
        isPending={isPending}
        isError={isError}
        error={error}
        empty={data && domains.length === 0 ? "No domains found." : null}
        action={
          !isPending && !isError ? (
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by domain or vendor…"
              className="w-full max-w-xs rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          ) : undefined
        }
      >
        {data && domains.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-[1020px] w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  {COLUMNS.map((c) => (
                    <SortHeader
                      key={c.key}
                      col={c.key}
                      label={c.label}
                      hint={c.hint}
                      align={c.align}
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={onSort}
                    />
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={COLUMNS.length} className="py-6 text-center text-sm text-gray-400">
                      No domains match.
                    </td>
                  </tr>
                ) : (
                  rows.map((d) => (
                    <tr
                      key={`${d.provider ?? "none"}:${d.domain}`}
                      onClick={() => setSelected(d)}
                      className="cursor-pointer border-b border-gray-100 last:border-0 align-top hover:bg-gray-50"
                    >
                      <td className="py-2.5 px-2">
                        <span className="font-medium text-gray-900">{d.domain}</span>
                        <span className="mt-0.5 block">
                          <DnsBadges dns={d.dns} />
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-gray-700">
                        {d.provider ?? <span className="text-gray-400">—</span>}
                        {d.role && <span className="block text-[10px] text-gray-400">{d.role}</span>}
                      </td>
                      <td className="py-2.5 px-2 text-gray-700">
                        {utcDay(d.expiresAt)}
                        <span className="block text-[10px] text-gray-400">
                          {d.autorenew === null ? "auto-renew unknown" : d.autorenew ? "auto-renews" : "no auto-renew"}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-gray-700">
                        {num(d.mailboxes)}
                        {d.vendorMailboxes !== d.mailboxes && (
                          <span className="block text-[10px] text-amber-600">
                            vendor says {num(d.vendorMailboxes)}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-gray-700">
                        {num(d.addresses.total)}
                      </td>
                      <td className="py-2.5 px-2">
                        <DeliveryCell delivery={d.delivery} />
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <VolumeCell volume={d.volume30d} />
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-gray-700">
                        {formatCents(d.cost.monthlyCents, d.cost.currency) ?? (
                          <span className="text-gray-400">—</span>
                        )}
                        {d.cost.perEmailCents !== null && (
                          <span className="block text-[10px] text-gray-400">
                            {d.cost.perEmailCents.toFixed(2)}¢ / email
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <PaidToDate paid={d.cost.paidToDate} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <AsOf iso={data.asOf} />
            <p className="mt-1 text-xs text-amber-600">{PAID_TO_DATE_NOTE}</p>
          </div>
        )}
      </Section>

      {selected && <DomainPanel row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
