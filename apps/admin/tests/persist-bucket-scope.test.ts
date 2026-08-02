import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import type { UseStore } from "idb-keyval";
import {
  PERSIST_MAX_AGE_MS,
  RECLAIM_MARKER_KEY,
  bucketKeyBounds,
  snapshotIsStale,
} from "../src/lib/persist-cache";
import {
  bucketEntries,
  reclaimLegacyStore,
  sweepStaleEntries,
} from "../src/lib/idb-bucket";

/**
 * The persisted query cache lives in ONE flat IndexedDB key space shared by every
 * bucket — every god-mode org, plus the cross-org `platform` bucket — and it had no
 * expiry, so it only ever grew. Both paths that read it called `entries()`, which
 * returns every record at once, so opening any page decoded the whole accumulated
 * cache into the heap (twice on mount, then again on every navigation) to keep the
 * handful of entries that page needed.
 *
 * These tests pin the two properties that stop that: a read touches ONE bucket, and
 * the store is bounded.
 */

/** A record store standing in for an `IDBObjectStore`, enough for what we call on it. */
function fakeStore(initial: Record<string, string>) {
  const data = new Map(Object.entries(initial));
  /** Keys the fake was asked to READ — the whole point of the bucket-scope test. */
  const readKeys: string[] = [];

  type FakeRange = { lo: string; hi: string };
  const inRange = (key: string, r: FakeRange) => key >= r.lo && key <= r.hi;

  function request<T>(result: T) {
    const req: Record<string, unknown> = { result, error: null };
    Object.defineProperty(req, "onsuccess", {
      set: (fn: () => void) => queueMicrotask(fn),
      configurable: true,
    });
    Object.defineProperty(req, "oncomplete", {
      set: () => undefined,
      configurable: true,
    });
    return req as unknown as IDBRequest<T>;
  }

  const objectStore = {
    getAllKeys(range: FakeRange) {
      const keys = [...data.keys()].sort().filter((k) => inRange(k, range));
      return request(keys as unknown as IDBValidKey[]);
    },
    getAll(range: FakeRange) {
      const keys = [...data.keys()].sort().filter((k) => inRange(k, range));
      readKeys.push(...keys);
      return request(keys.map((k) => data.get(k)!));
    },
    get(key: string) {
      readKeys.push(key);
      return request(data.get(key));
    },
    put(value: string, key: string) {
      data.set(key, value);
      return request(undefined);
    },
    clear() {
      data.clear();
      return request(undefined);
    },
    openCursor() {
      const keys = [...data.keys()].sort();
      let i = -1;
      const req: Record<string, unknown> = { result: null, error: null };
      let handler: (() => void) | null = null;
      const step = () => {
        i++;
        if (i >= keys.length) {
          req.result = null;
        } else {
          const key = keys[i];
          req.result = {
            key,
            value: data.get(key),
            delete: () => data.delete(key),
            continue: () => queueMicrotask(step),
          };
        }
        handler?.();
      };
      Object.defineProperty(req, "onsuccess", {
        set: (fn: () => void) => {
          handler = fn;
          queueMicrotask(step);
        },
        configurable: true,
      });
      req.onerror = null;
      return req as unknown as IDBRequest<IDBCursorWithValue | null>;
    },
    // `promisifyRequest` also accepts a transaction, which is how idb-keyval awaits a
    // write; it resolves the same way a request does.
    get transaction() {
      return request(undefined);
    },
  };

  const use: UseStore = (_mode, callback) =>
    Promise.resolve(callback(objectStore as unknown as IDBObjectStore));

  return { use, data, readKeys };
}

/** A snapshot in the shape the persister writes. */
function snapshot(key: string, updatedAt: number, buster = "1") {
  return JSON.stringify({
    queryKey: [key],
    buster,
    state: { data: { value: key }, dataUpdatedAt: updatedAt },
  });
}

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

