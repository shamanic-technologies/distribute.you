import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  shouldPersistQuery,
  persisterStorageKey,
  cacheBuildId,
  PERSIST_MAX_AGE_MS,
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

  it("persists only allowlisted small / slow-changing roots", () => {
    for (const root of [
      "features", "feature", "brand", "brands", "campaign", "campaigns",
      "featureStats", "campaignStats", "billingAccount", "platformPrices",
      "workflow", "workflows",
    ]) {
      expect(shouldPersistQuery(q("success", [root, "x"])), root).toBe(true);
    }
  });

  it("NEVER persists big / 5s-polled list roots (memory + dehydrate main-thread cost, #9775)", () => {
    for (const root of [
      "brandLeads", "campaignLeads", "brandEmails", "campaignEmails",
      "enrichedJournalists", "brandOutlets", "campaignOutlets", "brandArticles",
      "rankedOpportunities", "quotePitches", "featureQuotePitches", "quoteRequests",
      "campaignMediaKits", "mediaKit", "visibilityRuns", "campaignRuns",
      "campaignEvents", "orgCostBreakdown", "salesWorkflowTests",
    ]) {
      expect(shouldPersistQuery(q("success", [root, "x"])), root).toBe(false);
    }
  });

  it("default-off: an unlisted root never persists (a future big query can't melt perf)", () => {
    expect(shouldPersistQuery(q("success", ["someBrandNewQuery", "x"]))).toBe(false);
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

describe("cacheBuildId — deploy buster", () => {
  it("falls back to `dev` when no build env var is set", () => {
    const prev = {
      sha: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
      build: process.env.NEXT_PUBLIC_BUILD_ID,
    };
    delete process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA;
    delete process.env.NEXT_PUBLIC_BUILD_ID;
    expect(cacheBuildId()).toBe("dev");
    if (prev.sha !== undefined) process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA = prev.sha;
    if (prev.build !== undefined) process.env.NEXT_PUBLIC_BUILD_ID = prev.build;
  });
});

describe("query-provider wiring — persisted cache", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "../src/lib/query-provider.tsx"),
    "utf-8",
  );

  it("wraps children in PersistQueryClientProvider, not a bare QueryClientProvider", () => {
    expect(src).toContain("PersistQueryClientProvider");
    expect(src).not.toContain("<QueryClientProvider");
  });

  it("uses the sync localStorage persister (SWR-style, synchronous restore)", () => {
    expect(src).toContain("createSyncStoragePersister");
    expect(src).toContain("window.localStorage");
    // SSR guard so the persister is a no-op on the server (no window).
    expect(src).toContain('typeof window !== "undefined"');
  });

  it("survives the 5MB localStorage cap via removeOldestQuery (never throws)", () => {
    expect(src).toContain("removeOldestQuery");
  });

  it("gcTime equals the persister maxAge (TanStack rule: gcTime >= maxAge)", () => {
    expect(src).toContain("gcTime: PERSIST_MAX_AGE_MS");
    expect(src).toContain("maxAge: PERSIST_MAX_AGE_MS");
  });

  it("busts the cache per deploy and scopes the bucket per org", () => {
    expect(src).toContain("buster: cacheBuildId()");
    expect(src).toContain("persisterStorageKey(orgId)");
  });

  it("only persists successful, non-sensitive queries", () => {
    expect(src).toContain("shouldDehydrateQuery: shouldPersistQuery");
  });

  it("keeps the global SWR defaults intact (keepPreviousData, silent refetch)", () => {
    expect(src).toContain("placeholderData: keepPreviousData");
    expect(src).toContain("refetchOnWindowFocus: true");
  });
});

describe("PERSIST_MAX_AGE_MS", () => {
  it("is 30 minutes — bounds in-memory retention (was 24h, the #1273 overflow)", () => {
    expect(PERSIST_MAX_AGE_MS).toBe(30 * 60 * 1000);
  });
});
