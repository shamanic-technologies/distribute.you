import { Router } from "express";
import { authenticate, requireOrg, requireUser, AuthenticatedRequest } from "../middleware/auth.js";
import { callExternalService, externalServices } from "../lib/service-client.js";
import { buildInternalHeaders } from "../lib/internal-headers.js";
import { createRun, updateRun, getRunsBatch, type RunWithCosts } from "@mcpfactory/runs-client";
import { CreateCampaignRequestSchema, BatchStatsRequestSchema } from "../schemas.js";
import { fetchKeySource } from "../lib/billing.js";

function sendLifecycleEmail(
  eventType: string,
  req: AuthenticatedRequest,
  { brandId, campaignId, ...metadata }: Record<string, unknown>
) {
  callExternalService(externalServices.lifecycle, "/send", {
    method: "POST",
    body: {
      appId: "mcpfactory",
      eventType,
      brandId,
      campaignId,
      orgId: req.orgId,
      userId: req.userId,
      metadata,
    },
  }).catch((err) => console.warn(`[campaigns] Lifecycle email ${eventType} failed:`, err.message));
}

const router = Router();

interface EmailGatewayStats {
  emailsSent: number; emailsDelivered: number; emailsOpened: number; emailsClicked: number;
  emailsReplied: number; emailsBounced: number; repliesWillingToMeet: number;
  repliesInterested: number; repliesNotInterested: number; repliesOutOfOffice: number;
  repliesUnsubscribe: number; recipients: number;
}

/** Fetch delivery stats from email-gateway (aggregates transactional + broadcast). */
async function fetchDeliveryStats(
  filters: { campaignId?: string; brandId?: string },
  orgId: string
): Promise<Record<string, number> | null> {
  const deliveryResult = await callExternalService<{ transactional: EmailGatewayStats; broadcast: EmailGatewayStats }>(
    externalServices.emailSending,
    "/stats",
    {
      method: "POST",
      headers: { "x-org-id": orgId },
      body: { ...filters, appId: "mcpfactory", orgId },
    }
  ).catch((err) => {
    console.warn("[campaigns] Email-gateway stats failed:", (err as Error).message);
    return null;
  });

  // Only use broadcast stats (outreach emails via Instantly).
  // Transactional stats are lifecycle/test emails via Postmark — not relevant.
  const b = (deliveryResult as any)?.broadcast;
  if (!b) return null;

  return {
    emailsSent: b.emailsSent || 0,
    emailsDelivered: b.emailsDelivered || 0,
    emailsOpened: b.emailsOpened || 0,
    emailsClicked: b.emailsClicked || 0,
    emailsReplied: b.emailsReplied || 0,
    emailsBounced: b.emailsBounced || 0,
    repliesWillingToMeet: b.repliesWillingToMeet || 0,
    repliesInterested: b.repliesInterested || 0,
    repliesNotInterested: b.repliesNotInterested || 0,
    repliesOutOfOffice: b.repliesOutOfOffice || 0,
    repliesUnsubscribe: b.repliesUnsubscribe || 0,
  };
}

/**
 * GET /v1/campaigns
 * List campaigns for the organization
 * Query params:
 * - brandId: optional, filter by brand ID from brand-service
 */
router.get("/campaigns", authenticate, requireOrg, requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const brandId = req.query.brandId as string;
    const status = req.query.status as string;
    const params = new URLSearchParams();
    if (brandId) params.set("brandId", brandId);
    if (status) params.set("status", status);
    const queryString = params.toString() ? `?${params.toString()}` : "";

    const result = await callExternalService(
      externalServices.campaign,
      `/campaigns${queryString}`,
      {
        headers: buildInternalHeaders(req),
      }
    );
    res.json(result);
  } catch (error: any) {
    console.error("List campaigns error:", error);
    res.status(500).json({ error: error.message || "Failed to list campaigns" });
  }
});

/**
 * POST /v1/campaigns
 * Create a new campaign
 * 
 * If clientUrl is provided, scrapes the company info first and stores in company-service
 */
