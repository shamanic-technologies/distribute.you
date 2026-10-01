/**
 * A tab opened before a deploy calls a Server Action id the new server does not know
 * (Next's `UnrecognizedActionError`). Our only Server Action is Clerk's
 * `invalidateCacheAction`, called on every org/session switch.
 *
 * The ids are stable across builds because the box builds with a fixed
 * `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (env/dashboard-app.build.env); Next salts every
 * action id with that key and draws a random one per build without it. Two cases still
 * reach this file: the first deploy after the key changes, and a Clerk upgrade (the id
 * also hashes the module path). The tab is then running old code, so it reloads once to
 * pick up the current build. The exception is still reported, so a loop would show.
 */
const RELOADED_AT_KEY = "stale-server-action-reloaded-at";
const RELOAD_COOLDOWN_MS = 60_000;

export function isStaleServerActionError(reason: unknown): boolean {
  if (!reason || typeof reason !== "object") return false;
  const { name, message } = reason as { name?: unknown; message?: unknown };
  if (name === "UnrecognizedActionError") return true;
  return typeof message === "string" && /^Server Action "[0-9a-f]+" was not found on the server/.test(message);
}

type ReloadEnv = {
  addEventListener: (type: "unhandledrejection", fn: (e: { reason?: unknown }) => void) => void;
  sessionStorage: Pick<Storage, "getItem" | "setItem">;
  location: { reload: () => void };
  now: () => number;
};

/** Reload at most once per minute per tab, so a server that truly lacks the action cannot loop. */
export function installStaleServerActionReload(env: ReloadEnv): void {
  env.addEventListener("unhandledrejection", (e) => {
    if (!isStaleServerActionError(e.reason)) return;
    const last = Number(env.sessionStorage.getItem(RELOADED_AT_KEY) ?? 0);
    if (env.now() - last < RELOAD_COOLDOWN_MS) {
      console.error("[stale-server-action] still unrecognized after a reload, not reloading again", e.reason);
      return;
    }
    env.sessionStorage.setItem(RELOADED_AT_KEY, String(env.now()));
    env.location.reload();
  });
}
