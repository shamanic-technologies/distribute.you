"use client";

import { Bar, BarChart, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BrainIcon } from "@phosphor-icons/react/dist/csr/Brain";
import { ChartLineDownIcon } from "@phosphor-icons/react/dist/csr/ChartLineDown";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";
import { EyeSlashIcon } from "@phosphor-icons/react/dist/csr/EyeSlash";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { FlowArrowIcon } from "@phosphor-icons/react/dist/csr/FlowArrow";
import { IdentificationBadgeIcon } from "@phosphor-icons/react/dist/csr/IdentificationBadge";
import { ParagraphIcon } from "@phosphor-icons/react/dist/csr/Paragraph";
import { HandWavingIcon } from "@phosphor-icons/react/dist/csr/HandWaving";
import { MinusIcon } from "@phosphor-icons/react/dist/csr/Minus";
import { CalendarIcon } from "@phosphor-icons/react/dist/csr/Calendar";
import { ClockIcon } from "@phosphor-icons/react/dist/csr/Clock";
import { ScalesIcon } from "@phosphor-icons/react/dist/csr/Scales";
import { RocketLaunchIcon } from "@phosphor-icons/react/dist/csr/RocketLaunch";
import { StrategyIcon } from "@phosphor-icons/react/dist/csr/Strategy";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { PercentIcon } from "@phosphor-icons/react/dist/csr/Percent";
import { CrosshairIcon } from "@phosphor-icons/react/dist/csr/Crosshair";
import { HourglassIcon } from "@phosphor-icons/react/dist/csr/Hourglass";
import { TargetIcon } from "@phosphor-icons/react/dist/csr/Target";
import { GlobeIcon } from "@phosphor-icons/react/dist/csr/Globe";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { EmptyNote, SectionTitle, Shimmer } from "@/components/v2/ui";
import { CatalogueMark } from "@/components/v2/catalogue-mark";
import { useAuthQuery } from "@/lib/use-auth-query";
import { getPublicCatalogueSteps } from "@/lib/api";
import { useResearch } from "@/lib/research/research-source";
import { staleText, type ResearchFreshness } from "@/lib/research/freshness";
import {
  outcomeEntry,
  researchEngineOf,
  researchMeasureEntry,
  type ResearchChart,
  type ResearchMeasure,
  type ResearchOutcome,
  type ResearchPoint,
  type ResearchStudy,
  type ResearchTopic,
} from "@/lib/research/research";

/**
 * The pieces every Research view draws with (the hub, a question, the script and template
 * pages): a topic's mark, a section's mark and name, and the monthly charts. Every value arrives
 * written in features-service's live Research file; these only lay it out.
 */

export const TOPIC_LOOK: Record<ResearchTopic, { color: string; Icon: typeof BrainIcon }> = {
  llm: { color: "var(--data-violet)", Icon: BrainIcon },
  cost: { color: "var(--data-teal)", Icon: ChartLineDownIcon },
  followups: { color: "var(--data-amber)", Icon: ArrowsClockwiseIcon },
  opens: { color: "var(--data-sky)", Icon: EyeSlashIcon },
  template: { color: "var(--data-rose)", Icon: FileTextIcon },
  script: { color: "var(--data-lime)", Icon: FlowArrowIcon },
  // a template question too (which prompt), so it wears the template colour with its own mark
  naming: { color: "var(--data-rose)", Icon: IdentificationBadgeIcon },
  // how the first email is written (its shape, its first words): the same prompt family as a template
  layout: { color: "var(--data-rose)", Icon: ParagraphIcon },
  opening: { color: "var(--data-rose)", Icon: HandWavingIcon },
  dash: { color: "var(--data-rose)", Icon: MinusIcon },
  // when the email went out, in the prospect's timezone: a sending-schedule question
  weekday: { color: "var(--data-sky)", Icon: CalendarIcon },
  hour: { color: "var(--data-sky)", Icon: ClockIcon },
  // a typed question answered with a probability (Jev): what the Engines ask before they act
  judgment: { color: "var(--data-violet)", Icon: ScalesIcon },
  // the same people before and after something went live (the AI answering positive replies)
  launch: { color: "var(--data-sky)", Icon: RocketLaunchIcon },
  // a strategy: who an Engine serves and which scripts it may run, so the script colour
  strategy: { color: "var(--data-lime)", Icon: StrategyIcon },
  "sourcing-strategy": { color: "var(--data-lime)", Icon: MagnifyingGlassIcon },
  // an outcome's own questions (owner 2026-10-18): the share of leads that reach it; a tactic is a rule a
  // script follows, like a strategy
  conversion: { color: "var(--data-teal)", Icon: PercentIcon },
  tactic: { color: "var(--data-lime)", Icon: CrosshairIcon },
  // how long a person takes to answer: a timing question, like the hour of the day
  delay: { color: "var(--data-sky)", Icon: HourglassIcon },
  // how narrow a client's B2B niche is, graded by Jev: a typed judgment, so the judgment colour
  niche: { color: "var(--data-violet)", Icon: TargetIcon },
  // where the prospect lives: which market answers best, and at what cost
  country: { color: "var(--data-amber)", Icon: GlobeIcon },
};