describe("bucket key bounds", () => {
  it("brackets a bucket's own keys", () => {
    const [lower, upper] = bucketKeyBounds("distribute-admin-cache:platform");
    const key = "distribute-admin-cache:platform-abc123";
    expect(key >= lower && key <= upper).toBe(true);
  });

  it("excludes another bucket's keys", () => {
    const [lower, upper] = bucketKeyBounds("distribute-admin-cache:org_A");
    const other = "distribute-admin-cache:org_B-abc123";
    expect(other >= lower && other <= upper).toBe(false);
  });

  it("excludes a bucket whose name merely EXTENDS this one", () => {
    // `platform` and `platform2` would collide under a naive `startsWith`-shaped
    // range; the `-` in the lower bound is what separates them.
    const [lower, upper] = bucketKeyBounds("distribute-admin-cache:platform");
    const sibling = "distribute-admin-cache:platform2-abc123";
    expect(sibling >= lower && sibling <= upper).toBe(false);
  });
});

describe("bucketEntries", () => {
  const store = () =>
    fakeStore({
      "distribute-admin-cache:platform-aaa": snapshot("platform-aaa", NOW),
      "distribute-admin-cache:platform-bbb": snapshot("platform-bbb", NOW),
      "distribute-admin-cache:org_A-ccc": snapshot("org_A-ccc", NOW),
      "distribute-admin-cache:org_B-ddd": snapshot("org_B-ddd", NOW),
    });

  it("returns exactly this bucket's entries", async () => {
    const { use } = store();
    const entries = await bucketEntries("distribute-admin-cache:platform", {
      store: use,
      range: (lo, hi) => ({ lo, hi }) as unknown as IDBKeyRange,
    });
    expect(entries.map(([k]) => k)).toEqual([
      "distribute-admin-cache:platform-aaa",
      "distribute-admin-cache:platform-bbb",
    ]);
  });

  it("never READS another bucket's values — the memory claim, not just the filter", async () => {
    const { use, readKeys } = store();
    await bucketEntries("distribute-admin-cache:platform", {
      store: use,
      range: (lo, hi) => ({ lo, hi }) as unknown as IDBKeyRange,
    });
    expect(readKeys).toEqual([
      "distribute-admin-cache:platform-aaa",
      "distribute-admin-cache:platform-bbb",
    ]);
    expect(readKeys.some((k) => k.includes("org_"))).toBe(false);
  });

  it("pairs each key with its own value", async () => {
    const { use } = store();
    const entries = await bucketEntries("distribute-admin-cache:org_A", {
      store: use,
      range: (lo, hi) => ({ lo, hi }) as unknown as IDBKeyRange,
    });
    expect(entries).toHaveLength(1);
    const [key, value] = entries[0];
    expect(key).toBe("distribute-admin-cache:org_A-ccc");
    expect(JSON.parse(value).queryKey).toEqual(["org_A-ccc"]);
  });
});

describe("snapshotIsStale", () => {
  it("keeps a fresh entry written under the current version", () => {
    expect(snapshotIsStale(snapshot("k", NOW - DAY), "1", NOW, PERSIST_MAX_AGE_MS)).toBe(
      false,
    );
  });

  it("drops an entry older than the window", () => {
    expect(
      snapshotIsStale(snapshot("k", NOW - 31 * DAY), "1", NOW, PERSIST_MAX_AGE_MS),
    ).toBe(true);
  });

  it("drops an entry written under another cache version", () => {
    expect(
      snapshotIsStale(snapshot("k", NOW, "0"), "1", NOW, PERSIST_MAX_AGE_MS),
    ).toBe(true);
  });

  it("drops an unreadable value", () => {
    expect(snapshotIsStale("not json", "1", NOW, PERSIST_MAX_AGE_MS)).toBe(true);
  });

  it("drops a snapshot carrying no timestamp", () => {
    const noStamp = JSON.stringify({ queryKey: ["k"], buster: "1", state: {} });
    expect(snapshotIsStale(noStamp, "1", NOW, PERSIST_MAX_AGE_MS)).toBe(true);
  });

  it("expires nothing by age when the window is infinite", () => {
    expect(snapshotIsStale(snapshot("k", 0), "1", NOW, Infinity)).toBe(false);
  });
});

