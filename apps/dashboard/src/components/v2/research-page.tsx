"use client";

import Link from "next/link";
import { useRef } from "react";
import { useParams, usePathname } from "next/navigation";
import { CrewMark } from "@/components/v2/crew-mark";
import { EmptyNote, Figure, SectionTitle, StatTile, TopBar } from "@/components/v2/ui";
import {
  Arrow,
  ChartNote,
  MonthsRow,
  Row,
  TOPIC_LOOK,
  TopicMark,
  crewIdentity,
  dayText,
  monthText,
} from "@/components/v2/research-bits";
import { V2ResearchCatalogView, CrewCatalogLinks } from "@/components/v2/research-catalog";
import { CostBasisSwitch } from "@/components/v2/cost-basis-switch";
import { ResearchSourceProvider, useResearch } from "@/lib/research/research-source";
import { useCostBasis } from "@/lib/v2/use-cost-basis";
import { formatUsdAdaptive } from "@/lib/format-number";
import { v2Href } from "@/lib/v2/routes";
import {
  GOAL_LABEL,
  CREW_ORDER,
  TOPIC_LABEL,
  parseResearchPath,
  pointHref,
  studiesFor,
  studyById,
  studySpark,
  studyState,
  type ResearchChart,
  type ResearchPoint,
  type ResearchStudy,
  type ResearchTopic,
  type StudyState,
} from "@/lib/research/research";

