import { createStore, promisifyRequest, type UseStore } from "idb-keyval";
import {
  RECLAIM_MARKER_KEY,
  bucketKeyBounds,
  snapshotIsStale,
} from "./persist-cache";

/**
 * Bucket-scoped and memory-bounded reads of the IndexedDB store the persisted query
 * cache lives in.
 *
 * The store is one flat key space shared by every bucket — every god-mode org plus
 * the cross-org `platform` bucket — and it had no expiry, so it only ever grew. Both
 * paths that read it went through `entries()`, which returns EVERY record as a
 * JavaScript array of strings: opening any page decoded the whole accumulated cache
 * into the heap, twice (the persister's mount restore and the nav reseed), and did it
 * again on every navigation. On a console that has browsed many orgs for months that
 * is gigabytes, allocated in one go, for the few entries the page actually needed.
 *
 * Everything here exists to never hold more than one bucket — or one record — at a
 * time. It is the only module that talks to IndexedDB directly; the decisions about
 * WHAT is stale live next door in `persist-cache.ts`, pure and unit-tested.
 */

/**
 * The store idb-keyval's own top-level `get`/`set`/`del` use, named explicitly so a
 * scoped read and an ordinary write are unambiguously the same key space. Created
 * lazily: `createStore` opens a database, and this module is imported during render.
 */
let defaultStore: UseStore | null = null;
function store(): UseStore {
  if (!defaultStore) defaultStore = createStore("keyval-store", "keyval");
  return defaultStore;
}

/** Injection seam so the range logic is testable without a real IndexedDB. */
export interface IdbBucketDeps {
  store?: UseStore;
  /** Defaults to `IDBKeyRange.bound`, which does not exist outside a browser. */
  range?: (lower: string, upper: string) => IDBKeyRange;
}

/**
 * Every `[key, value]` pair belonging to ONE bucket, and nothing else.
 *
 * `getAllKeys` and `getAll` run in the SAME transaction over the SAME range, so the
 * two arrays are ordered identically and zip positionally. This is the drop-in
 * replacement for `entries()` in the persister's storage adapter: the persister then
 * filters the (already correct) list by prefix and finds it complete, while the bytes
 * of every other bucket are never read.
 */
export async function bucketEntries(
  prefix: string,
  deps: IdbBucketDeps = {},
): Promise<Array<[string, string]>> {
  const [lower, upper] = bucketKeyBounds(prefix);
  const makeRange = deps.range ?? ((lo, hi) => IDBKeyRange.bound(lo, hi));
  const use = deps.store ?? store();
  return use("readonly", async (objectStore) => {
    const range = makeRange(lower, upper);
    // BOTH requests are issued in the same synchronous turn on purpose: an IndexedDB
    // transaction auto-commits as soon as the event loop yields with nothing pending,
    // so awaiting the first before asking for the second would leave the store closed
    // by the time the second is issued.
    const keysRequest = objectStore.getAllKeys(range);
    const valuesRequest = objectStore.getAll(range);
    const [keys, values] = await Promise.all([
      promisifyRequest<IDBValidKey[]>(keysRequest),
      promisifyRequest<unknown[]>(valuesRequest),
    ]);
    const out: Array<[string, string]> = [];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const value = values[i];
      if (typeof key === "string" && typeof value === "string") out.push([key, value]);
    }
    return out;
  });
}

/**
 * Delete every stale entry in the store, across ALL buckets, in constant memory.
 *
 * A CURSOR is what makes this safe to run over an unbounded store: it hands over one
 * record at a time and lets each be dropped before the next is read, so the sweep
 * never holds more than a single value. The persister ships `persisterGc()` for the
 * same job and it cannot be used here — it calls `storage.entries()`, so garbage
 * collecting would re-create the very allocation this module exists to avoid, and it
 * only ever looks at the current bucket, leaving every other org's entries to
 * accumulate untouched.
 *
 * Best-effort and fire-and-forget: a failed sweep costs disk, never correctness.
 * Returns how many entries it removed, which is what makes it verifiable.
 */
export async function sweepStaleEntries(
  buster: string,
  now: number,
  maxAgeMs: number,
  deps: Pick<IdbBucketDeps, "store"> = {},
): Promise<number> {
  const use = deps.store ?? store();
  return use("readwrite", (objectStore) => {
    return new Promise<number>((resolve, reject) => {
      let removed = 0;
      const request = objectStore.openCursor();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(removed);
          return;
        }
        const value = cursor.value;
        // The reclaim marker is not a query snapshot, so every staleness test would
        // call it garbage and delete it — and a deleted marker means the one-time
        // reclaim runs again on the next boot, wiping the cache on every load.
        const isMarker = cursor.key === RECLAIM_MARKER_KEY;
        if (
          !isMarker &&
          typeof value === "string" &&
          snapshotIsStale(value, buster, now, maxAgeMs)
        ) {
          cursor.delete();
          removed++;
        }
        cursor.continue();
      };
    });
  });
}

/**
 * Drop the pre-bounded store, once, ever.
 *
 * See `RECLAIM_MARKER_KEY`: the sweep bounds the store from here on but cannot reach
 * the bulk of what is already there, because most of it is recent enough not to be
 * stale. The marker is written AFTER the clear, so an interrupted run simply reclaims
 * again on the next boot rather than leaving the store half-emptied and marked done.
 *
 * Returns whether it cleared anything, so a caller can say so.
 */
export async function reclaimLegacyStore(
  deps: Pick<IdbBucketDeps, "store"> = {},
): Promise<boolean> {
  const use = deps.store ?? store();
  const alreadyDone = await use("readonly", (objectStore) =>
    promisifyRequest<unknown>(objectStore.get(RECLAIM_MARKER_KEY)),
  );
  if (alreadyDone !== undefined) return false;
  await use("readwrite", (objectStore) => promisifyRequest(objectStore.clear()));
  await use("readwrite", (objectStore) => {
    objectStore.put("1", RECLAIM_MARKER_KEY);
    return promisifyRequest(objectStore.transaction);
  });
  return true;
}