/** A topic's look; a topic this build does not know yet wears a neutral mark, never a crash. */
const UNKNOWN_TOPIC_LOOK = { color: "var(--fg-3)", Icon: MagnifyingGlassIcon };
export function topicLook(topic: ResearchTopic): { color: string; Icon: typeof BrainIcon } {
  return TOPIC_LOOK[topic] ?? UNKNOWN_TOPIC_LOOK;
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function monthText(ym: string): string {
  return `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
}
export function dayText(ymd: string): string {
  return `${MONTHS[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}`;
}

/** "Oct 18, 15:30 UTC" off an ISO instant (a served build time, never "now"). */
export function instantText(iso: string): string {
  return `${dayText(iso.slice(0, 10))}, ${iso.slice(11, 16)} UTC`;
}

/** Where the page's figures come from: features-service's live build, and when it ran. */
export function liveText(file: { computedAt?: string | null; readOn: string }): string {
  return file.computedAt ? `Live, updated ${instantText(file.computedAt)}` : `Live, read on ${dayText(file.readOn)}`;
}

/**
 * Out-of-date figures in red (RESEARCH-STALE-1024-DASH): features-service's served `freshness.stale`,
 * never judged here. Null when fresh or not served, so the caller keeps its usual line.
 */
export function ResearchStaleNote({ freshness }: { freshness?: ResearchFreshness | null }) {
  const text = staleText(freshness);
  if (!text) return null;
  return (
    <span
      role="status"
      className="inline-flex items-start gap-1.5 rounded-[8px] bg-[color-mix(in_srgb,var(--data-rose)_12%,transparent)] px-2 py-1 text-[13px] font-medium leading-5 text-[var(--data-rose)]"
    >
      <WarningCircleIcon weight="duotone" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {text}
    </span>
  );
}

/** The page's "Live, updated" line with its green dot, or the red out-of-date note when the build is stale. */
export function ResearchLive({ file }: { file: { computedAt?: string | null; readOn: string; freshness?: ResearchFreshness } }) {
  if (staleText(file.freshness)) return <ResearchStaleNote freshness={file.freshness} />;
  return (
    <span className="k-fg2 inline-flex items-center gap-2 text-[13px]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--run)]" />
      {liveText(file)}
    </span>
  );
}

/** The section a study sits in: its measure (of an Engine), or its outcome. */
export type ResearchSection = { measure: ResearchMeasure } | { outcome: ResearchOutcome };
export function sectionOf(study: ResearchStudy): ResearchSection {
  if (study.measure) return { measure: study.measure };
  if (!study.outcome) throw new Error(`[dashboard] research study ${study.id} names neither a measure nor an outcome`);
  return { outcome: study.outcome };
}

/**
 * What the catalogue serves for a section: a measure wears its ENGINE's step (the Engine's outcome key), named by
 * the Engine's served name; an outcome row is its step, named and marked off the PUBLIC step catalogue as the
 * Outcomes pages wear it; Jev is no catalogue object (no step), so it is named and wears its topic mark.
 */
const unreadableSections = new Set<string>();
function useServedSection(section: ResearchSection) {
  const { file } = useResearch();
  const engine = "measure" in section ? researchEngineOf(file, section.measure) : null;
  const stepId = "measure" in section ? (engine?.outcome ?? null) : outcomeEntry(section.outcome, file)?.step ?? null;
  const steps = useAuthQuery(["publicCatalogueSteps"], getPublicCatalogueSteps, { staleTime: 10 * 60_000, enabled: !!stepId });
  const step = stepId ? steps.data?.find((s) => s.key === stepId) ?? null : null;
  const isError = !!stepId && ((steps.isError && steps.data === undefined) || (steps.data !== undefined && !step));
  if (stepId && isError && !unreadableSections.has(stepId)) {
    unreadableSections.add(stepId);
    console.error("[v2] research section unreadable in the catalogue", { id: stepId, error: steps.error?.message ?? "step not in the public catalogue" });
  }
  // A measure is named by its Engine as the Research read serves it; its mark is the Engine's step.
  const name = engine ? engine.name : step?.name ?? null;
  return { id: stepId, name, icon: step?.icon ?? null, color: null, failed: !!stepId && isError, loaded: !stepId || steps.data !== undefined || isError };
}

/** A section's mark, as served: an Engine's (or an outcome's) step icon, Jev's topic mark. */
export function SectionMark({ section, size = 16 }: { section: ResearchSection; size?: number }) {
  const served = useServedSection(section);
  if (!served.id) return <TopicMark topic="judgment" size={size} />;
  if (served.loaded) return <CatalogueMark icon={served.icon} color={served.color} name={served.name ?? served.id} size={size} />;
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 bg-[var(--bg-inset)] ${size <= 18 ? "rounded-[5px]" : "rounded-[8px]"}`}
      style={{ width: size, height: size }}
    />
  );
}