describe("PERSIST_MAX_AGE_MS", () => {
  it("is finite — an unbounded store is what filled the heap", () => {
    expect(Number.isFinite(PERSIST_MAX_AGE_MS)).toBe(true);
    expect(PERSIST_MAX_AGE_MS).toBe(30 * DAY);
  });
});

describe("sweepStaleEntries", () => {
  it("deletes stale entries across EVERY bucket and keeps the fresh ones", async () => {
    const { use, data } = fakeStore({
      "distribute-admin-cache:platform-fresh": snapshot("fresh", NOW - DAY),
      "distribute-admin-cache:platform-old": snapshot("old", NOW - 40 * DAY),
      "distribute-admin-cache:org_A-old": snapshot("orgA", NOW - 90 * DAY),
      "distribute-admin-cache:org_B-busted": snapshot("orgB", NOW, "0"),
    });
    const removed = await sweepStaleEntries("1", NOW, PERSIST_MAX_AGE_MS, {
      store: use,
    });
    expect(removed).toBe(3);
    expect([...data.keys()]).toEqual(["distribute-admin-cache:platform-fresh"]);
  });

  it("never deletes the reclaim marker — a swept marker reclaims on every boot", async () => {
    const { use, data } = fakeStore({ [RECLAIM_MARKER_KEY]: "1" });
    const removed = await sweepStaleEntries("1", NOW, PERSIST_MAX_AGE_MS, {
      store: use,
    });
    expect(removed).toBe(0);
    expect(data.get(RECLAIM_MARKER_KEY)).toBe("1");
  });
});

describe("reclaimLegacyStore", () => {
  it("clears the store once and leaves the marker behind", async () => {
    const { use, data } = fakeStore({
      "distribute-admin-cache:platform-a": snapshot("a", NOW),
      "distribute-admin-cache:org_A-b": snapshot("b", NOW),
    });
    expect(await reclaimLegacyStore({ store: use })).toBe(true);
    expect([...data.keys()]).toEqual([RECLAIM_MARKER_KEY]);
  });

  it("does nothing on a store already reclaimed", async () => {
    const { use, data } = fakeStore({
      [RECLAIM_MARKER_KEY]: "1",
      "distribute-admin-cache:platform-a": snapshot("a", NOW),
    });
    expect(await reclaimLegacyStore({ store: use })).toBe(false);
    expect(data.has("distribute-admin-cache:platform-a")).toBe(true);
  });
});

/**
 * Both surfaces below document why they no longer do a thing, naming it — so the
 * negative guards run against a comment-stripped copy, or the explanation of the
 * fix would fail the test for the fix.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("query-provider reads one bucket, once", () => {
  const src = readFileSync(
    join(__dirname, "../src/lib/query-provider.tsx"),
    "utf-8",
  );
  const code = stripComments(src);

  it("no longer reads the whole store", () => {
    expect(code).not.toContain("idbEntries");
  });

  it("reads through the bucket-scoped helper", () => {
    expect(code).toContain("bucketEntries(");
  });

  it("does not also restore the bucket on mount", () => {
    // `restoreQueries` fired on mount beside the nav reseed (whose effect also runs
    // on mount), so every mount read and decoded this bucket twice — and unlike the
    // reseed it is not cold-guarded, so it can overwrite fresher memory.
    expect(code).not.toContain("restoreQueries");
  });

  it("bounds the store at boot", () => {
    expect(code).toContain("reclaimLegacyStore()");
    expect(code).toContain("sweepStaleEntries(");
  });
});
