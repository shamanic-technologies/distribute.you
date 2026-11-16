"use client";

import { useResearch, useResearchCatalog } from "@/lib/research/research-source";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { pollOptions } from "@/lib/query-options";
import {
  ApiError,
  getContentModelStatuses,
  getContentTemplateStatuses,
  getRunnableWorkflowDynastySummaries,
  getWorkflowDynastyDeprecation,
  listActiveScripts,
  retireWorkflowsByContent,
  setContentTemplateStatus,
  setWorkflowDynastyStatus,
  type CatalogueStatusChange,
} from "@/lib/api";
import { formatUsdAdaptive } from "@/lib/format-number";
import { Shimmer } from "@/components/v2/ui";
import { InfoTooltip } from "@/components/visibility/metric-info";
import { dynastyHeads } from "@/lib/v2/catalogue";
import { contentDeprecation, deprecationLine, modelDeprecation, scriptFiguresBySlug, statusWord, type ContentTarget, type DeprecationFacts } from "@/lib/research/content-status";

/**
 * Staff status of a template, a writer model or a script on the Research pages
 * (TEMPLATE-MODEL-STATUS-1019, owner 2026-10-19; by Engine since RESEARCH-BY-ENGINE-1113). One status for
 * every client: there is no per-brand status. Deprecating a template shows, first, every script that would
 * stop with it (a dry run of workflow-service's retire-by-content), each with its outcomes, cost per
 * outcome and status; confirming deprecates it AND retires those scripts. Setting it active again touches
 * its status only: the scripts stay deprecated, set back by hand. A writer model's status was set per
 * channel x leg, a grain Research no longer has: Research reads it, never writes it.
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
 * Model ALIAS -> status, as content-generation serves it read without a channel (its fleet status). A model's
 * deprecation reads every alias it is served under.
 */
export function useModelStatuses() {
  const q = useAuthQuery([...STATUS_ROOTS.models], getContentModelStatuses, { ...pollOptions, retry: false });
  const map = useMemo(() => new Map((q.data ?? []).map((m) => [m.model, m.status])), [q.data]);
  const why = useMemo(() => new Map((q.data ?? []).map((m) => [m.model, contentDeprecation(m)])), [q.data]);
  const deprecationOf = (aliases: readonly string[]) => modelDeprecation(aliases, (a) => why.get(a) ?? null);
  return {
    map,
    deprecationOf,
    answered: q.data !== undefined || q.isFetchedAfterMount,
    failed: q.data === undefined && q.isError,
  };
}

/**
 * What a script does, in its producer's words: a script's description (workflow-service `GET /scripts`, its live
 * head), else the description of the workflow dynasty it is (`GET /workflows/summaries`, every runnable one), with
 * the line that sets it apart from its siblings (WF-SHORT-LINE-1023). Its STATUS is never read here: it is the
 * served `executable` / `runnable` of the Research read (a script and a workflow dynasty live in two tables).
 */
export function useScriptWords() {
  const summaries = useAuthQuery(["workflowDynastySummaries", "all"], () => getRunnableWorkflowDynastySummaries(), { ...pollOptions, retry: false });
  const scripts = useAuthQuery(["catalogueScripts"], listActiveScripts, { ...pollOptions, retry: false });
  const workflows = useMemo(() => new Map((summaries.data ?? []).map((d) => [d.slug, d])), [summaries.data]);
  const heads = useMemo(() => new Map(dynastyHeads(scripts.data ?? []).map((sc) => [`${sc.outcome}/${sc.dynasty}`, sc])), [scripts.data]);
  const descriptionOf = (slug: string): string | null => heads.get(slug)?.description?.trim() || workflows.get(slug)?.description || null;
  const siblingsOf = (slug: string) => workflows.get(slug) ?? null;
  return { descriptionOf, siblingsOf, answered: (summaries.data !== undefined || summaries.isError) && (scripts.data !== undefined || scripts.isError) };
}

