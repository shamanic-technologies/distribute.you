"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuthQuery, useQueryClient } from "@/lib/use-auth-query";
import { ApiError, deleteStaffSkill, getStaffSkill, getStaffSkillTree, writeStaffSkill, type StaffSkill, type StaffSkillTree } from "@/lib/api";
import {
  allTreeKeys,
  editedByLabel,
  mentionQueryAt,
  mentionTreeRows,
  slugForNewSkill,
  splitMentions,
  unreachedRows,
  type LinkedSkill,
  type MentionRow,
  type SkillMention,
} from "@/lib/monitoring/skills-tree";
import { EmptyNote, Shimmer } from "@/components/v2/ui";
import { timeAgo } from "@/lib/friendly-datetime";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { FileTextIcon } from "@phosphor-icons/react/dist/csr/FileText";
import { ChatCircleTextIcon } from "@phosphor-icons/react/dist/csr/ChatCircleText";
import { WrenchIcon } from "@phosphor-icons/react/dist/csr/Wrench";

/**
 * Distry's skills (DISTRY-SKILL-MENTIONS-1122, owner 2026-11-22), the one home of the skills: the
 * Monitoring > Chat > Distry page. A skill is a page of text; texts mention other skills and tools
 * with `@`, and the tree is WHO MENTIONS WHOM from Distry's Prompt (the one text read on every
 * message). chat-service serves every link; nothing here parses a text for links, it only lays them
 * out and shows each `@skill:` / `@tool:` token as a chip. Three views of the same skills: Tree,
 * Table, Graph. "Not mentioned" tags a skill nothing cites: Distry never reads it.
 */

export type SkillsOpen = { kind: "prompt" } | { kind: "skill"; slug: string } | { kind: "tool"; name: string };

const TREE_KEY = ["staffSkillTree"] as const;

export function useSkillTree() {
  return useAuthQuery(TREE_KEY, getStaffSkillTree, { staleTime: 30_000, retry: false });
}

export function useSkillWrites() {
  const queryClient = useQueryClient();
  const settle = async (skill: StaffSkill) => {
    queryClient.setQueryData(["staffSkill", skill.slug], skill);
    queryClient.setQueryData<StaffSkillTree>(TREE_KEY, (prev) =>
      prev ? { ...prev, skills: prev.skills.some((s) => s.slug === skill.slug) ? prev.skills.map((s) => (s.slug === skill.slug ? { ...s, ...skill } : s)) : [...prev.skills, skill] } : prev,
    );
    // Links move with every text: chat-service recomputes them, so re-read the tree and Distry's config.
    await Promise.all([queryClient.invalidateQueries({ queryKey: TREE_KEY }), queryClient.invalidateQueries({ queryKey: ["staffDistryConfig"] })]);
  };

  /** chat-service takes the full body on every write, so a rename sends the served text back as is. */
  const rename = async (slug: string, change: { title?: string; description?: string }) => {
    const current = await queryClient.fetchQuery({ queryKey: ["staffSkill", slug], queryFn: () => getStaffSkill(slug), staleTime: 0 });
    const { skill } = await writeStaffSkill(slug, { content: current.content, ...change });
    await settle(skill);
  };

  /** "Add a skill" (owner: never a sub-skill): a standalone page, "Not mentioned" until a text cites it. */
  const create = async (title: string, description: string): Promise<StaffSkill> => {
    const tree = queryClient.getQueryData<StaffSkillTree>(TREE_KEY);
    const slug = slugForNewSkill(title, new Set((tree?.skills ?? []).map((s) => s.slug)));
    if (!slug) throw new SkillWriteRefused("Use at least one letter or digit in the title.");
    const { skill } = await writeStaffSkill(slug, { title, description, content: `# ${title}\n\n${description}\n` });
    await settle(skill);
    return skill;
  };

  const remove = async (slug: string) => {
    await deleteStaffSkill(slug);
    queryClient.setQueryData<StaffSkillTree>(TREE_KEY, (prev) => (prev ? { ...prev, skills: prev.skills.filter((s) => s.slug !== slug) } : prev));
    queryClient.removeQueries({ queryKey: ["staffSkill", slug] });
    await Promise.all([queryClient.invalidateQueries({ queryKey: TREE_KEY }), queryClient.invalidateQueries({ queryKey: ["staffDistryConfig"] })]);
  };

  return { rename, create, remove };
}

