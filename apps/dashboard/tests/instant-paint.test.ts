import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  MAX_PERSISTED_ENTRY_BYTES,
  coldRestoreFromValue,
  coldStorageKeys,
  entryIsTooLargeToPersist,
  persistCacheVersion,
  persisterStorageKey,
  queryKeyFromStorageKey,
} from "../src/lib/persist-cache";
import { POLL_INTERVAL } from "../src/lib/query-options";

const PREFIX = persisterStorageKey("org_1");
const V = persistCacheVersion();

function storageKey(queryKey: readonly unknown[], prefix = PREFIX): string {
  return `${prefix}-${JSON.stringify(queryKey)}`;
}

function value(
  queryKey: readonly unknown[],
  data: unknown,
  opts: { buster?: string; dataUpdatedAt?: number } = {},
): string {
  return JSON.stringify({
    queryKey,
    buster: opts.buster ?? V,
    state: { data, dataUpdatedAt: opts.dataUpdatedAt ?? 1000 },
  });
}

/**
 * The reseed used to read EVERY value in the org's bucket and `JSON.parse` each one,
 * on EVERY navigation — including the entries whose query was already warm, whose
 * value was therefore parsed only to be thrown away. With the unpaginated leads list
 * in the bucket that is tens of megabytes of IndexedDB transfer plus main-thread
 * parse per page change, which is what "the dashboard is slow" turned out to be.
 */
describe("queryKeyFromStorageKey — the query key is recoverable WITHOUT reading the value", () => {
  it("recovers the key a snapshot was stored under", () => {
    expect(queryKeyFromStorageKey(storageKey(["brand", "b1"]), PREFIX)).toEqual([
      "brand",
      "b1",
    ]);
  });

  it("returns null for another bucket's key (cross-org isolation, DIS-143)", () => {
    const other = storageKey(["brand", "b1"], persisterStorageKey("org_2"));
    expect(queryKeyFromStorageKey(other, PREFIX)).toBeNull();
  });

  it("returns null for a key carrying no JSON array (the reclaim marker, junk)", () => {
    expect(queryKeyFromStorageKey(`${PREFIX}-not-json`, PREFIX)).toBeNull();
    expect(queryKeyFromStorageKey(`${PREFIX}-{"a":1}`, PREFIX)).toBeNull();
  });
});

describe("coldStorageKeys — only COLD, allowlisted keys are worth a value read", () => {
  const noneWarm = () => false;

  it("keeps a cold, allowlisted key", () => {
    const keys = [storageKey(["brand", "b1"]), storageKey(["audiences", "b1"])];
    expect(coldStorageKeys(keys, PREFIX, noneWarm)).toEqual(keys);
  });

  it("COLD-GUARD: drops a key whose query already holds in-memory data", () => {
    const warm = (k: readonly unknown[]) => k[0] === "brand";
    const keys = [storageKey(["brand", "b1"]), storageKey(["audiences", "b1"])];
    expect(coldStorageKeys(keys, PREFIX, warm)).toEqual([storageKey(["audiences", "b1"])]);
  });

  it("drops a dead / sensitive root someone's disk still carries", () => {
    const keys = [storageKey(["apiKeys", "x"]), storageKey(["someBrandNewQuery", "x"])];
    expect(coldStorageKeys(keys, PREFIX, noneWarm)).toEqual([]);
  });

  it("drops another org's keys", () => {
    const foreign = storageKey(["brand", "b1"], persisterStorageKey("org_2"));
    expect(coldStorageKeys([foreign], PREFIX, noneWarm)).toEqual([]);
  });
});

describe("coldRestoreFromValue — the per-entry parse, with the same buster guards", () => {
  it("returns the snapshot for a current, data-bearing entry", () => {
    const key = storageKey(["brand", "b1"]);
    expect(
      coldRestoreFromValue(key, value(["brand", "b1"], { id: "b1" }, { dataUpdatedAt: 7 }), PREFIX, V),
    ).toEqual({ queryKey: ["brand", "b1"], data: { id: "b1" }, updatedAt: 7 });
  });

  it("refuses a busted snapshot — never paints stale-shaped data", () => {
    const key = storageKey(["brand", "b1"]);
    expect(
      coldRestoreFromValue(key, value(["brand", "b1"], { id: "b1" }, { buster: "OLD" }), PREFIX, V),
    ).toBeNull();
  });

  it("refuses an entry that never held data, and a corrupt one", () => {
    const key = storageKey(["brand", "b1"]);
    expect(coldRestoreFromValue(key, value(["brand", "b1"], undefined), PREFIX, V)).toBeNull();
    expect(coldRestoreFromValue(key, "{not-json", PREFIX, V)).toBeNull();
  });
});

describe("size cap — one oversized entry must not tax every page in the org", () => {
  it("accepts an ordinary snapshot", () => {
    expect(entryIsTooLargeToPersist(value(["brand", "b1"], { id: "b1" }))).toBe(false);
  });

  it("refuses one past the cap (the unpaginated leads list on a heavy brand)", () => {
    expect(entryIsTooLargeToPersist("x".repeat(MAX_PERSISTED_ENTRY_BYTES + 1))).toBe(true);
  });

  it("keeps the cap at 2MB — large enough that every ordinary page still paints from disk", () => {
    expect(MAX_PERSISTED_ENTRY_BYTES).toBe(2 * 1024 * 1024);
  });
});

