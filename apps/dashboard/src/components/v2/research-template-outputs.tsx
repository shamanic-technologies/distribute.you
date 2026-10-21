"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useAuthQuery } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import { getTemplateDynastyOutputs, getTemplateOutputs, type TemplateOutput } from "@/lib/api";
import { EmptyNote, Shimmer } from "@/components/v2/ui";
import { RoiLabel, RoiValue } from "@/components/v2/roi-label";
import { Arrow, TopicMark, instantText } from "@/components/v2/research-bits";
import { modelTagFromName } from "@/lib/written-by";
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

/** Outputs as a list: subject and each email as sent, never a client or a lead. */
export function OutputsList({ read }: { read: ReturnType<typeof useTemplateOutputs> }) {
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
        <OutputItem key={o.generationId} o={o} />
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

/** A model as a tag that opens its page: the product mark (Claude, Gemini) and its name. */
function ModelTag({ base, pipe, r }: { base: string; pipe: ResearchPipe; r: ResearchRef }) {
  const tag = modelTagFromName(r.label);
  const body = (
    <>
      {tag.logoSrc ? <img src={tag.logoSrc} alt="" width={12} height={12} className="shrink-0" /> : <TopicMark topic="llm" size={14} />}
      <span className="truncate">{tag.logoSrc ? tag.label : r.label}</span>
    </>
  );
  return r.linked ? (
    <Link href={researchCatalogHref(base, pipe, "models", r.key)} title={r.label} className="k-chip inline-flex min-w-0 max-w-full items-center gap-1 hover:text-[var(--accent)]">
      {body}
    </Link>
  ) : (
    <span title={r.label} className="k-chip inline-flex min-w-0 max-w-full items-center gap-1">
      {body}
    </span>
  );
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
}: {
  t: ResearchTemplate;
  href: string;
  base: string;
  pipe: ResearchPipe;
  catalog: ResearchCatalog | null;
  outcome: OutcomeWords;
}) {
  const read = useTemplateRowOutputs(t, 4);
  const models = templateModels(catalog, pipe, t);
  return (
    <aside className="k-card flex h-fit min-h-0 flex-col self-start overflow-hidden lg:sticky lg:top-4 lg:max-h-[calc(100vh-120px)]">
      <div className="border-b border-[var(--line-subtle)] px-4 py-3">
        <p className="k-label">Template</p>
        <Link href={href} className="mt-1 block truncate text-[14px] font-medium hover:text-[var(--accent)]" title={t.label}>
          {t.label}
        </Link>
        <div className="mt-3">
          <TemplateFigures f={t} outcome={outcome} />
        </div>
      </div>
      <div className="k-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 border-b border-[var(--line-subtle)] px-4 py-3">
          <div>
            <p className="k-label">Workflows</p>
            {t.workflows.length ? (
              <ul className="mt-1.5 space-y-0.5 text-[13px]">
                {t.workflows.map((w) => (
                  <li key={w.key}>
                    <Link href={researchCatalogHref(base, pipe, "workflows", w.key)} className="k-hover -mx-2 flex items-center gap-2 rounded-[8px] px-2 py-1" title={w.label}>
                      <TopicMark topic="workflow" size={18} />
                      <span className="min-w-0 flex-1 truncate">{w.label}</span>
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
      </div>
      <div className="border-t border-[var(--line-subtle)] px-4 py-2.5">
        <Link href={href} className="k-btn inline-flex items-center gap-1.5">
          Open template page
          <Arrow />
        </Link>
      </div>
    </aside>
  );
}

/** Portals to the shell's own layer (a transformed ancestor traps `fixed`), and closes on Esc. */
function V2Layer({ onEscape, children }: { onEscape: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
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
    <V2Layer onEscape={onClose}>
      <div className="fixed inset-0 z-[60] bg-[#1010121f]" onMouseDown={onClose}>
        <div
          role="dialog"
          aria-label={`Version ${version.label}`}
          className="k-popover k-drawer-in fixed inset-y-0 right-0 flex w-full flex-col overflow-hidden rounded-none md:inset-y-2 md:right-2 md:w-[30rem] md:max-w-[94vw] md:rounded-[12px]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 border-b border-[var(--line-subtle)] px-4 py-2.5">
            <div className="min-w-0">
              <p className="k-label">Version</p>
              <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium">
                <span className="k-mono truncate" title={version.key}>
                  {version.label}
                </span>
                {version.head && <span className="k-chip shrink-0">Head</span>}
              </p>
              <p className="k-fg3 truncate text-[12px]">Version of {dynastyLabel}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {status}
              <button type="button" onClick={onClose} aria-label="Close" className="k-btn-ghost h-7 w-7 justify-center px-0">
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
          <div className="k-scroll min-h-0 flex-1 overflow-y-auto">
            <div className="border-b border-[var(--line-subtle)] px-4 py-3">
              <TemplateFigures f={version} outcome={outcome} more />
            </div>
            <p className="k-label px-4 pt-3">Last 5 emails</p>
            <OutputsList read={read} />
          </div>
          <div className="border-t border-[var(--line-subtle)] px-4 py-2.5">
            <Link href={href} onClick={onClose} className="k-btn inline-flex items-center gap-1.5">
              Open version page
              <Arrow />
            </Link>
          </div>
        </div>
      </div>
    </V2Layer>
  );
}

function OutputItem({ o }: { o: TemplateOutput }) {
  const [open, setOpen] = useState(false);
  const first = o.emails[0] ?? null;
  const rest = o.emails.slice(1);
  return (
    <li className="px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="k-mono k-fg3 shrink-0 text-[11.5px]">{instantText(o.createdAt)}</span>
        {"promptType" in o && typeof o.promptType === "string" && (
          <span className="k-chip ml-auto min-w-0 truncate" title={`Version ${o.promptType}`}>
            {o.promptType}
          </span>
        )}
        <span className={`k-chip min-w-0 truncate ${"promptType" in o ? "" : "ml-auto"}`} title={o.model}>
          {o.model}
        </span>
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
