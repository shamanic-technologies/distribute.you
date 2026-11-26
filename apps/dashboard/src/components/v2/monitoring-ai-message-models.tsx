"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getStaffAiMessageModels } from "@/lib/api";
import { useClientClock } from "@/lib/use-client-clock";
import { Figure, SectionTitle, Shimmer, StatTile } from "@/components/v2/ui";
import { CatalogueName } from "@/components/v2/catalogue-name";
import { dayLabel, n } from "@/components/v2/monitoring-charts";
import { Failed, Loading, OK, RED, shortDay } from "@/components/v2/monitoring-sending";
import { windowDays } from "@/lib/monitoring/schema-conformance";
import { dayOf, healthSentence, modelWords, reasonWords, type AiMessageModels } from "@/lib/monitoring/ai-message-models";

/**
 * Monitoring > AI vendors > Model named (staff only, MODEL-TAG-EVERY-AI-MESSAGE-1126). Every message our AI wrote must
 * name the model that wrote it (the Unibox shows it beside the sender). features-service stores per UTC day the messages
 * our runs sent with vs without a model named; red only on its served `health.broken`. Served counts, served order.
 */

export const AI_MESSAGE_MODELS_DAYS = 30;

export function useAiMessageModels() {
  return useAuthQuery(["staffAiMessageModels", AI_MESSAGE_MODELS_DAYS], () => getStaffAiMessageModels(AI_MESSAGE_MODELS_DAYS), { ...pollOptions, retry: false });
}

const TEAL = "var(--data-teal)";
const msgs = (v: number) => `${n(v)} ${v === 1 ? "message" : "messages"}`;

/**
 * One column per UTC day, full height = that day's AI messages: teal = model named, rose = none (served counts as flex
 * weights). A day with no stored row is a thin grey track.
 */
function DayChart({ data, axis }: { data: AiMessageModels; axis: string[] }) {
  return (
    <div>
      <div className="flex h-24 items-end gap-[2px]" role="img" aria-label="AI messages with and without a model named, per day">
        {axis.map((day) => {
          const d = dayOf(data, day);
          if (!d || d.fleet.messages === 0) return <span key={day} className="h-[3px] min-w-0 flex-1 rounded-[2px]" style={{ background: "var(--data-track)" }} title={`${dayLabel(day)}: no AI message`} />;
          return (
            <span
              key={day}
              className="flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-[2px]"
              title={`${dayLabel(day)}: ${msgs(d.fleet.messages)}, ${n(d.fleet.withoutModel)} with no model named`}
            >
              <span style={{ flexGrow: d.fleet.withoutModel, background: RED }} />
              <span style={{ flexGrow: d.fleet.withModel, background: TEAL }} />
            </span>
          );
        })}
      </div>
      <div className="k-fg3 mt-1.5 flex justify-between text-[11px] tabular-nums">
        <span>{shortDay(axis[0])}</span>
        <span>{shortDay(axis[axis.length - 1])}</span>
      </div>
    </div>
  );
}

export function AiMessageModelsView({ data, now }: { data: AiMessageModels; now: Date }) {
  const axis = windowDays(AI_MESSAGE_MODELS_DAYS, now);
  // Served newest first: the latest stored day is the first row.
  const latest = data.days[0] ?? null;
  return (
    <div className="space-y-8">
      <div className="k-card flex items-start gap-3 px-4 py-3">
        <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: data.health.broken ? RED : OK }} aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[14px] font-medium" style={{ color: data.health.broken ? RED : undefined }}>
            {healthSentence(data)}
          </p>
          <p className="k-fg3 mt-0.5 text-[12px]">{data.ruleText}</p>
        </div>
      </div>

      <section>
        <SectionTitle right={<span>One bar per UTC day. Teal = model named, rose = none</span>}>AI messages sent</SectionTitle>
        <div className="k-card p-4">
          <DayChart data={data} axis={axis} />
        </div>
      </section>

      {latest && (
        <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="k-card p-4">
            <p className="k-label">Models, {dayLabel(latest.day.slice(0, 10))}</p>
            {Object.keys(latest.fleet.byModel).length ? (
              <ul className="mt-2 space-y-1.5 text-[13px]">
                {Object.entries(latest.fleet.byModel).map(([id, count]) => (
                  <li key={id} className="flex items-center justify-between gap-3">
                    <CatalogueName kind="llm" name={modelWords(data, id)} label={modelWords(data, id)} />
                    <span className="tabular-nums">{msgs(count)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="k-fg3 mt-2 text-[13px]">No model named that day.</p>
            )}
          </div>
          <div className="k-card p-4">
            <p className="k-label">No model named, why</p>
            {Object.keys(latest.fleet.withoutByReason).length ? (
              <ul className="mt-2 space-y-1.5 text-[13px]">
                {Object.entries(latest.fleet.withoutByReason).map(([r, count]) => (
                  <li key={r} className="flex items-center justify-between gap-3" style={{ color: RED }}>
                    <span>{reasonWords(r)}</span>
                    <span className="tabular-nums">{msgs(count)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="k-fg3 mt-2 text-[13px]">Every AI message named its model.</p>
            )}
            <p className="k-fg3 k-line-subtle mt-3 border-t pt-2 text-[12px] tabular-nums">
              {msgs(latest.fleet.sentNotWrittenByOurRuns)} sent that our AI did not write (newsletters), counted apart.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

export function AiMessageModelsPage() {
  const q = useAiMessageModels();
  const now = useClientClock();
  if (q.isError && !q.data) return <Failed what="which model wrote each AI message" />;
  if (!q.data || !now) return <Loading />;
  return <AiMessageModelsView data={q.data} now={now} />;
}

/** The hub's one-second read: red only on the served `health.broken`. */
export function AiMessageModelsTile({ href }: { href: string }) {
  const q = useAiMessageModels();
  const data = q.data;
  const unnamed = data?.health.unnamedOnRecentSends ?? 0;
  return (
    <StatTile label="AI message model" note={data?.days[0] ? `${n(data.days[0].fleet.messages)} today` : undefined} href={href}>
      <Figure
        value={
          q.isError && !data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : !data ? (
            <Shimmer className="h-6 w-16" />
          ) : (
            <span style={{ color: data.health.broken ? RED : undefined }}>
              {data.health.reason === "series_not_rebuilt" ? "Stopped" : unnamed ? `${n(unnamed)} unnamed` : "All named"}
            </span>
          )
        }
      />
    </StatTile>
  );
}
