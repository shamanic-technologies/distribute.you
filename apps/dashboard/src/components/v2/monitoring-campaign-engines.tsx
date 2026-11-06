"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { getStaffAbsorbedCosts } from "@/lib/api";
import { formatRatePct } from "@/lib/pipe-stats";
import { formatCentsAsUsdAdaptive } from "@/lib/format-number";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { DailyLines, dayLabel, type Line } from "@/components/v2/monitoring-charts";
import { Dash, Failed, Loading, OK, RED, TD, TDR, TH, THR, Table } from "@/components/v2/monitoring-sending";
import { useScriptsMonitoring } from "@/components/v2/monitoring-scripts";
import {
  brokenEngines,
  dollarsPerRun,
  enginesInOrder,
  enginesOnWorkflow,
  toPct,
  type EngineMonitoring,
  type EngineOutcome,
  type EnginePath,
} from "@/lib/monitoring/scripts-monitoring";

/**
 * Monitoring > Scripts > Campaigns (staff only, MIGRATE-1105 S2b). workflow-service serves, per outcome a campaign
 * reaches, its runs by stored script (no workflow) beside its runs by workflow, per day and per client, with failures
 * and spend. Red = the served verdict (the script fails more than the workflow did). An outcome still on a workflow is
 * shown in normal colours: it is "not yet", not broken. This file draws served values; it only converts units.
 */

const SCRIPT = "var(--data-teal)";
const WORKFLOW = "var(--data-violet)";
const ALL = [{ key: "all", label: "All", days: null }];

const n = (v: number) => v.toLocaleString("en-US");
const money = (c: number | null | undefined) => (c == null ? null : formatCentsAsUsdAdaptive(c));
const rate = (r: number | null | undefined) => (r == null ? null : formatRatePct(toPct(r)!));

type Day = EngineOutcome["days"][number];

function Dot({ color }: { color: string }) {
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />;
}

/** Org id -> its name, from the staff customers read the hub already makes (same query key, one fetch). */
function useOrgNames(): Map<string, string> {
  const q = useAuthQuery(["staffAbsorbedCosts"], getStaffAbsorbedCosts, { staleTime: 10 * 60_000, retry: false });
  const m = new Map<string, string>();
  for (const c of q.data?.customers ?? []) if (c.orgName) m.set(c.orgId, c.orgName);
  return m;
}

/** An Engine's outcome in the catalogue's own plural words (features-service `pluralLabel`); unknown = the key as served. */
export function useEngineNames(): (outcome: string) => string {
  const catalogue = useLegCatalogue();
  return (outcome) => {
    const step = catalogue.steps.get(outcome);
    return step?.pluralLabel ?? step?.label ?? (outcome === "unassigned" ? "No outcome on record" : outcome);
  };
}

function status(o: EngineOutcome): { words: string; color: string } {
  if (o.red) return { words: "Red", color: RED };
  if (o.onWorkflow) return { words: "Still on a workflow", color: WORKFLOW };
  return { words: "Script only", color: OK };
}

function Cell({ v, children }: { v: unknown; children?: React.ReactNode }) {
  return <>{v == null ? <Dash /> : children}</>;
}

function ClientsTable({ o, names }: { o: EngineOutcome; names: Map<string, string> }) {
  const failed = (p: EnginePath) => (p && p.completed + p.failed > 0 ? `${n(p.failed)} (${rate(p.errorRate)})` : null);
  return (
    <Table
      head={
        <>
          <th className={TH}>Client</th>
          <th className={THR}>Script runs</th>
          <th className={THR}>Failed</th>
          <th className={THR}>Workflow runs</th>
          <th className={THR}>Failed</th>
          <th className={THR}>Spend, 7 days</th>
          <th className={THR}>Last on a workflow</th>
        </>
      }
    >
      {o.orgs.map((c) => {
        const spend = (c.script?.spendCents ?? null) === null && (c.workflow?.spendCents ?? null) === null ? null : (c.script?.spendCents ?? 0) + (c.workflow?.spendCents ?? 0);
        const sFailed = failed(c.script);
        const wFailed = failed(c.workflow);
        return (
          <tr key={c.orgId} className="k-row">
            <td className={TD}>{names.get(c.orgId) ?? <span className="k-mono k-fg2 text-[12px]">{c.orgId.slice(0, 8)}</span>}</td>
            <td className={TDR}>{c.script?.runs ? n(c.script.runs) : <Dash />}</td>
            <td className={TDR}>
              <Cell v={sFailed}>{sFailed}</Cell>
            </td>
            <td className={TDR}>{c.workflow?.runs ? n(c.workflow.runs) : <Dash />}</td>
            <td className={TDR}>
              <Cell v={wFailed}>{wFailed}</Cell>
            </td>
            <td className={TDR}>
              <Cell v={spend}>{money(spend)}</Cell>
            </td>
            <td className={`${TDR} k-mono k-fg2 text-[12px]`}>{c.lastWorkflowDay ? dayLabel(c.lastWorkflowDay, { month: "short", day: "numeric" }) : <Dash />}</td>
          </tr>
        );
      })}
    </Table>
  );
}

