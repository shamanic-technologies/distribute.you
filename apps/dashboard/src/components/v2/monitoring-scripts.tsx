"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getStaffScriptsMonitoring } from "@/lib/api";
import { formatRatePct } from "@/lib/pipe-stats";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { DailyLines, dayLabel, type Line } from "@/components/v2/monitoring-charts";
import { Failed, Loading, OK, RED } from "@/components/v2/monitoring-sending";
import {
  brokenOutcomes,
  brokenWords,
  dollarsPerRun,
  guardStateWords,
  isBroken,
  outcomeName,
  problemsFirst,
  proofWords,
  switchStateWords,
  toPct,
  type ScriptGuard,
  type ScriptOutcome,
  type ScriptsMonitoring,
} from "@/lib/monitoring/scripts-monitoring";

/**
 * Monitoring > Scripts (staff only, FACTORY-P3). workflow-service serves, per outcome a stored script makes (the first:
 * every cold email of the fleet), a stored daily series of the SCRIPT path beside the SERVICE path it replaced, the
 * script's proof (recorded cases replayed), and its guard (rolls the fleet back to the previous workflow versions when
 * the script's last-hour error rate is too high). Red = the served verdict, or the guard rolled back. Red on the hub IS
 * the alert (no email). This file draws served values; it only converts units (fraction to %, cents to dollars).
 */

export const SCRIPTS_DAYS = 30;
const SCRIPT = "var(--data-teal)";
const SERVICE = "var(--data-violet)";
const MUTED = "var(--fg-4)";

export function useScriptsMonitoring() {
  return useAuthQuery(["staffScriptsMonitoring", SCRIPTS_DAYS], () => getStaffScriptsMonitoring(SCRIPTS_DAYS), { ...pollOptions, retry: false });
}

const utcTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
const pctText = (v: number | null) => (v == null ? null : formatRatePct(v));
const ALL = [{ key: "all", label: "All", days: null }];

type Day = ScriptOutcome["days"][number];

function Dot({ color }: { color: string }) {
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />;
}

