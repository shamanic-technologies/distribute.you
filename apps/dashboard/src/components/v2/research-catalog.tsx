"use client";

import { HubChip, HubChips } from "@/components/v2/hub-section";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EmptyNote, SectionTitle, Shimmer, TopBar, type Crumb } from "@/components/v2/ui";
import { CostBasisSwitch } from "@/components/v2/cost-basis-switch";
import { RoiLabel, RoiValue } from "@/components/v2/roi-label";
import { ResearchLiveWorkflows, usePipeChannelName, useResearchPipeLeg } from "@/components/v2/research-live-workflows";
import { shortWorkflowName } from "@/lib/live-workflow-rows";
import {
  ACTIVATE_CONTENT_NOTE,
  DEPRECATE_CONTENT_NOTE,
  contentNote,
  DeprecationNote,
  StatusMenu,
  StatusWord as ContentStatusWord,
  useContentStatusWrites,
  useModelStatuses,
  useTemplateStatuses,
  useWorkflowDeprecation,
} from "@/components/v2/research-status";
import { OutputsList, RecentRuns, TemplateOutputsPanel, TemplateVersionDrawer, useTemplateOutputs } from "@/components/v2/research-template-outputs";
import { modelAliasesOf, modelStatus, type ContentTarget } from "@/lib/research/content-status";
import { useResearch, useResearchCatalog, useResearchTexts } from "@/lib/research/research-source";
import {
  Arrow,
  MonthsRow,
  Row,
  STANDALONE_WORDS,
  SectionMark,
  SectionName,
  topicLook,
  TemplateVersionChip,
  TopicMark,
  dayText,
  identityWord,
  liveText,
} from "@/components/v2/research-bits";
import {
  CATALOG_KINDS,
  researchCatalogHref,
  researchModel,
  researchTemplateOf,
  researchTemplateVersion,
  researchTemplateVersionHref,
  researchWorkflow,
  templateContentKey,
  templatesByTab,
  templateTab,
  type TemplateTab,
  type CatalogKind,
  type ResearchModel,
  type ResearchRef,
  type ResearchCatalog,
  type ResearchPipe,
  type ResearchFigures,
  type ResearchTemplate,
  type ResearchTemplateVersion,
  type ResearchWorkflow,
  researchRoiOf,
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
/** Each kind wears its study topic's mark and colour. */
const KIND_TOPIC: Record<CatalogKind, "workflow" | "template" | "llm"> = { workflows: "workflow", templates: "template", models: "llm" };

/** A link to another catalogue page when that page exists in this pipe, else the name alone. */
function RefLink({ base, pipe, kind, r, className = "" }: { base: string; pipe: ResearchPipe; kind: CatalogKind; r: ResearchRef | null; className?: string }) {
  if (!r) return <span className="k-fg4">{"—"}</span>;
  // A template ref names its dynasty's page; the version it means rides beside it as a chip.
  if (r.version) {
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <RefLink base={base} pipe={pipe} kind={kind} r={{ ...r, version: null }} className={`min-w-0 truncate ${className.replace(/\bblock\b/, "")}`} />
        <TemplateVersionChip version={r.version} />
      </span>
    );
  }
  return r.linked ? (
    <Link href={researchCatalogHref(base, pipe, kind, r.key)} className={`hover:text-[var(--accent)] ${className}`} title={r.label}>
      {r.label}
    </Link>
  ) : (
    <span className={className} title={r.label}>
      {r.label}
    </span>
  );
}

/** A workflow row is named by its own name (its model and template have their own columns); the rest by their label. */
function rowName(kind: CatalogKind, r: ResearchWorkflow | ResearchTemplate | ResearchModel, channelName: string | null): string {
  return kind === "workflows" ? shortWorkflowName((r as ResearchWorkflow).name ?? r.label, channelName) : r.label;
}

function useOutcome(pipe: ResearchPipe): { noun: string; plural: string; unit: string } {
  const outcome = useResearch().file.pipes.find((c) => c.id === pipe)?.outcome ?? "Outcome";
  const plural = /[^aeiou]y$/i.test(outcome) ? `${outcome.slice(0, -1)}ies` : `${outcome}s`;
  return { noun: outcome, plural, unit: pipe === "cold-email-website-visit" ? "/ visit" : "/ reply" };
}

