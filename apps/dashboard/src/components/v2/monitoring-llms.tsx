"use client";

import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getStaffEngineLlms } from "@/lib/api";
import { formatRatePct } from "@/lib/pipe-stats";
import { formatUsdAdaptive } from "@/lib/format-number";
import { BarSpark, Figure, SectionTitle, ShareBar, Shimmer, StatTile } from "@/components/v2/ui";
import { CatalogueName } from "@/components/v2/catalogue-name";
import { Dash, Failed, Loading, OK, RED, n, shortDay } from "@/components/v2/monitoring-sending";
import {
  allowedNames,
  enginesForcingOutside,
  evidenceBroken,
  evidenceNotBuiltYet,
  forcedOutside,
  universeSourceWords,
  type EngineLlm,
  type EngineLlms,
  type EngineLlmsEngine,
} from "@/lib/monitoring/engine-llms";

/**
 * Monitoring > AI vendors > LLMs (staff only, LLM-RATING-PER-ENGINE-1112). features-service's Rating rates LLMs per
 * Engine (framework v10 §8) and serves, per Engine, the LLMs it may use, each one ranked with its usage since the first
 * call (workflow era included), and the LLMs it still used outside its list. Red = the Rating could not read its
 * evidence, or an Engine called an LLM outside its list in the last 30 days (a script forcing a model, owner 2026-11-12).
 * This file draws served values in served order; it only converts units (fraction to %).
 */

export function useEngineLlms() {
  return useAuthQuery(["staffEngineLlms"], getStaffEngineLlms, { ...pollOptions, retry: false });
}

const pctOf = (v: number | null) => (v == null ? null : formatRatePct(v * 100));

function Dot({ color }: { color: string }) {
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />;
}