router.post("/campaigns", authenticate, requireOrg, requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    console.log("[api-service] POST /v1/campaigns \u2014 incoming request", {
      orgId: req.orgId,
      userId: req.userId,
      body: { ...req.body, brandUrl: req.body.brandUrl },
    });

    const parsed = CreateCampaignRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const missingFields = Object.keys(flat.fieldErrors);
      console.warn("[api-service] POST /v1/campaigns \u2014 validation failed", flat);

      const fieldGuide: Record<string, { description: string; example: string }> = {
        name: { description: "A name for your campaign", example: "Q1 SaaS Outreach" },
        brandUrl: { description: "The URL of the product or service you are promoting", example: "https://acme.com" },
        targetAudience: { description: "Plain text description of who you want to reach", example: "CTOs at SaaS startups with 10-50 employees in the US" },
        targetOutcome: { description: "The concrete result you want from this campaign", example: "Book sales demos" },
        valueForTarget: { description: "What your target audience gains by responding to your email", example: "Access to enterprise analytics at startup pricing" },
        urgency: { description: "A time-based constraint that motivates the prospect to act now rather than later", example: "Early-adopter pricing ends March 31st" },
        scarcity: { description: "A supply-based constraint showing limited availability", example: "Only 10 spots available worldwide" },
        riskReversal: { description: "A guarantee or safety net that removes risk for the prospect — what makes saying yes feel safe", example: "14-day free trial, cancel anytime, no commitment" },
        socialProof: { description: "Evidence of credibility: testimonials, numbers, notable clients, press, awards", example: "Backed by 60 sponsors including Sequoia and a]6z" },
      };

      const missingFieldDetails = missingFields
        .filter((f) => fieldGuide[f])
        .map((f) => ({ field: f, ...fieldGuide[f], errors: flat.fieldErrors[f as keyof typeof flat.fieldErrors] }));

      return res.status(400).json({
        error: `Missing or invalid required fields: ${missingFields.join(", ")}.`,
        missingFields: missingFieldDetails,
        hint: "Every campaign requires all of these fields. Even if you're unsure, provide your best answer — it helps the AI generate better emails.",
      });
    }

    const { brandUrl } = parsed.data;
    console.log("[api-service] POST /v1/campaigns \u2014 parsed OK", {
      name: parsed.data.name,
      workflowName: parsed.data.workflowName,
      brandUrl,
      targetAudience: parsed.data.targetAudience?.slice(0, 80) + "...",
      targetOutcome: parsed.data.targetOutcome,
      valueForTarget: parsed.data.valueForTarget?.slice(0, 80) + "...",
      maxLeads: parsed.data.maxLeads,
    });

    // 1. Upsert brand to get brandId
    console.log("[api-service] POST /v1/campaigns \u2014 step 1: upserting brand", { brandUrl, orgId: req.orgId });
    const brandResult = await callExternalService<{ brandId: string }>(
      externalServices.brand,
      "/brands",
      {
        method: "POST",
        body: {
          appId: "mcpfactory",
          orgId: req.orgId,
          url: brandUrl,
          userId: req.userId,
        },
      }
    );
    console.log("[api-service] POST /v1/campaigns \u2014 step 1 done: brand upserted", { brandId: brandResult.brandId });

    // 2. Create parent run so all downstream runs are linked
    console.log("[api-service] POST /v1/campaigns \u2014 step 2: creating parent run");
    const parentRun = await createRun({
      orgId: req.orgId!,
      userId: req.userId,
      appId: "mcpfactory",
      brandId: brandResult.brandId,
      serviceName: "api-service",
      taskName: "create-campaign",
    });
    console.log("[api-service] POST /v1/campaigns \u2014 step 2 done: parent run created", { parentRunId: parentRun.id });

    // 3. Resolve keySource from billing-service (byok vs pay-as-you-go)
    const keySource = await fetchKeySource(req.orgId!);
    console.log("[api-service] POST /v1/campaigns — step 3: resolved keySource from billing-service", { keySource });

    // 4. Forward to campaign-service with parentRunId
    // Derive `type` from workflowName for campaign-service backward compat
    const { workflowName, ...restData } = parsed.data;
    const body: Record<string, unknown> = {
      ...restData,
      workflowName,
      type: "cold-email-outreach",
      appId: "mcpfactory",
      orgId: req.orgId,
      brandId: brandResult.brandId,
      keySource,
      parentRunId: parentRun.id,
    };

    // Convert budget numbers to strings (campaign-service expects string type)
    for (const key of ["maxBudgetDailyUsd", "maxBudgetWeeklyUsd", "maxBudgetMonthlyUsd", "maxBudgetTotalUsd"]) {
      if (body[key] != null) body[key] = String(body[key]);
    }

    console.log("[api-service] POST /v1/campaigns \u2014 step 3: forwarding to campaign-service", {
      brandId: body.brandId,
      workflowName: body.workflowName,
      targetOutcome: body.targetOutcome,
      maxLeads: body.maxLeads,
      parentRunId: parentRun.id,
    });
    let result;
    try {
      result = await callExternalService(
        externalServices.campaign,
        "/campaigns",
        {
          method: "POST",
          headers: buildInternalHeaders(req),
          body,
        }
      );
    } catch (err) {
      await updateRun(parentRun.id, "failed").catch(() => {});
      throw err;
    }
    console.log("[api-service] POST /v1/campaigns \u2014 step 3 done: campaign created", {
      campaignId: (result as any).campaign?.id,
      status: (result as any).campaign?.status,
    });

    // Fire-and-forget lifecycle email
    const campaign = (result as any).campaign;
    if (campaign?.brandId && campaign?.id) {
      console.log("[api-service] POST /v1/campaigns \u2014 step 4: sending lifecycle email campaign_created");
      sendLifecycleEmail("campaign_created", req, {
        brandId: campaign.brandId,
        campaignId: campaign.id,
        campaignName: parsed.data.name || campaign.name,
      });
    }

    res.json(result);
  } catch (error: any) {
    console.error("[api-service] POST /v1/campaigns \u2014 FAILED:", error.message, error.stack);
    res.status(500).json({ error: error.message || "Failed to create campaign" });
  }
});

