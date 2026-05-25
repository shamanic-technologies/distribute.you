"use client";

import { useEffect, useState } from "react";

interface GeneratedAtProps {
  iso: string;
}

// Server renders the timestamp in UTC (deterministic, no SSR/CSR
// hydration mismatch) and the client-side effect re-formats it in the
// viewer's own locale + timezone after mount. `suppressHydrationWarning`
// silences the inevitable text diff between the UTC server render and
// the local-tz client render — this is the documented escape hatch for
// time-of-day formatting.
export function GeneratedAt({ iso }: GeneratedAtProps) {
  const [text, setText] = useState(() =>
    new Date(iso).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }),
  );

  useEffect(() => {
    setText(
      new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    );
  }, [iso]);

  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}