class SkillWriteRefused extends Error {}

/** Our own sentence for a refused write, chosen from the status; the real error goes to the console. */
export function refusal(err: unknown, verb: "saved" | "created" | "deleted"): string {
  console.error(`[dashboard] skills: not ${verb}`, err);
  if (err instanceof SkillWriteRefused) return err.message;
  if (err instanceof ApiError && err.status === 400) return verb === "created" ? "Not created: that name is not allowed. Try another title." : "Not saved: refused. Check the text.";
  return `Not ${verb}. Try again in a moment.`;
}

type View = "tree" | "table" | "graph";

/** The Skills block of the Distry page: Tree / Table / Graph, and "Add a skill". */
export function SkillsBlock({ selected, onOpen }: { selected: SkillsOpen | null; onOpen: (o: SkillsOpen) => void }) {
  const q = useSkillTree();
  const [view, setView] = useState<View>("tree");
  const [adding, setAdding] = useState(false);
  const writes = useSkillWrites();
  if (q.isError) {
    console.error("[dashboard] skills: tree failed", q.error);
    return (
      <div className="k-card">
        <EmptyNote>Could not read the skills from production.</EmptyNote>
      </div>
    );
  }
  const data = q.data;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="k-inset inline-flex rounded-[8px] p-0.5" role="tablist" aria-label="Skills view">
          {(["tree", "table", "graph"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`h-6 rounded-[6px] px-2.5 text-[12px] ${view === v ? "k-card k-fg" : "k-fg3"}`}
            >
              {v === "tree" ? "Tree" : v === "table" ? "Table" : "Graph"}
            </button>
          ))}
        </div>
        <button type="button" className="k-btn" onClick={() => setAdding(true)}>
          + Add a skill
        </button>
      </div>
      {adding && (
        <NewSkillCard
          onCancel={() => setAdding(false)}
          onCreate={async (title, description) => {
            const skill = await writes.create(title, description);
            setAdding(false);
            onOpen({ kind: "skill", slug: skill.slug });
          }}
        />
      )}
      {!data ? (
        <div className="k-card">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex h-9 items-center px-4">
              <Shimmer className="h-4 w-full" />
            </div>
          ))}
        </div>
      ) : data.promptMentions === null ? (
        // chat-service not yet serving the links: say it, never draw a stale tree.
        <div className="k-card">
          <EmptyNote>The skills&apos; links are not served yet. They appear here once chat-service is updated.</EmptyNote>
        </div>
      ) : view === "tree" ? (
        <TreeView skills={data.skills} promptMentions={data.promptMentions} selected={selected} onOpen={onOpen} onDelete={writes.remove} />
      ) : view === "table" ? (
        <TableView skills={data.skills} onOpen={onOpen} />
      ) : (
        <GraphView skills={data.skills} promptMentions={data.promptMentions} onOpen={onOpen} />
      )}
    </div>
  );
}

function NotMentioned() {
  return (
    <span className="k-chip shrink-0" style={{ color: "var(--data-amber)" }} title="Nothing mentions it: Distry never reads it">
      Not mentioned
    </span>
  );
}

// ─── Tree ────────────────────────────────────────────────────────────────────────────────

function TreeView({
  skills,
  promptMentions,
  selected,
  onOpen,
  onDelete,
}: {
  skills: LinkedSkill[];
  promptMentions: SkillMention[];
  selected: SkillsOpen | null;
  onOpen: (o: SkillsOpen) => void;
  onDelete: (slug: string) => Promise<void>;
}) {
  const [open, setOpen] = useState<Set<string> | null>(null);
  // Everything opens on the first answer (nothing hidden); after that, what the reader closed stays closed.
  useEffect(() => {
    if (open === null) setOpen(allTreeKeys(skills, promptMentions));
  }, [open, skills, promptMentions]);
  const keys = open ?? new Set<string>();
  const bySlug = useMemo(() => new Map(skills.map((s) => [s.slug, s])), [skills]);
  const rows = mentionTreeRows(skills, promptMentions, keys);
  const lost = unreachedRows(skills, keys);
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const line = (r: MentionRow) => (
    <TreeLine
      key={r.key}
      row={r}
      skill={r.slug ? bySlug.get(r.slug) : undefined}
      bySlug={bySlug}
      isOpen={keys.has(r.key)}
      selected={r.slug === null ? selected?.kind === "prompt" : selected?.kind === "skill" && selected.slug === r.slug}
      onToggle={() => toggle(r.key)}
      onOpen={() => onOpen(r.slug === null ? { kind: "prompt" } : { kind: "skill", slug: r.slug })}
      onDelete={r.slug ? () => onDelete(r.slug!) : undefined}
    />
  );
  return (
    <div className="k-card overflow-visible py-1">
      {rows.map(line)}
      {lost.length > 0 && (
        <>
          <div className="k-line-subtle mt-1 border-t px-4 pt-3 pb-1">
            <span className="k-label">Not reached by Distry</span>
          </div>
          {lost.map(line)}
        </>
      )}
    </div>
  );
}

