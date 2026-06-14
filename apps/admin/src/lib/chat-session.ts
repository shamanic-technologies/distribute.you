/**
 * Helpers for the chat-service v0.19.0 session_not_found recovery flow.
 *
 * When a stored sessionId no longer matches a backend session (e.g. the
 * conversation was pruned, or the org was switched), chat-service emits
 * `{type:"error", code:"session_not_found"}`. The dashboard chat components
 * use these helpers to drop the cached sessionId and surface a non-blocking
 * notice so the next user message starts a fresh conversation.
 */

export const SESSION_NOT_FOUND_NOTICE =
  "Session expired — starting a new conversation.";

export interface ErrorInfo {
  code: string;
  message: string;
}

export function isSessionNotFoundError(
  data: ErrorInfo | null | undefined,
): boolean {
  return data?.code === "session_not_found";
}

export function clearStoredSession(sessionStorageKey: string): void {
  try {
    localStorage.removeItem(sessionStorageKey);
  } catch {
    // localStorage unavailable (SSR / private mode) — nothing to clear
  }
}
