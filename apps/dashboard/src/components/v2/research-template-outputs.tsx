"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getTemplateDynastyOutputs, getTemplateOutputs, getWorkflowDynastyOutputs, type TemplateOutput, type WorkflowRunOutput } from "@/lib/api";
import { EmptyNote, Shimmer } from "@/components/v2/ui";
import { RoiLabel, RoiValue } from "@/components/v2/roi-label";
import { Arrow, instantText } from "@/components/v2/research-bits";
import { CatalogueName, CatalogueObjectMark } from "@/components/v2/catalogue-name";
import { runVersionLabel } from "@/lib/research/workflow-runs";
import {
  researchCatalogHref,
  templateContentKey,
  templateModels,
  type ResearchCatalog,
  type ResearchFigures,
  type ResearchPipe,
  type ResearchRef,
  type ResearchTemplate,
  researchRoiOf,
} from "@/lib/research/research";

/** The outcome words a panel labels its figures with ("Positive reply", "Positive replies"). */
export interface OutcomeWords {
  noun: string;
  plural: string;
}

/** The last `limit` outputs written with one template version, every client, newest first (content-generation-service). */
export function useTemplateOutputs(outputsKey: string, limit: number, enabled = true) {
  const q = useAuthQuery(["templateOutputs", outputsKey, limit], () => getTemplateOutputs(outputsKey, limit), { ...pollOptions, retry: false, enabled });
  return { outputs: q.data, answered: q.data !== undefined || q.isFetchedAfterMount };
}

/**
 * The outputs a Templates ROW shows: a dynasty reads every version's (content generation's dynasty
 * read, newest first); a version on its own reads its own.
 */
export function useTemplateRowOutputs(t: Pick<ResearchTemplate, "key" | "dynasty">, limit: number) {
  const slug = t.dynasty ? t.dynasty.slug : null;
  const q = useAuthQuery(["templateDynastyOutputs", slug ?? "", limit], () => getTemplateDynastyOutputs(slug ?? "", limit), {
    ...pollOptions,
    retry: false,
    enabled: slug != null,
  });
  const own = useTemplateOutputs(templateContentKey(t), limit, slug == null);
  if (slug == null) return own;
  return { outputs: q.data, answered: q.data !== undefined || q.isFetchedAfterMount };
}

/** Outputs as a list: subject and each email as sent, never a client or a lead. `expanded` opens every email in full. */
export function OutputsList({ read, expanded = false }: { read: ReturnType<typeof useTemplateOutputs>; expanded?: boolean }) {
  if (!read.answered) {
    return (
      <div className="space-y-2 p-4">
        {[0, 1, 2, 3].map((i) => (
          <Shimmer key={i} className="h-4 w-full" />
        ))}
      </div>
    );
  }
  if (read.outputs === undefined) return <EmptyNote>We could not read its last emails just now. It retries on its own.</EmptyNote>;
  if (read.outputs.length === 0) return <EmptyNote>Nothing written with this template is on record.</EmptyNote>;
  return (
    <ol className="divide-y divide-[var(--line-subtle)]">
      {read.outputs.map((o) => (
        <OutputItem key={o.generationId} o={o} expanded={expanded} />
      ))}
    </ol>
  );
}

/**
 * The figures a template or a version is listed with: cost per outcome, conversion, outcomes (and
 * emails and invested where asked). ROI only once features-service serves it on the row: no tile
 * otherwise, never a placeholder.
 */
export function TemplateFigures({ f, outcome, more = false }: { f: ResearchFigures; outcome: OutcomeWords; more?: boolean }) {
  const roi = researchRoiOf(f);
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-[12px]">
      {roi != null && <Fig k={<RoiLabel />} v={"show" in roi ? <RoiValue roi={roi.show} /> : roi.text} />}
      <Fig k={`Cost per ${outcome.noun.toLowerCase()}`} v={f.cost} />
      <Fig k="Conversion" v={f.rate} />
      <Fig k={outcome.plural} v={f.outcomes} />
      {more && <Fig k="Emails" v={f.emails} />}
      {more && <Fig k="Invested" v={f.spend} />}
    </dl>
  );
}

function Fig({ k, v }: { k: React.ReactNode; v: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="k-label truncate">{k}</dt>
      <dd className="mt-0.5 truncate text-[15px] font-medium tabular-nums">{v ?? <span className="k-fg4">{"—"}</span>}</dd>
    </div>
  );
}