/**
 * GET /v1/campaigns/:id
 * Get a specific campaign
 */
router.get("/campaigns/:id", authenticate, requireOrg, requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const result = await callExternalService(
      externalServices.campaign,
      `/campaigns/${id}`,
      {
        headers: { "x-org-id": req.orgId! },
      }
    );
    res.json(result);
  } catch (error: any) {
    console.error("Get campaign error:", error);
    res.status(500).json({ error: error.message || "Failed to get campaign" });
  }
});

/**
 * PATCH /v1/campaigns/:id
 * Update a campaign
 */
router.patch("/campaigns/:id", authenticate, requireOrg, requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const result = await callExternalService(
      externalServices.campaign,
      `/campaigns/${id}`,
      {
        method: "PATCH",
        headers: { "x-org-id": req.orgId! },
        body: req.body,
      }
    );
    res.json(result);
  } catch (error: any) {
    console.error("Update campaign error:", error);
    res.status(500).json({ error: error.message || "Failed to update campaign" });
  }
});

/**
 * POST /v1/campaigns/:id/stop
 * Stop a running campaign
 */
router.post("/campaigns/:id/stop", authenticate, requireOrg, requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const result = await callExternalService(
      externalServices.campaign,
      `/campaigns/${id}`,
      {
        method: "PATCH",
        headers: { "x-org-id": req.orgId! },
        body: { status: "stop" },
      }
    );

    const campaign = (result as any).campaign;

    // Close the parent run now that the campaign is stopped
    if (campaign?.parentRunId) {
      updateRun(campaign.parentRunId, "completed").catch((err) =>
        console.warn("[campaigns] Failed to complete parent run:", (err as Error).message)
      );
    }

    // Fire-and-forget lifecycle email
    if (campaign?.brandId) {
      sendLifecycleEmail("campaign_stopped", req, {
        brandId: campaign.brandId,
        campaignId: id,
        campaignName: campaign?.name,
      });
    }

    res.json(result);
  } catch (error: any) {
    console.error("Stop campaign error:", error);
    res.status(500).json({ error: error.message || "Failed to stop campaign" });
  }
});

