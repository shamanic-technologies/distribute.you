"use client";

import { useResearch, useResearchPipeEntry } from "@/lib/research/research-source";
import type { ResearchPipe } from "@/lib/research/research";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQueries } from "@tanstack/react-query";
import { useAuthQuery, useOrgQueryGate, useQueryClient } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import {
  ApiError,
  getContentModelStatuses,
  getContentTemplateStatuses,
  getLegWorkflowRanking,
  legWorkflowRankingKey,
  getRunnableWorkflowDynasties,
  getRunnableWorkflowDynastySummaries,
  getWorkflowDynastyDeprecation,
  retireWorkflowsByContent,
  setContentModelStatus,
  setContentTemplateStatus,
  setWorkflowDynastyStatus,
  type CatalogueStatusChange,
} from "@/lib/api";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { legFor } from "@/lib/legs";
import { isProactiveFrom } from "@/lib/outbound-leg-key";
import { formatUsdAdaptive } from "@/lib/format-number";
import { Shimmer } from "@/components/v2/ui";
import { SectionMark, SectionName } from "@/components/v2/research-bits";
import { InfoTooltip } from "@/components/visibility/metric-info";
import {
  aliasList,
  contentDeprecation,
  deprecationLine,
  modelDeprecation,
  modelStatusOnPipe,
  statusWord,
  type ContentTarget,
  type DeprecationFacts,
  type ModelPipe,
} from "@/lib/research/content-status";

/**
 * Staff status of a template, a writer model or a workflow on the Research pages
 * (TEMPLATE-MODEL-STATUS-1019, owner 2026-10-19). One status for every client: there is no
 * per-brand status. Deprecating a template or a model shows, first, every workflow that would
 * stop with it (a dry run of workflow-service's retire-by-content), each with its outcomes,
 * cost per outcome and status; confirming deprecates it AND retires those workflows. Setting it
 * active again touches its status only: the workflows stay deprecated, set back by hand.
 * Every deprecation states WHY (DEPRECATION-REASON-1020, owner 2026-10-20): Confirm stays off
 * until the "Why?" box holds text, and every deprecated row and page prints the served reason,
 * who and when.
 */

const STATUS_ROOTS = {
  templates: ["contentTemplateStatuses"],
  models: ["contentModelStatuses"],
} as const;

/** Template type -> status (and why it was deprecated), as content-generation-service states it. */
export function useTemplateStatuses() {
  const q = useAuthQuery([...STATUS_ROOTS.templates], getContentTemplateStatuses, { ...pollOptions, retry: false });
  const map = useMemo(() => new Map((q.data ?? []).map((t) => [t.type, t.status])), [q.data]);
  const why = useMemo(() => new Map((q.data ?? []).map((t) => [t.type, contentDeprecation(t)])), [q.data]);
  const deprecationOf = (type: string): DeprecationFacts[] | null => {
    const d = why.get(type);
    return d ? [d] : null;
  };
  return { map, deprecationOf, answered: q.data !== undefined || q.isFetchedAfterMount, failed: q.data === undefined && q.isError };
}

/**
 * The pipe a Research pipe's model status is read and written on: its channel x its leg, from the
 * pipe catalogue the page already reads. Null while the leg catalogue has not answered.
 */
export function useResearchModelPipe(pipe: ResearchPipe | null): ModelPipe | null {
  const entry = useResearchPipeEntry(pipe);
  const leg = legFor(useLegCatalogue(), entry?.leg ?? null);
  return useMemo(() => (entry?.channel && leg ? { featureSlug: entry.channel, legKey: leg.legKey } : null), [entry?.channel, leg]);
}

/**
 * Model ALIAS -> status ON ONE PIPE (LLM-STATUS-PER-PIPE-1023, owner 2026-10-23): a model deprecated on
 * Lead → Website visit stays active on every other pipe. A model's deprecation reads every alias it is
 * served under, on that pipe. Not answered until the pipe is known, so no row lands in the wrong tab.
 */
