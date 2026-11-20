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

/** Drops the saved copy (new chat, conversation gone). */
export function clearCopilotSnapshot(storage: WriteStorage | null, sessionStorageKey: string | null): void {
  if (!storage || !sessionStorageKey) return;
  try {
    storage.removeItem(copilotSnapshotKey(sessionStorageKey));
  } catch {
    // Storage disabled: nothing was saved either.
  }
}
