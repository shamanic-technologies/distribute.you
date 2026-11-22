"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { ApiError, getStaffSkill, getStaffSkills, writeStaffSkill, type StaffSkill } from "@/lib/api";
import {
  buildSkillTree,
  initiallyOpen,
  nextChildPosition,
  slugForNewSkill,
  visibleSkillRows,
  type SkillRow,
  type SkillSummary,
} from "@/lib/monitoring/skills-tree";
import { EmptyNote, Shimmer } from "@/components/v2/ui";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { FolderIcon } from "@phosphor-icons/react/dist/csr/Folder";
import { FolderOpenIcon } from "@phosphor-icons/react/dist/csr/FolderOpen";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";

/**
 * THE Copilot skill tree editor (SKILL-TREE-EDIT-1122), one component for both pages that show the
 * tree: Monitoring > Chat > Skills and the Skills block of Monitoring > Chat > Distry. Never a second
 * copy: each page passes only what is its own (Distry's "read by Distry" checkbox on the left, the
 * Skills page's "edited by / updated" on the right).
 *
 * In place, per skill: its title and its one-line description read as text, a click turns each into
 * its field, Enter or leaving it saves, Esc drops it. "+" on a line adds a skill under it (the root
 * included). A click anywhere else on the line opens the skill's text in the right panel.
 */

export function useSkillWrites() {
  const queryClient = useQueryClient();
  const patchList = (fn: (list: SkillSummary[]) => SkillSummary[]) =>
    queryClient.setQueryData<SkillSummary[]>(["staffSkills"], (prev) => (prev ? fn(prev) : prev));
  const settle = async (skill: StaffSkill) => {
    queryClient.setQueryData(["staffSkill", skill.slug], skill);
    patchList((list) => (list.some((s) => s.slug === skill.slug) ? list.map((s) => (s.slug === skill.slug ? skill : s)) : [...list, skill]));
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staffSkills"] }),
      // Distry's config lists the skills (titles, which exist) beside its own picks.
      queryClient.invalidateQueries({ queryKey: ["staffDistryConfig"] }),
    ]);
  };

  /** chat-service takes the full body on every write, so a rename sends the served text back as is. */
  const rename = async (slug: string, change: { title?: string; description?: string }) => {
    const before = queryClient.getQueryData<SkillSummary[]>(["staffSkills"]);
    patchList((list) => list.map((s) => (s.slug === slug ? { ...s, ...change } : s)));
    try {
      const current = await queryClient.fetchQuery({ queryKey: ["staffSkill", slug], queryFn: () => getStaffSkill(slug), staleTime: 0 });
      const { skill } = await writeStaffSkill(slug, { content: current.content, ...change });
      await settle(skill);
    } catch (err) {
      queryClient.setQueryData(["staffSkills"], before);
      throw err;
    }
  };

  const create = async (parentSlug: string, title: string, description: string): Promise<StaffSkill> => {
    const list = queryClient.getQueryData<SkillSummary[]>(["staffSkills"]) ?? [];
    const slug = slugForNewSkill(title, new Set(list.map((s) => s.slug)));
    if (!slug) throw new SkillWriteRefused("Use at least one letter or digit in the title.");
    const { skill } = await writeStaffSkill(slug, {
      title,
      description,
      parentSlug,
      position: nextChildPosition(list, parentSlug),
      // A skill always has a text: it starts as its own title and description, edited in the panel next.
      content: `# ${title}\n\n${description}\n`,
    });
    await settle(skill);
    return skill;
  };

  return { rename, create };
}

class SkillWriteRefused extends Error {}

/** Our own sentence for a refused write, chosen from the status; the real error goes to the console. */
function refusal(err: unknown, verb: "saved" | "created"): string {
  console.error(`[dashboard] skill tree: not ${verb}`, err);
  if (err instanceof SkillWriteRefused) return err.message;
  if (err instanceof ApiError && err.status === 400) return verb === "created" ? "Not created: that name is not allowed. Try another title." : "Not saved: refused. Check the text.";
  return `Not ${verb}. Try again in a moment.`;
}

