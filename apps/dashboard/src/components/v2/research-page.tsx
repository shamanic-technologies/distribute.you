"use client";

import { staleText } from "@/lib/research/freshness";
import { V2ResearchPerformanceView } from "@/components/v2/research-performance";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { EmptyNote, Figure, SectionTitle, StatTile, TopBar } from "@/components/v2/ui";
import { HubSectionBlock, useOpenSections } from "@/components/v2/hub-section";
import {
  Arrow,
  ChartNote,
  DelayHistogram,
  DelayRow,
  MonthsRow,
  Row,
  topicLook,
  OutcomePipes,
  SectionMark,
  SectionName,
  SectionPath,
  TopicMark,
  type ResearchSection,
  dayText,
  liveText,
  ResearchLive,
  ResearchStaleNote,
  sectionOf,
  monthText,
} from "@/components/v2/research-bits";
import { V2ResearchCatalogView, PipeCatalogLinks } from "@/components/v2/research-catalog";
import { useResearchPipeLeg } from "@/components/v2/research-live-workflows";
import { ResearchSwitches } from "@/components/v2/maturity-view-switch";
import { CatalogueName } from "@/components/v2/catalogue-name";
import { ResearchSourceProvider, useResearch, useResearchCatalog } from "@/lib/research/research-source";
import { useFeatures } from "@/lib/features-context";
import { shortWorkflowName } from "@/lib/live-workflow-rows";
import { useCostBasis } from "@/lib/v2/use-cost-basis";
import { formatUsdAdaptive } from "@/lib/format-number";
import { v2Href } from "@/lib/v2/routes";
import {
  GOAL_LABEL,
  topicLabel,
  outcomeEntry,
  outcomeGroups,
  parseResearchPath,
  pointHref,
  researchPipeEntry,
  researchWorkflow,
  studiesFor,
  studiesForOutcome,
  studyById,
  studyOutcomeText,
  studySpark,
  studyState,
  type ResearchChart,
  type ResearchPoint,
  type ResearchStudy,
  type ResearchTopic,
  type StudyState,
} from "@/lib/research/research";

/**
 * Research: what we measured across every org's campaigns, one card per question, in three groups
 * (owner 2026-10-18): Pipes (one leg x one channel each), Outcomes (one row per outcome, asked
 * across every pipe that lands on it), Other (Jev). Staff only: page behind StaffOnly, data behind the staff route (research-source.tsx).
 *
 * Built on Keel's own anatomy (see the dashboard-v2-ux skill): the hub is a card grid
 * (mark + question + state, an inset block of stat cells with a mini chart in the mark's
 * colour, a footer line), a question is a v2 record (40px mark, 24px h1, stat tiles, a main
 * column and a Details aside). Every figure, label and sentence arrives written in
 * features-service's live Research file; this file lays them out and picks one thing only: each topic's mark.
 */

/** What the WINNER cell is called, per topic: the cost curve is a measurement, it ranks nothing. */
const WINNER_LABEL: Record<ResearchTopic, string> = {
  llm: "Winner",
  cost: "Comparison",
  followups: "Best depth",
  opens: "Winner",
  template: "Winner",
  workflow: "Winner",
  naming: "Winner",
  layout: "Winner",
  opening: "Winner",
  dash: "Winner",
  weekday: "Winner",
  hour: "Winner",
  // a count or a share, like the cost curve: it ranks nothing
  judgment: "Comparison",
  // before against after: two periods, never a pick among options
  launch: "Comparison",
  strategy: "Winner",
  "sourcing-strategy": "Winner",
  // the share of leads reaching an outcome, like the cost curve: a measurement
  conversion: "Comparison",
  pipe: "Winner",
  channel: "Winner",
  leg: "Winner",
  tactic: "Winner",
  // a distribution of delays: it ranks nothing
  delay: "Comparison",
  // one bar per niche grade: a pick among options
  niche: "Winner",
  // countries ranked on their rate and their cost per outcome
  country: "Winner",
};

