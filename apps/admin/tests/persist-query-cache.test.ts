import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  shouldPersistQuery,
  isPersistableQueryKey,
  persisterStorageKey,
  persistCacheVersion,
  coldRestorablePairs,
  PERSIST_MAX_AGE_MS,
  PERSIST_GC_TIME_MS,
  SENSITIVE_QUERY_ROOTS,
  type PersistableQuery,
} from "../src/lib/persist-cache";

const PREFIX = persisterStorageKey("org_1");
const V = persistCacheVersion();

/** Serialize a disk entry the way the per-query persister writes it. */
function entry(
  queryKey: readonly unknown[],
  data: unknown,
  opts: { buster?: string; dataUpdatedAt?: number; prefix?: string } = {},
): [string, string] {
  const prefix = opts.prefix ?? PREFIX;
  const key = `${prefix}-${JSON.stringify(queryKey)}`;
  const value = JSON.stringify({
    queryKey,
    buster: opts.buster ?? V,
    state: { data, dataUpdatedAt: opts.dataUpdatedAt ?? 1000 },
  });
  return [key, value];
}

const q = (status: string, key: readonly unknown[]): PersistableQuery => ({
  state: { status },
  queryKey: key,
});

describe("shouldPersistQuery — only successful, non-sensitive queries persist (DENYLIST)", () => {
  it("persists a successful, non-sensitive query", () => {
    expect(shouldPersistQuery(q("success", ["campaigns", { brandId: "b1" }]))).toBe(true);
    expect(shouldPersistQuery(q("success", ["featureStats", "ai-visibility-scoring"]))).toBe(true);
  });

  it("never persists a non-success (pending / error) query", () => {
    expect(shouldPersistQuery(q("pending", ["campaigns"]))).toBe(false);
    expect(shouldPersistQuery(q("error", ["campaigns"]))).toBe(false);
  });

  it("never persists secrets to disk, even when successful", () => {
    for (const root of SENSITIVE_QUERY_ROOTS) {
      expect(shouldPersistQuery(q("success", [root, "anything"]))).toBe(false);
    }
  });

  it("treats apiKeys / byokKeys / keySources as sensitive (the ONLY exclusions)", () => {
    expect(SENSITIVE_QUERY_ROOTS.has("apiKeys")).toBe(true);
    expect(SENSITIVE_QUERY_ROOTS.has("byokKeys")).toBe(true);
    expect(SENSITIVE_QUERY_ROOTS.has("keySources")).toBe(true);
  });

  it("persists EVERY non-sensitive admin root — incl. the fleet/metrics roots that used to skeleton", () => {
    for (const root of [
      // fleet / metrics page (the /metrics?view=revenue skeleton these caused)
      "fleetRevenue", "activeUsersHistory", "auditAccounts", "activeUsersByUser",
      // cross-org feature-stats aggregates
      "crossOrgCostProjection", "crossOrgLifetime", "crossOrgTrend", "crossOrgWorkflowCost",
      // config / registries / metadata
      "features", "feature", "statsRegistry", "entityRegistry", "platformPrices",
      "billingAccount", "brand", "brands", "brandExtractedFields",
      "campaign", "campaigns", "featureStats", "campaignStats",
      "workflow", "workflows", "workflow-summary", "googleAccounts",
      // credit grants + big lists (denylist persists them too — admin is staff-only)
      "creditGrants", "creditGrantsAll", "brandLeads", "brandEmails",
      "enrichedJournalists", "brandOutlets",
      // a brand-new root a future admin page adds auto-persists (zero allowlist maintenance)
      "someBrandNewAdminQuery",
    ]) {
      expect(shouldPersistQuery(q("success", [root, "x"])), root).toBe(true);
    }
  });

  it("an empty/absent root never persists (defensive)", () => {
    expect(shouldPersistQuery(q("success", []))).toBe(false);
    expect(shouldPersistQuery(q("success", [""]))).toBe(false);
  });
});

