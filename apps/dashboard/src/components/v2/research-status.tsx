"use client";

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
  getRunnableWorkflowDynasties,
  retireWorkflowsByContent,
  setContentModelStatus,
  setContentTemplateStatus,
  setWorkflowDynastyStatus,
  type CatalogueStatus,
} from "@/lib/api";
import { useLegCatalogue } from "@/lib/use-leg-catalogue";
import { legFor } from "@/lib/legs";
import { isProactiveFrom } from "@/lib/outbound-leg-key";
import { formatUsdAdaptive } from "@/lib/format-number";
import { Shimmer } from "@/components/v2/ui";
import { PIPE_KEY, PIPE_ORDER, type ResearchCatalog } from "@/lib/research/research";
import { modelAliases, statusWord, type ContentTarget } from "@/lib/research/content-status";

/**
 * Staff status of a template, a writer model or a workflow on the Research pages
 * (TEMPLATE-MODEL-STATUS-1019, owner 2026-10-19). One status for every client: there is no
 * per-brand status. Deprecating a template or a model shows, first, every workflow that would
 * stop with it (a dry run of workflow-service's retire-by-content), each with its outcomes,
 * cost per outcome and status; confirming deprecates it AND retires those workflows. Setting it
 * active again touches its status only: the workflows stay deprecated, set back by hand.
 */

const STATUS_ROOTS = {
  templates: ["contentTemplateStatuses"],
  models: ["contentModelStatuses"],
} as const;

/** Template type -> status, as content-generation-service states it. */
export function useTemplateStatuses() {
  const q = useAuthQuery([...STATUS_ROOTS.templates], getContentTemplateStatuses, { ...pollOptions, retry: false });
  const map = useMemo(() => new Map((q.data ?? []).map((t) => [t.type, t.status])), [q.data]);
  return { map, answered: q.data !== undefined || q.isFetchedAfterMount, failed: q.data === undefined && q.isError };
}

/** Model ALIAS -> status. */
export function useModelStatuses() {
  const q = useAuthQuery([...STATUS_ROOTS.models], getContentModelStatuses, { ...pollOptions, retry: false });
  const map = useMemo(() => new Map((q.data ?? []).map((m) => [m.model, m.status])), [q.data]);
  return { map, answered: q.data !== undefined || q.isFetchedAfterMount, failed: q.data === undefined && q.isError };
}

/** A workflow's status: Active while workflow-service can run it, else Deprecated (one channel). */
export function useDynastyStatuses(featureSlug: string) {
  const q = useAuthQuery(["workflowDynastyStatuses", featureSlug], () => getRunnableWorkflowDynasties(featureSlug), { ...pollOptions, retry: false });
  const runnable = useMemo(() => (q.data ? new Set(q.data) : null), [q.data]);
  const statusOf = (slug: string): string | null => (runnable ? (runnable.has(slug) ? "active" : "deprecated") : null);
  return { statusOf, answered: q.data !== undefined || q.isFetchedAfterMount };
}

/** The concrete model id (the Research key) -> the alias a runnable workflow names it by. */
export function useModelAliases(catalog: ResearchCatalog | null): Map<string, string[]> {
  return useMemo(() => modelAliases(catalog), [catalog]);
}

// ─── The status cell ─────────────────────────────────────────────────────────

/** "Active" (green dot) or "Deprecated" (hollow dot); a dash when nothing states one. */
export function StatusWord({ status, pending = false }: { status: string | null | undefined; pending?: boolean }) {
  if (pending) return <Shimmer className="inline-block h-3.5 w-16 align-middle" />;
  const word = statusWord(status);
  if (!word) return <span className="k-fg4">{"—"}</span>;
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

/** Every read a status write moves: the statuses, the workflows' own, the live rankings. */
async function refetchAfterWrite(qc: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    qc.refetchQueries({ queryKey: [...STATUS_ROOTS.templates] }),
    qc.refetchQueries({ queryKey: [...STATUS_ROOTS.models] }),
    qc.refetchQueries({ queryKey: ["workflowDynastyStatuses"] }),
    qc.invalidateQueries({ queryKey: ["legWorkflowRanking"] }),
  ]);
}

