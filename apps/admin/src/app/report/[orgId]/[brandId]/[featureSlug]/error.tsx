"use client";

import { useEffect } from "react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ReportError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[dashboard-report] page error:", error);
  }, [error]);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <h2 className="font-display text-xl font-bold text-red-700 mb-2">Report section failed to load</h2>
        <p className="text-sm text-gray-600 mb-4">
          One of the data fetches threw an unexpected error. Other sections in the sidebar may still work.
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 font-mono mb-4">digest: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
