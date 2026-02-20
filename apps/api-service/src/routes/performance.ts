import { Router } from "express";
import { callExternalService, externalServices } from "../lib/service-client.js";
import { getWorkflowCategory, getWorkflowDisplayName, type WorkflowCategory } from "@mcpfactory/content";

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

interface WorkflowEntry {
  workflowName: string;
  displayName: string;
  category: WorkflowCategory | null;
  runCount: number;
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
  workflows: WorkflowEntry[];
  hero: unknown;
  updatedAt: string;
  availableCategories: WorkflowCategory[];
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

  // Fetch aggregate stats for workflow leaderboard using appId filter
  const aggregateStats = await fetchBroadcastDeliveryStats({ appId: "mcpfactory" });

  if (aggregateStats.emailsSent > 0 && data.workflows.length > 0) {
    // Distribute delivery stats across workflows proportionally by cost
    const totalWorkflowCost = data.workflows.reduce((s, w) => s + w.totalCostUsdCents, 0);

    for (const wf of data.workflows) {
      const ratio = totalWorkflowCost > 0 ? wf.totalCostUsdCents / totalWorkflowCost : 1 / data.workflows.length;
      const wfStats: DeliveryStats = {
        emailsSent: Math.round(aggregateStats.emailsSent * ratio),
        emailsOpened: Math.round(aggregateStats.emailsOpened * ratio),
        emailsClicked: Math.round(aggregateStats.emailsClicked * ratio),
        emailsReplied: Math.round(aggregateStats.emailsReplied * ratio),
        emailsBounced: Math.round(aggregateStats.emailsBounced * ratio),
      };
      applyStatsToEntry(wf, wfStats);
    }

    // Recompute hero stats
    const withConversion = data.workflows.map((w) => ({
      workflowName: w.workflowName,
      conversionRate: w.emailsSent > 0 ? (w.emailsClicked + w.emailsReplied) / w.emailsSent : 0,
      conversionsPerDollar:
        w.totalCostUsdCents > 0
          ? ((w.emailsClicked + w.emailsReplied) / w.totalCostUsdCents) * 100
          : 0,
    }));

    const bestConversion = withConversion.reduce((a, b) => (a.conversionRate > b.conversionRate ? a : b));
    const bestValue = withConversion.reduce((a, b) => (a.conversionsPerDollar > b.conversionsPerDollar ? a : b));

    data.hero = {
      bestConversionWorkflow: {
        workflowName: bestConversion.workflowName,
        conversionRate: Math.round(bestConversion.conversionRate * 10000) / 10000,
      },
      bestValueWorkflow: {
        workflowName: bestValue.workflowName,
        conversionsPerDollar: Math.round(bestValue.conversionsPerDollar * 100) / 100,
      },
    };
  }
}

/** Get all brands across all orgs from brand-service.
 *  This is more reliable than /campaigns/list which only returns ongoing campaigns. */
async function fetchAllBrands(): Promise<Array<{ id: string; domain: string | null; name: string | null; brandUrl: string | null }>> {
  // Get all clerk org IDs from brand-service (response uses snake_case field name)
  const resp = await callExternalService<{ clerk_organization_ids: string[] }>(
    externalServices.brand, "/clerk-ids"
  );
  const clerkOrgIds = resp.clerk_organization_ids;

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

/** Response shape from runs-service /v1/stats/public/leaderboard (costs are strings). */
interface RunsStatsGroup {
  dimensions: Record<string, string>;
  totalCostInUsdCents: string;
  actualCostInUsdCents: string;
  provisionedCostInUsdCents: string;
  cancelledCostInUsdCents: string;
  runCount: number;
}

/** Build leaderboard data from brand-service + runs-service public endpoint.
 *  Uses brand-service for brands, runs-service for costs + workflows. */
async function buildLeaderboardData(): Promise<LeaderboardData> {
  // 1. Get brands + workflow stats + brand costs in parallel
  const [allBrands, workflowStatsResult, brandCosts] = await Promise.all([
    fetchAllBrands(),
    // Workflow stats from runs-service public endpoint
    callExternalService<{ groups: RunsStatsGroup[] }>(
      externalServices.runs,
      "/v1/stats/public/leaderboard?appId=mcpfactory&groupBy=workflowName"
    ).catch((err) => {
      console.warn("Failed to fetch workflow stats:", err);
      return { groups: [] as RunsStatsGroup[] };
    }),
    // Brand costs from runs-service public endpoint
    callExternalService<{ groups: RunsStatsGroup[] }>(
      externalServices.runs,
      "/v1/stats/public/leaderboard?appId=mcpfactory&groupBy=brandId"
    ).then((result) => {
      const costMap = new Map<string, number>();
      for (const g of result.groups || []) {
        if (g.dimensions.brandId) {
          costMap.set(g.dimensions.brandId, Math.round(parseFloat(g.actualCostInUsdCents) || 0));
        }
      }
      return costMap;
    }).catch((err) => {
      console.warn("Failed to fetch costs from runs-service:", err);
      return new Map<string, number>();
    }),
  ]);

  // 2. Build brand entries from brand-service data
  const brands: BrandEntry[] = allBrands.map((b) => ({
    brandId: b.id,
    brandUrl: b.brandUrl,
    brandDomain: b.domain,
    totalCostUsdCents: brandCosts.get(b.id) || 0,
    emailsSent: 0, emailsOpened: 0, emailsClicked: 0, emailsReplied: 0,
    openRate: 0, clickRate: 0, replyRate: 0,
    costPerOpenCents: null, costPerClickCents: null, costPerReplyCents: null,
  }));

  // 3. Build workflow entries directly from runs-service data (no proportional distribution)
  const workflows: WorkflowEntry[] = (workflowStatsResult.groups || []).map((g) => {
    const name = g.dimensions.workflowName || "unknown";
    return {
      workflowName: name,
      displayName: getWorkflowDisplayName(name),
      category: getWorkflowCategory(name),
      runCount: g.runCount || 0,
      totalCostUsdCents: Math.round(parseFloat(g.actualCostInUsdCents) || 0),
      emailsSent: 0, emailsOpened: 0, emailsClicked: 0, emailsReplied: 0,
      openRate: 0, clickRate: 0, replyRate: 0,
      costPerOpenCents: null, costPerClickCents: null, costPerReplyCents: null,
    };
  });

  const availableCategories = [...new Set(
    workflows.map((w) => w.category).filter((c): c is WorkflowCategory => c !== null)
  )];

  return { brands, workflows, hero: null, updatedAt: new Date().toISOString(), availableCategories };
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
