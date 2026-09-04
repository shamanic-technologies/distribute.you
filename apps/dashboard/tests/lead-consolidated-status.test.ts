import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

  // A bounce can only happen to a message that WAS sent, so lead-service reports both
  // booleans on every bounced lead — 729 of the 732 bounced leads on the campaign that
  // surfaced this. With `sent` tested first, every one of them read "Sent" in the table,
  // on the board card and in the CSV while the panel beside it said the address bounced.
  it("returns bounced when the send that bounced is also flagged sent", () => {
    const lead = makeLead({ contacted: true, sent: true, bounced: true });
    expect(getLeadConsolidatedStatus(lead)).toBe("bounced");
  });

  // The same shape one row down: an unsubscribe requires a message that arrived, so
  // `delivered` is true alongside it and used to win.
  it("returns unsubscribed over delivered", () => {
    const lead = makeLead({ contacted: true, sent: true, delivered: true, unsubscribed: true });
    expect(getLeadConsolidatedStatus(lead)).toBe("unsubscribed");
  });

  // Engagement still outranks a later failure: a lead who answered or came to the site
  // did those things, and a follow-up bouncing does not un-do them.
  it("keeps replied and clicked above bounced", () => {
    expect(getLeadConsolidatedStatus(makeLead({ sent: true, bounced: true, replied: true }))).toBe("replied");
    expect(getLeadConsolidatedStatus(makeLead({ sent: true, bounced: true, clicked: true }))).toBe("clicked");
  });

  // The monotonic latch suppresses a "downgrade", so a priority list still ranking
  // `sent` above `bounced` would pin the row on Sent however the derivation reads.
  it("LEAD_STATUS_ORDER matches the derivation's own precedence", () => {
    const src = readFileSync(
      join(__dirname, "../src/components/audiences/engaged-leads-page.tsx"),
      "utf8",
    );
    const at = src.indexOf("const LEAD_STATUS_ORDER");
    const order = src.slice(at, src.indexOf("];", at));
    const rank = (s: string) => order.indexOf(`"${s}"`);
    expect(rank("bounced")).toBeGreaterThan(-1);
    expect(rank("bounced")).toBeLessThan(rank("sent"));
    expect(rank("bounced")).toBeLessThan(rank("delivered"));
    expect(rank("unsubscribed")).toBeLessThan(rank("delivered"));
    expect(rank("replied")).toBeLessThan(rank("bounced"));
    expect(rank("clicked")).toBeLessThan(rank("bounced"));
  });
});