/**
 * POST /v1/campaigns/:id/resume
 * Resume a stopped campaign
 */
router.post("/campaigns/:id/resume", authenticate, requireOrg, requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Create parent run for the resume/activate operation
    const parentRun = await createRun({
      orgId: req.orgId!,
      userId: req.userId,
      appId: "mcpfactory",
      campaignId: id,
      serviceName: "api-service",
      taskName: "resume-campaign",
    });

    // Resolve keySource from billing-service
    const keySource = await fetchKeySource(req.orgId!);

    let result;
    try {
      result = await callExternalService(
        externalServices.campaign,
        `/campaigns/${id}`,
        {
          method: "PATCH",
          headers: { "x-org-id": req.orgId! },
          body: { status: "activate", parentRunId: parentRun.id, keySource },
        }
      );
    } catch (err) {
      await updateRun(parentRun.id, "failed").catch(() => {});
      throw err;
    }
    res.json(result);
  } catch (error: any) {
    console.error("Resume campaign error:", error);
    res.status(500).json({ error: error.message || "Failed to resume campaign" });
  }
});

/**
 * GET /v1/campaigns/:id/runs
 * Get campaign runs/history
 */
router.get("/campaigns/:id/runs", authenticate, requireOrg, requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const result = await callExternalService(
      externalServices.campaign,
      `/campaigns/${id}/runs`,
      {
        headers: { "x-org-id": req.orgId! },
      }
    );
    res.json(result);
  } catch (error: any) {
    console.error("Get campaign runs error:", error);
    res.status(500).json({ error: error.message || "Failed to get campaign runs" });
  }
});

/**
 * GET /v1/campaigns/:id/stats
 * Get campaign statistics
 */
