"use client";

import { useScriptsMonitoring } from "@/components/v2/monitoring-scripts";
import { useEngineNames } from "@/components/v2/monitoring-campaign-engines";
import { OK, RED } from "@/components/v2/monitoring-sending";
import { CatalogueName } from "@/components/v2/catalogue-name";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { scriptName } from "@/lib/monitoring/script-engines";
import {
  PROOF_BUCKETS,
  PROOF_BUCKET_WORDS,
  failedWriters,
  proofStateWords,
  proofsByEngine,
  redWriters,
  type ProofBucket,
  type WriterProofCombination,
  type WriterProofs,
} from "@/lib/monitoring/scripts-monitoring";

/**
 * Monitoring > Scripts > Engines: writer combinations proven before they write to people (PROVEN-BEFORE-PEOPLE-1116,
 * DIS-800). workflow-service serves `writerProofs` on the same scripts monitoring read: per Engine, every script that
 * writes to a person with the LLM its tactics state, and its latest proof (5 recorded production cases answered live,
 * nothing sent, Jev judging every field a person reads). ONE chart: per Engine a bar of its combinations by state; under
 * it, each failed combination named by script + LLM + the first served failure line. Red ONLY for the served `red`
 * (a live combination that failed); every "not yet" keeps a calm colour. Red on the hub IS the alert, never an email.
 */

const BUCKET_COLOR: Record<ProofBucket, string> = {
  proven: "var(--data-teal)",
  failing: RED,
  failedOff: "var(--data-amber)",
  running: "var(--data-sky)",
  notYet: "var(--data-track)",
};

const n = (v: number) => v.toLocaleString("en-US");
const utcTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });

function Dot({ color }: { color: string }) {
  return <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />;
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
      {PROOF_BUCKETS.map((b) => (
        <span key={b} className="k-fg2 inline-flex items-center gap-1.5">
          <Dot color={BUCKET_COLOR[b]} />
          {PROOF_BUCKET_WORDS[b]}
        </span>
      ))}
    </div>
  );
}

/** One Engine: its name, a bar of its combinations by state (served counts as flex weights), the counts in words. */
function EngineBar({ row, name }: { row: ReturnType<typeof proofsByEngine>[number]; name: string }) {
  const parts = PROOF_BUCKETS.filter((b) => row.counts[b] > 0);
  return (
    <div className="grid items-center gap-x-4 gap-y-1.5 px-4 py-3 md:grid-cols-[220px_minmax(0,1fr)_220px]">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium" title={row.outcome}>
          {name}
        </p>
        <p className="k-fg3 text-[12px] tabular-nums">
          {row.cases == null ? "no recorded case yet" : `${n(row.cases)} recorded ${row.cases === 1 ? "case" : "cases"}`}
          {row.enforced ? " · draws proven only" : ""}
        </p>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full" style={{ background: "var(--data-track)" }} role="img" aria-label={`${name}: ${parts.map((b) => `${row.counts[b]} ${PROOF_BUCKET_WORDS[b]}`).join(", ")}`}>
        {parts.map((b) => (
          <span key={b} style={{ flexGrow: row.counts[b], background: BUCKET_COLOR[b] }} title={`${PROOF_BUCKET_WORDS[b]}: ${row.counts[b]}`} />
        ))}
      </div>
      <p className="k-fg2 text-[12px] tabular-nums md:text-right">
        {row.counts.failing > 0 && <span style={{ color: RED }}>{n(row.counts.failing)} failing · </span>}
        {n(row.counts.proven)} of {n(row.total)} proven
      </p>
    </div>
  );
}

