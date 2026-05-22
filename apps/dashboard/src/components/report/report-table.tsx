"use client";

import { useMemo, useState, type ReactNode } from "react";
import { DataDrawer, type DrawerEntry } from "./data-drawer";

export interface ReportTableColumn<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  /** Used for sorting + searching. Defaults to the row's stringified key value. */
  sortValue?: (row: T) => string;
  className?: string;
}

export interface FilterSpec<T> {
  label: string;
  value: (row: T) => string;
  options?: string[];
}

interface ReportTableProps<T> {
  rows: T[];
  columns: ReportTableColumn<T>[];
  rowKey: (row: T) => string;
  pageSize?: number;
  searchPlaceholder?: string;
  searchValue: (row: T) => string;
  filter?: FilterSpec<T>;
  drawerTitle?: (row: T) => string;
  drawerSubtitle?: (row: T) => string;
  drawerEntries?: (row: T) => DrawerEntry[];
  emptyMessage?: string;
}

type SortDir = "asc" | "desc";

export function ReportTable<T>({
  rows,
  columns,
  rowKey,
  pageSize = 25,
  searchPlaceholder = "Search…",
  searchValue,
  filter,
  drawerTitle,
  drawerSubtitle,
  drawerEntries,
  emptyMessage = "No rows",
}: ReportTableProps<T>) {
  const [query, setQuery] = useState("");
  const [filterValue, setFilterValue] = useState<string>("all");
  const [sortKey, setSortKey] = useState<string>(columns[0]?.key ?? "");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<T | null>(null);

  const filterOptions = useMemo<string[]>(() => {
    if (!filter) return [];
    if (filter.options) return filter.options;
    const set = new Set<string>();
    for (const r of rows) {
      const v = filter.value(r);
      if (v) set.add(v);
    }
    return Array.from(set).sort();
  }, [rows, filter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter && filterValue !== "all" && filter.value(r) !== filterValue) return false;
      if (!q) return true;
      return searchValue(r).toLowerCase().includes(q);
    });
  }, [rows, query, filterValue, filter, searchValue]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return filtered;
    const get = col.sortValue ?? ((r: T) => String(col.render(r) ?? ""));
    const dir = sortDir === "asc" ? 1 : -1;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = get(a).toLowerCase();
      const bv = get(b).toLowerCase();
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return copy;
  }, [filtered, columns, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageClamped = Math.min(page, totalPages);
  const pageRows = sorted.slice((pageClamped - 1) * pageSize, pageClamped * pageSize);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  const clickable = !!drawerEntries;

  return (
    <div>
      <div className="px-5 py-3 border-b border-gray-200 flex flex-wrap gap-3 items-center bg-gray-50/40">
        <input
          type="search"
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          className="flex-1 min-w-[200px] text-sm px-3 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
        />
        {filter && (
          <select
            value={filterValue}
            onChange={(e) => { setFilterValue(e.target.value); setPage(1); }}
            className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
            aria-label={filter.label}
          >
            <option value="all">All {filter.label.toLowerCase()}</option>
            {filterOptions.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        )}
        <span className="text-xs text-gray-500">{sorted.length.toLocaleString("en-US")} matching</span>
      </div>

      {pageRows.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-gray-500">{emptyMessage}</div>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => {
                const isActive = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className={`px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none hover:text-gray-700 ${col.className ?? ""}`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {isActive && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d={sortDir === "asc" ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                        </svg>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={clickable ? () => setSelected(row) : undefined}
                className={`border-t border-gray-100 hover:bg-gray-50 transition ${clickable ? "cursor-pointer" : ""}`}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-2.5 text-gray-700 align-top ${col.className ?? ""}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {sorted.length > pageSize && (
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600 bg-gray-50/40">
          <span>
            Showing {(pageClamped - 1) * pageSize + 1}–{Math.min(pageClamped * pageSize, sorted.length)} of {sorted.length.toLocaleString("en-US")}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pageClamped === 1}
              className="px-3 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <span>
              Page {pageClamped} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={pageClamped === totalPages}
              className="px-3 py-1 rounded-md border border-gray-200 bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {drawerEntries && (
        <DataDrawer
          open={!!selected}
          onClose={() => setSelected(null)}
          title={selected && drawerTitle ? drawerTitle(selected) : "Detail"}
          subtitle={selected && drawerSubtitle ? drawerSubtitle(selected) : undefined}
          entries={selected ? drawerEntries(selected) : []}
        />
      )}
    </div>
  );
}

// Shared colorful status badge — used across every report table.
const STATUS_STYLES: Record<string, string> = {
  // Lead status (consolidated)
  replied: "bg-green-100 text-green-700 border-green-200",
  clicked: "bg-emerald-100 text-emerald-700 border-emerald-200",
  opened: "bg-blue-100 text-blue-700 border-blue-200",
  delivered: "bg-sky-100 text-sky-700 border-sky-200",
  sent: "bg-indigo-100 text-indigo-700 border-indigo-200",
  bounced: "bg-red-100 text-red-700 border-red-200",
  unsubscribed: "bg-zinc-200 text-zinc-700 border-zinc-300",
  contacted: "bg-purple-100 text-purple-700 border-purple-200",
  served: "bg-cyan-100 text-cyan-700 border-cyan-200",
  skipped: "bg-yellow-100 text-yellow-800 border-yellow-200",
  buffered: "bg-amber-100 text-amber-800 border-amber-200",
  claimed: "bg-orange-100 text-orange-800 border-orange-200",
  // Campaign / workflow status
  ongoing: "bg-blue-100 text-blue-700 border-blue-200",
  paused: "bg-yellow-100 text-yellow-800 border-yellow-200",
  stopped: "bg-yellow-100 text-yellow-800 border-yellow-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  failed: "bg-red-100 text-red-700 border-red-200",
  active: "bg-green-100 text-green-700 border-green-200",
  deprecated: "bg-zinc-200 text-zinc-600 border-zinc-300",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border whitespace-nowrap ${cls}`}>
      {status}
    </span>
  );
}