export function SkillTree({
  selected,
  onOpen,
  leading,
  trailing,
  head,
  dimmed,
}: {
  selected?: string | null;
  onOpen: (slug: string) => void;
  /** Left of the line, before the tree's indent (Distry's checkbox). */
  leading?: (skill: SkillSummary) => ReactNode;
  /** Right of the line (the Skills page's edited by / updated). */
  trailing?: (skill: SkillSummary) => ReactNode;
  /** First line of the card, above the tree (column labels, Distry's "Every skill"). */
  head?: ReactNode;
  /** A skill shown muted (Distry does not read it). */
  dimmed?: (slug: string) => boolean;
}) {
  const list = useAuthQuery(["staffSkills"], getStaffSkills, { staleTime: 30_000, retry: false });
  const tree = useMemo(() => (list.data ? buildSkillTree(list.data) : undefined), [list.data]);
  const [open, setOpen] = useState<Set<string> | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const writes = useSkillWrites();
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
  const startAdding = (parent: string) => {
    setOpen((prev) => new Set([...(prev ?? []), parent]));
    setAdding(parent);
  };

  if (list.isError) {
    console.error("[dashboard] skill tree: list failed", list.error);
    return (
      <div className="k-card">
        <EmptyNote>Could not read the skills from production.</EmptyNote>
      </div>
    );
  }

  // The new-skill line sits where the skill will land: last under its parent.
  const draftAt = rows && adding ? draftIndex(rows, adding) : -1;
  const draftDepth = draftAt >= 0 && rows ? rows[rows.findIndex((r) => r.skill.slug === adding)].depth + 1 : 0;
  const draft =
    adding && draftAt >= 0 ? (
      <NewSkillLine
        key="__new"
        depth={draftDepth}
        hasLeading={!!leading}
        onCancel={() => setAdding(null)}
        onCreate={async (title, description) => {
          const skill = await writes.create(adding, title, description);
          setAdding(null);
          onOpen(skill.slug);
        }}
      />
    ) : null;

  return (
    <div className="k-card divide-y divide-[var(--line-subtle)] overflow-hidden">
      {head}
      {rows === undefined
        ? [0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex h-12 items-center px-4">
              <Shimmer className="h-4 w-full" />
            </div>
          ))
        : rows.flatMap((r, i) => {
            const line = (
              <SkillLine
                key={r.skill.slug}
                row={r}
                isOpen={open?.has(r.skill.slug) ?? false}
                selected={selected === r.skill.slug}
                muted={dimmed?.(r.skill.slug) ?? false}
                leading={leading?.(r.skill)}
                trailing={trailing?.(r.skill)}
                onToggle={() => toggle(r.skill.slug)}
                onOpen={() => onOpen(r.skill.slug)}
                onAdd={() => startAdding(r.skill.slug)}
                onRename={(change) => writes.rename(r.skill.slug, change)}
              />
            );
            return i + 1 === draftAt ? [line, draft] : [line];
          })}
      {rows && rows.length === 0 && <EmptyNote>No skill yet.</EmptyNote>}
    </div>
  );
}

/** Index in `rows` AFTER which the new child of `parent` is drawn: past the parent's open subtree. */
function draftIndex(rows: SkillRow[], parent: string): number {
  const at = rows.findIndex((r) => r.skill.slug === parent);
  if (at < 0) return -1;
  let end = at + 1;
  while (end < rows.length && rows[end].depth > rows[at].depth) end++;
  return end;
}

const INDENT = 20;

function SkillLine({
  row,
  isOpen,
  selected,
  muted,
  leading,
  trailing,
  onToggle,
  onOpen,
  onAdd,
  onRename,
}: {
  row: SkillRow;
  isOpen: boolean;
  selected: boolean;
  muted: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  onToggle: () => void;
  onOpen: () => void;
  onAdd: () => void;
  onRename: (change: { title?: string; description?: string }) => Promise<void>;
}) {
  const { skill, depth, hasChildren, childCount } = row;
  const Icon = hasChildren ? (isOpen ? FolderOpenIcon : FolderIcon) : FileTextIcon;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) onOpen();
      }}
      data-skill={skill.slug}
      className={`k-row group flex cursor-pointer items-start gap-3 px-4 py-2 ${selected ? "k-selected" : ""}`}
    >
      {leading}
      <div className="flex min-w-0 flex-1 items-start gap-1.5" style={{ paddingLeft: depth * INDENT }}>
        {hasChildren ? (
          <button
            type="button"
            aria-label={isOpen ? `Close ${skill.title}` : `Open ${skill.title}`}
            aria-expanded={isOpen}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="k-btn-ghost mt-0.5 inline-flex shrink-0 items-center justify-center"
            style={{ width: 24, height: 20, padding: 0 }}
          >
            <CaretRightIcon size={12} weight="bold" className={`transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`} />
          </button>
        ) : (
          <span className="inline-block w-6 shrink-0" />
        )}
        <Icon size={16} weight="duotone" className="mt-0.5 shrink-0" style={{ color: hasChildren ? "var(--data-amber)" : "var(--fg-3)" }} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <InlineText
              label={`${skill.title}: title`}
              value={skill.title}
              max={200}
              onSave={(title) => onRename({ title })}
              className={`text-[13px] font-medium ${muted ? "k-fg3" : "k-fg"}`}
            />
            {hasChildren && <span className="k-fg3 shrink-0 text-[12px] tabular-nums">{childCount}</span>}
          </div>
          <InlineText
            label={`${skill.title}: description`}
            value={skill.description}
            max={500}
            onSave={(description) => onRename({ description })}
            className="k-fg3 text-[12px]"
          />
        </div>
      </div>
      <button
        type="button"
        aria-label={`Add a skill under ${skill.title}`}
        title="Add a skill under this one"
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        className="k-btn-ghost mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100"
        style={{ padding: 0 }}
      >
        <PlusIcon size={14} weight="bold" />
      </button>
      {trailing}
    </div>
  );
}

