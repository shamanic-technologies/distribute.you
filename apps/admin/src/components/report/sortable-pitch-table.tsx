"use client";

import { useMemo, useState } from "react";
import { ProviderLogo } from "@/components/provider-logo";
import { timeAgo } from "@/lib/report-pitch-tabs";

// One row of the read-only press tracker. Built server-side from the pitch +
// its originating quote request; every value is real backend data (never
// fabricated). A genuinely-absent field is null and renders "—" / "Unknown".
export interface PitchRow {
  id: string;
  publicationName: string;
  logoDomain: string | null;
  articleUrl: string | null;
  articleTitle: string | null;
  drLabel: string;
  drValue: number | null;
  attributionLabel: string;
  timestampIso: string | null;
}

type SortKey = "publication" | "article" | "dr" | "attribution" | "date";
type SortDir = "asc" | "desc";

function compare(a: PitchRow, b: PitchRow, key: SortKey): number {
  switch (key) {
    case "publication":
      return a.publicationName.localeCompare(b.publicationName);
    case "article":
      return (a.articleTitle ?? "").localeCompare(b.articleTitle ?? "");
    case "dr":
      // Absent DR sorts last regardless of direction handling below.
      return (a.drValue ?? -1) - (b.drValue ?? -1);
    case "attribution":
      return a.attributionLabel.localeCompare(b.attributionLabel);
    case "date": {
      const tA = a.timestampIso ? new Date(a.timestampIso).getTime() : 0;
      const tB = b.timestampIso ? new Date(b.timestampIso).getTime() : 0;
      return tA - tB;
    }
  }
}

export function SortablePitchTable({
  rows,
  dateLabel,
}: {
  rows: PitchRow[];
  dateLabel: string;
}) {
  // Default: DR desc (a present DR outranks an absent one), then most-recent.
  const [sortKey, setSortKey] = useState<SortKey>("dr");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const columns: { key: SortKey; label: string }[] = [
    { key: "publication", label: "Publication" },
    { key: "article", label: "Article" },
    { key: "dr", label: "DR" },
    { key: "attribution", label: "Attribution" },
    { key: "date", label: dateLabel },
  ];

  function onSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Text columns read best ascending; numeric/date default to descending.
      setSortDir(key === "publication" || key === "article" ? "asc" : "desc");
    }
  }

  const sorted = useMemo(() => {
    const out = [...rows].sort((a, b) => compare(a, b, sortKey));
    if (sortDir === "desc") out.reverse();
    // Tiebreak every sort with most-recent first for a stable, useful order.
    return out.sort((a, b) => {
      const primary =
        sortDir === "desc" ? compare(b, a, sortKey) : compare(a, b, sortKey);
      if (primary !== 0) return primary;
      const tA = a.timestampIso ? new Date(a.timestampIso).getTime() : 0;
      const tB = b.timestampIso ? new Date(b.timestampIso).getTime() : 0;
      return tB - tA;
    });
  }, [rows, sortKey, sortDir]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-base border-collapse min-w-[720px]">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => {
              const active = col.key === sortKey;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={
                    active
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500"
                >
                  <button
                    type="button"
                    onClick={() => onSort(col.key)}
                    className={`inline-flex items-center gap-1 hover:text-gray-800 transition-colors ${
                      active ? "text-gray-800" : ""
                    }`}
                  >
                    {col.label}
                    <span className="text-[10px] leading-none">
                      {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.id} className="border-t border-gray-100 align-top">
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                  <ProviderLogo domain={row.logoDomain} size={28} />
                  <span className="text-gray-800 font-medium">
                    {row.publicationName}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3.5 max-w-sm">
                {row.articleUrl ? (
                  <a
                    href={row.articleUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-600 hover:underline text-sm break-words"
                  >
                    {row.articleTitle ?? "View article"} →
                  </a>
                ) : row.articleTitle ? (
                  <span className="text-sm text-gray-700">{row.articleTitle}</span>
                ) : (
                  <span className="text-sm text-gray-400">—</span>
                )}
              </td>
              <td className="px-4 py-3.5 whitespace-nowrap text-gray-700">
                {row.drLabel}
              </td>
              <td className="px-4 py-3.5 whitespace-nowrap">
                <AttributionBadge label={row.attributionLabel} />
              </td>
              <td className="px-4 py-3.5 whitespace-nowrap text-gray-500">
                {timeAgo(row.timestampIso)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AttributionBadge({ label }: { label: string }) {
  const style =
    label === "Do follow"
      ? "bg-green-100 text-green-700 border-green-200"
      : label === "No follow"
        ? "bg-gray-100 text-gray-600 border-gray-200"
        : "bg-gray-50 text-gray-400 border-gray-200";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${style}`}>
      {label}
    </span>
  );
}
