import { Router } from "express";
import { authenticate, requireOrg, requireUser, AuthenticatedRequest } from "../middleware/auth.js";
import { callExternalService, externalServices } from "../lib/service-client.js";
import { LeadSearchRequestSchema } from "../schemas.js";
import { fetchKeySource } from "../lib/billing.js";

const router = Router();

/**
 * POST /v1/leads/search
 * Search for leads via lead-service
 */
router.post("/leads/search", authenticate, requireOrg, requireUser, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = LeadSearchRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    }
    const {
      person_titles,
      organization_locations,
      organization_industries,
      organization_num_employees_ranges,
      per_page,
    } = parsed.data;

    // Resolve keySource from billing-service
    const keySource = await fetchKeySource(req.orgId!);

    const result = await callExternalService(
      externalServices.lead,
      "/search",
      {
        method: "POST",
        headers: { "x-app-id": "mcpfactory", "x-org-id": req.orgId! },
        body: {
          personTitles: person_titles,
          organizationLocations: organization_locations,
          qOrganizationIndustryTagIds: organization_industries,
          organizationNumEmployeesRanges: organization_num_employees_ranges,
          perPage: Math.min(per_page, 100),
          appId: "mcpfactory",
          orgId: req.orgId,
          userId: req.userId,
          keySource,
        },
      }
    );

    res.json(result);
  } catch (error: any) {
    console.error("Lead search error:", error);
    res.status(500).json({ error: error.message || "Failed to search leads" });
  }
});

// POST /v1/leads/enrich removed - no consumers

export default router;
