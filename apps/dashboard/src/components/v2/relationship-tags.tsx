"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatCount } from "@/lib/format-number";
import { RELATIONSHIP_TAGS, relationshipTagLabel } from "@/lib/v2/relationships";

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
    setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - 248)) });
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
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
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
