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
import { EmptyNote, SectionTitle } from "@/components/v2/ui";
import { crewFor } from "@/lib/v2/crews";
import { CREW_KEY, type ResearchChart, type ResearchCrew, type ResearchPoint, type ResearchTopic } from "@/lib/research/research";

/**
 * The pieces every Research view draws with (the hub, a question, the workflow and template
 * pages): a topic's mark, the crew's identity, and the monthly charts. Every value arrives
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
};

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function monthText(ym: string): string {
  return `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
}
export function dayText(ymd: string): string {
  return `${MONTHS[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}`;
}

export function crewIdentity(crew: ResearchCrew) {
  const k = CREW_KEY[crew];
  return crewFor(k.channel, k.step, crew);
}

/** A topic's mark: a soft tile in its colour, drawn like a crew's mark. */
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

/** One bar per month, v2 chart styling: fg-3 ticks, no grid, a k-popover tooltip. Thin months fade. */
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
              <Cell key={p.label} fill={color} fillOpacity={p.thin ? 0.35 : 0.85} />
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

/** A line over the months, styled like v2's other charts: fg-3 ticks, no grid, a k-popover tooltip. */
function LineCard({ points, color, money }: { points: ResearchPoint[]; color: string; money: boolean }) {
  if (!points.length) return <EmptyNote>Nothing to draw yet.</EmptyNote>;
  const Tip = pointTooltip(points);
  return (
    <div className="h-[180px] px-2 pb-2 pt-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={48} tickCount={3} tickFormatter={tickFor(money)} />
          <Tooltip cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }} content={<Tip />} />
          <Line type="linear" dataKey="value" stroke={color} strokeWidth={1.5} dot={{ r: 2.5, fill: color, strokeWidth: 0 }} isAnimationActive={false} />
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

