"use client";

import { useCallback, useState } from "react";

interface CsvButtonProps {
  filename: string;
  /**
   * The file, either already in hand or fetched on press.
   *
   * A string is the original case: the caller holds the rows, so the CSV is free. A
   * function is for a caller that does NOT hold them — the leads page asks lead-service
   * to stream the whole matching set, precisely so it no longer has to keep a brand's
   * population in memory to be able to export it.
   */
  csv: string | (() => Promise<string>);
  isEmpty?: boolean;
  // Idle-state button label (default "Download CSV"). The leads page overrides
  // it to "Export leads"; the loading label stays "Preparing…".
  label?: string;
}

export function CsvDownloadButton({ filename, csv, isEmpty, label = "Download CSV" }: CsvButtonProps) {
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const onClick = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    let text: string;
    try {
      // With a string in hand the blob is synchronous, so the spinner is purely an ack
      // ("the click registered"); 800ms is long enough to be perceived and short enough
      // that nobody thinks the page hung. With a fetcher it is a real wait, and a
      // failure has to be VISIBLE — a button that spins and then silently does nothing
      // reads as broken, and an export is the one control nobody re-presses on faith.
      text = typeof csv === "string" ? csv : await csv();
    } catch (error) {
      console.error("[dashboard] CsvDownloadButton: export failed", error);
      setFailed(true);
      setLoading(false);
      return;
    }
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
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
      disabled={isEmpty || loading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" strokeWidth={4} />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      )}
      {loading ? "Preparing…" : failed ? "Export failed, try again" : label}
    </button>
  );
}
