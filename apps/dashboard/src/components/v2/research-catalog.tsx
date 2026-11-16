"use client";

import { HubChip, HubChips } from "@/components/v2/hub-section";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EmptyNote, MarkLines, SectionTitle, Shimmer, TopBar, type Crumb } from "@/components/v2/ui";
import { ResearchSwitches } from "@/components/v2/maturity-view-switch";
import { opensDrawer, ResearchLiveScripts, useMeasureEngineScripts } from "@/components/v2/research-live-scripts";
import { TacticTags, TacticsBlock } from "@/components/v2/tactic-tags";
import {
  ACTIVATE_CONTENT_NOTE,
  DEPRECATE_CONTENT_NOTE,
  DeprecationNote,
  StatusMenu,
  StatusWord as ContentStatusWord,
  isWorkflowDynasty,
  scriptStatus,
  useContentStatusWrites,
  useModelStatuses,
  useScriptWords,
  useTemplateStatuses,
  useWorkflowDeprecation,
} from "@/components/v2/research-status";
import { LLM_OUTPUTS_NOT_CARRIED, OutputsList, RecentRuns, ResearchDrawer, TemplateFigures, TemplateOutputsPanel, TemplateVersionDrawer, useTemplateOutputs } from "@/components/v2/research-template-outputs";
import { modelAliasesOf, modelsByTab, modelStatus } from "@/lib/research/content-status";
import { CatalogueName, CatalogueObjectMark } from "@/components/v2/catalogue-name";
import { RunCostChart, RunCostFigures, runCostGap } from "@/components/v2/research-run-cost";
import { useResearch, useResearchCatalog, useResearchMeasureEntry, useResearchTexts } from "@/lib/research/research-source";
import {
  Arrow,
  MonthsRow,
  Row,
  STANDALONE_WORDS,
  MeasureName,
  SectionMark,
  topicLook,
  dayText,
  identityWord,
  ResearchLive,
} from "@/components/v2/research-bits";
import {
  CATALOG_KINDS,
  RESEARCH_TABS,
  costPerSignupText,
  hasPostFigures,
  postCountText,
  type ResearchPostFigures,
  researchCatalogHref,
  modelHeadLabel,
  researchModel,
  researchTemplateOf,
  researchTemplateVersion,
  researchTemplateVersionHref,
  researchScript,
  templateContentKey,
  templateRowStatus,
  templatesByTab,
  templateTab,
  type TemplateTab,
  type CatalogKind,
  type ResearchTabKind,
  type ResearchModel,
  type ResearchModelVersion,
  type ResearchRef,
  type ResearchCatalog,
  type ResearchMeasure,
  type ResearchFigures,
  type ResearchTemplate,
  type ResearchTemplateVersion,
  type ResearchScript,
  outcomeUnitOf,
  measureCatalog,
} from "@/lib/research/research";

/**
 * Research's script, template and LLM pages (RESEARCH-BY-ENGINE-1113): for one measure of an Engine, every script (or
 * template, or LLM) that made its outcomes, all clients pooled, and one page per script, template and LLM. The
 * template and the LLM are a script's TACTICS. Fleet-wide, with the Global column only.
 *
 * Every figure, label and date arrives written in features-service's live catalogue; this
 * file lays them out and never divides, ranks or formats a number. The catalogue and the
 * template texts are read from the staff-only Research route (research-source.tsx).
 */

const TH = "k-label px-3 py-2.5 text-left font-medium first:pl-4 last:pr-4";
const KIND_WORD: Record<CatalogKind, { one: string; many: string; title: string }> = {
  scripts: { one: "script", many: "scripts", title: "Scripts" },
  templates: { one: "template", many: "templates", title: "Templates" },
  llms: { one: "LLM", many: "LLMs", title: "LLMs" },
};
/** A measure's tab names: the catalogue kinds, then Performance. */
const TAB_TITLE: Record<ResearchTabKind, string> = { scripts: "Scripts", templates: "Templates", llms: "LLMs", performance: "Performance" };
/** Performance has no study topic of its own: it wears the conversion colour (what it measures). */
const PERFORMANCE_COLOR = "var(--data-teal)";

/**
 * The tabs across a measure's pages (Scripts, Templates, LLMs, Performance). Each states its own
 * page's length when that page has answered, never another read's count.
 */
export function MeasureTabs({ base, measure, current, countOf }: { base: string; measure: ResearchMeasure; current: ResearchTabKind; countOf: (k: ResearchTabKind) => number | null }) {
  return (
    <div className="mt-5 flex gap-5 border-b border-[var(--line-subtle)]">
      {RESEARCH_TABS.map((k) => (
        <Link key={k} href={researchCatalogHref(base, measure, k)} aria-current={k === current ? "page" : undefined} className="k-tab inline-flex items-center gap-1.5 text-[13px]">
          {TAB_TITLE[k]}
          {countOf(k) != null && <span className="k-fg3 tabular-nums">{countOf(k)}</span>}
        </Link>
      ))}
    </div>
  );
}

/** Each kind wears its study topic's mark and colour. */
const KIND_TOPIC: Record<CatalogKind, "script" | "template" | "llm"> = { scripts: "script", templates: "template", llms: "llm" };
/** Each kind's shared catalogue mark (`CatalogueName`'s own kind words). */
const KIND_MARK: Record<CatalogKind, "workflow" | "template" | "llm"> = { scripts: "workflow", templates: "template", llms: "llm" };

/** An LLM, template or script named the shared way (mark + name, a template's version after it), a link when its page exists in this measure. */
function RefLink({ base, measure, kind, r, className = "" }: { base: string; measure: ResearchMeasure; kind: CatalogKind; r: ResearchRef | null; className?: string }) {
  if (!r) return <span className="k-fg4">{"—"}</span>;
  return (
    <CatalogueName
      kind={KIND_MARK[kind]}
      name={r.label}
      href={r.linked ? researchCatalogHref(base, measure, kind, r.key) : null}
      version={r.version?.label ?? null}
      servedKey={kind === "llms" ? null : r.key}
      className={className.replace(/\b(block|truncate)\b/g, "").trim()}
    />
  );
}

/** A row is named by its served label (a script's short name, a template's or an LLM's name). */
function rowName(_kind: CatalogKind, r: ResearchScript | ResearchTemplate | ResearchModel): string {
  return r.label;
}

function useOutcome(measure: ResearchMeasure): { noun: string; plural: string; unit: string } {
  const outcome = useResearchMeasureEntry(measure)?.counts.name ?? "Outcome";
  const plural = /[^aeiou]y$/i.test(outcome) ? `${outcome.slice(0, -1)}ies` : `${outcome}s`;
  return { noun: outcome, plural, unit: outcomeUnitOf(outcome) };
}

/**
 * How many of a measure's scripts, templates and LLMs are ACTIVE (owner 2026-10-23: « le total doit être le nombre
 * d'actifs, on ne compte pas les deprecated », for all three). Scripts read the live ranking's rows (their served
 * `executable`); each kind is null until its statuses answer, so no count flashes the wrong number.
 */
function useActiveCatalogCounts(measure: ResearchMeasure, catalog: ResearchCatalog | null): Record<CatalogKind, number | null> {
  const live = useMeasureEngineScripts(measure);
  const templateStatuses = useTemplateStatuses();
  const modelStatuses = useModelStatuses();
  const scripts =
    live.boardQ.data?.state === "ready"
      ? (live.engine?.runnableScripts ?? 0)
      : catalog
        ? measureCatalog(catalog, measure).scripts.filter((w) => w.runnable !== false).length
        : null;
  const templates = catalog ? (templatesByTab(measureCatalog(catalog, measure).templates, templateStatuses)?.active.length ?? null) : null;
  const llms = catalog ? (modelsByTab(measureCatalog(catalog, measure).llms, modelStatuses)?.active.length ?? null) : null;
  return { scripts, templates, llms };
}

/**
 * The hub's links from a measure to its script, template and LLM pages, each with its active count, and
 * Performance. Every served measure gets all four: a page with nothing measured yet opens on its Learning
 * state, never hidden.
 */
