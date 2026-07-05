"use client";

import { useMemo, useRef, useState } from "react";

export interface MultiSelectOption {
  id: string;
  label: string;
  sublabel?: string | null;
}

/**
 * Searchable multi-select. Renders selected values as removable chips + a filter
 * input that narrows `options` locally. For an async source (e.g. Clerk org
 * search) the parent passes `onSearchChange` and keeps `options` in sync; local
 * filtering still applies on top so already-fetched options stay responsive.
 * Selecting none is valid — the field can be empty.
 */
export function MultiSelect({
  label,
  options,
  selectedIds,
  onToggle,
  onSearchChange,
  placeholder = "Search…",
  emptyHint,
  loading = false,
  disabled = false,
}: {
  label: string;
  options: MultiSelectOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onSearchChange?: (q: string) => void;
  placeholder?: string;
  emptyHint?: string;
  loading?: boolean;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const byId = useMemo(() => {
    const m = new Map<string, MultiSelectOption>();
    for (const o of options) m.set(o.id, o);
    return m;
  }, [options]);

  const selected = selectedIds.map((id) => byId.get(id) ?? { id, label: id });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? options.filter(
          (o) =>
            o.label.toLowerCase().includes(q) ||
            (o.sublabel ?? "").toLowerCase().includes(q),
        )
      : options;
    return list.slice(0, 50);
  }, [options, query]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {label}
        </label>
        {selectedIds.length > 0 && (
          <span className="text-xs text-gray-400">{selectedIds.length} selected</span>
        )}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((o) => (
            <span
              key={o.id}
              className="inline-flex items-center gap-1 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-xs px-2 py-0.5"
            >
              <span className="truncate max-w-[160px]">{o.label}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onToggle(o.id)}
                  className="text-brand-400 hover:text-brand-700"
                  aria-label={`Remove ${o.label}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {!disabled && (
        <div className="relative">
          <input
            type="text"
            value={query}
            placeholder={placeholder}
            onChange={(e) => {
              setQuery(e.target.value);
              onSearchChange?.(e.target.value);
            }}
            onFocus={() => {
              if (blurTimer.current) clearTimeout(blurTimer.current);
              setOpen(true);
            }}
            onBlur={() => {
              blurTimer.current = setTimeout(() => setOpen(false), 150);
            }}
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
          {open && (
            <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
              {loading ? (
                <div className="px-3 py-2 text-sm text-gray-400">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-400">
                  {emptyHint ?? "No matches"}
                </div>
              ) : (
                filtered.map((o) => {
                  const isSel = selectedIds.includes(o.id);
                  return (
                    <button
                      type="button"
                      key={o.id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onToggle(o.id);
                      }}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${
                        isSel ? "bg-brand-50" : ""
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-gray-800">{o.label}</span>
                        {o.sublabel && (
                          <span className="block truncate text-xs text-gray-400">
                            {o.sublabel}
                          </span>
                        )}
                      </span>
                      {isSel && <span className="text-brand-500">✓</span>}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
