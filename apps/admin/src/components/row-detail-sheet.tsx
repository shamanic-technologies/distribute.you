"use client";

import { useEffect, useRef } from "react";

interface RowDetailSheetProps {
  row: Record<string, unknown> | null;
  onClose: () => void;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function isUuid(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function RowDetailSheet({ row, onClose }: RowDetailSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!row) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
        data-testid="sheet-overlay"
      />
      <div
        ref={sheetRef}
        className="fixed right-0 top-0 h-full w-[480px] max-w-full bg-white border-l border-gray-200 shadow-xl z-50 overflow-y-auto animate-slide-in"
        data-testid="row-detail-sheet"
        role="dialog"
        aria-label="Row details"
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Row Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <dl className="px-6 py-4 space-y-4">
          {Object.entries(row).map(([key, value]) => (
            <div key={key}>
              <dt className="text-xs font-medium text-gray-400 uppercase tracking-wider">{key}</dt>
              <dd className="mt-1 text-sm text-gray-900 break-all">
                {isUuid(value) ? (
                  <span className="font-mono text-blue-600">{formatValue(value)}</span>
                ) : typeof value === "object" && value !== null ? (
                  <pre className="bg-gray-50 rounded p-2 text-xs overflow-x-auto whitespace-pre-wrap">
                    {formatValue(value)}
                  </pre>
                ) : (
                  formatValue(value)
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  );
}
