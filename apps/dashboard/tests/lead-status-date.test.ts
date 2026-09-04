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

// Source-substring, not a render test: the component imports through the `@` alias,
// which vitest does not resolve in this repo.
describe("leads table Date column", () => {
  const src = fs.readFileSync(
    path.join(__dirname, "../src/components/audiences/engaged-leads-page.tsx"),
    "utf-8",
  );
  const table = (() => {
    const at = src.indexOf("function LeadsTable(");
    expect(at).toBeGreaterThan(-1);
    return src.slice(at, at + 12000);
  })();

  it("dates the row from the status the row shows, not from the tab", () => {
    expect(table).toContain("const status = statusOf(lead);");
    expect(table).toContain("      : leadDateForStatus(lead, status);");
    expect(table).toContain("<StatusBadge status={status} />");
    // The per-tab date is gone: Outreach dated every row at firstContactedAt, so a
    // row reading "Replied" was dated days before the reply it names.
    expect(src).not.toContain("leadDateForTab");
  });

  it("keeps ONE date per row, read once and rendered in both places", () => {
    // The Date column below `md` folds under the tag; a second, differently-sourced
    // date beside the badge would put two answers on one row.
    expect(table).toContain('className="mt-1 md:hidden">{dateNode}');
    expect(table).not.toContain("statusDateNode");
    expect(table.match(/leadDateForStatus\(lead, status\)/g)?.length).toBe(1);
  });

  it("leaves the outcome tabs on the realized-outcome instant", () => {
    // A signup has no delivery status to date, so those tabs keep the /revenue join's
    // timestamp — the one exception, and it is a different column meaning, not a bug.
    expect(table).toContain("const dateAt = isOutcomeTab(tab)");
    expect(table).toContain("? outcomeDates?.get(lead.id) ?? null");
    expect(table).toContain('hidden md:table-cell">Date</th>');
  });

  it("orders every row by the value the Date column shows", () => {
    // Sorting on a different field than the column displays makes the column read as
    // unordered. That order is the PRODUCER's now — `sort=activity`, newest first on the
    // timestamp that proves each lead's most advanced status, which is what this column
    // renders — because a client-side sort can only order the page it holds, and a page
    // ordered among itself reads as if the whole tab were ordered.
    const q = fs.readFileSync(
      path.resolve(__dirname, "../src/lib/leads-server-page.ts"),
      "utf-8",
    );
    expect(q).toContain('sort: "activity"');
    expect(src).not.toContain("const sortByStatusDate");
    // Membership is what differs per tab, never what a date means — and membership is a
    // bucket the producer answers, so no tab re-sorts anything here.
    expect(q).toContain("bucket: bucketForTab(req.tab)");
  });
});
