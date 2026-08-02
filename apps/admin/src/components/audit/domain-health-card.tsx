"use client";

import { useMemo, useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getInstantlyAccountHealth } from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { ProviderLogo } from "@/components/audit/provider-logo";
import {
  buildDomainHealthRows,
  DOMAIN_TABS,
  HEALTH_BAR,
  MAILBOX_MONTHLY_USD,
  type AccountHealthState,
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
// pill alike. Colour is keyed on the VERDICT, never on the raw score band —
// a red chip beside a "Healthy" verdict would be the same row contradicting
// itself. All four tints are in the `html.dark` remap's closed set.
const ACCOUNT_TONE: Record<AccountHealthState, string> = {
  dead: "bg-red-500",
  dying: "bg-amber-500",
  healthy: "bg-emerald-500",
  ungraded: "bg-gray-300",
};

const ACCOUNT_WORD: Record<AccountHealthState, string> = {
  dead: "Dead",
  dying: "Dying",
  healthy: "Healthy",
  ungraded: "Not graded",
};

const DOMAIN_PILL: Record<DomainHealthState, string> = {
  "to-delete-now": "border-red-200 bg-red-50 text-red-700",
  "to-delete-soon": "border-amber-200 bg-amber-50 text-amber-700",
  mixed: "border-orange-200 bg-orange-50 text-orange-700",
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-700",
  "not-graded": "border-gray-200 bg-gray-50 text-gray-600",
};

const DOMAIN_WORD: Record<DomainHealthState, string> = {
  "to-delete-now": "To delete now",
  "to-delete-soon": "To delete soon",
  mixed: "Mix state",
  healthy: "Healthy",
  "not-graded": "Not graded",
};

function usd(amount: number): string {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** The assumed per-mailbox rates, spelled out so the cost column states its own basis. */
const RATE_NOTE = Object.entries(MAILBOX_MONTHLY_USD)
  .map(([type, rate]) => `${type} ${usd(rate)}`)
  .join(" · ");

/**
 * One mailbox, in one cell: who it is, whether it lives, both scores and what
 * it still owes. The scores are printed together because a mailbox needs BOTH
 * to clear the bar, so reading either alone answers the wrong question.
 */
function AccountCell({ account }: { account: DomainAccount }) {
  const scores =
    account.warmupScore === null || account.inboxPct === null
      ? "—"
      : `${Math.round(account.warmupScore)}/${Math.round(account.inboxPct)}`;
  return (
    <div
      className="flex flex-col gap-0.5"
      title={`${account.email}\n${ACCOUNT_WORD[account.state]}\nHealth ${
        account.warmupScore ?? "—"
      } · Inbox ${account.inboxPct ?? "—"}% · ${account.queueSize} queued`}
    >
      <span className="flex items-center gap-1.5">
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${ACCOUNT_TONE[account.state]}`}
        />
        <span className="truncate text-xs font-medium text-gray-800">
          {account.localPart}
        </span>
      </span>
      <span className="pl-3 text-[11px] tabular-nums text-gray-500">
        {scores} · {account.queueSize.toLocaleString("en-US")}
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

  const rows = useMemo(
    () => buildDomainHealthRows(data?.accounts ?? []),
    [data],
  );

  // Only tabs with rows are offered — a "Not graded" tab is a defensive branch
  // for a score the wire can serve as null, and an empty one would advertise a
  // state the fleet is not in.
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
  const tabCost = visible.some((r) => r.monthlyCostUsd === null)
    ? null
    : visible.reduce((sum, r) => sum + (r.monthlyCostUsd ?? 0), 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Sending domains</h2>
          <p className="mt-1 text-xs text-gray-500">
            The delete list. A domain is what bills and what you cancel, so it is
            graded from its own mailboxes: a mailbox is dead once it falls under{" "}
            {HEALTH_BAR} on either score with nothing left in its queue, and
            dying while it still owes emails. Each cell reads health/inbox and
            the emails still queued.
          </p>
        </div>
        {!isPending && !isError && rows.length > 0 && (
          <span className="shrink-0 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600">
            {rows.length.toLocaleString("en-US")} domain
            {rows.length === 1 ? "" : "s"}
            {tabCost !== null && visible.length > 0
              ? ` · ${usd(tabCost)}/mo in this tab`
              : ""}
          </span>
        )}
      </div>

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
                      title={`Assumed monthly mailbox spend. Published list prices per mailbox: ${RATE_NOTE}. Domain registration is excluded — it is not refunded when you cancel, so it is not what deleting saves.`}
                    >
                      Monthly cost
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
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-gray-700">
                        {row.monthlyCostUsd === null ? (
                          <span className="text-gray-400">—</span>
                        ) : (
                          `${usd(row.monthlyCostUsd)}/mo`
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
                Each account cell reads health/inbox placement and the emails
                still queued to it. Monthly cost assumes published list prices
                per mailbox ({RATE_NOTE}) and excludes domain registration,
                which a cancellation does not refund.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
