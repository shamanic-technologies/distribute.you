"use client";

import { useState } from "react";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getPublicCatalogueSteps, getStaffScriptEngines } from "@/lib/api";
import { catalogueReadOptions } from "@/lib/query-options";
import { formatUsdAdaptive } from "@/lib/format-number";
import { timeAgo } from "@/lib/friendly-datetime";
import { useClientClock } from "@/lib/use-client-clock";
import { BarSpark, Figure, SectionTitle, ShareBar, Shimmer, StatTile } from "@/components/v2/ui";
import { CatalogueName } from "@/components/v2/catalogue-name";
import { CatalogueMark } from "@/components/v2/catalogue-mark";
import { Dash, Failed, Loading, RED, n, shortDay } from "@/components/v2/monitoring-sending";
import {
  basisWords,
  boardBroken,
  chartScripts,
  scoreMissingWords,
  scriptName,
  shareBars,
  splitScripts,
  type ScriptEngine,
  type ScriptEngineScript,
  type ScriptEngines,
  type ScriptEnginesRead,
} from "@/lib/monitoring/script-engines";

/**
 * Monitoring > AI vendors > Scripts per Engine (staff only, SCRIPT-VALUE-RATING-1113-MON-DASH). Owner 2026-11-13:
 * « un pick = toujours un script »; the LLM and the template are tactics of the script. Per Engine: the scripts that
 * compete, the one the Rating favours today (largest share of its draws) and what that rests on (runs, what they
 * reached, cost per run, the Rating's score). Red only when the board was not rebuilt for over an hour.
 * This file draws served values in served order; the chart groups the served shares of the scripts it does not draw.
 */

export function useScriptEngines() {
  return useAuthQuery(["staffScriptEngines"], getStaffScriptEngines, { ...pollOptions, retry: false });
}

/** The public outcome catalogue (`/public/catalogue/steps`): every Engine's served name and icon. */
function useSteps() {
  return useAuthQuery(["publicCatalogueSteps"], getPublicCatalogueSteps, catalogueReadOptions);
}

/** An outcome's served catalogue name, the outcome key while the catalogue loads. */
function useStepName(): (outcome: string) => string {
  const steps = useSteps();
  return (outcome) => steps.data?.find((s) => s.key === outcome)?.name ?? outcome;
}

/** An outcome's served catalogue mark (the Catalogue and Research pages wear the same). */
function OutcomeMark({ outcome }: { outcome: string }) {
  const steps = useSteps();
  const step = steps.data?.find((s) => s.key === outcome) ?? null;
  return <CatalogueMark icon={step?.icon ?? null} name={step?.name ?? outcome} size={18} />;
}

/** Dollars as the dashboard prints them; a real amount under one cent never reads as $0.00. */
const usd = (v: number) => (v > 0 && v < 0.005 ? "<$0.01" : formatUsdAdaptive(v));
/** The Rating's score: credited value per dollar spent, a decision figure (never a return). */
const score = (v: number) => (v >= 10 ? Math.round(v).toLocaleString("en-US") : v.toFixed(2));
const sharePct = (v: number) => (v > 0 && v < 1 ? "<1%" : `${Math.round(v)}%`);
/** Columns hidden below md (a phone keeps Script, Share of draws and Rating score). */
const WIDE = "hidden md:table-cell";
/** One colour per charted script, the « Other » band in the track colour. */
const SERIES = ["var(--data-teal)", "var(--data-sky)", "var(--data-violet)", "var(--data-amber)"];
const OTHER = "var(--data-track)";
const engines = (c: number) => `${n(c)} ${c === 1 ? "Engine" : "Engines"}`;

function Dot({ color }: { color: string }) {
  return <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />;
}

/** One fixed grid for every Engine's table, so a column sits at the same place in each (Script takes what is left). */
const COLS: { head: string; width: string | null; right: boolean; wide: boolean }[] = [
  { head: "Script", width: null, right: false, wide: false },
  { head: "Share of draws today", width: "w-[72px] md:w-[150px]", right: false, wide: false },
  { head: "Runs (30 days)", width: "w-[130px]", right: true, wide: true },
  { head: "Reached", width: "w-[190px]", right: false, wide: true },
  { head: "Cost per run", width: "w-[92px]", right: true, wide: true },
  { head: "Rating score (value per $)", width: "w-[96px] md:w-[120px]", right: true, wide: false },
  { head: "LLM and template", width: "w-[230px]", right: false, wide: true },
];