export function useModelStatuses(pipe: ModelPipe | null) {
  const q = useAuthQuery([...STATUS_ROOTS.models], getContentModelStatuses, { ...pollOptions, retry: false });
  const onPipe = useMemo(
    () => (pipe ? new Map((q.data ?? []).map((m) => [m.model, modelStatusOnPipe(m, pipe)])) : new Map<string, ReturnType<typeof modelStatusOnPipe>>()),
    [q.data, pipe],
  );
  const map = useMemo(() => new Map([...onPipe].map(([alias, s]) => [alias, s.status])), [onPipe]);
  const deprecationOf = (aliases: readonly string[]) => modelDeprecation(aliases, (a) => onPipe.get(a)?.deprecation ?? null);
  return {
    map,
    deprecationOf,
    rows: q.data ?? null,
    answered: pipe !== null && (q.data !== undefined || q.isFetchedAfterMount),
    failed: q.data === undefined && q.isError,
  };
}

/**
 * A workflow's status: Active while workflow-service can run it, else Deprecated (one channel).
 * The same read states what a runnable workflow does (`descriptionOf`, workflow-service's words).
 */
export function useDynastyStatuses(featureSlug: string) {
  const q = useAuthQuery(["workflowDynastySummaries", featureSlug], () => getRunnableWorkflowDynastySummaries(featureSlug), { ...pollOptions, retry: false });
  const runnable = useMemo(() => (q.data ? new Map(q.data.map((d) => [d.slug, d])) : null), [q.data]);
  const statusOf = (slug: string): string | null => (runnable ? (runnable.has(slug) ? "active" : "deprecated") : null);
  const descriptionOf = (slug: string): string | null => runnable?.get(slug)?.description ?? null;
  // What sets it apart from its pipe siblings, as workflow-service states it (WF-SHORT-LINE-1023).
  const siblingsOf = (slug: string) => runnable?.get(slug) ?? null;
  return { statusOf, descriptionOf, siblingsOf, answered: q.data !== undefined || q.isFetchedAfterMount };
}

/**
 * Why, who and when a workflow was deprecated (workflow-service, its newest version). Read only
 * where it shows (a deprecated row, a workflow page) and re-read after each status write; no poll:
 * it changes only through a write, which refetches it.
 */
export function useWorkflowDeprecation(slug: string, enabled = true) {
  const q = useAuthQuery(["workflowDynastyDeprecation", slug], () => getWorkflowDynastyDeprecation(slug), { enabled, retry: false });
  return {
    deprecation: q.data?.deprecation ? [q.data.deprecation] : null,
    // What its newest version does (workflow-service's words): a deprecated row's Description.
    description: q.data?.description ?? null,
    siblings: q.data ?? null,
    answered: !enabled || q.data !== undefined || q.isError,
  };
}

// ─── The status cell ─────────────────────────────────────────────────────────

/**
 * "Active" (green dot) or "Deprecated" (hollow dot); `gap` is the plain reason a model has no
 * status (retired, unknown to chat-service), printed instead of a blank; a dash when nothing states one.
 */
export function StatusWord({
  status,
  pending = false,
  gap = null,
  deprecation = null,
}: {
  status: string | null | undefined;
  pending?: boolean;
  gap?: string | null;
  /** Deprecated: why, who and when, printed under the word; the (i) beside it opens the full text (hover or tap). */
  deprecation?: DeprecationFacts[] | null;
}) {
  if (gap) {
    return (
      <span className="k-fg3 block min-w-0 truncate text-[12px]" title={gap}>
        {gap}
      </span>
    );
  }
  if (pending) return <Shimmer className="inline-block h-3.5 w-16 align-middle" />;
  const word = statusWord(status);
  if (!word) return <span className="k-fg4">{"—"}</span>;
  if (word === "Deprecated" && deprecation?.length) {
    const why = deprecation.map(deprecationLine).join(" · ");
    return (
      <span className="block min-w-0 leading-4">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--fg-2)]">
          <span className="h-2 w-2 rounded-full border-[1.5px] border-[var(--fg-3)]" />
          Deprecated
          <InfoTooltip tip={why} placement="bottom" />
        </span>
        <span className="k-fg3 block truncate text-[11.5px]">{why}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--fg-2)]">
      {word === "Active" ? (
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--run)]" />
      ) : (
        <span className="h-2 w-2 rounded-full border-[1.5px] border-[var(--fg-3)]" />
      )}
      {word}
    </span>
  );
}

