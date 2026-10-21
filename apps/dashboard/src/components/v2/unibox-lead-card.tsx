"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { timeAgo } from "@/lib/friendly-datetime";
import {
  DIMENSION_LABEL,
  DIMENSION_VALUES,
  UNIBOX_DIMENSIONS,
  dimensionValueLabel,
  lifecycleOptions,
  uniboxRowTag,
  uniboxValueTag,
  uniboxValueTone,
  type LifecycleRung,
  type UniboxDimension,
  type UniboxFilters,
  type UniboxLeadCard,
  type UniboxRow,
} from "@/lib/unibox-leads";
import { TONE_COLOR, TagChip } from "@/components/v2/tag-chip";
import { EmptyNote, Shimmer } from "@/components/v2/ui";

/**
 * A row's tag (owner 2026-10-21): the ONE hottest thing about where the lead stands, in the colour
 * it has on the card, the header and the thread; nothing for the default. Roles stay grey words.
 */
export function UniboxRowTags({ row, ladder }: { row: UniboxRow; ladder: LifecycleRung[] }) {
  const tag = uniboxRowTag(row, ladder);
  if (tag) return <TagChip tag={tag} shrink />;
  const roles = row.roles ?? [];
  if (roles.length === 0) return null;
  return (
    <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
      {roles.map((t) => (
        <span key={t} className="k-fg3 text-[12px]">
          {dimensionValueLabel("role", t)}
        </span>
      ))}
    </span>
  );
}

/**
 * Above the cards: one menu per tag dimension, several values each. lead-service filters.
 * `dims` narrows the menus (the Deals board drops Lifecycle: its columns ARE the lifecycle).
 */
export function UniboxFilterBar({
  filters,
  ladder,
  onPick,
  dims = UNIBOX_DIMENSIONS,
}: {
  filters: UniboxFilters;
  ladder: LifecycleRung[];
  onPick: (dim: UniboxDimension, values: string[]) => void;
  dims?: readonly UniboxDimension[];
}) {
  const any = dims.some((d) => (filters[d]?.length ?? 0) > 0);
  return (
    <div role="group" aria-label="Filter leads" className="flex shrink-0 flex-wrap items-center gap-1.5">
      {dims.map((d) => (
        <DimensionMenu
          key={d}
          label={DIMENSION_LABEL[d]}
          dim={d}
          options={d === "lifecycle" ? lifecycleOptions(ladder) : DIMENSION_VALUES[d]}
          value={filters[d] ?? []}
          onPick={(v) => onPick(d, v)}
        />
      ))}
      {any && (
        <button type="button" className="k-btn-ghost" onClick={() => dims.forEach((d) => filters[d]?.length && onPick(d, []))}>
          Clear filters
        </button>
      )}
    </div>
  );
}

