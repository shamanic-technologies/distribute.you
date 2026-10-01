import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { leadDateForStatus, type Lead, type LeadConsolidatedStatus } from "../src/lib/api";

// The Status column used to sit beside a per-TAB date, so a row reading "Replied"
// showed the date it was handed to Instantly — two events, one row, nothing saying
// which was which. The badge now states its own date.

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
    firstContactedAt: "2025-01-02T00:00:00Z",
    firstSentAt: "2025-01-03T00:00:00Z",
    firstDeliveredAt: "2025-01-04T00:00:00Z",
    firstClickedAt: "2025-01-05T00:00:00Z",
    firstRepliedAt: "2025-01-06T00:00:00Z",
    firstBouncedAt: "2025-01-07T00:00:00Z",
    firstUnsubscribedAt: "2025-01-08T00:00:00Z",
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

describe("leadDateForStatus", () => {
  const cases: Array<[LeadConsolidatedStatus, string | null]> = [
    ["replied", "2025-01-06T00:00:00Z"],
    ["clicked", "2025-01-05T00:00:00Z"],
    ["delivered", "2025-01-04T00:00:00Z"],
    ["sent", "2025-01-03T00:00:00Z"],
    ["bounced", "2025-01-07T00:00:00Z"],
    ["unsubscribed", "2025-01-08T00:00:00Z"],
    ["contacted", "2025-01-02T00:00:00Z"],
    ["served", "2025-01-01T00:00:00Z"],
  ];

  it.each(cases)("reads the timestamp that proves %s", (status, expected) => {
    expect(leadDateForStatus(makeLead(), status)).toBe(expected);
  });

  // The three pre-serve states carry no timestamp on the wire. Returning null is
  // what lets the cell render the tag alone; a substitute date would claim a
  // moment nobody recorded.
  it.each(["skipped", "claimed", "buffered"] as const)("has no timestamp for %s", (status) => {
    expect(leadDateForStatus(makeLead(), status)).toBeNull();
  });

  // Present on the wire only once lead-service ships them (`.passthrough()` keeps
  // them at runtime, the type has them optional), so an older row must degrade to
  // "no date", never to `undefined` reaching `new Date()`.
  it("returns null rather than undefined when the field is absent", () => {
    const lead = makeLead({ firstRepliedAt: undefined, firstClickedAt: null });
    expect(leadDateForStatus(lead, "replied")).toBeNull();
    expect(leadDateForStatus(lead, "clicked")).toBeNull();
  });

  // A lead that replied is also contacted/sent/clicked, so every branch is
  // reachable on one row — the badge picks the status, this picks its date.
  it("follows the badge, not the most recent event on the row", () => {
    const lead = makeLead({ contacted: true, sent: true, clicked: true, replied: true });
    expect(leadDateForStatus(lead, "contacted")).toBe("2025-01-02T00:00:00Z");
    expect(leadDateForStatus(lead, "replied")).toBe("2025-01-06T00:00:00Z");
  });
});

describe("leads ordering", () => {
  it("asks the producer to order every row by its most advanced status's instant", () => {
    // That order is the PRODUCER's — `sort=activity`, newest first on the timestamp
    // that proves each lead's most advanced status — because a client-side sort can
    // only order the page it holds.
    const q = fs.readFileSync(
      path.resolve(__dirname, "../src/lib/leads-server-page.ts"),
      "utf-8",
    );
    expect(q).toContain('sort: "activity"');
  });
});