// ─── The ⋮ menu ──────────────────────────────────────────────────────────────

/**
 * The row's three vertical dots: one item, the other status, with one line saying what it does.
 * Portalled and `fixed` against the button (the card table clips an absolute menu).
 */
export function StatusMenu({
  status,
  label,
  onDeprecate,
  onActivate,
  deprecateNote,
  activateNote,
}: {
  status: string | null | undefined;
  label: string;
  onDeprecate: () => void | Promise<void>;
  onActivate: () => Promise<void>;
  deprecateNote: string;
  activateNote: string;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const word = statusWord(status);

  useEffect(() => {
    if (!at) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) setAt(null);
    };
    const dismiss = () => setAt(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAt(null);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    document.addEventListener("scroll", dismiss, { capture: true, passive: true });
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("scroll", dismiss, { capture: true });
      window.removeEventListener("resize", dismiss);
    };
  }, [at]);

  const open = () => {
    if (at) return setAt(null);
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const right = window.innerWidth - r.right;
    setAt(window.innerHeight - r.bottom < 140 ? { bottom: window.innerHeight - r.top + 4, right } : { top: r.bottom + 4, right });
  };

  const run = async (action: () => void | Promise<void>) => {
    setAt(null);
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (err) {
      console.error("[research status] status change failed", { label, err });
      setError(writeErrorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-end" onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={Boolean(at)}
        aria-label={`Change the status of ${label}`}
        disabled={busy || !word}
        onClick={open}
        className={`k-btn-ghost inline-flex h-6 w-6 justify-center px-0 ${busy ? "cursor-wait" : "disabled:opacity-40"}`}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <circle cx="6" cy="2.5" r="1.1" fill="currentColor" />
          <circle cx="6" cy="6" r="1.1" fill="currentColor" />
          <circle cx="6" cy="9.5" r="1.1" fill="currentColor" />
        </svg>
      </button>
      {at &&
        createPortal(
          <div ref={menuRef} role="menu" style={at} className="k-popover fixed z-50 w-[260px] p-1 text-left">
            {word === "Active" ? (
              <button
                type="button"
                role="menuitem"
                className="k-row w-full rounded-[6px] px-2 py-1.5 text-left"
                onClick={() => run(onDeprecate)}
              >
                <span className="block text-[13px]">Deprecate</span>
                <span className="k-fg3 block text-[12px] leading-[17px]">{deprecateNote}</span>
              </button>
            ) : (
              <button type="button" role="menuitem" className="k-row w-full rounded-[6px] px-2 py-1.5 text-left" onClick={() => run(onActivate)}>
                <span className="block text-[13px]">Set active</span>
                <span className="k-fg3 block text-[12px] leading-[17px]">{activateNote}</span>
              </button>
            )}
          </div>,
          document.getElementById("v2-portal") ?? document.body,
        )}
      {error && <span className="mt-1 max-w-[200px] text-right text-[11.5px] text-[var(--data-rose)]">{error}</span>}
    </span>
  );
}

function writeErrorText(err: unknown): string {
  if (err instanceof ApiError && err.status === 403) return "Only staff can change this.";
  return "We could not change it just now. Try again.";
}

/** Every read a status write moves: the statuses, the workflows' own (and why), the live rankings. */
async function refetchAfterWrite(qc: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    qc.refetchQueries({ queryKey: [...STATUS_ROOTS.templates] }),
    qc.refetchQueries({ queryKey: [...STATUS_ROOTS.models] }),
    qc.refetchQueries({ queryKey: ["workflowDynastyStatuses"] }),
    qc.refetchQueries({ queryKey: ["workflowDynastySummaries"] }),
    qc.invalidateQueries({ queryKey: ["workflowDynastyDeprecation"] }),
    qc.invalidateQueries({ queryKey: ["legWorkflowRanking"] }),
  ]);
}

