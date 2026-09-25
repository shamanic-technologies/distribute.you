import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  funnelLeadTabs,
  leadsPageQuery,
  tabCount,
  type LeadBucketCounts,
  type LeadStandingCounts,
} from "../src/lib/leads-server-page";

const bucketCounts: LeadBucketCounts = {
  total: 100,
  counts: {
    contacted: 90,
    website_visit: 10,
    positive_reply: 8,
    signup: 0,
    meeting_booked: 4,
    meeting_attended: 3,
    form_submission: 0,
    sale: 1,
  },
};
const standingCounts: LeadStandingCounts = {
  total: 100,
  counts: {
    unresolved: 0,
    not_contacted: 10,
    contacted: 70,
    engaged: 5,
    sales_interest: 8,
    customer: 1,
    opted_out: 2,
    disqualified: 4,
  },
};

describe("a sales funnel's Leads tabs", () => {
  it("walks the reply-to-meeting funnel in its own order, then the two exits", () => {
    expect(
      funnelLeadTabs(["conversation", "meeting_booked", "meeting_attended", "paid_client"]),
    ).toEqual([
      "outreach",
      "positive-replies",
      "meetings",
      "meetings-attended",
      "sales",
      "disqualified",
      "opted-out",
    ]);
  });

  it("maps a visit-led funnel onto its own steps", () => {
    expect(funnelLeadTabs(["website_visit", "form_submitted", "paid_client"])).toEqual([
      "outreach",
      "clicks",
      "form-submissions",
      "sales",
      "disqualified",
      "opted-out",
    ]);
  });

  it("drops a step it has never heard of rather than guessing a tab", () => {
    expect(funnelLeadTabs(["conversation", "a_step_from_the_future"])).toEqual([
      "outreach",
      "positive-replies",
      "disqualified",
      "opted-out",
    ]);
  });
});

describe("what each tab asks lead-service for", () => {
  it("reads a meeting ATTENDED from its own bucket", () => {
    const q = leadsPageQuery({ tab: "meetings-attended", search: "", page: 0 });
    expect(q.bucket).toBe("meeting_attended");
    expect(q.standing).toBeUndefined();
  });

  it("reads the exits as STANDINGS, never as a bucket", () => {
    const d = leadsPageQuery({ tab: "disqualified", search: "acme", page: 2 });
    expect(d).toEqual({
      view: "basic",
      standing: "disqualified",
      sort: "activity",
      q: "acme",
      limit: "50",
      offset: "100",
    });
    expect(leadsPageQuery({ tab: "opted-out", search: "", page: 0 }).standing).toBe(
      "opted_out",
    );
  });

  it("counts a step off the buckets and an exit off the standings", () => {
    expect(tabCount(bucketCounts, "meetings-attended")).toBe(3);
    expect(tabCount(bucketCounts, "sales")).toBe(1);
    expect(tabCount(bucketCounts, "disqualified", standingCounts)).toBe(4);
    expect(tabCount(bucketCounts, "opted-out", standingCounts)).toBe(2);
  });

  it("states no count for an exit whose standings have not settled", () => {
    expect(tabCount(bucketCounts, "disqualified")).toBeNull();
  });
});

describe("the call site", () => {
  const PAGE = readFileSync(
    join(__dirname, "../src/components/audiences/engaged-leads-page.tsx"),
    "utf8",
  );

  it("takes a funnel page's tabs from the route's funnel, never the brand's campaigns", () => {
    expect(PAGE).toContain("const visibleTabs: Tab[] = funnelPageTabs ?? [");
    expect(PAGE).toContain("funnelLeadTabs(");
    expect(PAGE.indexOf("const funnelPageTabs")).toBeLessThan(
      PAGE.indexOf("const visibleTabs"),
    );
  });

  it("reads the standing counts wherever an exit tab is drawn", () => {
    expect(PAGE).toContain("enabled: showBoard || funnelPageTabs != null");
    expect(PAGE).toContain("count: tabCount(bucketCounts, key, standingCounts)");
  });

  it("names the two outcome steps in the funnel's words", () => {
    expect(PAGE).toContain('meetings: "Meeting booked"');
    expect(PAGE).toContain('"meetings-attended": "Meeting attended"');
    expect(PAGE).toContain('sales: "Close won"');
  });

  it("narrows every read to the route's funnel of its offer", () => {
    // lead-service answers `?offerId=&funnelKey=`; the scope carries the pair so the
    // counts, the rows, the board and the export all belong to this funnel.
    expect(PAGE).toContain("? { brandId, funnel: { offerId, funnelKey: funnelScopeKey } }");
    expect(PAGE).toContain("`funnel:${brandId}:${offerId}:${funnelScopeKey}`");
    const API = readFileSync(join(__dirname, "../src/lib/api.ts"), "utf8");
    expect(API).toContain("`&funnelKey=${encodeURIComponent(scope.funnel.funnelKey)}`");
  });
});