const STATE_LOOK: Record<StudyState, { label: string; dot: string }> = {
  conclusion: { label: "Conclusion", dot: "bg-[var(--data-teal)]" },
  signal: { label: "Signal", dot: "bg-[var(--data-amber)]" },
  noise: { label: "Noise", dot: "bg-[var(--fg-4)]" },
  "no-data": { label: "Not enough data", dot: "border-[1.5px] border-[var(--fg-3)]" },
};

/** The first bar is a winner only when the verdict is a conclusion; otherwise it merely leads. */
/** A study's winner, named the shared way when it is a model, a template or a workflow (owner 2026-10-22). */
function StudyWinner({ study }: { study: ResearchStudy }) {
  if (!study.winner) return <span className="k-fg4">{"—"}</span>;
  const kind = study.topic === "llm" ? "llm" : study.topic === "template" ? "template" : study.topic === "workflow" ? "workflow" : null;
  if (!kind) return <span className="min-w-0 truncate">{study.winner}</span>;
  return <CatalogueName kind={kind} name={study.winner} />;
}

function winnerLabel(study: ResearchStudy, state: StudyState): string {
  // a cost split names its largest share, it ranks nothing
  if (study.winnerLabel) return study.winnerLabel;
  const label = WINNER_LABEL[study.topic] ?? "Comparison";
  return state === "conclusion" || label !== "Winner" ? label : "Leader";
}

/** A dot plus a capitalised word, Keel's state. */
function StudyStateDot({ state }: { state: StudyState }) {
  const look = STATE_LOOK[state];
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] text-[var(--fg-2)]">
      <span className={`h-1.5 w-1.5 rounded-full ${look.dot}`} />
      {look.label}
    </span>
  );
}

// ─── Small charts (the card's mini viz, in the topic's colour) ─────────────

function MiniBars({ points, color, winner }: { points: ResearchPoint[]; color: string; winner: string | null }) {
  const pts = points.slice(0, 7);
  const max = Math.max(...pts.map((p) => p.value), 0) || 1;
  return (
    <div className="flex h-5 items-end gap-[3px]" aria-hidden="true">
      {pts.map((p) => (
        <span
          key={p.label}
          className="w-[6px] rounded-[2px]"
          style={{ height: `${Math.max(3, (p.value / max) * 20)}px`, background: color, opacity: p.label === winner ? 1 : 0.4 }}
        />
      ))}
    </div>
  );
}

function MiniLine({ points, color }: { points: ResearchPoint[]; color: string }) {
  const v = points.map((p) => p.value);
  if (v.length < 2) return null;
  const w = 64;
  const h = 20;
  const max = Math.max(...v);
  const min = Math.min(...v);
  const span = max - min || 1;
  const pts = v.map((x, i) => [(i / (v.length - 1)) * w, h - 2 - ((x - min) / span) * (h - 4)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{ color }} className="shrink-0">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2" fill="currentColor" />
    </svg>
  );
}

// ─── Hub ───────────────────────────────────────────────────────────────────