// ─── Template and model rows ─────────────────────────────────────────────────

/** Status + ⋮ for one template or model; the deprecate path opens the confirmation. */
export function useContentStatusWrites() {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState<ContentTarget | null>(null);
  const activate = async (t: ContentTarget) => {
    if (t.kind === "template") await setContentTemplateStatus(t.key, { status: "active" });
    else for (const alias of t.aliases) await setContentModelStatus(alias, t.pipe, { status: "active" });
    await refetchAfterWrite(qc);
  };
  const modal = confirming ? <DeprecateContentModal target={confirming} onClose={() => setConfirming(null)} /> : null;
  return { activate, askDeprecate: setConfirming, modal };
}

export const ACTIVATE_CONTENT_NOTE = "Its workflows stay deprecated: set each one active by hand.";
export const DEPRECATE_CONTENT_NOTE = "Shows every workflow that writes with it, then stops them all.";
export const ACTIVATE_MODEL_NOTE = "On this pipe only. Its workflows stay deprecated: set each one active by hand.";
export const DEPRECATE_MODEL_NOTE = "On this pipe only: stops its workflows here, every other pipe keeps it.";

/** The menu note for a target: a model served under several aliases names each one the click changes. */
export function contentNote(t: ContentTarget, note: string): string {
  return t.kind === "model" && t.aliases.length > 1 ? `Changes ${aliasList(t.aliases)}. ${note}` : note;
}

/** One workflow's figures on the leg it runs on (the Research live rankings), for the modal. */
function useFleetFigures(): { byslug: Map<string, { outcomes: number; cost: number | null }>; answered: boolean } {
  const legs = useLegCatalogue();
  // Every pipe the Research file serves, in its order.
  const pairs = useResearch().file.pipes.map((p) => {
    const leg = legFor(legs, p.leg);
    return leg && isProactiveFrom(leg.fromKey) ? { featureSlug: p.channel, legKey: leg.legKey } : null;
  }).filter((x): x is { featureSlug: string; legKey: string } => x !== null);
  const gate = useOrgQueryGate();
  const results = useQueries({
    queries: pairs.map((p) => ({
      enabled: gate,
      queryKey: legWorkflowRankingKey(p.featureSlug, p.legKey),
      queryFn: () => getLegWorkflowRanking(p.featureSlug, p.legKey),
      retry: false,
    })),
  });
  const byslug = new Map<string, { outcomes: number; cost: number | null }>();
  for (const r of results) {
    for (const row of r.data?.rows ?? []) {
      // A workflow sits on one leg at a time; a row with spend wins over an empty one on another leg.
      const had = byslug.get(row.workflowDynastySlug);
      if (!had || (had.outcomes === 0 && row.outcomes > 0)) byslug.set(row.workflowDynastySlug, { outcomes: row.outcomes, cost: row.costPerOutcomeUsd });
    }
  }
  return { byslug, answered: pairs.length > 0 && results.every((r) => r.data !== undefined || r.isError) };
}

/**
 * "Deprecate <template|model>?": the workflows a dry run says would stop, each with its outcomes,
 * cost per outcome and status; confirming sets the status AND retires them. Nothing is computed
 * here: the list is workflow-service's, the figures the fleet ranking's, the status the dynasty's.
 */
