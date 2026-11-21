"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthQuery } from "@/lib/use-auth-query";
import { slowServerReadOptions } from "@/lib/query-options";
import {
  ApiError,
  createStaffStatedAmount,
  deleteStaffStatedAmount,
  getStaffRevenueAccounts,
  getStaffRevenueBoard,
  getStaffRevenueOutlook,
  listStaffStatedAmounts,
  updateStaffStatedAmount,
} from "@/lib/api";
import { formatUsdAdaptive } from "@/lib/format-number";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { DailyLines, Dash, PeriodBars, TD, TDR, TH, THR } from "@/components/v2/monitoring-charts";
import { SettingModal } from "@/components/v2/setting-modal";
import { lineDomain } from "@/lib/monitoring/line-domain";
import type { AvgSeries, Grain, Part, RetentionSeries, RevenueBoard, RevenueSeries, RunRateBoard, SelfServeTable } from "@/lib/monitoring/revenue-series";
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
} from "@/lib/monitoring/revenue-outlook";
import {
  EMPTY_STATED_AMOUNT_DRAFT,
  isInForceToday,
  statedAmountBody,
  statedAmountDraftProblem,
  statedAmountErrorMessage,
  termLabel,
  type RevenueAccountRow,
  type StatedAmount,
  type StatedAmountDraft,
} from "@/lib/monitoring/stated-amounts";

/**
 * Monitoring > Revenue (staff only), moved from the admin Revenue tab (owner 2026-11-21). Every
 * figure is served: the board by the staff route `/api/monitoring/revenue` (series and rates built
 * there, `lib/monitoring/revenue-series.ts`), the outlook by billing-service, the stated amounts by
 * features-service. This file lays out and formats; it adds, subtracts and divides nothing.
 */

const BOARD_KEY = ["staffRevenueBoard"] as const;
const STATED_KEY = ["staffStatedAmounts"] as const;

export function useRevenueBoard() {
  return useAuthQuery(BOARD_KEY, () => getStaffRevenueBoard(), { ...slowServerReadOptions, retry: false });
}
function useOutlook() {
  return useAuthQuery(["staffRevenueOutlook"], getStaffRevenueOutlook, { ...slowServerReadOptions, retry: false });
}
function useAccounts() {
  return useAuthQuery(["staffRevenueAccounts"], getStaffRevenueAccounts, { ...slowServerReadOptions, retry: false });
}
function useStated() {
  return useAuthQuery(STATED_KEY, listStaffStatedAmounts, { ...slowServerReadOptions, retry: false });
}

// ─── Formatting only ───────────────────────────────────────────────────────