function ScriptRow({ s, outcome, color, stepName }: { s: ScriptEngineScript; outcome: string; color: string | null; stepName: (o: string) => string }) {
  const reached = s.reached.filter((r) => r.outcome != null);
  const missing = scoreMissingWords(s.valuePerDollarUnavailableReason);
  return (
    <tr className="k-row border-t k-line-subtle">
      <td className="px-3 py-2 first:pl-4">
        <span className={`flex min-w-0 items-center gap-2 ${s.runnable ? "" : "k-fg3"}`} title={s.scriptDynasty}>
          {color ? <Dot color={color} /> : <span className="w-2 shrink-0" />}
          <span className="k-mono min-w-0 truncate text-[12px]">{scriptName(s.scriptDynasty, outcome)}</span>
          {s.version != null && <span className="k-fg3 k-mono shrink-0 text-[11px]">v{s.version}</span>}
          {!s.runnable && <span className="k-chip shrink-0">Retired</span>}
        </span>
      </td>
      <td className="px-3 py-2">
        {s.shareOfDrawsPct != null ? (
          <span className="inline-flex items-center gap-2 tabular-nums">
            <span className="hidden md:inline-flex">
              <ShareBar value={s.shareOfDrawsPct} max={100} color={color ?? "var(--data-teal)"} />
            </span>
            {sharePct(s.shareOfDrawsPct)}
          </span>
        ) : (
          <Dash />
        )}
      </td>
      <td className={`${WIDE} px-3 py-2`}>
        <span className="flex items-center justify-end gap-2 tabular-nums">
          <BarSpark values={s.runsByDay.map((d) => d.runs)} className="h-5 w-14" />
          <span className="w-12 text-right">{n(s.runs)}</span>
        </span>
      </td>
      <td className={`${WIDE} px-3 py-2`}>
        {reached.length ? (
          <span className="flex min-w-0 flex-wrap gap-1" title={reached.map((r) => `${stepName(r.outcome!)}: ${n(r.runs)}`).join("\n")}>
            {reached.slice(0, 2).map((r) => (
              <span key={r.outcome} className="k-chip max-w-full truncate tabular-nums">
                {stepName(r.outcome!)} {n(r.runs)}
              </span>
            ))}
            {reached.length > 2 && <span className="k-fg3 text-[12px]">+{reached.length - 2} more</span>}
          </span>
        ) : (
          <Dash />
        )}
      </td>
      <td className={`${WIDE} px-3 py-2 text-right tabular-nums`}>{s.costPerRunUsd != null ? usd(s.costPerRunUsd) : <Dash />}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        {s.valuePerDollar != null ? score(s.valuePerDollar) : missing ? <span className="k-fg3 text-[12px]">{missing}</span> : <Dash />}
      </td>
      <td className={`${WIDE} px-3 py-2 last:pr-4`}>
        {s.llms.length || s.templates.length ? (
          <span className="flex min-w-0 flex-wrap gap-1">
            {s.llms.map((l, i) => {
              const name = l.model ?? l.provider;
              return name ? <CatalogueName key={`l${i}`} kind="llm" name={name} vendorId={l.provider} variant="chip" /> : null;
            })}
            {s.templates.map((t, i) => (
              <CatalogueName key={`t${i}`} kind="template" name={t.templateDynastySlug} servedKey={t.templateDynastySlug} variant="chip" />
            ))}
          </span>
        ) : (
          <Dash />
        )}
      </td>
    </tr>
  );
}

