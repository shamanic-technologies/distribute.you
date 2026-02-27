import { Router } from "express";
import { authenticate, requireOrg, requireUser, AuthenticatedRequest } from "../middleware/auth.js";
import { callExternalService, externalServices } from "../lib/service-client.js";
import { getRunsBatch, type RunWithCosts } from "@mcpfactory/runs-client";
import { BrandScrapeRequestSchema, IcpSuggestionRequestSchema } from "../schemas.js";
import { fetchKeySource } from "../lib/billing.js";

const router = Router();

/**
 * POST /v1/brand/scrape
 * Scrape brand information from a URL using scraping-service
 */
router.post("/brand/scrape", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = BrandScrapeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }
    const { url, skipCache } = parsed.data;

    // Resolve keySource from billing-service (default to "platform" if no orgId)
    const keySource = req.orgId ? await fetchKeySource(req.orgId) : "platform";

    const result = await callExternalService(
      externalServices.scraping,
      "/scrape",
      {
        method: "POST",
        body: {
          url,
          sourceService: "mcpfactory",
          sourceOrgId: req.orgId,
          userId: req.userId,
          keySource,
          skipCache,
        },
      }
    );

    res.json(result);
  } catch (error: any) {
    console.error("Brand scrape error:", error.message);
    res.status(500).json({ error: error.message || "Failed to scrape brand" });
  }
});

/**
 * GET /v1/brand/by-url
 * Get cached brand info by URL
 */
router.get("/brand/by-url", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const url = req.query.url as string;

    if (!url) {
      return res.status(400).json({ error: "url query param is required" });
    }

    const result = await callExternalService(
      externalServices.scraping,
      `/scrape/by-url?url=${encodeURIComponent(url)}`
    );

    res.json(result);
  } catch (error: any) {
    console.error("Get brand error:", error);
    res.status(500).json({ error: error.message || "Failed to get brand" });
  }
});

/**
 * GET /v1/brands
 * Get all brands for the organization (for dashboard)
 */
router.get("/brands", authenticate, requireOrg, requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await callExternalService(
      externalServices.brand,
      `/brands?orgId=${req.orgId}`
    );
    res.json(result);
  } catch (error: any) {
    console.error("Get brands error:", error);
    res.status(500).json({ error: error.message || "Failed to get brands" });
  }
});

/**
 * GET /v1/brands/:id
 * Get a single brand by ID from brand-service
 */
router.get("/brands/:id", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await callExternalService(
      externalServices.brand,
      `/brands/${req.params.id}`
    );
    res.json(result);
  } catch (error: any) {
    console.error("Get brand by id error:", error);
    res.status(500).json({ error: error.message || "Failed to get brand" });
  }
});

/**
 * GET /v1/brands/:id/sales-profile
 * Get sales profile for a specific brand
 */
router.get("/brands/:id/sales-profile", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await callExternalService(
      externalServices.brand,
      `/brands/${req.params.id}/sales-profile`
    );
    res.json(result);
  } catch (error: any) {
    if (error.message?.includes("404")) {
      return res.status(404).json({ error: "Sales profile not found" });
    }
    console.error("Get brand sales profile error:", error);
    res.status(500).json({ error: error.message || "Failed to get sales profile" });
  }
});

/**
 * GET /v1/brand/sales-profiles
 * Get all sales profiles (brands) for the organization
 * NOTE: Must be before /:id route to avoid matching "sales-profiles" as an id
 */
router.get("/brand/sales-profiles", authenticate, requireOrg, requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await callExternalService(
      externalServices.brand,
      `/sales-profiles?orgId=${req.orgId}`
    );
    res.json(result);
  } catch (error: any) {
    console.error("Get sales profiles error:", error);
    res.status(500).json({ error: error.message || "Failed to get sales profiles" });
  }
});

/**
 * POST /v1/brand/icp-suggestion
 * Get ICP suggestion (Apollo-compatible search params) for a brand URL
 */