export function DeprecateContentModal({ target, onClose }: { target: ContentTarget; onClose: () => void }) {
  const qc = useQueryClient();
  // One retire-by-content body per template, or per alias of the model (a model can be served under two).
  // A model is deprecated on ONE pipe (owner 2026-10-23), so its list narrows to the pipe's channel, then to
  // the workflows the pipe's own leg ranking lists: a workflow on another leg of the channel keeps running.
  const bodies =
    target.kind === "template" ? [{ promptType: target.key }] : target.aliases.map((model) => ({ model, featureSlug: target.pipe.featureSlug }));
  const previewKey = target.kind === "template" ? [target.key] : [target.pipe.featureSlug, target.pipe.legKey, ...target.aliases];
  const preview = useAuthQuery(
    ["retireByContentPreview", target.kind, ...previewKey],
    async () => {
      const [lists, onLeg] = await Promise.all([
        Promise.all(bodies.map((b) => retireWorkflowsByContent(b, { dryRun: true }))),
        target.kind === "model"
          ? getLegWorkflowRanking(target.pipe.featureSlug, target.pipe.legKey).then((r) => new Set(r.rows.map((row) => row.workflowDynastySlug)))
          : Promise.resolve(null),
      ]);
      const seen = new Set<string>();
      return {
        workflows: lists
          .flatMap((l) => l.workflows)
          .filter((w) => (onLeg ? onLeg.has(w.workflowDynastySlug) : true))
          .filter((w) => !seen.has(w.workflowDynastySlug) && (seen.add(w.workflowDynastySlug), true)),
      };
    },
    { retry: false, staleTime: 0 },
  );
  const figures = useFleetFigures();
  const gate = useOrgQueryGate();
  const featureSlugs = [...new Set((preview.data?.workflows ?? []).map((w) => w.featureSlug))];
  const statuses = useQueries({
    queries: featureSlugs.map((f) => ({ queryKey: ["workflowDynastyStatuses", f], queryFn: () => getRunnableWorkflowDynasties(f), retry: false, enabled: gate })),
  });
  const statusOf = (slug: string, featureSlug: string) => {
    const s = statuses[featureSlugs.indexOf(featureSlug)];
    return s?.data ? (s.data.includes(slug) ? "active" : "deprecated") : null;
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [why, setWhy] = useState("");
  const reason = why.trim();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const rows = preview.data?.workflows ?? [];
  const n = rows.length;
  const what = target.kind === "template" ? "template" : "model";

  const confirm = async () => {
    if (!reason) return;
    setBusy(true);
    setError(null);
    let statusSet = false;
    const change = { status: "deprecated", reason } satisfies CatalogueStatusChange;
    // Each workflow it stops records why: this deprecation, named, with the staff member's words.
    const workflowReason = `Uses deprecated ${what} ${target.label}: ${reason}`;
    try {
      if (target.kind === "template") await setContentTemplateStatus(target.key, change);
      else for (const alias of target.aliases) await setContentModelStatus(alias, target.pipe, change);
      statusSet = true;
      if (target.kind === "template") for (const b of bodies) await retireWorkflowsByContent(b, { dryRun: false, reason: workflowReason });
      // A model stops only the workflows the confirmation listed (this pipe's), one dynasty at a time:
      // retire-by-content narrows to a channel, never to a leg.
      else for (const w of rows) await setWorkflowDynastyStatus(w.workflowDynastySlug, { status: "deprecated", reason: workflowReason });
      await refetchAfterWrite(qc);
      onClose();
    } catch (err) {
      console.error("[research status] deprecate failed", { target, statusSet, err });
      if (statusSet) {
        await refetchAfterWrite(qc).catch((e) => console.error("[research status] refetch after a partial deprecate failed", e));
        setError(`The ${what} is deprecated, but its workflows still run. Try again to stop them.`);
      } else {
        setError(writeErrorText(err));
      }
    } finally {
      setBusy(false);
    }
  };

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-[#1010121f] px-3 pt-[10vh]" onMouseDown={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="v2-deprecate-title"
        className="k-popover flex max-h-[80vh] w-full max-w-[620px] flex-col overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line-subtle)] px-4">
          <span id="v2-deprecate-title" className="k-label min-w-0 truncate">
            Deprecate {target.label}?
          </span>
          <button type="button" aria-label="Close" className="k-btn-ghost ml-auto h-7 w-7 justify-center p-0" onClick={onClose} disabled={busy}>
            ×
          </button>
        </div>
        <div className="k-scroll min-h-0 overflow-y-auto px-4 py-4">
          <p className="text-[13px] leading-5">
            {preview.data === undefined
              ? `Finding the workflows that write with this ${what}.`
              : n === 0
                ? `No running workflow writes with this ${what}. No new workflow can use it once deprecated.`
                : `${n === 1 ? "This workflow stops" : `These ${n} workflows stop`} for every client. No new workflow can use this ${what}${target.kind === "model" ? " on this pipe" : ""}.`}
          </p>
          {target.kind === "model" && (
            <p className="mt-2 inline-flex flex-wrap items-center gap-1.5 text-[13px] leading-5">
              On
              <span className="k-chip inline-flex items-center gap-1.5">
                <SectionMark section={{ pipe: target.researchPipe }} size={12} />
                <SectionName section={{ pipe: target.researchPipe }} />
              </span>
              only. Every other pipe keeps it.
            </p>
          )}
          {target.kind === "model" && target.aliases.length > 1 && (
            <p className="mt-2 text-[13px] leading-5">
              chat-service serves {target.label} under {target.aliases.length} aliases: {aliasList(target.aliases)}. This deprecates each of them.
            </p>
          )}
          {preview.isError && preview.data === undefined ? (
            <p role="alert" className="mt-3 text-[13px] text-[var(--data-rose)]">
              We could not list its workflows just now. Close and try again.
            </p>
          ) : n > 0 || preview.data === undefined ? (
            <div className="k-card mt-3 overflow-hidden">
              <table className="w-full table-fixed text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--line-subtle)]">
                    <th className="k-label px-3 py-2.5 text-left font-medium first:pl-4">Workflow</th>
                    <th className="k-label w-24 px-3 py-2.5 text-right font-medium">Outcomes</th>
                    <th className="k-label w-28 px-3 py-2.5 text-right font-medium">$ / outcome</th>
                    <th className="k-label w-28 px-3 py-2.5 pr-4 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.data === undefined
                    ? [0, 1, 2].map((i) => (
                        <tr key={i} className="k-row h-10">
                          <td colSpan={4} className="px-4">
                            <Shimmer className="h-4 w-full" />
                          </td>
                        </tr>
                      ))
                    : rows.map((w) => {
                        const f = figures.byslug.get(w.workflowDynastySlug);
                        return (
                          <tr key={w.workflowDynastySlug} className="k-row h-10">
                            <td className="max-w-0 truncate pl-4 pr-3 font-medium" title={w.workflowDynastyName}>
                              {w.workflowDynastyName}
                            </td>
                            <td className="px-3 text-right tabular-nums">
                              {f ? Math.round(f.outcomes).toLocaleString("en-US") : figures.answered ? <span className="k-fg4">{"—"}</span> : <Shimmer className="ml-auto h-3.5 w-8" />}
                            </td>
                            <td className="px-3 text-right tabular-nums">
                              {f?.cost != null ? formatUsdAdaptive(f.cost) : figures.answered || f ? <span className="k-fg4">{"—"}</span> : <Shimmer className="ml-auto h-3.5 w-12" />}
                            </td>
                            <td className="px-3 pr-4">
                              <StatusWord status={statusOf(w.workflowDynastySlug, w.featureSlug)} pending={statuses.some((s) => s.data === undefined && !s.isError)} />
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>
          ) : null}
          <p className="k-fg3 mt-3 text-[12px] leading-[18px]">Setting it active later brings no workflow back: set each one active by hand.</p>
          <WhyField value={why} onChange={setWhy} disabled={busy} what={what} />
          {error && (
            <p role="alert" className="mt-3 text-[13px] text-[var(--data-rose)]">
              {error}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--line-subtle)] px-4 py-3">
          <button type="button" onClick={onClose} disabled={busy} className="k-btn-ghost">
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy || preview.data === undefined || !reason}
            className={`k-btn-strong ${busy ? "cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-40"}`}
          >
            {busy ? "Deprecating..." : n > 0 ? `Deprecate ${n} ${n === 1 ? "workflow" : "workflows"}` : `Deprecate ${what}`}
          </button>
        </div>
      </div>
    </div>,
    document.getElementById("v2-portal") ?? document.body,
  );
}

// ─── Workflow rows ───────────────────────────────────────────────────────────

/** Status cell + ⋮ for one workflow dynasty (Research Workflows page); Deprecate asks why first. */
export function WorkflowStatusCells({ slug, label, statuses }: { slug: string; label: string; statuses: ReturnType<typeof useDynastyStatuses> }) {
  const qc = useQueryClient();
  const status = statuses.statusOf(slug);
  const why = useWorkflowDeprecation(slug, status === "deprecated");
  const [asking, setAsking] = useState(false);
  const write = async (change: CatalogueStatusChange) => {
    await setWorkflowDynastyStatus(slug, change);
    await refetchAfterWrite(qc);
  };
  return (
    <>
      <td className="max-w-0 px-3">
        <StatusWord status={status} pending={!statuses.answered} deprecation={why.deprecation} />
      </td>
      <td className="pl-1 pr-4 text-right">
        <StatusMenu
          status={status}
          label={label}
          onDeprecate={() => setAsking(true)}
          onActivate={() => write({ status: "active" })}
          deprecateNote="Stops it for every client."
          activateNote="Runs again for every campaign that picks it."
        />
        {asking && (
          <DeprecateWhyModal
            title={`Deprecate ${label}?`}
            body="It stops for every client, and no campaign picks it again."
            what="workflow"
            onClose={() => setAsking(false)}
            onConfirm={(reason) => write({ status: "deprecated", reason })}
          />
        )}
      </td>
    </>
  );
}

// ─── "Why?" ──────────────────────────────────────────────────────────────────

/** The required "Why?" box of every deprecation: its text is the reason the producer records. */
function WhyField({ value, onChange, disabled, what }: { value: string; onChange: (v: string) => void; disabled: boolean; what: string }) {
  return (
    <label className="mt-4 block">
      <span className="k-label">Why?</span>
      <textarea
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={3}
        maxLength={2000}
        placeholder={`Why this ${what} stops, for whoever reads it in six months`}
        className="k-inset mt-1.5 block w-full resize-y rounded-[8px] px-3 py-2 text-[13px] leading-5 outline-none placeholder:text-[var(--fg-4)] focus:ring-1 focus:ring-[var(--accent)]"
      />
    </label>
  );
}

/** A deprecation with nothing to list first (a workflow): one line, the "Why?" box, Confirm. */
export function DeprecateWhyModal({
  title,
  body,
  what,
  onClose,
  onConfirm,
}: {
  title: string;
  body: string;
  what: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reason = why.trim();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);
  const confirm = async () => {
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason);
      onClose();
    } catch (err) {
      console.error("[research status] deprecate failed", { title, err });
      setError(writeErrorText(err));
    } finally {
      setBusy(false);
    }
  };
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-[#1010121f] px-3 pt-[10vh]" onMouseDown={() => !busy && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="v2-deprecate-why-title"
        className="k-popover flex w-full max-w-[480px] flex-col overflow-hidden text-left"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line-subtle)] px-4">
          <span id="v2-deprecate-why-title" className="k-label min-w-0 truncate">
            {title}
          </span>
          <button type="button" aria-label="Close" className="k-btn-ghost ml-auto h-7 w-7 justify-center p-0" onClick={onClose} disabled={busy}>
            ×
          </button>
        </div>
        <div className="px-4 py-4">
          <p className="text-[13px] leading-5">{body}</p>
          <WhyField value={why} onChange={setWhy} disabled={busy} what={what} />
          {error && (
            <p role="alert" className="mt-3 text-[13px] text-[var(--data-rose)]">
              {error}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--line-subtle)] px-4 py-3">
          <button type="button" onClick={onClose} disabled={busy} className="k-btn-ghost">
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy || !reason}
            className={`k-btn-strong ${busy ? "cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-40"}`}
          >
            {busy ? "Deprecating..." : `Deprecate ${what}`}
          </button>
        </div>
      </div>
    </div>,
    document.getElementById("v2-portal") ?? document.body,
  );
}