/** A section's served NAME (an Engine's, « Email sent »; an outcome's, « Positive reply »; Jev is named), a Shimmer until it answers. */
export function SectionName({ section }: { section: ResearchSection }) {
  const served = useServedSection(section);
  if (!served.id) return <>Jev</>;
  if (served.name) return <>{served.name}</>;
  if (served.failed) return <span className="k-fg4">{"—"}</span>;
  return <Shimmer className="inline-block h-4 w-20 align-middle" />;
}

/** Served step words joined by arrows. */
function InOrder({ items }: { items: string[] }) {
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-x-1.5">
          {i > 0 && <span className="k-fg3 font-normal">→</span>}
          <span>{it}</span>
        </span>
      ))}
    </span>
  );
}

/** A measure's words in order: the step its people start from (« Start » when from nothing), then the step it counts. */
export function MeasureSteps({ measure }: { measure: ResearchMeasure }) {
  const { file } = useResearch();
  const m = researchMeasureEntry(file, measure);
  if (!m) return <span className="k-fg4">{"—"}</span>;
  return <InOrder items={[m.startsFrom?.name ?? "Start", m.counts.name]} />;
}

/**
 * A measure's name where a page names it (a crumb, a title chip): its Engine's served name, and its step words beside
 * it when the Engine counts more than one thing (« Meeting booked · Form submitted → Meeting booked »).
 */
export function MeasureName({ measure }: { measure: ResearchMeasure }) {
  const { file } = useResearch();
  const several = (researchEngineOf(file, measure)?.measures.length ?? 0) > 1;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <SectionName section={{ measure }} />
      {several && (
        <span className="k-fg3 inline-flex items-center gap-1.5">
          ·<MeasureSteps measure={measure} />
        </span>
      )}
    </span>
  );
}

/**
 * The line under an outcome row's name: the Engines whose measures land on it, each once by its served name, or null
 * for a section that is no outcome (Jev).
 */
export function OutcomeMeasures({ outcome, prefix = true }: { outcome: ResearchOutcome; prefix?: boolean }) {
  const { file } = useResearch();
  const measures = (outcomeEntry(outcome, file)?.measures ?? []).filter((m) => researchMeasureEntry(file, m) != null);
  // One entry per ENGINE (served order): an Engine counting several things lands here once.
  const engines: ResearchMeasure[] = [];
  for (const m of measures) if (!engines.some((x) => researchEngineOf(file, x)?.outcome === researchEngineOf(file, m)?.outcome)) engines.push(m);
  if (!engines.length) return null;
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1">
      {prefix && <span>{engines.length === 1 ? "Engine:" : "Engines:"}</span>}
      {engines.map((m, i) => (
        <span key={m} className="inline-flex items-center gap-1">
          <SectionMark section={{ measure: m }} size={12} />
          <SectionName section={{ measure: m }} />
          {i < engines.length - 1 && <span>,</span>}
        </span>
      ))}
    </span>
  );
}

/**
 * A section's PATH, read IN ORDER (the reminder under its served name): a measure is `<from> → <counts>` (served
 * step words, « Start » when its people start from nothing); an outcome row names the Engines that land on it
 * (`OutcomeMeasures`); Jev has none (null), since it is not an outcome.
 */
