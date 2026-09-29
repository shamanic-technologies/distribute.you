"use client";

import { useMemo } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import {
  getBillingFleetRevenue,
  getAuditAccounts,
  listStatedAmounts,
  type AuditAccounts,
  type StatedAmount,
} from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { formatUsd } from "@/lib/format-number";
import {
  centsToUsd,
  classLabel,
  classReasonSentence,
  mrrReconciles,
  nextCashEvent,
  orderedRows,
  paymentModeLabel,
  projectionFor,
  unknownReasonSentence,
  windowFor,
  type FleetRevenueOutlook,
} from "@/lib/revenue-outlook";

/**
 * WHERE THE SaaS MONEY STANDS TODAY: billing-service's fleet revenue read.
 *
 * Three different questions, kept apart on purpose:
 *  - RECURRING (DRR / MRR / ARR): customers who will keep paying. Postpaid with a
 *    card, or prepaid with auto top-up and a card. Only their daily campaigns that
 *    are running and still have people to contact count; reactive campaigns are a
 *    bonus nobody can size.
 *  - ONE-OFF: a prepaid customer without auto top-up spends what it holds and stops.
 *  - CASH: when money reaches the bank. Postpaid pays after spending, prepaid
 *    before, so cash and revenue move on different days.
 *
 * Every figure is billing's. The page orders rows and turns tokens into words; the
 * totals printed are billing's own, checked against the rows (`mrrReconciles`).
 */

function usd(n: number | null): string {
  if (n === null) return "Not measured";
  return formatUsd(n, Math.abs(n) < 10 ? 2 : 0);
}

function day(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const CLASS_TONE: Record<string, string> = {
  recurring: "bg-emerald-50 text-emerald-700 border-emerald-200",
  one_off: "bg-amber-50 text-amber-700 border-amber-200",
  none: "bg-gray-50 text-gray-500 border-gray-200",
};

function Card({ label, value, detail, pending }: { label: string; value: string; detail: string; pending: boolean }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      {pending ? (
        <Skeleton className="mt-2 h-8 w-24 rounded" />
      ) : (
        <p className="mt-2 text-2xl font-semibold text-gray-950">{value}</p>
      )}
      <p className="mt-1 text-sm text-gray-500">{detail}</p>
    </div>
  );
}

/** Who an org is: its owner and brands, off the accounts audit the stated-amounts card already polls. */
function useOrgLabels() {
  const { data } = useAuthQuery<AuditAccounts>(["auditAccounts"], () => getAuditAccounts(), pollOptionsSlower);
  return useMemo(() => {
    const m = new Map<string, { owner: string | null; brands: string[] }>();
    for (const r of data?.rows ?? []) {
      const e = m.get(r.orgId) ?? { owner: r.ownerEmail, brands: [] };
      const name = r.brandName?.trim() || r.brandDomain?.trim();
      if (name && !e.brands.includes(name)) e.brands.push(name);
      m.set(r.orgId, e);
    }
    return m;
  }, [data]);
}

