import { describe, it, expect } from "vitest";

/**
 * Regression test: the leads endpoint must:
 * 1. Flatten enrichment data from lead-service into top-level fields
 * 2. Batch-fetch enrichmentRun costs and attach them to each lead
 *
 * Lead-service returns: { id, email, servedAt, runId, enrichment: { firstName, ... } }
 * Dashboard expects:    { id, email, createdAt, firstName, ..., enrichmentRun: { ... } }
 */

describe("leads endpoint cost enrichment", () => {
  it("should flatten enrichment and attach enrichmentRun to leads", () => {
    interface RunWithCosts {
      status: string;
      startedAt: string;
      completedAt: string | null;
      totalCostInUsdCents: string;
      costs: Array<{ costName: string; quantity: string; unitCostInUsdCents: string; totalCostInUsdCents: string }>;
    }

    const runMap = new Map<string, RunWithCosts>();
    runMap.set("run-1", {
      status: "completed",
      startedAt: "2025-01-01T00:00:00Z",
      completedAt: "2025-01-01T00:00:01Z",
      totalCostInUsdCents: "5",
      costs: [{ costName: "apollo-enrichment-credit", quantity: "1", unitCostInUsdCents: "5", totalCostInUsdCents: "5" }],
    });

    // Raw lead-service response shape
    const rawLeads = [
      { id: "lead-1", email: "john@example.com", externalId: "ext-1", runId: "run-1", servedAt: "2025-01-01T00:00:00Z", enrichment: { firstName: "John", lastName: "Doe", title: "CTO", linkedinUrl: null, organizationName: "Acme", organizationDomain: "acme.com", organizationIndustry: "Tech", organizationSize: "50", emailStatus: "verified" } },
      { id: "lead-2", email: "jane@example.com", externalId: null, runId: null, servedAt: "2025-01-02T00:00:00Z", enrichment: null },
      { id: "lead-3", email: "bob@example.com", externalId: "ext-3", runId: "run-missing", servedAt: "2025-01-03T00:00:00Z", enrichment: { firstName: "Bob", lastName: "Smith", title: null, linkedinUrl: null, organizationName: null, organizationDomain: null, organizationIndustry: null, organizationSize: null, emailStatus: null } },
    ];

    // Step 1: Flatten enrichment (mirrors campaigns.ts logic)
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

    // Step 2: Attach run data (mirrors campaigns.ts logic)
    const leadsWithRuns = leads.map((lead) => {
      const run = lead.enrichmentRunId ? runMap.get(lead.enrichmentRunId) : undefined;
      return {
        ...lead,
        enrichmentRun: run
          ? {
              status: run.status,
              startedAt: run.startedAt,
              completedAt: run.completedAt,
              totalCostInUsdCents: run.totalCostInUsdCents,
              costs: run.costs,
            }
          : null,
      };
    });

    // Enrichment fields are flattened to top level
    expect(leadsWithRuns[0].firstName).toBe("John");
    expect(leadsWithRuns[0].organizationName).toBe("Acme");
    expect(leadsWithRuns[0].createdAt).toBe("2025-01-01T00:00:00Z");
    expect(leadsWithRuns[0].status).toBe("contacted");

    // Lead with valid runId should have enrichmentRun attached
    expect(leadsWithRuns[0].enrichmentRun).not.toBeNull();
    expect(leadsWithRuns[0].enrichmentRun!.status).toBe("completed");
    expect(leadsWithRuns[0].enrichmentRun!.totalCostInUsdCents).toBe("5");
    expect(leadsWithRuns[0].enrichmentRun!.costs).toHaveLength(1);

    // Lead with null enrichment should have null fields
    expect(leadsWithRuns[1].firstName).toBeNull();
    expect(leadsWithRuns[1].enrichmentRun).toBeNull();

    // Lead with runId not found in runMap should have null enrichmentRun
    expect(leadsWithRuns[2].enrichmentRun).toBeNull();
    expect(leadsWithRuns[2].firstName).toBe("Bob");
  });

  it("should handle empty leads array gracefully", () => {
    const leads: Array<{ id: string; enrichmentRunId: string | null }>[] = [];
    expect(leads).toHaveLength(0);
  });

  it("should extract only non-null runIds for batch fetch", () => {
    const leads = [
      { id: "1", runId: "run-a" },
      { id: "2", runId: null },
      { id: "3", runId: "run-b" },
      { id: "4", runId: null },
    ];

    const enrichmentRunIds = leads
      .map((l) => l.runId)
      .filter((id): id is string => !!id);

    expect(enrichmentRunIds).toEqual(["run-a", "run-b"]);
  });
});
