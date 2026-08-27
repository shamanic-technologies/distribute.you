/**
 * A bounded await, for a promise nobody else will ever give up on.
 *
 * `fetch` has NO default timeout, and neither does Clerk's `setActive` /
 * `getToken`. On a flaky connection — a phone changing network, DNS failing on
 * `clerk.distribute.you`, a captive portal — those promises simply never settle,
 * so an org switch that awaits three of them in series can hang for the rest of
 * the session with a spinner and no error. That is the "switching orgs takes
 * infinite time" report: nothing was retried, nothing was surfaced, and the only
 * exit was a reload.
 *
 * A timeout is NOT a silent fallback: it converts an unbounded wait into a LOUD
 * failure the caller must handle, which is the opposite of swallowing.
 *
 * Alias-free (no `@/…` import) so it carries real unit tests rather than a
 * source-substring guard — keep it that way.
 */

/** Thrown when the bounded promise did not settle in time. */
export class TimeoutError extends Error {
  readonly timedOut = true;
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

/** True for a failure THIS module produced, so a caller can tell "the network
 *  never answered" apart from "the operation was refused". They call for
 *  different recoveries: a refusal may be worth a second, different attempt; a
 *  timeout means the network is gone and another round-trip only doubles the
 *  wait. */
export function isTimeoutError(err: unknown): boolean {
  return err instanceof TimeoutError || (err instanceof Error && err.name === "TimeoutError");
}

/**
 * Resolve `promise`, or reject with a `TimeoutError` after `ms`.
 *
 * The underlying promise is NOT cancelled (a promise cannot be), so the caller
 * must treat a timeout as "unknown outcome", never as "did not happen".
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const bound = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new TimeoutError(`${label} timed out after ${Math.round(ms / 1000)}s.`)),
      ms,
    );
  });
  try {
    return await Promise.race([promise, bound]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
