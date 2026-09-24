"use client";

import { useMemo, useState } from "react";
import { FX_UNAVAILABLE_NOTE, fxRateLine } from "@/lib/estate-usd";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getInstantlyAccountHealth, getInstantlyInfraDomains } from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { ProviderLogo, VendorLogo } from "@/components/audit/provider-logo";
import { lifecycleLabel } from "@/lib/instantly-ops";
import {
  buildDomainHealthRows,
  DOMAIN_TABS,
  type AccountSendState,
  type DomainAccount,
  type DomainHealthRow,
  type DomainHealthState,
} from "@/lib/domain-health";

/**
 * "Sending domains" — the delete list.
 *
 * A domain is the unit that bills and the unit you cancel, so this card answers
 * a question the per-account table below it cannot: which sending domains are
 * spent, what each one costs per month, and what breaks if it goes.
 *
 * It reads the SAME `["instantlyAccountHealth"]` query the accounts table uses,
 * so the two share one poll and can never disagree about the underlying rows.
 */

// One colour per verdict, used for the dot, the account chip and the domain
// pill alike. Colour is keyed on the VERDICT instantly-service stated, never on
// a raw score — a red chip beside a "Sending" verdict would be the same row
// contradicting itself, and grading on the scores is exactly what made the old
// card offer 48 of 68 domains for deletion. All tints are in the `html.dark`
// remap's closed set.
const ACCOUNT_TONE: Record<AccountSendState, string> = {
  sending: "bg-emerald-500",
  recovering: "bg-amber-500",
  stopped: "bg-red-500",
  held: "bg-sky-500",
  ungraded: "bg-gray-300",
};

const ACCOUNT_WORD: Record<AccountSendState, string> = {
  sending: "Sending",
  recovering: "Recovering",
  stopped: "Stopped by Instantly",
  held: "Held by us",
  ungraded: "Not graded",
};

const DOMAIN_PILL: Record<DomainHealthState, string> = {
  "to-delete-now": "border-red-200 bg-red-50 text-red-700",
  "to-delete-soon": "border-amber-200 bg-amber-50 text-amber-700",
  recovering: "border-amber-200 bg-amber-50 text-amber-700",
  mixed: "border-orange-200 bg-orange-50 text-orange-700",
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-700",
  held: "border-sky-200 bg-sky-50 text-sky-700",
  "not-graded": "border-gray-200 bg-gray-50 text-gray-600",
};

const DOMAIN_WORD: Record<DomainHealthState, string> = {
  "to-delete-now": "To delete now",
  "to-delete-soon": "To delete soon",
  recovering: "Recovering",
  mixed: "Mix state",
  healthy: "Sending",
  held: "Held by us",
  "not-graded": "Not graded",
};

/**
 * Money in USD. Every figure on this card is the served USD twin (euros were
 * converted by instantly-service at the rate stated under the card), so the
 * whole estate is one currency.
 */
