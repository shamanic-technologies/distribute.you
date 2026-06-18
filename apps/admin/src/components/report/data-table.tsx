import type { ReactNode } from "react";

export interface TableColumn<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  rows: T[];
  columns: TableColumn<T>[];
  emptyMessage?: string;
  rowKey: (row: T, index: number) => string;
}

export function DataTable<T>({ rows, columns, emptyMessage = "No rows", rowKey }: DataTableProps<T>) {
  if (rows.length === 0) {
    return <div className="px-5 py-10 text-center text-sm text-gray-500">{emptyMessage}</div>;
  }
  return (
    <table className="w-full text-sm border-collapse">
      <thead className="bg-gray-50">
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              className={`px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide ${col.className ?? ""}`}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={rowKey(row, i)} className="border-t border-gray-100 hover:bg-gray-50 transition">
            {columns.map((col) => (
              <td key={col.key} className={`px-4 py-2.5 text-gray-700 align-top ${col.className ?? ""}`}>
                {col.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