/**
 * The line under a deprecated workflow, template or model page's title: why, who and when, in
 * full. Nothing while it runs or before its status is read.
 */
export function DeprecationNote({ deprecation }: { deprecation: DeprecationFacts[] | null }) {
  if (!deprecation?.length) return null;
  return (
    <div className="k-inset mt-4 flex items-start gap-2 rounded-[8px] px-3 py-2.5 text-[13px] leading-5">
      <span className="mt-[6px] h-2 w-2 shrink-0 rounded-full border-[1.5px] border-[var(--fg-3)]" />
      <div className="min-w-0">
        <span className="font-medium">Deprecated</span>
        {deprecation.map((d) => (
          <p key={deprecationLine(d)} className="k-fg2">
            {deprecationLine(d)}
          </p>
        ))}
      </div>
    </div>
  );
}

// ─── "+N more" ───────────────────────────────────────────────────────────────

/** The first item, then "+N more": hover (mouse) or tap (touch) lists every one. */
export function FirstAndMore({ items, label }: { items: { key: string; body: ReactNode }[]; label: string }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const open = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setAt({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 248)) });
  };
  const closeSoon = () => {
    closeTimer.current = setTimeout(() => setAt(null), 120);
  };
  useEffect(() => {
    if (!at) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAt(null);
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !popRef.current?.contains(t)) setAt(null);
    };
    const onScroll = () => setAt(null);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [at]);
  if (items.length === 0) return <span className="k-fg4">{"—"}</span>;
  const host = typeof document !== "undefined" ? document.getElementById("v2-portal") ?? document.body : null;
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <span className="inline-flex min-w-0 items-center gap-1.5 truncate">{items[0].body}</span>
      {items.length > 1 && (
        <button
          ref={btnRef}
          type="button"
          className="k-chip shrink-0"
          aria-expanded={Boolean(at)}
          onPointerEnter={(e) => e.pointerType === "mouse" && open()}
          onPointerLeave={(e) => e.pointerType === "mouse" && closeSoon()}
          onClick={() => (at ? setAt(null) : open())}
        >
          +{items.length - 1} more
        </button>
      )}
      {at && host
        ? createPortal(
            <div
              ref={popRef}
              role="dialog"
              aria-label={label}
              className="k-popover fixed z-50 w-60 p-3 text-[13px]"
              style={{ top: at.top, left: at.left }}
              onPointerEnter={(e) => e.pointerType === "mouse" && open()}
              onPointerLeave={(e) => e.pointerType === "mouse" && closeSoon()}
            >
              <p className="k-label">{label}</p>
              <ul className="mt-2 space-y-1.5">
                {items.map((it) => (
                  <li key={it.key} className="flex items-center gap-1.5">
                    {it.body}
                  </li>
                ))}
              </ul>
            </div>,
            host,
          )
        : null}
    </span>
  );
}