router.get("/campaigns/:id/stats", authenticate, requireOrg, requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    // Fetch stats from all services in parallel using campaignId filter
    const [leadStats, emailgenStats, delivery, budgetUsage, costBreakdown, leadsFromRuns] = await Promise.all([
      callExternalService(
        externalServices.lead,
        `/stats?campaignId=${id}`,
        { headers: { "x-app-id": "mcpfactory", "x-org-id": orgId } }
      ).catch((err) => {
        console.warn("[campaigns] Lead-service stats failed:", (err as Error).message);
        return null;
      }),
      callExternalService(
        externalServices.emailgen,
        "/stats",
        { method: "POST", body: { campaignId: id, appId: "mcpfactory" }, headers: { "x-org-id": orgId } }
      ).catch((err) => {
        console.warn("[campaigns] Emailgen stats failed:", (err as Error).message);
        return null;
      }),
      fetchDeliveryStats({ campaignId: id }, orgId),
      callExternalService<{ results: Record<string, { totalCostInUsdCents: string | null }> }>(
        externalServices.campaign,
        "/campaigns/batch-budget-usage",
        { method: "POST", body: { campaignIds: [id] } }
      ).catch((err) => {
        console.warn("[campaigns] Budget usage failed:", (err as Error).message);
        return null;
      }),
      // Full cost breakdown by cost name from runs-service (single source of truth)
      callExternalService<{ costs: Array<{ costName: string; totalCostInUsdCents: string; actualCostInUsdCents: string; provisionedCostInUsdCents: string; totalQuantity: string }> }>(
        externalServices.runs,
        `/v1/stats/costs/by-cost-name?orgId=${encodeURIComponent(orgId)}&appId=mcpfactory&campaignId=${encodeURIComponent(id)}`
      ).catch((err) => {
        console.warn("[campaigns] Cost breakdown failed:", (err as Error).message);
        return null;
      }),
      // Lead-serve run count from runs-service (source of truth for leadsServed)
      callExternalService<{ groups: Array<{ dimensions: Record<string, string | null>; runCount: number }> }>(
        externalServices.runs,
        `/v1/stats/costs?orgId=${encodeURIComponent(orgId)}&appId=mcpfactory&campaignId=${encodeURIComponent(id)}&taskName=lead-serve&groupBy=serviceName`
      ).catch((err) => {
        console.warn("[campaigns] Lead-serve runs stats failed:", (err as Error).message);
        return null;
      }),
    ]);

    const stats: Record<string, any> = { campaignId: id };

    // Lead stats from lead-service: { served, buffered, skipped, apollo }
    if (leadStats) {
      const ls = leadStats as { served: number; buffered: number; skipped: number; apollo?: { enrichedLeadsCount: number; searchCount: number; fetchedPeopleCount: number; totalMatchingPeople: number } };
      stats.leadsServed = ls.served;
      stats.leadsBuffered = ls.buffered;
      stats.leadsSkipped = ls.skipped;
      if (ls.apollo) stats.apollo = ls.apollo;
    } else {
      stats.leadsServed = 0;
      stats.leadsBuffered = 0;
      stats.leadsSkipped = 0;
    }

    // Override leadsServed from runs-service (source of truth — lead-service
    // tracking can lag behind the actual number of completed lead-serve runs)
    if (leadsFromRuns?.groups?.length) {
      stats.leadsServed = leadsFromRuns.groups[0].runCount;
    }

    // Emailgen stats
    if (emailgenStats) {
      const eg = (emailgenStats as any).stats || emailgenStats;
      stats.emailsGenerated = eg.emailsGenerated || 0;
      if (eg.totalCostUsd) stats.totalCostUsd = eg.totalCostUsd;
    } else {
      stats.emailsGenerated = 0;
    }

    // Delivery stats from postmark + instantly
    if (delivery) {
      Object.assign(stats, delivery);
    } else {
      stats.emailsSent = 0;
      stats.emailsOpened = 0;
      stats.emailsClicked = 0;
      stats.emailsReplied = 0;
      stats.emailsBounced = 0;
    }

    // Budget usage from campaign-service
    if (budgetUsage?.results?.[id]) {
      stats.totalCostInUsdCents = budgetUsage.results[id].totalCostInUsdCents;
    }

    // Cost breakdown by cost name from runs-service
    if (costBreakdown?.costs) {
      stats.costBreakdown = costBreakdown.costs;
    }

    res.json(stats);
  } catch (error: any) {
    console.error("Get campaign stats error:", error);
    res.status(500).json({ error: error.message || "Failed to get campaign stats" });
  }
});

/**
 * POST /v1/campaigns/batch-stats
 * Get stats for multiple campaigns in one call
 */
