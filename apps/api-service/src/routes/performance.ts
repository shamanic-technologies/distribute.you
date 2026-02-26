import { Router } from "express";
import { callExternalService, externalServices } from "../lib/service-client.js";
import { getWorkflowCategory, getWorkflowDisplayName, getSectionKey, getSignatureName, SECTION_LABELS, type WorkflowCategory } from "@mcpfactory/content";

const router = Router();

interface DeliveryStats {
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  emailsReplied: number;
  emailsBounced: number;
  repliesInterested: number;
}

const EMPTY_STATS: DeliveryStats = {
  emailsSent: 0,
  emailsOpened: 0,
  emailsClicked: 0,
  emailsReplied: 0,
  emailsBounced: 0,
  repliesInterested: 0,
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
  signatureName: string | null;
  category: WorkflowCategory | null;
  sectionKey: string | null;
  runCount: number;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  emailsReplied: number;
  repliesInterested: number;
  totalCostUsdCents: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  interestedRate: number;
  costPerOpenCents: number | null;
  costPerClickCents: number | null;
  costPerReplyCents: number | null;
}

interface CategorySectionStats {
  emailsSent: number;
  emailsOpened: number;
  emailsReplied: number;
  repliesInterested: number;
  totalCostUsdCents: number;
  openRate: number;
  replyRate: number;
  interestedRate: number;
  costPerOpenCents: number | null;
  costPerReplyCents: number | null;
}

interface CategorySection {
  category: WorkflowCategory;
  sectionKey: string;
  label: string;
  stats: CategorySectionStats;
  workflows: WorkflowEntry[];
  brands: BrandEntry[];
}

interface LeaderboardData {
  brands: BrandEntry[];
  workflows: WorkflowEntry[];
  hero: unknown;
  updatedAt: string;
  availableCategories: WorkflowCategory[];
  categorySections: CategorySection[];
}

interface BroadcastStatsResponse {
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  emailsReplied: number;
  emailsBounced: number;
  repliesWillingToMeet: number;
  repliesInterested: number;
  repliesNotInterested: number;
  repliesOutOfOffice: number;
  repliesUnsubscribe: number;
}

function toBroadcastDeliveryStats(b: BroadcastStatsResponse | undefined | null): DeliveryStats {
  if (!b) return EMPTY_STATS;
  return {
    emailsSent: b.emailsSent || 0,
    emailsOpened: b.emailsOpened || 0,
    emailsClicked: b.emailsClicked || 0,
    emailsReplied: b.emailsReplied || 0,
    emailsBounced: b.emailsBounced || 0,
    repliesInterested: (b.repliesWillingToMeet || 0) + (b.repliesInterested || 0),
  };
}

/** Fetch broadcast delivery stats from the unified email-sending service.
 *  Only uses broadcast stats (outreach emails via Instantly).
 *  Transactional stats are lifecycle/test emails via Postmark — not relevant. */
async function fetchBroadcastDeliveryStats(filters: Record<string, string>): Promise<DeliveryStats> {
  try {
    const result = await callExternalService<{
      transactional: BroadcastStatsResponse;
      broadcast: BroadcastStatsResponse;
    }>(
      externalServices.emailSending,
      "/stats",
      { method: "POST", body: filters }
    );

    return toBroadcastDeliveryStats(result.broadcast);
  } catch {
    return EMPTY_STATS;
  }
}

