"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getStaffLedgerCheck, getStaffLedgerReconciliation, getStaffOutcomeCoverage } from "@/lib/api";
import { formatCentsAsUsd } from "@/lib/format-number";
import { formatRatePct } from "@/lib/pipe-stats";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { DailyLines, PeriodBars, SERIES_COLORS, dayLabel, dollarsExact, type Line } from "@/components/v2/monitoring-charts";
import { Dash, Failed, Loading, OK, RED, TD, TDR, TH, Table, shortDay } from "@/components/v2/monitoring-sending";
import {
  COVERAGE_TARGET_PCT,
  RECON_PARTS,
  belowTarget,
  reconBlockers,
  reconDayState,
  reconPartDollars,
  undeclaredServices,
  unknownProvenance,
  coverageChart,
  headlinePoint,
  outcomeShare,
  rolloutInProgress,
  serviceNames,
  servicesOn,
  supportCents,
  supportFunctions,
  supportNotSplit,
  tasksOn,
  type CoverageChartPoint,
  type CoveragePoint,
  type LedgerCheck,
  type LedgerMoney,
  type LedgerReconciliation,
  type ReconDay,
  type OutcomeCoverage,
} from "@/lib/monitoring/cost-ledger";

/**
 * Monitoring > Cost ledger (staff only, COST-ACCOUNTING-1023-MONITOR). The owner wants every outcome's
 * production cost exact to the cent: runs-service is the general ledger, and each spending service is
 * being wired to declare, on its runs, the outcomes it produced. Two pages, two hub tiles:
 * - Outcome coverage: the share of OUTCOME spend whose run declared its outcome, per UTC day, fleet +
 *   per service, red under the 95% target; support spend (payment fees, brand setup, Copilot, ...)
 *   produces no outcome by design and is shown apart per function (owner 2026-10-24);
 * - To the cent: every org-day balances on gross, net and vendor, red with the failing org-days.
 * Red on the hub IS the alert (no email). This file draws the served figures; it computes none.
 */

const AMBER = "var(--data-amber)";
const usdExact = (cents: string) => formatCentsAsUsd(cents, 2);
/** A difference as served, exact to its last decimal: a tenth of a cent off still reads off. */
const cents = (c: string) => `${c}¢`;
const share = (pct: string | null) => (pct == null ? null : formatRatePct(Number(pct)));

export function useOutcomeCoverage() {
  return useAuthQuery(["staffOutcomeCoverage"], getStaffOutcomeCoverage, { ...pollOptions, retry: false });
}
export function useLedgerCheck() {
  return useAuthQuery(["staffLedgerCheck"], getStaffLedgerCheck, { ...pollOptions, retry: false });
}
export function useLedgerReconciliation() {
  return useAuthQuery(["staffLedgerReconciliation"], getStaffLedgerReconciliation, { ...pollOptions, retry: false });
}

// ─── Hub tiles ─────────────────────────────────────────────────────────────

/** The hub's one-second read: the fleet's served share on its latest finished day, red under the target. */
export function OutcomeCoverageTile({ href }: { href: string }) {
  const q = useOutcomeCoverage();
  const data = q.data;
  const at = data ? headlinePoint(data) : undefined;
  const red = at !== undefined && belowTarget(at);
  return (
    <StatTile label="Spend with a declared outcome" note={`target ${COVERAGE_TARGET_PCT}%`} href={href}>
      <Figure
        value={
          q.isError && !data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : at === undefined ? (
            <Shimmer className="h-6 w-16" />
          ) : at === null ? (
            <Dash />
          ) : (
            <span style={{ color: red ? RED : undefined }}>{share(outcomeShare(at))}</span>
          )
        }
        sub={data && at ? (rolloutInProgress(data) ? "rollout in progress" : shortDay(at.day)) : at === null ? "no spend yet" : undefined}
      />
    </StatTile>
  );
}

/** The hub's one-second read of the to-the-cent check: Balanced, or how many org-days are off (red). */
export function LedgerCheckTile({ href }: { href: string }) {
  const q = useLedgerCheck();
  const data = q.data;
  const off = data?.mismatches.length;
  return (
    <StatTile label="Cost ledger to the cent" note={data ? `${shortDay(data.since)} to ${shortDay(data.until)}` : undefined} href={href}>
      <Figure
        value={
          q.isError && !data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : !data ? (
            <Shimmer className="h-6 w-24" />
          ) : data.balanced ? (
            "Balanced"
          ) : (
            <span style={{ color: RED }}>
              {off} org-day{off === 1 ? "" : "s"} off
            </span>
          )
        }
        sub={data ? (data.daysMissing.length ? `${data.daysMissing.length} days not computed yet` : "every day checked") : undefined}
      />
    </StatTile>
  );
}

