import { describe, it, expect } from "vitest";
import { getLeadConsolidatedStatus, type Lead } from "../src/lib/api";

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "test-id",
    firstName: "Test",
    lastName: "User",
    email: "test@example.com",
    emailStatus: null,
    title: null,
    namespace: null,
    organizationName: null,
    organizationDomain: null,
    organizationIndustry: null,
    organizationSize: null,
    linkedinUrl: null,
    status: "served",
    contacted: false,
    sent: false,
    delivered: false,
    opened: false,
    clicked: false,
    bounced: false,
    replied: false,
    unsubscribed: false,
    global: null,
    createdAt: "2025-01-01T00:00:00Z",
    enrichmentRun: null,
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
