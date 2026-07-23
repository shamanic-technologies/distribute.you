"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  // Detail panel: the answer (pitch draft) is already loaded so it shows
  // instantly; the question + journalist/category/deadline are fetched ON
  // DEMAND by `quoteRequestId` when the row is clicked (keeps page load fast).
  answer: string | null;
  quoteRequestId: string | null;
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
  detailBase,
}: {
  rows: PitchRow[];
  dateLabel: string;
  /** `/api/report/{orgId}/{brandId}/{featureSlug}/quote-request` — the panel
   *  appends `/{quoteRequestId}` to fetch the question on demand. */
  detailBase: string;
}) {
  // Default: DR desc (a present DR outranks an absent one), then most-recent.
  const [sortKey, setSortKey] = useState<SortKey>("dr");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = rows.find((r) => r.id === selectedId) ?? null;

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
            <tr
              key={row.id}
              onClick={() => setSelectedId(row.id)}
              aria-selected={row.id === selectedId}
              className={`border-t border-gray-100 align-top cursor-pointer transition-colors ${
                row.id === selectedId ? "bg-brand-50" : "hover:bg-gray-50"
              }`}
            >
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                  <ProviderLogo domain={row.logoDomain} size={28} />
                  <span className="text-gray-800 font-medium">
                    {row.publicationName}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3.5 max-w-sm">
                {row.articleTitle ? (
                  <span className="text-sm text-gray-700">{row.articleTitle}</span>
                ) : row.articleUrl ? (
                  <span className="text-sm text-gray-500">View article</span>
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

      <PitchDetailPanel
        row={selected}
        dateLabel={dateLabel}
        detailBase={detailBase}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

interface QuestionDetail {
  question: string | null;
  journalistName: string | null;
  category: string | null;
  deadline: string | null;
}

// Slide-over detail panel: the journalist's QUESTION (the quote request) + the
// ANSWER we submitted (the pitch draft). The answer is already loaded so it
// shows instantly; the question is fetched ON DEMAND when the panel opens (so
// the heavy question body never slows the page load). Read-only. All text is
// rendered as escaped plain text with `whitespace-pre-wrap` — never
// dangerouslySetInnerHTML — so a body can't inject markup (XSS-safe).
function PitchDetailPanel({
  row,
  dateLabel,
  detailBase,
  onClose,
}: {
  row: PitchRow | null;
  dateLabel: string;
  detailBase: string;
  onClose: () => void;
}) {
  const open = row !== null;
  const [detail, setDetail] = useState<QuestionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);
  // Cache resolved details per quote-request so re-opening a row is instant.
  const cacheRef = useRef<Map<string, QuestionDetail>>(new Map());

  const requestId = row?.quoteRequestId ?? null;
  useEffect(() => {
    setErrored(false);
    if (!requestId) {
      setDetail(null);
      setLoading(false);
      return;
    }
    const cached = cacheRef.current.get(requestId);
    if (cached) {
      setDetail(cached);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setDetail(null);
    fetch(`${detailBase}/${requestId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: QuestionDetail) => {
        if (cancelled) return;
        cacheRef.current.set(requestId, d);
        setDetail(d);
      })
      .catch(() => !cancelled && setErrored(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [requestId, detailBase]);

  return (
    <>
      {/* Scrim */}
      <div
        onClick={onClose}
        aria-hidden={!open}
        className={`fixed inset-0 z-40 bg-gray-900/30 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Quote detail"
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl border-l border-gray-200 flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {row && (
          <>
            <header className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3 min-w-0">
                <ProviderLogo domain={row.logoDomain} size={32} />
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {row.publicationName}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {dateLabel} {timeAgo(row.timestampIso)}
                    {row.drValue != null && (
                      <span className="ml-2 text-gray-400">· DR {row.drValue}</span>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex-shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
              {/* Meta chips (journalist / category / deadline load with the question) */}
              <div className="flex flex-wrap gap-2">
                {detail?.journalistName && (
                  <MetaChip label="Journalist" value={detail.journalistName} />
                )}
                {detail?.category && <MetaChip label="Category" value={detail.category} />}
                {detail?.deadline && (
                  <MetaChip label="Deadline" value={formatDate(detail.deadline)} />
                )}
                <AttributionBadge label={row.attributionLabel} />
              </div>

              {/* Question — fetched on demand */}
              <section>
                <SectionLabel>Question asked</SectionLabel>
                {loading ? (
                  <div className="mt-2 space-y-2">
                    <div className="h-3.5 w-3/4 rounded bg-gray-100 animate-pulse" />
                    <div className="h-3.5 w-full rounded bg-gray-100 animate-pulse" />
                    <div className="h-3.5 w-2/3 rounded bg-gray-100 animate-pulse" />
                  </div>
                ) : errored ? (
                  <p className="mt-2 text-sm text-gray-400">
                    Couldn&apos;t load the question — reopen to retry.
                  </p>
                ) : detail?.question ? (
                  <blockquote className="mt-2 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                    {detail.question}
                  </blockquote>
                ) : (
                  <p className="mt-2 text-sm text-gray-400">Not available</p>
                )}
              </section>

              {/* Answer — already loaded, instant */}
              <section>
                <SectionLabel>Answer submitted</SectionLabel>
                {row.answer ? (
                  <div className="mt-2 rounded-xl bg-white border border-gray-200 px-4 py-3 text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                    {row.answer}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-gray-400">Not available</p>
                )}
              </section>

              {row.articleUrl && (
                <a
                  href={row.articleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:underline"
                >
                  Read the published article →
                </a>
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
      {children}
    </h3>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
      <span className="text-gray-400">{label}:</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