/** A model as a tag that opens its page when it has one: the shared LLM chip. */
function ModelTag({ base, pipe, r }: { base: string; pipe: ResearchPipe; r: ResearchRef }) {
  return <CatalogueName kind="llm" variant="chip" name={r.label} href={r.linked ? researchCatalogHref(base, pipe, "models", r.key) : null} />;
}

/**
 * The Templates list's right panel (owner 2026-10-21): the selected template's workflows and models,
 * each opening its page; its figures; its last 4 email sequences; and its page.
 */
export function TemplateOutputsPanel({
  t,
  href,
  base,
  pipe,
  catalog,
  outcome,
  onClose,
}: {
  t: ResearchTemplate;
  href: string;
  base: string;
  pipe: ResearchPipe;
  catalog: ResearchCatalog | null;
  outcome: OutcomeWords;
  onClose: () => void;
}) {
  const read = useTemplateRowOutputs(t, 4);
  const models = templateModels(catalog, pipe, t);
  return (
    <ResearchDrawer
      label={t.label}
      onClose={onClose}
      head={
        <div className="flex min-w-0 items-center gap-2.5">
          <CatalogueObjectMark kind="template" name={t.label} icon={t.icon ?? null} color={t.color ?? null} size={36} />
          <div className="min-w-0">
            <p className="k-label">Template</p>
            <p className="truncate text-[14px] font-medium" title={t.label}>
              {t.label}
            </p>
          </div>
        </div>
      }
      footer={
        <Link href={href} onClick={onClose} className="k-btn inline-flex items-center gap-1.5">
          Open template page
          <Arrow />
        </Link>
      }
    >
      <div className="border-b border-[var(--line-subtle)] px-4 py-3">
        {t.dynasty?.description && <p className="k-fg2 mb-3 text-[13px] leading-5">{t.dynasty.description}</p>}
        <TemplateFigures f={t} outcome={outcome} />
      </div>
      <div className="space-y-4 border-b border-[var(--line-subtle)] px-4 py-3">
        <div>
          <p className="k-label">Workflows</p>
          {t.workflows.length ? (
            <ul className="mt-1.5 space-y-0.5 text-[13px]">
              {t.workflows.map((w) => (
                <li key={w.key}>
                  <Link href={researchCatalogHref(base, pipe, "workflows", w.key)} onClick={onClose} className="k-hover -mx-2 flex items-center gap-2 rounded-[8px] px-2 py-1" title={w.label}>
                    <CatalogueName kind="workflow" name={w.label} servedKey={w.key} className="flex-1" />
                    <Arrow />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="k-fg3 mt-1.5 text-[12px]">No workflow writes most of its emails with it.</p>
          )}
        </div>
        <div>
          <p className="k-label">Written with</p>
          {models.length ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {models.map((m) => (
                <ModelTag key={m.key} base={base} pipe={pipe} r={m} />
              ))}
            </div>
          ) : (
            <p className="k-fg3 mt-1.5 text-[12px]">No model on record yet.</p>
          )}
        </div>
      </div>
      <p className="k-label px-4 pt-3">Last 4 email sequences</p>
      <OutputsList read={read} />
    </ResearchDrawer>
  );
}

/** The open layers, newest last: Esc closes only the top one (a run's email opened over a workflow drawer). */
const openLayers: object[] = [];

/** Portals to the shell's own layer (a transformed ancestor traps `fixed`), and closes on Esc. */
function V2Layer({ onEscape, children }: { onEscape: () => void; children: React.ReactNode }) {
  const id = useRef({});
  useEffect(() => {
    const me = id.current;
    openLayers.push(me);
    return () => {
      const i = openLayers.indexOf(me);
      if (i !== -1) openLayers.splice(i, 1);
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && openLayers[openLayers.length - 1] === id.current) {
        e.preventDefault();
        onEscape();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEscape]);
  const host = typeof document === "undefined" ? null : (document.getElementById("v2-portal") ?? document.body);
  return host ? createPortal(children, host) : null;
}

/**
 * One version of a dynasty in a drawer sliding in from the right (owner 2026-10-21): its figures,
 * its last 5 emails, and its own page.
 */
export function TemplateVersionDrawer({
  version,
  dynastyLabel,
  href,
  status,
  outcome,
  onClose,
}: {
  version: ResearchFigures & { key: string; label: string; head: boolean };
  dynastyLabel: string;
  href: string;
  status: React.ReactNode;
  outcome: OutcomeWords;
  onClose: () => void;
}) {
  const read = useTemplateOutputs(version.key, 5);
  return (
    <ResearchDrawer
      label={`Version ${version.label}`}
      onClose={onClose}
      head={
        <>
          <p className="k-label">Version</p>
          <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium">
            <span className="k-mono truncate" title={version.key}>
              {version.label}
            </span>
            {version.head && <span className="k-chip shrink-0">Head</span>}
          </p>
          <p className="k-fg3 truncate text-[12px]">Version of {dynastyLabel}</p>
        </>
      }
      right={status}
      footer={
        <Link href={href} onClick={onClose} className="k-btn inline-flex items-center gap-1.5">
          Open version page
          <Arrow />
        </Link>
      }
    >
      <div className="border-b border-[var(--line-subtle)] px-4 py-3">
        <TemplateFigures f={version} outcome={outcome} more />
      </div>
      <p className="k-label px-4 pt-3">Last 5 emails</p>
      <OutputsList read={read} />
    </ResearchDrawer>
  );
}

/**
 * The Research right drawer (owner 2026-10-21): a `k-popover` sliding in from the right, portalled
 * to the shell's layer, Esc or a click outside closes it. Header (`head` + `right` + ×), a scrolling
 * body, a footer. One shell for every Research drawer (template version, workflow).
 */
export function ResearchDrawer({
  label,
  onClose,
  head,
  right,
  footer,
  children,
}: {
  label: string;
  onClose: () => void;
  head: React.ReactNode;
  right?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <V2Layer onEscape={onClose}>
      <div className="fixed inset-0 z-[60] bg-[#1010121f]" onMouseDown={onClose}>
        <div
          role="dialog"
          aria-label={label}
          className="k-popover k-drawer-in fixed inset-y-0 right-0 flex w-full flex-col overflow-hidden rounded-none md:inset-y-2 md:right-2 md:w-[30rem] md:max-w-[94vw] md:rounded-[12px]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 border-b border-[var(--line-subtle)] px-4 py-2.5">
            <div className="min-w-0">{head}</div>
            <div className="ml-auto flex items-center gap-2">
              {right}
              <button type="button" onClick={onClose} aria-label="Close" className="k-btn-ghost h-7 w-7 justify-center px-0">
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
          <div className="k-scroll min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer && <div className="border-t border-[var(--line-subtle)] px-4 py-2.5">{footer}</div>}
        </div>
      </div>
    </V2Layer>
  );
}

/** A workflow dynasty's latest runs that wrote an email, every client, newest first (content-generation-service). */
export function useWorkflowRuns(slug: string, limit: number) {
  const q = useAuthQuery(["workflowDynastyOutputs", slug, limit], () => getWorkflowDynastyOutputs(slug, limit), { ...pollOptions, retry: false });
  return { runs: q.data, answered: q.data !== undefined || q.isFetchedAfterMount };
}

/** A run's template as its dynasty name and version ("Blind Intro Offer v6"); its raw type outside any dynasty. */
export function runTemplateText(o: Pick<WorkflowRunOutput, "templateDynasty" | "promptType">): string | null {
  if (o.templateDynasty) return `${o.templateDynasty.name} v${o.templateDynasty.position}`;
  return o.promptType;
}

/**
 * "Recent runs" (owner 2026-10-22), on the workflow drawer and the workflow page: newest first, each
 * with its date, the workflow version it ran on, template and LLM. A click opens the email it wrote in the Research drawer, as the
 * template panels list them (`OutputsList`). Names no client and no campaign.
 */
export function RecentRuns({ slug, limit }: { slug: string; limit: number }) {
  const read = useWorkflowRuns(slug, limit);
  const [open, setOpen] = useState<WorkflowRunOutput | null>(null);
  if (!read.answered) {
    return (
      <div className="space-y-2 px-4 py-3">
        {[0, 1, 2].map((i) => (
          <Shimmer key={i} className="h-4 w-full" />
        ))}
      </div>
    );
  }
  if (read.runs === undefined) return <EmptyNote>We could not read its recent runs just now. It retries on its own.</EmptyNote>;
  if (read.runs.length === 0) return <EmptyNote>No run of this workflow wrote an email yet.</EmptyNote>;
  return (
    <>
      <ol className="divide-y divide-[var(--line-subtle)]">
        {read.runs.map((o) => {
          const template = runTemplateText(o);
          return (
            <li key={o.generationId}>
              <button
                type="button"
                onClick={() => setOpen(o)}
                className="k-row flex w-full min-w-0 items-center gap-2 px-4 py-2 text-left"
                title="Open the email it wrote"
              >
                <span className="k-mono k-fg2 w-[136px] shrink-0 text-[12px]">{instantText(o.createdAt)}</span>
                <span className="k-mono k-fg3 w-8 shrink-0 truncate text-[12px]" title={`Workflow version ${o.workflowSlug}`}>
                  {runVersionLabel(slug, o.workflowSlug)}
                </span>
                {o.templateDynasty ? (
                  <CatalogueName kind="template" variant="chip" name={o.templateDynasty.name} version={`v${o.templateDynasty.position}`} servedKey={o.templateDynasty.slug} className="min-w-0" />
                ) : template ? (
                  <CatalogueName kind="template" variant="chip" name={template} servedKey={o.promptType} className="min-w-0" />
                ) : (
                  <span className="k-chip k-fg3 min-w-0 truncate">No template on record</span>
                )}
                <CatalogueName kind="llm" variant="chip" name={o.model} className="ml-auto min-w-0 shrink-0" />
                <Arrow />
              </button>
            </li>
          );
        })}
      </ol>
      {open && (
        <ResearchDrawer
          label="Run"
          onClose={() => setOpen(null)}
          head={
            <>
              <p className="k-label">Run</p>
              <p className="truncate text-[13px] font-medium">{runTemplateText(open) ?? instantText(open.createdAt)}</p>
              <p className="k-fg3 truncate text-[12px]" title={open.workflowSlug}>
                Workflow version {runVersionLabel(slug, open.workflowSlug)}
              </p>
            </>
          }
        >
          <OutputsList read={{ outputs: [open], answered: true }} expanded />
        </ResearchDrawer>
      )}
    </>
  );
}

function OutputItem({ o, expanded }: { o: TemplateOutput; expanded: boolean }) {
  const [open, setOpen] = useState(expanded);
  const first = o.emails[0] ?? null;
  const rest = o.emails.slice(1);
  return (
    <li className="px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="k-mono k-fg3 shrink-0 text-[11.5px]">{instantText(o.createdAt)}</span>
        {"promptType" in o && typeof o.promptType === "string" && (
          <CatalogueName kind="template" variant="chip" name={o.promptType} servedKey={o.promptType} className="ml-auto min-w-0" />
        )}
        <CatalogueName kind="llm" variant="chip" name={o.model} className={`min-w-0 ${"promptType" in o ? "" : "ml-auto"}`} />
      </div>
      <p className="mt-1.5 text-[13px] font-medium leading-5">{o.subject ?? <span className="k-fg4">No subject</span>}</p>
      {first ? (
        <p className={`k-fg2 mt-1 whitespace-pre-wrap break-words text-[12.5px] leading-[19px] ${open ? "" : "line-clamp-6"}`}>{first.bodyText}</p>
      ) : (
        <p className="k-fg3 mt-1 text-[12px]">No copy stored for this one.</p>
      )}
      {open &&
        rest.map((e) => (
          <div key={e.step} className="mt-3">
            <p className="k-label">
              Follow-up {e.step - 1}
              {e.daysSinceLastStep != null ? `, ${e.daysSinceLastStep} ${e.daysSinceLastStep === 1 ? "day" : "days"} later` : ""}
            </p>
            <p className="k-fg2 mt-1 whitespace-pre-wrap break-words text-[12.5px] leading-[19px]">{e.bodyText}</p>
          </div>
        ))}
      {first && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="k-btn-ghost mt-1.5 h-6 px-1.5 text-[12px]">
          {open ? "Show less" : rest.length ? `Show all and ${rest.length} ${rest.length === 1 ? "follow-up" : "follow-ups"}` : "Show all"}
        </button>
      )}
    </li>
  );
}