/** Share of draws per day: one stacked bar per served day, the charted scripts in their colour, the rest as « Other ». */
function ShareChart({ e, charted, outcome }: { e: ScriptEngine; charted: string[]; outcome: string }) {
  const bars = shareBars(e, charted);
  return (
    <div className="border-b k-line-subtle px-4 py-3">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="k-label">Share of draws per day</span>
        <span className="k-fg3 text-[12px]">{bars.length === 0 ? null : bars.length === 1 ? shortDay(bars[0].day) : `${shortDay(bars[0].day)} to ${shortDay(bars[bars.length - 1].day)}`}</span>
      </div>
      {bars.length ? (
        <div className="flex h-16 items-end gap-[3px]" role="img" aria-label="Share of the Rating's draws per script, per day">
          {bars.map((b) => (
            <div
              key={b.day}
              className="flex h-full min-w-[4px] max-w-[36px] flex-1 flex-col-reverse overflow-hidden rounded-[3px]"
              title={[shortDay(b.day), ...charted.map((k, i) => `${scriptName(k, outcome)}: ${sharePct(b.parts[i])}`), `Other: ${sharePct(b.other)}`].join("\n")}
            >
              {b.parts.map((p, i) => (
                <span key={i} style={{ height: `${p}%`, background: SERIES[i] }} />
              ))}
              <span style={{ height: `${b.other}%`, background: OTHER }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="k-fg3 flex h-16 items-center text-[12px]">The Rating stores each day&apos;s shares; the first bar lands with the next build.</div>
      )}
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
        {charted.map((k, i) => (
          <span key={k} className="inline-flex min-w-0 items-center gap-1.5">
            <Dot color={SERIES[i]} />
            <span className="k-mono truncate">{scriptName(k, outcome)}</span>
          </span>
        ))}
        {e.scripts.length > charted.length && (
          <span className="k-fg3 inline-flex items-center gap-1.5">
            <Dot color={OTHER} />
            Other
          </span>
        )}
      </div>
    </div>
  );
}

function EngineBlock({ e }: { e: ScriptEngine }) {
  const stepName = useStepName();
  const [open, setOpen] = useState(false);
  const [retiredOpen, setRetiredOpen] = useState(false);
  const { top, more, retired } = splitScripts(e);
  const charted = chartScripts(e);
  const colorOf = (k: string) => {
    const i = charted.indexOf(k);
    return i >= 0 ? SERIES[i] : null;
  };
  const rows = [...top, ...(open ? more : []), ...(retiredOpen ? retired : [])];
  return (
    <section className="space-y-2">
      <SectionTitle
        count={e.scripts.length}
        right={
          <span className="k-fg2 hidden min-w-0 items-center gap-1.5 text-[12px] md:inline-flex">
            <span className="k-fg3 shrink-0">Favourite</span>
            {e.favourite ? <span className="k-mono truncate">{scriptName(e.favourite, e.outcome)}</span> : <Dash />}
          </span>
        }
      >
        <span className="inline-flex items-center gap-2">
          <OutcomeMark outcome={e.outcome} />
          {stepName(e.outcome)}
        </span>
      </SectionTitle>
      <p className="k-fg3 -mt-1 text-[12px]">
        {basisWords(e.basis)}. {n(e.runnableScripts)} runnable, {n(e.runs)} runs in 30 days.
        {e.outcomeValueUsd != null && ` One ${stepName(e.outcome)} is worth ${usd(e.outcomeValueUsd)}${e.outcomeValueSource ? ` (${e.outcomeValueSource})` : ""}.`}
      </p>
      <div className="k-card overflow-hidden">
        <ShareChart e={e} charted={charted} outcome={e.outcome} />
        <div className="k-scroll overflow-x-auto">
          <table className="w-full table-fixed text-[13px]">
            <thead>
              <tr>
                {COLS.map((c) => (
                  <th
                    key={c.head}
                    className={`k-label px-3 py-2.5 first:pl-4 last:pr-4 ${c.width ?? ""} ${c.wide ? WIDE : ""} ${c.right ? "text-right" : "text-left"}`}
                  >
                    {c.head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <ScriptRow key={s.scriptDynasty} s={s} outcome={e.outcome} color={colorOf(s.scriptDynasty)} stepName={stepName} />
              ))}
            </tbody>
          </table>
        </div>
        {e.scripts.length === 0 && <p className="k-fg3 border-t k-line-subtle px-4 py-2.5 text-[12px]">No script makes this outcome yet.</p>}
        {(more.length > 0 || retired.length > 0) && (
          <div className="k-fg3 flex flex-wrap items-center gap-2 border-t k-line-subtle px-4 py-2.5 text-[12px] tabular-nums">
            {more.length > 0 && (
              <button type="button" className="k-btn-ghost h-6 px-2" onClick={() => setOpen((v) => !v)}>
                {open ? "Show fewer" : `+${n(more.length)} more`}
              </button>
            )}
            {retired.length > 0 && (
              <button type="button" className="k-btn-ghost h-6 px-2" onClick={() => setRetiredOpen((v) => !v)}>
                {retiredOpen ? "Hide retired" : `${n(retired.length)} retired`}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** The page body over a served board (exported for the headless render check). */
export function ScriptEnginesView({ data }: { data: ScriptEngines }) {
  const now = useClientClock();
  const broken = data.health.broken;
  return (
    <div className="space-y-10">
      <p className="k-fg2 text-[13px]" style={broken ? { color: RED } : undefined}>
        {broken
          ? `The board was not rebuilt for over an hour (last build ${now ? timeAgo(data.computedAt, now) : shortDay(data.computedAt)}).`
          : `${engines(data.engines.length)}. Each one's Rating drew ${n(data.draws)} times today${now ? `, ${timeAgo(data.computedAt, now).toLowerCase()}` : ""}.`}
      </p>
      {data.engines.map((e) => (
        <EngineBlock key={e.outcome} e={e} />
      ))}
    </div>
  );
}

export function ScriptEnginesPage() {
  const q = useScriptEngines();
  if (q.isError && !q.data) return <Failed what="the scripts each Engine runs" />;
  if (!q.data) return <Loading />;
  if (q.data.state === "building") {
    return <p className="k-fg2 text-[13px]">The Rating is building the board (every 15 minutes). The Engines show here once it lands.</p>;
  }
  return <ScriptEnginesView data={q.data.board} />;
}

/** The hub's words for a read: red only when the board is broken. */
export function boardWords(r: ScriptEnginesRead): string {
  if (r.state === "building") return "Being built";
  if (r.board.health.broken) return "Not rebuilt for 1 hour";
  return engines(r.board.engines.length);
}

/** The hub's one-second read: red only when the board was not rebuilt for over an hour. */
export function ScriptEnginesTile({ href }: { href: string }) {
  const q = useScriptEngines();
  const data = q.data;
  const red = data ? boardBroken(data) : false;
  return (
    <StatTile label="Scripts per Engine" note={data?.state === "ready" ? `${n(data.board.draws)} draws each` : undefined} href={href}>
      <Figure
        value={
          q.isError && !data ? (
            <span className="k-fg3 text-[13px]">not readable</span>
          ) : !data ? (
            <Shimmer className="h-6 w-16" />
          ) : (
            <span style={{ color: red ? RED : undefined }}>{boardWords(data)}</span>
          )
        }
      />
    </StatTile>
  );
}

