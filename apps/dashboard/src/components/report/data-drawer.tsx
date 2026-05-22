"use client";

import { useEffect, type ReactNode } from "react";

export interface DrawerEntry {
  label: string;
  value: ReactNode;
  monospace?: boolean;
  /** Render value as a block (full width, below the label) instead of inline. */
  block?: boolean;
}

interface DataDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  entries: DrawerEntry[];
}

export function DataDrawer({ open, onClose, title, subtitle, entries }: DataDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      />
      <aside
        aria-hidden={!open}
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-md bg-white shadow-2xl flex flex-col transition-transform ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <header className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold text-gray-800 truncate">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {entries.map((e, i) => (
            <div key={`${e.label}-${i}`} className={e.block ? "space-y-1" : "flex items-start justify-between gap-3"}>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide flex-shrink-0">{e.label}</div>
              <div className={`text-sm text-gray-800 ${e.block ? "" : "text-right"} ${e.monospace ? "font-mono text-xs" : ""} break-words min-w-0`}>
                {e.value ?? <span className="text-gray-400">—</span>}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