/** The hub's one-second read of the reconciliation (LEDGER-RECON-MONITOR-1024): Yes, or No in red until it reconciles. */
export function ReconciliationTile({ href }: { href: string }) {
  const q = useLedgerReconciliation();
  const data = q.data;
  const why = data ? reconBlockers(data) : [];
  return (
    <StatTile label="Cost ledger reconciled" note={data ? `since ${shortDay(data.since)}` : undefined} href={href}>
      <Figure
        value={
          q.isError && !data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : !data ? (
            <Shimmer className="h-6 w-16" />
          ) : data.reconciled ? (
            "Yes"
          ) : (
            <span style={{ color: RED }}>No</span>
          )
        }
        sub={data ? (data.reconciled ? "every dollar in one part" : why[0]) : undefined}
      />
    </StatTile>
  );
}

// ─── Outcome coverage page ─────────────────────────────────────────────────

export function OutcomeCoveragePage() {
  const q = useOutcomeCoverage();
  if (q.isError && !q.data) return <Failed what="the outcome coverage" />;
  if (!q.data) return <Loading />;
  return <CoverageView data={q.data} />;
}

export function CoverageView({ data }: { data: OutcomeCoverage }) {
  const at = headlinePoint(data);
  const rollout = rolloutInProgress(data);
  const points = coverageChart(data);
  const names = serviceNames(data);
  const notSplit = data.supportDaysMissing ?? [];
  const lines: Line<CoverageChartPoint>[] = [
    { key: "fleet", label: "Fleet", color: "var(--fg-1)", get: (p) => p.fleet },
    { key: "target", label: "Target", color: RED, dashed: true, get: () => COVERAGE_TARGET_PCT },
    ...names.map((name, i) => ({ key: name, label: name, color: SERIES_COLORS[i % SERIES_COLORS.length], get: (p: CoverageChartPoint) => p.services[name] ?? null })),
  ];
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Spend with a declared outcome" note={`target ${COVERAGE_TARGET_PCT}%`}>
          <Figure
            value={at ? <span style={{ color: belowTarget(at) ? RED : OK }}>{share(outcomeShare(at))}</span> : <Dash />}
            sub={at ? `${shortDay(at.day)}, support apart` : "no spend yet"}
          />
        </StatTile>
        <StatTile label="Spend that day" note="billed, gross">
          <Figure
            value={at ? usdExact(at.spendGrossCents) : <Dash />}
            sub={at ? `${usdExact(at.coveredGrossCents)} declared, ${at.supportGrossCents == null ? "support not served" : `${usdExact(at.supportGrossCents)} support`}` : undefined}
          />
        </StatTile>
        <StatTile label="Services spending" note="in the window">
          <Figure value={names.length} />
        </StatTile>
        <StatTile label="Days computed" note={`${shortDay(data.since)} to ${shortDay(data.until)}`}>
          <Figure value={data.fleet.length} sub={data.daysMissing.length ? `${data.daysMissing.length} not computed yet` : undefined} />
        </StatTile>
      </div>

      {rollout && (
        <p className="k-card k-fg2 px-4 py-2.5 text-[13px]">
          <span style={{ color: AMBER }}>Rollout in progress.</span> No service declares the outcomes of its runs yet. Each line rises as its service is wired.
        </p>
      )}

      <section>
        <SectionTitle right={<span>Times are UTC</span>}>Share of outcome spend with a declared outcome, per day</SectionTitle>
        {notSplit.length > 0 && (
          <p className="k-card k-fg2 mb-3 px-4 py-2.5 text-[13px]">
            <span style={{ color: AMBER }}>Support not split yet on {notSplit.length === 1 ? shortDay(notSplit[0]) : `${shortDay(notSplit[0])} to ${shortDay(notSplit[notSplit.length - 1])}`}.</span>{" "}
            The share there still counts support as spend with no outcome, until runs-service recomputes the day.
          </p>
        )}
        <DailyLines
          points={points}
          lines={lines}
          format={(v) => formatRatePct(v)}
          windows={[{ key: "all", label: "All", days: null }]}
          caption={(p) =>
            `${usdExact(p.coveredGrossCents)} declared of ${usdExact(p.spendGrossCents)}, ${p.supportNotSplit ? "support not split yet" : p.supportGrossCents == null ? "support not served" : `${usdExact(p.supportGrossCents)} support apart`}`
          }
          empty="Not enough computed days to draw a line yet."
          label="Share of outcome spend with a declared outcome, fleet and per service, with the 95% target"
        />
      </section>

      <SupportSection data={data} />

      {at && <DayTables data={data} day={at.day} />}
    </div>
  );
}

