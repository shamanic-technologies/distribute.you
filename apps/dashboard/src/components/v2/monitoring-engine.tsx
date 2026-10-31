"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { getStaffBrands } from "@/lib/api";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { PeriodBars, dayLabel } from "@/components/v2/monitoring-charts";
import { Failed, Loading, OK, RED } from "@/components/v2/monitoring-sending";
import { useFactoryShadowMonitoring } from "@/components/v2/monitoring-factory";
import { formatRatePct } from "@/lib/pipe-stats";
import {
  engineReasonWords,
  enginePlaceRows,
  regretPct,
  type EngineMonitoring,
  type EnginePlaceSummary,
  type FactoryShadowMonitoring,
} from "@/lib/factory-shadow";

/**
 * Monitoring > Factory plan > Engine pick (staff only, ENGINE-PER-OUTCOME-SHADOW, owner 2026-10-31). GTM Factory v10's
 * "one Engine per outcome", SHADOW: at each place of each live campaign (the outcome a leg makes), today's pick (the pipe
 * the campaign runs and its best-ROI workflow) beside the Engine's (Thompson sampling on value per dollar over every
 * workflow of every pipe making that outcome). Then the daily agreement and the 30-day replay regret. Nothing runs from
 * it. Red = the served `engine.verdict` only (a campaign's Engine or the replay failed); no email. Served figures only.
 */

const pct = (v: number | null | undefined) => (v == null ? null : formatRatePct(v));

function useBrandNames() {
  const brands = useAuthQuery(["staffBrands"], getStaffBrands, { staleTime: Infinity, retry: false });
  const byId = new Map((brands.data ?? []).map((b) => [b.id, b.name ?? b.domain ?? b.id]));
  return (id: string) => byId.get(id) ?? id.slice(0, 8);
}

function Verdict({ engine }: { engine: EngineMonitoring }) {
  const red = engine.verdict.red;
  const last = engine.last;
  return (
    <div className="k-card flex items-start gap-3 px-4 py-3">
      <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: red ? RED : OK }} aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[14px] font-medium" style={red ? { color: RED } : undefined}>
          {red
            ? `Broken: ${engine.verdict.reasons.map(engineReasonWords).join("; ")}.`
            : last && last.places > 0
              ? `Nothing broken. The Engine agrees with today's pick on ${last.agreed} of ${last.places} places.`
              : "Nothing broken. No place has both picks yet."}
        </p>
        <p className="k-fg3 mt-0.5 text-[12px]">Shadow only: nothing runs from it. Recomputed with the factory plan, every 3 hours.</p>
      </div>
    </div>
  );
}

// The workflow's served name already carries its channel ("Sales Cold Email Outreach Keel"): the name alone, the pipe on hover.
const pickName = (p: EnginePlaceSummary["today"]) => (p ? (p.workflowDynastyName ?? p.workflowDynastySlug) : null);

function Pick({ pick, reason }: { pick: EnginePlaceSummary["today"]; reason?: string | null }) {
  const name = pickName(pick);
  if (!name) return <span className="k-fg3 text-[12px]">{reason ? reason.replace(/_/g, " ") : "—"}</span>;
  return (
    <span className="block truncate" title={`${pick!.channelName}: ${name}`}>
      {name}
    </span>
  );
}

