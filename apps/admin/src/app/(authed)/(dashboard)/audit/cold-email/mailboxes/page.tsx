"use client";

import { useMemo, useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getOpsMailboxes, type OpsMailboxRow, type OpsMailboxes } from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import {
  AsOf,
  DeliveryCell,
  LifecyclePill,
  PageHeader,
  PaidToDate,
  PanelGroup,
  PanelRow,
  RampLine,
  Section,
  SlideOver,
  SortHeader,
  StatCard,
  VolumeCell,
  num,
  utc,
  utcDay,
} from "@/components/cold-email/primitives";
import { formatCents, lifecycleLabel, PAID_TO_DATE_NOTE, poolLabel } from "@/lib/instantly-ops";

/**
 * Cold email — Mailboxes.
 *
 * One row per REAL mailbox (its login), never one per alias: a Gandi relay
 * mailbox carries five addresses and is ONE subscription we pay for, so five
 * rows would count it five times and make the cost column a lie.
 *
 * Everything here is served by `/instantly/ops/mailboxes`: vendor, pool,
 * subscription, where the credential came from, the four dates (vendor-created,
 * pre-warmed, imported, absent-since), the addresses with their lifecycle, the
 * cap with its ramp projection, today's warmup budget, delivery evidence and its
 * expiry, 7- and 30-day volume, and the cost.
 */

type SortKey =
  | "login"
  | "pool"
  | "subscription"
  | "addresses"
  | "sustained"
  | "cap"
  | "delivery"
  | "volume"
  | "monthly"
  | "paid";

const COLUMNS: { key: SortKey; label: string; align?: "right"; hint?: string }[] = [
  { key: "login", label: "Mailbox" },
  { key: "pool", label: "Pool / vendor" },
  { key: "subscription", label: "Subscription", hint: "What we bought: a standard mailbox, a pre-warmed one, or a done-for-you seat." },
  { key: "addresses", label: "Addresses", align: "right", hint: "The sending addresses this ONE mailbox carries. A relay mailbox carries several aliases." },
  { key: "sustained", label: "Sustained", align: "right", hint: "The daily volume this mailbox has actually sustained. The producer's own statistic over its send window." },
  { key: "cap", label: "Cap today", align: "right", hint: "The ramp-aware daily cap send selection compares today's load against, and where the ramp takes it." },
  { key: "delivery", label: "Delivery" },
  { key: "volume", label: "Volume 7d", align: "right" },
  { key: "monthly", label: "Monthly", align: "right" },
  { key: "paid", label: "Paid to date", align: "right", hint: PAID_TO_DATE_NOTE },
];

function compare(a: OpsMailboxRow, b: OpsMailboxRow, key: SortKey, dir: "asc" | "desc"): number {
  const sign = dir === "asc" ? 1 : -1;
  const numeric = (av: number | null, bv: number | null) => {
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return (av - bv) * sign;
  };
  const text = (av: string | null, bv: string | null) => (av ?? "").localeCompare(bv ?? "") * sign;
  switch (key) {
    case "login":
      return text(a.login, b.login);
    case "pool":
      return text(a.poolType ?? a.provider, b.poolType ?? b.provider);
    case "subscription":
      return text(a.subscription, b.subscription);
    case "addresses":
      return numeric(a.addresses.length, b.addresses.length);
    case "sustained":
      return numeric(a.sustainedDaily, b.sustainedDaily);
    case "cap":
      return numeric(a.effectiveDailyCap, b.effectiveDailyCap);
    case "delivery":
      return numeric(a.delivery.inboxPct, b.delivery.inboxPct);
    case "volume":
      return numeric(a.volume7d.outreach, b.volume7d.outreach);
    case "monthly":
      return numeric(a.cost?.monthlyCents ?? null, b.cost?.monthlyCents ?? null);
    case "paid":
      return numeric(a.cost?.paidToDate?.cents ?? null, b.cost?.paidToDate?.cents ?? null);
  }
}