/**
 * Research: what we measured across every org's campaigns, one card per question, grouped by
 * crew. Staff only: page behind StaffOnly, data behind the staff route (research-source.tsx).
 *
 * Built on Keel's own anatomy (see the dashboard-v2-ux skill): the hub is the Crew card grid
 * (mark + question + state, an inset block of stat cells with a mini chart in the mark's
 * colour, a footer line), a question is a v2 record (40px mark, 24px h1, stat tiles, a main
 * column and a Details aside). Every figure, label and sentence arrives written in
 * `research.json`; this file lays them out and picks one thing only: each topic's mark.
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
};

const STATE_LOOK: Record<StudyState, { label: string; dot: string }> = {
  conclusion: { label: "Conclusion", dot: "bg-[var(--data-teal)]" },
  signal: { label: "Signal", dot: "bg-[var(--data-amber)]" },
  noise: { label: "Noise", dot: "bg-[var(--fg-4)]" },
  "no-data": { label: "Not enough data", dot: "border-[1.5px] border-[var(--fg-3)]" },
};

/** The first bar is a winner only when the verdict is a conclusion; otherwise it merely leads. */
function winnerLabel(study: ResearchStudy, state: StudyState): string {
  const label = WINNER_LABEL[study.topic];
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
  const look = TOPIC_LOOK[study.topic];
  const state = studyState(study);
  const spark = study.status === "measured" ? studySpark(study) : null;
  return (
    <Link href={href} className="k-card flex min-w-0 flex-col p-4">
      <div className="flex items-start gap-3">
        <TopicMark topic={study.topic} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="k-fg3 truncate text-[12px]">
              <span style={{ color: look.color }}>{TOPIC_LABEL[study.topic]}</span>
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
          <p className="mt-1.5 truncate text-[14px] font-medium leading-6" title={study.winner ?? undefined}>
            {study.winner ?? <span className="k-fg4">{"—"}</span>}
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

function V2ResearchHub({ base }: { base: string }) {
  const RESEARCH = useResearch().file;
  const v = RESEARCH.volume;
  const called = RESEARCH.studies.filter((st) => studyState(st) === "conclusion").length;
  const signals = RESEARCH.studies.filter((st) => studyState(st) === "signal").length;
  const maxMonth = Math.max(...v.byMonth.map((m) => m.emails), 1);
  return (
    <>
      <TopBar crumbs={[{ label: "Research" }]} actions={<CostBasisSwitch />} />
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
          <span className="k-fg2 inline-flex items-center gap-2 text-[13px]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--data-teal)]" />
            Read from production on {dayText(RESEARCH.readOn)}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Emails studied" note={`People first written to from ${v.byMonth[0]?.label ?? ""} to ${dayText(RESEARCH.maturation.cutoff)}, old enough to count`}>
            <div className="flex items-end justify-between gap-2">
              <Figure value={v.emails.toLocaleString("en-US")} />
              <div className="flex h-6 items-end gap-[3px]" aria-hidden="true">
                {v.byMonth.map((m) => (
                  <span
                    key={m.label}
                    className="w-[6px] rounded-[2px] bg-[var(--accent)]"
                    style={{ height: `${Math.max(3, (m.emails / maxMonth) * 24)}px`, opacity: 0.55 }}
                  />
                ))}
              </div>
            </div>
          </StatTile>
          <StatTile label="Clients" note="all orgs, pooled">
            <Figure value={v.orgs.toLocaleString("en-US")} />
          </StatTile>
          <StatTile label="Workflows compared">
            <Figure value={v.workflows.toLocaleString("en-US")} />
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

        {CREW_ORDER.map((crew) => {
          const id = crewIdentity(crew);
          const meta = RESEARCH.crews.find((c) => c.id === crew);
          const studies = studiesFor(crew, RESEARCH);
          if (!studies.length) return null;
          return (
            <section key={crew} className="mt-8">
              <SectionTitle count={studies.length} right={meta ? <span className="hidden sm:inline">{meta.description}</span> : null}>
                <span className="inline-flex items-center gap-2">
                  <CrewMark color={id.color} glyph={id.glyph} size={18} />
                  {id.name}
                  {meta && <span className="k-chip font-normal">{meta.outcome}</span>}
                </span>
              </SectionTitle>
              <CrewCatalogLinks base={base} crew={crew} />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {studies.map((st) => (
                  <StudyCard key={st.id} study={st} href={`${base}/${encodeURIComponent(st.id)}`} />
                ))}
              </div>
            </section>
          );
        })}
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
}: {
  chart: ResearchChart;
  color: string;
  winner: string | null;
  /** A workflow's or template's bar opens that one's own page. */
  hrefFor?: (p: ResearchPoint) => string | null;
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
        const inner = (
          <>
            <div className="flex items-baseline gap-2 text-[13px]">
              <span className={`min-w-0 flex-1 truncate ${top ? "font-medium" : ""}`} title={p.label}>
                {p.label}
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
  if (!study) {
    return (
      <>
        <TopBar crumbs={[{ label: "Research", href: base }, { label: "Not found" }]} actions={<CostBasisSwitch />} />
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
  const id = crewIdentity(study.crew);
  const meta = RESEARCH.crews.find((c) => c.id === study.crew);
  const look = TOPIC_LOOK[study.topic];
  const state = studyState(study);
  return (
    <>
      <TopBar crumbs={[{ label: "Research", href: base }, { label: id.name }, { label: TOPIC_LABEL[study.topic] }]} actions={<CostBasisSwitch />} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <TopicMark topic={study.topic} size={40} />
          <div className="min-w-0">
            <h1 className="text-[24px] font-medium leading-[30px] tracking-[-0.02em]">{study.question}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <StudyStateDot state={state} />
              <span className="k-chip inline-flex items-center gap-1.5">
                <CrewMark color={id.color} glyph={id.glyph} size={12} />
                {id.name}
              </span>
              <span className="k-chip">{GOAL_LABEL[study.goal]}</span>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label={winnerLabel(study, state)}>
            <p className="truncate text-[18px] font-medium leading-7" title={study.winner ?? undefined}>
              {study.winner ?? <span className="k-fg4">{"—"}</span>}
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
          <StatTile label="Period" note="all orgs">
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
            {study.charts.map((c) =>
              c.kind === "months" ? (
                <MonthsRow key={c.title} chart={c} color={look.color} />
              ) : (
                <div key={c.title}>
                  <SectionTitle>{c.title}</SectionTitle>
                  <div className="k-card overflow-hidden">
                    <BarsChart chart={c} color={look.color} winner={study.winner} hrefFor={(p) => pointHref(base, study, p)} />
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
                k="Crew"
                v={
                  <span className="inline-flex items-center gap-1.5">
                    <CrewMark color={id.color} glyph={id.glyph} />
                    {id.name}
                  </span>
                }
              />
              <Row k="Outcome" v={meta?.outcome ?? null} />
              <Row k="Question" v={`${TOPIC_LABEL[study.topic]}, ${GOAL_LABEL[study.goal]}`} />
              <Row k="Clients" v={`${RESEARCH.volume.orgs}, all orgs`} />
              <Row k="Emails" v={RESEARCH.volume.emails.toLocaleString("en-US")} />
              <Row k="Read on" v={dayText(RESEARCH.readOn)} />
            </dl>
            <p className="k-label mt-5">How we measured</p>
            <p className="k-fg2 mt-2 text-[12px] leading-5">
              ROI is read as the cost per outcome: every crew buys one outcome, so the cheaper outcome is the better return. A website visit is priced on the
              emails that carried a link.
            </p>
            <p className="k-fg2 mt-2 text-[12px] leading-5">
              Every figure is on the rule every price in the dashboard is on: only people we started writing to at least {RESEARCH.maturation.legs.reply.durationDays}{" "}
              days before the read count (before {dayText(RESEARCH.maturation.legs.reply.cutoff)}), with every positive reply and website visit they sent since. A
              bar resting on fewer than {RESEARCH.maturation.legs.reply.outcomesRequired} positive{" "}
              {RESEARCH.maturation.legs.reply.outcomesRequired === 1 ? "reply" : "replies"} ({RESEARCH.maturation.legs.visit.outcomesRequired} website visits) is
              ranked where its value puts it and marked Learning. {RESEARCH.maturation.excludedEmails.toLocaleString("en-US")} emails from more recent runs wait until
              they are old enough to count.
            </p>
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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const base = v2Href(orgId, brandId, "research");
  const rest = pathname.startsWith(base) ? pathname.slice(base.length).replace(/^\/+|\/+$/g, "") : "";
  const view = parseResearchPath(rest);
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
          <TopBar crumbs={crumbs} actions={<CostBasisSwitch />} />
          <div className="mx-auto max-w-[1280px] px-4 pt-6 md:px-6">
            <p className="k-fg3 text-[13px]">Loading the research…</p>
          </div>
        </>
      }
      failed={
        <>
          <TopBar crumbs={crumbs} actions={<CostBasisSwitch />} />
          <div className="mx-auto max-w-[1280px] px-4 pt-6 md:px-6">
            <EmptyNote>We could not load the research just now.</EmptyNote>
          </div>
        </>
      }
    >
    {/* Keyed on the basis: a view that loaded one basis's catalogue must not keep it on the other. */}
    <div key={basis} ref={rootRef} onClickCapture={onClickCapture}>
      <UnpricedNote />
      {view.view === "hub" ? (
        <V2ResearchHub base={base} />
      ) : view.view === "study" ? (
        <V2ResearchStudy base={base} studyId={view.id} />
      ) : view.view === "missing" ? (
        <V2ResearchStudy base={base} studyId={rest} />
      ) : (
        <V2ResearchCatalogView base={base} crew={view.crew} kind={view.kind} itemKey={view.view === "item" ? view.key : null} nav={nav} />
      )}
    </div>
    </ResearchSourceProvider>
  );
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
          ` ${formatUsdAdaptive(usd)} of billed spend has no vendor cost on record yet (mostly Instantly sending before Aug 23), so the ${(file.unpricedEmails ?? 0).toLocaleString("en-US")} emails it paid for are left out of these figures rather than priced at a partial cost.`}
      </p>
    </div>
  );
}
