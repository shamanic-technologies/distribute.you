"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { getStaffSkill, getStaffSkills, saveStaffSkill, type StaffSkill } from "@/lib/api";
import { buildSkillTree, editedByLabel, initiallyOpen, visibleSkillRows, type SkillRow } from "@/lib/monitoring/skills-tree";
import { EmptyNote, SectionTitle, Shimmer } from "@/components/v2/ui";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { FolderIcon } from "@phosphor-icons/react/dist/csr/Folder";
import { FolderOpenIcon } from "@phosphor-icons/react/dist/csr/FolderOpen";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";

/**
 * Monitoring > Chat > Skills (staff, owner 2026-10-09): the Copilot's skill tree, served by
 * chat-service. Folders open and close; a line opens the skill in a panel on the right; a click
 * in its text turns it into one big field that saves itself while you type. chat-service folds
 * saves by the same person within 10 minutes into one version, so autosave never floods history.
 */

const SAVE_AFTER_MS = 800;
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function SkillsView() {
  const list = useAuthQuery(["staffSkills"], getStaffSkills, { staleTime: 30_000, retry: false });
  const tree = useMemo(() => (list.data ? buildSkillTree(list.data) : undefined), [list.data]);
  const [open, setOpen] = useState<Set<string> | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // Folders start open on the first answer only; after that, what the reader opened stays.
  useEffect(() => {
    if (tree && open === null) setOpen(initiallyOpen(tree));
  }, [tree, open]);
  const rows = tree && open ? visibleSkillRows(tree, open) : undefined;
  const toggle = (slug: string) =>
    setOpen((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  if (list.isError) {
    console.error("[dashboard] skills: list failed", list.error);
    return (
      <div className="k-card">
        <EmptyNote>Could not read the skills from production.</EmptyNote>
      </div>
    );
  }

  return (
    <>
      <SectionTitle count={list.data?.length ?? null} right={<span className="hidden sm:inline">Click a skill to read and edit it</span>}>
        Skills
      </SectionTitle>
      <div className="k-card overflow-hidden">
        <div className="k-scroll overflow-x-auto">
          <table className="w-full table-fixed text-[13px]">
            <thead>
              <tr className="k-line-subtle border-b text-left">
                <th className="k-label px-3 py-2.5 first:pl-4">Skill</th>
                <th className="k-label hidden w-[220px] px-3 py-2.5 md:table-cell">Edited by</th>
                <th className="k-label w-[140px] px-3 py-2.5 last:pr-4">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows === undefined
                ? [0, 1, 2, 3, 4].map((i) => (
                    <tr key={i} className="h-10">
                      <td colSpan={3} className="px-4">
                        <Shimmer className="h-4 w-full" />
                      </td>
                    </tr>
                  ))
                : rows.map((r) => (
                    <SkillLine
                      key={r.skill.slug}
                      row={r}
                      isOpen={open?.has(r.skill.slug) ?? false}
                      selected={selected === r.skill.slug}
                      onToggle={() => toggle(r.skill.slug)}
                      onSelect={() => setSelected(r.skill.slug)}
                    />
                  ))}
            </tbody>
          </table>
        </div>
        {rows && rows.length === 0 && <EmptyNote>No skill yet.</EmptyNote>}
      </div>
      {selected && <SkillPanel slug={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function SkillLine({ row, isOpen, selected, onToggle, onSelect }: { row: SkillRow; isOpen: boolean; selected: boolean; onToggle: () => void; onSelect: () => void }) {
  const { skill, depth, hasChildren, childCount } = row;
  const Icon = hasChildren ? (isOpen ? FolderOpenIcon : FolderIcon) : FileTextIcon;
  return (
    <tr className={`k-row k-line-subtle h-10 cursor-pointer border-b last:border-b-0 ${selected ? "k-selected" : ""}`} onClick={onSelect}>
      <td className="px-3 py-2 first:pl-4">
        <div className="flex min-w-0 items-center gap-1.5" style={{ paddingLeft: depth * 20 }}>
          {hasChildren ? (
            <button
              type="button"
              aria-label={isOpen ? `Close ${skill.title}` : `Open ${skill.title}`}
              aria-expanded={isOpen}
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              className="k-btn-ghost inline-flex shrink-0 items-center justify-center" style={{ width: 24, height: 20, padding: 0 }}
            >
              <CaretRightIcon size={12} weight="bold" className={`transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`} />
            </button>
          ) : (
            <span className="inline-block w-6 shrink-0" />
          )}
          <Icon size={16} weight="duotone" className="shrink-0" style={{ color: hasChildren ? "var(--data-amber)" : "var(--fg-3)" }} />
          <span className="truncate font-medium">{skill.title}</span>
          {hasChildren && <span className="k-fg3 shrink-0 tabular-nums">{childCount}</span>}
          <span className="k-fg3 hidden min-w-0 truncate text-[12px] lg:inline">{skill.description}</span>
        </div>
      </td>
      <td className="k-fg2 hidden truncate px-3 py-2 md:table-cell">{editedByLabel(skill.updatedBy)}</td>
      <td className="k-mono k-fg2 px-3 py-2 text-[12px] last:pr-4">{when(skill.updatedAt)}</td>
    </tr>
  );
}

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: string } | { kind: "empty" } | { kind: "failed" };

function SkillPanel({ slug, onClose }: { slug: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const q = useAuthQuery(["staffSkill", slug], () => getStaffSkill(slug), { staleTime: 0, retry: false });
  const skill = q.data;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string | null>(null);
  const field = useRef<HTMLTextAreaElement | null>(null);
  const draftRef = useRef("");
  draftRef.current = draft;

  // Opening another skill starts from its served text.
  useEffect(() => {
    setEditing(false);
    setSave({ kind: "idle" });
    lastSaved.current = null;
  }, [slug]);

  const flush = useCallback(
    async (text: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      if (text === lastSaved.current) return;
      if (text.trim() === "") {
        setSave({ kind: "empty" });
        return;
      }
      setSave({ kind: "saving" });
      try {
        const saved: StaffSkill = await saveStaffSkill(slug, text);
        lastSaved.current = text;
        queryClient.setQueryData(["staffSkill", slug], saved);
        setSave({ kind: "saved", at: saved.updatedAt });
        await queryClient.invalidateQueries({ queryKey: ["staffSkills"] });
      } catch (err) {
        console.error("[dashboard] skills: save failed", { slug, err });
        setSave({ kind: "failed" });
      }
    },
    [slug, queryClient],
  );

  const startEditing = () => {
    if (!skill) return;
    setDraft(skill.content);
    lastSaved.current = skill.content;
    setEditing(true);
  };
  useEffect(() => {
    if (editing) field.current?.focus();
  }, [editing]);

  const stopEditing = useCallback(async () => {
    await flush(draft);
    setEditing(false);
  }, [draft, flush]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (editing) void stopEditing();
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, stopEditing, onClose]);

  // Leaving the panel mid-typing still saves what was typed.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(
    () => () => {
      if (timer.current) void flushRef.current(draftRef.current);
    },
    [],
  );

  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.getElementById("v2-portal")), []);
  if (!host) return null;

  const status =
    save.kind === "saving"
      ? "Saving…"
      : save.kind === "saved"
        ? `Saved ${when(save.at)}`
        : save.kind === "empty"
          ? "A skill cannot be empty: not saved"
          : save.kind === "failed"
            ? "Not saved: try again in a moment"
            : null;

  return createPortal(
    <aside role="dialog" aria-label={skill ? `${skill.title} skill` : "Skill"} className="k-popover fixed inset-y-2 right-2 z-[80] flex w-[min(720px,calc(100vw-16px))] flex-col overflow-hidden">
      <div className="k-line-subtle flex h-11 shrink-0 items-center justify-between gap-3 border-b px-4">
        <span className="k-label truncate">Skill · {slug}</span>
        <div className="flex items-center gap-3">
          {status && (
            <span className={`text-[12px] ${save.kind === "failed" || save.kind === "empty" ? "text-[var(--data-rose)]" : "k-fg3"}`} aria-live="polite">
              {status}
            </span>
          )}
          <button
            type="button"
            aria-label="Close"
            onClick={async () => {
              if (editing) await flush(draft);
              onClose();
            }}
            className="k-btn-ghost inline-flex h-6 w-6 items-center justify-center"
          >
            ×
          </button>
        </div>
      </div>
      {q.isError ? (
        <EmptyNote>Could not read this skill from production.</EmptyNote>
      ) : !skill ? (
        <div className="space-y-2 p-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Shimmer key={i} className="h-4 w-full" />
          ))}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col p-4">
          <h2 className="text-[18px] font-medium leading-6">{skill.title}</h2>
          <p className="k-fg2 mt-1 text-[13px]">{skill.description}</p>
          <p className="k-mono k-fg3 mt-2 text-[12px]">
            Version {skill.version} · {editByLine(skill.updatedBy)} · {when(skill.updatedAt)}
          </p>
          <div className="mt-4 flex min-h-0 flex-1">
            {editing ? (
              <textarea
                ref={field}
                value={draft}
                spellCheck={false}
                onChange={(e) => {
                  const text = e.target.value;
                  setDraft(text);
                  if (timer.current) clearTimeout(timer.current);
                  timer.current = setTimeout(() => void flush(text), SAVE_AFTER_MS);
                }}
                onBlur={() => void stopEditing()}
                className="k-inset k-mono min-h-0 w-full flex-1 resize-none rounded-[10px] p-3 text-[13px] leading-[20px] outline-none shadow-[inset_0_0_0_1px_var(--accent)]"
              />
            ) : (
              <button
                type="button"
                onClick={startEditing}
                title="Click to edit"
                className="k-inset k-mono min-h-0 w-full flex-1 cursor-text overflow-y-auto whitespace-pre-wrap rounded-[10px] p-3 text-left text-[13px] leading-[20px] shadow-[inset_0_0_0_1px_var(--line-subtle)] hover:shadow-[inset_0_0_0_1px_var(--line)]"
              >
                {skill.content}
              </button>
            )}
          </div>
        </div>
      )}
    </aside>,
    host,
  );
}

const editByLine = (updatedBy: string) => (updatedBy === "seed" ? "Seeded, never edited" : `Edited by ${updatedBy}`);
