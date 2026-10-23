"use client";

import { useMemo, useState } from "react";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyNote, Shimmer, StatTile, TopBar } from "@/components/v2/ui";
import { RecordsTabs } from "@/components/v2/records";
import { ResearchSwitches } from "@/components/v2/maturity-view-switch";
import { RoiLabel, RoiValue, LearningFigure } from "@/components/v2/roi-label";
import { CatalogueName } from "@/components/v2/catalogue-name";
import { SectionMark, SectionName } from "@/components/v2/research-bits";
import { StatusWord } from "@/components/v2/research-status";
import { PipeTabs } from "@/components/v2/research-catalog";
import { usePipeChannelName } from "@/components/v2/research-live-workflows";
import { useResearch, useResearchCatalog, useResearchPerformance } from "@/lib/research/research-source";
import { pipeCatalog, researchCatalogHref, type ResearchPipe } from "@/lib/research/research";
import { shortWorkflowName } from "@/lib/live-workflow-rows";
import { formatUsdAdaptive, formatCount } from "@/lib/format-number";
import { formatRatePct } from "@/lib/pipe-stats";
import { formatRoi } from "@/lib/format-roi";
import {
  deprecatedPartsWords,
  performanceByTab,
  type PerformanceFigure,
  type PerformancePoint,
  type PerformanceRow,
  type PerformanceTab,
  type PipePerformance,
} from "@/lib/research/performance";

/**
 * Research › <pipe> › Performance (owner 2026-10-23, RESEARCH-PERFORMANCE-1023): every workflow x
 * template x LLM combination that sent this pipe's emails, all clients pooled, since inception.
 * Five cards for the pipe on top, the combinations in Active / Deprecated tabs on 2/3, the pipe's
 * five curves on 1/3. A combination is Active only when its workflow, template and LLM all are.
 *
 * Every figure, each row's status (and which part deprecated it), the row order and every point of a
 * curve are features-service's (RESEARCH-COMBO-STATUS-1023), only formatted here; nothing is divided,
 * summed, ranked or graded.
 */

const TH = "k-label px-3 py-2.5 text-left font-medium first:pl-4 last:pr-4";
const TICK = { fontSize: 11, fill: "var(--fg-3)" };
const DASH = <span className="k-fg4">{"—"}</span>;
const TABS: { key: PerformanceTab; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "deprecated", label: "Deprecated" },
];