export function SectionPath({ section }: { section: ResearchSection; compact?: boolean }) {
  if ("outcome" in section) return <OutcomeMeasures outcome={section.outcome} />;
  return <MeasureSteps measure={section.measure} />;
}

/** A topic's mark: a soft tile in its colour, drawn like a section's mark. */
export function TopicMark({ topic, size = 32 }: { topic: ResearchTopic; size?: number }) {
  const { color, Icon } = topicLook(topic);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[8px]"
      style={{
        width: size,
        height: size,
        color,
        background: `color-mix(in oklab, ${color} 14%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 22%, transparent)`,
      }}
      aria-hidden="true"
    >
      <Icon size={Math.round(size * 0.56)} weight="duotone" />
    </span>
  );
}

export function Arrow() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" className="k-fg4 shrink-0" aria-hidden="true">
      <path d="M2.5 6h7M6.5 3l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The tooltip every research chart shares: the month, the value, the counts behind it. */
function pointTooltip(points: ResearchPoint[]) {
  const byLabel = new Map(points.map((p) => [p.label, p]));
  return function ResearchTooltip({ active, label }: { active?: boolean; label?: string | number }) {
    const p = active ? byLabel.get(String(label)) : undefined;
    return p ? (
      <div className="k-popover px-2.5 py-1.5 text-[12px]">
        <p className="k-fg3 k-mono">{p.label}</p>
        <p className="font-medium tabular-nums">{p.display}</p>
        <p className="k-fg3 tabular-nums">{p.note}</p>
      </div>
    ) : null;
  };
}
const axisTick = { fontSize: 11, fill: "var(--fg-3)" };
const tickFor = (money: boolean) => (n: number) => (money ? `$${Math.round(n)}` : String(Math.round(n * 10) / 10));
const pctTick = (n: number) => `${Math.round(n)}%`;

/** One bar per month, v2 chart styling: fg-3 ticks, no grid, a k-popover tooltip. Thin months fade;
 *  the month still in progress (only part of its people counted yet) is a dotted outline. */
