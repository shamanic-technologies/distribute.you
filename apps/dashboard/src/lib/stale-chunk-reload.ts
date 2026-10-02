/**
 * A page that asks for a code chunk the server no longer has reloads once, instead of
 * staying dead.
 *
 * BYTE-EQUAL TWINS: `apps/landing/src/lib/stale-chunk-reload.ts` and
 * `apps/dashboard/src/lib/stale-chunk-reload.ts` (pinned by the dashboard's
 * `tests/stale-chunk-reload.test.ts`). Edit both. Alias-free, so both carry real tests.
 *
 * The box redeploys the landing and the dashboard within about five minutes of a merge,
 * and every build renames its `/_next/static/chunks/*` files. A tab holding the previous
 * build's HTML then asks for a chunk that is gone: Turbopack throws `ChunkLoadError:
 * Failed to load chunk /_next/static/chunks/<old>.js from module <n>`, React hands it to
 * the nearest error boundary, and the page shows "Something went wrong" for good.
 * Observed 2026-10-01 on `/blog/flash-vs-pro-llm-cold-email` (3 events) and 2026-09-30 on
 * the dashboard, both caught by `global-error.tsx`.
 *
 * A reload fetches the current HTML, which names the current chunks. At most once a
 * minute per tab (sessionStorage), so a chunk that is missing for another reason cannot
 * loop; past that the error page stays and the error is still reported. The caller
 * reports the error to PostHog BEFORE calling this: PostHog flushes its queue on
 * `pagehide`, so the reload does not lose it.
 *
 * The match is narrow on purpose: only messages a failed chunk or dynamic import can
 * produce. Any other error keeps the normal error page.
 */
const RELOADED_AT_KEY = "stale-chunk-reloaded-at";
const RELOAD_COOLDOWN_MS = 60_000;

const CHUNK_FAILURE_MESSAGES = [
  /^Failed to load chunk /, // Turbopack (Next 16): "Failed to load chunk /_next/static/chunks/x.js from module 1"
  /^Loading chunk \S+ failed/, // webpack
  /^Loading CSS chunk \S+ failed/, // webpack CSS
  /^Failed to fetch dynamically imported module/, // Chrome, import()
  /^error loading dynamically imported module/, // Firefox, import()
  /^Importing a module script failed/, // Safari, import()
];

export function isChunkLoadError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const { name, message } = err as { name?: unknown; message?: unknown };
  if (name === "ChunkLoadError") return true;
  return typeof message === "string" && CHUNK_FAILURE_MESSAGES.some((re) => re.test(message));
}

export type ChunkReloadEnv = {
  /** A getter, because reading `window.sessionStorage` itself throws where storage is blocked. */
  sessionStorage: () => Pick<Storage, "getItem" | "setItem">;
  location: { reload: () => void };
  now: () => number;
};

/** Reloads the tab unless it already did so in the last minute. Returns whether it reloaded. */
export function reloadOnceForStaleChunk(env: ChunkReloadEnv, err: unknown): boolean {
  try {
    const storage = env.sessionStorage();
    const last = Number(storage.getItem(RELOADED_AT_KEY) ?? 0);
    if (env.now() - last < RELOAD_COOLDOWN_MS) {
      console.error("[stale-chunk] chunk still missing after a reload, not reloading again", err);
      return false;
    }
    storage.setItem(RELOADED_AT_KEY, String(env.now()));
  } catch (storageErr) {
    // No sessionStorage (sandboxed frame, storage blocked): no way to bound a loop, so no reload.
    console.error("[stale-chunk] sessionStorage unavailable, not reloading", storageErr, err);
    return false;
  }
  env.location.reload();
  return true;
}

type ListenerEnv = ChunkReloadEnv & {
  addEventListener: (
    type: "unhandledrejection" | "error",
    fn: (e: { reason?: unknown; error?: unknown }) => void,
  ) => void;
};

/** The real browser, for the error boundaries and the client instrumentation. */
export function browserChunkReloadEnv(): ChunkReloadEnv {
  return { sessionStorage: () => window.sessionStorage, location: window.location, now: Date.now };
}

/** A chunk that fails outside React (an `import()` in a click handler) is a rejection or a throw. */
export function installStaleChunkReload(env: ListenerEnv): void {
  const onFailure = (e: { reason?: unknown; error?: unknown }) => {
    const err = "reason" in e ? e.reason : e.error;
    if (isChunkLoadError(err)) reloadOnceForStaleChunk(env, err);
  };
  env.addEventListener("unhandledrejection", onFailure);
  env.addEventListener("error", onFailure);
}
