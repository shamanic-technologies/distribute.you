"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { TopBar } from "@/components/v2/ui";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * The dashboard's route error boundary. It sits inside the v2 layout, so the sidebar
 * and the providers stay mounted and only the page body is replaced.
 */
export default function V2Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("[dashboard] page error:", error);
    // A boundary swallows the error, so it never reaches the global handler that
    // exception autocapture listens on. Report it explicitly.
    posthog.captureException(error, { boundary: "dashboard", digest: error.digest });
  }, [error]);

  return (
    <>
      <TopBar crumbs={[{ label: "Error" }]} />
      <div className="mx-auto w-full max-w-[1100px] px-4 py-8 md:px-6">
        <div className="k-card p-5">
          <div className="k-label">Error</div>
          <h1 className="k-fg mt-2 text-[16px] font-medium">This page hit an unexpected error</h1>
          <p className="k-mono k-fg2 mt-2 break-words text-[12px]">{error.message || "Unknown render error."}</p>
          {error.digest && <p className="k-mono k-fg3 mt-1 text-[12px]">digest: {error.digest}</p>}
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={reset} className="k-btn-strong">
              Retry
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) window.history.back();
                else window.location.href = "/v2";
              }}
              className="k-btn"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
