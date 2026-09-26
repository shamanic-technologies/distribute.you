"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Keel's records frame (Companies, People): underline tabs with counts and a quiet
 * summary on the right, a toolbar with a "/" search, a full-bleed 40px table with a
 * sticky header, and a footer stating what is shown and the keys that work. The keys
 * are real: J/K move the highlighted row, Enter opens it, "/" focuses the search.
 */

export interface RecordsTab {
  key: string;
  label: string;
  count: number | null;
}

export function RecordsTabs({
  tabs,
  active,
  onPick,
  right,
}: {
  tabs: RecordsTab[];
  active: string;
  onPick: (key: string) => void;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 border-b border-[var(--line-subtle)] px-4 md:px-6">
      <nav className="k-scroll -mb-px flex min-w-0 gap-5 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onPick(t.key)}
            aria-current={t.key === active ? "page" : undefined}
            className="k-tab shrink-0 text-[13px]"
          >
            {t.label}
            {t.count != null && <span className="k-fg3 tabular-nums">{t.count.toLocaleString("en-US")}</span>}
          </button>
        ))}
      </nav>
      {right && <div className="k-fg3 ml-auto hidden shrink-0 items-center gap-2 text-[12px] lg:flex">{right}</div>}
    </div>
  );
}

export function RecordsToolbar({
  search,
  onSearch,
  placeholder,
  problem,
  right,
  inputRef,
}: {
  search: string;
  onSearch: (v: string) => void;
  placeholder: string;
  problem?: string | null;
  right?: React.ReactNode;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3 md:px-6">
      <label className="k-input flex w-full max-w-[240px] items-center gap-2 bg-[var(--bg-inset)] px-2.5">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="k-fg3 shrink-0" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          onKeyDown={(e) => {
            // Keel's records search: Esc leaves the field (the filter stays), and the
            // arrows hand the keyboard to the rows so the first match is one key away.
            if (e.key === "Escape" || e.key === "ArrowDown") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          type="search"
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--fg-3)] [&::-webkit-search-cancel-button]:hidden"
        />
        {search ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              onSearch("");
              inputRef?.current?.focus();
            }}
            className="k-fg3 -mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded hover:text-[var(--fg-1)]"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </button>
        ) : (
          <span className="k-kbd">/</span>
        )}
      </label>
      {problem ? <span className="text-[12px] text-[var(--data-rose)]">{problem}</span> : null}
      {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
    </div>
  );
}

export const REC_TH = "k-label h-9 px-3 text-left font-medium border-b border-[var(--line-subtle)]";

export function RecordsFooter({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="k-fg3 sticky bottom-0 z-[2] flex h-10 items-center gap-4 border-t border-[var(--line-subtle)] bg-[var(--bg-surface)]/95 px-4 text-[12px] backdrop-blur md:px-6">
      <span className="min-w-0 truncate tabular-nums">{left}</span>
      <span className="ml-auto flex shrink-0 items-center gap-3">
        {right}
        <span className="hidden items-center gap-1 md:inline-flex">
          <span className="k-kbd">J</span><span className="k-kbd">K</span> move
        </span>
        <span className="hidden items-center gap-1 md:inline-flex">
          <span className="k-kbd">↵</span> open
        </span>
      </span>
    </div>
  );
}

/**
 * J/K/Enter/"/" over a list of rows. `cursor` is the highlighted index; the page keeps
 * it in state and renders the highlight. Keys never fire while typing in a field.
 */
export function useRowKeys({
  count,
  cursor,
  setCursor,
  onOpen,
  searchRef,
}: {
  count: number;
  cursor: number;
  setCursor: (i: number) => void;
  onOpen: (i: number) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
}) {
  const latest = useRef({ count, cursor, setCursor, onOpen, searchRef });
  latest.current = { count, cursor, setCursor, onOpen, searchRef };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      const s = latest.current;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        s.searchRef.current?.focus();
        return;
      }
      // ArrowDown out of the search lands on the first row (the field blurs itself).
      if (e.key === "ArrowDown" && t === s.searchRef.current && s.count > 0) {
        s.setCursor(0);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey || s.count === 0) return;
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        s.setCursor(Math.min(s.count - 1, s.cursor + 1));
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        s.setCursor(Math.max(0, s.cursor - 1));
      }
      else if (e.key === "Enter" && s.cursor >= 0) s.onOpen(s.cursor);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

/**
 * Keel's download control. The file is fetched on press (lead-service streams the
 * whole matching set); a failure is stated on the button rather than swallowed.
 */
export function ExportButton({ filename, csv, disabled }: { filename: string; csv: () => Promise<string>; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const onClick = async () => {
    setState("busy");
    let text: string;
    try {
      text = await csv();
    } catch (error) {
      console.error("[dashboard v2] export failed", error);
      setState("failed");
      return;
    }
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setState("idle");
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled || state === "busy"} className="k-btn disabled:opacity-50" title="Export as CSV">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={state === "busy" ? "animate-pulse" : ""}>
        <path d="M8 2.5v8M4.8 7.5 8 10.7l3.2-3.2M3 13.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {state === "busy" ? "Preparing" : state === "failed" ? "Export failed, try again" : "Export"}
    </button>
  );
}
