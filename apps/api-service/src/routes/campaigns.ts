import { Router } from "express";
import { authenticate, requireOrg, AuthenticatedRequest } from "../middleware/auth.js";
import { callService, services, callExternalService, externalServices } from "../lib/service-client.js";
import { buildInternalHeaders } from "../lib/internal-headers.js";
import { getRunsBatch, type RunWithCosts } from "@mcpfactory/runs-client";
import { CreateCampaignRequestSchema, BatchStatsRequestSchema } from "../schemas.js";

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
      clerkOrgId: req.orgId,
      clerkUserId: req.userId,
      metadata,
    },
  }).catch((err) => console.warn(`[campaigns] Lifecycle email ${eventType} failed:`, err.message));
}

const router = Router();

interface EmailSendingStats {
  sent: number; delivered: number; opened: number; clicked: number;
  replied: number; bounced: number; unsubscribed: number; recipients: number;
}

/** Fetch delivery stats from email-sending service + reply classifications from reply-qualification service. */
async function fetchDeliveryStats(
  filters: { campaignId?: string; brandId?: string },
  orgId: string
): Promise<Record<string, number> | null> {
  const [deliveryResult, qualifications] = await Promise.all([
    callExternalService<{ transactional: EmailSendingStats; broadcast: EmailSendingStats }>(
      externalServices.emailSending,
      "/stats",
      {
        method: "POST",
        headers: { "x-clerk-org-id": orgId },
        body: { ...filters, appId: "mcpfactory", clerkOrgId: orgId },
      }
    ).catch((err) => {
      console.warn("[campaigns] Email-sending stats failed:", (err as Error).message);
      return null;
    }),
    filters.campaignId
      ? callExternalService<Array<{ classification: string }>>(
          externalServices.replyQualification,
          `/qualifications?sourceService=mcpfactory&sourceOrgId=${orgId}&sourceRefId=${filters.campaignId}`,
        ).catch((err) => {
          console.warn("[campaigns] Reply-qualification stats failed:", (err as Error).message);
          return null;
        })
      : Promise.resolve(null),
  ]);

  const t = (deliveryResult as any)?.transactional;
  const b = (deliveryResult as any)?.broadcast;
  if (!t && !b) return null;

  const sum = (a?: number, c?: number) => (a || 0) + (c || 0);

  const totalReplied = sum(t?.replied, b?.replied);

  // Only count reply classifications when there are actual replies.
  // The reply-qualification service may return stale/incorrect data.
  const counts: Record<string, number> = {};
  if (totalReplied > 0 && Array.isArray(qualifications)) {
    for (const q of qualifications) {
      counts[q.classification] = (counts[q.classification] || 0) + 1;
    }
  }

  return {
    emailsSent: sum(t?.sent, b?.sent),
    emailsDelivered: sum(t?.delivered, b?.delivered),
    emailsOpened: sum(t?.opened, b?.opened),
    emailsClicked: sum(t?.clicked, b?.clicked),
    emailsReplied: totalReplied,
    emailsBounced: sum(t?.bounced, b?.bounced),
    repliesWillingToMeet: counts.willing_to_meet || 0,
    repliesInterested: counts.interested || 0,
    repliesNotInterested: counts.not_interested || 0,
    repliesOutOfOffice: counts.out_of_office || 0,
    repliesUnsubscribe: counts.unsubscribe || 0,
  };
}

/**
 * GET /v1/campaigns
 * List campaigns for the organization
 * Query params:
 * - brandId: optional, filter by brand ID from brand-service
 */
router.get("/campaigns", authenticate, requireOrg, async (req: AuthenticatedRequest, res) => {
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
router.post("/campaigns", authenticate, requireOrg, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = CreateCampaignRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }

    // If brandUrl provided, scrape it first so company info is available for runs
    const { brandUrl } = parsed.data;
    if (brandUrl) {
      try {
        await callExternalService(
          externalServices.scraping,
          "/scrape",
          {
            method: "POST",
            body: {
              url: brandUrl,
              sourceService: "mcpfactory",
              sourceOrgId: req.orgId,
            },
          }
        );
      } catch (scrapeError: any) {
        console.warn("Failed to scrape brand (continuing anyway):", scrapeError.message);
        // Don't fail campaign creation if scrape fails - worker will handle missing data
      }
    }
    
    // Convert budget numbers to strings (campaign-service expects string type)
    const body: Record<string, unknown> = { ...parsed.data, appId: "mcpfactory" };
    for (const key of ["maxBudgetDailyUsd", "maxBudgetWeeklyUsd", "maxBudgetMonthlyUsd", "maxBudgetTotalUsd"]) {
      if (body[key] != null) body[key] = String(body[key]);
    }

    const result = await callExternalService(
      externalServices.campaign,
      "/campaigns",
      {
        method: "POST",
        headers: buildInternalHeaders(req),
        body,
      }
    );

    // Fire-and-forget lifecycle email
    const campaign = (result as any).campaign;
    if (campaign?.brandId && campaign?.id) {
      sendLifecycleEmail("campaign_created", req, {
        brandId: campaign.brandId,
        campaignId: campaign.id,
        campaignName: parsed.data.name || campaign.name,
      });
    }

    res.json(result);
  } catch (error: any) {
    console.error("Create campaign error:", error.message, error.stack);
    res.status(500).json({ error: error.message || "Failed to create campaign" });
  }
});

