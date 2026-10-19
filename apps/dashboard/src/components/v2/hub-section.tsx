"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useState } from "react";
import { MarkLines } from "@/components/v2/ui";

/**
 * The staff hubs' row anatomy (Research, Monitoring): groups of collapsible rows, each a header
 * button (mark as tall as its two lines, a name, a second line, counts, a chevron) over a body of
 * chips and cards. Which rows are open is remembered per hub in localStorage, so Back from a page
 * finds them as left. One implementation, never a fork per hub.
 */

/** Which sections of one hub are open, remembered under `storageKey`. Collapsed by default. */
export function useOpenSections(storageKey: string) {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  // The motion only once the remembered state is painted: restoring it must not animate.
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const ids = raw ? (JSON.parse(raw) as unknown) : [];
      if (Array.isArray(ids)) setOpen(new Set(ids.filter((x): x is string => typeof x === "string")));
    } catch (e) {
      console.error(`[v2] ${storageKey} unreadable`, e);
    }
  }, [storageKey]);
  useEffect(() => {
    const t = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(t);
  }, []);
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch (e) {
        console.error(`[v2] ${storageKey} not saved`, e);
      }
      return next;
    });
  return { open, toggle, ready };
}

export const SectionChevron = ({ open }: { open: boolean }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 10 10"
    aria-hidden="true"
    className={`k-fg3 shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
  >
    <path d="M2.5 4l2.5 2.5L7.5 4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** One collapsible row of a hub: the header button, then its body shown on click. */
export function HubSectionBlock({
  id,
  open,
  onToggle,
  animate,
  mark,
  name,
  line,
  meta,
  children,
}: {
  id: string;
  open: boolean;
  onToggle: () => void;
  animate: boolean;
  mark: (px: number) => React.ReactNode;
  name: React.ReactNode;
  /** The second line under the name. */
  line: React.ReactNode;
  /** Counts on the right (hidden on a phone). */
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  const bodyId = `hub-section-${id}`;
  return (
    <section>
      <button type="button" aria-expanded={open} aria-controls={bodyId} onClick={onToggle} className="k-card flex w-full items-center gap-3 px-4 py-3 text-left">
        <MarkLines gap="gap-3" className="flex-1" mark={mark}>
          <span className="flex min-w-0 items-center gap-2 text-[14px] font-medium leading-5">
            <span className="truncate">{name}</span>
          </span>
          <span className="k-fg3 mt-0.5 min-w-0 text-[12px] leading-5">{line}</span>
        </MarkLines>
        {meta != null && <span className="k-fg3 hidden shrink-0 text-[12px] tabular-nums sm:inline">{meta}</span>}
        <SectionChevron open={open} />
      </button>
      <div
        id={bodyId}
        inert={!open}
        className={`grid ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"} ${
          animate ? "transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none" : ""
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-3">{children}</div>
        </div>
      </div>
    </section>
  );
}

function ChipArrow() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" className="k-fg4 shrink-0" aria-hidden="true">
      <path d="M2.5 6h7M6.5 3l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A chip leading from a hub row to one of its dedicated pages: a colour square, a name, a count. */
export function HubChip({ href, color, label, count }: { href: string; color: string; label: string; count?: number | null }) {
  return (
    <Link href={href} className="k-btn inline-flex items-center gap-2">
      <span className="h-2 w-2 rounded-[2px]" style={{ background: color }} />
      {label}
      {count != null && <span className="k-fg3 tabular-nums">{count.toLocaleString("en-US")}</span>}
      <ChipArrow />
    </Link>
  );
}

/** The row of chips at the top of a hub row's body. */
export function HubChips({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 flex flex-wrap gap-2">{children}</div>;
}