function OutcomeBlock({ o, names, nameOf }: { o: EngineOutcome; names: Map<string, string>; nameOf: (outcome: string) => string }) {
  const st = status(o);
  const pair = (get: (p: NonNullable<EnginePath>) => number | null): Line<Day>[] => [
    { key: "script", label: "Script", color: SCRIPT, get: (d) => (d.script ? get(d.script) : null) },
    { key: "workflow", label: "Workflow", color: WORKFLOW, get: (d) => (d.workflow ? get(d.workflow) : null) },
  ];
  const runsPair: Line<Day>[] = [
    { key: "script", label: "Script", color: SCRIPT, get: (d) => d.script?.runs ?? 0 },
    { key: "workflow", label: "Workflow", color: WORKFLOW, get: (d) => d.workflow?.runs ?? 0 },
  ];
  const empty = "Fewer than 2 days stored yet.";
  const name = nameOf(o.outcome);
  const v = o.verdict;
  return (
    <section className="space-y-4">
      <SectionTitle
        right={
          <span className="inline-flex items-center gap-1.5" style={o.red ? { color: RED } : undefined}>
            <Dot color={st.color} />
            {st.words}
          </span>
        }
      >
        {name}
      </SectionTitle>
      <p className="k-fg3 -mt-2 text-[12px] tabular-nums">
        {v.scriptFinishedRuns > 0 ? `Script, today and yesterday: ${rate(v.scriptErrorRate)} failed of ${n(v.scriptFinishedRuns)} runs. ` : "No script run today or yesterday. "}
        {v.workflowErrorRate != null ? `Workflow over the window: ${rate(v.workflowErrorRate)} failed.` : "No workflow run in the window."}
        {o.red && <span style={{ color: RED }}> The script fails more often than the workflow did.</span>}
      </p>
      <ClientsTable o={o} names={names} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div>
          <SectionTitle right={<span>per day</span>}>Runs</SectionTitle>
          <DailyLines points={o.days} lines={runsPair} format={(x) => n(Math.round(x))} windows={ALL} empty={empty} label={`${name}: runs per day`} />
        </div>
        <div>
          <SectionTitle right={<span>per day</span>}>Failed</SectionTitle>
          <DailyLines points={o.days} lines={pair((p) => toPct(p.errorRate))} format={(x) => formatRatePct(x)} windows={ALL} empty={empty} label={`${name}: failure rate per day`} />
        </div>
        <div>
          <SectionTitle right={<span>per day</span>}>Cost per run</SectionTitle>
          <DailyLines points={o.days} lines={pair((p) => p.costPerRunCents)} format={(x) => dollarsPerRun(x)} windows={ALL} empty={empty} label={`${name}: cost per run per day`} />
        </div>
      </div>
    </section>
  );
}

export function CampaignEnginesView({ data, names, nameOf }: { data: EngineMonitoring; names: Map<string, string>; nameOf: (outcome: string) => string }) {
  const broken = brokenEngines(data);
  const onWorkflow = enginesOnWorkflow(data);
  return (
    <div className="space-y-10">
      <div className="k-card flex items-start gap-3 px-4 py-3">
        <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: broken.length ? RED : OK }} aria-hidden="true" />
        <div className="min-w-0">
          {broken.map((o) => (
            <p key={o.outcome} className="text-[14px] font-medium" style={{ color: RED }}>
              {nameOf(o.outcome)}: the script fails more often than the workflow did.
            </p>
          ))}
          <p className="text-[14px] font-medium">
            {onWorkflow.length === 0
              ? "Every campaign outcome ran on a script today."
              : `${onWorkflow.length} of ${data.outcomes.length} outcomes still ran on a workflow today: ${onWorkflow.map((o) => nameOf(o.outcome)).join(", ")}.`}
          </p>
          <p className="k-fg3 mt-0.5 text-[12px]">
            Since {dayLabel(data.since)}. Red only when a script fails more often than the workflow it replaces, with at least {n(data.minRunsForRed)} runs. Spend is each
            client&apos;s runs times its sampled cost per run, from yesterday back.
          </p>
        </div>
      </div>
      {data.outcomes.length === 0 ? (
        <div className="k-card">
          <EmptyNote>No campaign run stored yet.</EmptyNote>
        </div>
      ) : (
        enginesInOrder(data).map((o) => <OutcomeBlock key={o.outcome} o={o} names={names} nameOf={nameOf} />)
      )}
    </div>
  );
}

export function CampaignEnginesPage() {
  const q = useScriptsMonitoring();
  const names = useOrgNames();
  const nameOf = useEngineNames();
  if (q.isError && !q.data) return <Failed what="the campaign runs" />;
  if (!q.data) return <Loading />;
  if (!q.data.engines) {
    return (
      <div className="k-card">
        <EmptyNote>Production does not serve campaign runs yet.</EmptyNote>
      </div>
    );
  }
  return <CampaignEnginesView data={q.data.engines} names={names} nameOf={nameOf} />;
}

/** The hub's one-second read: how many outcomes still ran on a workflow today; red only when a script is broken. */
export function CampaignEnginesTile({ href }: { href: string }) {
  const q = useScriptsMonitoring();
  const nameOf = useEngineNames();
  const e = q.data?.engines;
  const broken = q.data ? brokenEngines(e) : undefined;
  const onWorkflow = q.data ? enginesOnWorkflow(e) : undefined;
  return (
    <StatTile label="Outcomes on a workflow" note={e ? `of ${e.outcomes.length}` : undefined} href={href}>
      <Figure
        value={
          q.isError && !q.data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : onWorkflow === undefined ? (
            <Shimmer className="h-6 w-16" />
          ) : !e ? (
            <span className="k-fg4">{"—"}</span>
          ) : (
            <span style={{ color: broken?.length ? RED : undefined }}>{onWorkflow.length}</span>
          )
        }
        sub={
          !e || broken === undefined || onWorkflow === undefined
            ? undefined
            : broken.length
              ? `script red: ${broken.map((o) => nameOf(o.outcome)).join(", ")}`
              : onWorkflow.length
                ? onWorkflow.map((o) => nameOf(o.outcome)).join(", ")
                : "every outcome runs on a script"
        }
      />
    </StatTile>
  );
}
