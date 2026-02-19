import { Router } from "express";
import { callExternalService, externalServices, callService, services } from "../lib/service-client.js";

const router = Router();

interface DeliveryStats {
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  emailsReplied: number;
  emailsBounced: number;
}

const EMPTY_STATS: DeliveryStats = {
  emailsSent: 0,
  emailsOpened: 0,
  emailsClicked: 0,
  emailsReplied: 0,
  emailsBounced: 0,
};

interface BrandEntry {
  brandId: string | null;
  brandUrl: string | null;
  brandDomain: string | null;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  emailsReplied: number;
  totalCostUsdCents: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  costPerOpenCents: number | null;
  costPerClickCents: number | null;
  costPerReplyCents: number | null;
}

interface ModelEntry {
  model: string;
  emailsGenerated: number;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  emailsReplied: number;
  totalCostUsdCents: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  costPerOpenCents: number | null;
  costPerClickCents: number | null;
  costPerReplyCents: number | null;
}

interface LeaderboardData {
  brands: BrandEntry[];
  models: ModelEntry[];
  hero: unknown;
  updatedAt: string;
}

/** Fetch broadcast delivery stats from the unified email-sending service.
 *  Only uses broadcast stats (outreach emails via Instantly).
 *  Transactional stats are lifecycle/test emails via Postmark — not relevant. */
async function fetchBroadcastDeliveryStats(filters: Record<string, string>): Promise<DeliveryStats> {
  try {
    const result = await callExternalService<{
      transactional: { emailsSent: number; emailsOpened: number; emailsClicked: number; emailsReplied: number; emailsBounced: number };
      broadcast: { emailsSent: number; emailsOpened: number; emailsClicked: number; emailsReplied: number; emailsBounced: number };
    }>(
      externalServices.emailSending,
      "/stats",
      { method: "POST", body: filters }
    );

    const b = result.broadcast;
    if (!b) return EMPTY_STATS;

    return {
      emailsSent: b.emailsSent || 0,
      emailsOpened: b.emailsOpened || 0,
      emailsClicked: b.emailsClicked || 0,
      emailsReplied: b.emailsReplied || 0,
      emailsBounced: b.emailsBounced || 0,
    };
  } catch {
    return EMPTY_STATS;
  }
}

function applyStatsToEntry(
  entry: { emailsSent: number; emailsOpened: number; emailsClicked: number; emailsReplied: number; totalCostUsdCents: number; openRate: number; clickRate: number; replyRate: number; costPerOpenCents: number | null; costPerClickCents: number | null; costPerReplyCents: number | null },
  stats: DeliveryStats
) {
  entry.emailsSent = stats.emailsSent;
  entry.emailsOpened = stats.emailsOpened;
  entry.emailsClicked = stats.emailsClicked;
  entry.emailsReplied = stats.emailsReplied;

  const sent = stats.emailsSent;
  entry.openRate = sent > 0 ? Math.round((stats.emailsOpened / sent) * 10000) / 10000 : 0;
  entry.clickRate = sent > 0 ? Math.round((stats.emailsClicked / sent) * 10000) / 10000 : 0;
  entry.replyRate = sent > 0 ? Math.round((stats.emailsReplied / sent) * 10000) / 10000 : 0;

  const cost = entry.totalCostUsdCents;
  entry.costPerOpenCents = stats.emailsOpened > 0 ? Math.round(cost / stats.emailsOpened) : null;
  entry.costPerClickCents = stats.emailsClicked > 0 ? Math.round(cost / stats.emailsClicked) : null;
  entry.costPerReplyCents = stats.emailsReplied > 0 ? Math.round(cost / stats.emailsReplied) : null;
}

/**
 * Enrich leaderboard email stats from the unified email-sending service.
 * Uses brandId and appId filters directly — no need to fetch campaigns or runs.
 */