/** Support spend per function per day: no outcome by design, so never in the share. Stacked bars, served cents. */
function SupportSection({ data }: { data: OutcomeCoverage }) {
  const fns = supportFunctions(data);
  const at = headlinePoint(data);
  const periods = data.fleet.map((p) => ({ ...p, period: p.day }));
  return (
    <section>
      <SectionTitle count={fns.length} right={<span>gross, per day</span>}>
        Support spend, per function
      </SectionTitle>
      {fns.length === 0 ? (
        <div className="k-card">
          <EmptyNote>No spend marked as support in the window yet.</EmptyNote>
        </div>
      ) : (
        <PeriodBars
          periods={periods}
          series={fns.map((f, i) => ({ key: f.key, label: f.label, color: SERIES_COLORS[i % SERIES_COLORS.length], get: (p: CoveragePoint) => supportCents(p, f.key) / 100 }))}
          format={dollarsExact}
          label={(day, short) => (short ? shortDay(day) : dayLabel(day))}
          caption={(p) => (supportNotSplit(data, p.day) ? "not split yet" : p.supportGrossCents == null ? "not served" : `${usdExact(p.supportGrossCents)} support`)}
          initial={at ? (periods.find((p) => p.day === at.day) ?? null) : null}
          empty="No computed day yet."
        />
      )}
    </section>
  );
}

function CoverageCells({ p }: { p: CoveragePoint }) {
  return (
    <>
      <td className={TDR}>{usdExact(p.spendGrossCents)}</td>
      <td className={TDR}>{usdExact(p.coveredGrossCents)}</td>
      <td className={TDR}>{p.supportGrossCents == null ? <Dash /> : usdExact(p.supportGrossCents)}</td>
      <td className={TDR}>{outcomeShare(p) == null ? <Dash /> : <span style={{ color: belowTarget(p) ? RED : OK }}>{share(outcomeShare(p))}</span>}</td>
    </>
  );
}

/** The headline day, per service then per task, in the producer's order. */
function DayTables({ data, day }: { data: OutcomeCoverage; day: string }) {
  const services = servicesOn(data, day);
  const tasks = tasksOn(data, day);
  const head = (first: React.ReactNode) => (
    <>
      {first}
      <th className={`${TH} text-right`}>Spend, gross</th>
      <th className={`${TH} text-right`}>Declared</th>
      <th className={`${TH} text-right`}>Support</th>
      <th className={`${TH} text-right`}>Share</th>
    </>
  );
  return (
    <>
      <section>
        <SectionTitle count={services.length} right={<span>{shortDay(day)}</span>}>
          Per service
        </SectionTitle>
        {services.length === 0 ? (
          <div className="k-card">
            <EmptyNote>No service spent that day.</EmptyNote>
          </div>
        ) : (
          <Table head={head(<th className={TH}>Service</th>)}>
            {services.map((s) => (
              <tr key={s.serviceName} className="k-row">
                <td className={`${TD} k-mono text-[12px]`}>{s.serviceName}</td>
                <CoverageCells p={s} />
              </tr>
            ))}
          </Table>
        )}
      </section>
      <section>
        <SectionTitle count={tasks.length} right={<span>{shortDay(day)}</span>}>
          Per task
        </SectionTitle>
        {tasks.length === 0 ? (
          <div className="k-card">
            <EmptyNote>No task spent that day.</EmptyNote>
          </div>
        ) : (
          <Table
            head={head(
              <>
                <th className={TH}>Service</th>
                <th className={TH}>Task</th>
              </>,
            )}
          >
            {tasks.map((t) => (
              <tr key={`${t.serviceName}|${t.taskName}`} className="k-row">
                <td className={`${TD} k-mono text-[12px]`}>{t.serviceName}</td>
                <td className={`${TD} k-mono text-[12px]`}>{t.taskName}</td>
                <CoverageCells p={t} />
              </tr>
            ))}
          </Table>
        )}
      </section>
    </>
  );
}

// ─── To-the-cent page ──────────────────────────────────────────────────────

