/**
 * Recognising a tab that is running code the server no longer has.
 *
 * The box redeploys the dashboard within about five minutes of a merge, and a
 * tab left open across that deploy keeps its old JS bundle while every server
 * artifact it references is gone. Next then fails in ways that read as product
 * bugs: a Server Action rejects with `UnrecognizedActionError`, a route's RSC
 * payload 404s, a lazily-imported chunk cannot be fetched. Nothing on screen
 * says so, and none of it is caught by a React error boundary because the
 * failure arrives as an unhandled promise rejection, not as a render throw.
 *
 * Observed alongside an org-switch report: the console carried
 * `Server Action "00c30a9e..." was not found on the server` twice plus a 404 on
 * the route being opened, and the page simply did nothing.
 *
 * The match is deliberately NARROW. A broad "any error means reload" would tell
 * people to reload on every ordinary failure, which is a lie that costs them
 * whatever they had typed. Only signatures that CANNOT mean anything else are
 * listed here.
 *
 * Alias-free (no `@/…` import) so it carries real unit tests rather than a
 * source-substring guard - keep it that way.
 */

/** Signatures Next emits when the client bundle predates the running server.
 *  Matched against `name` and `message` alike, since which one carries the
 *  signature differs per failure. */
const STALE_BUILD_SIGNATURES = [
  // A Server Action id the server no longer knows. Next names the class.
  "unrecognizedactionerror",
  "was not found on the server",
  // A code-split chunk whose file the deploy replaced.
  "chunkloaderror",
  "loading chunk",
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  // A CSS chunk from the same build.
  "loading css chunk",
];

/** True when this error can only be explained by the bundle being out of date. */
export function isStaleBuildError(err: unknown): boolean {
  if (!err) return false;
  const parts: string[] = [];
  if (typeof err === "string") parts.push(err);
  if (err instanceof Error) {
    parts.push(err.name, err.message);
  } else if (typeof err === "object") {
    const rec = err as Record<string, unknown>;
    if (typeof rec.name === "string") parts.push(rec.name);
    if (typeof rec.message === "string") parts.push(rec.message);
  }
  const haystack = parts.join(" ").toLowerCase();
  if (!haystack.trim()) return false;
  return STALE_BUILD_SIGNATURES.some((sig) => haystack.includes(sig));
}

/** The thing an `unhandledrejection` / `error` event was actually about.
 *  Both shapes are read because the two failures arrive on different events:
 *  a Server Action mismatch rejects a promise, a chunk failure throws. */
export function staleBuildReasonFrom(event: unknown): unknown {
  if (!event || typeof event !== "object") return event;
  const rec = event as Record<string, unknown>;
  if ("reason" in rec) return rec.reason;
  if ("error" in rec && rec.error) return rec.error;
  if (typeof rec.message === "string") return rec.message;
  return event;
}

/** True when this browser event is a stale-bundle failure. */
export function isStaleBuildEvent(event: unknown): boolean {
  return isStaleBuildError(staleBuildReasonFrom(event));
}