/**
 * A served text edited where it is read: ONE box for both states (same padding, font and border
 * width), the field sized by a hidden copy of its own value, so nothing moves on click. The typed
 * value shows while it saves; a refusal reopens the field with the text kept and says why.
 */
export function InlineText({
  value,
  onSave,
  label,
  max,
  className = "",
}: {
  value: string;
  onSave: (next: string) => Promise<void>;
  label: string;
  max: number;
  className?: string;
}) {
  const [text, setText] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const commit = async () => {
    if (text === null) return;
    const next = text.trim();
    if (next === "" || next === value) {
      setText(null);
      setError(null);
      return;
    }
    if (next.length > max) {
      setError(`At most ${max} characters.`);
      return;
    }
    setText(null);
    setError(null);
    setPending(next);
    try {
      await onSave(next);
    } catch (err) {
      setText(next);
      setError(refusal(err, "saved"));
    } finally {
      setPending(null);
    }
  };
  const box = `flex w-fit max-w-full min-w-0 rounded-[6px] border px-1 ${className}`;
  // The negative margin sits on the wrapper: on the box it would shrink the width the text is measured in.
  return (
    <span className="-mx-1 block min-w-0">
      {text !== null ? (
        <span className={`${box} border-[var(--accent)]`} onClick={(e) => e.stopPropagation()}>
          <span className="inline-grid min-w-0 max-w-full">
            <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-pre">
              {text || " "}{" "}
            </span>
            <input
              autoFocus
              size={1}
              aria-label={label}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
              onBlur={() => void commit()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  setText(null);
                  setError(null);
                }
              }}
              className="col-start-1 row-start-1 w-full min-w-0 bg-transparent p-0 outline-none [font:inherit] [letter-spacing:inherit]"
            />
          </span>
        </span>
      ) : (
        <span
          role="button"
          tabIndex={0}
          title="Click to edit"
          onClick={(e) => {
            e.stopPropagation();
            if (pending === null) setText(value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.stopPropagation();
              if (pending === null) setText(value);
            }
          }}
          className={`${box} cursor-text border-transparent hover:border-[var(--line)]`}
        >
          <span className="truncate">{pending ?? value}</span>
        </span>
      )}
      {error && <span className="block text-[12px] text-[var(--data-rose)]">{error}</span>}
    </span>
  );
}

/** The line a new skill is typed on: its title, then its one-line description; Enter on the second creates it. */
function NewSkillLine({
  depth,
  hasLeading,
  onCreate,
  onCancel,
}: {
  depth: number;
  hasLeading: boolean;
  onCreate: (title: string, description: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const describe = useRef<HTMLInputElement | null>(null);
  const submit = async () => {
    const t = title.trim();
    const d = description.trim();
    if (!t) return setError("Give the skill a title.");
    if (!d) {
      describe.current?.focus();
      return setError("Add a one-line description: the Copilot reads it to pick the skill.");
    }
    setBusy(true);
    setError(null);
    try {
      await onCreate(t, d);
    } catch (err) {
      setError(refusal(err, "created"));
      setBusy(false);
    }
  };
  const keys = (e: React.KeyboardEvent<HTMLInputElement>, next?: () => void) => {
    if (e.key === "Escape") onCancel();
    if (e.key === "Enter") {
      e.preventDefault();
      if (next) next();
      else void submit();
    }
  };
  return (
    <div
      className="k-selected flex items-start gap-3 px-4 py-2"
      onBlur={(e) => {
        // Leaving the line: an untouched one goes away, a filled one is created.
        if (busy || e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        if (!title.trim() && !description.trim()) onCancel();
        else void submit();
      }}
    >
      {hasLeading && <span className="inline-block w-4 shrink-0" />}
      <div className="flex min-w-0 flex-1 items-start gap-1.5" style={{ paddingLeft: depth * INDENT }}>
        <span className="inline-block w-6 shrink-0" />
        <FileTextIcon size={16} weight="duotone" className="mt-0.5 shrink-0" style={{ color: "var(--fg-3)" }} />
        <div className="min-w-0 flex-1">
          <input
            autoFocus
            aria-label="New skill title"
            placeholder="New skill title"
            value={title}
            disabled={busy}
            maxLength={200}
            onChange={(e) => {
              setTitle(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => keys(e, () => describe.current?.focus())}
            className="block w-full bg-transparent p-0 text-[13px] font-medium outline-none placeholder:text-[var(--fg-4)]"
          />
          <input
            ref={describe}
            aria-label="New skill description"
            placeholder="What it is for, in one line"
            value={description}
            disabled={busy}
            maxLength={500}
            onChange={(e) => {
              setDescription(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => keys(e)}
            className="k-fg2 block w-full bg-transparent p-0 text-[12px] outline-none placeholder:text-[var(--fg-4)]"
          />
          {error && <span className="block text-[12px] text-[var(--data-rose)]">{error}</span>}
          {busy && <span className="k-fg3 block text-[12px]">Creating…</span>}
        </div>
      </div>
    </div>
  );
}
