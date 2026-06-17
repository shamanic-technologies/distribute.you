"use client";

import { useEffect } from "react";
import { DashboardPage } from "@/components/dashboard-page";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[dashboard] page error:", error);
  }, [error]);

  return (
    <DashboardPage width="narrow">
      <div className="bg-white rounded-xl border border-red-200 p-6">
        <h2 className="font-display text-xl font-bold text-red-700 mb-2">
          This page hit an unexpected error
        </h2>
        <p className="text-sm text-gray-700 mb-2 break-words font-mono">
          {error.message || "Unknown render error."}
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 font-mono mb-4">digest: {error.digest}</p>
        )}
        <p className="text-xs text-gray-500 mb-4">
          Open DevTools (Cmd-Opt-J on macOS, Ctrl-Shift-J on Windows/Linux) → Console for the full stack trace.
        </p>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition"
          >
            Retry
          </button>
          <button
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) {
                window.history.back();
              } else if (typeof window !== "undefined") {
                window.location.href = "/";
              }
            }}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
          >
            Back
          </button>
        </div>
      </div>
    </DashboardPage>
  );
}
