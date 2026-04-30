"use client";

import { useState, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { RowDetailSheet } from "./row-detail-sheet";

interface DataTableProps {
  columns: ColumnDef<Record<string, unknown>>[];
  data: Record<string, unknown>[];
  total: number;
  limit: number;
  offset: number;
  sort: string;
  order: "asc" | "desc";
  search: string;
  serviceName: string;
  tableName: string;
}

function truncateCell(value: unknown): string {
  if (value === null || value === undefined) return "null";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  return str.length > 100 ? str.slice(0, 100) + "..." : str;
}

export function DataTable({
  columns,
  data,
  total,
  limit,
  offset,
  sort,
  order,
  search,
  serviceName,
  tableName,
}: DataTableProps) {
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(null);
  const [sorting, setSorting] = useState<SortingState>(
    sort ? [{ id: sort, desc: order === "desc" }] : []
  );
  const [searchValue, setSearchValue] = useState(search);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    state: { sorting },
    onSortingChange: setSorting,
    rowCount: total,
  });

  const navigate = useCallback(
    (params: { offset?: number; sort?: string; order?: string; search?: string }) => {
      const sp = new URLSearchParams();
      sp.set("limit", String(limit));
      sp.set("offset", String(params.offset ?? offset));
      sp.set("sort", params.sort ?? sort);
      sp.set("order", params.order ?? order);
      if (params.search !== undefined ? params.search : search) {
        sp.set("search", params.search !== undefined ? params.search : search);
      }
      window.location.href = `/${serviceName}/${tableName}?${sp.toString()}`;
    },
    [limit, offset, sort, order, search, serviceName, tableName]
  );

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <input
          type="text"
          placeholder="Search rows..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              navigate({ offset: 0, search: searchValue });
            }
          }}
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          data-testid="search-input"
        />
        <button
          onClick={() => navigate({ offset: 0, search: searchValue })}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
        >
          Search
        </button>
        {search && (
          <button
            onClick={() => {
              setSearchValue("");
              navigate({ offset: 0, search: "" });
            }}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        )}
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="bg-gray-50 border-b border-gray-200">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:bg-gray-100 transition-colors"
                      onClick={() => {
                        const isCurrentSort = sort === header.id;
                        const newOrder = isCurrentSort && order === "asc" ? "desc" : "asc";
                        navigate({ sort: header.id, order: newOrder, offset: 0 });
                      }}
                    >
                      <span className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sort === header.id && (
                          <span className="text-blue-600">{order === "asc" ? " ↑" : " ↓"}</span>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                    No rows found
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-100 hover:bg-blue-50/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedRow(row.original)}
                    data-testid="table-row"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-2.5 text-gray-700 max-w-xs truncate">
                        {truncateCell(cell.getValue())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
        <span>
          Showing {offset + 1}–{Math.min(offset + limit, total)} of {total} rows
        </span>
        <div className="flex items-center gap-2">
          <button
            disabled={offset === 0}
            onClick={() => navigate({ offset: Math.max(0, offset - limit) })}
            className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Previous
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            disabled={offset + limit >= total}
            onClick={() => navigate({ offset: offset + limit })}
            className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Next
          </button>
        </div>
      </div>

      <RowDetailSheet row={selectedRow} onClose={() => setSelectedRow(null)} />
    </div>
  );
}
