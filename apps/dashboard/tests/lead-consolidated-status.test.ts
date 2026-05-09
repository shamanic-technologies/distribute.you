import { describe, it, expect } from "vitest";
import { getLeadConsolidatedStatus, type Lead, type LeadApolloEnrichment } from "../src/lib/api";

function makeEnrichment(overrides: Partial<LeadApolloEnrichment> = {}): LeadApolloEnrichment {
  return {
    firstName: "Jane",
    lastName: "Doe",
    organizationName: "Acme",
    organizationDomain: "acme.com",
    organizationLogoUrl: "https://acme.com/logo.png",
    organizationIndustry: "Software",
    organizationSize: "100",
    linkedinUrl: "https://linkedin.com/in/jane",
    title: "Head of Growth",
    headline: "Head of Growth at Acme",
    ...overrides,
  };
}

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "test-id",
    leadId: "lead-1",
    email: "test@example.com",
    emailStatus: null,
    namespace: null,
    apolloPersonId: null,
    parentRunId: null,
    runId: null,
    brandIds: [],
    campaignId: "c1",
    orgId: "o1",
    userId: null,
    workflowSlug: null,
    featureSlug: null,
    servedAt: "2025-01-01T00:00:00Z",
    status: "served",
    contacted: false,
    sent: false,
    delivered: false,
    opened: false,
    clicked: false,
    bounced: false,
    replied: false,
    unsubscribed: false,
    replyClassification: null,
    lastDeliveredAt: null,
    global: null,
    enrichment: makeEnrichment(),
    ...overrides,
  };
}

describe("getLeadConsolidatedStatus", () => {
  it("returns buffered when status is buffered and no delivery booleans", () => {
    const lead = makeLead({ status: "buffered" });
    expect(getLeadConsolidatedStatus(lead)).toBe("buffered");
  });

  it("returns skipped when status is skipped and no delivery booleans", () => {
    const lead = makeLead({ status: "skipped" });
    expect(getLeadConsolidatedStatus(lead)).toBe("skipped");
  });

  it("returns claimed when status is claimed and no delivery booleans", () => {
    const lead = makeLead({ status: "claimed" });
    expect(getLeadConsolidatedStatus(lead)).toBe("claimed");
  });

  it("returns contacted when status is skipped but contacted is true (delivery takes priority)", () => {
    const lead = makeLead({ status: "skipped", contacted: true });
    expect(getLeadConsolidatedStatus(lead)).toBe("contacted");
  });

  it("returns replied when status is buffered but replied is true (delivery takes priority)", () => {
    const lead = makeLead({ status: "buffered", replied: true });
    expect(getLeadConsolidatedStatus(lead)).toBe("replied");
  });

  it("returns served when status is served and no delivery booleans (existing behavior)", () => {
    const lead = makeLead({ status: "served" });
    expect(getLeadConsolidatedStatus(lead)).toBe("served");
  });

  it("returns contacted for contacted=true regardless of status", () => {
    const lead = makeLead({ status: "claimed", contacted: true });
    expect(getLeadConsolidatedStatus(lead)).toBe("contacted");
  });
});

describe("Lead enrichment shape (lead-service v0.13.4 pass-through)", () => {
  it("exposes person + organization data via nested enrichment object", () => {
    const lead = makeLead({
      enrichment: makeEnrichment({
        firstName: "Bob",
        lastName: "Builder",
        organizationName: "Build Co",
        organizationDomain: "build.co",
      }),
    });
    expect(lead.enrichment?.firstName).toBe("Bob");
    expect(lead.enrichment?.lastName).toBe("Builder");
    expect(lead.enrichment?.organizationName).toBe("Build Co");
    expect(lead.enrichment?.organizationDomain).toBe("build.co");
  });

  it("permits null enrichment when Apollo lookup did not resolve", () => {
    const lead = makeLead({ enrichment: null });
    expect(lead.enrichment).toBeNull();
  });

  it("Lead has no top-level firstName / organizationName / enrichmentRun", () => {
    const lead = makeLead();
    expect("firstName" in lead).toBe(false);
    expect("organizationName" in lead).toBe(false);
    expect("enrichmentRun" in lead).toBe(false);
    expect("createdAt" in lead).toBe(false);
  });
});
