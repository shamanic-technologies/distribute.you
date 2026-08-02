import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  DRAFT_STORAGE_KEY,
  clearDraft,
  draftIsEmpty,
  parseDraft,
  readDraft,
  serializeDraft,
  writeDraft,
  type DraftStorage,
} from "../src/lib/investor-update-draft";

/** A stand-in for `localStorage`, so nothing here needs a browser. */
function fakeStorage(seed: Record<string, string> = {}): DraftStorage & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseDraft", () => {
  it("restores what was written", () => {
    const draft = { subject: "Q3 update", body: "## Where we are\n\nWe shipped." };
    expect(parseDraft(serializeDraft(draft))).toEqual(draft);
  });

  it("returns null for nothing stored, rather than an empty form", () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft("   ")).toBeNull();
  });

  it("discards a blob it cannot read, loudly, instead of throwing the composer down", () => {
    // Tolerant on purpose: this is a local convenience, not backend data. A
    // throw here would leave the staff member unable to write anything at all.
    expect(parseDraft("{not json")).toBeNull();
    expect(parseDraft('"a string"')).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it("discards a draft written by another version", () => {
    expect(parseDraft(JSON.stringify({ v: 99, subject: "a", body: "b" }))).toBeNull();
  });

  it("discards a draft whose fields are the wrong type", () => {
    expect(parseDraft(JSON.stringify({ v: 1, subject: 12, body: "b" }))).toBeNull();
    expect(parseDraft(JSON.stringify({ v: 1, subject: "a" }))).toBeNull();
  });

  it("treats a blank draft as nothing to restore", () => {
    expect(parseDraft(JSON.stringify({ v: 1, subject: "  ", body: "\n" }))).toBeNull();
  });
});

describe("draftIsEmpty", () => {
  it("is true only when both fields are blank", () => {
    expect(draftIsEmpty({ subject: "", body: "" })).toBe(true);
    expect(draftIsEmpty({ subject: " \n ", body: "  " })).toBe(true);
    expect(draftIsEmpty({ subject: "Q3", body: "" })).toBe(false);
    expect(draftIsEmpty({ subject: "", body: "text" })).toBe(false);
  });
});

describe("readDraft / writeDraft", () => {
  it("round-trips through storage", () => {
    const storage = fakeStorage();
    const draft = { subject: "Q3 update", body: "We shipped **a lot**." };
    writeDraft(storage, draft);
    expect(readDraft(storage)).toEqual(draft);
  });

  it("clears the key when the form is emptied, so an abandoned draft does not linger", () => {
    const storage = fakeStorage();
    writeDraft(storage, { subject: "Q3", body: "text" });
    writeDraft(storage, { subject: "", body: "" });
    expect(storage.map.has(DRAFT_STORAGE_KEY)).toBe(false);
    expect(readDraft(storage)).toBeNull();
  });

  it("purges an unreadable blob so the same junk is not re-parsed every visit", () => {
    const storage = fakeStorage({ [DRAFT_STORAGE_KEY]: "{broken" });
    expect(readDraft(storage)).toBeNull();
    expect(storage.map.has(DRAFT_STORAGE_KEY)).toBe(false);
  });

  it("leaves an absent key absent rather than writing an empty one on read", () => {
    const storage = fakeStorage();
    expect(readDraft(storage)).toBeNull();
    expect(storage.map.size).toBe(0);
  });

  it("clearDraft removes it — a sent update must not be offered back for re-sending", () => {
    const storage = fakeStorage();
    writeDraft(storage, { subject: "Q3", body: "text" });
    clearDraft(storage);
    expect(readDraft(storage)).toBeNull();
  });
});