function MailboxPanel({ row, onClose }: { row: OpsMailboxRow; onClose: () => void }) {
  return (
    <SlideOver title={row.login} subtitle={row.domain} onClose={onClose}>
      <PanelGroup title="What it is">
        <PanelRow label="Vendor">{row.provider ?? "—"}</PanelRow>
        <PanelRow label="Pool">{row.poolType ? poolLabel(row.poolType) : "—"}</PanelRow>
        <PanelRow label="Subscription">{row.subscription ?? "—"}</PanelRow>
        <PanelRow label="Credential source">{row.credentialSource}</PanelRow>
      </PanelGroup>

      <PanelGroup title="Dates">
        <PanelRow label="Created at vendor">{utc(row.vendorCreatedAt)}</PanelRow>
        <PanelRow label="Pre-warmed since">{utc(row.vendorPrewarmedAt)}</PanelRow>
        <PanelRow label="Imported">{utc(row.importedAt)}</PanelRow>
        <PanelRow label="Absent from vendor since">{utc(row.absentSince)}</PanelRow>
        <PanelRow label="Last synced">{utc(row.syncedAt)}</PanelRow>
      </PanelGroup>

      <PanelGroup title={`Addresses (${num(row.addresses.length)})`}>
        {row.addresses.length === 0 ? (
          <p className="py-1 text-sm text-gray-400">This mailbox carries no sending address.</p>
        ) : (
          row.addresses.map((a) => (
            <div key={a.email} className="border-b border-gray-50 py-2 last:border-0">
              <p className="break-all text-sm font-medium text-gray-900">{a.email}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <LifecyclePill status={a.lifecycleStatus} />
                {a.lifecycleReason && (
                  <span className="text-[10px] text-gray-400">{a.lifecycleReason}</span>
                )}
                {a.sendTransport && (
                  <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">
                    {a.sendTransport}
                  </span>
                )}
                <span className="text-[10px] tabular-nums text-gray-400">
                  limit {num(a.dailyLimit)}
                </span>
                {a.absentSince && (
                  <span className="text-[10px] text-amber-600">absent since {utcDay(a.absentSince)}</span>
                )}
              </div>
            </div>
          ))
        )}
      </PanelGroup>

      <PanelGroup title="Sending">
        <PanelRow label="Sustained daily">{num(row.sustainedDaily)}</PanelRow>
        <PanelRow label="Cap today">{num(row.effectiveDailyCap)}</PanelRow>
        <PanelRow label="Ramp">
          <RampLine projection={row.rampProjection} />
        </PanelRow>
        <PanelRow label="Warmup budget today">{num(row.warmupBudgetToday)}</PanelRow>
      </PanelGroup>

      <PanelGroup title="Delivery">
        <PanelRow label="Inbox placement">
          <DeliveryCell delivery={row.delivery} />
        </PanelRow>
        <PanelRow label="Tested">{utc(row.delivery.testedAt)}</PanelRow>
        {/* The date the evidence goes stale is what schedules the next seed test —
            an operator reads it to know when this mailbox falls out of production. */}
        <PanelRow label="Evidence expires">{utc(row.evidenceExpiresAt)}</PanelRow>
        <PanelRow label="Measured accounts">{num(row.delivery.measuredAccounts)}</PanelRow>
      </PanelGroup>

      <PanelGroup title="Volume">
        <PanelRow label="Last 7 days">
          <VolumeCell volume={row.volume7d} />
        </PanelRow>
        <PanelRow label="Last 30 days">
          <VolumeCell volume={row.volume30d} />
        </PanelRow>
      </PanelGroup>

      <PanelGroup title="Cost">
        <PanelRow label="Monthly">
          {formatCents(row.cost?.monthlyCents ?? null, row.cost?.currency ?? null) ?? "—"}
        </PanelRow>
        <PanelRow label="Source">{row.cost?.source ?? "—"}</PanelRow>
        <PanelRow label="Paid to date">
          <PaidToDate paid={row.cost?.paidToDate ?? null} />
        </PanelRow>
        <p className="pt-1 text-[10px] text-amber-600">{PAID_TO_DATE_NOTE}</p>
      </PanelGroup>
    </SlideOver>
  );
}

