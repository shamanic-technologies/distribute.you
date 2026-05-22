"use client";

import { useCallback } from "react";

type CsvValue = string | number | boolean | null | undefined;

export interface CsvColumn<T> {
  label: string;
  value: (row: T) => CsvValue;
}

interface CsvButtonProps<T> {
  filename: string;
  rows: T[];
  columns: CsvColumn<T>[];
  disabled?: boolean;
}

function escapeCsvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCsvCell(c.label)).join(",");
  const body = rows.map((row) => columns.map((c) => escapeCsvCell(c.value(row))).join(",")).join("\n");
  return `${header}\n${body}`;
}

export function CsvDownloadButton<T>({ filename, rows, columns, disabled }: CsvButtonProps<T>) {
  const onClick = useCallback(() => {
    const csv = toCsv(rows, columns);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [filename, rows, columns]);

  const isEmpty = rows.length === 0;

  return (
    <button
      onClick={onClick}
      disabled={disabled || isEmpty}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      Download CSV
    </button>
  );
}

export function GoogleSheetsButton() {
  return (
    <span
      title="Coming soon — backend export pending"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Open in Google Sheets
      <span className="text-[10px] bg-gray-100 text-gray-400 px-1 py-0.5 rounded">Soon</span>
    </span>
  );
}