function CashByWeek({ outlook }: { outlook: FleetRevenueOutlook }) {
  const weeks = outlook.cashFlow.byWeek;
  if (weeks.length === 0) {
    return <p className="text-sm text-gray-400">No charge is expected in the next {outlook.cashHorizonDays} days.</p>;
  }
  const amounts = weeks.map((w) => centsToUsd(w.amountCents) ?? 0);
  const max = Math.max(...amounts, 1);
  return (
    <ul className="space-y-1.5">
      {weeks.map((w, i) => (
        <li key={w.start} className="grid grid-cols-[88px_1fr_96px] items-center gap-3 text-sm">
          <span className="text-gray-500">Week of {day(`${w.start}T00:00:00Z`)}</span>
          <span className="h-2 rounded-full bg-gray-100">
            <span
              className="block h-2 rounded-full bg-emerald-500"
              style={{ width: `${Math.max(2, (amounts[i] / max) * 100)}%` }}
            />
          </span>
          <span className="text-right tabular-nums text-gray-900">
            {usd(amounts[i])}
            {w.unknownAmountEventCount > 0 && (
              <span className="ml-1 text-xs text-amber-600">+{w.unknownAmountEventCount} unsized</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function RevenueOutlookBand() {
  const { data, isPending, isError, error } = useAuthQuery<FleetRevenueOutlook>(
    ["billingFleetRevenue"],
    () => getBillingFleetRevenue(),
    pollOptionsSlower,
  );
  const { data: stated } = useAuthQuery<StatedAmount[]>(["statedAmounts"], () => listStatedAmounts(), pollOptionsSlower);
  const labels = useOrgLabels();
  const agencyOrgIds = useMemo(() => new Set((stated ?? []).map((s) => s.orgId)), [stated]);

  if (isError) {
    return (
      <section className="rounded-lg border border-red-200 bg-white p-6">
        <p className="text-sm font-medium text-red-700">Couldn&apos;t load the revenue outlook from billing.</p>
        <p className="mt-1 text-xs text-red-500">{error?.message ?? "Unknown error"}</p>
      </section>
    );
  }

  const pending = isPending || !data;
  const t = data?.totals;
  const w30 = data ? windowFor(data, 30) : null;
  const w90 = data ? windowFor(data, 90) : null;
  const rows = data ? orderedRows(data) : [];
  const hidden = data ? data.orgs.length - rows.length : 0;
  const reconciles = data ? mrrReconciles(data) : true;
  const counts = data?.classCounts ?? {};

  return (
    <>
      <div className="pt-2">
        <h2 className="text-lg font-semibold text-gray-950">Where the SaaS money stands today</h2>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">
          Three different questions. Recurring revenue is what customers will keep paying: postpaid with a card, or
          prepaid with auto top-up and a card, counting only their daily campaigns that are running and still have
          people to contact. One-off revenue is a prepaid customer without auto top-up spending what it holds, then
          stopping. Cash is when money reaches the bank: postpaid pays after spending, prepaid before. Reactive
          campaigns (triggered by a lead reaching a step) count nowhere; they are a bonus nobody can size.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card
          label="Recurring MRR"
          value={t ? usd(centsToUsd(t.mrrCents)) : ""}
          detail={
            t
              ? `${usd(centsToUsd(t.drrCents))} a day, ${usd(centsToUsd(t.arrCents))} a year. ${counts.recurring ?? 0} recurring customers`
              : ""
          }
          pending={pending}
        />
        <Card
          label="One-off, still to spend"
          value={t ? usd(centsToUsd(t.oneOffRemainingCents)) : ""}
          detail={`${counts.one_off ?? 0} prepaid customers without auto top-up. Not MRR`}
          pending={pending}
        />
        <Card
          label="Revenue, next 30 days"
          value={w30 ? usd(centsToUsd(w30.projectedRevenueCents)) : "Not measured"}
          detail={
            w90
              ? `${usd(centsToUsd(w90.projectedRevenueCents))} over 90 days. Recurring plus one-off until it runs out`
              : "Recurring plus one-off until it runs out"
          }
          pending={pending}
        />
        <Card
          label="Cash expected, next 30 days"
          value={w30 ? usd(centsToUsd(w30.cashCents)) : "Not measured"}
          detail={
            w90
              ? `${usd(centsToUsd(w90.cashCents))} over 90 days. Scheduled charges on customers' cards`
              : "Scheduled charges on customers' cards"
          }
          pending={pending}
        />
      </section>

      {data && t && t.drrUnknownOrgIds.length > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          {t.drrUnknownOrgIds.length} recurring {t.drrUnknownOrgIds.length === 1 ? "customer is" : "customers are"} left
          out of the recurring total because a campaign&apos;s state could not be read. Not counted as zero.
        </p>
      )}
      {data && data.unreadableOrgs.length > 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          Billing could not read {data.unreadableOrgs.length}{" "}
          {data.unreadableOrgs.length === 1 ? "account" : "accounts"}, so they are in no figure above.
        </p>
      )}
      {data && !reconciles && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          The customer rows below do not add up to billing&apos;s recurring MRR. The total is billing&apos;s own figure.
        </p>
      )}
      {agencyOrgIds.size > 0 && (
        <p className="text-xs text-gray-400">
          Agency customers are listed on their budgets here. In the run-rate below they count at the amount stated for
          them instead.
        </p>
      )}

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-6 lg:col-span-1">
          <h3 className="text-base font-semibold text-gray-950">Cash expected, by week</h3>
          <p className="mt-1 text-sm text-gray-500">
            When scheduled charges should land, next {data?.cashHorizonDays ?? 90} days. Month-end settles for postpaid,
            reloads for auto top-up.
          </p>
          <div className="mt-4">{pending ? <Skeleton className="h-40 w-full rounded" /> : <CashByWeek outlook={data} />}</div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 lg:col-span-2">
          <h3 className="text-base font-semibold text-gray-950">Customer by customer</h3>
          <p className="mt-1 text-sm text-gray-500">
            What each customer is worth and when their money arrives. The recurring total above is the sum of this
            column.
          </p>
          {pending ? (
            <Skeleton className="mt-4 h-40 w-full rounded" />
          ) : rows.length === 0 ? (
            <p className="mt-4 text-sm text-gray-400">No customer has money in play today.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm md:min-w-[860px]">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                    <th className="pb-2 font-medium">Customer</th>
                    <th className="pb-2 font-medium">Type</th>
                    <th className="pb-2 text-right font-medium">Per day</th>
                    <th className="pb-2 text-right font-medium">MRR</th>
                    <th className="pb-2 text-right font-medium">One-off left</th>
                    <th className="pb-2 text-right font-medium">Next 30 days</th>
                    <th className="pb-2 text-right font-medium">Next cash</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r) => {
                    const who = labels.get(r.orgId);
                    const next = nextCashEvent(r);
                    const p30 = projectionFor(r, 30);
                    return (
                      <tr key={r.orgId} className="align-top text-gray-800">
                        <td className="py-2 pr-3">
                          <p className="font-medium">{who?.brands.join(", ") || who?.owner || r.orgId.slice(0, 8)}</p>
                          <p className="text-xs text-gray-400">
                            {who?.owner ?? r.orgId}
                            {agencyOrgIds.has(r.orgId) && <span className="ml-1 text-emerald-600">agency</span>}
                          </p>
                        </td>
                        <td className="py-2 pr-3">
                          <span
                            className={`inline-block rounded border px-1.5 py-0.5 text-xs ${CLASS_TONE[r.revenueClass] ?? CLASS_TONE.none}`}
                          >
                            {classLabel(r.revenueClass)}
                          </span>
                          <p className="mt-0.5 text-xs text-gray-400">
                            {paymentModeLabel(r.paymentMode)}. {classReasonSentence(r.classReason)}
                          </p>
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {r.proactiveDailyBudgetCents === null ? (
                            <span className="text-xs text-amber-600">
                              {unknownReasonSentence(r.proactiveDailyBudgetUnknownReason)}
                            </span>
                          ) : (
                            usd(centsToUsd(r.proactiveDailyBudgetCents))
                          )}
                        </td>
                        <td className="py-2 text-right font-medium tabular-nums text-gray-900">
                          {r.revenueClass === "recurring" ? usd(centsToUsd(r.mrrCents)) : ""}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {r.oneOff ? (
                            <>
                              {usd(centsToUsd(r.oneOff.remainingCents))}
                              <p className="text-xs text-gray-400">
                                {r.oneOff.runOutAt
                                  ? `runs out ${day(r.oneOff.runOutAt)}`
                                  : unknownReasonSentence(r.oneOff.runOutUnknownReason)}
                              </p>
                            </>
                          ) : (
                            ""
                          )}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {p30 ? usd(centsToUsd(p30.totalCents)) : ""}
                        </td>
                        <td className="py-2 text-right tabular-nums">
                          {next ? (
                            <>
                              {usd(centsToUsd(next.expectedAmountCents))}
                              <p className="text-xs text-gray-400">{day(next.at)}</p>
                            </>
                          ) : (
                            <span className="text-xs text-gray-400">
                              {r.cashBlockedReason ? r.cashBlockedReason.replace(/_/g, " ") : "none expected"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200 font-medium text-gray-950">
                    <td className="pt-2" colSpan={3}>
                      Total
                    </td>
                    <td className="pt-2 text-right tabular-nums">{t ? usd(centsToUsd(t.mrrCents)) : ""}</td>
                    <td className="pt-2 text-right tabular-nums">{t ? usd(centsToUsd(t.oneOffRemainingCents)) : ""}</td>
                    <td className="pt-2 text-right tabular-nums">
                      {w30 ? usd(centsToUsd(w30.projectedRevenueCents)) : ""}
                    </td>
                    <td className="pt-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          {hidden > 0 && (
            <p className="mt-3 text-xs text-gray-400">
              {hidden} other {hidden === 1 ? "account has" : "accounts have"} nothing in play: no recurring spend, nothing
              left to spend, no charge expected. Not listed.
            </p>
          )}
        </div>
      </section>
    </>
  );
}
