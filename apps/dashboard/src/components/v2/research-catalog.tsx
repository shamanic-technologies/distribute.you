"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CrewMark } from "@/components/v2/crew-mark";
import { EmptyNote, SectionTitle, Shimmer, TopBar } from "@/components/v2/ui";
import { Arrow, MonthsRow, Row, TOPIC_LOOK, TopicMark, crewIdentity, dayText } from "@/components/v2/research-bits";
import {
  RESEARCH,
  loadResearchCatalog,
  loadTemplateTexts,
  peekResearchCatalog,
  peekTemplateTexts,
  CATALOG_KINDS,
  researchCatalogHref,
  researchModel,
  researchTemplate,
  researchWorkflow,
  type CatalogKind,
  type ResearchModel,
  type ResearchRef,
  type ResearchCatalog,
  type ResearchCrew,
  type ResearchFigures,
  type ResearchTemplate,
  type ResearchWorkflow,
} from "@/lib/research/research";

/**
 * Research's workflow and template pages: for one crew, every workflow (or template) that sent
 * its emails, all clients pooled, and one page per workflow and per template. Laid out like v2's
 * Workflows list and workflow page, with the Global column only: the research is fleet-wide.
 *
 * Every figure, label and date arrives written in `research-catalog.json` (research.mjs); this
 * file lays them out and never divides, ranks or formats a number. The catalogue and the
 * template texts are side files the page starts loading as soon as Research paints, so a click
 * finds them in memory.
 */

const TH = "k-label px-3 py-2.5 text-left font-medium first:pl-4 last:pr-4";
const KIND_WORD: Record<CatalogKind, { one: string; many: string; title: string }> = {
  workflows: { one: "workflow", many: "workflows", title: "Workflows" },
  templates: { one: "template", many: "templates", title: "Templates" },
  models: { one: "model", many: "models", title: "Models" },
};
/** Each kind wears its study topic's mark and colour. */
const KIND_TOPIC: Record<CatalogKind, "workflow" | "template" | "llm"> = { workflows: "workflow", templates: "template", models: "llm" };

/** A link to another catalogue page when that page exists in this crew, else the name alone. */
function RefLink({ base, crew, kind, r, className = "" }: { base: string; crew: ResearchCrew; kind: CatalogKind; r: ResearchRef | null; className?: string }) {
  if (!r) return <span className="k-fg4">{"—"}</span>;
  return r.linked ? (
    <Link href={researchCatalogHref(base, crew, kind, r.key)} className={`hover:text-[var(--accent)] ${className}`} title={r.label}>
      {r.label}
    </Link>
  ) : (
    <span className={className} title={r.label}>
      {r.label}
    </span>
  );
}

/** A workflow row is named by its own name (its model and template have their own columns); the rest by their label. */
function rowName(kind: CatalogKind, r: ResearchWorkflow | ResearchTemplate | ResearchModel): string {
  return kind === "workflows" ? ((r as ResearchWorkflow).name ?? r.label) : r.label;
}

function outcomeOf(crew: ResearchCrew): { noun: string; plural: string; unit: string } {
  const outcome = RESEARCH.crews.find((c) => c.id === crew)?.outcome ?? "Outcome";
  const plural = /[^aeiou]y$/i.test(outcome) ? `${outcome.slice(0, -1)}ies` : `${outcome}s`;
  return { noun: outcome, plural, unit: crew === "scout" ? "/ visit" : "/ reply" };
}