export default function ColdEmailMailboxesPage() {
  const { data, isPending, isError, error } = useAuthQuery<OpsMailboxes>(
    ["opsMailboxes"],
    () => getOpsMailboxes(),
    pollOptionsSlower,
  );

  const [sortKey, setSortKey] = useState<SortKey>("cap");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [query, setQuery] = useState("");
  const [pool, setPool] = useState<string>("");
  const [selected, setSelected] = useState<OpsMailboxRow | null>(null);

  const mailboxes = useMemo(() => data?.mailboxes ?? [], [data]);

  const pools = useMemo(() => {
    const seen = new Map<string, number>();
    for (const m of mailboxes) {
      const key = m.poolType ?? "unknown";
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1]);
  }, [mailboxes]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mailboxes
      .filter((m) => !pool || (m.poolType ?? "unknown") === pool)
      .filter(
        (m) =>
          !q ||
          m.login.toLowerCase().includes(q) ||
          m.domain.toLowerCase().includes(q) ||
          (m.provider ?? "").toLowerCase().includes(q),
      )
      .slice()
      .sort((a, b) => compare(a, b, sortKey, sortDir));
  }, [mailboxes, pool, query, sortKey, sortDir]);

  const monthlyTotal = mailboxes.reduce((s, m) => s + (m.cost?.monthlyCents ?? 0), 0);
  const unpriced = mailboxes.filter((m) => (m.cost?.monthlyCents ?? null) === null).length;
  const addressCount = mailboxes.reduce((s, m) => s + m.addresses.length, 0);

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
        title="Cold email: mailboxes"
        blurb="One row per real mailbox, with the addresses it carries nested inside it. A relay mailbox holding five aliases is ONE subscription, so it is one row here, not five."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Mailboxes" value={num(mailboxes.length)} pending={isPending} />
        <StatCard
          label="Addresses"
          value={num(addressCount)}
          sub="carried by those mailboxes"
          pending={isPending}
        />
        <StatCard
          label="Monthly cost"
          value={formatCents(monthlyTotal, "USD") ?? "—"}
          sub={unpriced > 0 ? `${num(unpriced)} with no rate on record` : "every mailbox priced"}
          pending={isPending}
        />
        <StatCard
          label="Outreach 7d"
          value={num(mailboxes.reduce((s, m) => s + m.volume7d.outreach, 0))}
          pending={isPending}
        />
      </div>

      <Section
        title="Every mailbox"
        blurb="Sort any column, filter by pool, login, domain or vendor. Open a row for the dates, the aliases, the ramp and the cost."
        isPending={isPending}
        isError={isError}
        error={error}
        empty={data && mailboxes.length === 0 ? "No mailboxes found." : null}
        action={
          !isPending && !isError ? (
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by login, domain or vendor…"
              className="w-full max-w-xs rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          ) : undefined
        }
      >
        {data && mailboxes.length > 0 && (
          <>
            <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-2">
              <button
                type="button"
                onClick={() => setPool("")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  pool === "" ? "bg-indigo-50 text-indigo-700" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                All
                <span className="ml-1.5 tabular-nums text-[10px] text-gray-400">
                  {num(mailboxes.length)}
                </span>
              </button>
              {pools.map(([key, count]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPool(key)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                    pool === key ? "bg-indigo-50 text-indigo-700" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {poolLabel(key)}
                  <span className="ml-1.5 tabular-nums text-[10px] text-gray-400">{num(count)}</span>
                </button>
              ))}
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="min-w-[1100px] w-full text-sm">
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
                        No mailboxes match.
                      </td>
                    </tr>
                  ) : (
                    rows.map((m) => (
                      <tr
                        key={m.login}
                        onClick={() => setSelected(m)}
                        className="cursor-pointer border-b border-gray-100 last:border-0 align-top hover:bg-gray-50"
                      >
                        <td className="py-2.5 px-2">
                          <span className="break-all font-medium text-gray-900">{m.login}</span>
                          <span className="block text-[10px] text-gray-400">{m.domain}</span>
                        </td>
                        <td className="py-2.5 px-2 text-gray-700">
                          {m.poolType ? poolLabel(m.poolType) : <span className="text-gray-400">—</span>}
                          <span className="block text-[10px] text-gray-400">{m.provider ?? "vendor unknown"}</span>
                        </td>
                        <td className="py-2.5 px-2 text-gray-700">
                          {m.subscription ?? <span className="text-gray-400">—</span>}
                          <span className="block text-[10px] text-gray-400">{m.credentialSource}</span>
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <span className="tabular-nums text-gray-700">{num(m.addresses.length)}</span>
                          <span className="mt-0.5 flex flex-col items-end">
                            {Object.entries(m.addressesByLifecycle)
                              .sort((a, b) => b[1] - a[1])
                              .map(([status, count]) => (
                                <span key={status} className="text-[10px] tabular-nums text-gray-400">
                                  {num(count)} {lifecycleLabel(status).toLowerCase()}
                                </span>
                              ))}
                          </span>
                        </td>
                        <td className="py-2.5 px-2 text-right tabular-nums text-gray-700">
                          {num(m.sustainedDaily)}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <span className="block tabular-nums font-medium text-gray-900">
                            {num(m.effectiveDailyCap)}
                          </span>
                          <span className="mt-0.5 flex justify-end">
                            <RampLine projection={m.rampProjection} />
                          </span>
                        </td>
                        <td className="py-2.5 px-2">
                          <DeliveryCell delivery={m.delivery} />
                          {m.evidenceExpiresAt && (
                            <span className="mt-0.5 block text-[10px] text-gray-400">
                              expires {utcDay(m.evidenceExpiresAt)}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <VolumeCell volume={m.volume7d} />
                        </td>
                        <td className="py-2.5 px-2 text-right tabular-nums text-gray-700">
                          {formatCents(m.cost?.monthlyCents ?? null, m.cost?.currency ?? null) ?? (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          <PaidToDate paid={m.cost?.paidToDate ?? null} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <AsOf iso={data.asOf} />
              <p className="mt-1 text-xs text-amber-600">{PAID_TO_DATE_NOTE}</p>
            </div>
          </>
        )}
      </Section>

      {selected && <MailboxPanel row={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
