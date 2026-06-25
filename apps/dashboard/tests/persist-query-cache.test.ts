import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  shouldPersistQuery,
  isPersistableQueryKey,
  persisterStorageKey,
  persistCacheVersion,
  PERSIST_MAX_AGE_MS,
  PERSIST_GC_TIME_MS,
  SENSITIVE_QUERY_ROOTS,
  type PersistableQuery,
} from "../src/lib/persist-cache";

const q = (status: string, key: readonly unknown[]): PersistableQuery => ({
  state: { status },
  queryKey: key,
});

describe("shouldPersistQuery — only successful, non-sensitive queries persist", () => {
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

  it("treats apiKeys / byokKeys / keySources as sensitive", () => {
    expect(SENSITIVE_QUERY_ROOTS.has("apiKeys")).toBe(true);
    expect(SENSITIVE_QUERY_ROOTS.has("byokKeys")).toBe(true);
    expect(SENSITIVE_QUERY_ROOTS.has("keySources")).toBe(true);
  });

  it("persists EVERY live non-sensitive root (persist-all-live policy — no reload skeleton)", () => {
    for (const root of [
      // config / registries
      "features", "feature", "statsRegistry", "entityRegistry", "platformPrices", "billingAccount",
      // brand metadata + config
      "brand", "brands", "brandProfile", "brandExtractedFields", "brandSalesEconomics",
      "brandDailyBudget", "brandPause", "brandCostBreakdown", "brandCostBreakdownToday",
      // brand entity sub-lists (big — now persisted too)
      "brandLeads", "brandEmails", "brandOutlets", "brandArticles", "brandJournalists",
      "enrichedJournalists", "brandRuns", "brandMediaKits", "mediaKit",
      // feature-level
      "featureStats", "featureRevenue", "featurePipelineActivity", "featureAudienceStats",
      "featureWorkflows", "featureQuotePitches",
      // opportunities / pitches / audiences
      "rankedOpportunities", "quotePitches", "audiences",
      // workflows
      "workflow", "workflows", "workflow-summary", "workflow-key-status",
      "workflowProjection", "globalRankedWorkflows",
      // outlet stats / campaign launch-modal / visibility / domain metrics
      "outletStatsCosts", "campaign", "campaigns", "campaignLeads", "campaignActivity",
      "visibilityRuns", "visibilityRun",
      "domainTrafficHistory", "domainDrStatus", "domainAiVisibility",
    ]) {
      expect(shouldPersistQuery(q("success", [root, "x"])), root).toBe(true);
    }
  });

  it("never persists dead roots removed from the dashboard (no live consumer)", () => {
    // Removed with the #1768 campaign-UI flatten + earlier surfaces — must not linger.
    for (const root of [
      "campaignStats", "campaignEmails", "campaignOutlets", "campaignRuns",
      "campaignEvents", "campaignMediaKits", "quoteRequests", "orgCostBreakdown",
      "salesWorkflowTests",
    ]) {
      expect(shouldPersistQuery(q("success", [root, "x"])), root).toBe(false);
    }
  });

  it("default-off: an unlisted root never persists (a future big query can't melt perf)", () => {
    expect(shouldPersistQuery(q("success", ["someBrandNewQuery", "x"]))).toBe(false);
  });
});

describe("isPersistableQueryKey — STATUS-AGNOSTIC predicate (the per-query persister gate)", () => {
  // REGRESSION: the per-query persister evaluates this ONCE while the query is still
  // `pending` (data undefined) and reuses the verdict for BOTH restore and persist.
  // A status check here ⇒ false at restore time ⇒ the persister is a silent total
  // no-op (every load cold-fetches the 30s Neon chain). So it MUST ignore status.
  it("matches an allowlisted key regardless of status (pending must still match)", () => {
    expect(isPersistableQueryKey(["featureRevenue", "b1", "slug"])).toBe(true);
    expect(isPersistableQueryKey(["brand", "b1"])).toBe(true);
    // The bug: shouldPersistQuery (status-aware) is FALSE on a pending query — which
    // is exactly the state at restore time — so it must NOT be the persister predicate.
    expect(shouldPersistQuery(q("pending", ["featureRevenue", "b1"]))).toBe(false);
    expect(isPersistableQueryKey(["featureRevenue", "b1"])).toBe(true);
  });

  it("excludes secrets and unlisted roots (key-only, no status)", () => {
    for (const root of SENSITIVE_QUERY_ROOTS) {
      expect(isPersistableQueryKey([root, "x"])).toBe(false);
    }
    expect(isPersistableQueryKey(["someBrandNewQuery", "x"])).toBe(false);
  });
});

describe("persisterStorageKey — org-scoped bucket (DIS-143 cross-org isolation)", () => {
  it("scopes the storage key to the org id", () => {
    expect(persisterStorageKey("org_123")).toBe("distribute-dashboard-cache:org_123");
  });

  it("falls back to an empty `anon` bucket before the org resolves", () => {
    expect(persisterStorageKey(null)).toBe("distribute-dashboard-cache:anon");
    expect(persisterStorageKey(undefined)).toBe("distribute-dashboard-cache:anon");
  });

  it("two different orgs never share a bucket", () => {
    expect(persisterStorageKey("org_A")).not.toBe(persisterStorageKey("org_B"));
  });
});

describe("persistCacheVersion — manual cache buster (NOT the commit SHA)", () => {
  it("is a stable string that does NOT read the git commit SHA / build env", () => {
    const prev = {
      sha: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
      build: process.env.NEXT_PUBLIC_BUILD_ID,
    };
    // A different deploy SHA must NOT change the buster — that was the bug: the
    // SHA flips every deploy, wiping the disk cache on ~every visit (#2074 defeat).
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
    // Per-query persistence writes each query separately on change (no whole-cache
    // re-serialize per 5s poll = no main-thread jank) and decouples disk retention
    // from gcTime (so maxAge can be Infinity without pinning the heap).
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

  it("no-ops the persister storage while orgId is null / on the server (no anon bleed)", () => {
    // No org / no window → storage undefined → nothing persists under a shared bucket.
    expect(src).toContain('typeof window !== "undefined"');
    expect(src).toContain("persistEnabled ? idbStorage : undefined");
  });

  it("keeps disk forever (maxAge Infinity) while bounding memory (gcTime) separately", () => {
    expect(src).toContain("maxAge: PERSIST_MAX_AGE_MS");
    expect(src).toContain("gcTime: PERSIST_GC_TIME_MS");
  });

  it("busts on a MANUAL version bump (not per-deploy) and org-scopes the key prefix", () => {
    expect(src).toContain("buster: persistCacheVersion()");
    expect(src).not.toContain("cacheBuildId");
    expect(src).toContain("prefix: persisterStorageKey(orgId)");
  });

  it("uses a STATUS-AGNOSTIC predicate (isPersistableQueryKey), NOT the status-aware one", () => {
    // shouldPersistQuery requires status==="success" → false at restore time (pending)
    // → the persister becomes a silent no-op. The predicate must key off the query key.
    expect(src).toContain("predicate");
    expect(src).toContain("isPersistableQueryKey(query.queryKey)");
    expect(src).not.toContain("shouldPersistQuery");
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