export function V2ResearchPerformanceView({ base, pipe }: { base: string; pipe: ResearchPipe }) {
  const { basis } = useResearch();
  const q = useResearchPerformance(basis);
  const catalog = useResearchCatalog(basis).data ?? null;
  const perf: PipePerformance | null = q.data?.pipes[pipe] ?? null;
  const failed = q.data === undefined && q.isError;
  const rows = perf?.rows ?? [];
  const channelName = usePipeChannelName(pipe);

  const catalogModels = useMemo(() => new Set((catalog ? pipeCatalog(catalog, pipe).models : []).map((m) => m.key)), [catalog, pipe]);
  const catalogTemplates = useMemo(() => new Set((catalog ? pipeCatalog(catalog, pipe).templates : []).map((t) => t.key)), [catalog, pipe]);
  const listedWorkflows = useMemo(() => new Set((catalog ? pipeCatalog(catalog, pipe).workflows : []).map((w) => w.key)), [catalog, pipe]);
  // The tabs split on features-service's own status: a combination with one part that can no longer run is Deprecated.
  const byTab = q.data !== undefined ? performanceByTab(rows) : null;
  const [tab, setTab] = useState<PerformanceTab>("active");
  const shown = byTab?.[tab] ?? [];

  const crumbs = [{ label: "Research", href: base }, { label: <SectionName section={{ pipe }} /> }, { label: "Performance" }];
  const unit = perf ? `/ ${perf.outcomeNoun}` : "";
  const t = perf?.totals ?? null;
  const points = perf?.series?.points ?? [];
  const answered = q.data !== undefined;

  return (
    <>
      <TopBar crumbs={crumbs} actions={<ResearchSwitches />} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <div className="min-w-0">
          <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">
            {!byTab ? "Performance" : `${byTab.active.length} active combinations`}
          </h1>
          <p className="k-fg2 mt-1 text-[14px]">Every workflow, template and LLM sent together on this pipe, all clients pooled, cheapest estimated cost first.</p>
        </div>

        <PipeTabs base={base} pipe={pipe} current="performance" countOf={(k) => (k === "performance" && byTab ? byTab.active.length : null)} />

        {failed ? (
          <div className="k-card mt-6">
            <EmptyNote>We could not load this page just now. Reload to try again.</EmptyNote>
          </div>
        ) : perf?.unavailableReason ? (
          <div className="k-card mt-6">
            <EmptyNote>{UNAVAILABLE_WORDS[perf.unavailableReason] ?? "This pipe has no combination to show yet."}</EmptyNote>
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
              <StatTile label={<RoiLabel />}>{!answered ? <Shimmer className="h-7 w-16" /> : t ? <BigRoi f={t.roi} /> : DASH}</StatTile>
              <StatTile label={`$ ${unit}`}>{!answered ? <Shimmer className="h-7 w-16" /> : t ? <Big f={t.costPerOutcomeUsd} format={formatUsdAdaptive} /> : DASH}</StatTile>
              <StatTile label="% Conversion">{!answered ? <Shimmer className="h-7 w-16" /> : t ? <Big f={t.conversionRatePct} format={formatRatePct} /> : DASH}</StatTile>
              <StatTile label={`# ${perf?.outcomeNounPlural ?? "Outcomes"}`}>{!answered ? <Shimmer className="h-7 w-16" /> : t ? <BigText>{t.outcomes.display}</BigText> : DASH}</StatTile>
              <StatTile label="$ Spent">{!answered ? <Shimmer className="h-7 w-16" /> : t ? <BigText>{t.spentUsd.display}</BigText> : DASH}</StatTile>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <section className="min-w-0">
                <div className="k-card overflow-hidden">
                  <RecordsTabs
                    tabs={TABS.map((x) => ({ key: x.key, label: x.label, count: byTab ? byTab[x.key].length : null }))}
                    active={tab}
                    onPick={(k) => setTab(k as PerformanceTab)}
                    right={
                      <span className="k-fg3 inline-flex items-center gap-1.5 text-[12px]">
                        <SectionMark section={{ pipe }} size={12} />
                        <SectionName section={{ pipe }} />
                      </span>
                    }
                  />
                  <div className="k-scroll relative overflow-x-auto">
                    <table className="w-full min-w-[800px] table-fixed text-[13px]">
                      <thead>
                        <tr className="border-b border-[var(--line-subtle)]">
                          {/* Template is the free column: its served names are the longest; a long one truncates, its full name on hover. */}
                          <th className={`${TH} w-[116px]`}>Workflow</th>
                          <th className={TH}>Template</th>
                          <th className={`${TH} w-[96px]`}>LLM</th>
                          <th className={`${TH} w-[64px] text-right`}>
                            <RoiLabel />
                          </th>
                          <th className={`${TH} w-[72px] text-right`}>{`$ ${unit}`}</th>
                          <th className={`${TH} w-[72px] text-right`}>% Conv.</th>
                          <th className={`${TH} w-[60px] text-right`}>{`# ${perf?.outcomeNounPlural ?? ""}`}</th>
                          <th className={`${TH} w-[72px] text-right`}>$ Spent</th>
                          <th className={`${TH} w-[104px]`}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!byTab || !answered ? (
                          [0, 1, 2, 3, 4].map((i) => (
                            <tr key={i} className="k-row h-10">
                              <td colSpan={9} className="px-4">
                                <Shimmer className="h-4 w-full" />
                              </td>
                            </tr>
                          ))
                        ) : shown.length === 0 ? (
                          <tr>
                            <td colSpan={9}>
                              <EmptyNote>{rows.length === 0 ? `No email has gone out on this pipe yet.` : tab === "active" ? "No combination on this pipe is active." : "No combination on this pipe is deprecated."}</EmptyNote>
                            </td>
                          </tr>
                        ) : (
                          shown.map((r) => (
                            <tr key={r.key} className="k-row h-11">
                              <td className="max-w-0 pl-4 pr-3">
                                <CatalogueName
                                  kind="workflow"
                                  variant="chip"
                                  name={r.workflow.name ?? r.workflow.label}
                                  label={shortWorkflowName(r.workflow.name ?? r.workflow.label, channelName)}
                                  icon={r.workflow.icon ?? null}
                                  color={r.workflow.color ?? null}
                                  href={listedWorkflows.has(r.workflow.key) ? researchCatalogHref(base, pipe, "workflows", r.workflow.key) : null}
                                  className="max-w-full"
                                />
                              </td>
                              <td className="max-w-0 px-3">
                                {r.template ? (
                                  <CatalogueName
                                    kind="template"
                                    variant="chip"
                                    // The template dynasty (owner 2026-10-23), its mark, opening its page.
                                    name={r.template.dynasty?.label ?? r.template.label}
                                    icon={r.template.dynasty?.icon ?? r.template.icon ?? null}
                                    color={r.template.dynasty?.color ?? r.template.color ?? null}
                                    href={catalogTemplates.has(templateDynastyKey(r.template)) ? researchCatalogHref(base, pipe, "templates", templateDynastyKey(r.template)) : null}
                                    className="max-w-full"
                                  />
                                ) : (
                                  <NotOnRecord />
                                )}
                              </td>
                              <td className="max-w-0 px-3">
                                {r.llm ? (
                                  <CatalogueName
                                    kind="llm"
                                    variant="chip"
                                    name={r.llm.label}
                                    href={catalogModels.has(r.llm.key) ? researchCatalogHref(base, pipe, "models", r.llm.key) : null}
                                    className="max-w-full"
                                  />
                                ) : (
                                  <NotOnRecord />
                                )}
                              </td>
                              <td className="whitespace-nowrap px-3 text-right tabular-nums">
                                <RowRoi f={r.roi} learning={r.learning} />
                              </td>
                              <td className="whitespace-nowrap px-3 text-right tabular-nums">
                                <Cell f={r.costPerOutcomeUsd} learning={r.learning} format={formatUsdAdaptive} stacked />
                              </td>
                              <td className="whitespace-nowrap px-3 text-right tabular-nums">
                                <Cell f={r.conversionRatePct} learning={r.learning} format={formatRatePct} stacked />
                              </td>
                              <td className="px-3 text-right tabular-nums">{r.outcomes.display}</td>
                              <td className="whitespace-nowrap px-3 text-right tabular-nums">{r.spentUsd.display}</td>
                              <td className="max-w-0 px-3">
                                <RowStatus row={r} />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="k-fg3 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px]">
                    Active means its workflow, template and LLM are all active. The rows add up to the cards above.
                  </div>
                </div>
              </section>

              <aside className="min-w-0 space-y-3">
                <SeriesCard title="ROI" answered={answered} points={points} pick={(p) => p.roi} format={(v) => formatRoi(v)} expected={expectedOf(t?.roi)} />
                <SeriesCard title={`$ ${unit}`} answered={answered} points={points} pick={(p) => p.costPerOutcomeUsd} format={formatUsdAdaptive} expected={expectedOf(t?.costPerOutcomeUsd)} />
                <SeriesCard title="% Conversion" answered={answered} points={points} pick={(p) => p.conversionRatePct} format={formatRatePct} expected={expectedOf(t?.conversionRatePct)} />
                <SeriesCard title={`# ${perf?.outcomeNounPlural ?? "Outcomes"}, added up`} answered={answered} points={points} pick={(p) => p.outcomes} format={formatCount} />
                <SeriesCard title="$ Spent, added up" answered={answered} points={points} pick={(p) => p.spentUsd} format={formatUsdAdaptive} />
                <p className="k-fg3 px-1 text-[12px] leading-5">Each month counts everything since the first email, to the end of that month.</p>
              </aside>
            </div>
          </>
        )}
      </div>
    </>
  );
}

const UNAVAILABLE_WORDS: Record<string, string> = {
  no_writer_recorded_on_pipe: "This pipe answers in a chat, so no template is on record for its messages yet.",
};

/** The template's Research page key: its dynasty's, else its own (a template on its own is its own page). */
function templateDynastyKey(t: NonNullable<PerformanceRow["template"]>): string {
  return t.dynasty?.key ?? t.key;
}

/** The served status; a deprecated row says under it which part made it so ("LLM retired"). */
function RowStatus({ row }: { row: PerformanceRow }) {
  const why = row.status === "deprecated" ? deprecatedPartsWords(row.deprecatedParts) : null;
  if (!why) return <StatusWord status={row.status} />;
  return (
    <span className="block min-w-0 leading-4">
      <StatusWord status={row.status} />
      <span className="k-fg3 block truncate text-[11.5px]" title={why}>
        {why}
      </span>
    </span>
  );
}

function NotOnRecord() {
  return <span className="k-fg3 block truncate text-[12px]">Not on record</span>;
}

/** The served expected value, drawn as a dotted line, only when the figure IS the expected one. */
function expectedOf(f: PerformanceFigure | undefined): number | null {
  return f && f.basis === "expected" ? f.value : null;
}

function BigText({ children }: { children: React.ReactNode }) {
  return <div className="text-[22px] font-medium leading-7 tracking-[-0.02em] tabular-nums">{children}</div>;
}

function BigRoi({ f }: { f: PerformanceFigure }) {
  return (
    <BigText>
      <RoiValue roi={{ value: f.value, expected: f.value != null && f.basis === "expected", reason: f.value == null ? f.unavailableReason : null }} />
    </BigText>
  );
}

function Big({ f, format }: { f: PerformanceFigure; format: (v: number) => string }) {
  return (
    <BigText>
      <Cell f={f} learning={false} format={format} />
    </BigText>
  );
}

/**
 * A served figure in the dashboard's own format (a rate a whole %, a decimal only below 1%), `expected`
 * beside it when it is the expected one, greyed while the row is Learning.
 */
function Cell({ f, learning, format, stacked = false }: { f: PerformanceFigure; learning: boolean; format: (v: number) => string; stacked?: boolean }) {
  if (f.value == null) return DASH;
  const text = format(f.value);
  if (f.basis === "expected" && stacked) return <Stacked value={text} tag="expected" />;
  if (learning && stacked) return <Stacked value={text} tag="Learning" grey />;
  if (f.basis === "expected") {
    return (
      <span className="whitespace-nowrap">
        {text}
        <span className="k-fg3 ml-1 text-[11px] font-normal">expected</span>
      </span>
    );
  }
  return learning ? <LearningFigure measured={text} expected={null} /> : <>{text}</>;
}

/** A table cell's figure with its tag on a second line, so the 2/3 column holds every column. */
function Stacked({ value, tag, grey = false }: { value: string; tag: string; grey?: boolean }) {
  return (
    <span className="inline-flex flex-col items-end leading-4">
      <span className={grey ? "k-fg3" : ""}>{value}</span>
      <span className="k-fg3 text-[11px] font-normal">{tag}</span>
    </span>
  );
}

function RowRoi({ f, learning }: { f: PerformanceFigure; learning: boolean }) {
  if (f.value == null) return <RoiValue roi={{ value: null, expected: false, reason: f.unavailableReason }} />;
  if (f.basis === "expected") return <Stacked value={formatRoi(f.value)} tag="expected" />;
  if (learning) return <Stacked value={formatRoi(f.value)} tag="Learning" grey />;
  return <RoiValue roi={{ value: f.value, expected: false, reason: null }} />;
}

/** One served monthly series as a line; the served expected value dotted when the pipe's figure is the expected one. */
function SeriesCard({
  title,
  answered,
  points,
  pick,
  format,
  expected = null,
}: {
  title: string;
  answered: boolean;
  points: PerformancePoint[];
  pick: (p: PerformancePoint) => number | null;
  format: (v: number) => string;
  expected?: number | null;
}) {
  // The curve starts the first month anything was spent: the months before it are not the pipe's history.
  const from = points.findIndex((p) => p.spentUsd > 0);
  const rows = (from < 0 ? [] : points.slice(from)).map((p) => ({ label: p.label, month: p.month, v: pick(p) }));
  const drawn = rows.some((r) => r.v != null);
  // Two ticks, 0 and the top of the curve: rounded in-between ticks repeated ("0.1%, 0.1%").
  const top = Math.max(0, expected ?? 0, ...rows.map((r) => r.v ?? 0));
  return (
    <div className="k-card p-4">
      <span className="k-label truncate">{title}</span>
      <div className="mt-2 h-[120px]">
        {!answered ? (
          <Shimmer className="h-full w-full rounded-[8px]" />
        ) : !drawn ? (
          <EmptyNote>Nothing to draw yet.</EmptyNote>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <XAxis dataKey="label" tick={TICK} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tick={TICK} tickLine={false} axisLine={false} width={48} domain={[0, top]} ticks={top > 0 ? [0, top] : [0]} tickFormatter={(v: number) => format(v)} />
              {expected != null && <ReferenceLine y={expected} stroke="var(--fg-3)" strokeDasharray="4 4" />}
              <Tooltip
                cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const r = payload[0].payload as (typeof rows)[number];
                  return (
                    <div className="k-popover px-2.5 py-1.5 text-[12px]">
                      <p className="k-fg3">{r.label}</p>
                      <p className="font-medium tabular-nums">{r.v == null ? "—" : format(r.v)}</p>
                    </div>
                  );
                }}
              />
              <Line type="linear" dataKey="v" stroke="var(--accent)" strokeWidth={1.75} dot={{ r: 2, strokeWidth: 0, fill: "var(--accent)" }} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