// ─── Template and model rows ─────────────────────────────────────────────────

/** Status + ⋮ for one template or model; the deprecate path opens the confirmation. */
export function useContentStatusWrites() {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState<ContentTarget | null>(null);
  const activate = async (t: ContentTarget) => {
    if (t.kind === "template") await setContentTemplateStatus(t.key, "active");
    else for (const alias of t.aliases) await setContentModelStatus(alias, "active");
    await refetchAfterWrite(qc);
  };
  const modal = confirming ? <DeprecateContentModal target={confirming} onClose={() => setConfirming(null)} /> : null;
  return { activate, askDeprecate: setConfirming, modal };
}

export const ACTIVATE_CONTENT_NOTE = "Its workflows stay deprecated: set each one active by hand.";
export const DEPRECATE_CONTENT_NOTE = "Shows every workflow that writes with it, then stops them all.";

/** One workflow's figures on the leg it runs on (the Research live rankings), for the modal. */
function useFleetFigures(): { byslug: Map<string, { outcomes: number; cost: number | null }>; answered: boolean } {
  const legs = useLegCatalogue();
  const pairs = PIPE_ORDER.map((p) => {
    const leg = legFor(legs, PIPE_KEY[p].leg);
    return leg && isProactiveFrom(leg.fromKey) ? { featureSlug: PIPE_KEY[p].channel, legKey: leg.legKey } : null;
  }).filter((x): x is { featureSlug: string; legKey: string } => x !== null);
  const gate = useOrgQueryGate();
  const results = useQueries({
    queries: pairs.map((p) => ({
      enabled: gate,
      queryKey: ["legWorkflowRanking", p.featureSlug, p.legKey],
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
  const bodies = target.kind === "template" ? [{ promptType: target.key }] : target.aliases.map((model) => ({ model }));
  const previewKey = target.kind === "template" ? [target.key] : target.aliases;
  const preview = useAuthQuery(
    ["retireByContentPreview", target.kind, ...previewKey],
    async () => {
      const lists = await Promise.all(bodies.map((b) => retireWorkflowsByContent(b, true)));
      const seen = new Set<string>();
      return { workflows: lists.flatMap((l) => l.workflows).filter((w) => !seen.has(w.workflowDynastySlug) && (seen.add(w.workflowDynastySlug), true)) };
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const rows = preview.data?.workflows ?? [];
  const n = rows.length;
  const what = target.kind === "template" ? "template" : "model";

  const confirm = async () => {
    setBusy(true);
    setError(null);
    let statusSet = false;
    try {
      if (target.kind === "template") await setContentTemplateStatus(target.key, "deprecated" satisfies CatalogueStatus);
      else for (const alias of target.aliases) await setContentModelStatus(alias, "deprecated");
      statusSet = true;
      for (const b of bodies) await retireWorkflowsByContent(b, false);
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
                : `${n === 1 ? "This workflow stops" : `These ${n} workflows stop`} for every client. No new workflow can use this ${what}.`}
          </p>
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
            disabled={busy || preview.data === undefined}
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

/** Status cell + ⋮ for one workflow dynasty (Research Workflows page). */
export function WorkflowStatusCells({ slug, label, statuses }: { slug: string; label: string; statuses: ReturnType<typeof useDynastyStatuses> }) {
  const qc = useQueryClient();
  const status = statuses.statusOf(slug);
  const write = async (next: CatalogueStatus) => {
    await setWorkflowDynastyStatus(slug, next);
    await refetchAfterWrite(qc);
  };
  return (
    <>
      <td className="px-3">
        <StatusWord status={status} pending={!statuses.answered} />
      </td>
      <td className="pl-1 pr-4 text-right">
        <StatusMenu
          status={status}
          label={label}
          onDeprecate={() => write("deprecated")}
          onActivate={() => write("active")}
          deprecateNote="Stops it for every client."
          activateNote="Runs again for every campaign that picks it."
        />
      </td>
    </>
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