/** Fetch broadcast delivery stats grouped by workflow name. Returns a map of workflowName → stats. */
async function fetchWorkflowDeliveryStats(): Promise<Map<string, DeliveryStats>> {
  try {
    const result = await callExternalService<{
      groups: Array<{ key: string; broadcast: BroadcastStatsResponse }>;
    }>(
      externalServices.emailSending,
      "/stats",
      { method: "POST", body: { appId: "mcpfactory", type: "broadcast", groupBy: "workflowName" } }
    );

    const map = new Map<string, DeliveryStats>();
    for (const group of result.groups || []) {
      if (group.key) {
        map.set(group.key, toBroadcastDeliveryStats(group.broadcast));
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

function applyStatsToBrand(brand: BrandEntry, stats: DeliveryStats) {
  brand.emailsSent = stats.emailsSent;
  brand.emailsOpened = stats.emailsOpened;
  brand.emailsClicked = stats.emailsClicked;
  brand.emailsReplied = stats.emailsReplied;

  const sent = stats.emailsSent;
  brand.openRate = sent > 0 ? Math.round((stats.emailsOpened / sent) * 10000) / 10000 : 0;
  brand.clickRate = sent > 0 ? Math.round((stats.emailsClicked / sent) * 10000) / 10000 : 0;
  brand.replyRate = sent > 0 ? Math.round((stats.emailsReplied / sent) * 10000) / 10000 : 0;

  const cost = brand.totalCostUsdCents;
  brand.costPerOpenCents = stats.emailsOpened > 0 ? Math.round(cost / stats.emailsOpened) : null;
  brand.costPerClickCents = stats.emailsClicked > 0 ? Math.round(cost / stats.emailsClicked) : null;
  brand.costPerReplyCents = stats.emailsReplied > 0 ? Math.round(cost / stats.emailsReplied) : null;
}

function applyStatsToWorkflow(wf: WorkflowEntry, stats: DeliveryStats) {
  wf.emailsSent = stats.emailsSent;
  wf.emailsOpened = stats.emailsOpened;
  wf.emailsClicked = stats.emailsClicked;
  wf.emailsReplied = stats.emailsReplied;
  wf.repliesInterested = stats.repliesInterested;

  const sent = stats.emailsSent;
  wf.openRate = sent > 0 ? Math.round((stats.emailsOpened / sent) * 10000) / 10000 : 0;
  wf.clickRate = sent > 0 ? Math.round((stats.emailsClicked / sent) * 10000) / 10000 : 0;
  wf.replyRate = sent > 0 ? Math.round((stats.emailsReplied / sent) * 10000) / 10000 : 0;
  wf.interestedRate = sent > 0 ? Math.round((stats.repliesInterested / sent) * 10000) / 10000 : 0;

  const cost = wf.totalCostUsdCents;
  wf.costPerOpenCents = stats.emailsOpened > 0 ? Math.round(cost / stats.emailsOpened) : null;
  wf.costPerClickCents = stats.emailsClicked > 0 ? Math.round(cost / stats.emailsClicked) : null;
  wf.costPerReplyCents = stats.emailsReplied > 0 ? Math.round(cost / stats.emailsReplied) : null;
}

/**
 * Enrich leaderboard email stats from the unified email-sending service.
 * Uses per-brand stats via brandId filter and per-workflow stats via groupBy.
 */
async function enrichWithDeliveryStats(data: LeaderboardData): Promise<void> {
  // Fetch per-brand and per-workflow stats in parallel
  const [, workflowStatsMap] = await Promise.all([
    // Per-brand stats
    Promise.all(
      data.brands.map(async (brand) => {
        if (!brand.brandId) return;
        const stats = await fetchBroadcastDeliveryStats({ brandId: brand.brandId, appId: "mcpfactory" });
        if (stats.emailsSent === 0) return;
        applyStatsToBrand(brand, stats);
      })
    ),
    // Per-workflow stats via groupBy (single call instead of proportional distribution)
    fetchWorkflowDeliveryStats(),
  ]);

  // Apply exact per-workflow email stats
  let anyWorkflowEnriched = false;
  for (const wf of data.workflows) {
    const stats = workflowStatsMap.get(wf.workflowName);
    if (stats && stats.emailsSent > 0) {
      applyStatsToWorkflow(wf, stats);
      anyWorkflowEnriched = true;
    }
  }

  // Fallback: when per-workflow groupBy returns no data (old emails sent without workflowName),
  // fetch aggregate broadcast stats and distribute by cost share across workflows
  if (!anyWorkflowEnriched && data.workflows.length > 0) {
    const aggregateStats = await fetchBroadcastDeliveryStats({ appId: "mcpfactory" });
    if (aggregateStats.emailsSent > 0) {
      const totalCost = data.workflows.reduce((s, w) => s + w.totalCostUsdCents, 0);
      if (totalCost > 0) {
        for (const wf of data.workflows) {
          const share = wf.totalCostUsdCents / totalCost;
          const distributed: DeliveryStats = {
            emailsSent: Math.round(aggregateStats.emailsSent * share),
            emailsOpened: Math.round(aggregateStats.emailsOpened * share),
            emailsClicked: Math.round(aggregateStats.emailsClicked * share),
            emailsReplied: Math.round(aggregateStats.emailsReplied * share),
            emailsBounced: Math.round(aggregateStats.emailsBounced * share),
            repliesInterested: Math.round(aggregateStats.repliesInterested * share),
          };
          if (distributed.emailsSent > 0) {
            applyStatsToWorkflow(wf, distributed);
          }
        }
      }
    }
  }


  // Recompute hero stats: best $/open and $/reply across brands
  const brandsWithCostPerOpen = data.brands.filter((b) => b.costPerOpenCents !== null && b.costPerOpenCents > 0);
  const brandsWithCostPerReply = data.brands.filter((b) => b.costPerReplyCents !== null && b.costPerReplyCents > 0);

  if (brandsWithCostPerOpen.length > 0 || brandsWithCostPerReply.length > 0) {
    const bestOpen = brandsWithCostPerOpen.length > 0
      ? brandsWithCostPerOpen.reduce((a, b) => (a.costPerOpenCents! < b.costPerOpenCents! ? a : b))
      : null;
    const bestReply = brandsWithCostPerReply.length > 0
      ? brandsWithCostPerReply.reduce((a, b) => (a.costPerReplyCents! < b.costPerReplyCents! ? a : b))
      : null;

    data.hero = {
      bestCostPerOpen: bestOpen ? { brandDomain: bestOpen.brandDomain, costPerOpenCents: bestOpen.costPerOpenCents! } : null,
      bestCostPerReply: bestReply ? { brandDomain: bestReply.brandDomain, costPerReplyCents: bestReply.costPerReplyCents! } : null,
    };
  }
}

/** Get all brands across all orgs from brand-service.
 *  This is more reliable than /campaigns/list which only returns ongoing campaigns. */
async function fetchAllBrands(): Promise<Array<{ id: string; domain: string | null; name: string | null; brandUrl: string | null }>> {
  // Get all org IDs from brand-service
  const resp = await callExternalService<{ organization_ids: string[] }>(
    externalServices.brand, "/org-ids"
  );
  const orgIds = resp.organization_ids;

  if (!orgIds || orgIds.length === 0) return [];

  // Fetch brands for each org in parallel
  const brandArrays = await Promise.all(
    orgIds.map(async (orgId) => {
      try {
        const { brands } = await callExternalService<{
          brands: Array<{ id: string; domain: string | null; name: string | null; brandUrl: string | null }>;
        }>(externalServices.brand, `/brands?orgId=${encodeURIComponent(orgId)}`);
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
        signatureName: getSignatureName(name),
        category: getWorkflowCategory(name),
        sectionKey: getSectionKey(name),
        runCount: g.runCount || 0,
        totalCostUsdCents: Math.round(parseFloat(g.actualCostInUsdCents) || 0),
        emailsSent: 0, emailsOpened: 0, emailsClicked: 0, emailsReplied: 0, repliesInterested: 0,
        openRate: 0, clickRate: 0, replyRate: 0, interestedRate: 0,
        costPerOpenCents: null, costPerClickCents: null, costPerReplyCents: null,
      };
    });

  const availableCategories = [...new Set(
    workflows.map((w) => w.category).filter((c): c is WorkflowCategory => c !== null)
  )];

  return { brands, workflows, hero: null, updatedAt: new Date().toISOString(), availableCategories, categorySections: [] };
}

/** Build per-section groups with aggregated stats from their workflows.
 *  Groups by sectionKey ({category}-{channel}-{audienceType}) instead of just category. */
function buildCategorySections(data: LeaderboardData): CategorySection[] {
  const sectionMap = new Map<string, WorkflowEntry[]>();

  for (const wf of data.workflows) {
    const key = wf.sectionKey;
    if (!key) continue;
    const list = sectionMap.get(key) || [];
    list.push(wf);
    sectionMap.set(key, list);
  }

  return [...sectionMap.entries()].map(([sectionKey, workflows]) => {
    const emailsSent = workflows.reduce((s, w) => s + w.emailsSent, 0);
    const emailsOpened = workflows.reduce((s, w) => s + w.emailsOpened, 0);
    const emailsReplied = workflows.reduce((s, w) => s + w.emailsReplied, 0);
    const repliesInterested = workflows.reduce((s, w) => s + w.repliesInterested, 0);
    const totalCostUsdCents = workflows.reduce((s, w) => s + w.totalCostUsdCents, 0);
    // Derive category from the first workflow (all workflows in same section share the same category)
    const category = workflows[0].category!;
    const label = SECTION_LABELS[sectionKey] || sectionKey.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

    return {
      category,
      sectionKey,
      label,
      stats: {
        emailsSent,
        emailsOpened,
        emailsReplied,
        repliesInterested,
        totalCostUsdCents,
        openRate: emailsSent > 0 ? Math.round((emailsOpened / emailsSent) * 10000) / 10000 : 0,
        replyRate: emailsSent > 0 ? Math.round((emailsReplied / emailsSent) * 10000) / 10000 : 0,
        interestedRate: emailsSent > 0 ? Math.round((repliesInterested / emailsSent) * 10000) / 10000 : 0,
        costPerOpenCents: emailsOpened > 0 ? Math.round(totalCostUsdCents / emailsOpened) : null,
        costPerReplyCents: emailsReplied > 0 ? Math.round(totalCostUsdCents / emailsReplied) : null,
      },
      workflows,
      brands: data.brands, // All brands for now — no per-section brand filtering yet
    };
  });
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

    // Filter out brands with no activity (no cost and no emails sent)
    data.brands = data.brands.filter(
      (b) => b.totalCostUsdCents > 0 || b.emailsSent > 0
    );

    // Build per-category sections after enrichment so email stats are included
    data.categorySections = buildCategorySections(data);

    res.json(data);
  } catch (error) {
    console.error("Performance leaderboard build error:", error);
    res.status(502).json({ error: "Failed to build leaderboard data" });
  }
});

export default router;