/** A served status word off a script's served flag (`executable` on the live ranking, `runnable` on the catalogue). */
export function scriptStatus(runs: boolean | null | undefined): "active" | "deprecated" | null {
  return runs == null ? null : runs ? "active" : "deprecated";
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

/** Every read a status write moves: the statuses, the scripts' own words (and why), the live rankings. */
async function refetchAfterWrite(qc: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    qc.refetchQueries({ queryKey: [...STATUS_ROOTS.templates] }),
    qc.refetchQueries({ queryKey: [...STATUS_ROOTS.models] }),
    qc.refetchQueries({ queryKey: ["workflowDynastySummaries"] }),
    qc.invalidateQueries({ queryKey: ["workflowDynastyDeprecation"] }),
    qc.invalidateQueries({ queryKey: ["staffScriptEngines"] }),
  ]);
}

// ─── Template and model rows ─────────────────────────────────────────────────

/** Status + ⋮ for one template; the deprecate path opens the confirmation. */
export function useContentStatusWrites() {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState<ContentTarget | null>(null);
  const activate = async (t: ContentTarget) => {
    await setContentTemplateStatus(t.key, { status: "active" });
    await refetchAfterWrite(qc);
  };
  const modal = confirming ? <DeprecateContentModal target={confirming} onClose={() => setConfirming(null)} /> : null;
  return { activate, askDeprecate: setConfirming, modal };
}

export const ACTIVATE_CONTENT_NOTE = "Its scripts stay deprecated: set each one active by hand.";
export const DEPRECATE_CONTENT_NOTE = "Shows every script that writes with it, then stops them all.";

/** One script's figures off the Research catalogue (every measure, served), for the modal. */
function useScriptFigures(): { byslug: Map<string, { outcomes: number; cost: number | null }>; answered: boolean } {
  const { basis } = useResearch();
  const catalog = useResearchCatalog(basis);
  const byslug = useMemo(() => scriptFiguresBySlug(catalog.data ?? null), [catalog.data]);
  return { byslug, answered: catalog.data !== undefined || catalog.isError };
}

/**
 * "Deprecate <template|model>?": the workflows a dry run says would stop, each with its outcomes,
 * cost per outcome and status; confirming sets the status AND retires them. Nothing is computed
 * here: the list is workflow-service's, the figures the fleet ranking's, the status the dynasty's.
 */
