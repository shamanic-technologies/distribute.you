import { useEffect, useState } from "react";

/**
 * A value that settles before anything acts on it.
 *
 * Written for the Leads search box, which now asks lead-service rather than filtering an
 * array in memory: every keystroke would otherwise be a request evaluated over a brand's
 * whole population. The box itself stays instant — it is `value` that is debounced, not
 * the input — so typing never lags behind the keyboard.
 *
 * Returns the LATEST value once it has held still for `delayMs`. The first value is
 * returned immediately rather than after a delay, so a page that arrives with a value
 * already set does not wait to read it.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (Object.is(settled, value)) return;
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs, settled]);
  return settled;
}
