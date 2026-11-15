"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getStaffSchemaConformance } from "@/lib/api";
import { useClientClock } from "@/lib/use-client-clock";
import { formatRatePct } from "@/lib/pipe-stats";
import { Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { dayLabel, n } from "@/components/v2/monitoring-charts";
import { Failed, Loading, OK, RED, shortDay } from "@/components/v2/monitoring-sending";
import {
  VERDICT_WORDS,
  brokenModels,
  modelDays,
  windowDays,
  type SchemaConformance,
  type SchemaConformanceDay,
  type SchemaConformanceModel,
} from "@/lib/monitoring/schema-conformance";

/**
 * Monitoring > AI vendors > Schema (staff only, SCHEMA-HONOURED-1115). chat-service checks every schema'd answer against
 * the response schema the calling script sent, and serves per model how many followed it, its verdict and a daily series.
 * Red on the hub IS the alert (no email): only a model served `broken`. This file draws served values in served order
 * (chat-service serves broken models first); it computes no figure and re-grades no verdict.
 */

export const SCHEMA_CONFORMANCE_DAYS = 30;

export function useSchemaConformance() {
  return useAuthQuery(["staffSchemaConformance", SCHEMA_CONFORMANCE_DAYS], () => getStaffSchemaConformance(SCHEMA_CONFORMANCE_DAYS), { ...pollOptions, retry: false });
}

const TEAL = "var(--data-teal)";
const utcTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
const answers = (v: number) => `${n(v)} ${v === 1 ? "answer" : "answers"}`;

/**
 * One column per UTC day of the window, full height = that day's answers: teal = followed the schema, rose = missed it,
 * one segment pair per served route row (heights are the served counts as flex weights, no ratio computed). A day with
 * no stored row is a thin grey track.
 */
function DayChart({ m, rows, axis }: { m: SchemaConformanceModel; rows: SchemaConformanceDay[]; axis: string[] }) {
  return (
    <div>
      <div className="flex h-12 items-end gap-[2px]" role="img" aria-label={`${m.model}: answers that followed the schema per day`}>
        {axis.map((day) => {
          const today = rows.filter((r) => r.day.slice(0, 10) === day);
          if (!today.length) return <span key={day} className="h-[3px] min-w-0 flex-1 rounded-[2px]" style={{ background: "var(--data-track)" }} title={`${dayLabel(day)}: no answer`} />;
          return (
            <span
              key={day}
              className="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-[2px]"
              title={`${dayLabel(day)}: ${today.map((r) => `${r.route} ${answers(r.answeredCalls)}, ${n(r.nonConformingCalls)} missed the schema`).join(" · ")}`}
            >
              {today.map((r) => (
                <span key={r.route} className="flex min-h-0 flex-col" style={{ flexGrow: r.answeredCalls }}>
                  <span style={{ flexGrow: r.nonConformingCalls, background: RED }} />
                  <span style={{ flexGrow: r.answeredCalls - r.nonConformingCalls, background: TEAL }} />
                </span>
              ))}
            </span>
          );
        })}
      </div>
      <div className="k-fg3 mt-1.5 flex justify-between text-[11px] tabular-nums">
        <span>{shortDay(axis[0])}</span>
        <span>{m.lastNonConformingAt ? `Last miss ${utcTime(m.lastNonConformingAt)} UTC` : "Never missed"}</span>
        <span>{shortDay(axis[axis.length - 1])}</span>
      </div>
    </div>
  );
}

/** One model: its name and served verdict, the served share and counts, the sentence, its days, what the latest bad answer got wrong. */
function ModelCard({ m, rows, axis }: { m: SchemaConformanceModel; rows: SchemaConformanceDay[]; axis: string[] }) {
  const red = m.verdict === "broken";
  return (
    <div className="k-card flex min-w-0 flex-col p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="min-w-0 truncate text-[14px] font-medium" title={`${m.provider} / ${m.model}`}>
          {m.model}
        </h3>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px]" style={{ color: red ? RED : undefined }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: red ? RED : m.verdict === "ok" ? OK : "var(--fg-4)" }} aria-hidden="true" />
          {VERDICT_WORDS[m.verdict]}
        </span>
      </div>
      <p className="k-fg3 mt-0.5 text-[12px]">{m.provider}</p>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-[22px] font-medium leading-7 tracking-[-0.02em] tabular-nums" style={{ color: red ? RED : undefined }}>
          {formatRatePct(m.conformingShare * 100)}
        </span>
        <span className="k-fg2 text-[12px] tabular-nums">
          followed the schema · {n(m.nonConformingCalls)} of {answers(m.answeredCalls)} missed
        </span>
      </div>
      <p className="mt-2 text-[13px]" style={{ color: red ? RED : undefined }}>
        {m.sentence}
      </p>
      <div className="mt-auto pt-3">
        <DayChart m={m} rows={rows} axis={axis} />
      </div>
      {m.lastViolations && (
        <p className="k-fg3 k-line-subtle mt-3 border-t pt-2 text-[12px]">
          <span className="k-label mr-1.5">Latest miss</span>
          <span className="k-mono break-words">{m.lastViolations}</span>
        </p>
      )}
    </div>
  );
}