function MonthBars({ points, color, money }: { points: ResearchPoint[]; color: string; money: boolean }) {
  if (!points.length) return <EmptyNote>Nothing to draw yet.</EmptyNote>;
  const Tip = pointTooltip(points);
  return (
    <div className="h-[180px] px-2 pb-2 pt-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={48} tickCount={3} tickFormatter={tickFor(money)} />
          <Tooltip cursor={{ fill: "var(--data-track)" }} content={<Tip />} />
          <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={36} isAnimationActive={false}>
            {points.map((p) => (
              <Cell
                key={p.label}
                fill={color}
                fillOpacity={p.partial ? 0.12 : p.thin ? 0.35 : 0.85}
                stroke={p.partial ? color : undefined}
                strokeWidth={p.partial ? 1.5 : 0}
                strokeDasharray={p.partial ? "3 3" : undefined}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** The grey methodology line under a chart: which emails were too young to count. */
export function ChartNote({ note }: { note?: string }) {
  return note ? <p className="k-fg3 mt-1.5 text-[12px] leading-5">{note}</p> : null;
}

/** A monthly chart: the month on its own as bars, and beside it the average since inception. */
export function MonthsRow({ chart, color }: { chart: ResearchChart; color: string }) {
  const money = chart.lowerIsBetter;
  // A served day-by-day series (meeting-cost methods) carries no running line: its bars take the full width.
  if (!chart.cumulative?.points.length) {
    return (
      <div>
        <SectionTitle>{chart.title}</SectionTitle>
        <div className="k-card overflow-hidden">
          <MonthBars points={chart.points} color={color} money={money} />
        </div>
        <ChartNote note={chart.note} />
      </div>
    );
  }
  return (
    <div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="min-w-0">
          <SectionTitle>{chart.title}</SectionTitle>
          <div className="k-card overflow-hidden">
            <MonthBars points={chart.points} color={color} money={money} />
          </div>
        </div>
        <div className="min-w-0">
          <SectionTitle>{chart.cumulative?.title ?? "Since inception"}</SectionTitle>
          <div className="k-card overflow-hidden">
            <LineCard points={chart.cumulative?.points ?? []} color={color} money={money} />
          </div>
        </div>
      </div>
      <ChartNote note={chart.note} />
    </div>
  );
}

/**
 * A delay study (TTFPR-RESEARCH-STUDY-1021): the share of people per delay bucket as bars, and beside
 * it the served cumulative curve ("Within 1 day" 43%), both in % of the sample as features-service
 * wrote them. Nothing is summed here: the curve arrives cumulative.
 */
export function DelayRow({ chart, color }: { chart: ResearchChart; color: string }) {
  return (
    <div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="min-w-0">
          <SectionTitle>{chart.title}</SectionTitle>
          <div className="k-card overflow-hidden">
            <DelayBars points={chart.points} color={color} />
          </div>
        </div>
        <div className="min-w-0">
          <SectionTitle>{chart.curve?.title ?? "Replied by then"}</SectionTitle>
          <div className="k-card overflow-hidden">
            <DelayCurve points={chart.curve?.points ?? []} color={color} />
          </div>
        </div>
      </div>
      <ChartNote note={chart.note} />
    </div>
  );
}

/** A delay study's histogram with no curve (the per-day bins, owner 2026-10-21 "N=21"): vertical bars, full width. */
export function DelayHistogram({ chart, color }: { chart: ResearchChart; color: string }) {
  return (
    <div>
      <SectionTitle>{chart.title}</SectionTitle>
      <div className="k-card overflow-hidden">
        <DelayBars points={chart.points} color={color} />
      </div>
      <ChartNote note={chart.note} />
    </div>
  );
}

function DelayBars({ points, color }: { points: ResearchPoint[]; color: string }) {
  if (!points.length) return <EmptyNote>Nothing to draw yet.</EmptyNote>;
  const Tip = pointTooltip(points);
  return (
    <div className="h-[220px] px-2 pb-2 pt-3">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={40} tickCount={3} tickFormatter={pctTick} />
          <Tooltip cursor={{ fill: "var(--data-track)" }} content={<Tip />} />
          <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false}>
            {points.map((p) => (
              <Cell key={p.label} fill={color} fillOpacity={p.thin ? 0.35 : 0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DelayCurve({ points, color }: { points: ResearchPoint[]; color: string }) {
  if (!points.length) return <EmptyNote>Nothing to draw yet.</EmptyNote>;
  const Tip = pointTooltip(points);
  return (
    <div className="h-[220px] px-2 pb-2 pt-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={40} ticks={[0, 50, 100]} domain={[0, 100]} tickFormatter={pctTick} />
          <Tooltip cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }} content={<Tip />} />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={{ r: 2.5, fill: color, strokeWidth: 0 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** A line over the months, styled like v2's other charts: fg-3 ticks, no grid, a k-popover tooltip.
 *  The segment into a month still in progress is dotted: two series, `solid` stops at the last whole
 *  month and `pending` runs from there through the partial ones. */
function LineCard({ points, color, money }: { points: ResearchPoint[]; color: string; money: boolean }) {
  if (!points.length) return <EmptyNote>Nothing to draw yet.</EmptyNote>;
  const Tip = pointTooltip(points);
  const data = points.map((p, i) => ({
    ...p,
    solid: p.partial ? undefined : p.value,
    pending: p.partial || points[i + 1]?.partial ? p.value : undefined,
  }));
  return (
    <div className="h-[180px] px-2 pb-2 pt-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={48} tickCount={3} tickFormatter={tickFor(money)} />
          <Tooltip cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }} content={<Tip />} />
          {/* pending first, so a whole month's filled dot sits over the hollow one where they meet */}
          <Line type="linear" dataKey="pending" stroke={color} strokeWidth={1.5} strokeDasharray="3 3" dot={{ r: 2.5, fill: "none", stroke: color, strokeWidth: 1.2, strokeDasharray: "0" }} activeDot={false} isAnimationActive={false} />
          <Line type="linear" dataKey="solid" stroke={color} strokeWidth={1.5} dot={{ r: 2.5, fill: color, strokeWidth: 0 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Row({ k, v }: { k: string; v: React.ReactNode | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="k-fg3 shrink-0">{k}</dt>
      <dd className="min-w-0 truncate text-right">{v ?? <span className="k-fg4">{"—"}</span>}</dd>
    </div>
  );
}


/** Why a template is listed on its own, in words. */
export const STANDALONE_WORDS: Record<string, string> = {
  no_dynasty_on_engine: "No dynasty on this Engine lists this version.",
  template_dynasties_unreadable: "Content generation's dynasties could not be read, so every version is listed on its own.",
};

/** A template's identity in one word: whether its emails name the client. */
export function identityWord(identity: string | null | undefined): string | null {
  if (!identity) return null;
  return identity.charAt(0).toUpperCase() + identity.slice(1);
}