async function enrichWithDeliveryStats(data: LeaderboardData): Promise<void> {
  // Fetch broadcast-only delivery stats per brand using brandId filter
  await Promise.all(
    data.brands.map(async (brand) => {
      if (!brand.brandId) {
        return;
      }

      const stats = await fetchBroadcastDeliveryStats({ brandId: brand.brandId, appId: "mcpfactory" });
      if (stats.emailsSent === 0) return;
      applyStatsToEntry(brand, stats);
    })
  );

  // Fetch aggregate stats for model leaderboard using appId filter
  const aggregateStats = await fetchBroadcastDeliveryStats({ appId: "mcpfactory" });

  if (aggregateStats.emailsSent > 0 && data.models.length > 0) {
    // Distribute delivery stats across models proportionally by emailsGenerated
    const totalGenerated = data.models.reduce((s, m) => s + m.emailsGenerated, 0);

    for (const model of data.models) {
      const ratio = totalGenerated > 0 ? model.emailsGenerated / totalGenerated : 1 / data.models.length;
      const modelStats: DeliveryStats = {
        emailsSent: Math.round(aggregateStats.emailsSent * ratio),
        emailsOpened: Math.round(aggregateStats.emailsOpened * ratio),
        emailsClicked: Math.round(aggregateStats.emailsClicked * ratio),
        emailsReplied: Math.round(aggregateStats.emailsReplied * ratio),
        emailsBounced: Math.round(aggregateStats.emailsBounced * ratio),
      };
      applyStatsToEntry(model, modelStats);
    }

    // Recompute hero stats
    const withConversion = data.models.map((m) => ({
      model: m.model,
      conversionRate: m.emailsSent > 0 ? (m.emailsClicked + m.emailsReplied) / m.emailsSent : 0,
      conversionsPerDollar:
        m.totalCostUsdCents > 0
          ? ((m.emailsClicked + m.emailsReplied) / m.totalCostUsdCents) * 100
          : 0,
    }));

    const bestConversion = withConversion.reduce((a, b) => (a.conversionRate > b.conversionRate ? a : b));
    const bestValue = withConversion.reduce((a, b) => (a.conversionsPerDollar > b.conversionsPerDollar ? a : b));

    data.hero = {
      bestConversionModel: {
        model: bestConversion.model,
        conversionRate: Math.round(bestConversion.conversionRate * 10000) / 10000,
      },
      bestValueModel: {
        model: bestValue.model,
        conversionsPerDollar: Math.round(bestValue.conversionsPerDollar * 100) / 100,
      },
    };
  }
}

/** Get all brands across all orgs from brand-service.
 *  This is more reliable than /campaigns/list which only returns ongoing campaigns. */
async function fetchAllBrands(): Promise<Array<{ id: string; domain: string | null; name: string | null; brandUrl: string | null }>> {
  // Get all clerk org IDs from brand-service
  const { clerkOrgIds } = await callExternalService<{ clerkOrgIds: string[] }>(
    externalServices.brand, "/clerk-ids"
  );

  if (!clerkOrgIds || clerkOrgIds.length === 0) return [];

  // Fetch brands for each org in parallel
  const brandArrays = await Promise.all(
    clerkOrgIds.map(async (clerkOrgId) => {
      try {
        const { brands } = await callExternalService<{
          brands: Array<{ id: string; domain: string | null; name: string | null; brandUrl: string | null }>;
        }>(externalServices.brand, `/brands?clerkOrgId=${encodeURIComponent(clerkOrgId)}`);
        return brands || [];
      } catch {
        return [];
      }
    })
  );

  // Deduplicate by brand ID
  const seen = new Set<string>();
  const allBrands: Array<{ id: string; domain: string | null; name: string | null; brandUrl: string | null }> = [];
  for (const arr of brandArrays) {
    for (const b of arr) {
      if (!seen.has(b.id)) {
        seen.add(b.id);
        allBrands.push(b);
      }
    }
  }
  return allBrands;
}

