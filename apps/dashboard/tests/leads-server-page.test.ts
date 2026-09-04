import { describe, it, expect } from "vitest";
import { STANDINGS_BY_COLUMN, leadBoardColumnFor } from "../src/lib/lead-board";
import {
  LEAD_BUCKETS,
  LEAD_STANDINGS,
  LeadStandingCountsSchema,
  boardColumnTotals,
  standingCountsQuery,
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

describe("the standing dimension the board's columns are drawn from", () => {
  const counts = {
    total: 2055,
    counts: {
      unresolved: 0,
      not_contacted: 3,
      contacted: 1965,
      engaged: 1,
      sales_interest: 86,
      customer: 0,
      opted_out: 0,
      disqualified: 0,
    },
  };

  it("sizes a column by ADDING the standings it holds, never by counting fetched rows", () => {
    // A standing is a partition, so the counts are disjoint and their sum is a count of
    // the same kind at the grain this surface renders — a display lookup, not a metric.
    // Sizing a column from whatever a bounded page returned is what made the page state
    // its own cap as a population.
    const totals = boardColumnTotals(counts);
    expect(totals).not.toBeNull();
    expect(totals?.contacted).toBe(1966); // contacted + engaged
    expect(totals?.sales_interest).toBe(86); // sales_interest + customer
    expect(totals?.opt_out).toBe(0);
    expect(totals?.unresolved).toBe(0);
  });

  it("leaves `not_contacted` out of every column, so the board matches the population", () => {
    // There is nothing to show about a lead nobody wrote to. Its 3 people are in the
    // producer's `total` and in no column, which is what the board draws.
    const totals = boardColumnTotals(counts);
    const drawn = Object.values(totals ?? {}).reduce((a, b) => a + b, 0);
    expect(drawn).toBe(counts.total - counts.counts.not_contacted);
    expect(Object.values(STANDINGS_BY_COLUMN).flat()).not.toContain("not_contacted");
  });

  it("is unsettled, never zero, when the counts have not landed", () => {
    // A column whose size we have not been told is not a column with nobody in it.
    expect(boardColumnTotals(undefined)).toBeNull();
  });

  it("holds the SAME standing→column mapping the cards are placed by", () => {
    // Two tables for one statement is how a column head and the cards under it come to
    // disagree. Every standing goes through both and has to land in the same place.
    for (const state of LEAD_STANDINGS) {
      const viaCard = leadBoardColumnFor({ state, signal: "none" });
      const viaTable =
        (Object.entries(STANDINGS_BY_COLUMN) as [string, readonly string[]][]).find(
          ([, states]) => states.includes(state),
        )?.[0] ?? null;
      expect(viaTable).toBe(viaCard);
    }
  });

  it("carries the search onto the counts, and nothing else", () => {
    expect(standingCountsQuery("")).toEqual({});
    expect(standingCountsQuery("  ")).toEqual({});
    expect(standingCountsQuery("jane acme")).toEqual({ q: "jane acme" });
    // A search the producer would refuse is not sent at all, exactly as on the list.
    expect(standingCountsQuery("a b c d e f g h i")).toEqual({});
  });

  it("parses the counts with every state required — an absent key is a wrong number", () => {
    expect(LeadStandingCountsSchema.safeParse(counts).success).toBe(true);
    const missing = { total: 1, counts: { ...counts.counts } } as Record<string, unknown>;
    delete (missing.counts as Record<string, unknown>).opted_out;
    expect(LeadStandingCountsSchema.safeParse(missing).success).toBe(false);
  });
});
