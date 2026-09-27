"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { BrainIcon } from "@phosphor-icons/react/dist/csr/Brain";
import { ChartLineDownIcon } from "@phosphor-icons/react/dist/csr/ChartLineDown";
import { ArrowsClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowsClockwise";
import { EyeSlashIcon } from "@phosphor-icons/react/dist/csr/EyeSlash";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { isAdminEmail } from "@/lib/admin-allowlist";
import { CrewMark } from "@/components/v2/crew-mark";
import { V2Page } from "@/components/v2/setup-pages";
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
  type ResearchChart,
  type ResearchCrew,
  type ResearchStudy,
  type ResearchTopic,
} from "@/lib/research/research";

/**
 * Research: what we measured across every org's campaigns, one card per question, grouped by
 * crew. Staff-only for now (the menu entry and this page both check the staff list), and
 * written so it can open to customers as it stands: it states fleet-wide results only.
 *
 * Every figure, label and sentence comes written in `research.json`; this file only lays
 * them out. The one thing it decides is the picture: an icon and a colour per topic.
 */

const TOPIC_LOOK: Record<ResearchTopic, { color: string; Icon: typeof BrainIcon }> = {
  llm: { color: "var(--data-violet)", Icon: BrainIcon },
  cost: { color: "var(--data-teal)", Icon: ChartLineDownIcon },
  followups: { color: "var(--data-amber)", Icon: ArrowsClockwiseIcon },
  opens: { color: "var(--data-sky)", Icon: EyeSlashIcon },
  template: { color: "var(--data-rose)", Icon: FileTextIcon },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthText(ym: string): string {
  return `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
}

function useStaffGate(): { ready: boolean; staff: boolean } {
  const { user, isLoaded } = useUser();
  return { ready: isLoaded, staff: isAdminEmail(user?.primaryEmailAddress?.emailAddress) };
}

function crewIdentity(crew: ResearchCrew) {
  const k = CREW_KEY[crew];
  return crewFor(k.channel, k.step, crew);
}

function TopicTile({ topic, size = 40 }: { topic: ResearchTopic; size?: number }) {
  const { color, Icon } = TOPIC_LOOK[topic];
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[10px]"
      style={{
        width: size,
        height: size,
        color,
        background: `color-mix(in oklab, ${color} 14%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 24%, transparent)`,
      }}
      aria-hidden="true"
    >
      <Icon size={Math.round(size * 0.55)} weight="duotone" />
    </span>
  );
}

function NotAvailable() {
  return (
    <V2Page crumbs={[{ label: "Research" }]} title="Research" width="max-w-[760px]">
      <div className="k-card">
        <EmptyNote>This page is not available on your account yet.</EmptyNote>
      </div>
    </V2Page>
  );
}

function Loading() {
  return (
    <>
      <TopBar crumbs={[{ label: "Research" }]} />
      <div className="mx-auto max-w-[1280px] space-y-3 px-4 pb-16 pt-6 md:px-6">
        <Shimmer className="h-9 w-80" />
        <Shimmer className="h-24" />
        <Shimmer className="h-24" />
      </div>
    </>
  );
}

// ─── Charts ────────────────────────────────────────────────────────────────

/** Horizontal bars, label above each bar so a long template name never crowds it. */
export function ResearchBars({ chart, color, winner }: { chart: ResearchChart; color: string; winner: string | null }) {
  const max = Math.max(...chart.points.map((p) => p.value), 0);
  if (!chart.points.length) return <p className="k-fg3 text-[13px]">Nothing to draw yet.</p>;
  return (
    <ul className="space-y-2.5">
      {chart.points.map((p) => {
        const isWinner = winner !== null && p.label === winner;
        const width = max > 0 ? Math.max((p.value / max) * 100, 1.5) : 1.5;
        return (
          <li key={p.label}>
            <div className="mb-1 flex items-baseline gap-2 text-[13px]">
              <span className={`min-w-0 flex-1 truncate ${isWinner ? "font-medium" : "k-fg2"}`} title={p.label}>
                {p.label}
                {isWinner && (
                  <span className="ml-1.5 rounded-[6px] px-1.5 py-0.5 text-[11px] font-medium" style={{ color, background: `color-mix(in oklab, ${color} 12%, transparent)` }}>
                    Winner
                  </span>
                )}
                {p.thin && <span className="k-fg4 ml-1.5 text-[11px]">(thin)</span>}
              </span>
              <span className={`shrink-0 tabular-nums ${isWinner ? "font-medium" : ""}`}>{p.display}</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-[var(--data-track)]">
              <div
                className="h-2.5 rounded-full"
                style={{ width: `${width}%`, background: color, opacity: p.thin ? 0.35 : isWinner ? 1 : 0.6 }}
              />
            </div>
            <p className="k-fg4 mt-0.5 text-[11px] tabular-nums">{p.note}</p>
          </li>
        );
      })}
    </ul>
  );
}

/** A line over the months, every point labelled with its value. */
export function ResearchLine({ chart, color, height = 180, compact = false }: { chart: ResearchChart; color: string; height?: number; compact?: boolean }) {
  const pts = chart.points;
  if (!pts.length) return <p className="k-fg3 text-[13px]">Nothing to draw yet.</p>;
  const W = 600;
  const H = height;
  const padX = compact ? 4 : 28;
  const padTop = compact ? 4 : 26;
  const padBottom = compact ? 4 : 26;
  const values = pts.map((p) => p.value);
  const lo = Math.min(...values, 0);
  const hi = Math.max(...values) || 1;
  const x = (i: number) => (pts.length === 1 ? W / 2 : padX + (i / (pts.length - 1)) * (W - padX * 2));
  const y = (v: number) => padTop + (1 - (v - lo) / (hi - lo || 1)) * (H - padTop - padBottom);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${d} L${x(pts.length - 1).toFixed(1)},${H - padBottom} L${x(0).toFixed(1)},${H - padBottom} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={compact ? height : undefined} preserveAspectRatio={compact ? "none" : undefined} role="img" aria-label={chart.title}>
      <path d={area} fill={color} opacity={0.1} />
      <path d={d} fill="none" stroke={color} strokeWidth={compact ? 3 : 2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {!compact &&
        pts.map((p, i) => (
          <g key={p.label}>
            <circle cx={x(i)} cy={y(p.value)} r={4} fill={p.thin ? "var(--bg-raised)" : color} stroke={color} strokeWidth={2} />
            <text x={x(i)} y={y(p.value) - 10} textAnchor="middle" fontSize="12" fill="var(--fg-1)" className="tabular-nums">
              {p.display}
            </text>
            <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--fg-3)">
              {p.label}
            </text>
          </g>
        ))}
    </svg>
  );
}

// ─── Index ─────────────────────────────────────────────────────────────────

function StudyCard({ study, href }: { study: ResearchStudy; href: string }) {
  const look = TOPIC_LOOK[study.topic];
  const spark = study.status === "measured" ? studySpark(study) : null;
  return (
    <Link href={href} className="k-card group flex flex-col gap-3 p-4 transition-colors hover:bg-[var(--bg-hover)]">
      <div className="flex items-start gap-3">
        <TopicTile topic={study.topic} />
        <div className="min-w-0 flex-1">
          <div className="k-fg3 mb-0.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide">
            <span style={{ color: look.color }}>{TOPIC_LABEL[study.topic]}</span>
            <span aria-hidden="true">·</span>
            <span>{GOAL_LABEL[study.goal]}</span>
          </div>
          <p className="text-[14px] font-medium leading-5">{study.question}</p>
        </div>
      </div>
      <p className={`text-[13px] leading-5 ${study.status === "measured" ? "" : "k-fg3"}`}>{study.headline}</p>
      {spark && spark.kind === "line" && spark.points.length > 1 && (
        <div className="mt-auto h-10">
          <ResearchLine chart={spark} color={look.color} height={40} compact />
        </div>
      )}
      {spark && spark.kind === "bars" && (
        <div className="mt-auto flex h-10 items-end gap-1">
          {spark.points.slice(0, 8).map((p) => {
            const max = Math.max(...spark.points.map((q) => q.value), 0) || 1;
            return (
              <span
                key={p.label}
                className="flex-1 rounded-t-[3px]"
                style={{ height: `${Math.max((p.value / max) * 100, 6)}%`, background: look.color, opacity: p.label === study.winner ? 1 : 0.35 }}
              />
            );
          })}
        </div>
      )}
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
  const called = RESEARCH.studies.filter((st) => st.status === "measured" && st.crowned).length;
  return (
    <>
      <TopBar crumbs={[{ label: "Research" }]} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <div className="mb-6 min-w-0">
          <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">
            {RESEARCH.studies.length} questions, {called} with a clear winner
          </h1>
          <p className="k-fg2 mt-1 text-[14px]">
            What works in cold email, measured on every campaign we ran for every client, {monthText(RESEARCH.window.from)} to {monthText(RESEARCH.window.to)}.
          </p>
        </div>
        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile label="Emails studied">
            <Figure value={v.emails.toLocaleString("en-US")} />
          </StatTile>
          <StatTile label="Clients">
            <Figure value={v.orgs.toLocaleString("en-US")} sub="every org, pooled" />
          </StatTile>
          <StatTile label="Workflows compared">
            <Figure value={v.workflows.toLocaleString("en-US")} />
          </StatTile>
        </div>
        {CREW_ORDER.map((crew) => {
          const id = crewIdentity(crew);
          const meta = RESEARCH.crews.find((c) => c.id === crew);
          const studies = studiesFor(crew);
          if (!studies.length) return null;
          return (
            <section key={crew} className="mb-10">
              <SectionTitle
                count={studies.length}
                right={meta ? <span className="hidden sm:inline">{meta.description}</span> : null}
              >
                <span className="inline-flex items-center gap-2">
                  <CrewMark color={id.color} glyph={id.glyph} size={20} />
                  {id.name}
                  {meta && <span className="k-chip font-normal">{meta.outcome}</span>}
                </span>
              </SectionTitle>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

// ─── One study ─────────────────────────────────────────────────────────────

export function V2ResearchStudyPage() {
  const { orgId, brandId, studyId } = useParams<{ orgId: string; brandId: string; studyId: string }>();
  const gate = useStaffGate();
  if (!gate.ready) return <Loading />;
  if (!gate.staff) return <NotAvailable />;
  const base = v2Href(orgId, brandId, "research");
  const study = studyById(decodeURIComponent(studyId));
  if (!study) {
    return (
      <V2Page crumbs={[{ label: "Research", href: base }, { label: "Not found" }]} title="Study not found" width="max-w-[760px]">
        <Link href={base} className="k-btn">Back to Research</Link>
      </V2Page>
    );
  }
  const id = crewIdentity(study.crew);
  const look = TOPIC_LOOK[study.topic];
  const floors = RESEARCH.floors;
  return (
    <V2Page
      crumbs={[{ label: "Research", href: base }, { label: id.name }, { label: TOPIC_LABEL[study.topic] }]}
      width="max-w-[880px]"
    >
      <div className="mb-6 flex items-start gap-4">
        <TopicTile topic={study.topic} size={40} />
        <div className="min-w-0">
          <div className="k-fg3 mb-1 flex flex-wrap items-center gap-2 text-[12px]">
            <span className="inline-flex items-center gap-1.5">
              <CrewMark color={id.color} glyph={id.glyph} size={16} />
              {id.name}
            </span>
            <span className="k-chip">{GOAL_LABEL[study.goal]}</span>
          </div>
          <h1 className="text-[24px] font-medium leading-[30px] tracking-[-0.02em]">{study.question}</h1>
        </div>
      </div>
      <div
        className="mb-6 rounded-[12px] p-4 text-[15px] font-medium leading-6"
        style={{ background: `color-mix(in oklab, ${look.color} 9%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${look.color} 22%, transparent)` }}
      >
        {study.headline}
      </div>
      {study.charts.map((c) => (
        <div key={c.title} className="k-card mb-4 p-5">
          <p className="k-label mb-4">{c.title}</p>
          {c.kind === "bars" ? <ResearchBars chart={c} color={look.color} winner={study.winner} /> : <ResearchLine chart={c} color={look.color} />}
        </div>
      ))}
      <div className="k-card mb-4 p-5">
        <p className="k-label mb-2">Conclusion</p>
        <ul className="k-fg2 list-disc space-y-1 pl-5 text-[13px] leading-5">
          {study.conclusion.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <div className="k-fg3 text-[12px] leading-5">
        <p className="mb-1 font-medium">How we measured</p>
        <p>
          Every client, every campaign, {monthText(RESEARCH.window.from)} to {monthText(RESEARCH.window.to)}: {RESEARCH.volume.emails.toLocaleString("en-US")} emails. ROI is read as the cost per outcome, since every
          crew buys one outcome: the cheaper outcome is the better return. A website visit is priced on the emails that carried a link. Only a bar past{" "}
          {floors.crown.minEmails.toLocaleString("en-US")} emails and {floors.crown.minReplies} positive replies (or {floors.crown.minClicks} visits) can win; a smaller one is
          drawn and marked thin.
        </p>
      </div>
    </V2Page>
  );
}
