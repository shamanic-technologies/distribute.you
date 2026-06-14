"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Client-side pagination for the conversion / leads tables. Pure presentation —
 * no authed api-client import, so this stays safe to use inside the
 * public-report bundle (`components/report/*`) alongside the Clerk-free tables.
 *
 * Default 20 rows/page. The page index auto-resets to 0 whenever the row count
 * changes (tab switch, search filter) so the viewer never lands on an
 * out-of-range page after the underlying list shrinks.
 */
export const TABLE_PAGE_SIZE = 20;

export function usePaginated<T>(items: T[], pageSize: number = TABLE_PAGE_SIZE) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  // Clamp the page when the list shrinks below the current offset (e.g. the
  // viewer was on page 5, then filtered down to 1 page worth of rows).
  useEffect(() => {
    if (page > pageCount - 1) setPage(0);
  }, [page, pageCount]);

  const pageItems = useMemo(
    () => items.slice(page * pageSize, page * pageSize + pageSize),
    [items, page, pageSize],
  );

  const from = items.length === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(items.length, page * pageSize + pageSize);

  return { page, setPage, pageCount, pageItems, total: items.length, from, to };
}

export function TablePager({
  page,
  pageCount,
  from,
  to,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  from: number;
  to: number;
  total: number;
  onPage: (page: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100">
      <span className="text-xs text-gray-400">
        Showing {from.toLocaleString("en-US")}–{to.toLocaleString("en-US")} of{" "}
        {total.toLocaleString("en-US")}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPage(Math.max(0, page - 1))}
          disabled={page === 0}
          className="px-2.5 py-1 text-xs font-medium rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Prev
        </button>
        <span className="text-xs text-gray-500 tabular-nums">
          Page {page + 1} / {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPage(Math.min(pageCount - 1, page + 1))}
          disabled={page >= pageCount - 1}
          className="px-2.5 py-1 text-xs font-medium rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
