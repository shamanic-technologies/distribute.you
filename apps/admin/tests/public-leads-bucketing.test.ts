import { describe, it, expect } from "vitest";
import {
  bucketRowsByStatus,
  matchesPublicReportStatus,
  type PublicReportStatus,
} from "../src/lib/public-report-bucketing";
import type { LeadRow } from "../src/components/report/leads-table";

function makeRow(overrides: Partial<LeadRow> = {}): LeadRow {
  return {
    email: "alice@example.com",
    firstName: "Alice",
    lastName: "Doe",
    title: "",
    company: "",
    companyDomain: "",
    industry: "",
    country: "",
    city: "",
    companyEmployees: null,
    linkedinUrl: null,
    status: "served",
    intakeStatus: "served",
    emailStatus: "",
    workflow: "",
    campaignId: "campaign-uuid",
    contacted: false,
    sent: false,
    delivered: false,
    opened: false,
    clicked: false,
    bounced: false,
    unsubscribed: false,
    replied: false,
    replyClassification: null,
    globalBounced: false,
    globalUnsubscribed: false,
    servedAt: null,
    lastDeliveredAt: null,
    ...overrides,
  };
}

const ORDER: readonly PublicReportStatus[] = [
  "positive-reply",
  "clicked",
  "opened",
  "delivered",
  "sent",
  "bounced",
  "unsubscribed",
  "contacted",
  "served",
  "skipped",
  "claimed",
  "buffered",
];

describe("bucketRowsByStatus", () => {
  it("places a positive-replied lead with full funnel flags into every funnel bucket up to Positive reply", () => {
    const row = makeRow({
      intakeStatus: "served",
      contacted: true,
      sent: true,
      delivered: true,
      opened: true,
      clicked: true,
      replied: true,
      replyClassification: "positive",
    });
    const groups = bucketRowsByStatus([row], ORDER);
    expect(groups.get("positive-reply")?.length).toBe(1);
    expect(groups.get("clicked")?.length).toBe(1);
    expect(groups.get("opened")?.length).toBe(1);
    expect(groups.get("delivered")?.length).toBe(1);
    expect(groups.get("sent")?.length).toBe(1);
    expect(groups.get("contacted")?.length).toBe(1);
    expect(groups.get("served")?.length).toBe(1);
  });

  it("places a lead with only sent=true into Sent only", () => {
    const row = makeRow({ contacted: true, sent: true });
    const groups = bucketRowsByStatus([row], ORDER);
    expect(groups.get("sent")?.length).toBe(1);
    expect(groups.get("delivered")?.length).toBe(0);
    expect(groups.get("opened")?.length).toBe(0);
    expect(groups.get("clicked")?.length).toBe(0);
    expect(groups.get("positive-reply")?.length).toBe(0);
    expect(groups.get("contacted")?.length).toBe(1);
  });

  it("excludes a negative-reply lead from the Positive reply bucket but keeps earlier funnel buckets", () => {
    const row = makeRow({
      contacted: true,
      sent: true,
      delivered: true,
      opened: true,
      clicked: true,
      replied: true,
      replyClassification: "negative",
    });
    const groups = bucketRowsByStatus([row], ORDER);
    expect(groups.get("positive-reply")?.length).toBe(0);
    expect(groups.get("clicked")?.length).toBe(1);
    expect(groups.get("opened")?.length).toBe(1);
    expect(groups.get("delivered")?.length).toBe(1);
    expect(groups.get("sent")?.length).toBe(1);
  });

  it("funnel-parity invariant: bucket size for a boolean status equals count of leads with that flag true", () => {
    const rows = [
      makeRow({ sent: true, delivered: true, opened: true, clicked: true }),
      makeRow({ sent: true, delivered: true, opened: true }),
      makeRow({ sent: true, delivered: true }),
      makeRow({ sent: true }),
      makeRow({ sent: false }),
    ];
    const groups = bucketRowsByStatus(rows, ORDER);
    expect(groups.get("sent")?.length).toBe(rows.filter((r) => r.sent).length);
    expect(groups.get("delivered")?.length).toBe(rows.filter((r) => r.delivered).length);
    expect(groups.get("opened")?.length).toBe(rows.filter((r) => r.opened).length);
    expect(groups.get("clicked")?.length).toBe(rows.filter((r) => r.clicked).length);
  });

  it("intake buckets use intakeStatus equality", () => {
    const served = makeRow({ intakeStatus: "served", email: "a@x.com" });
    const buffered = makeRow({ intakeStatus: "buffered", email: "b@x.com" });
    const skipped = makeRow({ intakeStatus: "skipped", email: "c@x.com" });
    const claimed = makeRow({ intakeStatus: "claimed", email: "d@x.com" });
    const groups = bucketRowsByStatus([served, buffered, skipped, claimed], ORDER);
    expect(groups.get("served")?.map((r) => r.email)).toEqual(["a@x.com"]);
    expect(groups.get("buffered")?.map((r) => r.email)).toEqual(["b@x.com"]);
    expect(groups.get("skipped")?.map((r) => r.email)).toEqual(["c@x.com"]);
    expect(groups.get("claimed")?.map((r) => r.email)).toEqual(["d@x.com"]);
  });

  it("a served lead that progressed to Sent still appears in Served (intake stays cumulative)", () => {
    const row = makeRow({
      intakeStatus: "served",
      status: "sent",
      contacted: true,
      sent: true,
    });
    const groups = bucketRowsByStatus([row], ORDER);
    expect(groups.get("served")?.length).toBe(1);
    expect(groups.get("sent")?.length).toBe(1);
    expect(groups.get("contacted")?.length).toBe(1);
  });
});

describe("matchesPublicReportStatus", () => {
  it("positive-reply requires both replied=true AND replyClassification='positive'", () => {
    const repliedNoClass = makeRow({ replied: true, replyClassification: null });
    const repliedNeutral = makeRow({ replied: true, replyClassification: "neutral" });
    const repliedPositive = makeRow({ replied: true, replyClassification: "positive" });
    expect(matchesPublicReportStatus(repliedNoClass, "positive-reply")).toBe(false);
    expect(matchesPublicReportStatus(repliedNeutral, "positive-reply")).toBe(false);
    expect(matchesPublicReportStatus(repliedPositive, "positive-reply")).toBe(true);
  });
});