describe("isPersistableQueryKey — STATUS-AGNOSTIC predicate (the per-query persister gate)", () => {
  // REGRESSION: the per-query persister evaluates this ONCE while the query is still
  // `pending` (data undefined) and reuses the verdict for BOTH restore and persist.
  // A status check here ⇒ false at restore time ⇒ the persister is a silent total
  // no-op (every load cold-fetches the Neon chain). So it MUST ignore status.
  it("matches a non-sensitive key regardless of status (pending must still match)", () => {
    expect(isPersistableQueryKey(["fleetRevenue"])).toBe(true);
    expect(isPersistableQueryKey(["brand", "b1"])).toBe(true);
    // The bug: shouldPersistQuery (status-aware) is FALSE on a pending query — which
    // is exactly the state at restore time — so it must NOT be the persister predicate.
    expect(shouldPersistQuery(q("pending", ["fleetRevenue"]))).toBe(false);
    expect(isPersistableQueryKey(["fleetRevenue"])).toBe(true);
  });

  it("excludes secrets and empty roots (key-only, no status)", () => {
    for (const root of SENSITIVE_QUERY_ROOTS) {
      expect(isPersistableQueryKey([root, "x"])).toBe(false);
    }
    expect(isPersistableQueryKey([])).toBe(false);
    expect(isPersistableQueryKey([""])).toBe(false);
  });
});

describe("persisterStorageKey — bucket-scoped (org pages) / platform (fleet pages)", () => {
  it("scopes the storage key to the URL org id on an org page (DIS-143)", () => {
    expect(persisterStorageKey("org_123")).toBe("distribute-admin-cache:org_123");
  });

  it("falls back to the stable `platform` bucket for cross-org fleet pages", () => {
    expect(persisterStorageKey(null)).toBe("distribute-admin-cache:platform");
    expect(persisterStorageKey(undefined)).toBe("distribute-admin-cache:platform");
  });

  it("two different orgs never share a bucket", () => {
    expect(persisterStorageKey("org_A")).not.toBe(persisterStorageKey("org_B"));
  });

  it("is a SEPARATE keyspace from the customer dashboard cache", () => {
    expect(persisterStorageKey("org_A")).not.toContain("distribute-dashboard-cache");
  });
});

describe("persistCacheVersion — manual cache buster (NOT the commit SHA)", () => {
  it("is a stable string that does NOT read the git commit SHA / build env", () => {
    const prev = {
      sha: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
      build: process.env.NEXT_PUBLIC_BUILD_ID,
    };
    // A different deploy SHA must NOT change the buster — that was the bug: the SHA
    // flips every deploy, wiping the disk cache on ~every visit.
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA = "sha-aaaa";
    const v1 = persistCacheVersion();
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA = "sha-bbbb";
    const v2 = persistCacheVersion();
    expect(v1).toBe(v2);
    expect(v1).not.toContain("sha-");
    expect(v1.length).toBeGreaterThan(0);
    if (prev.sha !== undefined) process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA = prev.sha;
    else delete process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
    if (prev.build !== undefined) process.env.NEXT_PUBLIC_BUILD_ID = prev.build;
  });
});