/** A side file's value: in memory at once when Research already loaded it, else when it lands. */
function useLoaded<T>(peek: () => T | null, load: () => Promise<T>): { value: T | null; failed: boolean } {
  const [value, setValue] = useState<T | null>(peek);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (value) return;
    let live = true;
    load().then(
      (v) => live && setValue(v),
      (err) => {
        console.error("[research] could not load a side file", err);
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [value, load]);
  return { value, failed };
}

/** The hub's links from a crew's section to its workflow and template pages. */
export function CrewCatalogLinks({ base, crew }: { base: string; crew: ResearchCrew }) {
  const counts = RESEARCH.catalogCounts?.[crew];
  if (!counts || !CATALOG_KINDS.some((k) => counts[k])) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {CATALOG_KINDS.map((kind) =>
        counts[kind] ? (
          <Link key={kind} href={researchCatalogHref(base, crew, kind)} className="k-btn inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-[2px]" style={{ background: TOPIC_LOOK[KIND_TOPIC[kind]].color }} />
            {KIND_WORD[kind].title}
            <span className="k-fg3 tabular-nums">{counts[kind]}</span>
            <Arrow />
          </Link>
        ) : null,
      )}
    </div>
  );
}

// ─── The view ──────────────────────────────────────────────────────────────

export function V2ResearchCatalogView({
  base,
  crew,
  kind,
  itemKey,
  nav,
}: {
  base: string;
  crew: ResearchCrew;
  kind: CatalogKind;
  itemKey: string | null;
  nav: (href: string) => void;
}) {
  const { value: catalog, failed } = useLoaded(peekResearchCatalog, loadResearchCatalog);
  const id = crewIdentity(crew);
  const listHref = researchCatalogHref(base, crew, kind);
  const crumbs = [
    { label: "Research", href: base },
    { label: id.name },
    itemKey ? { label: KIND_WORD[kind].title, href: listHref } : { label: KIND_WORD[kind].title },
  ];
  if (!catalog) {
    return (
      <>
        <TopBar crumbs={crumbs} />
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
  if (!itemKey) return <CatalogList base={base} crew={crew} kind={kind} catalog={catalog} crumbs={crumbs} nav={nav} />;
  const item =
    kind === "workflows"
      ? researchWorkflow(catalog, crew, itemKey)
      : kind === "templates"
        ? researchTemplate(catalog, crew, itemKey)
        : researchModel(catalog, crew, itemKey);
  if (!item) {
    return (
      <>
        <TopBar crumbs={[...crumbs, { label: "Not found" }]} />
        <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
          <div className="k-card">
            <EmptyNote>
              This {KIND_WORD[kind].one} is not in {id.name}&apos;s research.{" "}
              <Link href={listHref} className="k-fg underline">
                See every {KIND_WORD[kind].one}
              </Link>
            </EmptyNote>
          </div>
        </div>
      </>
    );
  }
  const total = catalog[crew][kind].length;
  const itemCrumbs = [...crumbs, { label: rowName(kind, item) }];
  if (kind === "workflows") return <WorkflowView base={base} crew={crew} w={item as ResearchWorkflow} total={total} crumbs={itemCrumbs} nav={nav} />;
  if (kind === "templates") return <TemplateView base={base} crew={crew} t={item as ResearchTemplate} total={total} crumbs={itemCrumbs} nav={nav} />;
  return <ModelView base={base} crew={crew} m={item as ResearchModel} total={total} crumbs={itemCrumbs} nav={nav} />;
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

// ─── A crew's list ─────────────────────────────────────────────────────────

function CatalogList({
  base,
  crew,
  kind,
  catalog,
  crumbs,
  nav,
}: {
  base: string;
  crew: ResearchCrew;
  kind: CatalogKind;
  catalog: ResearchCatalog;
  crumbs: { label: string; href?: string }[];
  nav: (href: string) => void;
}) {
  const id = crewIdentity(crew);
  const o = outcomeOf(crew);
  const rows: (ResearchWorkflow | ResearchTemplate | ResearchModel)[] = catalog[crew][kind];
  const words = KIND_WORD[kind];
  const priced = rows.filter((r) => r.rank != null).length;
  const other = CATALOG_KINDS[(CATALOG_KINDS.indexOf(kind) + 1) % CATALOG_KINDS.length];
  return (
    <>
      <TopBar crumbs={crumbs} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[28px] font-medium leading-[34px] tracking-[-0.02em]">
              {rows.length} {rows.length === 1 ? words.one : words.many}, {priced} with a {o.noun.toLowerCase()}
            </h1>
            <p className="k-fg2 mt-1 text-[14px]">
              Every {words.one} that wrote {id.name}&apos;s emails, all clients pooled, the cheapest {o.noun.toLowerCase()} first. Open one for its months,
              its last runs{kind === "templates" ? " and its text" : ""}.
            </p>
          </div>
          <span className="k-fg2 inline-flex items-center gap-2 text-[13px]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--data-teal)]" />
            Read from production on {dayText(RESEARCH.readOn)}
          </span>
        </div>

        <div className="mt-5 flex gap-5 border-b border-[var(--line-subtle)]">
          {CATALOG_KINDS.map((k) => (
            <Link key={k} href={researchCatalogHref(base, crew, k)} aria-current={k === kind ? "page" : undefined} className="k-tab inline-flex items-center gap-1.5 text-[13px]">
              {KIND_WORD[k].title}
              <span className="k-fg3 tabular-nums">{catalog[crew][k].length}</span>
            </Link>
          ))}
        </div>

        <section className="mt-6">
          <SectionTitle
            count={rows.length}
            right={
              <span className="inline-flex items-center gap-1.5">
                <CrewMark color={id.color} glyph={id.glyph} size={14} />
                {id.name} · {o.noun}
              </span>
            }
          >
            {words.title}
          </SectionTitle>
          <div className="k-card overflow-hidden">
            <div className="k-scroll relative overflow-x-auto">
              <table className={`w-full ${kind === "workflows" ? "min-w-[1180px]" : "min-w-[860px]"} text-[13px]`}>
                <thead>
                  <tr className="border-b border-[var(--line-subtle)]">
                    <th className={`${TH} w-12`}>#</th>
                    <th className={TH}>{words.title.slice(0, -1)}</th>
                    {kind === "workflows" && (
                      <>
                        <th className={`${TH} w-40`}>LLM</th>
                        <th className={`${TH} w-40`}>Template</th>
                      </>
                    )}
                    <th className={`${TH} w-36 text-right`}>Cost {o.unit.replace("/ ", "per ")}</th>
                    <th className={`${TH} w-28 text-right`}>Rate</th>
                    <th className={`${TH} w-28 text-right`}>{o.plural}</th>
                    <th className={`${TH} w-28 text-right`}>Emails</th>
                    <th className={`${TH} w-28 text-right`}>Invested</th>
                    <th className={`${TH} w-10`} aria-label="Open" />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={kind === "workflows" ? 10 : 8}>
                        <EmptyNote>No {words.one} has written {id.name}&apos;s emails yet.</EmptyNote>
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => {
                      const href = researchCatalogHref(base, crew, kind, r.key);
                      return (
                        <tr key={r.key} onClick={() => nav(href)} className="k-row group h-10 cursor-pointer">
                          <td className="k-mono k-fg3 pl-4 pr-3 text-[12px] tabular-nums">{r.rank ?? "—"}</td>
                          <td className="max-w-0 px-3">
                            <Link href={href} className="block min-w-0 truncate font-medium" title={rowName(kind, r)}>
                              {rowName(kind, r)}
                            </Link>
                          </td>
                          {kind === "workflows" && (
                            <>
                              {/* Each cell opens that model's or template's own page; the rest of the row opens the workflow. */}
                              <td className="max-w-0 px-3" onClick={(e) => e.stopPropagation()}>
                                <RefLink base={base} crew={crew} kind="models" r={(r as ResearchWorkflow).model} className="block min-w-0 truncate" />
                              </td>
                              <td className="max-w-0 px-3" onClick={(e) => e.stopPropagation()}>
                                <RefLink base={base} crew={crew} kind="templates" r={(r as ResearchWorkflow).template} className="block min-w-0 truncate" />
                              </td>
                            </>
                          )}
                          <td className="px-3 text-right tabular-nums">
                            <Money value={r.cost} unit={o.unit} />
                          </td>
                          <td className="px-3 text-right tabular-nums">
                            <Dash v={r.rate} />
                          </td>
                          <td className="px-3 text-right tabular-nums">{r.outcomes}</td>
                          <td className="px-3 text-right tabular-nums">{r.emails}</td>
                          <td className="px-3 text-right tabular-nums">{r.spend}</td>
                          <td className="pl-3 pr-4 text-right">
                            <span className="k-btn-ghost inline-flex h-6 w-6 justify-center px-0 opacity-0 group-hover:opacity-100">
                              <Chevron />
                            </span>
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
              <Link href={researchCatalogHref(base, crew, other)} className="k-btn-ghost ml-auto h-6 shrink-0 whitespace-nowrap px-1.5 text-[12px]">
                See the {KIND_WORD[other].many}
              </Link>
            </div>
          </div>
          <p className="k-fg3 mt-1.5 text-[12px] leading-5">{RESEARCH.maturation.note}</p>
        </section>
      </div>
    </>
  );
}

// ─── One workflow, one template ────────────────────────────────────────────

function Kpi({ label, value }: { label: string; value: React.ReactNode }) {
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
  chips,
}: {
  topic: "workflow" | "template" | "llm";
  title: string;
  chips: React.ReactNode;
}) {
  return (
    <div className="mt-2 flex min-w-0 items-center gap-3">
      <TopicMark topic={topic} size={40} />
      <div className="min-w-0">
        <h1 className="truncate text-[24px] font-medium leading-[30px] tracking-[-0.02em]">{title}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2">{chips}</div>
      </div>
    </div>
  );
}

function KpiStrip({ f, crew }: { f: ResearchFigures; crew: ResearchCrew }) {
  const o = outcomeOf(crew);
  return (
    <div className="k-card mt-5 grid grid-cols-2 divide-[var(--line-subtle)] md:grid-cols-4 md:divide-x">
      <Kpi label={`Cost / ${o.noun.toLowerCase()}`} value={<Dash v={f.cost} />} />
      <Kpi label="Rate" value={<Dash v={f.rate} />} />
      <Kpi label={o.plural} value={f.outcomes} />
      <Kpi label="Emails" value={f.emails} />
    </div>
  );
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
        <MonthsRow key={c.title} chart={c} color={TOPIC_LOOK[topic].color} />
      ))}
    </div>
  );
}