export function DeprecateContentModal({ target, onClose }: { target: ContentTarget; onClose: () => void }) {
  const qc = useQueryClient();
  const preview = useAuthQuery(
    ["retireByContentPreview", target.kind, target.key],
    async () => {
      const list = await retireWorkflowsByContent({ promptType: target.key }, { dryRun: true });
      const seen = new Set<string>();
      return { workflows: list.workflows.filter((w) => !seen.has(w.workflowDynastySlug) && (seen.add(w.workflowDynastySlug), true)) };
    },
    { retry: false, staleTime: 0 },
  );
  const listed = preview.data;
  const figures = useScriptFigures();
  // Every script the dry run lists can run today (retire-by-content lists runnable ones only).
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [why, setWhy] = useState("");
  const reason = why.trim();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const rows = listed?.workflows ?? [];
  const n = rows.length;
  const what = "template";

  const confirm = async () => {
    if (!reason) return;
    setBusy(true);
    setError(null);
    let statusSet = false;
    const change = { status: "deprecated", reason } satisfies CatalogueStatusChange;
    // Each script it stops records why: this deprecation, named, with the staff member's words.
    const workflowReason = `Uses deprecated ${what} ${target.label}: ${reason}`;
    try {
      await setContentTemplateStatus(target.key, change);
      statusSet = true;
      await retireWorkflowsByContent({ promptType: target.key }, { dryRun: false, reason: workflowReason });
      await refetchAfterWrite(qc);
      onClose();
    } catch (err) {
      console.error("[research status] deprecate failed", { target, statusSet, err });
      if (statusSet) {
        await refetchAfterWrite(qc).catch((e) => console.error("[research status] refetch after a partial deprecate failed", e));
        setError(`The ${what} is deprecated, but its scripts still run. Try again to stop them.`);
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
            {`Deprecate ${target.label}?`}
          </span>
          <button type="button" aria-label="Close" className="k-btn-ghost ml-auto h-7 w-7 justify-center p-0" onClick={onClose} disabled={busy}>
            ×
          </button>
        </div>
        <div className="k-scroll min-h-0 overflow-y-auto px-4 py-4">
          <p className="text-[13px] leading-5">
            {preview.data === undefined
              ? `Finding the scripts that write with this ${what}.`
              : n === 0
                ? `No running script writes with this ${what}. No new script can use it once deprecated.`
                : `${n === 1 ? "This script stops" : `These ${n} scripts stop`} for every client. No new script can use this ${what}.`}
          </p>
          {preview.isError && preview.data === undefined ? (
            <p role="alert" className="mt-3 text-[13px] text-[var(--data-rose)]">
              We could not list its scripts just now. Close and try again.
            </p>
          ) : n > 0 || listed === undefined ? (
            <div className="k-card mt-3 overflow-hidden">
              <table className="w-full table-fixed text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--line-subtle)]">
                    <th className="k-label px-3 py-2.5 text-left font-medium first:pl-4">Script</th>
                    <th className="k-label w-24 px-3 py-2.5 text-right font-medium">Outcomes</th>
                    <th className="k-label w-28 px-3 py-2.5 text-right font-medium">$ / outcome</th>
                    <th className="k-label w-28 px-3 py-2.5 pr-4 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {listed === undefined
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
                              <StatusWord status="active" />
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>
          ) : null}
          <p className="k-fg3 mt-3 text-[12px] leading-[18px]">Setting it active later brings no script back: set each one active by hand.</p>
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
            disabled={busy || listed === undefined || !reason}
            className={`k-btn-strong ${busy ? "cursor-wait" : "disabled:cursor-not-allowed disabled:opacity-40"}`}
          >
            {busy ? "Deprecating..." : n > 0 ? `Deprecate ${n} ${n === 1 ? "script" : "scripts"}` : `Deprecate ${what}`}
          </button>
        </div>
      </div>
    </div>,
    document.getElementById("v2-portal") ?? document.body,
  );
}

// ─── Script rows ─────────────────────────────────────────────────────────────

/**
 * A script that is a workflow-service WORKFLOW dynasty (a slug with no Engine prefix) takes its status from the ⋮;
 * an Engine script (`<engine>/<dynasty>`) lives in workflow-service's scripts and changes through its dynasty
 * (a new version, never a toggle here).
 */
export function isWorkflowDynasty(slug: string): boolean {
  return !slug.includes("/");
}

/**
 * Status cell + ⋮ for one script (Research Scripts page); Deprecate asks why first. The status is the SERVED one;
 * a write the Research read has not rebuilt on yet is held here, on this script, until the served status says the same.
 */
export function ScriptStatusCells({ slug, label, served }: { slug: string; label: string; served: "active" | "deprecated" | null }) {
  const qc = useQueryClient();
  const [pressed, setPressed] = useState<"active" | "deprecated" | null>(null);
  const status = pressed && pressed !== served ? pressed : served;
  const why = useWorkflowDeprecation(slug, status === "deprecated" && isWorkflowDynasty(slug));
  const [asking, setAsking] = useState(false);
  const write = async (change: CatalogueStatusChange) => {
    await setWorkflowDynastyStatus(slug, change);
    setPressed(change.status === "deprecated" ? "deprecated" : "active");
    await refetchAfterWrite(qc);
  };
  return (
    <>
      <td className="max-w-0 px-3">
        <StatusWord status={status} deprecation={why.deprecation} />
      </td>
      <td className="pl-1 pr-4 text-right">
        {isWorkflowDynasty(slug) && <StatusMenu
          status={status}
          label={label}
          onDeprecate={() => setAsking(true)}
          onActivate={() => write({ status: "active" })}
          deprecateNote="Stops it for every client."
          activateNote="Runs again for every campaign that picks it."
        />}
        {asking && (
          <DeprecateWhyModal
            title={`Deprecate ${label}?`}
            body="It stops for every client, and no campaign picks it again."
            what="script"
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