/** One row of the outcome's facts card: a label left, the content right. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-x-4 gap-y-1.5 px-4 py-3.5 md:grid-cols-[180px_minmax(0,1fr)]">
      <p className="k-label pt-0.5">{label}</p>
      <div className="min-w-0 text-[13px]">{children}</div>
    </div>
  );
}

/** The roll-back guard: last hour against its threshold; when rolled back, when, why and which workflows went back. */
function GuardRow({ guard }: { guard: ScriptGuard | undefined }) {
  if (!guard) {
    return (
      <Row label="Guard">
        <span className="k-fg3">Not live yet.</span>
      </Row>
    );
  }
  const st = guardStateWords(guard.state);
  const color = st.tone === "red" ? RED : st.tone === "run" ? OK : MUTED;
  const h = guard.lastHour;
  return (
    <Row label="Guard">
      <p className="inline-flex items-center gap-1.5 font-medium" style={st.tone === "red" ? { color: RED } : undefined}>
        <Dot color={color} />
        {st.words}
      </p>
      <p className="mt-1 tabular-nums">
        {guard.windowMinutes === 60 ? "Last hour" : `Last ${guard.windowMinutes} min`}: {h.runs.toLocaleString("en-US")} runs, {h.failed.toLocaleString("en-US")} failed
        {h.errorRate != null && <>, {pctText(toPct(h.errorRate))} errors</>}.
      </p>
      <p className="k-fg3 mt-0.5 text-[12px] tabular-nums">
        {guard.thresholdErrorRate != null ? `Rolls back above ${pctText(toPct(guard.thresholdErrorRate))} errors` : "Rolls back on too many errors"}
        {` once it has ${guard.minRuns.toLocaleString("en-US")} runs in the window`}
        {guard.baselineErrorRate != null && `. The old code errs ${pctText(toPct(guard.baselineErrorRate))}`}.
      </p>
      {guard.state === "rolled_back" && (
        <div className="mt-2.5 rounded-[8px] px-3 py-2.5" style={{ background: "color-mix(in oklab, var(--data-rose) 8%, transparent)", boxShadow: "inset 0 0 0 1px color-mix(in oklab, var(--data-rose) 22%, transparent)" }}>
          <p>
            <span className="font-medium">Rolled back{guard.rolledBackAt ? ` ${utcTime(guard.rolledBackAt)} UTC` : ""}.</span>
            {guard.reason && <span className="k-fg2"> {guard.reason}</span>}
          </p>
        </div>
      )}
      {guard.switches.length > 0 && (
        <ul className="mt-2.5 space-y-1">
          {guard.switches.map((s) => (
            <li key={`${s.workflowDynastySlug}-${s.fromVersion}-${s.toVersion}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]">
              <span className="k-mono">{s.workflowDynastySlug}</span>
              <span className="k-mono k-fg2 tabular-nums">
                v{s.fromVersion} <span className="k-fg3">→</span> v{s.toVersion}
              </span>
              <span className="k-chip" style={s.state === "rolled_back" ? { color: RED } : undefined}>
                {switchStateWords(s.state)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Row>
  );
}

function OutcomeBlock({ o }: { o: ScriptOutcome }) {
  const broken = isBroken(o);
  const points = o.days;
  const pair = (get: (d: NonNullable<Day["script"]>) => number | null): Line<Day>[] => [
    { key: "script", label: "Script", color: SCRIPT, get: (d) => (d.script ? get(d.script) : null) },
    { key: "service", label: "Old code", color: SERVICE, get: (d) => (d.service ? get(d.service) : null) },
  ];
  const empty = "Fewer than 2 days stored yet.";
  return (
    <section className="space-y-4">
      <SectionTitle
        right={
          <span className="inline-flex items-center gap-1.5">
            <Dot color={broken ? RED : OK} />
            {broken ? "Red" : "OK"}
          </span>
        }
      >
        {outcomeName(o.outcome)}
      </SectionTitle>
      <div className="k-card divide-y divide-[var(--line-subtle)]">
        <GuardRow guard={o.guard} />
        <Row label="Proof">
          {o.scripts.length === 0 ? (
            <span className="k-fg3">No live script.</span>
          ) : (
            <ul className="space-y-1">
              {o.scripts.map((s) => {
                const partial = s.proof != null && s.proof.matches < s.proof.cases;
                return (
                  <li key={s.scriptSlug} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="tabular-nums" style={partial ? { color: RED } : undefined}>
                      {proofWords(o.outcome, s.proof)}
                    </span>
                    <span className="k-mono k-fg3 text-[11px]">{s.scriptSlug}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Row>
        <Row label="Replaces">
          {o.servicePath ? (
            <p>
              {o.servicePath.serviceName}
              <span className="k-mono k-fg3 ml-2 text-[11px]">{o.servicePath.taskNames.join(", ")}</span>
            </p>
          ) : (
            <span className="k-fg3">No old code to compare with.</span>
          )}
          {o.readyToDelete && (
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12px]" style={{ color: "var(--data-teal)" }}>
              <Dot color="var(--data-teal)" />
              No run on the old code for 7 days. Its code can leave its repo.
            </p>
          )}
        </Row>
      </div>

      <div>
        <SectionTitle right={<span>per day</span>}>Runs</SectionTitle>
        <DailyLines points={points} lines={pair((p) => p.runs)} format={(v) => Math.round(v).toLocaleString("en-US")} windows={ALL} empty={empty} label={`${outcomeName(o.outcome)}: runs per day`} />
      </div>
      <div>
        <SectionTitle right={<span>per day, latest runs</span>}>Error rate</SectionTitle>
        <DailyLines points={points} lines={pair((p) => toPct(p.errorRate))} format={(v) => formatRatePct(v)} windows={ALL} empty={empty} label={`${outcomeName(o.outcome)}: error rate per day`} />
      </div>
      <div>
        <SectionTitle right={<span>per day, latest runs</span>}>Cost per run</SectionTitle>
        <DailyLines points={points} lines={pair((p) => p.avgCostCents)} format={(v) => dollarsPerRun(v)} windows={ALL} empty={empty} label={`${outcomeName(o.outcome)}: cost per run per day`} />
      </div>
    </section>
  );
}

export function ScriptsView({ data }: { data: ScriptsMonitoring }) {
  const broken = brokenOutcomes(data);
  const red = broken.length > 0;
  return (
    <div className="space-y-10">
      <div className="k-card flex items-start gap-3 px-4 py-3">
        <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: red ? RED : OK }} aria-hidden="true" />
        <div className="min-w-0">
          {red ? (
            broken.map((o) => (
              <p key={o.outcome} className="text-[14px] font-medium" style={{ color: RED }}>
                {outcomeName(o.outcome)}: {brokenWords(o)}.
              </p>
            ))
          ) : (
            <p className="text-[14px] font-medium">Every script works as well as the code it replaced.</p>
          )}
          <p className="k-fg3 mt-0.5 text-[12px]">
            Since {dayLabel(data.since)}. Red when a script fails more often than the old code, or when its guard rolls back.
          </p>
        </div>
      </div>
      {data.outcomes.length === 0 ? (
        <div className="k-card">
          <EmptyNote>No script makes an outcome yet.</EmptyNote>
        </div>
      ) : (
        problemsFirst(data).map((o) => <OutcomeBlock key={o.outcome} o={o} />)
      )}
    </div>
  );
}

export function ScriptsPage() {
  const q = useScriptsMonitoring();
  if (q.isError && !q.data) return <Failed what="the scripts" />;
  if (!q.data) return <Loading />;
  return <ScriptsView data={q.data} />;
}

/** The hub's one-second read: how many outcomes have a broken script now, which ones under it. */
export function ScriptsTile({ href }: { href: string }) {
  const q = useScriptsMonitoring();
  const data = q.data;
  const broken = data ? brokenOutcomes(data) : undefined;
  return (
    <StatTile label="Scripts red" note={data ? `of ${data.outcomes.length} live` : undefined} href={href}>
      <Figure
        value={
          q.isError && !data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : broken === undefined ? (
            <Shimmer className="h-6 w-16" />
          ) : (
            <span style={{ color: broken.length ? RED : undefined }}>{broken.length}</span>
          )
        }
        sub={broken === undefined ? undefined : broken.length ? broken.map((o) => outcomeName(o.outcome)).join(", ") : "every script works"}
      />
    </StatTile>
  );
}
