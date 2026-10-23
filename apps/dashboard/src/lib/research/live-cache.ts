/**
 * SERVER ONLY. A short-lived memory of the last live Research reads, so a staff page answers in
 * milliseconds instead of waiting 0.1-3 s on features-service every time (owner 2026-10-23,
 * « les rendre instantanées »). Stale-while-revalidate with two hard bounds:
 *
 *   age < FRESH_MS            served as is
 *   FRESH_MS <= age < MAX_MS  served at once, a re-read starts in the background
 *   age >= MAX_MS, or none    the request waits for a live read (and its failure)
 *
 * A failed background re-read DROPS the entry, so the next request waits on the live read and a
 * broken features-service shows as an error, never as an older copy kept alive. Concurrent callers
 * share one in-flight read per key. Alias-free so it unit-tests in plain node.
 */
export const RESEARCH_FRESH_MS = 60_000;
export const RESEARCH_MAX_AGE_MS = 5 * 60_000;

interface Entry {
  value: unknown;
  at: number;
}

export interface LiveMemory {
  read<T>(key: string, load: () => Promise<T>): Promise<T>;
}

export function createLiveMemory(opts: { freshMs?: number; maxAgeMs?: number; now?: () => number } = {}): LiveMemory {
  const freshMs = opts.freshMs ?? RESEARCH_FRESH_MS;
  const maxAgeMs = opts.maxAgeMs ?? RESEARCH_MAX_AGE_MS;
  const now = opts.now ?? Date.now;
  const entries = new Map<string, Entry>();
  const inflight = new Map<string, Promise<unknown>>();

  function load<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const running = inflight.get(key);
    if (running) return running as Promise<T>;
    const p = loader()
      .then((value) => {
        entries.set(key, { value, at: now() });
        return value;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  }

  return {
    read<T>(key: string, loader: () => Promise<T>): Promise<T> {
      const e = entries.get(key);
      const age = e ? now() - e.at : Infinity;
      if (e && age < freshMs) return Promise.resolve(e.value as T);
      if (e && age < maxAgeMs) {
        load(key, loader).catch((err) => {
          entries.delete(key);
          console.error(`[research] background re-read of ${key} failed, next request reads live:`, err);
        });
        return Promise.resolve(e.value as T);
      }
      entries.delete(key);
      return load(key, loader);
    },
  };
}