/** Build leaderboard data from brand-service + email-gateway + emailgen.
 *  Uses brand-service as the source of truth for brands (includes all statuses). */
async function buildLeaderboardData(): Promise<LeaderboardData> {
  // 1. Get all brands from brand-service and model stats from emailgen in parallel
  const [allBrands, modelStatsResult, campaignCosts] = await Promise.all([
    fetchAllBrands(),
    callService<{ stats: Array<{ model: string; count: number }> }>(
      services.emailgen, "/stats/by-model",
      { method: "POST", body: { appId: "mcpfactory" } }
    ).catch((err) => {
      console.warn("Failed to fetch model stats:", err);
      return { stats: [] };
    }),
    // Also try to get campaign costs (best-effort, /campaigns/list may only return ongoing)
    callExternalService<{
      campaigns: Array<{ id: string; brandId: string | null }>;
    }>(externalServices.campaign, "/campaigns/list").then(async ({ campaigns }) => {
      if (!campaigns || campaigns.length === 0) return new Map<string, number>();
      const ids = campaigns.map((c) => c.id);
      const batchResp = await callExternalService<{
        results: Record<string, { totalCostInUsdCents: string | null }>;
      }>(externalServices.campaign, "/campaigns/batch-budget-usage", {
        method: "POST",
        body: { campaignIds: ids },
      });
      // Group costs by brandId
      const costMap = new Map<string, number>();
      for (const c of campaigns) {
        if (!c.brandId) continue;
        const cents = parseFloat(batchResp.results?.[c.id]?.totalCostInUsdCents || "0") || 0;
        costMap.set(c.brandId, (costMap.get(c.brandId) || 0) + cents);
      }
      return costMap;
    }).catch((err) => {
      console.warn("Failed to fetch campaign costs:", err);
      return new Map<string, number>();
    }),
  ]);

  // 2. Build brand entries from brand-service data
  const brands: BrandEntry[] = allBrands.map((b) => ({
    brandId: b.id,
    brandUrl: b.brandUrl,
    brandDomain: b.domain,
    totalCostUsdCents: campaignCosts.get(b.id) || 0,
    emailsSent: 0, emailsOpened: 0, emailsClicked: 0, emailsReplied: 0,
    openRate: 0, clickRate: 0, replyRate: 0,
    costPerOpenCents: null, costPerClickCents: null, costPerReplyCents: null,
  }));

  // 3. Build model entries
  const modelStats = modelStatsResult.stats || [];
  const totalCostAllBrands = brands.reduce((s, b) => s + b.totalCostUsdCents, 0);
  const totalGenerated = modelStats.reduce((s, m) => s + m.count, 0);

  const models: ModelEntry[] = modelStats.map((m) => ({
    model: m.model,
    emailsGenerated: m.count,
    totalCostUsdCents: totalGenerated > 0 && totalCostAllBrands > 0
      ? Math.round(totalCostAllBrands * (m.count / totalGenerated))
      : 0,
    emailsSent: 0, emailsOpened: 0, emailsClicked: 0, emailsReplied: 0,
    openRate: 0, clickRate: 0, replyRate: 0,
    costPerOpenCents: null, costPerClickCents: null, costPerReplyCents: null,
  }));

  return { brands, models, hero: null, updatedAt: new Date().toISOString() };
}

// Public route — no auth required
router.get("/performance/leaderboard", async (req, res) => {
  try {
    const data = await buildLeaderboardData();

    // Enrich with broadcast delivery stats from email-sending service
    try {
      await enrichWithDeliveryStats(data);
    } catch (err) {
      console.warn("Failed to enrich leaderboard with delivery stats:", err);
    }

    res.json(data);
  } catch (error) {
    console.error("Performance leaderboard build error:", error);
    res.status(502).json({ error: "Failed to build leaderboard data" });
  }
});

export default router;