export function MeasureCatalogLinks({ base, measure }: { base: string; measure: ResearchMeasure }) {
  const catalog = useResearchCatalog(useResearch().basis).data ?? null;
  const active = useActiveCatalogCounts(measure, catalog);
  return (
    <HubChips>
      {CATALOG_KINDS.map((kind) => (
        <HubChip key={kind} href={researchCatalogHref(base, measure, kind)} color={topicLook(KIND_TOPIC[kind]).color} label={KIND_WORD[kind].title} count={active[kind]} />
      ))}
      <HubChip href={researchCatalogHref(base, measure, "performance")} color={PERFORMANCE_COLOR} label={TAB_TITLE.performance} />
    </HubChips>
  );
}

// ─── The view ──────────────────────────────────────────────────────────────

export function V2ResearchCatalogView({
  base,
  measure,
  kind,
  itemKey,
  versionKey = null,
  nav,
}: {
  base: string;
  measure: ResearchMeasure;
  kind: CatalogKind;
  itemKey: string | null;
  /** A template version's own page (`templates/<dynasty>/<version>`). */
  versionKey?: string | null;
  nav: (href: string) => void;
}) {
  const catalogQuery = useResearchCatalog(useResearch().basis);
  const catalog = catalogQuery.data ?? null;
  const failed = catalogQuery.isError;
  const listHref = researchCatalogHref(base, measure, kind);
  const crumbs = [
    { label: "Research", href: base },
    { label: <MeasureName measure={measure} /> },
    itemKey ? { label: KIND_WORD[kind].title, href: listHref } : { label: KIND_WORD[kind].title },
  ];
  // The live script list needs nothing from the catalogue to paint: it renders at once.
  if (!catalog && !itemKey && kind === "scripts") {
    return <CatalogList base={base} measure={measure} kind={kind} catalog={null} crumbs={crumbs} nav={nav} />;
  }
  if (!catalog) {
    return (
      <>
        <TopBar crumbs={crumbs} actions={<ResearchSwitches />} />
        <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
          {failed ? (
            <div className="k-card">
              <EmptyNote>We could not load this page just now. Reload to try again.</EmptyNote>
            </div>
          ) : (
            <RowsSkeleton />
          )}
        </div>
      </>
    );
  }
  if (!itemKey) return <CatalogList base={base} measure={measure} kind={kind} catalog={catalog} crumbs={crumbs} nav={nav} />;
  const item =
    kind === "scripts"
      ? researchScript(catalog, measure, itemKey)
      : kind === "templates"
        ? researchTemplateOf(catalog, measure, itemKey)
        : researchModel(catalog, measure, itemKey);
  if (!item) {
    return (
      <>
        <TopBar crumbs={[...crumbs, { label: "Not found" }]} actions={<ResearchSwitches />} />
        <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
          <div className="k-card">
            <EmptyNote>
              This {KIND_WORD[kind].one} is not in this Engine&apos;s research.{" "}
              <Link href={listHref} className="k-fg underline">
                See every {KIND_WORD[kind].one}
              </Link>
            </EmptyNote>
          </div>
        </div>
      </>
    );
  }
  if (kind === "templates" && versionKey) {
    const t = item as ResearchTemplate;
    const version = researchTemplateVersion(t, versionKey);
    const dynastyHref = researchCatalogHref(base, measure, "templates", t.key);
    const versionCrumbs = [...crumbs, { label: t.label, href: dynastyHref }, { label: version ? version.label : "Not found" }];
    if (!version) {
      return (
        <>
          <TopBar crumbs={versionCrumbs} actions={<ResearchSwitches />} />
          <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
            <div className="k-card">
              <EmptyNote>
                This version is not one of {t.label}&apos;s.{" "}
                <Link href={dynastyHref} className="k-fg underline">
                  See its versions
                </Link>
              </EmptyNote>
            </div>
          </div>
        </>
      );
    }
    return <TemplateVersionView base={base} measure={measure} t={t} v={version} crumbs={versionCrumbs} />;
  }
  const itemCrumbs = [...crumbs, { label: rowName(kind, item) }];
  if (kind === "scripts") return <ScriptView base={base} measure={measure} w={item as ResearchScript} crumbs={itemCrumbs} nav={nav} />;
  if (kind === "templates") return <TemplateView base={base} measure={measure} t={item as ResearchTemplate} crumbs={itemCrumbs} nav={nav} />;
  return <ModelView base={base} measure={measure} m={item as ResearchModel} crumbs={itemCrumbs} nav={nav} />;
}

function RowsSkeleton() {
  return (
    <div className="k-card overflow-hidden">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="k-row flex h-10 items-center px-4">
          <Shimmer className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

function Chevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M4.5 3l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Money({ value, unit }: { value: string | null; unit: string }) {
  return value == null ? (
    <span className="k-fg4">{"—"}</span>
  ) : (
    <>
      {value} <span className="k-fg3 text-[12px]">{unit}</span>
    </>
  );
}

function Dash({ v }: { v: string | null }) {
  return v == null ? <span className="k-fg4">{"—"}</span> : <>{v}</>;
}

/** The post columns' headers (THREADS-IDEAS-AB), on a measure whose rows carry `postFigures`. */
function PostHeads() {
  return (
    <>
      <th className={`${TH} w-16 text-right`}>Posts</th>
      <th className={`${TH} w-20 text-right`}>Views</th>
      <th className={`${TH} w-28 text-right`}>Engagements</th>
      <th className={`${TH} w-16 text-right`}>Visits</th>
      <th className={`${TH} w-20 text-right`}>Signups</th>
      <th className={`${TH} w-24 text-right`}>$ / signup</th>
    </>
  );
}

/** One row's post figures, printed as served; a row without them on such a measure shows dashes. */
function PostCells({ p }: { p: ResearchPostFigures | null | undefined }) {
  if (p == null)
    return (
      <>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <td key={i} className="px-3 text-right">
            <span className="k-fg4">{"—"}</span>
          </td>
        ))}
      </>
    );
  return (
    <>
      <td className="px-3 text-right tabular-nums">{postCountText(p.posts)}</td>
      <td className="px-3 text-right tabular-nums">{postCountText(p.views)}</td>
      <td className="px-3 text-right tabular-nums">{postCountText(p.engagements)}</td>
      <td className="px-3 text-right tabular-nums">{postCountText(p.visits)}</td>
      <td className="px-3 text-right tabular-nums">{postCountText(p.signups)}</td>
      <td className="whitespace-nowrap px-3 text-right tabular-nums">
        {p.costPerSignupUsd == null ? <span className="k-fg3 text-[12px]">{costPerSignupText(null)}</span> : costPerSignupText(p.costPerSignupUsd)}
      </td>
    </>
  );
}

// ─── A measure's list ─────────────────────────────────────────────────────────

