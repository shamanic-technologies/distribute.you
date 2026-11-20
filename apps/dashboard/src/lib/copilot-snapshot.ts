/**
 * The Copilot's last conversation, kept in this browser so a reload paints it at once
 * (MON-PAGE-SPEED-ROOT-1120).
 *
 * WHY: the Copilot panel sits beside EVERY brand page and is open by default. On each load it
 * asked chat-service for the last conversation and showed two shimmer lines until the answer
 * came back (0.5 s on a quiet box, 3 to 16 s at load). The page itself had already painted from
 * the saved query cache, so that panel skeleton alone held every v2 page "not ready": measured
 * 2026-11-20 on the box, Offers main content ready at 2.4 s, the panel at 2.9 s; Today main
 * 7.1 s, panel 9.8 s. Painting the saved copy first and re-reading behind it (stale while
 * revalidate, the same policy as the rest of the dashboard) removes that wait on every page.
 *
 * The copy is keyed by the same key as the stored session id (org x signed-in USER x brand),
 * so a teammate on the same browser never sees it. localStorage, not IndexedDB: it is read
 * synchronously on mount, before the first network answer. Bounded: a conversation page bigger
 * than the cap is not kept (the panel then loads it from the network as before).
 *
 * Alias-free (no `@/` import) so it carries real unit tests.
 */

/** Largest saved copy, in characters of JSON (one newest page of 30 messages is far below it). */
export const COPILOT_SNAPSHOT_MAX_CHARS = 400_000;

type ReadStorage = Pick<Storage, "getItem">;
type WriteStorage = Pick<Storage, "setItem" | "removeItem">;

/** The saved copy's key: the session-id key (org x user x brand) plus a suffix. */
export function copilotSnapshotKey(sessionStorageKey: string): string {
  return `${sessionStorageKey}:last-conversation`;
}

/** The saved copy as stored (unparsed JSON value), or null when absent or unreadable. */
export function readCopilotSnapshot(storage: ReadStorage | null, sessionStorageKey: string | null): unknown {
  if (!storage || !sessionStorageKey) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(copilotSnapshotKey(sessionStorageKey));
  } catch {
    // Private mode / storage disabled: nothing saved, the panel loads from the network.
    return null;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch (err) {
    console.error("[copilot] saved conversation is not JSON, ignored", err);
    return null;
  }
}

/** Saves the conversation the panel just showed. Returns false when it was not kept (too big, storage refused). */
export function writeCopilotSnapshot(storage: WriteStorage | null, sessionStorageKey: string | null, history: unknown): boolean {
  if (!storage || !sessionStorageKey) return false;
  const key = copilotSnapshotKey(sessionStorageKey);
  try {
    const json = JSON.stringify(history);
    if (json.length > COPILOT_SNAPSHOT_MAX_CHARS) {
      storage.removeItem(key);
      return false;
    }
    storage.setItem(key, json);
    return true;
  } catch {
    // Quota or private mode: the conversation still runs, the next reload loads it from the network.
    return false;
  }
}

/**
 * What a user with NO conversation yet saves: the panel then opens empty at once instead of a
 * skeleton waiting for chat-service to answer "none" (the case of every new user and of the
 * page-speed robot). The opener still waits for chat-service's own answer before it is sent.
 */
export const NO_CONVERSATION = { none: true } as const;

/** True when the saved value says "this user had no conversation for this brand". */
export function isNoConversation(saved: unknown): boolean {
  return typeof saved === "object" && saved !== null && (saved as { none?: unknown }).none === true;
}

/** Drops the saved copy (new chat, conversation gone). */
export function clearCopilotSnapshot(storage: WriteStorage | null, sessionStorageKey: string | null): void {
  if (!storage || !sessionStorageKey) return;
  try {
    storage.removeItem(copilotSnapshotKey(sessionStorageKey));
  } catch {
    // Storage disabled: nothing was saved either.
  }
}

/**
 * The signed-in user's id read from Clerk's own session cookie (`__session`, readable by the
 * page by Clerk's design; its JWT `sub` is the user id), or null.
 *
 * WHY: `useAuth().userId` is null until clerk-js has booted (1.8 s in a normal browser, 2.5 to
 * 8 s on a loaded one), and the saved conversation is keyed by that user. The cookie names the
 * same user from the first frame, so the panel paints the copy that user saved at hydration.
 * Not a security check: it only picks WHICH copy this browser saved to show; every read still
 * goes out with the real session, and Clerk's own id replaces this one as soon as it is known.
 */
export function userIdFromSessionCookie(cookie: string | null | undefined): string | null {
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (name !== "__session" && !name.startsWith("__session_")) continue;
    const payload = part.slice(eq + 1).trim().split(".")[1];
    if (!payload) continue;
    try {
      const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "="));
      const sub = (JSON.parse(json) as { sub?: unknown }).sub;
      if (typeof sub === "string" && sub.startsWith("user_")) return sub;
    } catch {
      // Not a JWT (a cleared or foreign cookie of that name): try the next one.
    }
  }
  return null;
}