/** The hub's links from a pipe's section to its workflow and template pages. */
export function PipeCatalogLinks({ base, pipe }: { base: string; pipe: ResearchPipe }) {
  const counts = useResearch().file.catalogCounts?.[pipe];
  if (!counts || !CATALOG_KINDS.some((k) => counts[k])) return null;
  return (
    <HubChips>
      {CATALOG_KINDS.map((kind) =>
        counts[kind] ? <HubChip key={kind} href={researchCatalogHref(base, pipe, kind)} color={topicLook(KIND_TOPIC[kind]).color} label={KIND_WORD[kind].title} count={counts[kind]} /> : null,
      )}
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
        <TopBar crumbs={crumbs} actions={<CostBasisSwitch />} />
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
        <TopBar crumbs={[...crumbs, { label: "Not found" }]} actions={<CostBasisSwitch />} />
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
          <TopBar crumbs={versionCrumbs} actions={<CostBasisSwitch />} />
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
  const rows: (ResearchWorkflow | ResearchTemplate | ResearchModel)[] = catalog?.[pipe][kind] ?? [];
  const words = KIND_WORD[kind];
  const priced = rows.filter((r) => r.rank != null).length;
  const other = CATALOG_KINDS[(CATALOG_KINDS.indexOf(kind) + 1) % CATALOG_KINDS.length];
  // Workflows are read LIVE off the producer's ranking at the pipe's leg; the catalogue table
  // stays for templates, models, and a pipe whose step starts no entry leg.
  const liveLeg = useResearchPipeLeg(pipe);
  const live = kind === "workflows" && liveLeg != null;
  // Staff status (TEMPLATE-MODEL-STATUS-1019): templates by type, models by every alias chat-service serves them under (served on the row).
  const templateStatuses = useTemplateStatuses();
  const modelStatuses = useModelStatuses();
  const writes = useContentStatusWrites();
  // Templates sit in two tabs, Active and Deprecated (owner 2026-10-21), the tab in the URL. No row
  // shows before the statuses answer, so none flashes in a tab it then leaves.
  const search = useSearchParams();
  const tab = templateTab(search?.get("status"));
  const statusFailed = kind === "templates" && templateStatuses.failed;
  const byTab = kind === "templates" && !statusFailed ? templatesByTab(rows as ResearchTemplate[], templateStatuses) : null;
  const statusPending = kind === "templates" && !statusFailed && !byTab;
  const shown: (ResearchWorkflow | ResearchTemplate | ResearchModel)[] = kind === "templates" ? (byTab?.[tab] ?? []) : rows;
  const pickTab = (next: TemplateTab) => {
    // The history API, null state: Next keeps useSearchParams in step (apps/dashboard CLAUDE.md).
    window.history.replaceState(null, "", next === "active" ? window.location.pathname : `${window.location.pathname}?status=${next}`);
  };
  // The Templates page's right panel is open from the start, on the tab's first row until a row is picked.
  const [selected, setSelected] = useState<string | null>(null);
  const selectedTemplate = kind === "templates" ? ((shown as ResearchTemplate[]).find((r) => r.key === selected) ?? (shown[0] as ResearchTemplate | undefined) ?? null) : null;
  return (
    <>
      <TopBar crumbs={crumbs} actions={<CostBasisSwitch />} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">
              {live ? "Workflows on this pipe, ranked live" : `${rows.length} ${rows.length === 1 ? words.one : words.many}, ${priced} with a ${o.noun.toLowerCase()}`}
            </h1>
            <p className="k-fg2 mt-1 text-[14px]">
              {live ? (
                <>Every workflow on this pipe, all clients pooled, in the order a campaign picks from.</>
              ) : (
                <>
                  Every {words.one} that wrote this pipe&apos;s emails, all clients pooled, the cheapest {o.noun.toLowerCase()} first.{" "}
                  {kind === "templates" ? "Pick one for its workflows, models and last emails; open its name for its page." : "Open one for its months and its last runs."}
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

        <div className="mt-5 flex gap-5 border-b border-[var(--line-subtle)]">
          {CATALOG_KINDS.map((k) => (
            <Link key={k} href={researchCatalogHref(base, pipe, k)} aria-current={k === kind ? "page" : undefined} className="k-tab inline-flex items-center gap-1.5 text-[13px]">
              {KIND_WORD[k].title}
              {catalog && <span className="k-fg3 tabular-nums">{catalog[pipe][k].length}</span>}
            </Link>
          ))}
        </div>

        <section className="mt-6">
          <SectionTitle
            count={rows.length}
            right={
              <span className="inline-flex items-center gap-1.5">
                <SectionMark section={{ pipe }} size={14} />
                <SectionName section={{ pipe }} />
              </span>
            }
          >
            {words.title}
          </SectionTitle>
          {kind === "templates" && (
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
            <div className={kind === "templates" ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]" : ""}>
              <div className="k-card min-w-0 overflow-hidden">
                <div className="k-scroll relative overflow-x-auto">
                  <table className={`w-full ${kind === "workflows" ? "min-w-[1180px]" : kind === "templates" ? "min-w-[820px]" : "min-w-[940px]"} text-[13px]`}>
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
                            <th className={`${TH} w-24 text-right`}>
                              <RoiLabel />
                            </th>
                            <th className={`${TH} w-28 text-right`}>% Conversion</th>
                          </>
                        )}
                        {kind === "models" && <th className={`${TH} w-52`}>Status</th>}
                        {kind === "templates" && <th className={`${TH} w-20 text-right`}>Workflows</th>}
                        <th className={`${TH} ${kind === "templates" ? "w-28" : "w-36"} text-right`}>Cost {o.unit.replace("/ ", "per ")}</th>
                        {kind !== "templates" && <th className={`${TH} w-28 text-right`}>Rate</th>}
                        <th className={`${TH} ${kind === "templates" ? "w-24" : "w-28"} text-right`}>{o.plural}</th>
                        {kind !== "templates" && (
                          <>
                            <th className={`${TH} w-28 text-right`}>Emails</th>
                            <th className={`${TH} w-28 text-right`}>Invested</th>
                          </>
                        )}
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
                            <EmptyNote>We could not read which templates are active just now. It retries on its own.</EmptyNote>
                          </td>
                        </tr>
                      ) : shown.length === 0 ? (
                        <tr>
                          <td colSpan={10}>
                            <EmptyNote>
                              {rows.length === 0
                                ? `No ${words.one} has written this pipe's emails yet.`
                                : tab === "active"
                                  ? "No template on this pipe is active."
                                  : "No template on this pipe is deprecated."}
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
                              : modelKeys.length
                                ? { kind: "model", aliases: modelKeys, label: r.label }
                                : null;
                          const status =
                            kind === "templates" ? templateStatuses.map.get(templateContentKey(r as ResearchTemplate)) ?? null : modelStatus(modelKeys, (a) => modelStatuses.map.get(a));
                          const statusAnswered = kind === "templates" ? templateStatuses.answered : modelStatuses.answered;
                          const deprecation = kind === "templates" ? templateStatuses.deprecationOf(templateContentKey(r as ResearchTemplate)) : modelStatuses.deprecationOf(modelKeys);
                          return (
                            <tr
                              key={r.key}
                              onClick={() => (kind === "templates" ? setSelected(r.key) : nav(href))}
                              aria-selected={kind === "templates" ? picked : undefined}
                              className={`k-row group h-10 cursor-pointer ${picked ? "k-selected" : ""}`}
                            >
                              <td className="max-w-0 pl-4 pr-3">
                                <span className="flex min-w-0 items-center gap-1.5">
                                  <Link href={href} onClick={(e) => e.stopPropagation()} className={`${kind === "templates" && (r as ResearchTemplate).standaloneReason ? "max-w-full shrink-0" : "min-w-0"} truncate font-medium hover:text-[var(--accent)]`} title={rowName(kind, r, channelName)}>
                                    {rowName(kind, r, channelName)}
                                  </Link>
                                  {kind === "templates" && <TemplateRowChip t={r as ResearchTemplate} />}
                                </span>
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
                                  <td className="whitespace-nowrap px-3 text-right tabular-nums">
                                    <TemplateRoi t={r as ResearchTemplate} />
                                  </td>
                                  <td className="px-3 text-right tabular-nums">
                                    <Dash v={r.rate} />
                                  </td>
                                </>
                              )}
                              {kind === "models" && (
                                <td className="max-w-0 px-3">
                                  <ContentStatusWord
                                    status={status}
                                    gap={served.gap}
                                    pending={!statusAnswered && modelKeys.length > 0}
                                    deprecation={deprecation}
                                  />
                                </td>
                              )}
                              {kind === "templates" && <td className="px-3 text-right tabular-nums">{(r as ResearchTemplate).workflows.length}</td>}
                              <td className="whitespace-nowrap px-3 text-right tabular-nums">
                                <Money value={r.cost} unit={o.unit} />
                              </td>
                              {kind !== "templates" && (
                                <td className="px-3 text-right tabular-nums">
                                  <Dash v={r.rate} />
                                </td>
                              )}
                              <td className="px-3 text-right tabular-nums">{r.outcomes}</td>
                              {kind !== "templates" && (
                                <>
                                  <td className="px-3 text-right tabular-nums">{r.emails}</td>
                                  <td className="px-3 text-right tabular-nums">{r.spend}</td>
                                </>
                              )}
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
                    {priced} of {rows.length} priced per {o.noun.toLowerCase()}; the rest have not earned one yet and are listed by volume.
                  </span>
                  <Link href={researchCatalogHref(base, pipe, other)} className="k-btn-ghost ml-auto h-6 shrink-0 whitespace-nowrap px-1.5 text-[12px]">
                    See the {KIND_WORD[other].many}
                  </Link>
                </div>
              </div>
              {kind === "templates" &&
                (statusPending ? (
                  <aside className="k-card h-fit space-y-2 self-start p-4">
                    {[0, 1, 2, 3].map((i) => (
                      <Shimmer key={i} className="h-4 w-full" />
                    ))}
                  </aside>
                ) : selectedTemplate ? (
                  <TemplateOutputsPanel
                    t={selectedTemplate}
                    href={researchCatalogHref(base, pipe, "templates", selectedTemplate.key)}
                    base={base}
                    pipe={pipe}
                    catalog={catalog}
                    outcome={o}
                  />
                ) : null)}
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
}: {
  topic: "workflow" | "template" | "llm";
  title: string;
  /** One customer line under the title (a template dynasty's description). */
  sub?: string | null;
  chips: React.ReactNode;
}) {
  return (
    <div className="mt-2 flex min-w-0 items-center gap-3">
      <TopicMark topic={topic} size={40} />
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
  const roi = researchRoiOf(t);
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
      <TopBar crumbs={crumbs} actions={<CostBasisSwitch />} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <Header
          topic="workflow"
          title={shortWorkflowName(w.name ?? w.label, channelName)}
          chips={
            <>
              <span className="k-chip inline-flex items-center gap-1.5">
                <SectionMark section={{ pipe }} size={12} />
                <SectionName section={{ pipe }} />
              </span>
              {w.model &&
                (w.model.linked ? (
                  <Link href={researchCatalogHref(base, pipe, "models", w.model.key)} className="k-chip inline-flex items-center gap-1 hover:text-[var(--accent)]">
                    {w.model.label}
                    <Arrow />
                  </Link>
                ) : (
                  <span className="k-chip">{w.model.label}</span>
                ))}
              {w.template &&
                (tplHref ? (
                  <Link href={tplHref} className="k-chip inline-flex items-center gap-1 hover:text-[var(--accent)]">
                    {w.template.label}
                    <Arrow />
                  </Link>
                ) : (
                  <span className="k-chip">{w.template.label}</span>
                ))}
              {w.template && <TemplateVersionChip version={w.template.version} />}
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
                  w.template ? (
                    <span className="inline-flex max-w-full items-center gap-1.5">
                      {tplHref ? (
                        <Link href={tplHref} className="min-w-0 truncate text-[var(--accent)] hover:underline">
                          {w.template.label}
                        </Link>
                      ) : (
                        <span className="min-w-0 truncate">{w.template.label}</span>
                      )}
                      <TemplateVersionChip version={w.template.version} />
                    </span>
                  ) : null
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
                      <span className="k-mono min-w-0 truncate text-[12px]" title={v.key}>
                        {v.label}
                      </span>
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
      <TopBar crumbs={crumbs} actions={<CostBasisSwitch />} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <Header
          topic="template"
          title={v.label}
          chips={
            <>
              <Link href={dynastyHref} className="k-chip inline-flex items-center gap-1 hover:text-[var(--accent)]">
                Version of {t.label}
                <Arrow />
              </Link>
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
  const why = statuses.deprecationOf(templateContentKey(t));
  const dynasty = t.dynasty ?? null;
  const versions = t.versions ?? [];
  const identity = identityWord(dynasty?.identity);
  const versionLabel = new Map(versions.map((v) => [v.key, v.label]));
  return (
    <>
      <TopBar crumbs={crumbs} actions={<CostBasisSwitch />} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <Header
          topic="template"
          title={t.label}
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
                      <Link href={researchCatalogHref(base, pipe, "workflows", r.workflow.key)} className="block truncate hover:text-[var(--accent)]" title={r.workflow.label}>
                        {r.workflow.label}
                      </Link>
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
                        <TopicMark topic="workflow" size={18} />
                        <span className="min-w-0 flex-1 truncate">{w.label}</span>
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
  const why = useModelStatuses().deprecationOf(modelAliasesOf(m).aliases);
  return (
    <>
      <TopBar crumbs={crumbs} actions={<CostBasisSwitch />} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <Header
          topic="llm"
          title={m.label}
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
                      <Link href={researchCatalogHref(base, pipe, "workflows", r.workflow.key)} className="block truncate hover:text-[var(--accent)]" title={r.workflow.label}>
                        {r.workflow.label}
                      </Link>
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
                        <TopicMark topic="workflow" size={18} />
                        <span className="min-w-0 flex-1 truncate">{w.label}</span>
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
