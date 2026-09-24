import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_BOARD_LAYOUT,
  LEAD_BOARD_COLUMNS,
  columnMoveRefusal,
  funnelBoardLayout,
  movableColumnsFrom,
} from "../src/lib/lead-board";
import {
  LeadStandingCountsSchema,
  boardColumnTotals,
  leadsColumnPageQuery,
  standingCountsQuery,
} from "../src/lib/leads-server-page";

// The board of ONE sales funnel draws a column per funnel step: lead-service splits its
// `sales_interest` standing by stage, a partition, so a booked meeting stops standing in
// the same column as a positive reply.

const counts = {
  total: 120,
  counts: {
    unresolved: 0,
    not_contacted: 10,
    contacted: 50,
    engaged: 20,
    sales_interest: 25,
    customer: 5,
    opted_out: 4,
    disqualified: 6,
  },
  salesInterestStages: [
    { stage: "conversation_reply", count: 18 },
    { stage: "meeting_booked", count: 5 },
    { stage: "meeting_attended", count: 2 },
  ],
};

describe("funnel board layout", () => {
  it("draws the conversation funnel's steps between Leads and Close won", () => {
    const layout = funnelBoardLayout(["conversation_reply", "meeting_booked", "meeting_attended"]);
    expect(layout.columns.map((c) => c.label)).toEqual([
      "Leads",
      "Positive reply",
      "Meeting booked",
      "Meeting attended",
      "Close won",
      "Disqualified",
      "Opt-out",
      "Not placed",
    ]);
    expect(layout.stageOf).toEqual({
      sales_interest: "conversation_reply",
      meeting_booked: "meeting_booked",
      meeting_attended: "meeting_attended",
    });
  });

  it("names the entry column for what it holds on a visit-led funnel", () => {
    const layout = funnelBoardLayout(["website_visit", "signup"]);
    expect(layout.columns.map((c) => c.label)).toEqual([
      "Leads",
      "Website visit",
      "Signup",
      "Close won",
      "Disqualified",
      "Opt-out",
      "Not placed",
    ]);
  });

  it("drops a stage it has no column for rather than guessing one", () => {
    const layout = funnelBoardLayout(["conversation_reply", "ad_click_of_the_future"]);
    expect(layout.columns.map((c) => c.key)).not.toContain("ad_click_of_the_future");
  });

  it("leaves the ordinary board exactly as it was", () => {
    expect(DEFAULT_BOARD_LAYOUT.columns).toBe(LEAD_BOARD_COLUMNS);
    expect(DEFAULT_BOARD_LAYOUT.stageOf).toEqual({});
  });

  it("offers no move INTO a step column: a step is stated on the lead's panel", () => {
    for (const from of LEAD_BOARD_COLUMNS) {
      const keys = movableColumnsFrom(from.key).map((c) => c.key);
      expect(keys).not.toContain("meeting_booked");
    }
    expect(columnMoveRefusal("meeting_booked")).toMatch(/lead's own panel/);
  });
});

describe("funnel board sizes and pages", () => {
  it("parses the served split, and a body without it", () => {
    expect(LeadStandingCountsSchema.parse(counts).salesInterestStages).toHaveLength(3);
    const { salesInterestStages: _omit, ...plain } = counts;
    expect(LeadStandingCountsSchema.parse(plain).salesInterestStages).toBeUndefined();
  });

  it("asks for the split only when told to", () => {
    expect(standingCountsQuery("")).toEqual({});
    expect(standingCountsQuery("", { byStage: true })).toEqual({ breakdown: "stage" });
  });

  it("sizes each step column off its stage, and the board still adds up", () => {
    const layout = funnelBoardLayout(counts.salesInterestStages.map((s) => s.stage));
    const totals = boardColumnTotals(LeadStandingCountsSchema.parse(counts), layout.stageOf)!;
    expect(totals.sales_interest).toBe(18);
    expect(totals.meeting_booked).toBe(5);
    expect(totals.meeting_attended).toBe(2);
    const drawn = layout.columns.reduce((sum, c) => sum + totals[c.key], 0);
    expect(drawn).toBe(counts.total - counts.counts.not_contacted);
  });

  it("pages one step through the producer's stage filter", () => {
    expect(
      leadsColumnPageQuery({ column: "meeting_booked", stage: "meeting_booked", search: "", shown: 20 }),
    ).toMatchObject({ standing: "sales_interest", stage: "meeting_booked", limit: "20" });
    expect(
      leadsColumnPageQuery({ column: "sales_interest", stage: "conversation_reply", search: "", shown: 20 }),
    ).toMatchObject({ standing: "sales_interest", stage: "conversation_reply" });
    // The ordinary board's column carries no stage at all.
    expect(leadsColumnPageQuery({ column: "sales_interest", search: "", shown: 20 })).not.toHaveProperty(
      "stage",
    );
    expect(() => leadsColumnPageQuery({ column: "meeting_booked", search: "", shown: 20 })).toThrow();
  });
});

describe("the funnel page draws the split", () => {
  const page = readFileSync(
    join(__dirname, "../src/components/audiences/engaged-leads-page.tsx"),
    "utf8",
  );
  it("asks for it on a funnel scope and hands the layout to the board", () => {
    expect(page).toContain("const boardByStage = Boolean(funnelScopeKey);");
    expect(page).toContain("funnelBoardLayout(stageList.map((s) => s.stage))");
    expect(page).toContain('useBoardColumnPage(columnArgs("meeting_booked"))');
    expect(page).toContain('useBoardColumnPage(columnArgs("meeting_attended"))');
    const at = page.indexOf("<LeadBoard");
    expect(page.slice(at, page.indexOf("scopeNoun={boardScopeNoun}", at))).toContain(
      "layout={layoutColumns}",
    );
  });
});
