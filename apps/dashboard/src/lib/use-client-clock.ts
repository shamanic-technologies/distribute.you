import { useEffect, useState } from "react";

/**
 * The browser's clock, or `null` until the component has mounted.
 *
 * Anything printed from "now" (a greeting, today's date, the time) must not render on
 * the server: the box's clock is UTC and a step ahead of hydration, so the server HTML
 * and the first client render disagree and React throws #418 (hydration text
 * mismatch). Seen 2026-10-01 on v2 Today for users in Asia/Almaty and Asia/Calcutta.
 * Render a placeholder while this is `null`.
 */
export function useClientClock(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);
  return now;
}