function PlaceRows({ data }: { data: FactoryShadowMonitoring }) {
  const brand = useBrandNames();
  const rows = enginePlaceRows(data);
  if (rows.length === 0) return <EmptyNote>No live campaign place has been read yet.</EmptyNote>;
  return (
    <div className="k-scroll overflow-x-auto">
      <table className="w-full min-w-[980px] table-fixed text-[13px]">
        <thead>
          <tr className="k-line-subtle border-b">
            <th className="k-label w-[220px] px-3 py-2.5 pl-4 text-left font-medium">Campaign</th>
            <th className="k-label w-[150px] px-3 py-2.5 text-left font-medium">Outcome</th>
            <th className="k-label px-3 py-2.5 text-left font-medium">Today&apos;s pick</th>
            <th className="k-label px-3 py-2.5 text-left font-medium">Engine&apos;s pick</th>
            <th className="k-label w-[120px] px-3 py-2.5 pr-4 text-right font-medium">Draws for today</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ campaign: c, place: p }) => (
            <tr key={`${c.campaignId}-${p.outcome}-${p.consumer}`} className="k-line-subtle border-b last:border-b-0">
              <td className="px-3 py-2 pl-4">
                <p className="truncate">{c.salesFunnelName}</p>
                <p className="k-fg3 truncate text-[12px]">{brand(c.brandId)}</p>
              </td>
              <td className="px-3 py-2">
                <p className="truncate">{p.outcomeName}</p>
                <p className="k-fg3 truncate text-[12px]">
                  {p.candidates} candidate{p.candidates === 1 ? "" : "s"}
                </p>
              </td>
              <td className="k-fg2 px-3 py-2">
                <Pick pick={p.today} reason={p.todayUnavailableReason} />
              </td>
              <td className="px-3 py-2">
                <span className="flex min-w-0 items-center gap-2">
                  {p.agrees !== null && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: p.agrees ? "var(--data-teal)" : "var(--data-violet)" }} aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1">
                    <Pick pick={p.engine} reason={p.state === "ok" ? null : p.state} />
                  </span>
                </span>
              </td>
              <td className="px-3 py-2 pr-4 text-right tabular-nums">{pct(p.todayPickSharePct) ?? <span className="k-fg4">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReplayRows({ engine }: { engine: EngineMonitoring }) {
  const replay = engine.replay;
  if (!replay) return <EmptyNote>The replay runs once a day; none yet.</EmptyNote>;
  if (replay.failure) return <EmptyNote>{`The replay failed: ${replay.failure}`}</EmptyNote>;
  if (replay.families.length === 0) return <EmptyNote>No outcome had a workflow to replay.</EmptyNote>;
  const cell = (v: string | null, good?: boolean) => (v == null ? <span className="k-fg4">—</span> : <span className={good ? "text-[var(--run)]" : ""}>{v}</span>);
  return (
    <div className="k-scroll overflow-x-auto">
      {replay.ledgerReconciled === false && (
        <p className="k-fg3 k-line-subtle border-b px-4 py-2.5 text-[12px]">
          {`Read while the cost ledger was not reconciled (${replay.ledgerDaysMissing ?? 0} days pending): figures may move once it is.`}
        </p>
      )}
      <table className="w-full min-w-[860px] text-[13px]">
        <thead>
          <tr className="k-line-subtle border-b">
            <th className="k-label px-3 py-2.5 pl-4 text-left font-medium">Outcome</th>
            <th className="k-label w-[160px] px-3 py-2.5 text-right font-medium">Workflows graded</th>
            <th className="k-label w-[130px] px-3 py-2.5 text-right font-medium">Decisions</th>
            <th className="k-label w-[140px] px-3 py-2.5 text-right font-medium">Regret today</th>
            <th className="k-label w-[140px] px-3 py-2.5 text-right font-medium">Regret Engine</th>
            <th className="k-label w-[150px] px-3 py-2.5 pr-4 text-right font-medium">Engine explores</th>
          </tr>
        </thead>
        <tbody>
          {replay.families.map((f) => (
            <tr key={f.outcome} className="k-line-subtle border-b last:border-b-0">
              <td className="px-3 py-2 pl-4">
                <p className="truncate">{f.outcomeName}</p>
                {f.reason && <p className="k-fg3 truncate text-[12px]">{f.reason.replace(/_/g, " ")}</p>}
              </td>
              <td className="k-fg2 px-3 py-2 text-right tabular-nums">{`${f.graded} of ${f.candidates}`}</td>
              <td className="k-fg2 px-3 py-2 text-right tabular-nums">{Math.round(f.windowDecisions).toLocaleString("en-US")}</td>
              <td className="px-3 py-2 text-right tabular-nums">{cell(regretPct(f.todayRegret))}</td>
              <td className="px-3 py-2 text-right tabular-nums">{cell(regretPct(f.engineRegret), f.regretGain != null && f.regretGain > 0)}</td>
              <td className="k-fg2 px-3 py-2 pr-4 text-right tabular-nums">{cell(pct(f.engineUngradedPct))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EngineView({ data }: { data: FactoryShadowMonitoring }) {
  const engine = data.engine;
  if (!engine) return <EmptyNote>The Engine shadow is not served yet.</EmptyNote>;
  const periods = engine.series.map((d) => ({ ...d, period: d.day }));
  const short = (d: string, s?: boolean) => dayLabel(d, s ? { month: "short", day: "numeric" } : undefined);
  const totals = engine.replay?.totals;
  return (
    <div className="space-y-8">
      <Verdict engine={engine} />

      <section>
        <SectionTitle count={engine.problems.length}>Broken</SectionTitle>
        <div className="k-card overflow-hidden">
          {engine.problems.length === 0 ? (
            <EmptyNote>Nothing broken on the last pass.</EmptyNote>
          ) : (
            <ul>
              {engine.problems.map((p) => (
                <li key={p.campaignId} className="k-line-subtle flex gap-3 border-b px-4 py-2 text-[13px] last:border-b-0">
                  <span className="truncate">{p.salesFunnelName}</span>
                  <span className="truncate" style={{ color: RED }}>
                    {p.failure}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <SectionTitle right={<span>places, per day</span>}>Does the Engine pick what we run?</SectionTitle>
        <PeriodBars
          periods={periods}
          series={[
            { key: "agreed", label: "Same pick", color: "var(--data-teal)", get: (d) => d.agreed },
            { key: "disagreed", label: "Another pick", color: "var(--data-violet)", get: (d) => d.disagreed ?? 0 },
          ]}
          caption={(d) => `${pct(d.agreementPct) ?? "—"} agree, ${pct(d.expectedAgreementPct) ?? "—"} of draws`}
          format={(v) => v.toLocaleString("en-US")}
          label={short}
          empty="No pass has compared the two picks yet."
        />
      </section>

      <section>
        <SectionTitle right={totals && totals.families > 0 ? <span>{`over ${engine.replay!.windowDays} days: ${regretPct(totals.todayRegret)} today, ${regretPct(totals.engineRegret)} Engine`}</span> : undefined}>
          Value per dollar lost, last 30 days
        </SectionTitle>
        <div className="k-card overflow-hidden">
          <ReplayRows engine={engine} />
        </div>
      </section>

      <section>
        <SectionTitle count={enginePlaceRows(data).length}>Today&apos;s pick vs the Engine&apos;s</SectionTitle>
        <div className="k-card overflow-hidden">
          <PlaceRows data={data} />
        </div>
      </section>
    </div>
  );
}

export function EnginePage() {
  const q = useFactoryShadowMonitoring();
  if (q.isError && !q.data) return <Failed what="the Engine pick" />;
  if (!q.data) return <Loading />;
  return <EngineView data={q.data} />;
}

/** The hub's one-second read: campaigns the Engine broke on, red ONLY on the served engine verdict. */
export function EngineTile({ href }: { href: string }) {
  const q = useFactoryShadowMonitoring();
  const engine = q.data?.engine;
  return (
    <StatTile label="Engine pick broken" note={engine?.last ? `${engine.last.places} places` : undefined} href={href}>
      <Figure
        value={
          q.isError && !q.data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : !q.data ? (
            <Shimmer className="h-6 w-16" />
          ) : !engine ? (
            <span className="k-fg4">—</span>
          ) : (
            <span style={{ color: engine.verdict.red ? RED : undefined }}>{engine.problems.length}</span>
          )
        }
        sub={!engine ? undefined : engine.verdict.red ? engine.verdict.reasons.map(engineReasonWords).join(", ") : "nothing broken"}
      />
    </StatTile>
  );
}