function TreeLine({
  row,
  skill,
  bySlug,
  isOpen,
  selected,
  onToggle,
  onOpen,
  onDelete,
}: {
  row: MentionRow;
  skill: LinkedSkill | undefined;
  bySlug: Map<string, LinkedSkill>;
  isOpen: boolean;
  selected: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onDelete?: () => Promise<void>;
}) {
  const isPrompt = row.slug === null;
  const title = isPrompt ? "Prompt" : (skill?.title ?? row.slug ?? "");
  const others = skill?.mentionedBy ? skill.mentionedBy.skills.length + (skill.mentionedBy.prompt ? 1 : 0) : 0;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) onOpen();
      }}
      data-skill={row.slug ?? "prompt"}
      title={skill?.description}
      className={`k-row group relative flex h-8 cursor-pointer items-center gap-1.5 pr-3 ${selected ? "k-selected" : ""}`}
      style={{ paddingLeft: 12 + row.depth * 18 }}
    >
      {row.childCount > 0 ? (
        <button
          type="button"
          aria-label={isOpen ? `Close ${title}` : `Open ${title}`}
          aria-expanded={isOpen}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="k-btn-ghost inline-flex shrink-0 items-center justify-center"
          style={{ width: 20, height: 20, padding: 0 }}
        >
          <CaretRightIcon size={11} weight="bold" className={`transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`} />
        </button>
      ) : (
        <span className="inline-block w-5 shrink-0" />
      )}
      {isPrompt ? (
        <ChatCircleTextIcon size={16} weight="duotone" className="shrink-0" style={{ color: "var(--accent)" }} />
      ) : (
        <FileTextIcon size={16} weight="duotone" className="shrink-0" style={{ color: "var(--fg-3)" }} />
      )}
      <span className={`truncate text-[13px] ${isPrompt ? "font-medium" : ""}`}>{title}</span>
      {isPrompt && <span className="k-fg3 shrink-0 text-[12px]">read on every message</span>}
      {row.repeat && (
        <span className="k-fg3 shrink-0 text-[12px]" title="Already above on this branch: a loop">
          ↺
        </span>
      )}
      {!row.repeat && !isPrompt && others > 1 && <span className="k-fg3 shrink-0 text-[12px]">· mentioned {others}×</span>}
      {skill?.neverMentioned && <NotMentioned />}
      <span className="flex-1" />
      {onDelete && skill && <RowMenu skill={skill} bySlug={bySlug} onDelete={onDelete} />}
    </div>
  );
}

