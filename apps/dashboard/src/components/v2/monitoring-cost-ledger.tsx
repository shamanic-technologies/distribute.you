"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getStaffLedgerCheck, getStaffOutcomeCoverage } from "@/lib/api";
import { formatCentsAsUsd } from "@/lib/format-number";
import { formatRatePct } from "@/lib/pipe-stats";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { DailyLines, SERIES_COLORS, type Line } from "@/components/v2/monitoring-charts";
import { Dash, Failed, Loading, OK, RED, TD, TDR, TH, Table, shortDay } from "@/components/v2/monitoring-sending";
import {
  COVERAGE_TARGET_PCT,
  belowTarget,
  coverageChart,
  headlinePoint,
  rolloutInProgress,
  serviceNames,
  servicesOn,
  tasksOn,
  type CoverageChartPoint,
  type CoveragePoint,
  type LedgerCheck,
  type LedgerMoney,
  type OutcomeCoverage,
} from "@/lib/monitoring/cost-ledger";

/**
 * Monitoring > Cost ledger (staff only, COST-ACCOUNTING-1023-MONITOR). The owner wants every outcome's
 * production cost exact to the cent: runs-service is the general ledger, and each spending service is
 * being wired to declare, on its runs, the outcomes it produced. Two pages, two hub tiles:
 * - Outcome coverage: the share of spend whose run declared its outcome, per UTC day, fleet + per
 *   service, red under the 95% target;
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
            <span style={{ color: red ? RED : undefined }}>{share(at.coveragePct)}</span>
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
  const lines: Line<CoverageChartPoint>[] = [
    { key: "fleet", label: "Fleet", color: "var(--fg-1)", get: (p) => p.fleet },
    { key: "target", label: "Target", color: RED, dashed: true, get: () => COVERAGE_TARGET_PCT },
    ...names.map((name, i) => ({ key: name, label: name, color: SERIES_COLORS[i % SERIES_COLORS.length], get: (p: CoverageChartPoint) => p.services[name] ?? null })),
  ];
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Spend with a declared outcome" note={`target ${COVERAGE_TARGET_PCT}%`}>
          <Figure value={at ? <span style={{ color: belowTarget(at) ? RED : OK }}>{share(at.coveragePct)}</span> : <Dash />} sub={at ? shortDay(at.day) : "no spend yet"} />
        </StatTile>
        <StatTile label="Spend that day" note="billed, gross">
          <Figure value={at ? usdExact(at.spendGrossCents) : <Dash />} sub={at ? `${usdExact(at.coveredGrossCents)} declared` : undefined} />
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
        <SectionTitle right={<span>Times are UTC</span>}>Share of spend with a declared outcome, per day</SectionTitle>
        <DailyLines
          points={points}
          lines={lines}
          format={(v) => formatRatePct(v)}
          windows={[{ key: "all", label: "All", days: null }]}
          caption={(p) => `${usdExact(p.coveredGrossCents)} of ${usdExact(p.spendGrossCents)} declared`}
          empty="Not enough computed days to draw a line yet."
          label="Share of spend with a declared outcome, fleet and per service, with the 95% target"
        />
      </section>

      {at && <DayTables data={data} day={at.day} />}
    </div>
  );
}

function CoverageCells({ p }: { p: CoveragePoint }) {
  return (
    <>
      <td className={TDR}>{usdExact(p.spendGrossCents)}</td>
      <td className={TDR}>{usdExact(p.coveredGrossCents)}</td>
      <td className={TDR}>{p.coveragePct == null ? <Dash /> : <span style={{ color: belowTarget(p) ? RED : OK }}>{share(p.coveragePct)}</span>}</td>
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
