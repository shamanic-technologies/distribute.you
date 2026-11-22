"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { ApiError, deleteStaffSkill, getStaffSkill, getStaffSkills, moveStaffSkill, writeStaffSkill, type StaffSkill } from "@/lib/api";
import {
  applySkillMove,
  buildSkillTree,
  dropZoneAt,
  initiallyOpen,
  isSelfOrDescendant,
  planSkillDrop,
  type DropZone,
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
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { DotsSixVerticalIcon } from "@phosphor-icons/react/dist/csr/DotsSixVertical";

/**
 * THE Copilot skill tree editor (SKILL-TREE-EDIT-1122), one component for both pages that show the
 * tree: Monitoring > Chat > Skills and the Skills block of Monitoring > Chat > Distry. Never a second
 * copy: each page passes only what is its own (Distry's "read by Distry" checkbox on the left, the
 * Skills page's "edited by / updated" on the right).
 *
 * In place, per skill: its title and its one-line description read as text, a click turns each into
 * its field, Enter or leaving it saves, Esc drops it. "+" on a line adds a skill under it (the root
 * included), the bin deletes it (a second click confirms; chat-service keeps its history), and a
 * line dragged by its grip lands above, inside or below another (chat-service renumbers the places).
 * A click anywhere else on the line opens the skill's text in the right panel.
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

  /** Drag and drop: the tree moves at once; chat-service's answer (siblings renumbered) then wins. */
  const move = async (slug: string, to: { parentSlug: string; position: number }) => {
    const before = queryClient.getQueryData<SkillSummary[]>(["staffSkills"]);
    patchList((list) => applySkillMove(list, slug, to.parentSlug, to.position));
    try {
      const { skill, siblings } = await moveStaffSkill(slug, to);
      const places = new Map(siblings.map((x) => [x.slug, x.position]));
      patchList((list) => list.map((s) => (s.slug === skill.slug ? skill : places.has(s.slug) ? { ...s, position: places.get(s.slug)! } : s)));
      queryClient.setQueryData(["staffSkill", skill.slug], skill);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["staffSkills"] }),
        queryClient.invalidateQueries({ queryKey: ["staffDistryConfig"] }),
      ]);
    } catch (err) {
      queryClient.setQueryData(["staffSkills"], before);
      throw err;
    }
  };

  const remove = async (slug: string) => {
    await deleteStaffSkill(slug);
    patchList((list) => list.filter((s) => s.slug !== slug));
    queryClient.removeQueries({ queryKey: ["staffSkill", slug] });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staffSkills"] }),
      queryClient.invalidateQueries({ queryKey: ["staffDistryConfig"] }),
    ]);
  };

  return { rename, create, move, remove };
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
  onDeleted,
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
  /** A skill left the tree: the page closes its panel if it was open on it. */
  onDeleted?: (slug: string) => void;
}) {
  const list = useAuthQuery(["staffSkills"], getStaffSkills, { staleTime: 30_000, retry: false });
  const tree = useMemo(() => (list.data ? buildSkillTree(list.data) : undefined), [list.data]);
  const [open, setOpen] = useState<Set<string> | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<{ slug: string; zone: DropZone } | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const writes = useSkillWrites();
  const plan = (target: string, zone: DropZone) => (dragged && list.data ? planSkillDrop(list.data, dragged, target, zone) : null);
  const drop = async (target: string, zone: DropZone) => {
    const to = plan(target, zone);
    setDragged(null);
    setOver(null);
    if (!to || !dragged) return;
    setMoveError(null);
    if (zone === "inside") setOpen((prev) => new Set([...(prev ?? []), target]));
    try {
      await writes.move(dragged, to);
    } catch (err) {
      console.error("[dashboard] skill tree: move refused", { dragged, to, err });
      setMoveError(err instanceof ApiError && (err.status === 400 || err.status === 409) ? "Not moved: a skill cannot go under its own branch, and the root stays on top." : "Not moved. Try again in a moment.");
    }
  };
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
      {moveError && <p className="px-4 py-2 text-[12px] text-[var(--data-rose)]">{moveError}</p>}
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
                onDelete={async () => {
                  await writes.remove(r.skill.slug);
                  onDeleted?.(r.skill.slug);
                }}
                drag={{
                  draggable: r.skill.parentSlug !== null,
                  dragging: dragged === r.skill.slug,
                  // Under the pointer and accepted: where the line would land.
                  zone: over?.slug === r.skill.slug ? over.zone : null,
                  start: () => {
                    setMoveError(null);
                    setDragged(r.skill.slug);
                  },
                  end: () => {
                    setDragged(null);
                    setOver(null);
                  },
                  over: (zone) => {
                    if (!dragged || !list.data || isSelfOrDescendant(list.data, r.skill.slug, dragged) || !plan(r.skill.slug, zone)) {
                      if (over?.slug === r.skill.slug) setOver(null);
                      return false;
                    }
                    if (over?.slug !== r.skill.slug || over.zone !== zone) setOver({ slug: r.skill.slug, zone });
                    return true;
                  },
                  drop: (zone) => void drop(r.skill.slug, zone),
                }}
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
  onDelete,
  drag,
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
  onDelete: () => Promise<void>;
  drag: {
    draggable: boolean;
    dragging: boolean;
    zone: DropZone | null;
    start: () => void;
    end: () => void;
    over: (zone: DropZone) => boolean;
    drop: (zone: DropZone) => void;
  };
}) {
  const { skill, depth, hasChildren, childCount } = row;
  const Icon = hasChildren ? (isOpen ? FolderOpenIcon : FolderIcon) : FileTextIcon;
  const zoneOf = (e: React.DragEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    return dropZoneAt(e.clientY - box.top, box.height);
  };
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) onOpen();
      }}
      data-skill={skill.slug}
      draggable={drag.draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", skill.slug);
        drag.start();
      }}
      onDragEnd={drag.end}
      onDragOver={(e) => {
        if (drag.over(zoneOf(e))) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        drag.drop(zoneOf(e));
      }}
      className={`k-row group relative flex cursor-pointer items-start gap-3 px-4 py-2 ${selected || drag.zone === "inside" ? "k-selected" : ""} ${drag.dragging ? "opacity-50" : ""}`}
    >
      {/* Where the dragged line will land: a line above or below this one, or this one tinted for "inside". */}
      {(drag.zone === "before" || drag.zone === "after") && (
        <span
          aria-hidden
          className={`pointer-events-none absolute right-4 h-0.5 rounded-full bg-[var(--accent)] ${drag.zone === "before" ? "-top-px" : "-bottom-px"}`}
          style={{ left: 16 + depth * INDENT + 30 }}
        />
      )}
      {drag.draggable ? (
        <span aria-hidden title="Drag to move" className="k-fg4 -ml-3 mt-0.5 w-3 shrink-0 cursor-grab opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <DotsSixVerticalIcon size={14} weight="bold" />
        </span>
      ) : (
        <span className="-ml-3 w-3 shrink-0" />
      )}
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
      <DeleteButton title={skill.title} onDelete={onDelete} hasChildren={hasChildren} />
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

