"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { getStaffSkill, getStaffSkills, saveStaffSkill, type StaffSkill } from "@/lib/api";
import { editedByLabel } from "@/lib/monitoring/skills-tree";
import { EmptyNote, SectionTitle, Shimmer } from "@/components/v2/ui";
import { InlineText, SkillTree, useSkillWrites } from "@/components/v2/monitoring-skill-tree";

/**
 * Monitoring > Chat > Skills (staff, owner 2026-10-09): the Copilot's skill tree, served by
 * chat-service, drawn and edited by the shared `SkillTree` (SKILL-TREE-EDIT-1122, the same editor
 * as Monitoring > Distry). A line opens the skill in a panel on the right; a click in its text
 * turns it into one big field that saves itself while you type; its title and description are
 * renamed in the panel header too. chat-service folds
 * saves by the same person within 10 minutes into one version, so autosave never floods history.
 */

const SAVE_AFTER_MS = 800;
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function SkillsView() {
  const list = useAuthQuery(["staffSkills"], getStaffSkills, { staleTime: 30_000, retry: false });
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <>
      <SectionTitle count={list.data?.length ?? null} right={<span className="hidden sm:inline">Click a title to rename it, a line to edit its text, + to add one under it</span>}>
        Skills
      </SectionTitle>
      <SkillTree
        selected={selected}
        onOpen={setSelected}
        head={
          <div className="flex items-center gap-3 px-4 py-2.5">
            <span className="k-label flex-1">Skill</span>
            <span className="k-label hidden w-[220px] md:block">Edited by</span>
            <span className="k-label w-[140px]">Updated</span>
          </div>
        }
        trailing={(skill) => (
          <>
            <span className="k-fg2 hidden w-[220px] shrink-0 truncate text-[13px] md:block">{editedByLabel(skill.updatedBy)}</span>
            <span className="k-mono k-fg2 w-[140px] shrink-0 text-[12px]">{when(skill.updatedAt)}</span>
          </>
        )}
      />
      {selected && <SkillPanel slug={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: string } | { kind: "empty" } | { kind: "failed" };

/** Also opened from Monitoring > Distry, which puts its "Read by Distry" switch in `extra`. */
export function SkillPanel({ slug, onClose, extra }: { slug: string; onClose: () => void; extra?: React.ReactNode }) {
  const queryClient = useQueryClient();
  const writes = useSkillWrites();
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
          <h2 className="text-[18px] font-medium leading-6">
            <InlineText label="Skill title" value={skill.title} max={200} onSave={(title) => writes.rename(slug, { title })} />
          </h2>
          <div className="k-fg2 mt-1 text-[13px]">
            <InlineText label="Skill description" value={skill.description} max={500} onSave={(description) => writes.rename(slug, { description })} />
          </div>
          <p className="k-mono k-fg3 mt-2 text-[12px]">
            Version {skill.version} · {editByLine(skill.updatedBy)} · {when(skill.updatedAt)}
          </p>
          {extra && <div className="mt-3">{extra}</div>}
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
              // A div, never a <button>: a button centers its text vertically in the tall box (owner 2026-11-19).
              <div
                role="button"
                tabIndex={0}
                onClick={startEditing}
                onKeyDown={(e) => {
                  if (e.key === "Enter") startEditing();
                }}
                title="Click to edit"
                className="k-inset k-mono min-h-0 w-full flex-1 cursor-text overflow-y-auto whitespace-pre-wrap rounded-[10px] p-3 text-left text-[13px] leading-[20px] shadow-[inset_0_0_0_1px_var(--line-subtle)] hover:shadow-[inset_0_0_0_1px_var(--line)]"
              >
                {skill.content}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>,
    host,
  );
}

const editByLine = (updatedBy: string) => (updatedBy === "seed" ? "Seeded, never edited" : `Edited by ${updatedBy}`);
