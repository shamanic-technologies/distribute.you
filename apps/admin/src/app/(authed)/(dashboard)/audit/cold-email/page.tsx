"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { getOpsInfra, getSendForecast, type OpsInfra, type SendForecast } from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { Skeleton } from "@/components/skeleton";
import { CreatedForecastChart, SendForecastChart } from "@/components/audit/send-forecast-chart";
import { CapacityHistorySection } from "@/components/cold-email/capacity-history-section";
import { ReconcileSection } from "@/components/cold-email/reconcile-section";
import {
  AsOf,
  LifecyclePill,
  PageHeader,
  Section,
  StatCard,
  VolumeCell,
  num,
} from "@/components/cold-email/primitives";
import { formatPct, poolLabel } from "@/lib/instantly-ops";

/**
 * Cold email — Overview.
 *
 * The infra rollup: what the whole sending estate can do today, one row per
 * pool, the send forecast and capacity history, what reconciles against
 * Instantly, and who is held out of the pool and why.
 *
 * ⚠️ The fleet capacity card and the forecast chart's capacity line read the
 * SAME `infra.fleet.dailyCapacity`. Two reads of "how much can we send" is how a
 * card and the chart under it come to state different numbers for one fleet.
 */
export default function ColdEmailOverviewPage() {
  const {
    data: infra,
    isPending: infraPending,
    isError: infraError,
    error: infraErrorObj,
  } = useAuthQuery<OpsInfra>(["opsInfra"], () => getOpsInfra(), pollOptionsSlower);

  const {
    data: forecast,
    isPending: forecastPending,
    isError: forecastError,
    error: forecastErrorObj,
  } = useAuthQuery<SendForecast>(["sendForecast"], () => getSendForecast(), pollOptionsSlower);

  const usd = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const whole = (n?: number) => String(Math.round(n ?? 0));
  const cell = (n: number | null) => (n === null ? "—" : String(Math.round(n)));
  const dateLabel = (iso: string) =>
    new Date(`${iso}T00:00:00.000Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });

  const fleet = infra?.fleet;
  const lifecycleEntries = fleet ? Object.entries(fleet.byLifecycle).sort((a, b) => b[1] - a[1]) : [];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Cold email: overview"
        blurb="What the sending estate can do today: capacity against the rate it actually sends at, the backlog between the two, one rollup per sending pool, and who is deliberately held out."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Daily capacity"
          value={`${num(fleet?.dailyCapacity)}/day`}
          sub={`${num(fleet?.healthyAccountCount)} of ${num(fleet?.totalAccountCount)} addresses healthy`}
          pending={infraPending}
          hint="What the in-production addresses COULD send in a day, summing their limits. A ceiling, not a rate: the fleet has never come close to it. The same number the sending chart draws as its line."
        />
        <StatCard
          label="Sending now"
          value={forecast?.summary.observedDailyThroughput === null || forecast === undefined
            ? "—"
            : `${whole(forecast.summary.observedDailyThroughput)}/day`}
          sub="measured median on a sending day"
          pending={forecastPending}
          hint="What the fleet actually sends on a day it sends, taken from its recent sending days. This is the rate the projection drains at; the capacity beside it is only the ceiling."
        />
        <StatCard
          label="Backlog"
          value={forecast?.summary.queuedSendingDays === null || forecast === undefined
            ? "—"
            : `${whole(forecast.summary.queuedSendingDays)} days`}
          sub={forecast ? `${whole(forecast.summary.queuedEmails)} emails waiting` : "—"}
          pending={forecastPending}
          hint="Emails already provisioned and waiting to go out, and how many sending days that takes to clear at the measured rate. This is the gap creation has opened over sending."
        />
        <StatCard
          label="Blocked domains"
          value={num(fleet?.blockedDomainCount)}
          sub="brand / product domains held out of cold"
          pending={infraPending}
        />
        <StatCard
          label="Total daily budget"
          value={forecast ? usd(forecast.summary.totalDailyBudgetUsd) : "—"}
          sub="across active brands"
          pending={forecastPending}
        />
      </div>

      <Section
        title="Fleet by lifecycle"
        blurb="Every sending address, by the state the lifecycle rules put it in. Only in-production addresses are offered new sequences."
        isPending={infraPending}
        isError={infraError}
        error={infraErrorObj}
        empty={infra && lifecycleEntries.length === 0 ? "No addresses classified yet." : null}
      >
        {infra && lifecycleEntries.length > 0 && (
          <>
            <div className="flex flex-wrap gap-3">
              {lifecycleEntries.map(([status, count]) => (
                <div key={status} className="rounded-lg border border-gray-200 bg-gray-50/60 px-4 py-3">
                  <LifecyclePill status={status} />
                  <p className="mt-1.5 text-xl font-semibold tabular-nums text-gray-900">{num(count)}</p>
                  <p className="text-[10px] text-gray-400">addresses</p>
                </div>
              ))}
            </div>
            <AsOf iso={infra.asOf} />
          </>
        )}
      </Section>

      <Section
        title="Sending pools"
        blurb="One row per pool of real mailboxes. A pool at zero capacity is rendered at zero, never hidden: it is still bought, still billing, and still the answer to why the fleet is smaller than the mailbox count."
        isPending={infraPending}
        isError={infraError}
        error={infraErrorObj}
        empty={infra && infra.pools.length === 0 ? "No pools reported." : null}
      >
        {infra && infra.pools.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-[860px] w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-4 font-medium">Pool</th>
                  <th className="py-2 px-3 text-right font-medium">Mailboxes</th>
                  <th className="py-2 px-3 text-right font-medium">Addresses</th>
                  <th className="py-2 px-3 text-right font-medium">In production</th>
                  <th className="py-2 px-3 text-right font-medium">Capacity</th>
                  <th className="py-2 px-3 text-right font-medium">Queued</th>
                  <th className="py-2 px-3 text-left font-medium">Inbox (mean)</th>
                  <th className="py-2 pl-3 text-right font-medium">Volume 7d</th>
                </tr>
              </thead>
              <tbody>
                {infra.pools.map((p) => (
                  <tr key={p.pool} className="border-b border-gray-100 last:border-0 align-top">
                    <td className="py-2.5 pr-4">
                      <span className="font-medium text-gray-900">{poolLabel(p.pool)}</span>
                      <span className="mt-0.5 flex flex-wrap gap-1">
                        {Object.entries(p.byLifecycle)
                          .sort((a, b) => b[1] - a[1])
                          .map(([status, count]) => (
                            <span key={status} className="text-[10px] tabular-nums text-gray-400">
                              {num(count)} {status}
                            </span>
                          ))}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">{num(p.mailboxes)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">{num(p.addresses)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">{num(p.inProduction)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-medium text-gray-900">
                      {num(p.dailyCapacity)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-gray-700">{num(p.queuedSteps)}</td>
                    <td className="py-2.5 px-3 text-left tabular-nums text-gray-700">
                      {formatPct(p.inboxPctMean) ?? <span className="text-gray-400">—</span>}
                    </td>
                    <td className="py-2.5 pl-3 text-right">
                      <VolumeCell volume={p.volume7d} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <AsOf iso={infra.asOf} />
          </div>
        )}
      </Section>

      {forecastError ? (
        <div className="bg-white rounded-xl border border-red-200 p-6">
          <p className="text-sm font-medium text-red-700">Couldn&apos;t load the send forecast.</p>
          <p className="mt-1 text-xs text-red-500">{forecastErrorObj?.message ?? "Unknown error"}</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Sequences created per day</h3>
              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-violet-600" /> Created
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-violet-300" /> Projected
                </span>
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              What the daily budget launches. This runs every day, weekends included. A sequence
              created on a Saturday simply waits for Monday to go out. No capacity line: mailbox
              capacity bounds sending, not creation.
            </p>
            <div className="mt-4">
              {forecastPending ? (
                <Skeleton className="h-[240px] w-full rounded" />
              ) : (
                <CreatedForecastChart days={forecast.days} />
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Emails sent per day</h3>
              <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-indigo-500" /> Sent (actual)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-sky-500" /> Projected
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 rounded-sm bg-sky-500" /> Daily capacity
                </span>
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              What physically goes out, Monday to Friday. The projection drains the queue at the
              fleet&apos;s measured rate; the dashed line is the ceiling it could reach, not the rate
              it does. Whatever a day cannot send stays queued for the next one.
            </p>
            <div className="mt-4">
              {forecastPending ? (
                <Skeleton className="h-[300px] w-full rounded" />
              ) : (
                <SendForecastChart days={forecast.days} dailyCapacity={fleet?.dailyCapacity} />
              )}
            </div>
          </div>

          <CapacityHistorySection />

          <Section
            title="Day by day"
            blurb="What the budget created and what the fleet sent, per calendar day. Two different things on two different calendars."
            isPending={forecastPending}
            isError={forecastError}
            error={forecastErrorObj}
          >
            {forecast && (
              <div className="overflow-x-auto">
                <table className="min-w-[720px] w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="py-2 pr-4 font-medium">Day</th>
                      <th className="py-2 px-4 text-right font-medium">Created</th>
                      <th className="py-2 px-4 text-right font-medium">Created (proj.)</th>
                      <th className="py-2 px-4 text-right font-medium">Sent (actual)</th>
                      <th className="py-2 px-4 text-right font-medium">Sent (proj.)</th>
                      <th className="py-2 pl-4 text-right font-medium">Sent total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.days.map((d) => (
                      <tr
                        key={d.date}
                        className={`border-b border-gray-100 last:border-0 ${d.isToday ? "bg-indigo-50" : ""}`}
                      >
                        <td className="py-2.5 pr-4 font-medium text-gray-900">
                          {dateLabel(d.date)}
                          {d.isToday && (
                            <span className="ml-2 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                              Today
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-gray-700">
                          {cell(d.createdActual)}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-gray-700">
                          {cell(d.createdProjected)}
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-gray-700">{cell(d.actualSent)}</td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-gray-700">
                          {d.inFlightSent === null && d.forecastNew === null
                            ? "—"
                            : cell((d.inFlightSent ?? 0) + (d.forecastNew ?? 0))}
                        </td>
                        <td className="py-2.5 pl-4 text-right tabular-nums font-semibold text-gray-900">
                          {cell(d.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-gray-400">
                  Created counts SEQUENCES, sent counts EMAILS. One sequence owes three emails on the{" "}
                  {forecast.summary.followupModel} cadence, so the two columns are not comparable. A dash
                  means the series doesn&apos;t apply that day: past days carry no projection, future days
                  carry no actuals. {whole(forecast.summary.totalNewSequencesPerDay)} new sequences/day
                  across {whole(forecast.summary.activeBrandCount)} active brands.
                </p>
              </div>
            )}
          </Section>
        </>
      )}

      <Section
        title="Held out of the pool"
        blurb="Domains policy keeps out of cold outreach, and addresses reserved to one feature. Both are why a mailbox that looks healthy is never offered a sequence."
        isPending={infraPending}
        isError={infraError}
        error={infraErrorObj}
      >
        {infra && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Domain policy ({num(infra.exclusions.domainPolicy.length)})
              </p>
              {infra.exclusions.domainPolicy.length === 0 ? (
                <p className="mt-2 text-sm text-gray-400">No domain is excluded by policy.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {infra.exclusions.domainPolicy.map((d) => (
                    <li key={d.domain} className="rounded-lg border border-gray-200 px-3 py-2">
                      <p className="text-sm font-medium text-gray-900">{d.domain}</p>
                      <p className="text-xs text-gray-500">
                        {d.reason}
                        {d.note ? ` · ${d.note}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Feature reservations ({num(infra.exclusions.featureReservations.length)})
              </p>
              {infra.exclusions.featureReservations.length === 0 ? (
                <p className="mt-2 text-sm text-gray-400">No address is reserved to a feature.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {infra.exclusions.featureReservations.map((r) => (
                    <li
                      key={`${r.accountEmail}:${r.featureSlug}`}
                      className="rounded-lg border border-gray-200 px-3 py-2"
                    >
                      <p className="break-all text-sm font-medium text-gray-900">{r.accountEmail}</p>
                      <p className="text-xs text-gray-500">reserved to {r.featureSlug}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Section>

      <ReconcileSection />
    </div>
  );
}
