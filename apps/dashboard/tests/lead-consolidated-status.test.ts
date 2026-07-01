import { describe, it, expect } from "vitest";
import { getLeadConsolidatedStatus, type Lead } from "../src/lib/api";

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "test-id",
    leadId: "lead-uuid",
    namespace: "apollo",
    email: "test@example.com",
    apolloPersonId: null,
    emailStatus: null,
    status: "served",
    statusReason: null,
    statusDetails: null,
    parentRunId: null,
    runId: null,
    brandIds: [],
    campaignId: "campaign-uuid",
    orgId: "org-uuid",
    userId: null,
    workflowSlug: null,
    featureSlug: null,
    servedAt: "2025-01-01T00:00:00Z",
    contacted: false,
    sent: false,
    delivered: false,
    clicked: false,
    bounced: false,
    unsubscribed: false,
    replied: false,
    replyClassification: null,
    lastDeliveredAt: null,
    global: { bounced: false, unsubscribed: false },
    lead: null,
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
