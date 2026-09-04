import { describe, it, expect } from "vitest";
import {
  LEAD_BUCKETS,
  LEADS_PAGE_SIZE,
  LeadBucketCountsSchema,
  LeadsPageEnvelopeSchema,
  bucketForTab,
  leadBucketCountsQuery,
  leadsPageQuery,
  leadsSearchParam,
  leadsSearchProblem,
  pageCountFor,
  reachablePopulation,
  tabCount,
} from "../src/lib/leads-server-page";

const counts = {
  total: 12945,
  counts: {
    contacted: 7895,
    website_visit: 45,
    positive_reply: 29,
    signup: 0,
    meeting_booked: 3,
    meeting_attended: 1,
    form_submission: 0,
    sale: 2,
  },
};

describe("tab to bucket", () => {
  it("points every tab at a bucket the producer names", () => {
    for (const tab of [
      "outreach",
      "clicks",
      "positive-replies",
      "signups",
      "meetings",
      "form-submissions",
      "sales",
    ] as const) {
      expect(LEAD_BUCKETS).toContain(bucketForTab(tab));
    }
  });

  it("reads the meetings tab as the BOOKED meeting, not the attended one", () => {
    // `goal-steps` prices that tab on `meetingBooked`; pointing it at the attended
    // bucket would count a smaller population under a label the stat cards already own.
    expect(bucketForTab("meetings")).toBe("meeting_booked");
  });

  it("leaves meeting_attended without a tab rather than inventing one", () => {
    const mapped = (["outreach", "clicks", "positive-replies", "signups", "meetings", "form-submissions", "sales"] as const).map(bucketForTab);
    expect(mapped).not.toContain("meeting_attended");
  });
});

describe("search", () => {
  it("treats a blank box as no search, not as a problem", () => {
    expect(leadsSearchProblem("")).toBeNull();
    expect(leadsSearchProblem("   ")).toBeNull();
    expect(leadsSearchParam("   ")).toBeNull();
  });

  it("refuses locally what the producer would 400, and says why", () => {
    expect(leadsSearchProblem("a".repeat(201))).toMatch(/200 characters/);
    expect(leadsSearchProblem("a b c d e f g h i")).toMatch(/8 words/);
  });

  it("sends nothing rather than a value the producer would refuse", () => {
    expect(leadsSearchParam("a".repeat(201))).toBeNull();
    expect(leadsSearchParam("a b c d e f g h i")).toBeNull();
  });

  it("sends the trimmed value when it is usable", () => {
    expect(leadsSearchParam("  jane acme ")).toBe("jane acme");
  });
});

describe("page query", () => {
  it("names the bucket, the slim view, the activity order and the bound", () => {
    expect(leadsPageQuery({ tab: "positive-replies", search: "", page: 0 })).toEqual({
      view: "basic",
      bucket: "positive_reply",
      sort: "activity",
      limit: String(LEADS_PAGE_SIZE),
    });
  });

  it("omits offset on the first page and states it after", () => {
    expect(leadsPageQuery({ tab: "outreach", search: "", page: 0 }).offset).toBeUndefined();
    expect(leadsPageQuery({ tab: "outreach", search: "", page: 3 }).offset).toBe(String(3 * LEADS_PAGE_SIZE));
  });

  it("never sends a search the producer would refuse", () => {
    expect(leadsPageQuery({ tab: "outreach", search: "   ", page: 0 }).q).toBeUndefined();
    expect(leadsPageQuery({ tab: "outreach", search: "a".repeat(201), page: 0 }).q).toBeUndefined();
    expect(leadsPageQuery({ tab: "outreach", search: "jane", page: 0 }).q).toBe("jane");
  });

  it("asks the counts with the same search and no bucket", () => {
    expect(leadBucketCountsQuery("jane")).toEqual({ q: "jane" });
    expect(leadBucketCountsQuery("")).toEqual({});
  });
});

describe("counts", () => {
  it("parses the producer's body", () => {
    expect(LeadBucketCountsSchema.safeParse(counts).success).toBe(true);
  });

  it("refuses a body missing a bucket rather than reading it as zero", () => {
    const { sale, ...rest } = counts.counts;
    expect(LeadBucketCountsSchema.safeParse({ total: 1, counts: rest }).success).toBe(false);
  });

  it("states a tab's own count, and null while unsettled", () => {
    expect(tabCount(counts, "positive-replies")).toBe(29);
    expect(tabCount(counts, "signups")).toBe(0);
    expect(tabCount(undefined, "outreach")).toBeNull();
  });

  it("reads the reachable population as contacted, never the scoped total", () => {
    expect(reachablePopulation(counts)).toBe(7895);
    expect(reachablePopulation(counts)).not.toBe(counts.total);
    expect(reachablePopulation(undefined)).toBeNull();
  });
});

describe("envelope", () => {
  it("accepts a null nextCursor as the end of the walk", () => {
    expect(LeadsPageEnvelopeSchema.parse({ nextCursor: null, total: 7895 })).toEqual({
      nextCursor: null,
      total: 7895,
    });
  });

  it("accepts the body the producer says may omit total", () => {
    expect(LeadsPageEnvelopeSchema.safeParse({ nextCursor: null }).success).toBe(true);
  });

  it("refuses a body with no nextCursor key at all", () => {
    expect(LeadsPageEnvelopeSchema.safeParse({ total: 3 }).success).toBe(false);
  });
});

describe("pager", () => {
  it("gives an empty tab one page rather than none", () => {
    expect(pageCountFor(0)).toBe(1);
    expect(pageCountFor(null)).toBe(1);
  });

  it("counts pages over the total, not over the loaded rows", () => {
    expect(pageCountFor(7895)).toBe(Math.ceil(7895 / LEADS_PAGE_SIZE));
    expect(pageCountFor(LEADS_PAGE_SIZE)).toBe(1);
    expect(pageCountFor(LEADS_PAGE_SIZE + 1)).toBe(2);
  });
});