router.post("/campaigns/batch-stats", authenticate, requireOrg, requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = BatchStatsRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }
    const { campaignIds } = parsed.data;

    const orgId = req.orgId!;

    // Fetch budget usage and lead-serve run counts in bulk (one call each)
    const budgetUsagePromise = callExternalService<{
      results: Record<string, { totalCostInUsdCents: string | null }>;
    }>(externalServices.campaign, "/campaigns/batch-budget-usage", {
      method: "POST",
      body: { campaignIds },
    }).catch((err) => {
      console.warn("[campaigns] Batch budget usage failed:", (err as Error).message);
      return null;
    });

    // Lead-serve run counts per campaign from runs-service (source of truth)
    const leadsFromRunsPromise = callExternalService<{
      groups: Array<{ dimensions: Record<string, string | null>; runCount: number }>;
    }>(
      externalServices.runs,
      `/v1/stats/costs?orgId=${encodeURIComponent(orgId)}&appId=mcpfactory&taskName=lead-serve&groupBy=campaignId`
    ).catch((err) => {
      console.warn("[campaigns] Batch lead-serve runs stats failed:", (err as Error).message);
      return null;
    });

    // Fetch stats for each campaign in parallel using campaignId filter
    const [results, budgetUsage, leadsFromRuns] = await Promise.all([
      Promise.all(
        campaignIds.map(async (id: string) => {
          const [leadStats, emailgenStats, delivery] = await Promise.all([
            callExternalService(
              externalServices.lead,
              `/stats?campaignId=${id}`,
              { headers: { "x-app-id": "mcpfactory", "x-org-id": orgId } }
            ).catch(() => null),
            callExternalService(
              externalServices.emailgen,
              "/stats",
              { method: "POST", body: { campaignId: id, appId: "mcpfactory" }, headers: { "x-org-id": orgId } }
            ).catch(() => null),
            fetchDeliveryStats({ campaignId: id }, orgId),
          ]);

          return { campaignId: id, leadStats, emailgenStats, delivery };
        })
      ),
      budgetUsagePromise,
      leadsFromRunsPromise,
    ]);

    const budgetResults = budgetUsage?.results || {};

    // Build a map of campaignId → lead-serve run count
    const leadsRunCountMap = new Map<string, number>();
    if (leadsFromRuns?.groups) {
      for (const g of leadsFromRuns.groups) {
        const cid = g.dimensions.campaignId;
        if (cid) leadsRunCountMap.set(cid, g.runCount);
      }
    }

    const stats: Record<string, any> = {};
    for (const r of results) {
      const merged: Record<string, any> = { campaignId: r.campaignId };

      // Lead stats from lead-service: { served, buffered, skipped, apollo }
      if (r.leadStats) {
        const ls = r.leadStats as { served: number; buffered: number; skipped: number; apollo?: { enrichedLeadsCount: number; searchCount: number; fetchedPeopleCount: number; totalMatchingPeople: number } };
        merged.leadsServed = ls.served;
        merged.leadsBuffered = ls.buffered;
        merged.leadsSkipped = ls.skipped;
        if (ls.apollo) merged.apollo = ls.apollo;
      } else {
        merged.leadsServed = 0;
        merged.leadsBuffered = 0;
        merged.leadsSkipped = 0;
      }

      // Override leadsServed from runs-service (source of truth)
      const leadsRunCount = leadsRunCountMap.get(r.campaignId);
      if (leadsRunCount !== undefined) {
        merged.leadsServed = leadsRunCount;
      }

      // Emailgen stats
      if (r.emailgenStats) {
        const eg = (r.emailgenStats as any).stats || r.emailgenStats;
        merged.emailsGenerated = eg.emailsGenerated || 0;
      } else {
        merged.emailsGenerated = 0;
      }

      // Delivery stats
      if (r.delivery) {
        Object.assign(merged, r.delivery);
      } else {
        merged.emailsSent = 0;
        merged.emailsOpened = 0;
        merged.emailsClicked = 0;
        merged.emailsReplied = 0;
        merged.emailsBounced = 0;
      }

      // Budget usage from campaign-service
      if (budgetResults[r.campaignId]) {
        merged.totalCostInUsdCents = budgetResults[r.campaignId].totalCostInUsdCents;
      }

      stats[r.campaignId] = merged;
    }

    res.json({ stats });
  } catch (error: any) {
    console.error("Batch stats error:", error);
    res.status(500).json({ error: error.message || "Failed to get batch stats" });
  }
});

/**
 * GET /v1/campaigns/:id/leads
 * Get all leads for a campaign
 */
