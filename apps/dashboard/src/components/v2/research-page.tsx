"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BrainIcon } from "@phosphor-icons/react/dist/csr/Brain";
import { ChartLineDownIcon } from "@phosphor-icons/react/dist/csr/ChartLineDown";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";
import { EyeSlashIcon } from "@phosphor-icons/react/dist/csr/EyeSlash";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { isAdminEmail } from "@/lib/admin-allowlist";
import { CrewMark } from "@/components/v2/crew-mark";
import { EmptyNote, Figure, SectionTitle, Shimmer, StatTile, TopBar } from "@/components/v2/ui";
import { v2Href } from "@/lib/v2/routes";
import { crewFor } from "@/lib/v2/crews";
import {
  CREW_KEY,
  CREW_ORDER,
  GOAL_LABEL,
  RESEARCH,
  TOPIC_LABEL,
  studiesFor,
  studyById,
  studySpark,
  studyState,
  type ResearchChart,
  type ResearchCrew,
  type ResearchStudy,
  type ResearchTopic,
  type StudyState,
} from "@/lib/research/research";

/**
 * Research: what we measured across every org's campaigns, one card per question, grouped by
 * crew. Staff-only for now (the menu entry and both pages check the staff list); it states
 * fleet-wide results only, so it can open to customers as it stands.
 *
 * Built on Keel's own anatomy (see the dashboard-v2-ux skill): the hub is the Crew card grid
 * (mark + question + state, an inset block of stat cells with a mini chart in the mark's
 * colour, a footer line), a question is a v2 record (40px mark, 24px h1, stat tiles, a main
 * column and a Details aside). Every figure, label and sentence arrives written in
 * `research.json`; this file lays them out and picks one thing only: each topic's mark.
 */

const TOPIC_LOOK: Record<ResearchTopic, { color: string; Icon: typeof BrainIcon }> = {
  llm: { color: "var(--data-violet)", Icon: BrainIcon },
  cost: { color: "var(--data-teal)", Icon: ChartLineDownIcon },
  followups: { color: "var(--data-amber)", Icon: ArrowsClockwiseIcon },
  opens: { color: "var(--data-sky)", Icon: EyeSlashIcon },
  template: { color: "var(--data-rose)", Icon: FileTextIcon },
};

/** What the WINNER cell is called, per topic: the cost curve's cell names the cheapest LLM. */
const WINNER_LABEL: Record<ResearchTopic, string> = {
  llm: "Winner",
  cost: "Cheapest LLM",
  followups: "Best depth",
  opens: "Winner",
  template: "Winner",
};