export function SchemaConformanceView({ data, now }: { data: SchemaConformance; now: Date }) {
  const reds = brokenModels(data);
  const axis = windowDays(data.days, now);
  return (
    <div className="space-y-8">
      <div className="k-card flex items-start gap-3 px-4 py-3">
        <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: data.verdict === "broken" ? RED : OK }} aria-hidden="true" />
        <div className="min-w-0">
          {reds.length ? (
            reds.map((m) => (
              <p key={`${m.provider}/${m.model}`} className="text-[14px] font-medium">
                {m.sentence}
              </p>
            ))
          ) : (
            <p className="text-[14px] font-medium">Every AI model answers our scripts in the shape they ask for.</p>
          )}
          <p className="k-fg3 mt-0.5 text-[12px]">A model turns red when more than 5% of at least 20 answers miss the script&apos;s schema. Under 20 answers it stays grey.</p>
        </div>
      </div>

      <section>
        <SectionTitle count={data.models.length} right={<span>One bar per UTC day. Teal = followed the schema, rose = missed it</span>}>
          AI models answering our scripts
        </SectionTitle>
        {data.models.length ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.models.map((m) => (
              <ModelCard key={`${m.provider}/${m.model}`} m={m} rows={modelDays(data, m)} axis={axis} />
            ))}
          </div>
        ) : (
          <div className="k-card">
            <p className="k-fg3 px-4 py-6 text-[13px]">No model answered a call carrying a schema in the last {data.days} days.</p>
          </div>
        )}
      </section>
    </div>
  );
}

export function SchemaConformancePage() {
  const q = useSchemaConformance();
  const now = useClientClock();
  if (q.isError && !q.data) return <Failed what="whether AI answers follow our scripts' schema" />;
  if (!q.data || !now) return <Loading />;
  return <SchemaConformanceView data={q.data} now={now} />;
}

/** The hub's one-second read: red only when chat-service serves a model `broken`, which ones under it. */
export function SchemaConformanceTile({ href }: { href: string }) {
  const q = useSchemaConformance();
  const data = q.data;
  const reds = data ? brokenModels(data) : [];
  return (
    <StatTile label="AI answer shape" note={data ? `${data.models.length} models` : undefined} href={href}>
      <Figure
        value={
          q.isError && !data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : !data ? (
            <Shimmer className="h-6 w-16" />
          ) : (
            <span style={{ color: data.verdict === "broken" ? RED : undefined }}>{reds.length ? `${reds.length} broken` : "All follow"}</span>
          )
        }
        sub={data && reds.length ? reds.map((m) => m.model).join(", ") : undefined}
      />
    </StatTile>
  );
}