router.get("/campaigns/:id/leads", authenticate, requireOrg, requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const result = await callExternalService(
      externalServices.lead,
      `/leads?campaignId=${id}`,
      {
        headers: { "x-app-id": "mcpfactory", "x-org-id": req.orgId! },
      }
    ) as { leads: Array<Record<string, unknown>> };

    const rawLeads = result.leads || [];

    // Flatten enrichment data into each lead to match dashboard expectations.
    // Lead-service returns: { id, email, servedAt, runId, enrichment: { firstName, lastName, ... } }
    // Dashboard expects: { id, email, createdAt, firstName, lastName, title, ... }
    const leads = rawLeads.map((raw) => {
      const enrichment = (raw.enrichment as Record<string, unknown>) || {};
      return {
        id: raw.id,
        email: raw.email,
        externalId: raw.externalId,
        firstName: enrichment.firstName ?? null,
        lastName: enrichment.lastName ?? null,
        emailStatus: enrichment.emailStatus ?? null,
        title: enrichment.title ?? null,
        organizationName: enrichment.organizationName ?? null,
        organizationDomain: enrichment.organizationDomain ?? null,
        organizationIndustry: enrichment.organizationIndustry ?? null,
        organizationSize: enrichment.organizationSize ?? null,
        linkedinUrl: enrichment.linkedinUrl ?? null,
        status: "contacted",
        createdAt: raw.servedAt ?? null,
        enrichmentRunId: raw.runId ?? null,
      };
    });

    // Batch-fetch enrichment run costs from runs-service
    const enrichmentRunIds = leads
      .map((l) => l.enrichmentRunId as string | undefined)
      .filter((id): id is string => !!id);

    let runMap = new Map<string, RunWithCosts>();
    if (enrichmentRunIds.length > 0) {
      try {
        runMap = await getRunsBatch(enrichmentRunIds);
      } catch (err) {
        console.warn("Failed to fetch lead enrichment run costs:", err);
      }
    }

    // Attach run data to each lead
    const leadsWithRuns = leads.map((lead) => {
      const run = lead.enrichmentRunId ? runMap.get(lead.enrichmentRunId as string) : undefined;
      return {
        ...lead,
        enrichmentRun: run
          ? {
              status: run.status,
              startedAt: run.startedAt,
              completedAt: run.completedAt,
              totalCostInUsdCents: run.totalCostInUsdCents,
              costs: run.costs,
              serviceName: run.serviceName,
              taskName: run.taskName,
              descendantRuns: run.descendantRuns ?? [],
            }
          : null,
      };
    });

    res.json({ leads: leadsWithRuns });
  } catch (error: any) {
    console.error("Get campaign leads error:", error);
    res.status(500).json({ error: error.message || "Failed to get campaign leads" });
  }
});

/**
 * GET /v1/campaigns/:id/emails
 * Get all generated emails for a campaign (across all runs)
 */
router.get("/campaigns/:id/emails", authenticate, requireOrg, requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // 1. Fetch all generations for this campaign in one call
    const emailsResult = await callExternalService(
      externalServices.emailgen,
      `/generations?campaignId=${id}`,
      {
        headers: { "x-org-id": req.orgId! },
      }
    ) as { generations: Array<Record<string, unknown>> };

    const allEmails = emailsResult.generations || [];

    if (allEmails.length === 0) {
      return res.json({ emails: [] });
    }

    // 2. Batch-fetch generation run costs from runs-service
    const generationRunIds = allEmails
      .map((e) => e.generationRunId as string | undefined)
      .filter((id): id is string => !!id);

    let runMap = new Map<string, RunWithCosts>();
    if (generationRunIds.length > 0) {
      try {
        runMap = await getRunsBatch(generationRunIds);
      } catch (err) {
        console.warn("Failed to fetch run costs:", err);
      }
    }

    // 4. Attach run data to each email
    const emailsWithRuns = allEmails.map((email) => {
      const run = email.generationRunId ? runMap.get(email.generationRunId as string) : undefined;
      return {
        ...email,
        generationRun: run
          ? {
              status: run.status,
              startedAt: run.startedAt,
              completedAt: run.completedAt,
              totalCostInUsdCents: run.totalCostInUsdCents,
              costs: run.costs,
              serviceName: run.serviceName,
              taskName: run.taskName,
              descendantRuns: run.descendantRuns ?? [],
            }
          : null,
      };
    });

    res.json({ emails: emailsWithRuns });
  } catch (error: any) {
    console.error("Get campaign emails error:", error);
    res.status(500).json({ error: error.message || "Failed to get campaign emails" });
  }
});

/**
 * GET /v1/brands/:brandId/delivery-stats
 * Get delivery stats for all campaigns under a brand (single email-gateway call)
 */