function StatusWord({ status }: { status: string }) {
  const dot = status === "completed" ? "bg-[var(--data-teal)]" : status === "failed" ? "bg-[var(--data-rose)]" : "bg-[var(--run)]";
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px]">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
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
  crew,
  w,
  total,
  crumbs,
  nav,
}: {
  base: string;
  crew: ResearchCrew;
  w: ResearchWorkflow;
  total: number;
  crumbs: { label: string; href?: string }[];
  nav: (href: string) => void;
}) {
  const id = crewIdentity(crew);
  const o = outcomeOf(crew);
  const tplHref = w.template?.linked ? researchCatalogHref(base, crew, "templates", w.template.key) : null;
  return (
    <>
      <TopBar crumbs={crumbs} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <Header
          topic="workflow"
          title={w.name ?? w.label}
          chips={
            <>
              <span className="k-chip tabular-nums">{w.rank == null ? "Not priced yet" : `#${w.rank} of ${total}`}</span>
              <span className="k-chip inline-flex items-center gap-1.5">
                <CrewMark color={id.color} glyph={id.glyph} size={12} />
                {id.name}
              </span>
              {w.model &&
                (w.model.linked ? (
                  <Link href={researchCatalogHref(base, crew, "models", w.model.key)} className="k-chip inline-flex items-center gap-1 hover:text-[var(--accent)]">
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
            </>
          }
        />
        <KpiStrip f={w} crew={crew} />

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <Charts f={w} topic="workflow" />
            <RunsTable
              title="Last runs"
              note="Every client, newest first"
              head={
                <>
                  <th className={`${TH} w-44`}>Time</th>
                  <th className={`${TH} w-24`}>Version</th>
                  <th className={TH}>Status</th>
                  <th className={`${TH} w-20 text-right`}>Took</th>
                  <th className={`${TH} w-24 text-right`}>Charged</th>
                </>
              }
              rows={w.runs.map((r, i) => (
                <tr key={`${r.when}-${i}`} className="k-row h-10">
                  <td className="k-mono k-fg2 whitespace-nowrap pl-4 pr-3 text-[12px]">{r.when}</td>
                  <td className="k-mono k-fg2 px-3 text-[12px]">{r.version}</td>
                  <td className="px-3">
                    <StatusWord status={r.status} />
                  </td>
                  <td className="k-mono k-fg2 px-3 text-right text-[12px]">
                    <Dash v={r.duration} />
                  </td>
                  <td className="whitespace-nowrap pl-3 pr-4 text-right tabular-nums">{r.cost ?? <span className="k-fg3 text-[12px]">Not charged</span>}</td>
                </tr>
              ))}
            />
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
              <Row k="Outcome" v={o.noun} />
              <Row k="Model" v={w.model ? <RefLink base={base} crew={crew} kind="models" r={w.model} className={w.model.linked ? "text-[var(--accent)]" : ""} /> : null} />
              <Row
                k="Template"
                v={
                  w.template ? (
                    tplHref ? (
                      <Link href={tplHref} className="text-[var(--accent)] hover:underline">
                        {w.template.label}
                      </Link>
                    ) : (
                      w.template.label
                    )
                  ) : null
                }
              />
              <Row k="Invested" v={w.spend} />
              <Row k="Sample" v={<span className="k-fg2 text-[12px]">{w.sample}</span>} />
            </dl>
            <MeasuredNote />
            <button type="button" onClick={() => nav(researchCatalogHref(base, crew, "workflows"))} className="k-btn mt-4">
              Every workflow
            </button>
          </aside>
        </div>
      </div>
    </>
  );
}

function TemplateText({ templateKey, hasText }: { templateKey: string; hasText: boolean }) {
  const { value: texts, failed } = useLoaded(peekTemplateTexts, loadTemplateTexts);
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
        ) : (
          <>
            <pre className={`k-mono k-fg2 whitespace-pre-wrap break-words p-4 text-[12px] leading-5 ${open ? "" : "max-h-[360px] overflow-hidden"}`}>{text}</pre>
            <div className="k-fg3 flex items-center border-t border-[var(--line-subtle)] px-4 py-2.5 text-[12px]">
              <span>The text that wrote these emails; a new version is a new template.</span>
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

function TemplateView({
  base,
  crew,
  t,
  total,
  crumbs,
  nav,
}: {
  base: string;
  crew: ResearchCrew;
  t: ResearchTemplate;
  total: number;
  crumbs: { label: string; href?: string }[];
  nav: (href: string) => void;
}) {
  const id = crewIdentity(crew);
  const o = outcomeOf(crew);
  return (
    <>
      <TopBar crumbs={crumbs} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <Header
          topic="template"
          title={t.label}
          chips={
            <>
              <span className="k-chip tabular-nums">{t.rank == null ? "Not priced yet" : `#${t.rank} of ${total}`}</span>
              <span className="k-chip inline-flex items-center gap-1.5">
                <CrewMark color={id.color} glyph={id.glyph} size={12} />
                {id.name}
              </span>
              <span className="k-chip tabular-nums">
                {t.workflows.length} {t.workflows.length === 1 ? "workflow" : "workflows"}
              </span>
            </>
          }
        />
        <KpiStrip f={t} crew={crew} />

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <Charts f={t} topic="template" />
            <TemplateText templateKey={t.key} hasText={t.hasText} />
            <RunsTable
              title="Last emails written"
              note="Every client, newest first"
              head={
                <>
                  <th className={`${TH} w-44`}>Time</th>
                  <th className={TH}>Workflow</th>
                  <th className={`${TH} w-20`}>Version</th>
                  <th className={`${TH} w-36`}>Model</th>
                  <th className={`${TH} w-36 text-right`}>Tokens</th>
                </>
              }
              rows={t.runs.map((r, i) => (
                <tr key={`${r.when}-${i}`} className="k-row h-10">
                  <td className="k-mono k-fg2 whitespace-nowrap pl-4 pr-3 text-[12px]">{r.when}</td>
                  <td className="max-w-0 px-3">
                    {r.workflow ? (
                      <Link href={researchCatalogHref(base, crew, "workflows", r.workflow.key)} className="block truncate hover:text-[var(--accent)]" title={r.workflow.label}>
                        {r.workflow.label}
                      </Link>
                    ) : (
                      <span className="k-fg4">{"—"}</span>
                    )}
                  </td>
                  <td className="k-mono k-fg2 px-3 text-[12px]">
                    <Dash v={r.version} />
                  </td>
                  <td className="max-w-0 truncate px-3">
                    <RefLink base={base} crew={crew} kind="models" r={r.model} className="block truncate" />
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
                  k="Crew"
                  v={
                    <span className="inline-flex items-center gap-1.5">
                      <CrewMark color={id.color} glyph={id.glyph} />
                      {id.name}
                    </span>
                  }
                />
                <Row k="Outcome" v={o.noun} />
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
                      <Link href={researchCatalogHref(base, crew, "workflows", w.key)} className="k-hover -mx-2 flex items-center gap-2 rounded-[8px] px-2 py-1.5">
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
              <button type="button" onClick={() => nav(researchCatalogHref(base, crew, "templates"))} className="k-btn mt-4">
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
  crew,
  m,
  total,
  crumbs,
  nav,
}: {
  base: string;
  crew: ResearchCrew;
  m: ResearchModel;
  total: number;
  crumbs: { label: string; href?: string }[];
  nav: (href: string) => void;
}) {
  const id = crewIdentity(crew);
  const o = outcomeOf(crew);
  return (
    <>
      <TopBar crumbs={crumbs} />
      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 md:px-6">
        <Header
          topic="llm"
          title={m.label}
          chips={
            <>
              <span className="k-chip tabular-nums">{m.rank == null ? "Not priced yet" : `#${m.rank} of ${total}`}</span>
              <span className="k-chip inline-flex items-center gap-1.5">
                <CrewMark color={id.color} glyph={id.glyph} size={12} />
                {id.name}
              </span>
              <span className="k-chip tabular-nums">
                {m.workflows.length} {m.workflows.length === 1 ? "workflow" : "workflows"}
              </span>
            </>
          }
        />
        <KpiStrip f={m} crew={crew} />

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
                      <Link href={researchCatalogHref(base, crew, "workflows", r.workflow.key)} className="block truncate hover:text-[var(--accent)]" title={r.workflow.label}>
                        {r.workflow.label}
                      </Link>
                    ) : (
                      <span className="k-fg4">{"—"}</span>
                    )}
                  </td>
                  <td className="max-w-0 px-3">
                    <RefLink base={base} crew={crew} kind="templates" r={r.template} className="block truncate" />
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
                  k="Crew"
                  v={
                    <span className="inline-flex items-center gap-1.5">
                      <CrewMark color={id.color} glyph={id.glyph} />
                      {id.name}
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
                      <Link href={researchCatalogHref(base, crew, "workflows", w.key)} className="k-hover -mx-2 flex items-center gap-2 rounded-[8px] px-2 py-1.5">
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
              <button type="button" onClick={() => nav(researchCatalogHref(base, crew, "models"))} className="k-btn mt-4">
                Every model
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
