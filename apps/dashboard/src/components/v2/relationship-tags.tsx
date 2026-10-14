"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatCount } from "@/lib/format-number";
import { RELATIONSHIP_TAGS, relationshipTagLabel } from "@/lib/v2/relationships";
import { useQueryClient } from "@tanstack/react-query";
import { undoRelationshipMerge } from "@/lib/api";

/**
 * Who a person is to the brand, as chips (RELATIONSHIP-TAGS-1014): one plain chip per
 * YES tag, then one dashed chip with a "?" per tag the AI is unsure about (the owner
 * settles those on the brand's People page). Draws what lead-service serves, nothing more.
 */
export function RelationshipChips({ tags, unsureTags }: { tags: string[]; unsureTags: string[] }) {
  if (tags.length === 0 && unsureTags.length === 0) return null;
  return (
    <>
      {tags.map((t) => (
        <span key={t} className="k-chip">
          {relationshipTagLabel(t)}
        </span>
      ))}
      {unsureTags.map((t) => (
        <span
          key={`unsure-${t}`}
          className="k-chip k-fg3"
          style={{ background: "transparent", boxShadow: "none", outline: "1px dashed var(--line)", outlineOffset: "-1px" }}
          title="Not sure yet. Settle it on the brand's People page."
        >
          {relationshipTagLabel(t)}?
        </span>
      ))}
    </>
  );
}

export type RelationshipFilterValue = string | null;

export interface RelationshipCounts {
  status: string;
  counts: Record<string, number> | null;
  untagged: number | null;
  unjudged: number | null;
  population: number;
}

/** The menu's lines: Everyone, each tag, then the two served buckets with no tag. */
function filterOptions(): Array<{ value: RelationshipFilterValue; label: string }> {
  return [
    { value: null, label: "Everyone" },
    ...RELATIONSHIP_TAGS.map((t) => ({ value: t as string, label: relationshipTagLabel(t) })),
    { value: "untagged", label: "No tag" },
    { value: "unjudged", label: "Not read yet" },
  ];
}

function countOf(c: RelationshipCounts | null, value: RelationshipFilterValue): number | null {
  if (!c || c.status === "failed") return null;
  if (value === null) return c.population;
  if (value === "untagged") return c.untagged;
  if (value === "unjudged") return c.unjudged;
  return c.counts?.[value] ?? 0;
}

/**
 * Beside the family buttons: a `k-btn` naming the relationship shown, opening a menu of
 * every tag with crm-service's served count. Portalled and `fixed` against its button,
 * Esc or a click outside closes it.
 */
export function RelationshipFilter({
  value,
  counts,
  onPick,
}: {
  value: RelationshipFilterValue;
  counts: RelationshipCounts | null;
  onPick: (v: RelationshipFilterValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.getElementById("v2-portal") ?? document.body), []);
  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    // 32px per line + 8px padding; opens above its button when the panel has no room below.
    const h = filterOptions().length * 32 + 8;
    const below = r.bottom + 4 + h <= window.innerHeight - 8;
    setPos({ top: below ? r.bottom + 4 : Math.max(8, r.top - 4 - h), left: Math.max(8, Math.min(r.left, window.innerWidth - 248)) });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    // The shell scrolls its panel, not the window: a fixed menu would drift off its button.
    const onScroll = (e: Event) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
      document.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [open]);

  const options = filterOptions();
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`k-btn ${value ? "k-selected" : ""}`}
      >
        {value ? current.label : "Who they are"}
        <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true" className="k-fg3">
          <path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open &&
        host &&
        pos &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            className="k-popover fixed z-[90] w-[240px] p-1"
            style={{ top: pos.top, left: pos.left }}
          >
            {options.map((o) => {
              const n = countOf(counts, o.value);
              const on = o.value === value;
              return (
                <button
                  key={o.value ?? "all"}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  onClick={() => {
                    onPick(o.value);
                    setOpen(false);
                  }}
                  className={`flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] ${on ? "k-selected k-fg" : "k-fg2 k-hover"}`}
                >
                  <span className="flex-1 truncate">{o.label}</span>
                  <span className="k-fg3 tabular-nums">{n === null ? "—" : formatCount(n)}</span>
                </button>
              );
            })}
          </div>,
          host,
        )}
    </>
  );
}

/** A row's ⋮: a small menu of the rare actions on that row. */
export function RowMenu({
  label,
  disabled,
  items,
}: {
  label: string;
  disabled: boolean;
  items: Array<{ label: string; onSelect: () => void }>;
}) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => setHost(document.getElementById("v2-portal") ?? document.body), []);
  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const h = items.length * 32 + 8;
    const below = r.bottom + 4 + h <= window.innerHeight - 8;
    // Right-aligned under the ⋮, which sits at the row's right edge.
    setPos({ top: below ? r.bottom + 4 : Math.max(8, r.top - 4 - h), left: Math.max(8, r.right - 200) });
  }, [open, items.length]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
      document.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [open]);
  return (
    <>
      <button
        ref={btn}
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="k-btn-ghost justify-center disabled:opacity-60"
        style={{ width: 28, padding: 0 }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="3.5" r="1.3" fill="currentColor" />
          <circle cx="8" cy="8" r="1.3" fill="currentColor" />
          <circle cx="8" cy="12.5" r="1.3" fill="currentColor" />
        </svg>
      </button>
      {open &&
        host &&
        pos &&
        createPortal(
          <div ref={menu} role="menu" className="k-popover fixed z-[90] w-[200px] p-1" style={{ top: pos.top, left: pos.left }}>
            {items.map((it) => (
              <button
                key={it.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  it.onSelect();
                }}
                className="k-fg2 k-hover flex h-8 w-full items-center rounded-lg px-2 text-left text-[13px]"
              >
                {it.label}
              </button>
            ))}
          </div>,
          host,
        )}
    </>
  );
}

/**
 * The Unibox thread's ⋮ (owner 2026-10-14): each merge that made this person can be undone
 * where the owner reads them. lead-service serves the merges on the person's block; an
 * unmerged pair is never merged again.
 */
export function UnmergeMenu({
  brandId,
  name,
  merges,
}: {
  brandId: string;
  name: string;
  merges: Array<{ linkId: string; names: Array<string | null> }>;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const left = merges.filter((m) => !done.has(m.linkId));
  if (left.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      {error && <span className="text-[12px] text-[var(--data-rose)]">{error}</span>}
      <RowMenu
        label={`More for ${name}`}
        disabled={busy}
        items={left.map((m) => ({
          label: `Unmerge ${m.names.map((n) => n ?? "Unnamed person").join(" and ")}`,
          onSelect: async () => {
            setBusy(true);
            setError(null);
            try {
              await undoRelationshipMerge(brandId, m.linkId);
              setDone((d) => new Set(d).add(m.linkId));
              void qc.invalidateQueries({ queryKey: ["people", brandId] });
              void qc.invalidateQueries({ queryKey: ["relationshipReview", brandId] });
            } catch (err) {
              console.error("[unibox] unmerge refused", { brandId, linkId: m.linkId, err });
              setError("Not unmerged. Try again.");
            } finally {
              setBusy(false);
            }
          },
        }))}
      />
    </span>
  );
}