/**
 * GET /v1/campaigns/:id
 * Get a specific campaign
 */
router.get("/campaigns/:id", authenticate, requireOrg, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const result = await callExternalService(
      externalServices.campaign,
      `/campaigns/${id}`,
      {
        headers: { "x-clerk-org-id": req.orgId! },
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
router.patch("/campaigns/:id", authenticate, requireOrg, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const result = await callExternalService(
      externalServices.campaign,
      `/campaigns/${id}`,
      {
        method: "PATCH",
        headers: { "x-clerk-org-id": req.orgId! },
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
router.post("/campaigns/:id/stop", authenticate, requireOrg, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const result = await callExternalService(
      externalServices.campaign,
      `/campaigns/${id}`,
      {
        method: "PATCH",
        headers: { "x-clerk-org-id": req.orgId! },
        body: { status: "stop" },
      }
    );

    // Fire-and-forget lifecycle email
    const campaign = (result as any).campaign;
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
router.post("/campaigns/:id/resume", authenticate, requireOrg, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const result = await callExternalService(
      externalServices.campaign,
      `/campaigns/${id}`,
      {
        method: "PATCH",
        headers: { "x-clerk-org-id": req.orgId! },
        body: { status: "activate" },
      }
    );
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
router.get("/campaigns/:id/runs", authenticate, requireOrg, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const result = await callExternalService(
      externalServices.campaign,
      `/campaigns/${id}/runs`,
      {
        headers: { "x-clerk-org-id": req.orgId! },
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
router.get("/campaigns/:id/stats", authenticate, requireOrg, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const orgId = req.orgId!;

    // Fetch stats from all services in parallel using campaignId filter
    const [leadStats, emailgenStats, delivery] = await Promise.all([
      callExternalService(
        externalServices.lead,
        `/stats?campaignId=${id}`,
        { headers: { "x-app-id": "mcpfactory", "x-org-id": orgId } }
      ).catch((err) => {
        console.warn("[campaigns] Lead-service stats failed:", (err as Error).message);
        return null;
      }),
      callService(
        services.emailgen,
        "/stats",
        { method: "POST", body: { campaignId: id, appId: "mcpfactory" }, headers: { "x-clerk-org-id": orgId } }
      ).catch((err) => {
        console.warn("[campaigns] Emailgen stats failed:", (err as Error).message);
        return null;
      }),
      fetchDeliveryStats({ campaignId: id }, orgId),
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
router.post("/campaigns/batch-stats", authenticate, requireOrg, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = BatchStatsRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }
    const { campaignIds } = parsed.data;

    const orgId = req.orgId!;

    // Fetch stats for each campaign in parallel using campaignId filter
    const results = await Promise.all(
      campaignIds.map(async (id: string) => {
        const [leadStats, emailgenStats, delivery] = await Promise.all([
          callExternalService(
            externalServices.lead,
            `/stats?campaignId=${id}`,
            { headers: { "x-app-id": "mcpfactory", "x-org-id": orgId } }
          ).catch(() => null),
          callService(
            services.emailgen,
            "/stats",
            { method: "POST", body: { campaignId: id, appId: "mcpfactory" }, headers: { "x-clerk-org-id": orgId } }
          ).catch(() => null),
          fetchDeliveryStats({ campaignId: id }, orgId),
        ]);

        return { campaignId: id, leadStats, emailgenStats, delivery };
      })
    );

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
router.get("/campaigns/:id/leads", authenticate, requireOrg, async (req: AuthenticatedRequest, res) => {
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
router.get("/campaigns/:id/emails", authenticate, requireOrg, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // 1. Fetch all generations for this campaign in one call
    const emailsResult = await callService(
      services.emailgen,
      `/generations?campaignId=${id}`,
      {
        headers: { "x-clerk-org-id": req.orgId! },
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

export default router;