/** A failed combination: script, LLM, why (the first served failure line), when. */
function FailedRow({ c, engine }: { c: WriterProofCombination; engine: string }) {
  return (
    <li className="grid gap-x-4 gap-y-1 px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
          <Dot color={c.red ? RED : BUCKET_COLOR.failedOff} />
          <span className="k-mono truncate" title={c.dynasty}>
            {scriptName(c.dynasty, c.outcome)}
          </span>
          <span className="k-mono k-fg3 text-[11px] tabular-nums">v{c.version}</span>
          {c.llm ? <CatalogueName kind="llm" name={c.llm} variant="chip" /> : <span className="k-fg4">—</span>}
        </p>
        <p className="k-fg3 mt-0.5 text-[12px] tabular-nums">
          {engine} · {c.red ? "live, out of the draw" : "not drawn"} · {n(c.usable)} of {n(c.sample)} usable
          {c.provedAt ? ` · ${utcTime(c.provedAt)} UTC` : ""}
        </p>
      </div>
      <p className="min-w-0 text-[13px]" style={c.red ? { color: RED } : undefined}>
        {c.failures[0] ?? <span className="k-fg3">No reason served.</span>}
        {c.failures.length > 1 && <span className="k-fg3 text-[12px]"> +{c.failures.length - 1} more</span>}
      </p>
    </li>
  );
}

export function WriterProofsView({ data }: { data: WriterProofs }) {
  const engineName = useEngineNames();
  const rows = proofsByEngine(data);
  const failed = failedWriters(data);
  const red = redWriters(data);
  const notYetStates = data.combinations.filter((c) => c.state !== "passed" && c.state !== "failed");
  return (
    <section className="space-y-3">
      <SectionTitle count={data.combinations.length} right={<Legend />}>
        Writers proven before people
      </SectionTitle>
      <div className="k-card divide-y divide-[var(--line-subtle)]">
        <div className="flex items-start gap-3 px-4 py-3">
          <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: red.length ? RED : OK }} aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[14px] font-medium" style={red.length ? { color: RED } : undefined}>
              {red.length
                ? `${n(red.length)} live ${red.length === 1 ? "writer" : "writers"} failed ${red.length === 1 ? "its" : "their"} proof: ${red.map((c) => `${scriptName(c.dynasty, c.outcome)} with ${c.llm ?? "no LLM named"}`).join(", ")}.`
                : "No live writer failed its proof."}
            </p>
            <p className="k-fg3 mt-0.5 text-[12px]">
              Each script that writes to a person answers 5 recorded cases with its LLM, nothing sent, Jev judging every field a person reads.
              {notYetStates.length ? ` ${n(notYetStates.length)} not proven yet.` : ""}
            </p>
          </div>
        </div>
        {rows.length === 0 ? (
          <EmptyNote>No script that writes to a person yet.</EmptyNote>
        ) : (
          rows.map((r) => <EngineBar key={r.outcome} row={r} name={engineName(r.outcome)} />)
        )}
      </div>
      {failed.length > 0 && (
        <div className="k-card">
          <p className="k-label border-b k-line-subtle px-4 py-2.5">Failed, with why</p>
          <ul className="divide-y divide-[var(--line-subtle)]">
            {failed.map((c) => (
              <FailedRow key={`${c.outcome}/${c.dynasty}/${c.version}`} c={c} engine={engineName(c.outcome)} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Rendered on the Engines page above the per-outcome blocks; nothing until workflow-service serves the field. */
export function WriterProofsSection() {
  const q = useScriptsMonitoring();
  if (!q.data) return null;
  if (!q.data.writerProofs) {
    return (
      <section>
        <SectionTitle>Writers proven before people</SectionTitle>
        <div className="k-card">
          <EmptyNote>Not served yet: the proofs arrive with the next deploy.</EmptyNote>
        </div>
      </section>
    );
  }
  return <WriterProofsView data={q.data.writerProofs} />;
}

/** The hub's one-second read: live writers that failed their proof. */
export function WriterProofsTile({ href }: { href: string }) {
  const q = useScriptsMonitoring();
  const wp = q.data?.writerProofs;
  const red = wp ? redWriters(wp) : undefined;
  return (
    <StatTile label="Writers failing proof" note={wp ? `of ${wp.combinations.length} writers` : undefined} href={href}>
      <Figure
        value={
          q.isError && !q.data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : !q.data ? (
            <Shimmer className="h-6 w-16" />
          ) : !wp ? (
            <span className="k-fg3 text-[13px]">not served yet</span>
          ) : (
            <span style={{ color: red?.length ? RED : undefined }}>{red?.length}</span>
          )
        }
        sub={red === undefined ? undefined : red.length ? red.map((c) => `${scriptName(c.dynasty, c.outcome)} · ${c.llm ?? "no LLM"}`).join(", ") : "no live writer failed"}
      />
    </StatTile>
  );
}