function StudyCard({ study, href }: { study: ResearchStudy; href: string }) {
  const look = topicLook(study.topic);
  const state = studyState(study);
  const spark = study.status === "measured" ? studySpark(study) : null;
  return (
    <Link href={href} className="k-card flex min-w-0 flex-col p-4">
      <div className="flex items-start gap-3">
        <TopicMark topic={study.topic} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="k-fg3 truncate text-[12px]">
              <span style={{ color: look.color }}>{topicLabel(study.topic)}</span>
              {" · "}
              {GOAL_LABEL[study.goal]}
            </p>
            <StudyStateDot state={state} />
          </div>
          <p className="mt-0.5 text-[14px] font-medium leading-5">{study.question}</p>
        </div>
      </div>

      <div className="k-inset mt-4 grid grid-cols-2 overflow-hidden rounded-[10px] shadow-[inset_0_0_0_1px_var(--line-subtle)]">
        <div className="min-w-0 border-r border-[var(--line-subtle)] p-3">
          <p className="k-label">{winnerLabel(study, state)}</p>
          <p className="mt-1.5 flex min-w-0 text-[14px] font-medium leading-6" title={study.winner ?? undefined}>
            <StudyWinner study={study} />
          </p>
          {state === "no-data" && <p className="k-fg3 mt-0.5 truncate text-[11px]">nothing to compare</p>}
        </div>
        <div className="min-w-0 p-3">
          <p className="k-label">Result</p>
          <div className="mt-1.5 flex items-end justify-between gap-2">
            <p className="text-[20px] font-medium leading-6 tabular-nums">{study.result?.display ?? <span className="k-fg4">{"—"}</span>}</p>
            {spark && (spark.kind === "line" ? <MiniLine points={spark.points} color={look.color} /> : <MiniBars points={spark.points} color={look.color} winner={study.winner} />)}
          </div>
          <p className="k-fg3 mt-0.5 truncate text-[11px]" title={study.result?.unit}>
            {study.result?.unit ?? "no result yet"}
          </p>
        </div>
      </div>

      <span className="-mx-2 mt-auto flex items-center gap-2 rounded-[8px] px-2 pb-0 pt-3 text-[13px]">
        <span className="k-fg3 shrink-0">Result</span>
        <span className="min-w-0 flex-1 truncate" title={study.headline}>
          {study.headline}
        </span>
        <Arrow />
      </span>
      {study.charts[0]?.note && <p className="k-fg4 mt-1.5 truncate text-[11px]" title={study.charts[0].note}>{study.charts[0].note}</p>}
    </Link>
  );
}

/** Where the hub remembers which sections are open, so Back from a study finds them as left. */
const OPEN_SECTIONS_KEY = "distribute-research-open-sections";

function StudyGrid({ studies, base }: { studies: ResearchStudy[]; base: string }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {studies.map((st) => (
        <StudyCard key={st.id} study={st} href={`${base}/${encodeURIComponent(st.id)}`} />
      ))}
    </div>
  );
}

/**
 * One section of the hub (owner 2026-10-18: « collapse les pages par pipe, avec un logo un nom,
 * et en dessous du nom le path pour notre rappel »): a header button with the served mark and
 * name, the path under the name, the study and conclusion counts and a chevron; under it, the
 * section's links and study cards, shown on click.
 */
function ResearchSectionBlock({
  id,
  section,
  studies,
  open,
  onToggle,
  animate,
  line,
  children,
}: {
  id: string;
  section: ResearchSection;
  studies: ResearchStudy[];
  open: boolean;
  onToggle: () => void;
  animate: boolean;
  /** The second line when the section has no path (Jev). */
  line?: string | null;
  children: React.ReactNode;
}) {
  const conclusions = studies.filter((st) => studyState(st) === "conclusion").length;
  return (
    <HubSectionBlock
      id={`research-${id}`}
      open={open}
      onToggle={onToggle}
      animate={animate}
      mark={(px) => <SectionMark section={section} size={px} />}
      name={<SectionName section={section} />}
      line={line ?? <SectionPath section={section} />}
      meta={`${studies.length} ${studies.length === 1 ? "study" : "studies"} · ${conclusions} ${conclusions === 1 ? "conclusion" : "conclusions"}`}
    >
      {children}
    </HubSectionBlock>
  );
}