/** One LLM of an Engine: share of the Rating's draws, then $/outcome, % outcome, # outcomes, $ spent, $ per day, last call, status. */
function LlmRow({ l, outside }: { l: EngineLlm; outside: boolean }) {
  const calledLately = l.dailySpend.some((d) => d.calls > 0);
  const red = outside && calledLately;
  const draws = pctOf(l.shareOfDraws);
  return (
    <tr className="k-row border-t k-line-subtle">
      <td className="px-3 py-2 first:pl-4">
        <span className={outside ? "k-fg2" : undefined}>
          <CatalogueName kind="llm" name={l.name} after={l.rank === 1 ? <span className="k-chip">Favourite</span> : null} />
        </span>
      </td>
      <td className="px-3 py-2">
        {draws ? (
          <span className="inline-flex items-center gap-2 tabular-nums">
            <ShareBar value={l.shareOfDraws} max={1} />
            {draws}
          </span>
        ) : (
          <Dash />
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {l.costPerOutcomeUsd != null ? (
          formatUsdAdaptive(l.costPerOutcomeUsd)
        ) : l.calls > 0 && l.outcomes === 0 ? (
          <span className="k-fg3" title={l.costPerOutcomeUnavailableReason ?? undefined}>
            Learning
          </span>
        ) : (
          <Dash />
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{pctOf(l.outcomeRate) ?? <Dash />}</td>
      <td className="px-3 py-2 text-right tabular-nums">{n(l.outcomes)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{formatUsdAdaptive(l.spentUsdToDate)}</td>
      <td className="px-3 py-2">
        <span className="flex items-center justify-end gap-2 tabular-nums">
          <BarSpark values={l.dailySpend.map((d) => d.spentUsd)} className="h-5 w-16" />
          <span className="w-12 text-right">{formatUsdAdaptive(l.spentUsdPerDay)}</span>
        </span>
      </td>
      <td className="k-mono k-fg2 px-3 py-2 text-[12px]">{l.lastCallDay ? shortDay(l.lastCallDay) : <Dash />}</td>
      <td className="px-3 py-2 last:pr-4">
        <span className="inline-flex items-center gap-1.5 text-[12px]" style={red ? { color: RED } : undefined} title={l.notPickableReason ?? undefined}>
          <Dot color={red ? RED : outside ? "var(--fg-4)" : OK} />
          {outside ? (red ? "Used outside its list" : "Outside its list") : "Allowed"}
        </span>
      </td>
    </tr>
  );
}

const HEADS = ["LLM", "Rating share", "$ / outcome", "% outcome", "# outcomes", "$ spent", "$ per day", "Last call", "Status"];
const RIGHT = new Set(["$ / outcome", "% outcome", "# outcomes", "$ spent", "$ per day"]);

function EngineBlock({ e }: { e: EngineLlmsEngine }) {
  const forced = forcedOutside(e);
  const allowed = allowedNames(e);
  return (
    <section className="space-y-3">
      <SectionTitle
        count={e.llms.length}
        right={
          <span className="inline-flex items-center gap-1.5 text-[12px]" style={forced.length ? { color: RED } : undefined}>
            <Dot color={forced.length ? RED : OK} />
            {forced.length ? `${forced.map((l) => l.name).join(", ")} used outside its list` : "Every call within its list"}
          </span>
        }
      >
        {e.name}
      </SectionTitle>
      <p className="k-fg3 -mt-1 text-[12px]">
        {universeSourceWords(e.universe.source)}: {allowed.length ? allowed.join(", ") : "none"}. {n(e.totals.calls)} calls, {formatUsdAdaptive(e.totals.spentUsdToDate)} spent since the first one.
      </p>
      <div className="k-card overflow-hidden">
        <div className="k-scroll overflow-x-auto">
          <table className="w-full min-w-[980px] text-[13px]">
            <thead>
              <tr>
                {HEADS.map((h) => (
                  <th key={h} className={`k-label px-3 py-2.5 first:pl-4 last:pr-4 ${RIGHT.has(h) ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {e.llms.map((l) => (
                <LlmRow key={l.llmDynastySlug} l={l} outside={false} />
              ))}
              {e.outsideUniverse.map((l) => (
                <LlmRow key={`out-${l.llmDynastySlug}`} l={l} outside />
              ))}
            </tbody>
          </table>
        </div>
        {e.llms.length === 0 && e.outsideUniverse.length === 0 && <p className="k-fg3 border-t k-line-subtle px-4 py-2.5 text-[12px]">No LLM call recorded yet.</p>}
      </div>
    </section>
  );
}

/** The page body over a served read (exported for the headless render check). */
export function EngineLlmsView({ data }: { data: EngineLlms }) {
  const broken = evidenceBroken(data);
  return (
    <div className="space-y-8">
      <p className="k-fg2 text-[13px]" style={broken ? { color: RED } : undefined}>
        {broken
          ? `The Rating could not read its evidence: ${data.evidenceUnavailableReason}.`
          : evidenceNotBuiltYet(data)
            ? "The Rating is reading every LLM call made so far. The first full read takes about an hour; the Engines show here once it lands."
            : `${data.engines.length} Engines call an LLM. ${data.evidenceCounts ? `${n(data.evidenceCounts.calls)} calls since the first one.` : ""}`}
      </p>
      {data.engines.map((e) => (
        <EngineBlock key={e.outcome} e={e} />
      ))}
    </div>
  );
}

export function EngineLlmsPage() {
  const q = useEngineLlms();
  if (q.isError && !q.data) return <Failed what="the LLMs each Engine uses" />;
  if (!q.data) return <Loading />;
  return <EngineLlmsView data={q.data} />;
}

/** The hub's one-second read: red when an Engine called an LLM outside its list lately, or the evidence is unreadable. */
export function EngineLlmsTile({ href }: { href: string }) {
  const q = useEngineLlms();
  const data = q.data;
  const forcing = data ? enginesForcingOutside(data) : [];
  const red = data ? evidenceBroken(data) || forcing.length > 0 : false;
  return (
    <StatTile label="LLMs per Engine" note={data ? `${data.engines.length} Engines` : undefined} href={href}>
      <Figure
        value={
          q.isError && !data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : !data ? (
            <Shimmer className="h-6 w-16" />
          ) : (
            <span style={{ color: red ? RED : undefined }}>
              {evidenceBroken(data) ? "Evidence unreadable" : evidenceNotBuiltYet(data) ? "Reading history" : forcing.length ? `${forcing.length} outside their list` : "All within their list"}
            </span>
          )
        }
        sub={data && forcing.length ? forcing.map((e) => e.name).join(", ") : undefined}
      />
    </StatTile>
  );
}
