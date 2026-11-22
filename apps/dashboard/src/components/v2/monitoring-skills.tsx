"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { getStaffSkill, saveStaffSkill, type StaffSkill } from "@/lib/api";
import { EmptyNote, Shimmer } from "@/components/v2/ui";
import { InlineText, MentionText, MentionTextarea, useMentionables, useSkillTree, useSkillWrites, type SkillsOpen } from "@/components/v2/monitoring-skill-tree";

/**
 * The skill panel of Monitoring > Chat > Distry (the one home of the skills since 2026-11-22):
 * title and description renamed in its header, the text one big field that saves itself while you
 * type. chat-service folds saves by the same person within 10 minutes into one version.
 */

const SAVE_AFTER_MS = 800;
const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: string } | { kind: "empty" } | { kind: "failed" };

/** `tools` = what a text may mention (Distry's served list); a chip opens what it names through `onOpen`. */
export function SkillPanel({ slug, onClose, onOpen, tools }: { slug: string; onClose: () => void; onOpen: (o: SkillsOpen) => void; tools: string[] | undefined }) {
  const queryClient = useQueryClient();
  const writes = useSkillWrites();
  const names = useMentionables(tools);
  const tree = useSkillTree();
  const links = tree.data?.skills.find((s) => s.slug === slug);
  const titleOf = (x: string) => tree.data?.skills.find((s) => s.slug === x)?.title ?? x;
  const q = useAuthQuery(["staffSkill", slug], () => getStaffSkill(slug), { staleTime: 0, retry: false });
  const skill = q.data;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<string | null>(null);
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
        await queryClient.invalidateQueries({ queryKey: ["staffSkillTree"] });
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
          {links?.mentionedBy && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
              <span className="k-label">Mentioned by</span>
              {links.neverMentioned ? (
                <span className="k-chip" style={{ color: "var(--data-amber)" }}>
                  Not mentioned: Distry never reads it
                </span>
              ) : (
                <>
                  {links.mentionedBy.prompt && (
                    <button type="button" className="k-chip" onClick={() => onOpen({ kind: "prompt" })}>
                      Prompt
                    </button>
                  )}
                  {links.mentionedBy.skills.map((x) => (
                    <button key={x} type="button" className="k-chip" onClick={() => onOpen({ kind: "skill", slug: x })}>
                      {titleOf(x)}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
          <div className="mt-4 flex min-h-0 flex-1">
            {editing ? (
              <MentionTextarea
                autoFocus
                value={draft}
                names={names}
                onChange={(text) => {
                  setDraft(text);
                  if (timer.current) clearTimeout(timer.current);
                  timer.current = setTimeout(() => void flush(text), SAVE_AFTER_MS);
                }}
                onBlur={() => void stopEditing()}
                onEscape={() => void stopEditing()}
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
                className="k-inset min-h-0 w-full flex-1 cursor-text overflow-y-auto rounded-[10px] px-4 py-3 text-left shadow-[inset_0_0_0_1px_var(--line-subtle)] hover:shadow-[inset_0_0_0_1px_var(--line)]"
              >
                <MentionText text={skill.content} names={names} onOpen={onOpen} />
                <p className="k-fg3 mt-3 text-[12px]">Click the text to edit it. Type @ to mention a skill or a tool.</p>
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
