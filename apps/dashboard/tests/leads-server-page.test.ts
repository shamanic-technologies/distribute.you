import { describe, it, expect } from "vitest";
import { STANDINGS_BY_COLUMN, leadBoardColumnFor } from "../src/lib/lead-board";
import {
  LEAD_STANDINGS,
  LeadStandingCountsSchema,
  boardColumnTotals,
  standingCountsQuery,
  LeadBucketCountsSchema,
  LeadsPageEnvelopeSchema,
  leadBucketCountsQuery,
  leadsExportQuery,
  leadsSearchParam,
  leadsSearchProblem,
  REACHABLE_BUCKET,
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

describe("counts query", () => {
  it("asks the counts with the same search and no bucket", () => {
    expect(leadBucketCountsQuery("jane")).toEqual({ q: "jane" });
    expect(leadBucketCountsQuery("")).toEqual({});
  });
});

describe("export query", () => {
  it("names NO bound, so the file is the whole matching set", () => {
    // The export reused the PAGE's builder, which always carries `limit=50`, and
    // lead-service honours that on the CSV path exactly as on the JSON one. Measured in
    // production on a brand whose Outreach tab reads 8,135 leads: the download was 50.
    const q = leadsExportQuery({ search: "" });
    expect("limit" in q).toBe(false);
    expect("offset" in q).toBe(false);
  });

  it("is the whole list, so it takes no tab at all", () => {
    // The builder used to take one, and the page passed `activeTab` — so a press on
    // Positive replies downloaded that bucket alone: 20 rows in production under a
    // header reading 16,212, which reads as a file truncated by three orders of
    // magnitude. Owner-decided: every row, whatever tab is open.
    expect(leadsExportQuery({ search: "" })).toEqual({
      view: "basic",
      bucket: REACHABLE_BUCKET,
      sort: "activity",
    });
  });

  it("asks for the population the title states, from ONE constant", () => {
    // If these two ever name different buckets the header states a population the file
    // does not carry, which is the bug this replaced. One constant, so they cannot.
    expect(leadsExportQuery({ search: "" }).bucket).toBe(REACHABLE_BUCKET);
  });

  it("carries the search the table is filtered by, and only when the producer accepts it", () => {
    expect(leadsExportQuery({ search: "jane" }).q).toBe("jane");
    expect(leadsExportQuery({ search: "   " }).q).toBeUndefined();
    expect(leadsExportQuery({ search: "a".repeat(201) }).q).toBeUndefined();
  });
});

describe("counts", () => {
  it("parses the producer's body", () => {
    expect(LeadBucketCountsSchema.safeParse(counts).success).toBe(true);
  });

  it("keeps lead-service's people counts (delivered, interested)", () => {
    const parsed = LeadBucketCountsSchema.parse({ ...counts, people: { delivered: 9, interested: 3 } });
    expect(parsed.people).toEqual({ delivered: 9, interested: 3 });
  });

  it("refuses a body missing a bucket rather than reading it as zero", () => {
    const { sale, ...rest } = counts.counts;
    expect(LeadBucketCountsSchema.safeParse({ total: 1, counts: rest }).success).toBe(false);
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

describe("the standing dimension the board's columns are drawn from", () => {
  const counts = {
    total: 2059,
    counts: {
      unresolved: 0,
      not_contacted: 3,
      contacted: 1965,
      engaged: 1,
      sales_interest: 86,
      customer: 4,
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
    expect(totals?.sales_interest).toBe(86);
    // Its own column since the board grew one — a closed deal is not a warm one, and
    // adding it into the column above stated one fact under another's name.
    expect(totals?.won).toBe(4);
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