/** ⋯ on a skill: Delete, after saying which texts still mention it (their mention will lead nowhere). */
function RowMenu({ skill, bySlug, onDelete }: { skill: LinkedSkill; bySlug: Map<string, LinkedSkill>; onDelete: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const btn = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.getElementById("v2-portal")), []);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-skill-menu]")) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);
  const by = skill.mentionedBy;
  const citing = [...(by?.prompt ? ["the Prompt"] : []), ...(by?.skills ?? []).map((s) => bySlug.get(s)?.title ?? s)];
  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={`More for ${skill.title}`}
        onClick={(e) => {
          e.stopPropagation();
          const r = btn.current!.getBoundingClientRect();
          setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
          setError(null);
          setOpen((o) => !o);
        }}
        className="k-btn-ghost inline-flex h-6 w-6 shrink-0 items-center justify-center opacity-40 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100"
        style={{ padding: 0 }}
      >
        ⋯
      </button>
      {open &&
        host &&
        pos &&
        createPortal(
          <div data-skill-menu className="k-popover fixed z-[90] w-[260px] p-1" style={{ top: pos.top, right: pos.right }} onClick={(e) => e.stopPropagation()}>
            {citing.length > 0 && <p className="k-fg3 px-2.5 pt-1.5 pb-1 text-[12px]">Mentioned by {citing.join(", ")}. Those mentions will lead nowhere.</p>}
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onDelete();
                  setOpen(false);
                } catch (err) {
                  setError(refusal(err, "deleted"));
                } finally {
                  setBusy(false);
                }
              }}
              className="k-row w-full rounded-[6px] px-2.5 py-1.5 text-left text-[13px]"
              style={{ color: "var(--data-rose)" }}
            >
              {busy ? "Deleting…" : `Delete « ${skill.title} »`}
            </button>
            {error && <p className="px-2.5 pb-1.5 text-[12px] text-[var(--data-rose)]">{error}</p>}
          </div>,
          host,
        )}
    </>
  );
}

// ─── Table ───────────────────────────────────────────────────────────────────────────────

