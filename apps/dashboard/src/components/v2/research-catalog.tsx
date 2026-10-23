"use client";

import { HubChip, HubChips } from "@/components/v2/hub-section";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EmptyNote, MarkLines, SectionTitle, Shimmer, TopBar, type Crumb } from "@/components/v2/ui";
import { ResearchSwitches } from "@/components/v2/maturity-view-switch";
import { RoiLabel, RoiValue } from "@/components/v2/roi-label";
import { opensDrawer, ResearchLiveWorkflows, usePipeChannelName, usePipeWorkflowRows, useResearchPipeLeg } from "@/components/v2/research-live-workflows";
import { TacticTags, TacticsBlock } from "@/components/v2/tactic-tags";
import { shortWorkflowName } from "@/lib/live-workflow-rows";
import {
  ACTIVATE_CONTENT_NOTE,
  DEPRECATE_CONTENT_NOTE,
  contentNote,
  DeprecationNote,
  StatusMenu,
  StatusWord as ContentStatusWord,
  useContentPipe,
  useContentStatusWrites,
  useDynastyStatuses,
  useModelStatuses,
  useTemplateStatuses,
  useWorkflowDeprecation,
} from "@/components/v2/research-status";
import { OutputsList, RecentRuns, ResearchDrawer, TemplateFigures, TemplateOutputsPanel, TemplateVersionDrawer, useTemplateOutputs } from "@/components/v2/research-template-outputs";
import { modelAliasesOf, modelsByTab, modelStatus, type ContentTarget } from "@/lib/research/content-status";
import { CatalogueName, CatalogueObjectMark } from "@/components/v2/catalogue-name";
import { usePipeChannel, useResearch, useResearchCatalog, useResearchTexts } from "@/lib/research/research-source";
import {
  Arrow,
  MonthsRow,
  Row,
  STANDALONE_WORDS,
  SectionMark,
  SectionName,
  topicLook,
  dayText,
  identityWord,
  liveText,
} from "@/components/v2/research-bits";
import {
  CATALOG_KINDS,
  RESEARCH_TABS,
  researchCatalogHref,
  modelHeadLabel,
  researchModel,
  researchTemplateOf,
  researchTemplateVersion,
  researchTemplateVersionHref,
  researchWorkflow,
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
  type ResearchPipe,
  type ResearchFigures,
  type ResearchTemplate,
  type ResearchTemplateVersion,
  type ResearchWorkflow,
  researchRoiOf,
  outcomeUnitOf,
  pipeCatalog,
} from "@/lib/research/research";

/**
 * Research's workflow and template pages: for one pipe, every workflow (or template) that sent
 * its emails, all clients pooled, and one page per workflow and per template. Laid out like v2's
 * Workflows list and workflow page, with the Global column only: the research is fleet-wide.
 *
 * Every figure, label and date arrives written in features-service's live catalogue; this
 * file lays them out and never divides, ranks or formats a number. The catalogue and the
 * template texts are read from the staff-only Research route (research-source.tsx).
 */

const TH = "k-label px-3 py-2.5 text-left font-medium first:pl-4 last:pr-4";
const KIND_WORD: Record<CatalogKind, { one: string; many: string; title: string }> = {
  workflows: { one: "workflow", many: "workflows", title: "Workflows" },
  templates: { one: "template", many: "templates", title: "Templates" },
  models: { one: "model", many: "models", title: "Models" },
};
/** A pipe's tab names: the catalogue kinds, then Performance. */
const TAB_TITLE: Record<ResearchTabKind, string> = { workflows: "Workflows", templates: "Templates", models: "Models", performance: "Performance" };
/** Performance has no study topic of its own: it wears the conversion colour (what it measures). */
const PERFORMANCE_COLOR = "var(--data-teal)";

/**
 * The tabs across a pipe's pages (Workflows, Templates, Models, Performance). Each states its own
 * page's length when that page has answered, never another read's count.
 */
export function PipeTabs({ base, pipe, current, countOf }: { base: string; pipe: ResearchPipe; current: ResearchTabKind; countOf: (k: ResearchTabKind) => number | null }) {
  return (
    <div className="mt-5 flex gap-5 border-b border-[var(--line-subtle)]">
      {RESEARCH_TABS.map((k) => (
        <Link key={k} href={researchCatalogHref(base, pipe, k)} aria-current={k === current ? "page" : undefined} className="k-tab inline-flex items-center gap-1.5 text-[13px]">
          {TAB_TITLE[k]}
          {countOf(k) != null && <span className="k-fg3 tabular-nums">{countOf(k)}</span>}
        </Link>
      ))}
    </div>
  );
}

/** Each kind wears its study topic's mark and colour. */
const KIND_TOPIC: Record<CatalogKind, "workflow" | "template" | "llm"> = { workflows: "workflow", templates: "template", models: "llm" };