router.post("/brand/icp-suggestion", authenticate, requireOrg, requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = IcpSuggestionRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }
    const { brandUrl } = parsed.data;

    // Resolve keySource from billing-service
    const keySource = await fetchKeySource(req.orgId!);

    const result = await callExternalService(
      externalServices.brand,
      "/icp-suggestion",
      {
        method: "POST",
        body: {
          orgId: req.orgId,
          userId: req.userId,
          appId: "mcpfactory",
          keySource,
          url: brandUrl,
        },
      }
    );
    res.json(result);
  } catch (error: any) {
    console.error("ICP suggestion error:", error.message);
    const msg = error.message || "Failed to get ICP suggestion";
    if (msg.includes("No Anthropic API key found")) {
      return res.status(400).json({
        error: "Anthropic API key not configured. Add your Anthropic key in the dashboard under Settings > API Keys (BYOK).",
      });
    }
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /v1/brands/costs
 * Get total costs grouped by brandId from runs-service.
 * Returns a map of brandId -> totalCostInUsdCents.
 */
router.get("/brands/costs", authenticate, requireOrg, requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.orgId!;

    const data = await callExternalService<{
      groups: Array<{
        dimensions: { brandId: string | null };
        totalCostInUsdCents: string;
        actualCostInUsdCents: string;
        provisionedCostInUsdCents: string;
        cancelledCostInUsdCents: string;
        runCount: number;
      }>;
    }>(
      externalServices.runs,
      `/v1/stats/costs?orgId=${encodeURIComponent(orgId)}&appId=mcpfactory&groupBy=brandId`
    );

    const costs: Record<string, string> = {};
    for (const group of data.groups || []) {
      if (group.dimensions.brandId) {
        costs[group.dimensions.brandId] = group.totalCostInUsdCents;
      }
    }

    res.json({ costs });
  } catch (error: any) {
    console.error("Get brands costs error:", error);
    res.status(500).json({ error: error.message || "Failed to get brands costs" });
  }
});

/**
 * GET /v1/brands/:id/cost-breakdown
 * Get cost breakdown by cost name for all runs associated with a brand.
 * Uses runs-service as the single source of truth.
 */
router.get("/brands/:id/cost-breakdown", authenticate, requireOrg, requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    const data = await callExternalService<{
      costs: Array<{
        costName: string;
        totalCostInUsdCents: string;
        actualCostInUsdCents: string;
        provisionedCostInUsdCents: string;
        totalQuantity: string;
      }>;
    }>(
      externalServices.runs,
      `/v1/stats/costs/by-cost-name?orgId=${encodeURIComponent(orgId)}&appId=mcpfactory&brandId=${encodeURIComponent(id)}`
    );

    res.json({ costs: data.costs || [] });
  } catch (error: any) {
    console.error("Get brand cost breakdown error:", error);
    res.status(500).json({ error: error.message || "Failed to get brand cost breakdown" });
  }
});

/**
 * GET /v1/brands/:id/runs
 * Get extraction runs for a brand (sales-profile, icp-extraction) from brand-service,
 * enriched with cost data from runs-service.
 */
router.get("/brands/:id/runs", authenticate, requireOrg, requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // 1. Get runs list from brand-service
    const data = await callExternalService<{ runs?: Array<{ id: string; taskName: string; status: string; startedAt: string; completedAt: string | null }> }>(
      externalServices.brand,
      `/brands/${id}/runs`
    );
    const runs: Array<{ id: string; taskName: string; status: string; startedAt: string; completedAt: string | null }> = data.runs || [];

    if (runs.length === 0) {
      return res.json({ runs: [] });
    }

    // 2. Batch-fetch RunWithCosts from runs-service
    const runIds = runs.map((r) => r.id);
    let runMap = new Map<string, RunWithCosts>();
    try {
      runMap = await getRunsBatch(runIds);
    } catch (err) {
      console.warn("Failed to fetch run costs for brand runs:", err);
    }

    // 3. Enrich and return sorted by startedAt desc
    // Flatten costs: include both the run's own costs and all descendant run costs
    const enriched = runs
      .map((run) => {
        const withCosts = runMap.get(run.id);
        const allCosts = [
          ...(withCosts?.costs || []),
          ...(withCosts?.descendantRuns?.flatMap((dr) => dr.costs) || []),
        ];
        return {
          id: run.id,
          taskName: run.taskName,
          status: withCosts?.status || run.status,
          startedAt: withCosts?.startedAt || run.startedAt,
          completedAt: withCosts?.completedAt || run.completedAt,
          totalCostInUsdCents: withCosts?.totalCostInUsdCents || null,
          costs: allCosts,
        };
      })
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    res.json({ runs: enriched });
  } catch (error: any) {
    console.error("Get brand runs error:", error);
    res.status(500).json({ error: error.message || "Failed to get brand runs" });
  }
});

/**
 * GET /v1/brand/:id
 * Get brand scrape result by ID
 */
router.get("/brand/:id", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const result = await callExternalService(
      externalServices.scraping,
      `/scrape/${id}`
    );

    res.json(result);
  } catch (error: any) {
    console.error("Get brand error:", error);
    res.status(500).json({ error: error.message || "Failed to get brand" });
  }
});

export default router;
