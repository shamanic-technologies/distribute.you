/**
 * The investor update being written, kept on the staff member's own machine so
 * a reload, a closed tab or a crashed browser does not throw away twenty
 * minutes of writing.
 *
 * Alias-free on purpose (no `@/…` imports) so vitest can resolve it and these
 * helpers get REAL unit tests rather than source-substring guards.
 *
 * **Nothing here reaches the network.** A draft never leaves the browser, which
 * is what makes autosaving safe on a surface whose other button mails forty
 * investors. The cost is that it does not follow you to another machine; the
 * alternative (a stored draft on the producer) is a table, a migration and two
 * repos for a surface one person writes on.
 *
 * Not a cookie either, although the repo's remembered-state rule points there:
 * that rule is about values needed in the FIRST frame, and it buys that by
 * riding every request to the origin. A markdown body of several KB has no
 * business on each request, and an editor draft is read after hydration
 * regardless.
 */

/**
 * Version-tagged, so a future change to the shape retires old drafts instead of
 * restoring half of one into a form that has moved on.
 */
export const DRAFT_VERSION = 1;

export const DRAFT_STORAGE_KEY = "distribute:investor-update-draft:v1";

export type InvestorUpdateDraft = {
  subject: string;
  body: string;
};

/**
 * The narrow slice of `Storage` this needs, so the helpers take a fake in tests
 * and the module stays free of anything `window`-shaped.
 */
export type DraftStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function draftIsEmpty(draft: InvestorUpdateDraft): boolean {
  return draft.subject.trim().length === 0 && draft.body.trim().length === 0;
}

export function serializeDraft(draft: InvestorUpdateDraft): string {
  return JSON.stringify({ v: DRAFT_VERSION, subject: draft.subject, body: draft.body });
}

/**
 * What was stored, or null when there is nothing usable to restore.
 *
 * Tolerant by design rather than fail-loud: this is not backend data being
 * silently defaulted, it is a convenience the author never asked for. A blob
 * that cannot be read is REPORTED (`console.error`) and the caller purges it —
 * throwing here would take the whole composer down over a stale local value and
 * leave the staff member unable to write anything at all.
 */
export function parseDraft(raw: string | null): InvestorUpdateDraft | null {
  if (raw === null || raw.trim().length === 0) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("[admin] investor update draft is not JSON, discarding it");
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    console.error("[admin] investor update draft is not an object, discarding it");
    return null;
  }

  const blob = parsed as Record<string, unknown>;
  if (blob.v !== DRAFT_VERSION) {
    console.error("[admin] investor update draft was written by another version, discarding it");
    return null;
  }
  if (typeof blob.subject !== "string" || typeof blob.body !== "string") {
    console.error("[admin] investor update draft has the wrong shape, discarding it");
    return null;
  }

  const draft: InvestorUpdateDraft = { subject: blob.subject, body: blob.body };
  return draftIsEmpty(draft) ? null : draft;
}

/**
 * Restores the draft, purging whatever could not be read so the same broken
 * blob is not re-parsed on every visit.
 */
export function readDraft(storage: DraftStorage): InvestorUpdateDraft | null {
  const raw = storage.getItem(DRAFT_STORAGE_KEY);
  const draft = parseDraft(raw);
  if (draft === null && raw !== null) storage.removeItem(DRAFT_STORAGE_KEY);
  return draft;
}

/**
 * An empty draft CLEARS the key rather than storing a blank one: emptying the
 * form is how someone abandons an update, and restoring "" over "" on the next
 * visit would keep a dead entry alive forever.
 */
export function writeDraft(storage: DraftStorage, draft: InvestorUpdateDraft): void {
  if (draftIsEmpty(draft)) {
    storage.removeItem(DRAFT_STORAGE_KEY);
    return;
  }
  storage.setItem(DRAFT_STORAGE_KEY, serializeDraft(draft));
}

export function clearDraft(storage: DraftStorage): void {
  storage.removeItem(DRAFT_STORAGE_KEY);
}

/** How long after the last keystroke the draft is written. */
export const DRAFT_SAVE_DEBOUNCE_MS = 400;

/**
 * The browser's own storage, or null where there is none (server render, or a
 * browser refusing it). A composer that cannot save keeps working; it just says
 * nothing about a draft.
 */
export function browserDraftStorage(): DraftStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    console.error("[admin] this browser refuses localStorage, drafts will not be kept");
    return null;
  }
}