/** A model, template or workflow named the shared way (mark + name, a template's version after it), a link when its page exists in this pipe. */
function RefLink({ base, pipe, kind, r, className = "" }: { base: string; pipe: ResearchPipe; kind: CatalogKind; r: ResearchRef | null; className?: string }) {
  if (!r) return <span className="k-fg4">{"—"}</span>;
  return (
    <CatalogueName
      kind={KIND_TOPIC[kind]}
      name={r.label}
      href={r.linked ? researchCatalogHref(base, pipe, kind, r.key) : null}
      version={r.version?.label ?? null}
      servedKey={kind === "models" ? null : r.key}
      className={className.replace(/\b(block|truncate)\b/g, "").trim()}
    />
  );
}

/** A workflow row is named by its own name (its model and template have their own columns); the rest by their label. */
function rowName(kind: CatalogKind, r: ResearchWorkflow | ResearchTemplate | ResearchModel, channelName: string | null): string {
  return kind === "workflows" ? shortWorkflowName((r as ResearchWorkflow).name ?? r.label, channelName) : r.label;
}

function useOutcome(pipe: ResearchPipe): { noun: string; plural: string; unit: string } {
  const outcome = useResearch().file.pipes.find((c) => c.id === pipe)?.outcome ?? "Outcome";
  const plural = /[^aeiou]y$/i.test(outcome) ? `${outcome.slice(0, -1)}ies` : `${outcome}s`;
  return { noun: outcome, plural, unit: outcomeUnitOf(outcome) };
}

/**
 * How many of a pipe's workflows, templates and models are ACTIVE (owner 2026-10-23: « le total doit
 * être le nombre d'actifs, on ne compte pas les deprecated », for all three). Workflows read the live
 * ranking's rows at the pipe's leg (else the catalogue's own list, which states no status); each kind
 * is null until its statuses answer, so no count flashes the wrong number.
 */
function useActiveCatalogCounts(pipe: ResearchPipe, catalog: ResearchCatalog | null): Record<CatalogKind, number | null> {
  const liveLeg = useResearchPipeLeg(pipe);
  const channel = usePipeChannel(pipe);
  const liveRows = usePipeWorkflowRows(channel, liveLeg);
  const dynasties = useDynastyStatuses(channel);
  const templateStatuses = useTemplateStatuses();
  // A model's status is the one on THIS pipe (LLM-STATUS-PER-PIPE-1023).
  const modelStatuses = useModelStatuses(useContentPipe(pipe));
  const workflows =
    liveLeg != null
      ? liveRows.rankingQ.data !== undefined && dynasties.answered
        ? liveRows.rows.filter((r) => dynasties.statusOf(r.slug) !== "deprecated").length
        : null
      : (catalog ? pipeCatalog(catalog, pipe).workflows.length : null);
  const templates = catalog ? (templatesByTab(pipeCatalog(catalog, pipe).templates, templateStatuses)?.active.length ?? null) : null;
  const models = catalog ? (modelsByTab(pipeCatalog(catalog, pipe).models, modelStatuses)?.active.length ?? null) : null;
  return { workflows, templates, models };
}

/**
 * The hub's links from a pipe's section to its workflow, template and model pages, each with its active
 * count, and Performance. Every served pipe gets all four (WA-PIPE-RESEARCH-1023): a page with nothing
 * measured yet opens on its Learning state, never hidden.
 */
export function PipeCatalogLinks({ base, pipe }: { base: string; pipe: ResearchPipe }) {
  const catalog = useResearchCatalog(useResearch().basis).data ?? null;
  const active = useActiveCatalogCounts(pipe, catalog);
  return (
    <HubChips>
      {CATALOG_KINDS.map((kind) => (
        <HubChip key={kind} href={researchCatalogHref(base, pipe, kind)} color={topicLook(KIND_TOPIC[kind]).color} label={KIND_WORD[kind].title} count={active[kind]} />
      ))}
      <HubChip href={researchCatalogHref(base, pipe, "performance")} color={PERFORMANCE_COLOR} label={TAB_TITLE.performance} />
    </HubChips>
  );
}

// ─── The view ──────────────────────────────────────────────────────────────