export function LedgerCheckPage() {
  const q = useLedgerCheck();
  if (q.isError && !q.data) return <Failed what="the ledger check" />;
  if (!q.data) return <Loading />;
  return <LedgerCheckView data={q.data} />;
}

function MoneyCells({ m }: { m: LedgerMoney }) {
  return (
    <>
      <td className={TDR}>{usdExact(m.grossCents)}</td>
      <td className={TDR}>{usdExact(m.netCents)}</td>
      <td className={TDR}>{usdExact(m.vendorCents)}</td>
    </>
  );
}

export function LedgerCheckView({ data }: { data: LedgerCheck }) {
  const t = data.totals;
  return (
    <div className="space-y-8">
      <div className="k-card flex items-center gap-3 px-4 py-3">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: data.balanced ? OK : RED }} aria-hidden="true" />
        <p className="text-[14px] font-medium">
          {data.balanced
            ? "Every computed org-day balances to the cent on gross, net and vendor."
            : data.mismatches.length === 1
              ? "1 org-day does not balance."
              : `${data.mismatches.length} org-days do not balance.`}
        </p>
      </div>
      {data.daysMissing.length > 0 && (
        <p className="k-card k-fg2 px-4 py-2.5 text-[13px]">
          <span style={{ color: AMBER }}>
            {data.daysMissing.length} day{data.daysMissing.length === 1 ? "" : "s"} not computed yet
          </span>
          , from {shortDay(data.daysMissing[0])} to {shortDay(data.daysMissing[data.daysMissing.length - 1])}. runs-service fills them in its 15-minute refresh; they are not checked until then.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Ledger, gross" note="every cost row">
          <Figure value={usdExact(t.ledger.grossCents)} />
        </StatTile>
        <StatTile label="Standard cost" note="on outcomes">
          <Figure value={usdExact(t.standard.grossCents)} />
        </StatTile>
        <StatTile label="Reuse gain" note="charged, not spent">
          <Figure value={usdExact(t.reuseGain.grossCents)} />
        </StatTile>
        <StatTile label="Spent with no outcome" note="no run declared one">
          <Figure value={usdExact(t.producedNone.grossCents)} />
        </StatTile>
      </div>

      <section>
        <SectionTitle>The equation, over the window</SectionTitle>
        <Table
          head={
            <>
              <th className={TH}>Line</th>
              <th className={`${TH} text-right`}>Gross</th>
              <th className={`${TH} text-right`}>Net</th>
              <th className={`${TH} text-right`}>Vendor</th>
            </>
          }
        >
          <tr className="k-row">
            <td className={TD}>Standard cost on outcomes</td>
            <MoneyCells m={t.standard} />
          </tr>
          <tr className="k-row">
            <td className={TD}>minus reuse gain</td>
            <MoneyCells m={t.reuseGain} />
          </tr>
          <tr className="k-row">
            <td className={TD}>plus spend with no outcome</td>
            <MoneyCells m={t.producedNone} />
          </tr>
          <tr className="k-row">
            <td className={`${TD} font-medium`}>equals the ledger</td>
            <MoneyCells m={t.ledger} />
          </tr>
        </Table>
      </section>

      <section>
        <SectionTitle count={data.mismatches.length}>Org-days that do not balance</SectionTitle>
        {data.mismatches.length === 0 ? (
          <div className="k-card">
            <EmptyNote>None. Every computed org-day balances.</EmptyNote>
          </div>
        ) : (
          <Table
            head={
              <>
                <th className={TH}>Day</th>
                <th className={TH}>Org</th>
                <th className={`${TH} text-right`}>Off, gross</th>
                <th className={`${TH} text-right`}>Off, net</th>
                <th className={`${TH} text-right`}>Off, vendor</th>
                <th className={`${TH} text-right`}>Cost rows</th>
              </>
            }
          >
            {data.mismatches.map((r) => (
              <tr key={`${r.day}|${r.organizationId}`} className="k-row">
                <td className={`${TD} k-mono k-fg2 whitespace-nowrap text-[12px]`}>{r.day}</td>
                <td className={`${TD} k-mono text-[12px]`}>{r.organizationId ?? "No org (platform)"}</td>
                <td className={`${TDR} k-mono text-[12px]`} style={{ color: RED }}>
                  {cents(r.differences.grossCents)}
                </td>
                <td className={`${TDR} k-mono text-[12px]`} style={{ color: RED }}>
                  {cents(r.differences.netCents)}
                </td>
                <td className={`${TDR} k-mono text-[12px]`} style={{ color: RED }}>
                  {cents(r.differences.vendorCents)}
                </td>
                <td className={TDR}>{r.costRows.toLocaleString("en-US")}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <p className="k-fg3 text-[12px]">Allocation rule {data.allocationRule}</p>
    </div>
  );
}

// ─── Reconciliation page (LEDGER-RECON-MONITOR-1024) ───────────────────────

export function ReconciliationPage() {
  const q = useLedgerReconciliation();
  if (q.isError && !q.data) return <Failed what="the ledger reconciliation" />;
  if (!q.data) return <Loading />;
  return <ReconciliationView data={q.data} />;
}

const plural = (n: number, w: string) => `${n.toLocaleString("en-US")} ${w}${n === 1 ? "" : "s"}`;
/** A served 0..1 share as a whole %. */
const ratio = (v: string | null) => (v == null ? null : formatRatePct(Number(v) * 100));
/** A served count of consumptions (10 decimals, a whole number unless a production order makes several outcomes). */
const count = (v: string) => Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 });

export function ReconciliationView({ data }: { data: LedgerReconciliation }) {
  const t = data.totals;
  const why = reconBlockers(data);
  const services = undeclaredServices(data);
  const provenance = unknownProvenance(data);
  const periods = data.days.map((d) => ({ ...d, period: d.day }));
  const lastComputed = [...periods].reverse().find((d) => reconDayState(d) !== "missing") ?? null;
  // The totals hold computed days only: with none, they are not a zero, they are not there yet.
  const anyInTotals = data.days.some((d) => reconDayState(d) === "computed");
  return (
    <div className="space-y-8">
      <div className="k-card flex items-start gap-3 px-4 py-3">
        <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: data.reconciled ? OK : RED }} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[14px] font-medium">
            {data.reconciled ? "Reconciled. Every dollar spent lands in exactly one part, to the cent." : "Not reconciled yet."}
          </p>
          {why.length > 0 && <p className="k-fg2 mt-0.5 text-[13px]">{why.map((w) => w[0].toUpperCase() + w.slice(1)).join(". ")}.</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Adds up to the cent" note="every computed day">
          <Figure value={<span style={{ color: data.balanced ? OK : RED }}>{data.balanced ? "Yes" : "No"}</span>} sub={data.unbalancedDays.length ? plural(data.unbalancedDays.length, "day") + " off" : undefined} />
        </StatTile>
        <StatTile label="Every day computed" note={`${shortDay(data.since)} to ${shortDay(data.until)}`}>
          <Figure
            value={<span style={{ color: data.complete ? OK : RED }}>{data.complete ? "Yes" : "No"}</span>}
            sub={data.daysMissing.length ? `${plural(data.daysMissing.length, "day")} not in the totals` : undefined}
          />
        </StatTile>
        <StatTile label="All declared" note="on computed days">
          <Figure
            value={<span style={{ color: data.declarationsComplete ? OK : RED }}>{data.declarationsComplete ? "Yes" : "No"}</span>}
            sub={services.length || provenance.length ? `${plural(services.length, "service")}, ${plural(provenance.length, "outcome")} below` : undefined}
          />
        </StatTile>
        <StatTile label="Spend in the totals" note="billed, gross">
          <Figure value={anyInTotals ? usdExact(t.spend.grossCents) : <Dash />} sub={anyInTotals ? (data.daysMissing.length ? "computed days only" : undefined) : "no day computed yet"} />
        </StatTile>
      </div>

      <section>
        <SectionTitle right={<span>gross, per UTC day</span>}>Where each dollar of spend went, per day</SectionTitle>
        {data.daysMissing.length > 0 && (
          <p className="k-card k-fg2 mb-3 px-4 py-2.5 text-[13px]">
            <span style={{ color: AMBER }}>{plural(data.daysMissing.length, "day")} not in the totals yet.</span> Pale columns are days runs-service has not computed;
            faded bars are days it computed before a fact recorded since and will recompute. Neither reads as zero.
          </p>
        )}
        <PeriodBars
          periods={periods}
          series={RECON_PARTS.map((p) => ({ key: p.key, label: p.label, color: p.color, get: (d: ReconDay) => reconPartDollars(d, p.key) }))}
          format={dollarsExact}
          label={(day, short) => (short ? shortDay(day) : dayLabel(day))}
          state={(d) => (reconDayState(d) === "computed" ? null : reconDayState(d) === "stale" ? "stale" : "missing")}
          caption={(d) =>
            reconDayState(d) === "missing"
              ? "not computed yet"
              : `${usdExact(d.spend.grossCents)} spent${reconDayState(d) === "stale" ? ", to recompute" : ""}${d.balanced ? "" : ", does not add up"}`
          }
          initial={lastComputed}
          empty="No day of spend yet."
        />
      </section>

      <section>
        <SectionTitle>The parts, over the computed days</SectionTitle>
        {!anyInTotals ? (
          <div className="k-card">
            <EmptyNote>No day computed yet: the totals fill in as runs-service computes each day.</EmptyNote>
          </div>
        ) : (
        <Table
          head={
            <>
              <th className={TH}>Part</th>
              <th className={`${TH} text-right`}>Gross</th>
              <th className={`${TH} text-right`}>Net</th>
              <th className={`${TH} text-right`}>Vendor</th>
              <th className={`${TH} text-right`}>Share</th>
            </>
          }
        >
          {RECON_PARTS.map((p) => (
            <tr key={p.key} className="k-row">
              <td className={TD}>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-[2px]" style={{ background: p.color }} aria-hidden="true" />
                  {p.label}
                </span>
              </td>
              <MoneyCells m={t[p.key]} />
              <td className={TDR}>{ratio(t.shares[p.key].gross) ?? <Dash />}</td>
            </tr>
          ))}
          <tr className="k-row">
            <td className={`${TD} font-medium`}>Spend</td>
            <MoneyCells m={t.spend} />
            <td className={TDR} />
          </tr>
          <tr className="k-row">
            <td className={TD}>Off by</td>
            <td className={`${TDR} k-mono text-[12px]`} style={{ color: data.balanced ? undefined : RED }}>{cents(t.differences.grossCents)}</td>
            <td className={`${TDR} k-mono text-[12px]`} style={{ color: data.balanced ? undefined : RED }}>{cents(t.differences.netCents)}</td>
            <td className={`${TDR} k-mono text-[12px]`} style={{ color: data.balanced ? undefined : RED }}>{cents(t.differences.vendorCents)}</td>
            <td className={TDR} />
          </tr>
        </Table>
        )}
      </section>

      <section>
        <SectionTitle count={services.length}>Services spending with no outcome declared</SectionTitle>
        {services.length === 0 ? (
          <div className="k-card">
            <EmptyNote>None. Every service declares what its spend produced.</EmptyNote>
          </div>
        ) : (
          <Table
            head={
              <>
                <th className={TH}>Service</th>
                <th className={`${TH} text-right`}>Undeclared, gross</th>
                <th className={`${TH} text-right`}>Runs</th>
                <th className={`${TH} text-right`}>Share of its spend</th>
              </>
            }
          >
            {services.map((s) => (
              <tr key={s.serviceName ?? "none"} className="k-row">
                <td className={`${TD} k-mono text-[12px]`}>{s.serviceName ?? "No service named"}</td>
                <td className={TDR} style={{ color: RED }}>
                  {usdExact(s.undeclared.grossCents)}
                </td>
                <td className={TDR}>{s.undeclaredRuns.toLocaleString("en-US")}</td>
                <td className={TDR}>{ratio(s.undeclaredShareOfSpend) ?? <Dash />}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <section>
        <SectionTitle count={provenance.length}>Outcomes used with no known producer</SectionTitle>
        {provenance.length === 0 ? (
          <div className="k-card">
            <EmptyNote>None. Every outcome used was declared by the run that made it.</EmptyNote>
          </div>
        ) : (
          <Table
            head={
              <>
                <th className={TH}>Outcome used</th>
                <th className={TH}>Used by</th>
                <th className={`${TH} text-right`}>No known producer</th>
                <th className={`${TH} text-right`}>Of uses</th>
                <th className={`${TH} text-right`}>Share</th>
              </>
            }
          >
            {provenance.map((p) => (
              <tr key={`${p.consumedOutcomeKey}|${p.consumingServiceName}`} className="k-row">
                <td className={`${TD} k-mono text-[12px]`}>{p.consumedOutcomeKey}</td>
                <td className={`${TD} k-mono text-[12px]`}>{p.consumingServiceName ?? "No service named"}</td>
                <td className={TDR} style={{ color: RED }}>
                  {count(p.unknownProvenance)}
                </td>
                <td className={TDR}>{count(p.consumptions)}</td>
                <td className={TDR}>{ratio(p.unknownShare) ?? <Dash />}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>

      <p className="k-fg3 text-[12px]">Allocation version {data.allocationVersion}</p>
    </div>
  );
}
