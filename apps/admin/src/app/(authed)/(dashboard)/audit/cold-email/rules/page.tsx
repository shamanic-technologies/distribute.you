"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { getOpsLifecycleRules, type OpsLifecycleRules } from "@/lib/api";
import { pollOptionsSlower } from "@/lib/query-options";
import { LifecyclePill, PageHeader, Section, num } from "@/components/cold-email/primitives";

/**
 * Cold email — Rules.
 *
 * Every number on this page is READ from `/instantly/ops/lifecycle-rules`. The
 * lifecycle bars, the ramp, the placement cadence and the warmup budget are the
 * constants `deriveLifecycle` decides on, served as data precisely so a console
 * can state them without a second copy.
 *
 * ⚠️ Do NOT hand-write a threshold here. A number typed into this page is a
 * number that goes stale the day the producer changes it, silently, on the one
 * surface whose whole job is to say what the rules are.
 */
export default function ColdEmailRulesPage() {
  const { data, isPending, isError, error } = useAuthQuery<OpsLifecycleRules>(
    ["opsLifecycleRules"],
    () => getOpsLifecycleRules(),
    pollOptionsSlower,
  );

  const Fact = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <div className="rounded-lg border border-gray-200 px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-gray-400">{sub}</p>}
    </div>
  );

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Cold email: rules"
        blurb="What decides an address's state, in the order the rules are applied, plus the bars, the ramp, the placement cadence and the warmup budget. Every figure here is served by the producer, not written down."
      />

      <Section
        title="Rule order"
        blurb="The first rule that matches decides the state. Everything below it is never reached."
        isPending={isPending}
        isError={isError}
        error={error}
      >
        {data && (
          <ol className="flex flex-col">
            {data.order.map((r, i) => (
              <li
                key={`${r.rule}:${i}`}
                className="flex flex-wrap items-start gap-3 border-b border-gray-100 py-3 last:border-0"
              >
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold tabular-nums text-gray-600">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-gray-900">{r.rule}</span>
                  <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-gray-400">
                    applies to {r.appliesTo}
                  </span>
                </span>
                <LifecyclePill status={r.leadsTo} />
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section
        title="States"
        blurb="What each state means for a mailbox, and the limits it is held to while it is in that state."
        isPending={isPending}
        isError={isError}
        error={error}
      >
        {data && (
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2 pr-4 font-medium">State</th>
                  <th className="py-2 px-3 font-medium">Means</th>
                  <th className="py-2 px-3 text-center font-medium">New sends</th>
                  <th className="py-2 px-3 text-right font-medium">Campaign / day</th>
                  <th className="py-2 pl-3 text-right font-medium">Warmup / day</th>
                </tr>
              </thead>
              <tbody>
                {data.states.map((s) => (
                  <tr key={s.status} className="border-b border-gray-100 last:border-0 align-top">
                    <td className="py-3 pr-4">
                      <LifecyclePill status={s.status} />
                    </td>
                    <td className="py-3 px-3 text-gray-700">{s.meaning}</td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${
                          s.newSends ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {s.newSends ? "yes" : "no"}
                      </span>
                    </td>
                    {/* `null` means the limits are untouched in this state, which
                        is a different fact from a limit of 0. */}
                    <td className="py-3 px-3 text-right tabular-nums text-gray-700">
                      {s.campaignDailyLimit === null ? (
                        <span className="text-gray-400" title="Limits untouched in this state">
                          unchanged
                        </span>
                      ) : (
                        num(s.campaignDailyLimit)
                      )}
                    </td>
                    <td className="py-3 pl-3 text-right tabular-nums text-gray-700">
                      {s.warmupDaily === null ? (
                        <span className="text-gray-400" title="Limits untouched in this state">
                          unchanged
                        </span>
                      ) : (
                        num(s.warmupDaily)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="Bars"
        blurb="What a mailbox must clear to enter production, and how long its placement evidence stays good."
        isPending={isPending}
        isError={isError}
        error={error}
      >
        {data && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Fact
              label="Health entry bar"
              value={num(data.bars.healthEntryBar)}
              sub="warmup health score needed to enter production"
            />
            <Fact
              label="Delivery bar"
              value={`${num(data.bars.deliveryPctBar)}%`}
              sub="inbox placement a seed test must pool above"
            />
            <Fact
              label="Evidence max age"
              value={`${num(data.bars.deliveryEvidenceMaxAgeDays)}d`}
              sub="older than this and the evidence is stale"
            />
          </div>
        )}
      </Section>

      <Section
        title="Ramp"
        blurb="How fast a mailbox is allowed to grow its daily volume, and the statistic the growth is measured from."
        isPending={isPending}
        isError={isError}
        error={error}
      >
        {data && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Fact label="Floor" value={`${num(data.ramp.floorPerDay)}/day`} sub="where a new mailbox starts" />
              <Fact label="Growth" value={`×${data.ramp.growthFactor}`} sub="per day, compounding" />
              <Fact label="Window" value={`${num(data.ramp.volumeWindowDays)}d`} sub="volume window measured" />
              <Fact label="Ceiling" value={`${num(data.ramp.ceiling)}/day`} sub="the cap it grows toward" />
              <Fact label="Mature at" value={`${num(data.ramp.matureAgeDays)}d`} sub="age past which the ramp lets go" />
            </div>
            <p className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
              Statistic: {data.ramp.statistic}
            </p>
          </>
        )}
      </Section>

      <Section
        title="Placement testing"
        blurb="When a mailbox becomes testable, how often its placement evidence is refreshed, and when a refresh becomes urgent."
        isPending={isPending}
        isError={isError}
        error={error}
      >
        {data && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Fact
              label="Testable from"
              value={`${num(data.placement.testableMinAgeDays)}d`}
              sub="minimum mailbox age before a seed test runs"
            />
            <Fact
              label="Test interval"
              value={`${num(data.placement.seedTestIntervalDays)}d`}
              sub="between seed tests"
            />
            <Fact
              label="Urgent at"
              value={`${num(data.placement.seedEvidenceUrgentAgeDays)}d`}
              sub="evidence age that makes a refresh urgent"
            />
          </div>
        )}
      </Section>

      <Section
        title="Warmup"
        blurb="How much warmup a mailbox sends, and how much of its own cap warmup may take."
        isPending={isPending}
        isError={isError}
        error={error}
      >
        {data && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Fact
              label="Partners"
              value={`${num(data.warmup.partnersPerDay)}/day`}
              sub="mailboxes it warms with each day"
            />
            <Fact label="Max warmup" value={`${num(data.warmup.maxPerDay)}/day`} sub="hard ceiling" />
            <Fact
              label="Max share of cap"
              value={`${Math.round(data.warmup.maxShareOfCap * 100)}%`}
              sub="of the mailbox's own daily cap"
            />
          </div>
        )}
      </Section>
    </div>
  );
}