router.get("/brands/:brandId/delivery-stats", authenticate, requireOrg, requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const { brandId } = req.params;
    const orgId = req.orgId!;

    const delivery = await fetchDeliveryStats({ brandId }, orgId);

    res.json(delivery ?? {
      emailsSent: 0,
      emailsDelivered: 0,
      emailsOpened: 0,
      emailsClicked: 0,
      emailsReplied: 0,
      emailsBounced: 0,
      repliesWillingToMeet: 0,
      repliesInterested: 0,
      repliesNotInterested: 0,
      repliesOutOfOffice: 0,
      repliesUnsubscribe: 0,
    });
  } catch (error: any) {
    console.error("Get brand delivery stats error:", error);
    res.status(500).json({ error: error.message || "Failed to get brand delivery stats" });
  }
});

/**
 * GET /v1/campaigns/:id/stream
 * SSE endpoint — pushes campaign updates (leads, emails, stats) in real-time.
 * Falls back to server-side polling every 5s against downstream services.
 */
router.get("/campaigns/:id/stream", authenticate, requireOrg, requireUser, async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const orgId = req.orgId!;

  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // disable nginx buffering
  });
  res.flushHeaders();

  // Send a comment to keep the connection alive immediately
  res.write(": connected\n\n");

  let lastLeadCount = -1;
  let lastEmailCount = -1;
  let lastStatus = "";
  let closed = false;

  const POLL_INTERVAL_MS = 5_000;

  const poll = async () => {
    if (closed) return;

    try {
      const [campaign, leadStats, emailgenStats, delivery] = await Promise.all([
        callExternalService<{ campaign: { status: string } }>(
          externalServices.campaign,
          `/campaigns/${id}`,
          { headers: { "x-org-id": orgId } }
        ).catch(() => null),
        callExternalService<{ served: number; buffered: number; skipped: number }>(
          externalServices.lead,
          `/stats?campaignId=${id}`,
          { headers: { "x-app-id": "mcpfactory", "x-org-id": orgId } }
        ).catch(() => null),
        callExternalService<{ stats?: { emailsGenerated?: number } }>(
          externalServices.emailgen,
          "/stats",
          { method: "POST", body: { campaignId: id, appId: "mcpfactory" }, headers: { "x-org-id": orgId } }
        ).catch(() => null),
        fetchDeliveryStats({ campaignId: id }, orgId),
      ]);

      if (closed) return;

      const currentStatus = campaign?.campaign?.status ?? "";
      const currentLeads = leadStats?.served ?? 0;
      const eg = (emailgenStats as any)?.stats || emailgenStats;
      const currentEmails = eg?.emailsGenerated ?? 0;

      // Emit only when something changed
      const changed =
        currentStatus !== lastStatus ||
        currentLeads !== lastLeadCount ||
        currentEmails !== lastEmailCount;

      if (changed) {
        const payload = {
          campaignId: id,
          status: currentStatus,
          leadsServed: currentLeads,
          leadsBuffered: leadStats?.buffered ?? 0,
          leadsSkipped: leadStats?.skipped ?? 0,
          emailsGenerated: currentEmails,
          emailsSent: (delivery as any)?.emailsSent ?? 0,
          emailsOpened: (delivery as any)?.emailsOpened ?? 0,
          emailsReplied: (delivery as any)?.emailsReplied ?? 0,
        };

        res.write(`event: update\ndata: ${JSON.stringify(payload)}\n\n`);

        lastStatus = currentStatus;
        lastLeadCount = currentLeads;
        lastEmailCount = currentEmails;
      }

      // Stop streaming once campaign is in a terminal state
      if (currentStatus === "completed" || currentStatus === "failed" || currentStatus === "stopped") {
        res.write(`event: done\ndata: ${JSON.stringify({ reason: currentStatus })}\n\n`);
        res.end();
        closed = true;
        return;
      }
    } catch (err) {
      if (!closed) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: "poll failed" })}\n\n`);
      }
    }

    if (!closed) {
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }
  };

  let timer: ReturnType<typeof setTimeout> = setTimeout(poll, 0);

  req.on("close", () => {
    closed = true;
    clearTimeout(timer);
  });
});

export default router;