export function V2ResearchCatalogView({
  base,
  pipe,
  kind,
  itemKey,
  versionKey = null,
  nav,
}: {
  base: string;
  pipe: ResearchPipe;
  kind: CatalogKind;
  itemKey: string | null;
  /** A template version's own page (`templates/<dynasty>/<version>`). */
  versionKey?: string | null;
  nav: (href: string) => void;
}) {
  const catalogQuery = useResearchCatalog(useResearch().basis);
  const catalog = catalogQuery.data ?? null;
  const failed = catalogQuery.isError;
  const listHref = researchCatalogHref(base, pipe, kind);
  const crumbs = [
    { label: "Research", href: base },
    { label: <SectionName section={{ pipe }} /> },
    itemKey ? { label: KIND_WORD[kind].title, href: listHref } : { label: KIND_WORD[kind].title },
  ];
  const liveLeg = useResearchPipeLeg(pipe);
  const channelName = usePipeChannelName(pipe);
  // The live workflow list needs nothing from the Research file to paint: it renders at once.
  if (!catalog && !itemKey && kind === "workflows" && liveLeg != null) {
    return <CatalogList base={base} pipe={pipe} kind={kind} catalog={null} crumbs={crumbs} nav={nav} />;
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
  if (!itemKey) return <CatalogList base={base} pipe={pipe} kind={kind} catalog={catalog} crumbs={crumbs} nav={nav} />;
  const item =
    kind === "workflows"
      ? researchWorkflow(catalog, pipe, itemKey)
      : kind === "templates"
        ? researchTemplateOf(catalog, pipe, itemKey)
        : researchModel(catalog, pipe, itemKey);
  if (!item) {
    return (
      <>
        <TopBar crumbs={[...crumbs, { label: "Not found" }]} actions={<ResearchSwitches />} />
        <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
          <div className="k-card">
            <EmptyNote>
              This {KIND_WORD[kind].one} is not in this pipe&apos;s research.{" "}
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
    const dynastyHref = researchCatalogHref(base, pipe, "templates", t.key);
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
    return <TemplateVersionView base={base} pipe={pipe} t={t} v={version} crumbs={versionCrumbs} />;
  }
  const itemCrumbs = [...crumbs, { label: rowName(kind, item, channelName) }];
  if (kind === "workflows") return <WorkflowView base={base} pipe={pipe} w={item as ResearchWorkflow} crumbs={itemCrumbs} nav={nav} />;
  if (kind === "templates") return <TemplateView base={base} pipe={pipe} t={item as ResearchTemplate} crumbs={itemCrumbs} nav={nav} />;
  return <ModelView base={base} pipe={pipe} m={item as ResearchModel} crumbs={itemCrumbs} nav={nav} />;
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

// ─── A pipe's list ─────────────────────────────────────────────────────────

function CatalogList({
  base,
  pipe,
  kind,
  catalog,
  crumbs,
  nav,
}: {
  base: string;
  pipe: ResearchPipe;
  kind: CatalogKind;
  catalog: ResearchCatalog | null;
  crumbs: Crumb[];
  nav: (href: string) => void;
}) {
  const o = useOutcome(pipe);
  const channelName = usePipeChannelName(pipe);
  const RESEARCH = useResearch().file;
  const rows: (ResearchWorkflow | ResearchTemplate | ResearchModel)[] = catalog ? pipeCatalog(catalog, pipe)[kind] : [];
  const words = KIND_WORD[kind];
  const priced = rows.filter((r) => r.rank != null).length;
  const other = CATALOG_KINDS[(CATALOG_KINDS.indexOf(kind) + 1) % CATALOG_KINDS.length];
  // Workflows are read LIVE off the producer's ranking at the pipe's leg; the catalogue table
  // stays for templates, models, and a pipe whose step starts no entry leg.
  const liveLeg = useResearchPipeLeg(pipe);
  const live = kind === "workflows" && liveLeg != null;
  // Every count on the page is the ACTIVE count, deprecated never counted (owner 2026-10-23).
  const active = useActiveCatalogCounts(pipe, catalog);
  const countOf = (k: CatalogKind): number | null => active[k];
  // Staff status (TEMPLATE-MODEL-STATUS-1019): templates by type, models by every alias chat-service serves them under (served on the row).
  const templateStatuses = useTemplateStatuses();
  // Models: the status on THIS pipe, set on this pipe only (LLM-STATUS-PER-PIPE-1023, owner 2026-10-23).
  const contentPipe = useContentPipe(pipe);
  const modelStatuses = useModelStatuses(contentPipe);
  const writes = useContentStatusWrites();
  // Templates and models sit in two tabs, Active and Deprecated (owner 2026-10-21, models 2026-10-23),
  // the tab in the URL. No row shows before the statuses answer, so none flashes in a tab it then leaves.
  const search = useSearchParams();
  const tab = templateTab(search?.get("status"));
  const tabbed = kind === "templates" || kind === "models";
  const statusFailed = kind === "templates" ? templateStatuses.failed : kind === "models" ? modelStatuses.failed : false;
  const byTab: Record<TemplateTab, (ResearchTemplate | ResearchModel)[]> | null =
    !tabbed || statusFailed
      ? null
      : kind === "templates"
        ? templatesByTab(rows as ResearchTemplate[], templateStatuses)
        : modelsByTab(rows as ResearchModel[], modelStatuses);
  const statusPending = tabbed && !statusFailed && !byTab;
  // Templates and models render in the served order: features-service ranks them in the ONE leg order the
  // pipe picks them by, so row 1 is the one it writes with next. Never re-sorted here (owner 2026-10-23).
  const shown: (ResearchWorkflow | ResearchTemplate | ResearchModel)[] = tabbed ? (byTab?.[tab] ?? []) : rows;
  const pickTab = (next: TemplateTab) => {
    // The history API, null state: Next keeps useSearchParams in step (apps/dashboard CLAUDE.md).
    window.history.replaceState(null, "", next === "active" ? window.location.pathname : `${window.location.pathname}?status=${next}`);
  };
  // A Templates row opens its detail in the right drawer (owner 2026-10-23); its name opens its page.
  const [selected, setSelected] = useState<string | null>(null);
  const selectedTemplate = kind === "templates" ? ((shown as ResearchTemplate[]).find((r) => r.key === selected) ?? null) : null;
  return (
    <>
      <TopBar crumbs={crumbs} actions={<ResearchSwitches />} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">
              {live ? "Workflows on this pipe, ranked live" : `${rows.length} ${rows.length === 1 ? words.one : words.many}, ${priced} with a ${o.noun.toLowerCase()}`}
            </h1>
            <p className="k-fg2 mt-1 text-[14px]">
              {live ? (
                <>Every workflow on this pipe, all clients pooled, best ROI first.</>
              ) : (
                <>
                  Every {words.one} that wrote this pipe&apos;s emails, all clients pooled, the cheapest {o.noun.toLowerCase()} first.{" "}
                  {kind === "templates" ? "Click a row for its workflows, models and last emails; its name opens its page." : "Open one for its months and its last runs."}
                </>
              )}
            </p>
          </div>
          {!live && (
            <span className="k-fg2 inline-flex items-center gap-2 text-[13px]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--run)]" />
              {liveText(RESEARCH)}
            </span>
          )}
        </div>

        <PipeTabs base={base} pipe={pipe} current={kind} countOf={(k) => (k === "performance" ? null : countOf(k))} />

        <section className="mt-6">
          <SectionTitle
            count={countOf(kind)}
            right={
              <span className="inline-flex items-center gap-1.5">
                <SectionMark section={{ pipe }} size={14} />
                <SectionName section={{ pipe }} />
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
            <ResearchLiveWorkflows base={base} pipe={pipe} legKey={liveLeg} catalog={catalog} outcomeUnit={o.unit} nav={nav} />
          ) : (
            <div>
              <div className="k-card min-w-0 overflow-hidden">
                <div className="k-scroll relative overflow-x-auto">
                  <table className={`w-full ${kind === "workflows" ? "min-w-[1180px]" : kind === "templates" ? "min-w-[1100px]" : "min-w-[940px]"} text-[13px]`}>
                    <thead>
                      <tr className="border-b border-[var(--line-subtle)]">
                        <th className={TH}>{words.title.slice(0, -1)}</th>
                        {kind === "workflows" && (
                          <>
                            <th className={`${TH} w-40`}>LLM</th>
                            <th className={`${TH} w-40`}>Template</th>
                          </>
                        )}
                        {kind === "templates" && (
                          <>
                            {/* Owner 2026-10-23: Template, Tactics (where Workflows has it), ROI, % Conversion, $ / outcome, # outcomes, $ Spent, Status. */}
                            <th className={`${TH} w-48`}>Tactics</th>
                            <th className={`${TH} w-24 text-right`}>
                              <RoiLabel />
                            </th>
                            <th className={`${TH} w-28 text-right`}>% Conversion</th>
                            <th className={`${TH} w-28 text-right`}>{`$ ${o.unit}`}</th>
                            <th className={`${TH} w-28 text-right`}>{`# ${o.plural}`}</th>
                            <th className={`${TH} w-24 text-right`}>$ Spent</th>
                            <th className={`${TH} w-28`}>Status</th>
                          </>
                        )}
                        {kind === "models" ? (
                          <>
                            {/* Owner 2026-10-23: Model, ROI, $ / outcome, % Conversion, # outcomes, $ Spent, Status. */}
                            <th className={`${TH} w-24 text-right`}>
                              <RoiLabel />
                            </th>
                            <th className={`${TH} w-36 text-right`}>{`$ ${o.unit}`}</th>
                            <th className={`${TH} w-28 text-right`}>% Conversion</th>
                            <th className={`${TH} w-32 text-right`}>{`# ${o.plural}`}</th>
                            <th className={`${TH} w-28 text-right`}>$ Spent</th>
                            <th className={`${TH} w-56`}>Status</th>
                          </>
                        ) : kind === "workflows" ? (
                          <>
                            <th className={`${TH} w-36 text-right`}>Cost {o.unit.replace("/ ", "per ")}</th>
                            <th className={`${TH} w-28 text-right`}>Rate</th>
                            <th className={`${TH} w-28 text-right`}>{o.plural}</th>
                            <th className={`${TH} w-28 text-right`}>Emails</th>
                            <th className={`${TH} w-28 text-right`}>Invested</th>
                          </>
                        ) : null}
                        <th className={`${TH} w-10`} aria-label={kind === "workflows" ? "Open" : "Status menu"} />
                      </tr>
                    </thead>
                    <tbody>
                      {statusPending ? (
                        [0, 1, 2, 3, 4].map((i) => (
                          <tr key={i} className="k-row h-10">
                            <td colSpan={10} className="px-4">
                              <Shimmer className="h-4 w-full" />
                            </td>
                          </tr>
                        ))
                      ) : statusFailed ? (
                        <tr>
                          <td colSpan={10}>
                            <EmptyNote>We could not read which {words.many} are active just now. It retries on its own.</EmptyNote>
                          </td>
                        </tr>
                      ) : shown.length === 0 ? (
                        <tr>
                          <td colSpan={10}>
                            <EmptyNote>
                              {rows.length === 0
                                ? `No ${words.one} has written this pipe's emails yet.`
                                : tab === "active"
                                  ? `No ${words.one} on this pipe is active.`
                                  : `No ${words.one} on this pipe is deprecated.`}
                            </EmptyNote>
                          </td>
                        </tr>
                      ) : (
                        shown.map((r) => {
                          const href = researchCatalogHref(base, pipe, kind, r.key);
                          const picked = kind === "templates" && selectedTemplate?.key === r.key;
                          const served = kind === "models" ? modelAliasesOf(r as ResearchModel) : { aliases: [], gap: null };
                          const modelKeys = served.aliases;
                          const target: ContentTarget | null =
                            kind === "templates"
                              ? { kind: "template", key: templateContentKey(r as ResearchTemplate), label: r.label }
                              : modelKeys.length && contentPipe
                                ? { kind: "model", aliases: modelKeys, label: r.label, pipe: contentPipe }
                                : null;
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
                              onClick={(e) => (kind === "templates" ? opensDrawer(e.target, e.currentTarget) && setSelected(r.key) : nav(href))}
                              aria-selected={kind === "templates" ? picked : undefined}
                              className={`k-row group h-10 cursor-pointer ${picked ? "k-selected" : ""}`}
                            >
                              <td className={`max-w-0 pl-4 pr-3 ${kind === "models" ? "py-1.5" : ""}`}>
                                {kind === "models" ? (
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
                                        label={rowName(kind, r, channelName)}
                                        icon={(r as ResearchTemplate).icon ?? null}
                                        color={(r as ResearchTemplate).color ?? null}
                                        className="font-medium"
                                      />
                                    </Link>
                                  ) : (
                                    <CatalogueName
                                      kind={KIND_TOPIC[kind]}
                                      name={r.label}
                                      label={rowName(kind, r, channelName)}
                                      href={href}
                                      icon={(r as ResearchWorkflow).icon ?? null}
                                      color={(r as ResearchWorkflow).color ?? null}
                                      className="font-medium"
                                    />
                                  )}
                                  {kind === "templates" && <TemplateRowChip t={r as ResearchTemplate} />}
                                </span>
                                )}
                              </td>
                              {kind === "workflows" && (
                                <>
                                  {/* Each cell opens that model's or template's own page; the rest of the row opens the workflow. */}
                                  <td className="max-w-0 px-3" onClick={(e) => e.stopPropagation()}>
                                    <RefLink base={base} pipe={pipe} kind="models" r={(r as ResearchWorkflow).model} className="block min-w-0 truncate" />
                                  </td>
                                  <td className="max-w-0 px-3" onClick={(e) => e.stopPropagation()}>
                                    <RefLink base={base} pipe={pipe} kind="templates" r={(r as ResearchWorkflow).template} className="block min-w-0 truncate" />
                                  </td>
                                </>
                              )}
                              {kind === "templates" && (
                                <>
                                  <td className="max-w-0 px-3 py-2">
                                    <TacticTags tactics={(r as ResearchTemplate).tactics ?? null} reason={(r as ResearchTemplate).tacticsUnavailableReason ?? null} />
                                  </td>
                                  <td className="whitespace-nowrap px-3 text-right tabular-nums">
                                    <TemplateRoi t={r as ResearchTemplate} />
                                  </td>
                                  <td className="px-3 text-right tabular-nums">
                                    <Dash v={r.rate} />
                                  </td>
                                  <td className="whitespace-nowrap px-3 text-right tabular-nums">
                                    <Dash v={r.cost} />
                                  </td>
                                  <td className="px-3 text-right tabular-nums">{r.outcomes}</td>
                                  <td className="whitespace-nowrap px-3 text-right tabular-nums">{r.spend}</td>
                                  <td className="max-w-0 px-3">
                                    <ContentStatusWord status={status} pending={!statusAnswered} deprecation={deprecation} />
                                  </td>
                                </>
                              )}
                              {kind === "models" ? (
                                <>
                                  <td className="whitespace-nowrap px-3 text-right tabular-nums">
                                    <RowRoi f={r} />
                                  </td>
                                  <td className="whitespace-nowrap px-3 text-right tabular-nums">
                                    <Dash v={r.cost} />
                                  </td>
                                  <td className="px-3 text-right tabular-nums">
                                    <Dash v={r.rate} />
                                  </td>
                                  <td className="px-3 text-right tabular-nums">{r.outcomes}</td>
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
                              ) : kind === "workflows" ? (
                                <>
                                  <td className="whitespace-nowrap px-3 text-right tabular-nums">
                                    <Money value={r.cost} unit={o.unit} />
                                  </td>
                                  <td className="px-3 text-right tabular-nums">
                                    <Dash v={r.rate} />
                                  </td>
                                  <td className="px-3 text-right tabular-nums">{r.outcomes}</td>
                                  <td className="px-3 text-right tabular-nums">{r.emails}</td>
                                  <td className="px-3 text-right tabular-nums">{r.spend}</td>
                                </>
                              ) : null}
                              <td className="pl-1 pr-4 text-right">
                                {kind === "workflows" ? (
                                  <span className="k-btn-ghost inline-flex h-6 w-6 justify-center px-0 opacity-0 group-hover:opacity-100">
                                    <Chevron />
                                  </span>
                                ) : target ? (
                                  <StatusMenu
                                    status={status}
                                    label={r.label}
                                    onDeprecate={() => writes.askDeprecate(target)}
                                    onActivate={() => writes.activate(target)}
                                    deprecateNote={contentNote(target, DEPRECATE_CONTENT_NOTE)}
                                    activateNote={contentNote(target, ACTIVATE_CONTENT_NOTE)}
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
                    {kind === "workflows"
                      ? `${priced} of ${rows.length} priced per ${o.noun.toLowerCase()}; the rest have not earned one yet and are listed by volume.`
                      : `${priced} of ${rows.length} priced per ${o.noun.toLowerCase()}. Listed in the order the pipe picks them, so row 1 goes next.`}
                  </span>
                  <Link href={researchCatalogHref(base, pipe, other)} className="k-btn-ghost ml-auto h-6 shrink-0 whitespace-nowrap px-1.5 text-[12px]">
                    See the {KIND_WORD[other].many}
                  </Link>
                </div>
              </div>
              {selectedTemplate && (
                <TemplateOutputsPanel
                  t={selectedTemplate}
                  href={researchCatalogHref(base, pipe, "templates", selectedTemplate.key)}
                  base={base}
                  pipe={pipe}
                  catalog={catalog}
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
  topic: "workflow" | "template" | "llm";
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
      <CatalogueObjectMark kind={topic} name={title} icon={icon} color={color} size={40} />
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

function KpiStrip({ f, pipe }: { f: ResearchFigures; pipe: ResearchPipe }) {
  const o = useOutcome(pipe);
  // ROI only once features-service serves it on the row: no tile otherwise.
  const roi = researchRoiOf(f);
  return (
    <div className={`k-card mt-5 grid grid-cols-2 divide-[var(--line-subtle)] md:divide-x ${roi != null ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
      {roi != null && <Kpi label={<RoiLabel />} value={"show" in roi ? <RoiValue roi={roi.show} /> : roi.text} />}
      <Kpi label={`Cost / ${o.noun.toLowerCase()}`} value={<Dash v={f.cost} />} />
      <Kpi label="Rate" value={<Dash v={f.rate} />} />
      <Kpi label={o.plural} value={f.outcomes} />
      <Kpi label="Emails" value={f.emails} />
    </div>
  );
}

/** A template row's served return, as its page's ROI tile prints it; `—` when none is served. */
function TemplateRoi({ t }: { t: ResearchTemplate }) {
  return <RowRoi f={t} />;
}

/** A catalogue row's served return (template, model), as its page's ROI tile prints it; `—` when none is served. */
function RowRoi({ f }: { f: ResearchFigures }) {
  const roi = researchRoiOf(f);
  if (roi == null) return <Dash v={null} />;
  return "show" in roi ? <RoiValue roi={roi.show} /> : <>{roi.text}</>;
}

function Charts({ f, topic }: { f: ResearchFigures; topic: "workflow" | "template" | "llm" }) {
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

function WorkflowView({
  base,
  pipe,
  w,
  crumbs,
  nav,
}: {
  base: string;
  pipe: ResearchPipe;
  w: ResearchWorkflow;
  crumbs: Crumb[];
  nav: (href: string) => void;
}) {
  const o = useOutcome(pipe);
  const channelName = usePipeChannelName(pipe);
  const tplHref = w.template?.linked ? researchCatalogHref(base, pipe, "templates", w.template.key) : null;
  const why = useWorkflowDeprecation(w.key);
  return (
    <>
      <TopBar crumbs={crumbs} actions={<ResearchSwitches />} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <Header
          topic="workflow"
          title={shortWorkflowName(w.name ?? w.label, channelName)}
          icon={w.icon ?? null}
          color={w.color ?? null}
          chips={
            <>
              <span className="k-chip inline-flex items-center gap-1.5">
                <SectionMark section={{ pipe }} size={12} />
                <SectionName section={{ pipe }} />
              </span>
              {w.model && <CatalogueName kind="llm" variant="chip" name={w.model.label} href={w.model.linked ? researchCatalogHref(base, pipe, "models", w.model.key) : null} />}
              {w.template && <CatalogueName kind="template" variant="chip" name={w.template.label} href={tplHref} version={w.template.version?.label ?? null} servedKey={w.template.key} />}
            </>
          }
        />
        <DeprecationNote deprecation={why.deprecation} />
        <KpiStrip f={w} pipe={pipe} />

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <Charts f={w} topic="workflow" />
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
                k="Pipe"
                v={
                  <span className="inline-flex items-center gap-1.5">
                    <SectionMark section={{ pipe }} />
                    <SectionName section={{ pipe }} />
                  </span>
                }
              />
              <Row k="Outcome" v={o.noun} />
              <Row k="Model" v={w.model ? <RefLink base={base} pipe={pipe} kind="models" r={w.model} className={w.model.linked ? "text-[var(--accent)]" : ""} /> : null} />
              <Row
                k="Template"
                v={
                  w.template ? <RefLink base={base} pipe={pipe} kind="templates" r={w.template} className={tplHref ? "text-[var(--accent)]" : ""} /> : null
                }
              />
              <Row k="Invested" v={w.spend} />
              <Row k="Sample" v={<span className="k-fg2 text-[12px]">{w.sample}</span>} />
            </dl>
            <MeasuredNote />
            <button type="button" onClick={() => nav(researchCatalogHref(base, pipe, "workflows"))} className="k-btn mt-4">
              Every workflow
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
  no_dynasty_in_chat_service: "chat-service places this model in no dynasty: it is listed on its own.",
  llm_dynasties_unreadable: "chat-service's dynasties could not be read for this build: every model is listed on its own.",
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

/**
 * Every version of an LLM dynasty with its own served figures, newest first as features-service
 * serves them (they add up to the page's figures). The head is the version the dynasty runs now; a
 * version chat-service no longer serves reads Retired. A click opens the version's figures in a drawer.
 */
function ModelVersionsTable({ pipe, m, versions }: { pipe: ResearchPipe; m: ResearchModel; versions: ResearchModelVersion[] }) {
  const o = useOutcome(pipe);
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
              <p className="k-label">Model ids</p>
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
  pipe,
  t,
  versions,
  statuses,
}: {
  base: string;
  pipe: ResearchPipe;
  t: ResearchTemplate;
  versions: ResearchTemplateVersion[];
  statuses: ReturnType<typeof useTemplateStatuses>;
}) {
  const o = useOutcome(pipe);
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
          href={researchTemplateVersionHref(base, pipe, t.key, open.key)}
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
function TemplateVersionView({ base, pipe, t, v, crumbs }: { base: string; pipe: ResearchPipe; t: ResearchTemplate; v: ResearchTemplateVersion; crumbs: Crumb[] }) {
  const o = useOutcome(pipe);
  const statuses = useTemplateStatuses();
  const outputs = useTemplateOutputs(v.key, 5);
  const dynastyHref = researchCatalogHref(base, pipe, "templates", t.key);
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
                <SectionMark section={{ pipe }} size={12} />
                <SectionName section={{ pipe }} />
              </span>
            </>
          }
        />
        <DeprecationNote deprecation={statuses.deprecationOf(v.key)} />
        <KpiStrip f={v} pipe={pipe} />

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
  pipe,
  t,
  crumbs,
  nav,
}: {
  base: string;
  pipe: ResearchPipe;
  t: ResearchTemplate;
  crumbs: Crumb[];
  nav: (href: string) => void;
}) {
  const o = useOutcome(pipe);
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
                <SectionMark section={{ pipe }} size={12} />
                <SectionName section={{ pipe }} />
              </span>
              <span className="k-chip tabular-nums">
                {t.workflows.length} {t.workflows.length === 1 ? "workflow" : "workflows"}
              </span>
            </>
          }
        />
        <DeprecationNote deprecation={why} />
        <KpiStrip f={t} pipe={pipe} />

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <Charts f={t} topic="template" />
            {versions.length > 0 && <VersionsTable base={base} pipe={pipe} t={t} versions={versions} statuses={statuses} />}
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
                  <th className={TH}>Workflow</th>
                  <th className={`${TH} w-20`}>Version</th>
                  {versions.length > 0 && <th className={`${TH} w-24`}>Template</th>}
                  <th className={`${TH} w-36`}>Model</th>
                  <th className={`${TH} w-36 text-right`}>Tokens</th>
                </>
              }
              rows={t.runs.map((r, i) => (
                <tr key={`${r.when}-${i}`} className="k-row h-10">
                  <td className="k-mono k-fg2 whitespace-nowrap pl-4 pr-3 text-[12px]">{r.when}</td>
                  <td className="max-w-0 px-3">
                    {r.workflow ? (
                      <CatalogueName kind="workflow" name={r.workflow.label} href={researchCatalogHref(base, pipe, "workflows", r.workflow.key)} servedKey={r.workflow.key} />
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
                    <RefLink base={base} pipe={pipe} kind="models" r={r.model} className="block truncate" />
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
                  k="Pipe"
                  v={
                    <span className="inline-flex items-center gap-1.5">
                      <SectionMark section={{ pipe }} />
                      <SectionName section={{ pipe }} />
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
              <p className="k-label">Workflows that write with it</p>
              {t.workflows.length ? (
                <ul className="mt-2 space-y-1 text-[13px]">
                  {t.workflows.map((w) => (
                    <li key={w.key}>
                      <Link href={researchCatalogHref(base, pipe, "workflows", w.key)} className="k-hover -mx-2 flex items-center gap-2 rounded-[8px] px-2 py-1.5">
                        <CatalogueName kind="workflow" name={w.label} servedKey={w.key} className="flex-1" />
                        <Arrow />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="k-fg3 mt-2 text-[12px] leading-5">No workflow wrote most of its emails with it; it was a secondary template.</p>
              )}
              <button type="button" onClick={() => nav(researchCatalogHref(base, pipe, "templates"))} className="k-btn mt-4">
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
  pipe,
  m,
  crumbs,
  nav,
}: {
  base: string;
  pipe: ResearchPipe;
  m: ResearchModel;
  crumbs: Crumb[];
  nav: (href: string) => void;
}) {
  const o = useOutcome(pipe);
  const modelStatuses = useModelStatuses(useContentPipe(pipe));
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
                <SectionMark section={{ pipe }} size={12} />
                <SectionName section={{ pipe }} />
              </span>
              <span className="k-chip tabular-nums">
                {m.workflows.length} {m.workflows.length === 1 ? "workflow" : "workflows"}
              </span>
            </>
          }
        />
        <DeprecationNote deprecation={why} />
        <KpiStrip f={m} pipe={pipe} />

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <Charts f={m} topic="llm" />
            {versions.length > 0 && <ModelVersionsTable pipe={pipe} m={m} versions={versions} />}
            <RunsTable
              title="Last emails written"
              note="Every client, newest first"
              head={
                <>
                  <th className={`${TH} w-44`}>Time</th>
                  <th className={TH}>Workflow</th>
                  <th className={`${TH} w-40`}>Template</th>
                  <th className={`${TH} w-20`}>Version</th>
                  <th className={`${TH} w-36 text-right`}>Tokens</th>
                </>
              }
              rows={m.runs.map((r, i) => (
                <tr key={`${r.when}-${i}`} className="k-row h-10">
                  <td className="k-mono k-fg2 whitespace-nowrap pl-4 pr-3 text-[12px]">{r.when}</td>
                  <td className="max-w-0 px-3">
                    {r.workflow ? (
                      <CatalogueName kind="workflow" name={r.workflow.label} href={researchCatalogHref(base, pipe, "workflows", r.workflow.key)} servedKey={r.workflow.key} />
                    ) : (
                      <span className="k-fg4">{"—"}</span>
                    )}
                  </td>
                  <td className="max-w-0 px-3">
                    <RefLink base={base} pipe={pipe} kind="templates" r={r.template} className="block truncate" />
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
                  k="Pipe"
                  v={
                    <span className="inline-flex items-center gap-1.5">
                      <SectionMark section={{ pipe }} />
                      <SectionName section={{ pipe }} />
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
              <p className="k-label">Workflows that write with it</p>
              {m.workflows.length ? (
                <ul className="mt-2 space-y-1 text-[13px]">
                  {m.workflows.map((w) => (
                    <li key={w.key}>
                      <Link href={researchCatalogHref(base, pipe, "workflows", w.key)} className="k-hover -mx-2 flex items-center gap-2 rounded-[8px] px-2 py-1.5">
                        <CatalogueName kind="workflow" name={w.label} servedKey={w.key} className="flex-1" />
                        <Arrow />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="k-fg3 mt-2 text-[12px] leading-5">No workflow wrote most of its emails with it; it ran as a secondary model.</p>
              )}
              <button type="button" onClick={() => nav(researchCatalogHref(base, pipe, "models"))} className="k-btn mt-4">
                Every model
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