function money(cents: number): string {
  const amount = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** `2027-02-03T…` → `3 Feb 2027`. */
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * One mailbox, in one cell: who it is, what instantly-service says it is doing,
 * and what it still owes.
 *
 * The two scores are on the HOVER, not in the cell, and that is the whole point
 * of this rewrite: they are Instantly's inputs to a decision the service has
 * already made, and printing them beside the verdict invited a reader to
 * re-grade a mailbox on numbers that legitimately read low for a mailbox doing
 * fine (promotion resets the health score toward 0, and being under the
 * delivery bar is what recovery MEANS).
 */
function AccountCell({ account }: { account: DomainAccount }) {
  return (
    <div
      className="flex flex-col gap-0.5"
      title={`${account.email}\n${ACCOUNT_WORD[account.state]}${
        account.lifecycleReason ? ` (${account.lifecycleReason})` : ""
      }\nHealth ${account.warmupScore ?? "—"} · Inbox ${
        account.inboxPct ?? "—"
      }% · ${account.queueSize} queued`}
    >
      <span className="flex items-center gap-1.5">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${ACCOUNT_TONE[account.state]}`}
        />
        <span className="truncate text-xs font-medium text-gray-800">
          {account.localPart}
        </span>
      </span>
      <span className="pl-3 text-[11px] text-gray-500">
        {account.lifecycleStatus ? lifecycleLabel(account.lifecycleStatus) : "no lifecycle"}
        {account.queueSize > 0 ? ` · ${account.queueSize.toLocaleString("en-US")} queued` : ""}
      </span>
    </div>
  );
}

export function DomainHealthCard() {
  const { data, isPending, isError, error } = useAuthQuery(
    ["instantlyAccountHealth"],
    () => getInstantlyAccountHealth(),
    pollOptionsSlower,
  );

  // The inventory underneath the accounts: who sells us each domain and what it
  // costs. Queried separately so a stumble here degrades the money column to a
  // dash instead of blanking the delete list, which still grades fine without
  // it — the grading reads health, never cost.
  const { data: infra } = useAuthQuery(
    ["instantlyInfraDomains"],
    () => getInstantlyInfraDomains(),
    pollOptionsSlower,
  );

  const rows = useMemo(
    () => buildDomainHealthRows(data?.accounts ?? [], infra?.domains ?? []),
    [data, infra],
  );

  // Only tabs with rows are offered — "Held by us" and "Not graded" are states
  // a fleet may simply not be in, and an empty tab advertises one it is not.
  const tabs = useMemo(() => {
    const counts = new Map<DomainHealthState, number>();
    for (const row of rows) counts.set(row.state, (counts.get(row.state) ?? 0) + 1);
    return DOMAIN_TABS.filter((t) => (counts.get(t.key) ?? 0) > 0).map((t) => ({
      ...t,
      count: counts.get(t.key) ?? 0,
    }));
  }, [rows]);

  const [tab, setTab] = useState<DomainHealthState | null>(null);
  const activeTab =
    tab && tabs.some((t) => t.key === tab) ? tab : tabs[0]?.key ?? null;

  const visible = rows.filter((r) => r.state === activeTab);

  // One column per mailbox slot, sized to the widest domain in the ACTIVE tab so
  // a tab of 2-mailbox domains does not render three empty columns.
  const slotCount = visible.reduce((max, r) => Math.max(max, r.accounts.length), 0);

  // What the visible tab costs per month — the number the tab exists to act on.
  // Null when any domain's cost is unstateable, rather than a partial sum
  // presented as the total.
  // Only the RECURRING half is totalled: it is the money that stops the day you
  // cancel. Renewals are already paid, so adding them here would advertise a
  // saving the tab does not actually deliver this month.
  //
  // In USD, off the served twins, so a tab mixing euro and dollar vendors
  // totals like any other. A domain priced with no USD twin (no rate on record)
  // makes the total unstateable rather than partial.
  const tabCost = (() => {
    let cents = 0;
    for (const row of visible) {
      if (!row.cost || row.cost.unconvertible) return null;
      if (row.cost.recurringCents !== null) cents += row.cost.recurringCents;
    }
    return cents;
  })();

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Sending domains</h2>
          <p className="mt-1 text-xs text-gray-500">
            The delete list. A domain is what bills and what you cancel, so it
            reads the verdict instantly-service already made per mailbox: only a
            mailbox Instantly STOPPED puts a domain on the list, a mailbox being
            warmed back up keeps it off, and a domain we pinned out of cold email
            on purpose is never a candidate at all. Hover a cell for its reason.
          </p>
        </div>
        {!isPending && !isError && rows.length > 0 && (
          <span className="shrink-0 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600">
            {rows.length.toLocaleString("en-US")} domain
            {rows.length === 1 ? "" : "s"}
            {tabCost !== null && visible.length > 0
              ? ` · ${money(tabCost)}/mo recurring in this tab`
              : ""}
          </span>
        )}
      </div>
      {!isPending && !isError && infra && (
        // The rate the dollar columns were converted at, read off the served
        // `fx`, never a constant. No rate: say the dollar figures are unavailable.
        <p className="mt-2 text-[11px] text-gray-400">
          {infra.fx ? `${fxRateLine(infra.fx)}.` : FX_UNAVAILABLE_NOTE}
        </p>
      )}

      <div className="mt-4">
        {isError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-medium text-red-700">
              Couldn&apos;t load sending domains.
            </p>
            <p className="mt-1 text-xs text-red-500">
              {error?.message ?? "Unknown error"}
            </p>
          </div>
        ) : isPending ? (
          <Skeleton className="h-64 w-full rounded" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500">No sending domains found.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-1 border-b border-gray-200">
              {tabs.map((t) => {
                const active = t.key === activeTab;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={`-mb-px rounded-t-md border-b-2 px-3 py-2 text-sm font-medium ${
                      active
                        ? "border-indigo-500 text-indigo-700"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {t.label}
                    <span
                      className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                        active
                          ? "bg-indigo-100 text-indigo-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {t.count.toLocaleString("en-US")}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="min-w-[1024px] w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3 font-medium">Domain</th>
                    <th
                      className="py-2 px-3 text-right font-medium"
                      title="The mailbox subscription. Cancel the domain and this stops billing straight away. Measured from what the vendor actually charges us, not a list price."
                    >
                      Stops now
                    </th>
                    <th
                      className="py-2 px-3 text-right font-medium"
                      title="The domain registration, already paid until the date shown. Deleting today refunds nothing — it avoids the next renewal, on that date."
                    >
                      Avoided at renewal
                    </th>
                    {Array.from({ length: slotCount }, (_, i) => (
                      <th key={i} className="py-2 px-3 font-medium">
                        Account {i + 1}
                      </th>
                    ))}
                    <th className="py-2 pl-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row: DomainHealthRow) => (
                    <tr
                      key={row.domain}
                      className="border-b border-gray-100 last:border-0 align-top"
                    >
                      <td className="py-3 pr-3">
                        <span className="flex items-center gap-1.5">
                          {row.vendors.map((v) => (
                            <VendorLogo key={v} provider={v} />
                          ))}
                          {row.providerTypes.map((type, i) => (
                            <ProviderLogo key={`${type ?? "unknown"}-${i}`} type={type} />
                          ))}
                          <span className="font-medium text-gray-900">
                            {row.domain}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-[11px] text-gray-400">
                          {row.accounts.length} mailbox
                          {row.accounts.length === 1 ? "" : "es"}
                          {row.vendors.length > 0 ? ` · ${row.vendors.join(" + ")}` : ""}
                          {row.cost?.source ? ` · ${row.cost.source}` : ""}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-gray-700">
                        {row.cost?.unconvertible ? (
                          <span className="text-amber-600">no USD rate</span>
                        ) : row.cost?.recurringCents == null ? (
                          <span
                            className="text-gray-400"
                            title={
                              row.cost
                                ? "Nothing recurring on this domain — its mailboxes cost nothing."
                                : "No vendor prices this domain, so we cannot state a saving."
                            }
                          >
                            —
                          </span>
                        ) : (
                          `${money(row.cost.recurringCents)}/mo`
                        )}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-gray-700">
                        {row.cost?.unconvertible ? (
                          <span className="text-amber-600">no USD rate</span>
                        ) : row.cost?.renewalCents == null ? (
                          <span className="text-gray-400">—</span>
                        ) : (
                          <>
                            {money(row.cost.renewalCents)}
                            <span className="mt-0.5 block text-[11px] font-normal text-gray-400">
                              {row.cost.renewalAt
                                ? shortDate(row.cost.renewalAt)
                                : "no date"}
                              {row.autorenew === false ? " · no autorenew" : ""}
                            </span>
                          </>
                        )}
                      </td>
                      {Array.from({ length: slotCount }, (_, i) => {
                        const account = row.accounts[i];
                        return (
                          <td key={i} className="py-3 px-3">
                            {account ? (
                              <AccountCell account={account} />
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-3 pl-3">
                        <span
                          className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${DOMAIN_PILL[row.state]}`}
                        >
                          {DOMAIN_WORD[row.state]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-gray-400">
                Each account cell reads the lifecycle instantly-service assigned
                the mailbox, and the emails still queued to it; the raw health
                and inbox scores are on the hover, because they are the inputs to
                that verdict rather than a second opinion on it. The two money
                columns are measured from what
                the vendors actually charge us, not assumed from the mailbox
                provider: <b>Stops now</b> is the mailbox subscription, which
                ends the day you cancel, while <b>Avoided at renewal</b> is the
                registration, already paid until the date shown. A dash means no
                vendor prices that domain — never that it is free.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