function CatalogList({
  base,
  measure,
  kind,
  catalog,
  crumbs,
  nav,
}: {
  base: string;
  measure: ResearchMeasure;
  kind: CatalogKind;
  catalog: ResearchCatalog | null;
  crumbs: Crumb[];
  nav: (href: string) => void;
}) {
  const o = useOutcome(measure);
  const RESEARCH = useResearch().file;
  const rows: (ResearchScript | ResearchTemplate | ResearchModel)[] = catalog ? measureCatalog(catalog, measure)[kind] : [];
  const words = KIND_WORD[kind];
  const priced = rows.filter((r) => r.rank != null).length;
  const other = CATALOG_KINDS[(CATALOG_KINDS.indexOf(kind) + 1) % CATALOG_KINDS.length];
  // Scripts are read LIVE off the producer's ranking of the measure; the catalogue table stays for templates and LLMs.
  const live = kind === "scripts";
  // Every count on the page is the ACTIVE count, deprecated never counted (owner 2026-10-23).
  const active = useActiveCatalogCounts(measure, catalog);
  const countOf = (k: CatalogKind): number | null => active[k];
  // Staff status (TEMPLATE-MODEL-STATUS-1019): templates by type, LLMs by every alias chat-service serves them under (served on the row).
  const templateStatuses = useTemplateStatuses();
  const modelStatuses = useModelStatuses();
  const writes = useContentStatusWrites();
  // Templates and LLMs sit in two tabs, Active and Deprecated (owner 2026-10-21, LLMs 2026-10-23),
  // the tab in the URL. No row shows before the statuses answer, so none flashes in a tab it then leaves.
  const search = useSearchParams();
  const tab = templateTab(search?.get("status"));
  const tabbed = kind === "templates" || kind === "llms";
  const statusFailed = kind === "templates" ? templateStatuses.failed : kind === "llms" ? modelStatuses.failed : false;
  const byTab: Record<TemplateTab, (ResearchTemplate | ResearchModel)[]> | null =
    !tabbed || statusFailed
      ? null
      : kind === "templates"
        ? templatesByTab(rows as ResearchTemplate[], templateStatuses)
        : modelsByTab(rows as ResearchModel[], modelStatuses);
  const statusPending = tabbed && !statusFailed && !byTab;
  // A post-writing measure (Threads posts): its templates and LLMs carry post figures, shown as their own
  // columns in place of the per-outcome ones (THREADS-IDEAS-AB). Every other measure renders as before.
  const posts = tabbed && hasPostFigures(rows as (ResearchTemplate | ResearchModel)[]);
  // Templates and models render in the served order (features-service's rank). Never re-sorted here (owner 2026-10-23).
  // No « row 1 goes next »: since SCRIPT-VALUE-RATING-1113 the Rating picks a SCRIPT, never a template or an LLM.
  const shown: (ResearchScript | ResearchTemplate | ResearchModel)[] = tabbed ? (byTab?.[tab] ?? []) : rows;
  const pickTab = (next: TemplateTab) => {
    // The history API, null state: Next keeps useSearchParams in step (apps/dashboard CLAUDE.md).
    window.history.replaceState(null, "", next === "active" ? window.location.pathname : `${window.location.pathname}?status=${next}`);
  };
  // A Templates row opens its detail in the right drawer (owner 2026-10-23); its name opens its page.
  const [selected, setSelected] = useState<string | null>(null);
  const selectedTemplate = kind === "templates" ? ((shown as ResearchTemplate[]).find((r) => r.key === selected) ?? null) : null;
  // A Models row opens its summary in the same right drawer (owner 2026-10-24); its name opens its page.
  const selectedModel = kind === "llms" ? ((shown as ResearchModel[]).find((r) => r.key === selected) ?? null) : null;
  return (
    <>
      <TopBar crumbs={crumbs} actions={<ResearchSwitches />} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">
              {live ? "Scripts making this outcome, as the Rating ranks them today" : `${rows.length} ${rows.length === 1 ? words.one : words.many}, ${priced} with a ${o.noun.toLowerCase()}`}
            </h1>
            <p className="k-fg2 mt-1 text-[14px]">
              {live ? (
                <>Every script of this Engine, all clients pooled, as the Rating draws them today.</>
              ) : (
                <>
                  Every {words.one} that wrote for this Engine&apos;s {posts ? "posts" : "outcomes"}, all clients pooled, the cheapest {o.noun.toLowerCase()} first.{" "}
                  {kind === "templates"
                    ? "Click a row for its scripts, LLMs and last emails; its name opens its page."
                    : kind === "llms"
                      ? "Click a row for its summary and last runs; its name opens its page."
                      : "Open one for its months and its last runs."}
                </>
              )}
            </p>
          </div>
          {!live && (
            <ResearchLive file={RESEARCH} />
          )}
        </div>

        <MeasureTabs base={base} measure={measure} current={kind} countOf={(k) => (k === "performance" ? null : countOf(k))} />

        <section className="mt-6">
          <SectionTitle
            count={countOf(kind)}
            right={
              <span className="inline-flex items-center gap-1.5">
                <SectionMark section={{ measure }} size={14} />
                <MeasureName measure={measure} />
              </span>
            }
          >
            {words.title}
          </SectionTitle>
          {tabbed && (
            <div className="mb-3 flex gap-5 border-b border-[var(--line-subtle)]">
              {(["active", "deprecated"] as const).map((k) => (
                <button key={k} type="button" onClick={() => pickTab(k)} aria-current={k === tab ? "page" : undefined} className="k-tab inline-flex items-center gap-1.5 text-[13px]">
                  {k === "active" ? "Active" : "Deprecated"}
                  {byTab ? <span className="k-fg3 tabular-nums">{byTab[k].length}</span> : statusPending ? <Shimmer className="inline-block h-3 w-4" /> : null}
                </button>
              ))}
            </div>
          )}
          {live ? (
            <ResearchLiveScripts measure={measure} />
          ) : (
            <div>
              <div className="k-card min-w-0 overflow-hidden">
                <div className="k-scroll relative overflow-x-auto">
                  <table className={`w-full ${posts ? "min-w-[1200px]" : kind === "templates" ? "min-w-[1100px]" : "min-w-[1040px]"} text-[13px]`}>
                    <thead>
                      <tr className="border-b border-[var(--line-subtle)]">
                        <th className={TH}>{words.title.slice(0, -1)}</th>
                        {kind === "templates" && (
                          <>
                            {/* Owner 2026-10-23: Template, Tactics, % Conversion, $ / outcome, # outcomes, $ Spent, Status. No return below a
                                campaign's Target (owner 2026-11-03, ROI-CONSISTENCY-1103). */}
                            <th className={`${TH} w-48`}>Tactics</th>
                            {posts ? (
                              <PostHeads />
                            ) : (
                              <>
                            <th className={`${TH} w-28 text-right`}>% Conversion</th>
                            <th className={`${TH} w-28 text-right`}>{`$ ${o.unit}`}</th>
                            <th className={`${TH} w-28 text-right`}>{`# ${o.plural}`}</th>
                              </>
                            )}
                            <th className={`${TH} w-24 text-right`}>$ Spent</th>
                            <th className={`${TH} w-28`}>Status</th>
                          </>
                        )}
                        {kind === "llms" ? (
                          <>
                            {/* Owner 2026-10-23: LLM, $ / outcome, % Conversion, # outcomes, $ Spent, Status; 10-24: $ / run left of $ Spent.
                                No return per model (ROI-CONSISTENCY-1103). */}
                            {posts ? (
                              <PostHeads />
                            ) : (
                              <>
                            <th className={`${TH} w-36 text-right`}>{`$ ${o.unit}`}</th>
                            <th className={`${TH} w-28 text-right`}>% Conversion</th>
                            <th className={`${TH} w-32 text-right`}>{`# ${o.plural}`}</th>
                              </>
                            )}
                            <th className={`${TH} w-24 text-right`}>$ / run</th>
                            <th className={`${TH} w-28 text-right`}>$ Spent</th>
                            <th className={`${TH} ${posts ? "w-36" : "w-56"}`}>Status</th>
                          </>
                        ) : null}
                        <th className={`${TH} w-10`} aria-label="Status menu" />
                      </tr>
                    </thead>
                    <tbody>
                      {statusPending ? (
                        [0, 1, 2, 3, 4].map((i) => (
                          <tr key={i} className="k-row h-10">
                            <td colSpan={posts ? 13 : 10} className="px-4">
                              <Shimmer className="h-4 w-full" />
                            </td>
                          </tr>
                        ))
                      ) : statusFailed ? (
                        <tr>
                          <td colSpan={posts ? 13 : 10}>
                            <EmptyNote>We could not read which {words.many} are active just now. It retries on its own.</EmptyNote>
                          </td>
                        </tr>
                      ) : shown.length === 0 ? (
                        <tr>
                          <td colSpan={posts ? 13 : 10}>
                            <EmptyNote>
                              {rows.length === 0
                                ? `No ${words.one} has written for this Engine yet.`
                                : tab === "active"
                                  ? `No ${words.one} here is active.`
                                  : `No ${words.one} here is deprecated.`}
                            </EmptyNote>
                          </td>
                        </tr>
                      ) : (
                        shown.map((r) => {
                          const href = researchCatalogHref(base, measure, kind, r.key);
                          const drawerRow = kind === "templates" || kind === "llms";
                          const picked = drawerRow && selected === r.key;
                          const served = kind === "llms" ? modelAliasesOf(r as ResearchModel) : { aliases: [], gap: null };
                          const modelKeys = served.aliases;
                          // Only a template's status is written here: an LLM's was set per channel, a grain Research no longer has.
                          const target = kind === "templates" ? ({ kind: "template", key: templateContentKey(r as ResearchTemplate), label: r.label } as const) : null;
                          // A template row's word is the status that picked its tab (the dynasty's), never its head
                          // version's own: a head served a few minutes behind an upgrade read Deprecated under Active.
                          const status =
                            kind === "templates" ? templateRowStatus(r as ResearchTemplate, templateStatuses) : modelStatus(modelKeys, (a) => modelStatuses.map.get(a));
                          const statusAnswered = kind === "templates" ? status !== null : modelStatuses.answered;
                          const deprecation =
                            kind === "templates"
                              ? status === "deprecated"
                                ? templateStatuses.deprecationOf(templateContentKey(r as ResearchTemplate))
                                : null
                              : modelStatuses.deprecationOf(modelKeys);
                          return (
                            <tr
                              key={r.key}
                              onClick={(e) => (drawerRow ? opensDrawer(e.target, e.currentTarget) && setSelected(r.key) : nav(href))}
                              aria-selected={drawerRow ? picked : undefined}
                              className={`k-row group h-10 cursor-pointer ${picked ? "k-selected" : ""}`}
                            >
                              <td className={`max-w-0 pl-4 pr-3 ${kind === "llms" ? "py-1.5" : ""}`}>
                                {kind === "llms" ? (
                                  <ModelNameLines m={r as ResearchModel} href={href} />
                                ) : (
                                <span className="flex min-w-0 items-center gap-1.5">
                                  {kind === "templates" ? (
                                    // The name is a button to the template's own page; the rest of the row opens the drawer.
                                    <Link
                                      href={href}
                                      title={`Open ${r.label}`}
                                      className={`k-btn-ghost -mx-1.5 inline-flex h-8 min-w-0 max-w-full items-center gap-2 px-1.5 hover:text-[var(--accent)] ${(r as ResearchTemplate).standaloneReason ? "shrink-0" : ""}`}
                                    >
                                      <CatalogueName
                                        kind="template"
                                        name={r.label}
                                        label={rowName(kind, r)}
                                        icon={(r as ResearchTemplate).icon ?? null}
                                        color={(r as ResearchTemplate).color ?? null}
                                        className="font-medium"
                                      />
                                    </Link>
                                  ) : (
                                    <CatalogueName
                                      kind={KIND_MARK[kind]}
                                      name={r.label}
                                      label={rowName(kind, r)}
                                      href={href}
                                      icon={(r as ResearchScript).icon ?? null}
                                      color={(r as ResearchScript).color ?? null}
                                      className="font-medium"
                                    />
                                  )}
                                  {kind === "templates" && <TemplateRowChip t={r as ResearchTemplate} />}
                                </span>
                                )}
                              </td>
                              {kind === "templates" && (
                                <>
                                  <td className="max-w-0 px-3 py-2">
                                    <TacticTags tactics={(r as ResearchTemplate).tactics ?? null} reason={(r as ResearchTemplate).tacticsUnavailableReason ?? null} />
                                  </td>
                                  {posts ? (
                                    <PostCells p={(r as ResearchTemplate).postFigures} />
                                  ) : (
                                    <>
                                  <td className="px-3 text-right tabular-nums">
                                    <Dash v={r.rate} />
                                  </td>
                                  <td className="whitespace-nowrap px-3 text-right tabular-nums">
                                    <Dash v={r.cost} />
                                  </td>
                                  <td className="px-3 text-right tabular-nums">{r.outcomes}</td>
                                    </>
                                  )}
                                  <td className="whitespace-nowrap px-3 text-right tabular-nums">{r.spend}</td>
                                  <td className="max-w-0 px-3">
                                    <ContentStatusWord status={status} pending={!statusAnswered} deprecation={deprecation} />
                                  </td>
                                </>
                              )}
                              {kind === "llms" ? (
                                <>
                                  {posts ? (
                                    <PostCells p={(r as ResearchModel).postFigures} />
                                  ) : (
                                    <>
                                  <td className="whitespace-nowrap px-3 text-right tabular-nums">
                                    <Dash v={r.cost} />
                                  </td>
                                  <td className="px-3 text-right tabular-nums">
                                    <Dash v={r.rate} />
                                  </td>
                                  <td className="px-3 text-right tabular-nums">{r.outcomes}</td>
                                    </>
                                  )}
                                  <td className="whitespace-nowrap px-3 text-right tabular-nums" title={(r as ResearchModel).runCost?.averageDisplay ? undefined : runCostGap((r as ResearchModel).runCost)}>
                                    <Dash v={(r as ResearchModel).runCost?.averageDisplay ?? null} />
                                  </td>
                                  <td className="px-3 text-right tabular-nums">{r.spend}</td>
                                  <td className="max-w-0 px-3">
                                    <ContentStatusWord
                                      status={status}
                                      gap={served.gap}
                                      pending={!statusAnswered && modelKeys.length > 0}
                                      deprecation={deprecation}
                                    />
                                  </td>
                                </>
                              ) : null}
                              <td className="pl-1 pr-4 text-right">
                                {target ? (
                                  <StatusMenu
                                    status={status}
                                    label={r.label}
                                    onDeprecate={() => writes.askDeprecate(target)}
                                    onActivate={() => writes.activate(target)}
                                    deprecateNote={DEPRECATE_CONTENT_NOTE}
                                    activateNote={ACTIVATE_CONTENT_NOTE}
                                  />
                                ) : null}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="k-fg3 flex items-center gap-3 border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px] tabular-nums">
                  <span className="min-w-0 truncate">
                    {`${priced} of ${rows.length} priced per ${o.noun.toLowerCase()}. Ranked as features-service serves them.`}
                  </span>
                  <Link href={researchCatalogHref(base, measure, other)} className="k-btn-ghost ml-auto h-6 shrink-0 whitespace-nowrap px-1.5 text-[12px]">
                    See the {KIND_WORD[other].many}
                  </Link>
                </div>
              </div>
              {selectedTemplate && (
                <TemplateOutputsPanel
                  t={selectedTemplate}
                  href={researchCatalogHref(base, measure, "templates", selectedTemplate.key)}
                  base={base}
                  measure={measure}
                  catalog={catalog}
                  outcome={o}
                  onClose={() => setSelected(null)}
                />
              )}
              {selectedModel && (
                <ModelPanel
                  m={selectedModel}
                  href={researchCatalogHref(base, measure, "llms", selectedModel.key)}
                  base={base}
                  measure={measure}
                  outcome={o}
                  onClose={() => setSelected(null)}
                />
              )}
            </div>
          )}
          {writes.modal}
          {!live && <p className="k-fg3 mt-1.5 text-[12px] leading-5">{RESEARCH.maturation.note}</p>}
        </section>
      </div>
    </>
  );
}

// ─── One workflow, one template ────────────────────────────────────────────

function Kpi({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="k-label truncate">{label}</p>
      <div className="mt-1 text-[22px] font-medium leading-7 tracking-[-0.02em] tabular-nums">{value}</div>
    </div>
  );
}

function Header({
  topic,
  title,
  sub,
  chips,
  icon = null,
  color = null,
}: {
  topic: "script" | "template" | "llm";
  title: string;
  /** The item's served mark (MARKS-1022); none for a model, which wears its product logo. */
  icon?: string | null;
  color?: string | null;
  /** One customer line under the title (a template dynasty's description). */
  sub?: string | null;
  chips: React.ReactNode;
}) {
  return (
    <div className="mt-2 flex min-w-0 items-center gap-3">
      <CatalogueObjectMark kind={topic === "script" ? "workflow" : topic} name={title} icon={icon} color={color} size={40} />
      <div className="min-w-0">
        <h1 className="truncate text-[24px] font-medium leading-[30px] tracking-[-0.02em]">{title}</h1>
        {sub && (
          <p className="k-fg2 truncate text-[13px] leading-5" title={sub}>
            {sub}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2">{chips}</div>
      </div>
    </div>
  );
}

function KpiStrip({ f, measure }: { f: ResearchFigures; measure: ResearchMeasure }) {
  const o = useOutcome(measure);
  // No return tile: a workflow, template or LLM sits below a campaign's Target (ROI-CONSISTENCY-1103).
  return (
    <div className="k-card mt-5 grid grid-cols-2 divide-[var(--line-subtle)] md:grid-cols-4 md:divide-x">
      <Kpi label={`Cost / ${o.noun.toLowerCase()}`} value={<Dash v={f.cost} />} />
      <Kpi label="Rate" value={<Dash v={f.rate} />} />
      <Kpi label={o.plural} value={f.outcomes} />
      <Kpi label="Emails" value={f.emails} />
    </div>
  );
}

function Charts({ f, topic }: { f: ResearchFigures; topic: "script" | "template" | "llm" }) {
  if (!f.charts.length) {
    return (
      <div className="k-card">
        <EmptyNote>Too few emails in any single month to draw a curve.</EmptyNote>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {f.charts.map((c) => (
        <MonthsRow key={c.title} chart={c} color={topicLook(topic).color} />
      ))}
    </div>
  );
}

function RunsTable({ title, note, head, rows }: { title: string; note: string; head: React.ReactNode; rows: React.ReactNode[] }) {
  return (
    <section>
      <SectionTitle count={rows.length} right={<span>{note}</span>}>
        {title}
      </SectionTitle>
      <div className="k-card overflow-hidden">
        <div className="k-scroll relative overflow-x-auto">
          <table className="w-full min-w-[620px] text-[13px]">
            <thead>
              <tr className="border-b border-[var(--line-subtle)]">{head}</tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows
              ) : (
                <tr>
                  <td colSpan={6}>
                    <EmptyNote>No run recorded before the read.</EmptyNote>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function MeasuredNote() {
  const RESEARCH = useResearch().file;
  return (
    <>
      <p className="k-label mt-5">How we measured</p>
      <p className="k-fg2 mt-2 text-[12px] leading-5">
        Every client pooled, from the first email to the read on {dayText(RESEARCH.readOn)}. {RESEARCH.maturation.note} Runs name no client and no lead.
      </p>
    </>
  );
}

function ScriptView({
  base,
  measure,
  w,
  crumbs,
  nav,
}: {
  base: string;
  measure: ResearchMeasure;
  w: ResearchScript;
  crumbs: Crumb[];
  nav: (href: string) => void;
}) {
  const o = useOutcome(measure);
  // A script's tactics (RESEARCH-BY-ENGINE-1113): the LLM and the template it writes with, each its own page.
  const llm = w.tactics?.llm ?? null;
  const template = w.tactics?.template ?? null;
  const tplHref = template?.linked ? researchCatalogHref(base, measure, "templates", template.key) : null;
  const status = scriptStatus(w.runnable);
  const why = useWorkflowDeprecation(w.key, status === "deprecated" && isWorkflowDynasty(w.key));
  return (
    <>
      <TopBar crumbs={crumbs} actions={<ResearchSwitches />} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <Header
          topic="script"
          title={w.label}
          icon={w.icon ?? null}
          color={w.color ?? null}
          chips={
            <>
              <ContentStatusWord status={status} />
              <span className="k-chip inline-flex items-center gap-1.5">
                <SectionMark section={{ measure }} size={12} />
                <MeasureName measure={measure} />
              </span>
              {llm && <CatalogueName kind="llm" variant="chip" name={llm.label} href={llm.linked ? researchCatalogHref(base, measure, "llms", llm.key) : null} />}
              {template && <CatalogueName kind="template" variant="chip" name={template.label} href={tplHref} version={template.version?.label ?? null} servedKey={template.key} />}
            </>
          }
        />
        <DeprecationNote deprecation={why.deprecation} />
        <KpiStrip f={w} measure={measure} />

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <Charts f={w} topic="script" />
            <section>
              <SectionTitle right={<span>Every client, newest first</span>}>Recent runs</SectionTitle>
              <div className="k-card overflow-hidden">
                <RecentRuns slug={w.key} limit={20} />
              </div>
            </section>
          </div>
          <aside className="k-card h-fit p-4">
            <p className="k-label">Details</p>
            <dl className="mt-3 space-y-2.5 text-[13px]">
              <Row
                k="Engine"
                v={
                  <span className="inline-flex items-center gap-1.5">
                    <SectionMark section={{ measure }} />
                    <MeasureName measure={measure} />
                  </span>
                }
              />
              <Row k="Outcome" v={o.noun} />
            </dl>
            <p className="k-label mt-5">Tactics</p>
            <dl className="mt-3 space-y-2.5 text-[13px]">
              <Row k="LLM" v={llm ? <RefLink base={base} measure={measure} kind="llms" r={llm} className={llm.linked ? "text-[var(--accent)]" : ""} /> : null} />
              <Row k="Template" v={template ? <RefLink base={base} measure={measure} kind="templates" r={template} className={tplHref ? "text-[var(--accent)]" : ""} /> : null} />
            </dl>
            <dl className="mt-5 space-y-2.5 text-[13px]">
              <Row k="Invested" v={w.spend} />
              <Row k="Sample" v={<span className="k-fg2 text-[12px]">{w.sample}</span>} />
            </dl>
            <MeasuredNote />
            <button type="button" onClick={() => nav(researchCatalogHref(base, measure, "scripts"))} className="k-btn mt-4">
              Every script
            </button>
          </aside>
        </div>
      </div>
    </>
  );
}

function TemplateText({ templateKey, hasText, note }: { templateKey: string; hasText: boolean; note: string }) {
  const textsQuery = useResearchTexts(hasText);
  const texts = textsQuery.data ?? null;
  const failed = textsQuery.isError;
  const [open, setOpen] = useState(false);
  const text = texts?.[templateKey] ?? null;
  return (
    <section>
      <SectionTitle right={<span className="k-mono">{templateKey}</span>}>The template</SectionTitle>
      <div className="k-card overflow-hidden">
        {!hasText ? (
          <EmptyNote>Content generation holds no text for this template.</EmptyNote>
        ) : failed ? (
          <EmptyNote>We could not load the text just now.</EmptyNote>
        ) : !texts ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2, 3].map((i) => (
              <Shimmer key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : text == null ? (
          <EmptyNote>Content generation holds no text for this template.</EmptyNote>
        ) : (
          <>
            <pre className={`k-mono k-fg2 whitespace-pre-wrap break-words p-4 text-[12px] leading-5 ${open ? "" : "max-h-[360px] overflow-hidden"}`}>{text}</pre>
            <div className="k-fg3 flex items-center border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px]">
              <span>{note}</span>
              <button type="button" onClick={() => setOpen((v) => !v)} className="k-btn-ghost ml-auto h-6 px-1.5 text-[12px]">
                {open ? "Show less" : "Show all"}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/** A Templates row's tag: a version listed on its own, outside any dynasty, says so. */
function TemplateRowChip({ t }: { t: ResearchTemplate }) {
  if (!t.standaloneReason) return null;
  return (
    // The name keeps its room; the chip gives way first (its full words on hover).
    <span className="k-chip min-w-0 overflow-hidden" title={STANDALONE_WORDS[t.standaloneReason] ?? t.standaloneReason}>
      <span className="truncate">Not in a dynasty</span>
    </span>
  );
}

/** The words a model row on its own prints for why it is outside any LLM dynasty. */
const MODEL_STANDALONE_WORDS: Record<string, string> = {
  no_dynasty_in_chat_service: "chat-service places this LLM in no dynasty: it is listed on its own.",
  llm_dynasties_unreadable: "chat-service's dynasties could not be read for this build: every LLM is listed on its own.",
};

/** The quiet second line under a model's name: the version its dynasty runs now, or why it stands alone. */
function modelSecondLine(m: ResearchModel): { text: string; title: string } | null {
  const head = modelHeadLabel(m);
  if (head) return { text: head, title: `The version ${m.label} runs now: ${m.dynasty?.headModelId ?? head}` };
  if (m.standaloneReason) return { text: "Not in a dynasty", title: MODEL_STANDALONE_WORDS[m.standaloneReason] ?? m.standaloneReason };
  return null;
}

/**
 * A Models row's name (owner 2026-10-23): the product logo big on the left, as tall as two lines;
 * the dynasty's name (a button to its page), then the version it runs now, quieter, under it.
 */
function ModelNameLines({ m, href }: { m: ResearchModel; href: string }) {
  const second = modelSecondLine(m);
  return (
    <MarkLines mark={(px) => <CatalogueObjectMark kind="llm" name={m.label} size={px} />}>
      <Link href={href} onClick={(e) => e.stopPropagation()} className="min-w-0 truncate text-[13px] font-medium leading-5 hover:text-[var(--accent)]" title={m.label}>
        {m.label}
      </Link>
      {second && (
        <span className="k-fg3 min-w-0 truncate text-[12px] leading-4" title={second.title}>
          {second.text}
        </span>
      )}
    </MarkLines>
  );
}

/** An LLM's last emails: not carried by Engine yet (content generation reads them per channel only), said so in words. */
function ModelOutputs() {
  return <EmptyNote>{LLM_OUTPUTS_NOT_CARRIED}</EmptyNote>;
}

/**
 * The LLMs list's right panel (owner 2026-10-24): the dynasty's figures for this Engine, the scripts that write
 * with it, its last emails (not carried by Engine yet), and its page.
 */
function ModelPanel({
  m,
  href,
  base,
  measure,
  outcome,
  onClose,
}: {
  m: ResearchModel;
  href: string;
  base: string;
  measure: ResearchMeasure;
  outcome: { noun: string; plural: string };
  onClose: () => void;
}) {
  const second = modelSecondLine(m);
  return (
    <ResearchDrawer
      label={m.label}
      onClose={onClose}
      head={
        <div className="flex min-w-0 items-center gap-2.5">
          <CatalogueObjectMark kind="llm" name={m.label} size={36} />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium" title={m.label}>
              {m.label}
            </p>
            {second && (
              <p className="k-fg3 truncate text-[12px]" title={second.title}>
                {second.text}
              </p>
            )}
          </div>
        </div>
      }
      footer={
        <Link href={href} onClick={onClose} className="k-btn inline-flex items-center gap-1.5">
          Open LLM page
          <Arrow />
        </Link>
      }
    >
      <div className="border-b border-[var(--line-subtle)] px-4 py-3">
        <RunCostFigures c={m.runCost} />
        <p className="k-label mt-4">$ / run since it started</p>
        <div className="mt-1.5">
          <RunCostChart c={m.runCost} height={120} />
        </div>
      </div>
      <div className="border-b border-[var(--line-subtle)] px-4 py-3">
        <TemplateFigures f={m} outcome={outcome} more />
      </div>
      <div className="border-b border-[var(--line-subtle)] px-4 py-3">
        <p className="k-label">Scripts</p>
        {m.scripts.length ? (
          <ul className="mt-1.5 space-y-0.5 text-[13px]">
            {m.scripts.map((w) => (
              <li key={w.key}>
                <Link href={researchCatalogHref(base, measure, "scripts", w.key)} onClick={onClose} className="k-hover -mx-2 flex items-center gap-2 rounded-[8px] px-2 py-1" title={w.label}>
                  <CatalogueName kind="workflow" name={w.label} servedKey={w.key} className="flex-1" />
                  <Arrow />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="k-fg3 mt-1.5 text-[12px]">No script writes most of its emails with it.</p>
        )}
      </div>
      <p className="k-label px-4 pt-3">Last 5 emails written</p>
      <ModelOutputs />
    </ResearchDrawer>
  );
}

/**
 * Every version of an LLM dynasty with its own served figures, newest first as features-service
 * serves them (they add up to the page's figures). The head is the version the dynasty runs now; a
 * version chat-service no longer serves reads Retired. A click opens the version's figures in a drawer.
 */
function ModelVersionsTable({ measure, m, versions }: { measure: ResearchMeasure; m: ResearchModel; versions: ResearchModelVersion[] }) {
  const o = useOutcome(measure);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = openKey ? (versions.find((v) => v.key === openKey) ?? null) : null;
  return (
    <section>
      <SectionTitle count={versions.length} right={<span>Newest first; they add up to the figures above</span>}>
        Versions
      </SectionTitle>
      <div className="k-card overflow-hidden">
        <div className="k-scroll relative overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-b border-[var(--line-subtle)]">
                <th className={TH}>Version</th>
                <th className={`${TH} w-28`}>Served</th>
                <th className={`${TH} w-28 text-right`}>Cost {o.unit.replace("/ ", "per ")}</th>
                <th className={`${TH} w-20 text-right`}>Rate</th>
                <th className={`${TH} w-24 text-right`}>{o.plural}</th>
                <th className={`${TH} w-24 text-right`}>Emails</th>
                <th className={`${TH} w-24 text-right`}>Invested</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.key} onClick={() => setOpenKey(v.key)} aria-selected={openKey === v.key} className={`k-row h-10 cursor-pointer ${openKey === v.key ? "k-selected" : ""}`}>
                  <td className="max-w-0 pl-4 pr-3">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <CatalogueName kind="llm" name={v.label} label={v.label} className="min-w-0" />
                      {v.head && <span className="k-chip shrink-0">Head</span>}
                    </span>
                  </td>
                  <td className="px-3">
                    <ServedWord served={v.servedToday} />
                  </td>
                  <td className="whitespace-nowrap px-3 text-right tabular-nums">
                    <Money value={v.cost} unit={o.unit} />
                  </td>
                  <td className="px-3 text-right tabular-nums">
                    <Dash v={v.rate} />
                  </td>
                  <td className="px-3 text-right tabular-nums">{v.outcomes}</td>
                  <td className="px-3 text-right tabular-nums">{v.emails}</td>
                  <td className="pl-3 pr-4 text-right tabular-nums">{v.spend}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {open && (
        <ResearchDrawer
          label={`Version ${open.label}`}
          onClose={() => setOpenKey(null)}
          head={
            <>
              <p className="k-label">Version</p>
              <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium">
                <CatalogueName kind="llm" name={open.label} label={open.label} className="min-w-0" />
                {open.head && <span className="k-chip shrink-0">Head</span>}
              </p>
              <p className="k-fg3 truncate text-[12px]">Version of {m.label}</p>
            </>
          }
          right={<ServedWord served={open.servedToday} />}
        >
          <div className="border-b border-[var(--line-subtle)] px-4 py-3">
            <TemplateFigures f={open} outcome={o} more />
          </div>
          {open.modelIds.length > 0 && (
            <div className="px-4 py-3">
              <p className="k-label">LLM ids</p>
              <p className="k-mono k-fg2 mt-1 break-words text-[12px] leading-5">{open.modelIds.join(", ")}</p>
            </div>
          )}
        </ResearchDrawer>
      )}
    </section>
  );
}

/** Whether chat-service still serves a version: a dot plus its word. */
function ServedWord({ served }: { served: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px]">
      <span className={`h-1.5 w-1.5 rounded-full ${served ? "bg-[var(--run)]" : "bg-[var(--fg-4)]"}`} />
      {served ? "Served" : "Retired"}
    </span>
  );
}

/**
 * Every version of the dynasty with its own served figures, oldest first as features-service
 * serves them (they add up to the page's figures exactly). The head is the version that writes now.
 */
function VersionsTable({
  base,
  measure,
  t,
  versions,
  statuses,
}: {
  base: string;
  measure: ResearchMeasure;
  t: ResearchTemplate;
  versions: ResearchTemplateVersion[];
  statuses: ReturnType<typeof useTemplateStatuses>;
}) {
  const o = useOutcome(measure);
  // A click opens the version in a drawer (owner 2026-10-21); its page is one link away.
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = openKey ? (versions.find((v) => v.key === openKey) ?? null) : null;
  return (
    <section>
      <SectionTitle count={versions.length} right={<span>Oldest first; they add up to the figures above</span>}>
        Versions
      </SectionTitle>
      <div className="k-card overflow-hidden">
        <div className="k-scroll relative overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr className="border-b border-[var(--line-subtle)]">
                <th className={TH}>Version</th>
                <th className={`${TH} w-32`}>Status</th>
                <th className={`${TH} w-28 text-right`}>Cost {o.unit.replace("/ ", "per ")}</th>
                <th className={`${TH} w-20 text-right`}>Rate</th>
                <th className={`${TH} w-24 text-right`}>{o.plural}</th>
                <th className={`${TH} w-24 text-right`}>Emails</th>
                <th className={`${TH} w-24 text-right`}>Invested</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.key} onClick={() => setOpenKey(v.key)} aria-selected={openKey === v.key} className={`k-row h-10 cursor-pointer ${openKey === v.key ? "k-selected" : ""}`}>
                  <td className="max-w-0 pl-4 pr-3">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <CatalogueName kind="template" name={t.label} label={v.label} icon={t.icon ?? null} color={t.color ?? null} className="k-mono text-[12px]" />
                      {v.head && <span className="k-chip shrink-0">Head</span>}
                    </span>
                  </td>
                  <td className="max-w-0 px-3">
                    <ContentStatusWord status={statuses.map.get(v.key) ?? null} pending={!statuses.answered} deprecation={statuses.deprecationOf(v.key)} />
                  </td>
                  <td className="whitespace-nowrap px-3 text-right tabular-nums">
                    <Money value={v.cost} unit={o.unit} />
                  </td>
                  <td className="px-3 text-right tabular-nums">
                    <Dash v={v.rate} />
                  </td>
                  <td className="px-3 text-right tabular-nums">{v.outcomes}</td>
                  <td className="px-3 text-right tabular-nums">{v.emails}</td>
                  <td className="pl-3 pr-4 text-right tabular-nums">{v.spend}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {open && (
        <TemplateVersionDrawer
          version={open}
          dynastyLabel={t.label}
          href={researchTemplateVersionHref(base, measure, t.key, open.key)}
          status={<ContentStatusWord status={statuses.map.get(open.key) ?? null} pending={!statuses.answered} deprecation={statuses.deprecationOf(open.key)} />}
          outcome={o}
          onClose={() => setOpenKey(null)}
        />
      )}
    </section>
  );
}

/**
 * One version of a dynasty on its own page (owner 2026-10-21): what it is a version of, its status,
 * its figures, its months, its text and its last 5 emails.
 */
function TemplateVersionView({ base, measure, t, v, crumbs }: { base: string; measure: ResearchMeasure; t: ResearchTemplate; v: ResearchTemplateVersion; crumbs: Crumb[] }) {
  const o = useOutcome(measure);
  const statuses = useTemplateStatuses();
  const outputs = useTemplateOutputs(v.key, 5);
  const dynastyHref = researchCatalogHref(base, measure, "templates", t.key);
  return (
    <>
      <TopBar crumbs={crumbs} actions={<ResearchSwitches />} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <Header
          topic="template"
          title={v.label}
          icon={t.icon ?? null}
          color={t.color ?? null}
          chips={
            <>
              <span className="k-fg3 text-[12px]">Version of</span>
              <CatalogueName kind="template" variant="chip" name={t.label} href={dynastyHref} icon={t.icon ?? null} color={t.color ?? null} />
              {v.head && <span className="k-chip">Head</span>}
              <ContentStatusWord status={statuses.map.get(v.key) ?? null} pending={!statuses.answered} deprecation={statuses.deprecationOf(v.key)} />
              <span className="k-chip inline-flex items-center gap-1.5">
                <SectionMark section={{ measure }} size={12} />
                <MeasureName measure={measure} />
              </span>
            </>
          }
        />
        <DeprecationNote deprecation={statuses.deprecationOf(v.key)} />
        <KpiStrip f={v} measure={measure} />

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-6">
            <Charts f={v} topic="template" />
            <TemplateText templateKey={v.key} hasText={v.hasText} note={`The text of ${v.label}.`} />
          </div>
          <aside className="k-card flex h-fit min-h-0 flex-col self-start overflow-hidden lg:sticky lg:top-4 lg:max-h-[calc(100vh-120px)]">
            <p className="k-label border-b border-[var(--line-subtle)] px-4 py-3">Last 5 emails</p>
            <div className="k-scroll min-h-0 flex-1 overflow-y-auto">
              <OutputsList read={outputs} />
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

function TemplateView({
  base,
  measure,
  t,
  crumbs,
  nav,
}: {
  base: string;
  measure: ResearchMeasure;
  t: ResearchTemplate;
  crumbs: Crumb[];
  nav: (href: string) => void;
}) {
  const o = useOutcome(measure);
  const statuses = useTemplateStatuses();
  // Why it was deprecated only while the dynasty is (the status its tab reads), never an upgraded head's note.
  const why = templateRowStatus(t, statuses) === "deprecated" ? statuses.deprecationOf(templateContentKey(t)) : null;
  const dynasty = t.dynasty ?? null;
  const versions = t.versions ?? [];
  const identity = identityWord(dynasty?.identity);
  const versionLabel = new Map(versions.map((v) => [v.key, v.label]));
  return (
    <>
      <TopBar crumbs={crumbs} actions={<ResearchSwitches />} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <Header
          topic="template"
          title={t.label}
          icon={t.icon ?? null}
          color={t.color ?? null}
          sub={dynasty?.description ?? null}
          chips={
            <>
              {identity && <span className="k-chip">{identity}</span>}
              {dynasty?.head && (
                <span className="k-chip" title={`The version that writes now: ${dynasty.head.key}`}>
                  Head <span className="k-mono k-fg">{dynasty.head.label}</span>
                </span>
              )}
              {t.standaloneReason && (
                <span className="k-chip" title={STANDALONE_WORDS[t.standaloneReason] ?? t.standaloneReason}>
                  Not in a dynasty
                </span>
              )}
              <span className="k-chip inline-flex items-center gap-1.5">
                <SectionMark section={{ measure }} size={12} />
                <MeasureName measure={measure} />
              </span>
              <span className="k-chip tabular-nums">
                {t.scripts.length} {t.scripts.length === 1 ? "script" : "scripts"}
              </span>
            </>
          }
        />
        <DeprecationNote deprecation={why} />
        <KpiStrip f={t} measure={measure} />

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <Charts f={t} topic="template" />
            {versions.length > 0 && <VersionsTable base={base} measure={measure} t={t} versions={versions} statuses={statuses} />}
            <TemplateText
              templateKey={t.key}
              hasText={t.hasText}
              note={dynasty?.head ? `The text of ${dynasty.head.label}, the version that writes now.` : "The text that wrote these emails."}
            />
            <RunsTable
              title="Last emails written"
              note="Every client, newest first"
              head={
                <>
                  <th className={`${TH} w-44`}>Time</th>
                  <th className={TH}>Script</th>
                  <th className={`${TH} w-20`}>Version</th>
                  {versions.length > 0 && <th className={`${TH} w-24`}>Template</th>}
                  <th className={`${TH} w-36`}>LLM</th>
                  <th className={`${TH} w-36 text-right`}>Tokens</th>
                </>
              }
              rows={t.runs.map((r, i) => (
                <tr key={`${r.when}-${i}`} className="k-row h-10">
                  <td className="k-mono k-fg2 whitespace-nowrap pl-4 pr-3 text-[12px]">{r.when}</td>
                  <td className="max-w-0 px-3">
                    {r.script ? (
                      <CatalogueName kind="workflow" name={r.script.label} href={researchCatalogHref(base, measure, "scripts", r.script.key)} servedKey={r.script.key} />
                    ) : (
                      <span className="k-fg4">{"—"}</span>
                    )}
                  </td>
                  <td className="k-mono k-fg2 px-3 text-[12px]">
                    <Dash v={r.version} />
                  </td>
                  {versions.length > 0 && (
                    <td className="k-mono k-fg2 px-3 text-[12px]" title={r.templateVersion ?? undefined}>
                      <Dash v={r.templateVersion ? (versionLabel.get(r.templateVersion) ?? r.templateVersion) : null} />
                    </td>
                  )}
                  <td className="max-w-0 truncate px-3">
                    <RefLink base={base} measure={measure} kind="llms" r={r.model} className="block truncate" />
                  </td>
                  <td className="k-mono k-fg2 pl-3 pr-4 text-right text-[12px]">
                    <Dash v={r.tokens} />
                  </td>
                </tr>
              ))}
            />
          </div>
          <div className="min-w-0 space-y-4">
            <aside className="k-card h-fit p-4">
              <div className="mb-4 border-b border-[var(--line-subtle)] pb-4">
                <TacticsBlock tactics={t.tactics ?? null} reason={t.tacticsUnavailableReason ?? null} />
              </div>
              <p className="k-label">Details</p>
              <dl className="mt-3 space-y-2.5 text-[13px]">
                <Row
                  k="Engine"
                  v={
                    <span className="inline-flex items-center gap-1.5">
                      <SectionMark section={{ measure }} />
                      <MeasureName measure={measure} />
                    </span>
                  }
                />
                <Row k="Outcome" v={o.noun} />
                <Row k="Dynasty" v={dynasty ? <span className="k-mono k-fg2 text-[12px]">{dynasty.slug}</span> : <span className="k-fg3 text-[12px]">Not in a dynasty</span>} />
                {versions.length > 0 && <Row k="Versions" v={<span className="tabular-nums">{versions.length}</span>} />}
                <Row k="Invested" v={t.spend} />
                <Row k="Sample" v={<span className="k-fg2 text-[12px]">{t.sample}</span>} />
              </dl>
              <MeasuredNote />
            </aside>
            <div className="k-card p-4">
              <p className="k-label">Scripts that write with it</p>
              {t.scripts.length ? (
                <ul className="mt-2 space-y-1 text-[13px]">
                  {t.scripts.map((w) => (
                    <li key={w.key}>
                      <Link href={researchCatalogHref(base, measure, "scripts", w.key)} className="k-hover -mx-2 flex items-center gap-2 rounded-[8px] px-2 py-1.5">
                        <CatalogueName kind="workflow" name={w.label} servedKey={w.key} className="flex-1" />
                        <Arrow />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="k-fg3 mt-2 text-[12px] leading-5">No script wrote most of its emails with it; it was a secondary template.</p>
              )}
              <button type="button" onClick={() => nav(researchCatalogHref(base, measure, "templates"))} className="k-btn mt-4">
                Every template
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function ModelView({
  base,
  measure,
  m,
  crumbs,
  nav,
}: {
  base: string;
  measure: ResearchMeasure;
  m: ResearchModel;
  crumbs: Crumb[];
  nav: (href: string) => void;
}) {
  const o = useOutcome(measure);
  const modelStatuses = useModelStatuses();
  const aliases = modelAliasesOf(m).aliases;
  const why = modelStatuses.deprecationOf(aliases);
  const versions = m.models ?? [];
  const second = modelSecondLine(m);
  return (
    <>
      <TopBar crumbs={crumbs} actions={<ResearchSwitches />} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <Header
          topic="llm"
          title={m.label}
          sub={second?.text ?? null}
          chips={
            <>
              <span className="k-chip inline-flex items-center gap-1.5">
                <SectionMark section={{ measure }} size={12} />
                <MeasureName measure={measure} />
              </span>
              <span className="k-chip tabular-nums">
                {m.scripts.length} {m.scripts.length === 1 ? "script" : "scripts"}
              </span>
            </>
          }
        />
        <DeprecationNote deprecation={why} />
        <KpiStrip f={m} measure={measure} />

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <section>
              <SectionTitle right={<span>Every client, script and template of this Engine</span>}>Cost per run</SectionTitle>
              <div className="k-card px-4 pb-3 pt-3">
                <RunCostFigures c={m.runCost} />
                <div className="mt-4">
                  <RunCostChart c={m.runCost} height={180} />
                </div>
              </div>
            </section>
            <Charts f={m} topic="llm" />
            {versions.length > 0 && <ModelVersionsTable measure={measure} m={m} versions={versions} />}
            <section>
              <SectionTitle right={<span>Every client and template, newest first</span>}>Last 5 emails written</SectionTitle>
              <div className="k-card overflow-hidden">
                <ModelOutputs />
              </div>
            </section>
            <RunsTable
              title="Last emails written"
              note="Every client, newest first"
              head={
                <>
                  <th className={`${TH} w-44`}>Time</th>
                  <th className={TH}>Script</th>
                  <th className={`${TH} w-40`}>Template</th>
                  <th className={`${TH} w-20`}>Version</th>
                  <th className={`${TH} w-36 text-right`}>Tokens</th>
                </>
              }
              rows={m.runs.map((r, i) => (
                <tr key={`${r.when}-${i}`} className="k-row h-10">
                  <td className="k-mono k-fg2 whitespace-nowrap pl-4 pr-3 text-[12px]">{r.when}</td>
                  <td className="max-w-0 px-3">
                    {r.script ? (
                      <CatalogueName kind="workflow" name={r.script.label} href={researchCatalogHref(base, measure, "scripts", r.script.key)} servedKey={r.script.key} />
                    ) : (
                      <span className="k-fg4">{"—"}</span>
                    )}
                  </td>
                  <td className="max-w-0 px-3">
                    <RefLink base={base} measure={measure} kind="templates" r={r.template} className="block truncate" />
                  </td>
                  <td className="k-mono k-fg2 px-3 text-[12px]">
                    <Dash v={r.version} />
                  </td>
                  <td className="k-mono k-fg2 pl-3 pr-4 text-right text-[12px]">
                    <Dash v={r.tokens} />
                  </td>
                </tr>
              ))}
            />
          </div>
          <div className="min-w-0 space-y-4">
            <aside className="k-card h-fit p-4">
              <p className="k-label">Details</p>
              <dl className="mt-3 space-y-2.5 text-[13px]">
                <Row
                  k="Engine"
                  v={
                    <span className="inline-flex items-center gap-1.5">
                      <SectionMark section={{ measure }} />
                      <MeasureName measure={measure} />
                    </span>
                  }
                />
                <Row k="Outcome" v={o.noun} />
                <Row k="Dynasty" v={m.dynasty ? <span className="k-mono k-fg2 text-[12px]">{m.dynasty.slug}</span> : <span className="k-fg3 text-[12px]">Not in a dynasty</span>} />
                {versions.length > 0 && <Row k="Versions" v={<span className="tabular-nums">{versions.length}</span>} />}
                <Row k="Invested" v={m.spend} />
                <Row k="Sample" v={<span className="k-fg2 text-[12px]">{m.sample}</span>} />
              </dl>
              <MeasuredNote />
            </aside>
            <div className="k-card p-4">
              <p className="k-label">Scripts that write with it</p>
              {m.scripts.length ? (
                <ul className="mt-2 space-y-1 text-[13px]">
                  {m.scripts.map((w) => (
                    <li key={w.key}>
                      <Link href={researchCatalogHref(base, measure, "scripts", w.key)} className="k-hover -mx-2 flex items-center gap-2 rounded-[8px] px-2 py-1.5">
                        <CatalogueName kind="workflow" name={w.label} servedKey={w.key} className="flex-1" />
                        <Arrow />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="k-fg3 mt-2 text-[12px] leading-5">No script wrote most of its emails with it; it ran as a secondary LLM.</p>
              )}
              <button type="button" onClick={() => nav(researchCatalogHref(base, measure, "llms"))} className="k-btn mt-4">
                Every LLM
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