describe("query-provider wiring — local-first per-query persisted cache", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "../src/lib/query-provider.tsx"),
    "utf-8",
  );

  it("uses the PER-QUERY persister (createQueryPersister), not the whole-client one", () => {
    expect(src).toContain("experimental_createQueryPersister");
    expect(src).not.toContain("PersistQueryClientProvider");
    expect(src).toContain("persister.persisterFn");
  });

  it("wires it as a default query option in a plain QueryClientProvider", () => {
    expect(src).toContain("<QueryClientProvider");
    expect(src).toContain("persister: persister.persisterFn");
  });

  it("stores in IndexedDB (idb-keyval), NOT localStorage (no ~5MB cap, off main thread)", () => {
    expect(src).toContain("idb-keyval");
    expect(src).not.toContain("localStorage");
    expect(src).not.toContain("createSyncStoragePersister");
    expect(src).not.toContain("removeOldestQuery");
  });

  it("no-ops the persister storage on the server (no window)", () => {
    expect(src).toContain('typeof window !== "undefined"');
    expect(src).toContain("persistEnabled ? idbStorage : undefined");
  });

  it("keeps disk forever (maxAge Infinity) while bounding memory (gcTime) separately", () => {
    expect(src).toContain("maxAge: PERSIST_MAX_AGE_MS");
    expect(src).toContain("gcTime: PERSIST_GC_TIME_MS");
  });

  it("busts on a MANUAL version bump (not per-deploy) and bucket-scopes the key prefix", () => {
    expect(src).toContain("buster: persistCacheVersion()");
    expect(src).not.toContain("cacheBuildId");
    expect(src).toContain("prefix: persisterStorageKey(bucket)");
  });

  it("uses a STATUS-AGNOSTIC predicate (isPersistableQueryKey), NOT the status-aware one", () => {
    expect(src).toContain("predicate");
    expect(src).toContain("isPersistableQueryKey(query.queryKey)");
    expect(src).not.toContain("shouldPersistQuery");
  });

  it("requests persistent storage + reseeds cold queries from disk on navigation", () => {
    expect(src).toContain("requestPersistentStorage");
    expect(src).toContain("reseedColdQueriesFromDisk");
  });

  it("keeps the global SWR defaults intact (keepPreviousData, silent refetch)", () => {
    expect(src).toContain("placeholderData: keepPreviousData");
    expect(src).toContain("refetchOnWindowFocus: true");
  });
});

describe("cache retention durations", () => {
  it("maxAge is Infinity — disk entries never expire (local-first, instant cross-session)", () => {
    expect(PERSIST_MAX_AGE_MS).toBe(Infinity);
  });

  it("gcTime is 30 min — bounds MEMORY only (disk is independent via per-query persister)", () => {
    expect(PERSIST_GC_TIME_MS).toBe(30 * 60 * 1000);
  });
});

describe("coldRestorablePairs — nav-time reseed picks only cold, current, this-bucket snapshots", () => {
  const noneWarm = () => false; // nothing in memory → every eligible entry is cold

  it("restores a current-buster, data-bearing snapshot when the query is cold", () => {
    const pairs = coldRestorablePairs(
      [entry(["fleetRevenue"], { total: 42 }, { dataUpdatedAt: 1234 })],
      PREFIX,
      V,
      noneWarm,
    );
    expect(pairs).toEqual([
      { queryKey: ["fleetRevenue"], data: { total: 42 }, updatedAt: 1234 },
    ]);
  });

  it("COLD-GUARD: skips a query that already holds in-memory data (never stomps fresher memory)", () => {
    const warm = (key: readonly unknown[]) => key[0] === "fleetRevenue";
    const pairs = coldRestorablePairs(
      [
        entry(["fleetRevenue"], { total: "STALE" }),
        entry(["auditAccounts"], [{ id: "a1" }]),
      ],
      PREFIX,
      V,
      warm,
    );
    expect(pairs.map((p) => p.queryKey[0])).toEqual(["auditAccounts"]); // fleetRevenue skipped
  });

  it("skips a busted (wrong-version) snapshot — never paints stale-shaped data", () => {
    const pairs = coldRestorablePairs(
      [entry(["fleetRevenue"], { total: 0 }, { buster: "OLD" })],
      PREFIX,
      V,
      noneWarm,
    );
    expect(pairs).toEqual([]);
  });

  it("skips an entry under a DIFFERENT bucket's prefix — cross-org isolation (DIS-143)", () => {
    const otherPrefix = persisterStorageKey("org_2");
    const pairs = coldRestorablePairs(
      [entry(["brand", "b1"], { brand: {} }, { prefix: otherPrefix })],
      PREFIX,
      V,
      noneWarm,
    );
    expect(pairs).toEqual([]);
  });

  it("skips a snapshot with undefined data and a corrupt (unparseable) value", () => {
    const pairs = coldRestorablePairs(
      [
        entry(["fleetRevenue"], undefined),
        [`${PREFIX}-["auditAccounts"]`, "{not-json"],
      ],
      PREFIX,
      V,
      noneWarm,
    );
    expect(pairs).toEqual([]);
  });
});