const STATE_LOOK: Record<StudyState, { label: string; dot: string }> = {
  winner: { label: "Winner", dot: "bg-[var(--data-teal)]" },
  thin: { label: "Too early to call", dot: "bg-[var(--data-amber)]" },
  "no-data": { label: "Not enough data", dot: "border-[1.5px] border-[var(--fg-3)]" },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthText(ym: string): string {
  return `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
}
function dayText(ymd: string): string {
  return `${MONTHS[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(8, 10))}`;
}

function useStaffGate(): { ready: boolean; staff: boolean } {
  const { user, isLoaded } = useUser();
  return { ready: isLoaded, staff: isAdminEmail(user?.primaryEmailAddress?.emailAddress) };
}

function crewIdentity(crew: ResearchCrew) {
  const k = CREW_KEY[crew];
  return crewFor(k.channel, k.step, crew);
}

/** A topic's mark: a soft tile in its colour, drawn like a crew's mark. */
function TopicMark({ topic, size = 32 }: { topic: ResearchTopic; size?: number }) {
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

function Arrow() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" className="k-fg4 shrink-0" aria-hidden="true">
      <path d="M2.5 6h7M6.5 3l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NotAvailable() {
  return (
    <>
      <TopBar crumbs={[{ label: "Research" }]} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <div className="k-card">
          <EmptyNote>This page is not available on your account yet.</EmptyNote>
        </div>
      </div>
    </>
  );
}

function Loading() {
  return (
    <>
      <TopBar crumbs={[{ label: "Research" }]} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <Shimmer className="h-9 w-80" />
        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Shimmer key={i} className="h-[200px] rounded-[12px]" />
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Small charts (the card's mini viz, in the topic's colour) ─────────────

function MiniBars({ chart, color, winner }: { chart: ResearchChart; color: string; winner: string | null }) {
  const pts = chart.points.slice(0, 7);
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

function MiniLine({ chart, color }: { chart: ResearchChart; color: string }) {
  const v = chart.points.map((p) => p.value);
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
    <Link href={href} className="k-card flex flex-col p-4">
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
          <p className="k-label">{WINNER_LABEL[study.topic]}</p>
          <p className="mt-1.5 truncate text-[14px] font-medium leading-6" title={study.winner ?? undefined}>
            {study.winner ?? <span className="k-fg4">{"—"}</span>}
          </p>
          <p className="k-fg3 mt-0.5 truncate text-[11px]">
            {state === "winner" ? "clears our bar" : state === "thin" ? "on thin counts" : "nothing to compare"}
          </p>
        </div>
        <div className="min-w-0 p-3">
          <p className="k-label">Result</p>
          <div className="mt-1.5 flex items-end justify-between gap-2">
            <p className="text-[20px] font-medium leading-6 tabular-nums">{study.result?.display ?? <span className="k-fg4">{"—"}</span>}</p>
            {spark && (spark.kind === "line" ? <MiniLine chart={spark} color={look.color} /> : <MiniBars chart={spark} color={look.color} winner={study.winner} />)}
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
    </Link>
  );
}

export function V2ResearchPage() {
  const { orgId, brandId } = useParams<{ orgId: string; brandId: string }>();
  const gate = useStaffGate();
  if (!gate.ready) return <Loading />;
  if (!gate.staff) return <NotAvailable />;
  const base = v2Href(orgId, brandId, "research");
  const v = RESEARCH.volume;
  const called = RESEARCH.studies.filter((st) => studyState(st) === "winner").length;
  const maxMonth = Math.max(...v.byMonth.map((m) => m.emails), 1);
  return (
    <>
      <TopBar crumbs={[{ label: "Research" }]} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">
              {RESEARCH.studies.length} questions, {called} with a clear winner
            </h1>
            <p className="k-fg2 mt-1 text-[14px]">
              What works in cold email, measured on every campaign we ran for every client, {monthText(RESEARCH.window.from)} to{" "}
              {monthText(RESEARCH.window.to)}.
            </p>
          </div>
          <span className="k-fg2 inline-flex items-center gap-2 text-[13px]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--data-teal)]" />
            Read from production on {dayText(RESEARCH.readOn)}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Emails studied" note={`${v.byMonth[0]?.label ?? ""} to ${v.byMonth[v.byMonth.length - 1]?.label ?? ""}`}>
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
          <StatTile label="Clear winners" note={`of ${RESEARCH.studies.length}`}>
            <div className="flex items-end justify-between gap-2">
              <Figure value={called} />
              <div className="flex gap-[3px]" aria-hidden="true">
                {RESEARCH.studies.map((st) => (
                  <span
                    key={st.id}
                    className="h-4 w-[4px] rounded-full"
                    style={{ background: studyState(st) === "winner" ? "var(--data-teal)" : "var(--data-track)" }}
                  />
                ))}
              </div>
            </div>
          </StatTile>
        </div>

        {CREW_ORDER.map((crew) => {
          const id = crewIdentity(crew);
          const meta = RESEARCH.crews.find((c) => c.id === crew);
          const studies = studiesFor(crew);
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
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
function BarsChart({ chart, color, winner }: { chart: ResearchChart; color: string; winner: string | null }) {
  if (!chart.points.length) return <EmptyNote>Nothing to draw yet.</EmptyNote>;
  const max = Math.max(...chart.points.map((p) => p.value), 0) || 1;
  return (
    <ul className="divide-y divide-[var(--line-subtle)]">
      {chart.points.map((p) => {
        const top = winner !== null && p.label === winner;
        return (
          <li key={p.label} className="px-4 py-2.5">
            <div className="flex items-baseline gap-2 text-[13px]">
              <span className={`min-w-0 flex-1 truncate ${top ? "font-medium" : ""}`} title={p.label}>
                {p.label}
              </span>
              {top && <span className="k-chip shrink-0">Winner</span>}
              {p.thin && <span className="k-fg3 shrink-0 text-[12px]">Thin</span>}
              <span className={`w-16 shrink-0 text-right tabular-nums ${top ? "font-medium" : ""}`}>{p.display}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--data-track)]">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(2, (p.value / max) * 100)}%`, background: color, opacity: top ? 1 : p.thin ? 0.3 : 0.55 }}
              />
            </div>
            <p className="k-fg3 mt-1 text-[12px] tabular-nums">{p.note}</p>
          </li>
        );
      })}
    </ul>
  );
}

