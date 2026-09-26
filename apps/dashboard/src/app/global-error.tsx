"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

// The last boundary: an error thrown in the root layout itself. It replaces the whole
// document, so it renders its own <html>. Reported explicitly, because a boundary
// swallows the error before exception autocapture can see it.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] root error:", error);
    posthog.captureException(error, { boundary: "dashboard-global", digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 32 }}>
        <h2>Something went wrong.</h2>
        <p>We have been told about it. You can try again.</p>
        <button onClick={reset} style={{ marginTop: 12, padding: "8px 16px" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