const usd = formatUsdAdaptive;
const usdOrDash = (v: number | null | undefined) => (v == null ? <Dash /> : usd(v));
const growth = (v: number) => `${v > 0 ? "+" : ""}${v.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
const pctNrr = (v: number) => `${v.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
const shortDay = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const GRAIN_LABEL: Record<Grain, string> = { month: "Monthly", week: "Weekly" };
const RATE_NAME: Record<Grain, string> = { month: "CMGR", week: "CWGR" };
const PERIOD_NOUN: Record<Grain, [string, string]> = { month: ["month", "months"], week: ["week", "weeks"] };

function rateNote(s: RevenueSeries, grain: Grain): string | undefined {
  if (s.cmgrPct === null) return undefined;
  const n = s.periodsSpanned;
  return `${RATE_NAME[grain]} ${growth(s.cmgrPct)}${n ? ` over ${n} ${PERIOD_NOUN[grain][n === 1 ? 0 : 1]}` : ""}`;
}

/** Monthly / Weekly, the way every Monitoring chart switches its period. */
function GrainSwitch({ grain, onChange }: { grain: Grain; onChange: (g: Grain) => void }) {
  return (
    <span className="inline-flex items-center gap-1.5" role="group" aria-label="Period">
      {(["month", "week"] as const).map((g) => (
        <button key={g} type="button" aria-pressed={grain === g} onClick={() => onChange(g)} className={grain === g ? "k-btn h-7 px-2 text-[12px]" : "k-btn-ghost h-7 px-2 text-[12px]"}>
          {GRAIN_LABEL[g]}
        </button>
      ))}
    </span>
  );
}

/** A served series as bars, each period's own label, the rate to it on hover. */
function SeriesBars({ points, color, format, empty, rate = true }: { points: RevenueSeries["points"]; color: string; format: (v: number) => string; empty: string; rate?: boolean }) {
  const labels = new Map(points.map((p) => [p.key, p.label]));
  const periods = points.map((p) => ({ period: p.key, value: p.value, cmgrPct: p.cmgrPct }));
  return (
    <PeriodBars
      periods={periods}
      series={[{ key: "v", label: "", color, get: (m) => m.value }]}
      format={format}
      label={(period) => labels.get(period) ?? period}
      caption={rate ? (m) => (m.cmgrPct === null ? "first period" : `${growth(m.cmgrPct)} compounded`) : undefined}
      empty={empty}
    />
  );
}

function Failed({ what, error }: { what: string; error: string }) {
  return (
    <div className="k-card">
      <EmptyNote>
        Could not read {what} from production: {error}.
      </EmptyNote>
    </div>
  );
}

function ShimmerCard() {
  return (
    <div className="k-card space-y-2 p-4">
      {[0, 1, 2, 3].map((i) => (
        <Shimmer key={i} className="h-4 w-full" />
      ))}
    </div>
  );
}

/** A served part: its loading rows, its error sentence, or its body. */
function PartView<T>({ part, what, children }: { part: Part<T> | undefined; what: string; children: (data: T) => React.ReactNode }) {
  if (part === undefined) return <ShimmerCard />;
  if (!part.ok) return <Failed what={what} error={part.error} />;
  return <>{children(part.data)}</>;
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="k-card px-4 py-3 text-[13px] text-[var(--data-amber)]">{children}</p>;
}

// ─── Page ──────────────────────────────────────────────────────────────────

export function RevenuePage() {
  const board = useRevenueBoard();
  const b = board.data;
  const boardFailed = board.isError && !b;
  const part = <K extends keyof RevenueBoard>(k: K): RevenueBoard[K] | undefined => (b ? b[k] : undefined);
  const failedPart = { ok: false as const, error: board.error?.message ?? "unknown error" };
  return (
    <div className="space-y-10">
      <SaasChartsSlot />
      <OutlookSection />
      <CashSection cash={boardFailed ? failedPart : part("cash")} />
      <ConsumedSection consumed={boardFailed ? failedPart : part("consumed")} />
      <StatedAmountsSection />
      <PerAudienceSection board={boardFailed ? { perVisitor: failedPart, perSignup: failedPart, perPaidClient: failedPart } : b} />
    </div>
  );
}

/**
 * RESERVED SLOT (owner 2026-11-21): two SaaS charts another session adds here, at the TOP of the page:
 * weekly bars and the running total of cash collected. Headline = gross without agency, then net
 * without agency and gross with agency below. Not built in this ship; replace this component whole.
 */
function SaasChartsSlot() {
  return (
    <section id="saas-charts-slot" aria-label="SaaS charts, coming next">
      <SectionTitle>SaaS cash collected</SectionTitle>
      <div className="k-card-dashed px-4 py-8 text-center">
        <p className="k-fg2 text-[13px]">Weekly bars and the running total of cash collected land here next.</p>
        <p className="k-fg3 mt-1 text-[12px]">Gross without agency first, then net without agency and gross with agency.</p>
      </div>
    </section>
  );
}

// ─── Where the SaaS money stands today (billing-service) ──────────────────

function OutlookSection() {
  const q = useOutlook();
  const accounts = useAccounts();
  const stated = useStated();
  const o = q.data;
  const labels = useMemo(() => {
    const m = new Map<string, { owner: string | null; brands: string[] }>();
    for (const r of accounts.data?.rows ?? []) {
      const e = m.get(r.orgId) ?? { owner: r.ownerEmail, brands: [] };
      const name = r.brandName?.trim() || r.brandDomain?.trim();
      if (name && !e.brands.includes(name)) e.brands.push(name);
      m.set(r.orgId, e);
    }
    return m;
  }, [accounts.data]);
  const agencyOrgIds = useMemo(() => new Set((stated.data ?? []).map((s) => s.orgId)), [stated.data]);
  return (
    <section>
      <SectionTitle right={o ? <span>billing-service, as of {shortDay(o.asOf)}</span> : undefined}>Where the SaaS money stands today</SectionTitle>
      <p className="k-fg2 -mt-1 mb-4 max-w-[860px] text-[13px]">
        Recurring revenue comes from customers who keep paying: postpaid with a card, or prepaid with auto top-up and a card, counting their daily campaigns that run and still have people to contact. One-off revenue is a prepaid customer without auto top-up spending what it holds. Cash is when money reaches the bank.
      </p>
      {q.isError && !o ? <Failed what="billing's revenue outlook" error={q.error?.message ?? "unknown error"} /> : !o ? <ShimmerCard /> : <Outlook o={o} labels={labels} agencyOrgIds={agencyOrgIds} />}
    </section>
  );
}

function Outlook({ o, labels, agencyOrgIds }: { o: FleetRevenueOutlook; labels: Map<string, { owner: string | null; brands: string[] }>; agencyOrgIds: Set<string> }) {
  const t = o.totals;
  const w30 = windowFor(o, 30);
  const w90 = windowFor(o, 90);
  const rows = orderedRows(o);
  const hidden = o.orgs.length - rows.length;
  const counts = o.classCounts;
  const cashWeeks = o.cashFlow.byWeek.map((w) => ({ period: w.start, value: centsToUsd(w.amountCents) ?? 0, unsized: w.unknownAmountEventCount }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Recurring MRR" note={`${counts.recurring ?? 0} customers`}>
          <Figure value={usdOrDash(centsToUsd(t.mrrCents))} />
          <p className="k-fg3 mt-1 text-[12px]">
            {usd(centsToUsd(t.drrCents) ?? 0)} a day, {usd(centsToUsd(t.arrCents) ?? 0)} a year
          </p>
        </StatTile>
        <StatTile label="One-off, still to spend" note={`${counts.one_off ?? 0} customers`}>
          <Figure value={usdOrDash(centsToUsd(t.oneOffRemainingCents))} />
          <p className="k-fg3 mt-1 text-[12px]">Prepaid without auto top-up, not MRR</p>
        </StatTile>
        <StatTile label="Revenue, next 30 days">
          <Figure value={w30 ? usd(centsToUsd(w30.projectedRevenueCents) ?? 0) : <Dash />} />
          <p className="k-fg3 mt-1 text-[12px]">{w90 ? `${usd(centsToUsd(w90.projectedRevenueCents) ?? 0)} over 90 days` : "Recurring plus one-off"}</p>
        </StatTile>
        <StatTile label="Cash expected, next 30 days">
          <Figure value={w30 ? usd(centsToUsd(w30.cashCents) ?? 0) : <Dash />} />
          <p className="k-fg3 mt-1 text-[12px]">{w90 ? `${usd(centsToUsd(w90.cashCents) ?? 0)} over 90 days` : "Scheduled card charges"}</p>
        </StatTile>
      </div>
      {t.drrUnknownOrgIds.length > 0 && (
        <Note>
          {t.drrUnknownOrgIds.length} recurring {t.drrUnknownOrgIds.length === 1 ? "customer is" : "customers are"} out of the recurring total: a campaign&apos;s state could not be read. Not counted as zero.
        </Note>
      )}
      {o.unreadableOrgs.length > 0 && <Note>Billing could not read {o.unreadableOrgs.length} {o.unreadableOrgs.length === 1 ? "account" : "accounts"}, so they are in no figure above.</Note>}
      {!mrrReconciles(o) && <Note>The customer rows below do not add up to billing&apos;s recurring MRR. The total is billing&apos;s own figure.</Note>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div>
          <p className="k-label mb-2">Cash expected, by week</p>
          <PeriodBars
            periods={cashWeeks}
            series={[{ key: "cash", label: "Expected", color: "var(--data-teal)", get: (m) => m.value }]}
            format={usd}
            label={(p) => `Week of ${shortDay(p)}`}
            caption={(m) => (m.unsized > 0 ? `+${m.unsized} charge${m.unsized === 1 ? "" : "s"} not sized` : "scheduled charges")}
            empty={`No charge is expected in the next ${o.cashHorizonDays} days.`}
          />
        </div>
        <div className="min-w-0">
          <p className="k-label mb-2">Customer by customer</p>
          {rows.length === 0 ? (
            <div className="k-card">
              <EmptyNote>No customer has money moving today.</EmptyNote>
            </div>
          ) : (
            <div className="k-card overflow-hidden">
              <div className="k-scroll overflow-x-auto">
                <table className="w-full text-[13px] md:min-w-[760px]">
                  <thead>
                    <tr className="k-line-subtle border-b">
                      <th className={TH}>Customer</th>
                      <th className={TH}>Type</th>
                      <th className={THR}>Per day</th>
                      <th className={THR}>MRR</th>
                      <th className={THR}>One-off left</th>
                      <th className={THR}>Next 30 days</th>
                      <th className={THR}>Next cash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const who = labels.get(r.orgId);
                      const next = nextCashEvent(r);
                      const p30 = projectionFor(r, 30);
                      return (
                        <tr key={r.orgId} className="k-row k-line-subtle border-b last:border-b-0">
                          <td className={TD}>
                            <p className="font-medium">{who?.brands.join(", ") || who?.owner || r.orgId.slice(0, 8)}</p>
                            <p className="k-fg3 text-[12px]">
                              {who?.owner ?? r.orgId}
                              {agencyOrgIds.has(r.orgId) && <span className="ml-1 text-[var(--data-teal)]">agency</span>}
                            </p>
                          </td>
                          <td className={TD}>
                            <span className="k-chip">{classLabel(r.revenueClass)}</span>
                            <p className="k-fg3 mt-0.5 text-[12px]">
                              {paymentModeLabel(r.paymentMode)}. {classReasonSentence(r.classReason)}
                            </p>
                          </td>
                          <td className={TDR}>
                            {r.proactiveDailyBudgetCents === null ? <span className="text-[12px] text-[var(--data-amber)]">{unknownReasonSentence(r.proactiveDailyBudgetUnknownReason)}</span> : usd(centsToUsd(r.proactiveDailyBudgetCents) ?? 0)}
                          </td>
                          <td className={`${TDR} font-medium`}>{r.revenueClass === "recurring" ? usdOrDash(centsToUsd(r.mrrCents)) : <Dash />}</td>
                          <td className={TDR}>
                            {r.oneOff ? (
                              <>
                                {usd(centsToUsd(r.oneOff.remainingCents) ?? 0)}
                                <p className="k-fg3 text-[12px]">{r.oneOff.runOutAt ? `runs out ${shortDay(r.oneOff.runOutAt)}` : unknownReasonSentence(r.oneOff.runOutUnknownReason)}</p>
                              </>
                            ) : (
                              <Dash />
                            )}
                          </td>
                          <td className={TDR}>{p30 ? usdOrDash(centsToUsd(p30.totalCents)) : <Dash />}</td>
                          <td className={TDR}>
                            {next ? (
                              <>
                                {usdOrDash(centsToUsd(next.expectedAmountCents))}
                                <p className="k-fg3 text-[12px]">{shortDay(next.at)}</p>
                              </>
                            ) : (
                              <span className="k-fg3 text-[12px]">{r.cashBlockedReason ? r.cashBlockedReason.replace(/_/g, " ") : "none expected"}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="k-fg3 k-line-subtle border-t px-4 py-2.5 text-[12px] tabular-nums">
                Total MRR {usdOrDash(centsToUsd(t.mrrCents))}, one-off left {usdOrDash(centsToUsd(t.oneOffRemainingCents))}
                {hidden > 0 && `. ${hidden} other ${hidden === 1 ? "account has" : "accounts have"} nothing moving, not listed`}
                {agencyOrgIds.size > 0 && ". Agency customers show their budgets here; the run-rate below counts what was stated for them"}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Cash collected (billing-service) ──────────────────────────────────────

function CashSection({ cash }: { cash: RevenueBoard["cash"] | undefined }) {
  const [grain, setGrain] = useState<Grain>("month");
  return (
    <section>
      <SectionTitle right={<GrainSwitch grain={grain} onChange={setGrain} />}>Cash collected</SectionTitle>
      <p className="k-fg2 -mt-1 mb-4 max-w-[860px] text-[13px]">What customers paid us, whichever acquirer took the payment, minus what went back out. Prepaid customers pay before they spend and postpaid after, so this never matches the revenue consumed below on a given day.</p>
      <PartView part={cash} what="billing's cash totals">
        {(c) => (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatTile label="Net collected" note="what we keep">
                <Figure value={usd(c.netUsd)} />
              </StatTile>
              <StatTile label="Gross charged" note="every payment">
                <Figure value={usd(c.grossUsd)} />
              </StatTile>
              <StatTile label="Refunded and lost disputes">
                <Figure value={usd(c.returnedUsd)} />
              </StatTile>
            </div>
            <div>
              <p className="k-label mb-2">
                {GRAIN_LABEL[grain]} net cash{rateNote(c.series[grain], grain) ? ` · ${rateNote(c.series[grain], grain)} since the first charge` : ""}
              </p>
              <SeriesBars points={c.series[grain].points} color="var(--data-teal)" format={usd} empty="No cash collected yet." />
            </div>
          </div>
        )}
      </PartView>
    </section>
  );
}

// ─── Revenue consumed, retention, run-rate (features-service) ─────────────

function ConsumedSection({ consumed }: { consumed: RevenueBoard["consumed"] | undefined }) {
  const [grain, setGrain] = useState<Grain>("month");
  return (
    <>
      <section>
        <SectionTitle right={<GrainSwitch grain={grain} onChange={setGrain} />}>Revenue consumed</SectionTitle>
        <p className="k-fg2 -mt-1 mb-4 max-w-[860px] text-[13px]">What customers burned in cold-email sending, after each org&apos;s usage discount. A refund moves the cash above, never this.</p>
        <PartView part={consumed} what="features-service's revenue">
          {(c) => (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <StatTile label="Total revenue" note="since inception, net">
                  <Figure value={usd(c.totalRevenueUsd)} />
                </StatTile>
                <StatTile label="Tracked revenue weeks" note="since the first billed spend">
                  <Figure value={c.trackedWeeks.toLocaleString("en-US")} />
                </StatTile>
              </div>
              <div>
                <p className="k-label mb-2">
                  {GRAIN_LABEL[grain]} revenue{rateNote(c.series[grain], grain) ? ` · ${rateNote(c.series[grain], grain)} since inception` : ""}
                </p>
                <SeriesBars points={c.series[grain].points} color="var(--accent)" format={usd} empty="No revenue consumed yet." />
              </div>
            </div>
          )}
        </PartView>
      </section>

      <section>
        <SectionTitle right={<GrainSwitch grain={grain} onChange={setGrain} />}>Net revenue retention</SectionTitle>
        <p className="k-fg2 -mt-1 mb-4 max-w-[860px] text-[13px]">Of what last period&apos;s paying customers spent, how much they spend now. Above 100% the existing base grows on its own. The headline is the last complete period.</p>
        <PartView part={consumed} what="features-service's revenue">
          {(c) => <Retention s={c.nrr[grain]} />}
        </PartView>
      </section>

      <section>
        <SectionTitle right={<GrainSwitch grain={grain} onChange={setGrain} />}>Monthly run-rate</SectionTitle>
        <p className="k-fg2 -mt-1 mb-4 max-w-[860px] text-[13px]">
          What the fleet is worth per month, in two halves that never overlap. A self-serve customer is worth billing&apos;s recurring revenue. An agency is worth only what a person stated for its brands below, never its budget × 30.
        </p>
        <PartView part={consumed} what="features-service's revenue">
          {(c) =>
            c.runRate === null ? (
              <Note>
                The run-rate could not be split: features-service could not read the stated amounts, so it declined to answer. The fleet committed run-rate is still {usd(c.fleetCommittedMrrUsd)} a month.
              </Note>
            ) : (
              <RunRate r={c.runRate} grain={grain} />
            )
          }
        </PartView>
      </section>
    </>
  );
}

function Retention({ s }: { s: RetentionSeries }) {
  const rate = s.latestConcludedPct;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      <StatTile label="Last complete period" note={s.latestConcludedLabel ?? undefined}>
        <Figure value={rate === null ? <Dash /> : <span style={{ color: rate >= 100 ? "var(--run)" : "var(--data-rose)" }}>{pctNrr(rate)}</span>} />
        <p className="k-fg3 mt-1 text-[12px]">{s.latestConcludedCohort === null ? "No complete period has a prior cohort yet" : `${s.latestConcludedCohort} customers carried in`}</p>
      </StatTile>
      <SeriesBars points={s.points} color="var(--data-violet)" format={pctNrr} rate={false} empty="No period has a prior cohort to retain yet." />
    </div>
  );
}

function RunRate({ r, grain }: { r: RunRateBoard; grain: Grain }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="Self-serve MRR" note={r.selfServeArrUsd !== null ? `${usd(r.selfServeArrUsd)} a year` : undefined}>
          <Figure value={usdOrDash(r.selfServeMrrUsd)} />
        </StatTile>
        <StatTile label="Agency MRR" note={`${usd(r.agencyArrUsd)} a year`}>
          <Figure value={usd(r.agencyMrrUsd)} />
        </StatTile>
        <StatTile label="Total MRR" note={r.totalArrUsd !== null ? `${usd(r.totalArrUsd)} a year` : undefined}>
          <Figure value={usdOrDash(r.totalMrrUsd)} />
        </StatTile>
      </div>
      {r.basisChangedOn && <p className="k-fg3 text-[12px]">The self-serve series follows billing&apos;s recurring revenue from {r.basisChangedOn}. Before that day it used the older running-budget rule, so a jump across it is a change of rule, not of business.</p>}
      {r.unmeasurable.length > 0 && (
        <Note>
          The self-serve half could not be measured for {r.unmeasurable.length} {r.unmeasurable.length === 1 ? "period" : "periods"} ({r.unmeasurable.join(", ")}), so they are not on the charts. No service held a record about any customer on that day. Not a zero.
        </Note>
      )}
      {r.unstatedAgencyUsd > 0 && <Note>{usd(r.unstatedAgencyUsd)} a month of agency budget is in neither half: an agency brand nobody stated an amount for yet. State it below.</Note>}
      {r.approximatedMonths.length > 0 && (
        <Note>
          {r.approximatedMonths.length === 1 ? "One month is" : `${r.approximatedMonths.length} months are`} approximated ({r.approximatedMonths.join(", ")}): before {r.earningRecordBeginsOn ?? "the running record began"}, a customer counts when their own billed sending shows they were working that week.
        </Note>
      )}
      {r.unrecordedBudgetCustomers > 0 && (
        <Note>
          Up to {r.unrecordedBudgetCustomers} {r.unrecordedBudgetCustomers === 1 ? "customer was" : "customers were"} working with no recorded daily budget, so they count for nothing above. Set a budget on them once and the record starts.
        </Note>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RunRateChart title="ARR" s={r.arr[grain]} grain={grain} color="var(--accent)" />
        <RunRateChart title="MRR" s={r.mrr[grain]} grain={grain} color="var(--accent)" />
        <RunRateChart title="Self-serve MRR" s={r.selfServeMrr[grain]} grain={grain} color="var(--data-sky)" />
        <RunRateChart title="Agency MRR" s={r.agencyMrr[grain]} grain={grain} color="var(--data-teal)" />
      </div>
      {r.selfServe && <SelfServeBrands t={r.selfServe} />}
    </div>
  );
}

function RunRateChart({ title, s, grain, color }: { title: string; s: RevenueSeries; grain: Grain; color: string }) {
  return (
    <div>
      <p className="k-label mb-2">
        {title} · {s.latestUsd === null ? "no figure yet" : usd(s.latestUsd)}
        {rateNote(s, grain) ? ` · ${rateNote(s, grain)}` : ""}
      </p>
      <RunRateLine points={s.points} color={color} title={title} />
    </div>
  );
}

const ALL_PERIODS = [{ key: "all", label: "All", days: null }];

/**
 * A run-rate is a STOCK, drawn as ONE line on an axis fitted to its data, like the admin tab's run-rate card (owner 2026-11-21: a
 * move never redesigns an approved chart). Monitoring's shared line chart, each served point read on hover.
 */
function RunRateLine({ points, color, title }: { points: RevenueSeries["points"]; color: string; title: string }) {
  const labels = new Map(points.map((p) => [p.key, p.label]));
  const rows = points.map((p) => ({ day: p.key, value: p.value }));
  return (
    <DailyLines
      points={rows}
      lines={[{ key: "v", label: title, color, get: (r) => r.value }]}
      format={usd}
      windows={ALL_PERIODS}
      empty="Not enough periods measured yet to draw a line."
      label={title}
      pointLabel={(k) => labels.get(k) ?? k}
      tickLabel={(k) => labels.get(k) ?? k}
      axis={lineDomain}
    />
  );
}

function Verdict({ ok }: { ok: boolean | null }) {
  if (ok === null) return <Dash />;
  return ok ? <span className="text-[var(--run)]">Yes</span> : <span className="k-fg3">No</span>;
}

function SelfServeBrands({ t }: { t: SelfServeTable }) {
  return (
    <div>
      <SectionTitle count={t.rows.length}>Self-serve MRR, brand by brand</SectionTitle>
      <p className="k-fg2 -mt-1 mb-3 text-[13px]">A brand&apos;s budget counts on {t.referenceDate} only when it is paying, a campaign runs, an amount is in force and people are left to contact.</p>
      {!t.reconciles && <Note>These rows do not add up to the self-serve total. The total is the producer&apos;s own figure; the rows are what is wrong.</Note>}
      {t.rows.length === 0 ? (
        <div className="k-card">
          <EmptyNote>No self-serve brand has a budget in force.</EmptyNote>
        </div>
      ) : (
        <div className="k-card overflow-hidden">
          <div className="k-scroll overflow-x-auto">
            <table className="w-full text-[13px] md:min-w-[720px]">
              <thead>
                <tr className="k-line-subtle border-b">
                  <th className={TH}>Brand</th>
                  <th className={THR}>Budget / day</th>
                  <th className={TH}>Paying</th>
                  <th className={TH}>Campaign</th>
                  <th className={TH}>People left</th>
                  <th className={THR}>Counted MRR</th>
                </tr>
              </thead>
              <tbody>
                {t.rows.map((r) => (
                  <tr key={r.key} className={`k-row k-line-subtle border-b last:border-b-0 ${r.excludedBy ? "k-fg3" : ""}`}>
                    <td className={TD}>
                      <span className="font-medium">{r.brand}</span>
                      {r.excludedBy && <span className="k-fg3 ml-2 text-[12px]">{r.excludedBy}</span>}
                      {r.approximated && <span className="ml-2 text-[12px] text-[var(--data-amber)]">approximated</span>}
                    </td>
                    <td className={TDR}>{usdOrDash(r.dailyBudgetUsd)}</td>
                    <td className={TD}>
                      <Verdict ok={r.paying} />
                    </td>
                    <td className={TD}>
                      <Verdict ok={r.campaignRunning} />
                    </td>
                    <td className={TD}>
                      <Verdict ok={r.audienceAvailable} />
                    </td>
                    <td className={`${TDR} font-medium`}>{usd(r.countedMrrUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="k-fg3 k-line-subtle border-t px-4 py-2.5 text-[12px] tabular-nums">
            Self-serve MRR {usd(t.countedMrrUsd)}
            {t.unfunded > 0 && `. ${t.unfunded} other ${t.unfunded === 1 ? "brand has" : "brands have"} no budget, not listed`}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── What the agency's brands are worth (features-service, writes) ───────

const utcToday = () => new Date().toISOString().slice(0, 10);
const pairKey = (orgId: string, brandId: string) => `${orgId}::${brandId}`;
const accountName = (r: RevenueAccountRow) => r.brandName ?? r.brandDomain ?? r.brandId.slice(0, 8);
function optionLabel(r: RevenueAccountRow): string {
  const name = accountName(r);
  const domain = r.brandDomain && r.brandDomain !== name ? ` · ${r.brandDomain}` : "";
  const budget =
    r.runningDailyBudgetUsd > 0 ? ` · ${usd(r.runningDailyBudgetUsd)}/day running` : r.configuredDailyBudgetUsd > 0 ? ` · ${usd(r.configuredDailyBudgetUsd)}/day set, nothing running` : " · nothing funded";
  return `${name}${domain}${budget}`;
}

function StatedAmountsSection() {
  const queryClient = useQueryClient();
  const stated = useStated();
  const accounts = useAccounts();
  const today = utcToday();
  const [editing, setEditing] = useState<{ id: string | null; draft: StatedAmountDraft } | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removeFailure, setRemoveFailure] = useState<string | null>(null);

  const byPair = useMemo(() => new Map((accounts.data?.rows ?? []).map((r) => [pairKey(r.orgId, r.brandId), r])), [accounts.data]);
  const pickable = useMemo(
    () =>
      [...(accounts.data?.rows ?? [])].sort(
        (a, b) => b.runningDailyBudgetUsd - a.runningDailyBudgetUsd || b.configuredDailyBudgetUsd - a.configuredDailyBudgetUsd || accountName(a).localeCompare(accountName(b)),
      ),
    [accounts.data],
  );
  const rows = useMemo(
    () =>
      [...(stated.data ?? [])].sort((a, b) => {
        const al = isInForceToday(a.startDate, a.endDate, today);
        const bl = isInForceToday(b.startDate, b.endDate, today);
        if (al !== bl) return al ? -1 : 1;
        return (b.startDate ?? "").localeCompare(a.startDate ?? "");
      }),
    [stated.data, today],
  );

  const refusal = (err: unknown) => {
    console.error("[monitoring/revenue] stated amount write refused", err);
    return statedAmountErrorMessage(err instanceof ApiError ? err.status : null, err instanceof ApiError ? err.body : null);
  };
  /** A stated amount moves both run-rate halves: re-read the list and the board past the route's memory. */
  const afterWrite = async () => {
    await queryClient.refetchQueries({ queryKey: STATED_KEY });
    queryClient.setQueryData(BOARD_KEY, await getStaffRevenueBoard(true));
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setFailure(null);
    try {
      const body = statedAmountBody(editing.draft);
      if (editing.id) await updateStaffStatedAmount(editing.id, { amountUsd: body.amountUsd, startDate: body.startDate, endDate: body.endDate, note: body.note });
      else await createStaffStatedAmount(body);
    } catch (err) {
      setFailure(refusal(err));
      setSaving(false);
      return;
    }
    try {
      await afterWrite();
    } finally {
      setSaving(false);
      setEditing(null);
    }
  };

  const remove = async (id: string) => {
    setRemoving(id);
    setRemoveFailure(null);
    try {
      await deleteStaffStatedAmount(id);
    } catch (err) {
      setRemoveFailure(refusal(err));
      setRemoving(null);
      return;
    }
    try {
      await afterWrite();
    } finally {
      setRemoving(null);
    }
  };

  const edit = (row: StatedAmount) => {
    setFailure(null);
    setEditing({ id: row.id, draft: { orgId: row.orgId, brandId: row.brandId, amount: String(row.amountUsd), startDate: row.startDate ?? "", endDate: row.endDate ?? "", note: row.note ?? "" } });
  };
  const problem = editing ? statedAmountDraftProblem(editing.draft) : null;
  const set = (patch: Partial<StatedAmountDraft>) => setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e));

  return (
    <section>
      <SectionTitle
        count={stated.data?.length}
        right={
          <button type="button" className="k-btn" onClick={() => { setFailure(null); setEditing({ id: null, draft: EMPTY_STATED_AMOUNT_DRAFT }); }}>
            State an amount
          </button>
        }
      >
        What the agency&apos;s brands are worth
      </SectionTitle>
      <p className="k-fg2 -mt-1 mb-4 max-w-[860px] text-[13px]">
        An agency spreads its cash into daily budgets as it likes, so budget × 30 says how the money was split, not what the customer is worth. A person says it here. Stating an amount for a brand puts it in the agency half and takes its whole org out of the self-serve half.
      </p>
      {removeFailure && <p className="mb-3 text-[13px] text-[var(--data-rose)]">{removeFailure}</p>}
      {stated.isError && !stated.data ? (
        <Failed what="the stated amounts" error={stated.error?.message ?? "unknown error"} />
      ) : !stated.data ? (
        <ShimmerCard />
      ) : rows.length === 0 ? (
        <div className="k-card">
          <EmptyNote>Nothing stated yet, so every org is self-serve and the agency half is $0.</EmptyNote>
        </div>
      ) : (
        <div className="k-card overflow-hidden">
          <div className="k-scroll overflow-x-auto">
            <table className="w-full text-[13px] md:min-w-[720px]">
              <thead>
                <tr className="k-line-subtle border-b">
                  <th className={TH}>Brand</th>
                  <th className={THR}>Per month</th>
                  <th className={TH}>Period</th>
                  <th className={TH}>Note</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const account = byPair.get(pairKey(row.orgId, row.brandId));
                  const live = isInForceToday(row.startDate, row.endDate, today);
                  return (
                    <tr key={row.id} className="k-row k-line-subtle border-b last:border-b-0">
                      <td className={TD}>
                        <span className="font-medium">{account ? accountName(account) : row.brandId.slice(0, 8)}</span>
                        {account?.brandDomain && <span className="k-fg3 ml-2 text-[12px]">{account.brandDomain}</span>}
                        {!live && <span className="k-chip ml-2">Not in force today</span>}
                      </td>
                      <td className={`${TDR} font-medium`}>{usd(row.amountUsd)}</td>
                      <td className={`${TD} k-fg2`}>{termLabel(row.startDate, row.endDate)}</td>
                      <td className={`${TD} k-fg2`}>{row.note ?? <Dash />}</td>
                      <td className={`${TD} whitespace-nowrap text-right`}>
                        <button type="button" className="k-btn-ghost h-7 px-2 text-[12px]" disabled={removing !== null} onClick={() => edit(row)}>
                          Edit
                        </button>
                        <button type="button" className="k-btn-ghost h-7 px-2 text-[12px]" disabled={removing !== null} onClick={() => void remove(row.id)}>
                          {removing === row.id ? "Removing..." : "Remove"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {editing && (
        <SettingModal
          title={editing.id ? "Edit this stated amount" : "State an amount"}
          onClose={() => setEditing(null)}
          onSave={() => void save()}
          saving={saving}
          canSave={problem === null}
          failure={failure ?? (editing.draft.brandId !== "" ? problem : null)}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="k-label">Brand</span>
              <select
                className="k-input mt-1 w-full"
                value={editing.draft.brandId ? pairKey(editing.draft.orgId, editing.draft.brandId) : ""}
                disabled={editing.id !== null}
                onChange={(e) => {
                  const [orgId, brandId] = e.target.value.split("::");
                  set({ orgId: orgId ?? "", brandId: brandId ?? "" });
                }}
              >
                <option value="">Pick a brand</option>
                {pickable.map((r) => (
                  <option key={pairKey(r.orgId, r.brandId)} value={pairKey(r.orgId, r.brandId)}>
                    {optionLabel(r)}
                  </option>
                ))}
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className="k-label">Worth per month (USD)</span>
              <input className="k-input mt-1 w-full" inputMode="decimal" placeholder="4000" value={editing.draft.amount} onChange={(e) => set({ amount: e.target.value })} />
            </label>
            <label>
              <span className="k-label">From</span>
              <input className="k-input mt-1 w-full" type="date" value={editing.draft.startDate} onChange={(e) => set({ startDate: e.target.value })} />
              <span className="k-fg3 mt-1 block text-[12px]">Empty: since the brand&apos;s first day of spend</span>
            </label>
            <label>
              <span className="k-label">Until</span>
              <input className="k-input mt-1 w-full" type="date" value={editing.draft.endDate} onChange={(e) => set({ endDate: e.target.value })} />
              <span className="k-fg3 mt-1 block text-[12px]">Empty: still running</span>
            </label>
            <label className="sm:col-span-2">
              <span className="k-label">Note</span>
              <input className="k-input mt-1 w-full" placeholder="Why this amount" value={editing.draft.note} onChange={(e) => set({ note: e.target.value })} />
            </label>
          </div>
        </SettingModal>
      )}
    </section>
  );
}

// ─── Revenue consumed per audience ─────────────────────────────────────────

function PerAudienceSection({ board }: { board: Pick<RevenueBoard, "perVisitor" | "perSignup" | "perPaidClient"> | undefined }) {
  const cards: Array<{ title: string; part: Part<AvgSeries> | undefined; per: string; who: string; color: string }> = [
    { title: "Per unique visitor", part: board?.perVisitor, per: "per visitor", who: "visitors", color: "var(--data-sky)" },
    { title: "Per signup", part: board?.perSignup, per: "per signup", who: "signups", color: "var(--data-violet)" },
    { title: "Per paid client", part: board?.perPaidClient, per: "per client", who: "clients", color: "var(--data-teal)" },
  ];
  return (
    <section>
      <SectionTitle>Revenue consumed per audience</SectionTitle>
      <p className="k-fg2 -mt-1 mb-4 max-w-[860px] text-[13px]">Revenue consumed to date over every distinct person who ever reached each stage, each counted once. The chart is cumulative, so its last complete month is the headline.</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.title}>
            <p className="k-label mb-2">{c.title}</p>
            <PartView part={c.part} what={`revenue ${c.per}`}>
              {(s) => (
                <div className="space-y-3">
                  <StatTile label="Since inception" note={s.denominator === null ? undefined : `${s.denominator.toLocaleString("en-US")} ${c.who}`}>
                    <Figure value={s.pooledUsd === null ? <Dash /> : usd(s.pooledUsd)} unit={c.per} />
                  </StatTile>
                  <SeriesBars points={s.points} color={c.color} format={usd} rate={false} empty="Nothing measured yet." />
                </div>
              )}
            </PartView>
          </div>
        ))}
      </div>
    </section>
  );
}