/**
 * The bin on a line: a first click asks, a second deletes (chat-service keeps every version, a PUT
 * brings it back). A refusal says why in our words: chat-service refuses a skill with sub-skills, and
 * a skill every chat reads.
 */
function DeleteButton({ title, hasChildren, onDelete }: { title: string; hasChildren: boolean; onDelete: () => Promise<void> }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const click = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!asking) {
      setAsking(true);
      setError(null);
      return;
    }
    setBusy(true);
    try {
      await onDelete();
    } catch (err) {
      console.error("[dashboard] skill tree: delete refused", { title, err });
      setError(
        err instanceof ApiError && err.status === 409
          ? hasChildren
            ? "Move or delete its sub-skills first."
            : "Every chat reads this skill: it stays."
          : "Not deleted. Try again in a moment.",
      );
      setAsking(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="relative mt-0.5 flex shrink-0 flex-col items-end">
      <button
        type="button"
        aria-label={asking ? `Confirm: delete ${title}` : `Delete ${title}`}
        title={asking ? "Click again to delete" : "Delete this skill"}
        disabled={busy}
        onClick={(e) => void click(e)}
        onBlur={() => setAsking(false)}
        className={`k-btn-ghost inline-flex h-6 shrink-0 items-center justify-center gap-1 transition-opacity duration-150 ${
          asking || error ? "opacity-100" : "w-6 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        }`}
        style={{ padding: asking ? "0 8px" : 0, color: asking ? "var(--data-rose)" : undefined }}
      >
        <TrashIcon size={14} weight="bold" />
        {asking && <span className="text-[12px]">{busy ? "Deleting…" : "Delete?"}</span>}
      </button>
      {error && <span className="absolute top-7 right-0 z-10 whitespace-nowrap text-[12px] text-[var(--data-rose)]">{error}</span>}
    </span>
  );
}