function TableView({ skills, onOpen }: { skills: LinkedSkill[]; onOpen: (o: SkillsOpen) => void }) {
  const [needle, setNeedle] = useState("");
  const n = needle.trim().toLowerCase();
  const shown = n ? skills.filter((s) => s.title.toLowerCase().includes(n) || s.description.toLowerCase().includes(n)) : skills;
  return (
    <div className="k-card overflow-hidden">
      <div className="k-line-subtle border-b px-3 py-2">
        <input value={needle} onChange={(e) => setNeedle(e.target.value)} placeholder="Search skills" aria-label="Search skills" className="k-input w-full" />
      </div>
      <div className="k-scroll overflow-x-auto">
        <table className="w-full table-fixed text-[13px]">
          <thead>
            <tr className="k-line-subtle border-b text-left">
              <th className="k-label px-3 py-2.5 first:pl-4">Skill</th>
              <th className="k-label w-[110px] px-3 py-2.5">Mentioned by</th>
              <th className="k-label w-[80px] px-3 py-2.5">Mentions</th>
              <th className="k-label hidden w-[110px] px-3 py-2.5 last:pr-4 md:table-cell">Updated</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((s) => {
              const by = s.mentionedBy ? s.mentionedBy.skills.length + (s.mentionedBy.prompt ? 1 : 0) : null;
              return (
                <tr key={s.slug} className="k-row k-line-subtle cursor-pointer border-b last:border-b-0" onClick={() => onOpen({ kind: "skill", slug: s.slug })}>
                  <td className="px-3 py-2 first:pl-4">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{s.title}</span>
                      {s.neverMentioned && <NotMentioned />}
                    </div>
                    <div className="k-fg3 truncate text-[12px]">{s.description}</div>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{by === null ? <span className="k-fg4">—</span> : `${s.mentionedBy?.prompt ? "Prompt" : ""}${s.mentionedBy?.prompt && s.mentionedBy.skills.length ? " + " : ""}${s.mentionedBy?.skills.length ? s.mentionedBy.skills.length : by === 0 ? "0" : ""}`}</td>
                  <td className="px-3 py-2 tabular-nums">{s.mentions ? s.mentions.length : <span className="k-fg4">—</span>}</td>
                  <td className="k-fg2 hidden px-3 py-2 text-[12px] last:pr-4 md:table-cell" title={`${editedByLabel(s.updatedBy)}, ${s.updatedAt}`}>
                    {timeAgo(s.updatedAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {shown.length === 0 && <EmptyNote>No skill matches.</EmptyNote>}
    </div>
  );
}

// ─── Graph ───────────────────────────────────────────────────────────────────────────────

const COL_W = 210;
const ROW_H = 34;
const NODE_W = 176;

/**
 * Columns by distance from the Prompt (the fewest mentions to follow), tools mentioned on the right,
 * skills Distry never reaches in their own last column. Every arrow is a served mention.
 */
function GraphView({ skills, promptMentions, onOpen }: { skills: LinkedSkill[]; promptMentions: SkillMention[]; onOpen: (o: SkillsOpen) => void }) {
  const layout = useMemo(() => {
    const live = new Map(skills.map((s) => [s.slug, s]));
    const depth = new Map<string, number>();
    let frontier = promptMentions.filter((m) => m.kind === "skill" && live.has(m.ref)).map((m) => m.ref);
    frontier.forEach((s) => depth.set(s, 1));
    for (let d = 2; frontier.length; d++) {
      const next: string[] = [];
      for (const s of frontier)
        for (const m of live.get(s)?.mentions ?? [])
          if (m.kind === "skill" && live.has(m.ref) && !depth.has(m.ref)) {
            depth.set(m.ref, d);
            next.push(m.ref);
          }
      frontier = next;
    }
    const maxD = Math.max(1, ...depth.values());
    const lostCol = maxD + 1;
    const toolCol = lostCol + (skills.some((s) => !depth.has(s.slug)) ? 1 : 0);
    const cols = new Map<number, string[]>();
    const place = (id: string, c: number) => cols.set(c, [...(cols.get(c) ?? []), id]);
    place("prompt", 0);
    for (const s of skills) place(`skill:${s.slug}`, depth.get(s.slug) ?? lostCol);
    const tools = new Set<string>();
    for (const m of promptMentions) if (m.kind === "tool") tools.add(m.ref);
    for (const s of skills) for (const m of s.mentions ?? []) if (m.kind === "tool") tools.add(m.ref);
    for (const t of tools) place(`tool:${t}`, toolCol);
    const at = new Map<string, { x: number; y: number }>();
    for (const [c, ids] of cols) ids.forEach((id, i) => at.set(id, { x: 16 + c * COL_W, y: 16 + i * ROW_H }));
    const edges: { from: string; to: string; back: boolean }[] = [];
    const add = (from: string, m: SkillMention) => {
      const to = m.kind === "skill" ? `skill:${m.ref}` : `tool:${m.ref}`;
      if (!at.has(to)) return;
      edges.push({ from, to, back: at.get(to)!.x <= at.get(from)!.x });
    };
    promptMentions.forEach((m) => add("prompt", m));
    for (const s of skills) for (const m of s.mentions ?? []) add(`skill:${s.slug}`, m);
    const width = 32 + (Math.max(...cols.keys()) + 1) * COL_W;
    const height = 32 + Math.max(...[...cols.values()].map((v) => v.length)) * ROW_H;
    return { at, edges, width, height, live, lostCol, hasLost: toolCol !== lostCol || skills.some((s) => !depth.has(s.slug)) };
  }, [skills, promptMentions]);

  return (
    <div className="k-card k-scroll overflow-auto" style={{ maxHeight: 640 }}>
      <svg width={layout.width} height={layout.height} role="img" aria-label="Skills graph: who mentions whom">
        {layout.edges.map((e, i) => {
          const a = layout.at.get(e.from)!;
          const b = layout.at.get(e.to)!;
          const x1 = a.x + NODE_W;
          const y1 = a.y + 12;
          const x2 = b.x;
          const y2 = b.y + 12;
          const mid = (x1 + x2) / 2;
          return (
            <path
              key={i}
              d={e.back ? `M${x1},${y1} C${x1 + 40},${y1} ${x2 - 40},${y2} ${x2},${y2}` : `M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
              fill="none"
              stroke={e.back ? "var(--line)" : "var(--accent)"}
              strokeOpacity={e.back ? 1 : 0.45}
              strokeWidth={1}
            />
          );
        })}
        {[...layout.at.entries()].map(([id, p]) => {
          const [kind, ref] = id === "prompt" ? ["prompt", ""] : [id.slice(0, id.indexOf(":")), id.slice(id.indexOf(":") + 1)];
          const skill = kind === "skill" ? layout.live.get(ref) : undefined;
          const label = kind === "prompt" ? "Prompt" : kind === "tool" ? ref : (skill?.title ?? ref);
          const amber = skill?.neverMentioned;
          return (
            <g
              key={id}
              transform={`translate(${p.x},${p.y})`}
              className="cursor-pointer"
              onClick={() => onOpen(kind === "prompt" ? { kind: "prompt" } : kind === "tool" ? { kind: "tool", name: ref } : { kind: "skill", slug: ref })}
            >
              <title>{amber ? `${label} (Not mentioned: Distry never reads it)` : (skill?.description ?? label)}</title>
              <rect width={NODE_W} height={24} rx={7} fill="var(--bg-raised)" stroke={amber ? "var(--data-amber)" : kind === "prompt" ? "var(--accent)" : "var(--line)"} />
              <text x={10} y={16} fontSize={12} fill={kind === "tool" ? "var(--fg-3)" : "var(--fg-1)"} fontFamily={kind === "tool" ? "var(--font-mono, monospace)" : undefined}>
                {label.length > (amber ? 15 : 26) ? `${label.slice(0, amber ? 14 : 25)}…` : label}
              </text>
              {amber && (
                <text x={NODE_W - 8} y={16} fontSize={10} textAnchor="end" fill="var(--data-amber)">
                  Not mentioned
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── New skill ───────────────────────────────────────────────────────────────────────────

function NewSkillCard({ onCreate, onCancel }: { onCreate: (title: string, description: string) => Promise<void>; onCancel: () => void }) {
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
      return setError("Add a one-line description: Distry reads it to pick the skill.");
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
    <div className="k-card space-y-1.5 p-3">
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
        placeholder="When Distry should read it, in one line"
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
      <div className="flex items-center gap-3 pt-1 text-[12px]">
        <span className="k-fg3">{busy ? "Creating…" : "Enter creates it. It shows « Not mentioned » until a text cites it with @."}</span>
        <span className="flex-1" />
        <button type="button" className="k-btn-ghost h-6 px-2" onClick={onCancel}>
          Cancel
        </button>
      </div>
      {error && <p className="text-[12px] text-[var(--data-rose)]">{error}</p>}
    </div>
  );
}

// ─── Text with mentions ──────────────────────────────────────────────────────────────────

/** Names for chips and the `@` menu: every live skill, and the tools a text may mention. */
export function useMentionables(tools: string[] | undefined) {
  const q = useSkillTree();
  return useMemo(() => ({ skills: (q.data?.skills ?? []).map((s) => ({ slug: s.slug, title: s.title })), tools: tools ?? [] }), [q.data, tools]);
}

type Mentionables = ReturnType<typeof useMentionables>;

/** A text read as formatted markdown, each `@skill:` / `@tool:` token a chip that opens what it names. */
export function MentionText({ text, names, onOpen }: { text: string; names: Mentionables; onOpen: (o: SkillsOpen) => void }) {
  const title = (slug: string) => names.skills.find((s) => s.slug === slug)?.title;
  // Each token becomes a link the renderer turns into a chip (react-markdown keeps the `#` href).
  const md = splitMentions(text)
    .map((p) => ("text" in p ? p.text : `[${(p.mention.kind === "skill" ? (title(p.mention.ref) ?? p.mention.ref) : p.mention.ref).replace(/[[\]]/g, "")}](#mention-${p.mention.kind}-${p.mention.ref})`))
    .join("");
  return (
    <div className="mention-text text-[13px] leading-[21px]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h3 className="mt-3 mb-1.5 text-[16px] font-semibold first:mt-0">{children}</h3>,
          h2: ({ children }) => <h4 className="mt-3 mb-1 text-[14px] font-semibold first:mt-0">{children}</h4>,
          h3: ({ children }) => <h5 className="mt-2.5 mb-1 text-[13px] font-semibold first:mt-0">{children}</h5>,
          p: ({ children }) => <p className="mb-2">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 ml-5 list-disc space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 ml-5 list-decimal space-y-0.5">{children}</ol>,
          code: ({ children }) => <code className="k-mono rounded-[4px] bg-[var(--line-subtle)] px-1 text-[12px]">{children}</code>,
          a: ({ href, children }) => {
            const m = /^#mention-(skill|tool)-(.+)$/.exec(href ?? "");
            if (!m) return <a href={href} className="text-[var(--accent)] underline">{children}</a>;
            const kind = m[1] as "skill" | "tool";
            const ref = m[2];
            const known = kind === "tool" ? names.tools.includes(ref) : !!title(ref);
            return (
              <MentionChip
                kind={kind}
                label={children}
                dead={!known}
                onClick={(e) => {
                  e.stopPropagation();
                  if (known) onOpen(kind === "skill" ? { kind: "skill", slug: ref } : { kind: "tool", name: ref });
                }}
              />
            );
          },
        }}
      >
        {md}
      </ReactMarkdown>
    </div>
  );
}

function MentionChip({ kind, label, dead, onClick }: { kind: "skill" | "tool"; label: ReactNode; dead: boolean; onClick: (e: React.MouseEvent) => void }) {
  const Icon = kind === "skill" ? FileTextIcon : WrenchIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      title={dead ? "This mention leads nowhere: the skill was deleted or the tool does not exist" : kind === "skill" ? "Open this skill" : "Open this tool"}
      className={`k-chip mx-0.5 inline-flex items-center gap-1 align-baseline ${dead ? "line-through opacity-60" : ""} ${kind === "tool" ? "k-mono" : ""}`}
    >
      <Icon size={11} weight="duotone" />
      {label}
    </button>
  );
}

/**
 * The text's field: typing `@` opens a menu of skills and tools filtered as you type; Enter, Tab or a
 * click writes the token (`@skill:<slug>` / `@tool:<name>`), Esc closes the menu.
 */
export function MentionTextarea({
  value,
  onChange,
  onBlur,
  onEscape,
  names,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (text: string) => void;
  onBlur: () => void;
  onEscape: () => void;
  names: Mentionables;
  className: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [query, setQuery] = useState<{ start: number; query: string } | null>(null);
  const [cursor, setCursor] = useState(0);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  const n = query?.query.toLowerCase() ?? "";
  const options = query
    ? [
        ...names.skills.filter((s) => s.title.toLowerCase().includes(n) || s.slug.includes(n)).map((s) => ({ kind: "skill" as const, ref: s.slug, label: s.title })),
        ...names.tools.filter((t) => t.toLowerCase().includes(n)).map((t) => ({ kind: "tool" as const, ref: t, label: t })),
      ].slice(0, 8)
    : [];
  const sync = () => {
    const el = ref.current;
    if (!el) return;
    const q = mentionQueryAt(el.value, el.selectionStart ?? 0);
    setQuery(q);
    if (!q) setCursor(0);
  };
  const pick = (o: { kind: "skill" | "tool"; ref: string }) => {
    const el = ref.current;
    if (!el || !query) return;
    const caret = el.selectionStart ?? 0;
    const token = `@${o.kind}:${o.ref} `;
    const next = value.slice(0, query.start) + token + value.slice(caret);
    onChange(next);
    setQuery(null);
    const at = query.start + token.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(at, at);
    });
  };
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <textarea
        ref={ref}
        value={value}
        spellCheck={false}
        onChange={(e) => {
          onChange(e.target.value);
          requestAnimationFrame(sync);
        }}
        onClick={sync}
        onKeyUp={(e) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) sync();
        }}
        onKeyDown={(e) => {
          if (options.length > 0) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((c) => (c + 1) % options.length);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((c) => (c - 1 + options.length) % options.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              pick(options[Math.min(cursor, options.length - 1)]);
              return;
            }
          }
          if (e.key === "Escape") {
            e.stopPropagation();
            if (query) setQuery(null);
            else onEscape();
          }
        }}
        onBlur={onBlur}
        className={className}
      />
      {options.length > 0 && (
        <div role="listbox" aria-label="Mention a skill or a tool" className="k-popover absolute right-3 bottom-3 left-3 z-10 max-h-64 overflow-y-auto p-1">
          {options.map((o, i) => (
            <div
              key={`${o.kind}:${o.ref}`}
              role="option"
              aria-selected={i === cursor}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              className={`flex cursor-pointer items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-[13px] ${i === cursor ? "k-selected" : "k-row"}`}
            >
              {o.kind === "skill" ? <FileTextIcon size={14} weight="duotone" className="k-fg3" /> : <WrenchIcon size={14} weight="duotone" className="k-fg3" />}
              <span className={`truncate ${o.kind === "tool" ? "k-mono" : ""}`}>{o.label}</span>
              <span className="k-fg3 ml-auto text-[11px]">{o.kind === "skill" ? "Skill" : "Tool"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A served text edited where it is read: ONE box for both states (same padding, font and border
 * width), the field sized by a hidden copy of its own value, so nothing moves on click. The typed
 * value shows while it saves; a refusal reopens the field with the text kept and says why.
 */
export function InlineText({ value, onSave, label, max, className = "" }: { value: string; onSave: (next: string) => Promise<void>; label: string; max: number; className?: string }) {
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
