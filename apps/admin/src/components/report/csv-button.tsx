"use client";

import { useCallback, useState } from "react";

interface CsvButtonProps {
  filename: string;
  csv: string;
  isEmpty?: boolean;
  // True while the row enrichment the CSV depends on (DR / Monthly Visits) is
  // still loading. The button is disabled + relabeled so the user can't export
  // a CSV with blank DR/Visits columns before those queries resolve (the bug
  // that surfaced on a 12k-outlet brand: enrichment fans out over many chunked
  // requests and takes seconds, while the button was clickable immediately).
  preparing?: boolean;
}

export function CsvDownloadButton({ filename, csv, isEmpty, preparing }: CsvButtonProps) {
  const [loading, setLoading] = useState(false);

  const onClick = useCallback(() => {
    // The blob + download is synchronous, so the spinner is purely a UX
    // ack ("the click registered, your CSV is on its way"). 800ms is long
    // enough to be perceived on fast browsers, short enough that nobody
    // thinks the page hung.
    setLoading(true);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setTimeout(() => setLoading(false), 800);
  }, [filename, csv]);

  return (
    <button
      onClick={onClick}
      disabled={isEmpty || loading || preparing}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading || preparing ? (
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth={4} />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      )}
      {preparing ? "Loading DR & visits…" : loading ? "Preparing…" : "Download CSV"}
    </button>
  );
}
