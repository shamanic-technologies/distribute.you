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
import { EmptyNote, SectionTitle, Shimmer } from "@/components/v2/ui";
import { ChannelChip } from "@/components/v2/offer-sales-paths";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { useAcquisitionChannels } from "@/lib/use-acquisition-channels";
import type { AcquisitionChannelDef } from "@/lib/acquisition-channels";
import { legFor, stepLabel } from "@/lib/legs";
// The shared v2 mark and its colour table; renamed to pipe vocabulary in a later change.
import { pipeFor, type PipeGlyph } from "@/lib/v2/pipe-look";
import { PipeMark } from "@/components/v2/pipe-mark";
import {
  OUTCOME_PATH,
  PIPE_KEY,
  type ResearchChart,
  type ResearchPipe,
  type ResearchOutcome,
  type ResearchPoint,
  type ResearchStudy,
  type ResearchTopic,
} from "@/lib/research/research";

/**
 * The pieces every Research view draws with (the hub, a question, the workflow and template
 * pages): a topic's mark, a section's mark and name, and the monthly charts. Every value arrives
 * written in research.json; these only lay it out.
 */

export const TOPIC_LOOK: Record<ResearchTopic, { color: string; Icon: typeof BrainIcon }> = {
  llm: { color: "var(--data-violet)", Icon: BrainIcon },
  cost: { color: "var(--data-teal)", Icon: ChartLineDownIcon },
  followups: { color: "var(--data-amber)", Icon: ArrowsClockwiseIcon },
  opens: { color: "var(--data-sky)", Icon: EyeSlashIcon },
  template: { color: "var(--data-rose)", Icon: FileTextIcon },
  workflow: { color: "var(--data-lime)", Icon: FlowArrowIcon },
  // a template question too (which prompt), so it wears the template colour with its own mark
  naming: { color: "var(--data-rose)", Icon: IdentificationBadgeIcon },
  // how the first email is written (its shape, its first words): the same prompt family as a template
  layout: { color: "var(--data-rose)", Icon: ParagraphIcon },
  opening: { color: "var(--data-rose)", Icon: HandWavingIcon },
  dash: { color: "var(--data-rose)", Icon: MinusIcon },
  // when the email went out, in the prospect's timezone: a sending-schedule question
  weekday: { color: "var(--data-sky)", Icon: CalendarIcon },
  hour: { color: "var(--data-sky)", Icon: ClockIcon },
  // a typed question answered with a probability (Jev): what the pipes ask before they act
  judgment: { color: "var(--data-violet)", Icon: ScalesIcon },
  // the same people before and after something went live (the AI answering positive replies)
  launch: { color: "var(--data-sky)", Icon: RocketLaunchIcon },
};

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function monthText(ym: string): string {
  return `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
}
export function dayText(ymd: string): string {
  return `${MONTHS[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}`;
}

/** A section's look: the colour and glyph its mark wears. */
export interface SectionLook {
  color: string;
  glyph: PipeGlyph;
}

/** A pipe's look: the one the v2 mark table fixes for its channel and the step its leg lands on. */
export function pipeLook(pipe: ResearchPipe): SectionLook {
  const k = PIPE_KEY[pipe];
  const { color, glyph } = pipeFor(k.channel, k.step, "");
  return { color, glyph };
}

/** An outcome section's look: one outcome across every leg, so it wears no pipe's colour. */
const OUTCOME_LOOK: Record<ResearchOutcome, SectionLook> = {
  meeting: { color: "var(--data-sky)", glyph: "square" },
  judgment: { color: "var(--data-violet)", glyph: "hex" },
};
export function outcomeLook(outcome: ResearchOutcome): SectionLook {
  return OUTCOME_LOOK[outcome];
}

/** The section a study sits in: its pipe, or its outcome. */
export type ResearchSection = { pipe: ResearchPipe } | { outcome: ResearchOutcome };
export function sectionOf(study: ResearchStudy): ResearchSection {
  if (study.pipe) return { pipe: study.pipe };
  if (!study.outcome) throw new Error(`[dashboard] research study ${study.id} names neither a pipe nor an outcome`);
  return { outcome: study.outcome };
}
export function sectionLook(section: ResearchSection): SectionLook {
  return "pipe" in section ? pipeLook(section.pipe) : outcomeLook(section.outcome);
}

/** A section's mark: a soft tile in its colour with its glyph. */
export function SectionMark({ section, size }: { section: ResearchSection; size?: number }) {
  const look = sectionLook(section);
  return <PipeMark color={look.color} glyph={look.glyph} size={size} />;
}

type InOrderItem = { step: string } | { channel: string; def: AcquisitionChannelDef };

/** Served words joined by arrows, a channel chip (or, compact, its name) in its place. */
function InOrder({ items, compact }: { items: InOrderItem[]; compact: boolean }) {
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-x-1.5">
          {i > 0 && <span className="k-fg3 font-normal">→</span>}
          {"step" in it ? (
            <span>{it.step}</span>
          ) : compact ? (
            <span>{it.channel}</span>
          ) : (
            <ChannelChip name={it.channel} def={it.def} notRun={false} compact />
          )}
        </span>
      ))}
    </span>
  );
}

/**
 * A section's name, read IN ORDER like a campaign's path: a pipe is `Lead found → [channel] →
 * Positive reply` (the leg's two steps with the channel doing it between them); the meeting outcome
 * is its sales path `Lead found → Positive reply → Meeting booked`; Jev is named, since it is not an
 * outcome. Every word is served (the leg catalogue, the channel list): a Shimmer until they answer.
 * `compact` writes the channel as a word, for a line that sits inside a chip.
 */
export function SectionName({ section, compact = false }: { section: ResearchSection; compact?: boolean }) {
  const catalogue = useLegCatalogue();
  const channels = useAcquisitionChannels();
  if ("outcome" in section) {
    const path = OUTCOME_PATH[section.outcome];
    if (!path) return <>Jev</>;
    const labels = path.map((k) => stepLabel(catalogue, k));
    if (labels.some((l) => l == null)) return <Shimmer className="inline-block h-4 w-56 align-middle" />;
    return <InOrder items={labels.map((l) => ({ step: l as string }))} compact={compact} />;
  }
  const k = PIPE_KEY[section.pipe];
  const leg = legFor(catalogue, k.leg);
  const def = channels.find((d) => d.featureSlug === k.channel);
  if (!leg?.fromLabel || !def) return <Shimmer className="inline-block h-4 w-56 align-middle" />;
  return <InOrder items={[{ step: leg.fromLabel }, { channel: def.name, def }, { step: leg.toLabel }]} compact={compact} />;
}

/** A topic's mark: a soft tile in its colour, drawn like a section's mark. */
export function TopicMark({ topic, size = 32 }: { topic: ResearchTopic; size?: number }) {
  const { color, Icon } = TOPIC_LOOK[topic];
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