/** A line over the months, styled like v2's other charts: fg-3 ticks, no grid, a k-popover tooltip. */
function LineCard({ chart, color }: { chart: ResearchChart; color: string }) {
  if (!chart.points.length) return <EmptyNote>Nothing to draw yet.</EmptyNote>;
  const byLabel = new Map(chart.points.map((p) => [p.label, p]));
  const money = chart.title.includes("USD") || chart.title.startsWith("Cost") || chart.title.includes("cost per");
  return (
    <div className="h-[180px] px-2 pb-2 pt-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chart.points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--fg-3)" }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--fg-3)" }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickCount={3}
            tickFormatter={(n: number) => (money ? `$${Math.round(n)}` : String(Math.round(n * 10) / 10))}
          />
          <Tooltip
            cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }}
            content={({ active, label }) => {
              const p = active ? byLabel.get(String(label)) : undefined;
              return p ? (
                <div className="k-popover px-2.5 py-1.5 text-[12px]">
                  <p className="k-fg3 k-mono">{p.label}</p>
                  <p className="font-medium tabular-nums">{p.display}</p>
                  <p className="k-fg3 tabular-nums">{p.note}</p>
                </div>
              ) : null;
            }}
          />
          <Line type="linear" dataKey="value" stroke={color} strokeWidth={1.5} dot={{ r: 2.5, fill: color, strokeWidth: 0 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="k-fg3 shrink-0">{k}</dt>
      <dd className="min-w-0 truncate text-right">{v ?? <span className="k-fg4">{"—"}</span>}</dd>
    </div>
  );
}

export function V2ResearchStudyPage() {
  const { orgId, brandId, studyId } = useParams<{ orgId: string; brandId: string; studyId: string }>();
  const gate = useStaffGate();
  if (!gate.ready) return <Loading />;
  if (!gate.staff) return <NotAvailable />;
  const base = v2Href(orgId, brandId, "research");
  const study = studyById(decodeURIComponent(studyId));
  if (!study) {
    return (
      <>
        <TopBar crumbs={[{ label: "Research", href: base }, { label: "Not found" }]} />
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
  const floors = RESEARCH.floors;
  return (
    <>
      <TopBar crumbs={[{ label: "Research", href: base }, { label: id.name }, { label: TOPIC_LABEL[study.topic] }]} />
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
          <StatTile label={WINNER_LABEL[study.topic]}>
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
            {study.charts.map((c) => (
              <div key={c.title}>
                <SectionTitle>{c.title}</SectionTitle>
                <div className="k-card overflow-hidden">
                  {c.kind === "bars" ? <BarsChart chart={c} color={look.color} winner={study.winner} /> : <LineCard chart={c} color={look.color} />}
                </div>
              </div>
            ))}
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
              emails that carried a link. Only a bar past {floors.crown.minEmails.toLocaleString("en-US")} emails and {floors.crown.minReplies} positive
              replies (or {floors.crown.minClicks} visits) can win; a smaller one is drawn and marked thin.
            </p>
          </aside>
        </div>
      </div>
    </>
  );
}