function DimensionMenu({
  label,
  dim,
  options,
  value,
  onPick,
}: {
  label: string;
  dim: UniboxDimension;
  options: { value: string; label: string }[];
  value: string[];
  onPick: (v: string[]) => void;
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
    const h = options.length * 32 + 8;
    const below = r.bottom + 4 + h <= window.innerHeight - 8;
    setPos({ top: below ? r.bottom + 4 : Math.max(8, r.top - 4 - h), left: Math.max(8, Math.min(r.left, window.innerWidth - 228)) });
  }, [open, options.length]);
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
  const picked = options.filter((o) => value.includes(o.value));
  const shown = picked.length === 0 ? label : picked.length === 1 ? picked[0].label : `${label} · ${picked.length}`;
  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`k-btn gap-1.5 ${picked.length ? "k-selected" : ""}`}
      >
        {shown}
        <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true" className="k-fg3">
          <path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open &&
        host &&
        pos &&
        createPortal(
          <div ref={menu} role="menu" aria-label={label} className="k-popover fixed z-[90] w-[220px] p-1" style={{ top: pos.top, left: pos.left }}>
            {options.map((o) => {
              const on = value.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={on}
                  onClick={() => onPick(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
                  className="k-row flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px]"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px]"
                    style={on ? { background: "var(--accent)", color: "white" } : { boxShadow: "inset 0 0 0 1px var(--line)" }}
                  >
                    {on && (
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                        <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  {/* The value's colour, the same as its tag on the rows and the card. */}
                  <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TONE_COLOR[uniboxValueTone(dim, o.value)] }} />
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
          </div>,
          host,
        )}
    </>
  );
}

/**
 * The lead card beside the thread (owner 2026-10-17, like an inbox contact sidebar): the six
 * tags lead-service decides, then one line per campaign the person is part of (a sales funnel
 * campaign once, its name and furthest step as lead-service serves them). The step by step detail stays in the thread.
 */
export function UniboxLeadCardPanel({
  card,
  failed,
  listed,
  inline = false,
}: {
  card: UniboxLeadCard | null;
  failed: boolean;
  listed: UniboxRow | null;
  /** Folded into the thread header (a narrow panel): no card frame, never a second card below the thread. */
  inline?: boolean;
}) {
  const lead = card?.lead ?? listed;
  return (
    <aside
      className={inline ? "pt-3" : "k-card k-scroll hidden h-fit max-h-full w-[300px] shrink-0 overflow-y-auto p-4 @6xl:block"}
      aria-label="Lead"
    >
      {lead ? (
        <>
          {/* Who it is lives in the thread header beside it: the card starts on the tags. */}
          {!inline && <p className="k-label">Lead</p>}
          <dl className={`${inline ? "" : "mt-3 "}grid grid-cols-[96px_minmax(0,1fr)] items-start gap-x-3 gap-y-2.5`}>
            <Field label={DIMENSION_LABEL.status}>
              {lead.status ? (
                <TagChip tag={uniboxValueTag("status", lead.status, dimensionValueLabel("status", lead.status))} />
              ) : (
                <span className="k-fg4">—</span>
              )}
            </Field>
            <Field label={DIMENSION_LABEL.role}>
              {lead.roles && lead.roles.length > 0 ? (
                <span className="flex flex-wrap gap-1">
                  {lead.roles.map((t) => (
                    <TagChip key={t} tag={uniboxValueTag("role", t, dimensionValueLabel("role", t))} />
                  ))}
                </span>
              ) : (
                <span className="k-fg4">—</span>
              )}
            </Field>
            <Field label={DIMENSION_LABEL.lifecycle}>
              {lead.lifecycle ? (
                <TagChip tag={uniboxValueTag("lifecycle", lead.lifecycle.key, lead.lifecycle.label)} />
              ) : (
                <span className="k-fg3">No stage yet</span>
              )}
            </Field>
            {(["interest", "conversation", "contactability", "fit"] as const).map((d) => (
              <Field key={d} label={DIMENSION_LABEL[d]}>
                <TagChip tag={uniboxValueTag(d, lead[d], dimensionValueLabel(d, lead[d]))} />
                {d === "fit" && lead.fitNote ? <p className="k-fg2 mt-1 text-[12px] leading-[18px]">{lead.fitNote}</p> : null}
              </Field>
            ))}
          </dl>
          <p className="k-label mt-5">Campaigns</p>
          {card ? (
            card.campaigns.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {card.campaigns.map((c) => (
                  <li key={c.campaignId} className="text-[13px] leading-5">
                    <span className={c.name ? "" : "k-fg3"}>{c.name ?? "Campaign"}</span>
                    <span className="k-fg3"> → </span>
                    <span className="font-medium">{c.furthest?.label ?? "Not started"}</span>
                    {c.servedAt && <span className="k-fg3 block text-[12px]">Added {timeAgo(c.servedAt)}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="k-fg3 mt-2 text-[12px]">Not in any campaign yet.</p>
            )
          ) : failed ? (
            <p className="k-fg3 mt-2 text-[12px]">We could not load the campaigns. Retrying.</p>
          ) : (
            <div className="mt-2 space-y-2">
              <Shimmer className="h-5 w-full" />
              <Shimmer className="h-5 w-2/3" />
            </div>
          )}
        </>
      ) : failed ? (
        <EmptyNote>This person is not one of your leads.</EmptyNote>
      ) : (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Shimmer key={i} className="h-5 w-full" />
          ))}
        </div>
      )}
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="k-label pt-1">{label}</dt>
      <dd className="min-w-0 text-[13px]">{children}</dd>
    </>
  );
}