function V2ResearchHub({ base }: { base: string }) {
  const RESEARCH = useResearch().file;
  const { open, toggle, ready } = useOpenSections(OPEN_SECTIONS_KEY);
  const v = RESEARCH.volume;
  const called = RESEARCH.studies.filter((st) => studyState(st) === "conclusion").length;
  const signals = RESEARCH.studies.filter((st) => studyState(st) === "signal").length;
  const maxMonth = v ? Math.max(...v.byMonth.map((m) => m.emails), 1) : 1;
  // Every pipe the file serves, in its order (WA-PIPE-RESEARCH-1023): a pipe with no study yet keeps its section and tabs.
  const pipeRows = RESEARCH.pipes.map(({ id: pipe }) => ({ pipe, studies: studiesFor(pipe, RESEARCH) }));
  const groups = outcomeGroups(RESEARCH);
  const withStudies = (metas: typeof groups.outcomes) => metas.map((meta) => ({ meta, studies: studiesForOutcome(meta.id, RESEARCH) })).filter((r) => r.studies.length > 0);
  const outcomeRows = withStudies(groups.outcomes);
  const otherRows = withStudies(groups.other);
  return (
    <>
      <TopBar crumbs={[{ label: "Research" }]} actions={<ResearchSwitches />} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">
              {RESEARCH.studies.length} questions, {called} with a conclusion, {signals} with a signal
            </h1>
            <p className="k-fg2 mt-1 text-[14px]">
              What works in cold email, measured on every campaign we ran for every client, {monthText(RESEARCH.window.from)} to{" "}
              {monthText(RESEARCH.window.to)}.
            </p>
            <p className="k-fg3 mt-1 text-[12px] leading-5">{RESEARCH.maturation.note}</p>
          </div>
          <ResearchLive file={RESEARCH} />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Emails studied"
            note={v ? `People first written to from ${v.byMonth[0]?.label ?? ""} to ${dayText(RESEARCH.maturation.cutoff)}, old enough to count` : "Not served live yet"}
          >
            <div className="flex items-end justify-between gap-2">
              <Figure value={v ? v.emails.toLocaleString("en-US") : <span className="k-fg4">—</span>} />
              <div className="flex h-6 items-end gap-[3px]" aria-hidden="true">
                {(v?.byMonth ?? []).map((m) => (
                  <span
                    key={m.label}
                    className="w-[6px] rounded-[2px] bg-[var(--accent)]"
                    style={{ height: `${Math.max(3, (m.emails / maxMonth) * 24)}px`, opacity: 0.55 }}
                  />
                ))}
              </div>
            </div>
          </StatTile>
          <StatTile label="Clients" note={v ? "all orgs, pooled" : "Not served live yet"}>
            <Figure value={v ? v.orgs.toLocaleString("en-US") : <span className="k-fg4">—</span>} />
          </StatTile>
          <StatTile label="Workflows compared" note={v ? undefined : "Not served live yet"}>
            <Figure value={v ? v.workflows.toLocaleString("en-US") : <span className="k-fg4">—</span>} />
          </StatTile>
          <StatTile label="Conclusions" note={`of ${RESEARCH.studies.length}`}>
            <div className="flex items-end justify-between gap-2">
              <Figure value={called} />
              <div className="flex min-w-0 flex-wrap justify-end gap-[3px]" aria-hidden="true">
                {RESEARCH.studies.map((st) => (
                  <span
                    key={st.id}
                    className="h-4 w-[4px] rounded-full"
                    style={{ background: studyState(st) === "conclusion" ? "var(--data-teal)" : studyState(st) === "signal" ? "var(--data-amber)" : "var(--data-track)" }}
                  />
                ))}
              </div>
            </div>
          </StatTile>
        </div>

        {/* Three groups (owner 2026-10-18): Pipes, Outcomes, Other; every row collapsed by default. */}
        <div className="mt-8 space-y-8">
          <div>
            <SectionTitle count={pipeRows.length}>Pipes</SectionTitle>
            <div className="space-y-3">
              {pipeRows.map(({ pipe, studies }) => (
                <ResearchSectionBlock key={pipe} id={pipe} section={{ pipe }} studies={studies} open={open.has(pipe)} onToggle={() => toggle(pipe)} animate={ready}>
                  <PipeCatalogLinks base={base} pipe={pipe} />
                  {studies.length > 0 && <StudyGrid studies={studies} base={base} />}
                </ResearchSectionBlock>
              ))}
            </div>
          </div>

          {/* One row per outcome, asked across every pipe that lands on it: the pipes named under it. */}
          {outcomeRows.length > 0 && (
            <div>
              <SectionTitle count={outcomeRows.length}>Outcomes</SectionTitle>
              <div className="space-y-3">
                {outcomeRows.map(({ meta, studies }) => {
                  const id = `outcome-${meta.id}`;
                  return (
                    <ResearchSectionBlock key={meta.id} id={id} section={{ outcome: meta.id }} studies={studies} open={open.has(id)} onToggle={() => toggle(id)} animate={ready}>
                      <p className="k-fg3 mb-3 text-[12px] leading-5">{meta.population}</p>
                      <StudyGrid studies={studies} base={base} />
                    </ResearchSectionBlock>
                  );
                })}
              </div>
            </div>
          )}

          {otherRows.length > 0 && (
            <div>
              <SectionTitle count={otherRows.length}>Other</SectionTitle>
              <div className="space-y-3">
                {otherRows.map(({ meta, studies }) => {
                  const id = `outcome-${meta.id}`;
                  return (
                    <ResearchSectionBlock
                      key={meta.id}
                      id={id}
                      section={{ outcome: meta.id }}
                      studies={studies}
                      open={open.has(id)}
                      onToggle={() => toggle(id)}
                      animate={ready}
                      line={meta.description}
                    >
                      <p className="k-fg3 mb-3 text-[12px] leading-5">{meta.population}</p>
                      <StudyGrid studies={studies} base={base} />
                    </ResearchSectionBlock>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── One question ──────────────────────────────────────────────────────────

/** Bars, one row each: label and value on a line, the bar, the counts behind it. */
function BarsChart({
  chart,
  color,
  winner,
  hrefFor,
  nameFor,
}: {
  chart: ResearchChart;
  color: string;
  winner: string | null;
  /** A workflow's or template's bar opens that one's own page. */
  hrefFor?: (p: ResearchPoint) => string | null;
  /** A workflow's own name (Rampart), shown before what it writes with. */
  nameFor?: (p: ResearchPoint) => string | null;
}) {
  if (!chart.points.length) return <EmptyNote>Nothing to draw yet.</EmptyNote>;
  const max = Math.max(...chart.points.map((p) => p.value), 0) || 1;
  return (
    <ul className="divide-y divide-[var(--line-subtle)]">
      {chart.points.map((p, i) => {
        // The study's winner is marked only where it leads the chart: on a per-tier chart it can
        // sit last with no price, and "Winner" beside "None yet" states two things at once.
        const top = winner !== null && p.label === winner && i === 0;
        const href = hrefFor?.(p) ?? null;
        const name = nameFor?.(p) ?? null;
        const inner = (
          <>
            <div className="flex items-baseline gap-2 text-[13px]">
              <span className={`min-w-0 flex-1 truncate ${top ? "font-medium" : ""}`} title={name ? `${name} · ${p.label}` : p.label}>
                {name && <span className="font-medium">{name}</span>}
                {name && <span className="k-fg3"> · </span>}
                <span className={name ? "k-fg2" : ""}>{p.label}</span>
              </span>
              {top && <span className="k-chip shrink-0">Winner</span>}
              {p.thin && <span className="k-fg3 shrink-0 text-[12px]">Learning</span>}
              <span className={`w-16 shrink-0 text-right tabular-nums ${top ? "font-medium" : ""}`}>{p.display}</span>
              {href && (
                <span className="k-fg4 shrink-0 opacity-0 group-hover:opacity-100">
                  <Arrow />
                </span>
              )}
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--data-track)]">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(2, (p.value / max) * 100)}%`, background: color, opacity: top ? 1 : p.thin ? 0.3 : 0.55 }}
              />
            </div>
            <p className="k-fg3 mt-1 text-[12px] tabular-nums">{p.note}</p>
          </>
        );
        return (
          <li key={p.label}>
            {href ? (
              <Link href={href} className="k-hover group block px-4 py-2.5" title={`Open ${p.label}`}>
                {inner}
              </Link>
            ) : (
              <div className="px-4 py-2.5">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function V2ResearchStudy({ base, studyId }: { base: string; studyId: string }) {
  const RESEARCH = useResearch().file;
  const study = studyById(studyId, RESEARCH);
  // A workflow bar names the workflow (Rampart) as workflow-service states it, off the research catalogue.
  const catalog = useResearchCatalog(useResearch().basis).data ?? null;
  const { getFeature } = useFeatures();
  const workflowPipe = study?.topic === "workflow" ? study.pipe : null;
  const workflowChannel = researchPipeEntry(RESEARCH, workflowPipe)?.channel ?? null;
  const channelName = workflowChannel ? getFeature(workflowChannel)?.name ?? null : null;
  // The email legs' population and rule (clients, emails, the run-start wait) describe the figures of
  // a pipe on a PROACTIVE leg only: a meeting study states its own in its sample and chart note.
  const proactiveLeg = useResearchPipeLeg(study?.pipe ?? null) != null;
  const workflowName = (p: ResearchPoint): string | null => {
    if (!workflowPipe || !catalog || !p.key) return null;
    const w = researchWorkflow(catalog, workflowPipe, p.key);
    return w?.name ? shortWorkflowName(w.name, channelName) : null;
  };
  if (!study) {
    return (
      <>
        <TopBar crumbs={[{ label: "Research", href: base }, { label: "Not found" }]} actions={<ResearchSwitches />} />
        <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
          <div className="k-card">
            <EmptyNote>
              This question is not in the research.{" "}
              <Link href={base} className="k-fg underline">
                Back to Research
              </Link>
            </EmptyNote>
          </div>
        </div>
      </>
    );
  }
  const section = sectionOf(study);
  const outcomeText = studyOutcomeText(study, RESEARCH);
  const outcomeMeta = study.pipe ? null : outcomeEntry(study.outcome, RESEARCH);
  const emailLeg = proactiveLeg;
  const look = topicLook(study.topic);
  const state = studyState(study);
  const crumbs = [{ label: "Research", href: base }, { label: <SectionName section={section} /> }, { label: topicLabel(study.topic) }];
  return (
    <>
      <TopBar crumbs={crumbs} actions={<ResearchSwitches />} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <TopicMark topic={study.topic} size={40} />
          <div className="min-w-0">
            <h1 className="text-[24px] font-medium leading-[30px] tracking-[-0.02em]">{study.question}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <StudyStateDot state={state} />
              <span className="k-chip inline-flex items-center gap-1.5">
                <SectionMark section={section} size={12} />
                <SectionName section={section} />
              </span>
              <span className="k-chip">{GOAL_LABEL[study.goal]}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label={winnerLabel(study, state)}>
            <p className="flex min-w-0 text-[18px] font-medium leading-7" title={study.winner ?? undefined}>
              <StudyWinner study={study} />
            </p>
          </StatTile>
          <StatTile label="Result">
            <Figure value={study.result?.display ?? "—"} />
            <p className="k-fg3 mt-0.5 truncate text-[12px]" title={study.result?.unit}>
              {study.result?.unit ?? ""}
            </p>
          </StatTile>
          <StatTile label="Sample">
            <p className="k-fg2 text-[13px] leading-5 tabular-nums">{study.result?.sample ?? <span className="k-fg4">{"—"}</span>}</p>
          </StatTile>
          <StatTile label="Period" note={emailLeg ? "all orgs" : undefined}>
            <p className="text-[18px] font-medium leading-7">
              {monthText(RESEARCH.window.from).slice(0, 3)} to {monthText(RESEARCH.window.to)}
            </p>
          </StatTile>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <div>
              <SectionTitle>What we found</SectionTitle>
              <div className="k-card p-4">
                <p className="text-[14px] font-medium leading-6">{study.headline}</p>
                {study.verdict && study.status === "measured" && (
                  <p className="mt-2 text-[13px] leading-5">
                    <span className="font-medium">{STATE_LOOK[state].label}.</span> <span className="k-fg2">{study.verdict.reason}</span>
                  </p>
                )}
                <ul className="k-fg2 mt-2 space-y-1 text-[13px] leading-5">
                  {study.conclusion.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--fg-3)]" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {study.delay && study.status === "measured" && (
              <div>
                <SectionTitle>How long people took</SectionTitle>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {study.delay.stats.map((s) => (
                    <StatTile key={s.key} label={s.label}>
                      <Figure value={s.display} />
                    </StatTile>
                  ))}
                </div>
              </div>
            )}
            {study.charts.map((c) =>
              c.kind === "months" ? (
                <MonthsRow key={c.title} chart={c} color={look.color} />
              ) : c.curve ? (
                <DelayRow key={c.title} chart={c} color={look.color} />
              ) : study.delay ? (
                <DelayHistogram key={c.title} chart={c} color={look.color} />
              ) : (
                <div key={c.title}>
                  <SectionTitle>{c.title}</SectionTitle>
                  <div className="k-card overflow-hidden">
                    <BarsChart chart={c} color={look.color} winner={study.winnerLabel ? null : study.winner} hrefFor={(p) => pointHref(base, study, p)} nameFor={workflowName} />
                  </div>
                  <ChartNote note={c.note} />
                </div>
              ),
            )}
          </div>

          <aside className="k-card h-fit p-4">
            <p className="k-label">Details</p>
            <dl className="mt-3 space-y-2.5 text-[13px]">
              <Row
                k={study.pipe ? "Pipe" : outcomeMeta?.step ? "Outcome" : "Section"}
                v={
                  <span className="inline-flex items-center gap-1.5">
                    <SectionMark section={section} />
                    <SectionName section={section} />
                  </span>
                }
              />
              {study.pipe && <Row k="Outcome" v={outcomeText} />}
              {outcomeMeta?.step && <Row k={(outcomeMeta.pipes?.length ?? 0) === 1 ? "Pipe" : "Pipes"} v={<OutcomePipes outcome={outcomeMeta.id} prefix={false} />} />}
              <Row k="Question" v={`${topicLabel(study.topic)}, ${GOAL_LABEL[study.goal]}`} />
              {emailLeg && RESEARCH.volume && <Row k="Clients" v={`${RESEARCH.volume.orgs}, all orgs`} />}
              {emailLeg && RESEARCH.volume && <Row k="Emails" v={RESEARCH.volume.emails.toLocaleString("en-US")} />}
              <Row
                k="Read on"
                v={staleText(RESEARCH.freshness) ? <ResearchStaleNote freshness={RESEARCH.freshness} /> : liveText(RESEARCH)}
              />
            </dl>
            <p className="k-label mt-5">How we measured</p>
            {/* the row's population, unless the study states its own (an outcome cut names who it counts) */}
            {outcomeMeta && !study.conclusion[0]?.startsWith("Population:") && <p className="k-fg2 mt-2 text-[12px] leading-5">{outcomeMeta.population}</p>}
            {outcomeMeta?.step && study.goal === "rate" && (
              <p className="k-fg2 mt-2 text-[12px] leading-5">
                A conversion rate counts leads, lead-service&apos;s own lead: a person at a company, counted once however many emails it got. Never emails.
              </p>
            )}
            <p className="k-fg2 mt-2 text-[12px] leading-5">
              ROI is read as the cost per outcome: every pipe buys one outcome, so the cheaper outcome is the better return. A website visit is priced on the
              emails that carried a link.
            </p>
            {emailLeg && (
              <p className="k-fg2 mt-2 text-[12px] leading-5">
                Every figure is on the rule every price in the dashboard is on: only people we started writing to at least {RESEARCH.maturation.legs.reply.durationDays}{" "}
                days before the read count (before {dayText(RESEARCH.maturation.legs.reply.cutoff)}), with every positive reply and website visit they sent since. A
                bar resting on fewer than {RESEARCH.maturation.legs.reply.outcomesRequired} positive{" "}
                {RESEARCH.maturation.legs.reply.outcomesRequired === 1 ? "reply" : "replies"} ({RESEARCH.maturation.legs.visit.outcomesRequired} website visits) is
                ranked where its value puts it and marked Learning.
                {RESEARCH.maturation.excludedEmails != null &&
                  ` ${RESEARCH.maturation.excludedEmails.toLocaleString("en-US")} emails from more recent runs wait until they are old enough to count.`}
              </p>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}

// ─── The page ──────────────────────────────────────────────────────────────

/** The nearest scrolling ancestor, so a switch of question starts at the top like a new page. */
function scrollToTop(el: HTMLElement | null) {
  for (let n = el?.parentElement; n; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY;
    if ((o === "auto" || o === "scroll") && n.scrollHeight > n.clientHeight) {
      n.scrollTop = 0;
      return;
    }
  }
  window.scrollTo(0, 0);
}

/**
 * Research, the hub and every question, as ONE client view. The route is dynamic (Clerk), so a
 * Next navigation between two questions is a full server round-trip for data that already sits in
 * the query cache. Links under `/research` therefore move with the history API instead: the URL, Back
 * and a new tab behave as links, and the switch is instant.
 */
export function V2Research() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const base = v2Href(orgId, brandId, "research");
  const rest = pathname.startsWith(base) ? pathname.slice(base.length).replace(/^\/+|\/+$/g, "") : "";
  const view = parseResearchPath(rest);
  // An old link (a retired section name) opens the same page under its pipe.
  const redirectTo = view.view === "redirect" ? `${base}/${view.to}` : null;
  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);
  const nav = (href: string) => {
    if (href !== pathname) window.history.pushState(null, "", href);
    scrollToTop(rootRef.current);
  };
  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as HTMLElement).closest("a");
    const href = a?.getAttribute("href");
    if (!a || !href || a.target === "_blank" || (href !== base && !href.startsWith(`${base}/`))) return;
    e.preventDefault();
    e.stopPropagation();
    if (href !== pathname) window.history.pushState(null, "", href);
    scrollToTop(e.currentTarget);
  };
  const { basis } = useCostBasis();
  const crumbs = [{ label: "Research" }];
  return (
    <ResearchSourceProvider
      pending={
        <>
          <TopBar crumbs={crumbs} actions={<ResearchSwitches />} />
          <div className="mx-auto max-w-[1280px] px-4 pt-6 md:px-6">
            <p className="k-fg3 text-[13px]">Loading the research…</p>
          </div>
        </>
      }
      failed={
        <>
          <TopBar crumbs={crumbs} actions={<ResearchSwitches />} />
          <div className="mx-auto max-w-[1280px] px-4 pt-6 md:px-6">
            <EmptyNote>We could not load the research just now.</EmptyNote>
          </div>
        </>
      }
    >
    {/* Keyed on the basis: a view that loaded one basis's catalogue must not keep it on the other. */}
    <div key={basis} ref={rootRef} onClickCapture={onClickCapture}>
      <UnpricedNote />
      {view.view === "redirect" ? null : view.view === "hub" ? (
        <V2ResearchHub base={base} />
      ) : view.view === "study" ? (
        <V2ResearchStudy base={base} studyId={view.id} />
      ) : view.view === "missing" ? (
        <V2ResearchStudy base={base} studyId={rest} />
      ) : (
        <ServedPipe base={base} pipe={view.pipe} rest={rest}>
          {view.view === "performance" ? (
            <V2ResearchPerformanceView base={base} pipe={view.pipe} />
          ) : (
            <V2ResearchCatalogView
              base={base}
              pipe={view.pipe}
              kind={view.kind}
              itemKey={view.view === "item" || view.view === "version" ? view.key : null}
              versionKey={view.view === "version" ? view.version : null}
              nav={nav}
            />
          )}
        </ServedPipe>
      )}
    </div>
    </ResearchSourceProvider>
  );
}

/** A pipe's pages render only for a pipe the live file serves; any other id reads Not found. */
function ServedPipe({ base, pipe, rest, children }: { base: string; pipe: string; rest: string; children: React.ReactNode }) {
  const { file } = useResearch();
  return researchPipeEntry(file, pipe) ? <>{children}</> : <V2ResearchStudy base={base} studyId={rest} />;
}

/**
 * On the actual basis, a workflow version whose billed spend no vendor cost prices is left out
 * whole (priced on its known part it would read cheaper than it was); the page says how much.
 */
function UnpricedNote() {
  const { basis, file } = useResearch();
  if (basis !== "actual") return null;
  const usd = file.unpricedBilledUsd ?? 0;
  return (
    <div className="mx-auto max-w-[1280px] px-4 pt-4 md:px-6">
      <p className="k-card k-fg2 px-4 py-2.5 text-[12px]">
        Actual cost: what the vendors charged us, before our margin.
        {usd > 0 &&
          ` ${formatUsdAdaptive(usd)} of billed spend has no vendor cost on record yet (mostly Instantly sending before Aug 23), so the ${file.unpricedEmails != null ? `${file.unpricedEmails.toLocaleString("en-US")} ` : ""}emails it paid for are left out of these figures rather than priced at a partial cost.`}
      </p>
    </div>
  );
}