describe("query-provider wiring — the reseed reads keys first and caps what it writes", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "../src/lib/query-provider.tsx"),
    "utf-8",
  );

  it("reads KEYS, then only the cold values — never the whole bucket per navigation", () => {
    expect(src).toContain("bucketKeys(prefix)");
    expect(src).toContain("coldStorageKeys(");
    expect(src).toContain("valuesForKeys(cold)");
    // The whole-bucket read + parse-everything path is what made navigation slow.
    expect(src).not.toContain("coldRestorablePairs(");
  });

  it("re-checks coldness after the second round-trip (never stomp fresher memory)", () => {
    expect(src).toContain("if (client.getQueryData(restore.queryKey) !== undefined) continue;");
  });

  it("refuses to persist an oversized entry, and DELETES the stale copy of it", () => {
    expect(src).toContain("entryIsTooLargeToPersist(value) ? idbDel(key) : idbSet(key, value)");
  });

  it("kicks the disk read during RENDER, not after the children have mounted", () => {
    // An effect runs post-commit, so the first page of a session paints its skeleton
    // and only then asks IndexedDB what it should have shown.
    const init = src.indexOf("const [{ client }] = useState(() => {");
    expect(init).toBeGreaterThan(-1);
    expect(src.slice(init, init + 400)).toContain("reseedColdQueriesFromDisk(made.client, orgId)");
  });

  it("latches the mount read so the nav effect does not repeat it", () => {
    expect(src).toContain("mountReadKicked");
  });

  it("still keeps the local-first defaults (SWR paint, silent revalidate)", () => {
    expect(src).toContain("placeholderData: keepPreviousData");
    expect(src).toContain("persister: persister.persisterFn");
  });
});

describe("poll cadence — freshness traded for the instant paint (owner-decided)", () => {
  it("polls at 60s: raising it is the safe direction against the 30s Gold TTL", () => {
    expect(POLL_INTERVAL).toBe(60_000);
    expect(POLL_INTERVAL).toBeGreaterThanOrEqual(30_000);
  });
});

/**
 * Every dashboard route is DYNAMIC, so Next's default prefetch stops at the nearest
 * `loading.tsx` and the page's own payload is only fetched on the click. For any
 * funnel / leg / campaign sub-route the nearest boundary is the OFFER's, so drilling
 * in blanked the whole offer area to a full-page skeleton — the reported bug.
 */
describe("route transitions — the destination is warmed before the click", () => {
  const read = (p: string) => fs.readFileSync(path.join(__dirname, "../src", p), "utf-8");

  it("the sidebar's nav rows prefetch their page, not only its layouts", () => {
    const src = read("components/context-sidebar.tsx");
    const link = src.indexOf("<Link\n      href={item.href}");
    expect(link).toBeGreaterThan(-1);
    expect(src.slice(link, link + 1200)).toContain("prefetch");
  });

  it("every row that navigates with router.push warms its href on hover AND focus", () => {
    // A row carries its own controls, so it cannot be an anchor — nothing prefetches
    // a `router.push` target unless the row asks for it.
    for (const file of [
      "components/offers/offers-table.tsx",
      "components/funnels/offer-funnels-page.tsx",
      "components/campaigns/campaigns-table.tsx",
    ]) {
      const src = read(file);
      expect(src, file).toContain("useRoutePrefetch");
      expect(src, file).toContain("onMouseEnter");
      expect(src, file).toContain("onFocus");
    }
  });

  it("prefetches each href at most once per mount", () => {
    const src = read("lib/use-route-prefetch.ts");
    expect(src).toContain("seen.current.has(href)");
    expect(src).toContain("router.prefetch(href)");
  });
});

/**
 * `isLoading` is `isPending && isFetching`, so a query DISABLED by the org-consistency
 * gate reports `isLoading: false` while still unresolved — the terminal branch fires
 * and the surface flashes its empty / not-found state before the read has run.
 */
describe("reveal gates — no surface reads isLoading off a useAuthQuery", () => {
  // brand-info and the workflow detail panel were on this list and are now DELETED —
  // both were `useFeatureFlag`-gated, which in the dashboard hides a surface from
  // everyone rather than staging it. They live in `apps/admin`, where the gate resolves.
  const files = ["app/(authed)/(dashboard)/orgs/[orgId]/api-keys/page.tsx"];

  it("gates on isPending in every live surface that used to read isLoading", () => {
    for (const file of files) {
      const src = fs.readFileSync(path.join(__dirname, "../src", file), "utf-8");
      expect(src, file).not.toMatch(/isLoading:\s*\w+\s*\}\s*=\s*useAuthQuery/);
    }
  });

  it("the leg board's skeleton is decided by `pending` alone, never re-locked on !data", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../src/components/funnels/funnel-leg-page.tsx"),
      "utf-8",
    );
    expect(src).not.toContain("{pending || !board ?");
    expect(src).toContain("{pending ? (");
  });
});
