import { describe, expect, it } from "vitest";
import {
  bestWorkflowCostUsd,
  commitmentTag,
  firstStepLine,
  firstStepObjective,
  hotLeadStats,
  proofCardsFor,
  reassuranceFor,
  SHOWCASE_PEOPLE,
  type ShowcaseBrand,
  type WorkflowCostRow,
} from "../src/lib/start-proof";

// Fixtures are copied off the SERVED prod bodies (features-service v0.170.2,
// 2026-09-18): the array key on `workflow-cost-per-outcome` is `workflows`
// (read in the route), a showcase funnel's first rung is `contacted`, and the
// cheapest priced positive reply was $103.01 on a dynasty with 4 of them.

const wf = (slug: string, cost: number | null, replies: number, clicks: number): WorkflowCostRow => ({
  workflowDynastySlug: slug,
  costPerOutcomeUsd: cost,
  observedPositiveReplies: replies,
  observedClicks: clicks,
});

describe("bestWorkflowCostUsd: the cheapest row with at least one observed outcome", () => {
  const rows = [
    wf("rampart", 2.84, 0, 259), // the cheapest per visit, and it produced no reply
    wf("ballad", 103.01, 4, 12),
    wf("lithium", 155.26, 19, 101),
    wf("husk", 0.5, 0, 0), // an explore floor, nothing observed
    wf("broken", null, 3, 3),
  ];
  it("prices a reply only on a workflow that produced one", () => {
    expect(bestWorkflowCostUsd(rows, "positiveReply")).toBe(103.01);
  });
  it("prices a visit on the click-cheapest workflow, whatever its reply count", () => {
    expect(bestWorkflowCostUsd(rows, "websiteVisit")).toBe(2.84);
  });
  it("is null when nothing observed the outcome, never the floor", () => {
    expect(bestWorkflowCostUsd([wf("husk", 0.5, 0, 0)], "positiveReply")).toBeNull();
    expect(bestWorkflowCostUsd([], "websiteVisit")).toBeNull();
  });
});

describe("hotLeadStats: the homepage hero's derivation over the ranked brands", () => {
  const brand = (replies: number, clicks: number, cents: number) => ({
    stats: { recipientsRepliesPositive: replies, recipientsClicked: clicks, totalCostInUsdCents: cents },
  });
  it("sums hot leads and takes the median per-brand price over ONE population", () => {
    const s = hotLeadStats([brand(10, 0, 1000), brand(0, 10, 3000), brand(5, 5, 20000), brand(0, 0, 500)]);
    // three priced brands: $1, $3, $20 per hot lead -> median $3; the zero-lead brand is out
    expect(s).toEqual({ hotLeads: 30, companies: 3, medianCostUsd: 3 });
  });
  it("needs at least two priced brands, or the median is one brand's own price", () => {
    expect(hotLeadStats([brand(10, 0, 1000)])).toBeNull();
  });
  it("reads a null stat as zero, never NaN", () => {
    expect(hotLeadStats([{ stats: { recipientsRepliesPositive: null, recipientsClicked: 2, totalCostInUsdCents: 200 } }, brand(1, 0, 100)]))
      .toEqual({ hotLeads: 3, companies: 2, medianCostUsd: 1 });
  });
});

describe("firstStepObjective + firstStepLine", () => {
  it("prices a reply-led path per reply and a visit-led one per visit", () => {
    expect(firstStepObjective(["conversation", "meeting_booked", "paid_client"])).toBe("positiveReply");
    expect(firstStepObjective(["website_visit", "signup", "paid_client"])).toBe("websiteVisit");
    expect(firstStepObjective(["meeting_attended", "paid_client"])).toBeNull();
    expect(firstStepObjective([])).toBeNull();
  });
  it("states whole dollars in the owner's words", () => {
    expect(firstStepLine("positiveReply", 103.01)).toBe("$103 per positive reply on average");
    expect(firstStepLine("websiteVisit", 2.84)).toBe("$3 per website visit on average");
    expect(firstStepLine("positiveReply", 1591.4)).toBe("$1,591 per positive reply on average");
  });
});

describe("commitmentTag", () => {
  it("names the days, or the absence of a commitment", () => {
    expect(commitmentTag(30)).toBe("30-day commitment");
    expect(commitmentTag(0)).toBe("No commitment");
    expect(commitmentTag(Number.NaN)).toBe("No commitment");
  });
});

const SHOWCASE: ShowcaseBrand[] = [
  {
    brand: { id: "1", name: "Doc Dinners", domain: "docdinners.com" },
    measured: true,
    unmeasuredReason: null,
    funnels: [
      {
        funnelKey: "sales_meetings_from_conversation",
        funnelName: "Sales Meeting from Positive Reply",
        returnPerDollar: 1.6237,
        steps: [
          { key: "contacted", label: "Contacted", peopleReached: 15595, costPerReachUsd: 0.306 },
          { key: "start_to_conversation", label: "Positive reply", peopleReached: 20, costPerReachUsd: 238.65 },
          { key: "conversation_to_meeting_booked", label: "Meeting booked", peopleReached: 3, costPerReachUsd: 1591 },
          { key: "meeting_booked_to_meeting_attended", label: "Meeting attended", peopleReached: 0, costPerReachUsd: null },
          { key: "meeting_attended_to_paid_client", label: "Paid client", peopleReached: 0, costPerReachUsd: null },
        ],
      },
    ],
  },
  {
    brand: { id: "2", name: "Opsfolio", domain: "opsfolio.com" },
    measured: true,
    unmeasuredReason: null,
    funnels: [
      {
        funnelKey: "form_magnet",
        funnelName: "Form Magnet",
        returnPerDollar: 51.06,
        steps: [
          { key: "contacted", label: "Contacted", peopleReached: 2808, costPerReachUsd: 0.1 },
          { key: "start_to_website_visit", label: "Website visit", peopleReached: 147, costPerReachUsd: 2.4 },
        ],
      },
    ],
  },
  {
    brand: { id: "3", name: "Shockwave", domain: "shockwavecenters.com" },
    measured: true,
    unmeasuredReason: null,
    funnels: [
      {
        funnelKey: "sales_meetings_from_conversation",
        funnelName: "Sales Meeting from Positive Reply",
        returnPerDollar: 3.0555,
        steps: [
          { key: "contacted", label: "Contacted", peopleReached: 3497, costPerReachUsd: 0.2 },
          { key: "start_to_conversation", label: "Positive reply", peopleReached: 4, costPerReachUsd: 118 },
        ],
      },
    ],
  },
  {
    brand: { id: "4", name: "Nobody Consented", domain: "unnamed.example" },
    measured: true,
    unmeasuredReason: null,
    funnels: [{ funnelKey: "form_magnet", funnelName: "Form Magnet", returnPerDollar: 99, steps: [] }],
  },
];

describe("proofCardsFor: the named clients on the picked paths, best return first", () => {
  it("joins on the funnel key and orders by return", () => {
    const cards = proofCardsFor(SHOWCASE, ["sales_meetings_from_conversation", "form_magnet"]);
    expect(cards.map((c) => [c.domain, c.returnPerDollar])).toEqual([
      ["opsfolio.com", 51.06],
      ["shockwavecenters.com", 3.0555],
      ["docdinners.com", 1.6237],
    ]);
    // the person is the map's, never the wire's brand name
    expect(cards[0].person).toBe(SHOWCASE_PEOPLE["opsfolio.com"]);
  });
  it("draws no card for a brand the people map does not name, whatever its return", () => {
    const cards = proofCardsFor(SHOWCASE, ["form_magnet"]);
    expect(cards.map((c) => c.domain)).toEqual(["opsfolio.com"]);
  });
  it("draws nothing for a selection none of the named clients ran", () => {
    expect(proofCardsFor(SHOWCASE, ["signups_from_website"])).toEqual([]);
  });
  it("leads with the first rung after contact and drops rungs nobody reached", () => {
    const [doc] = proofCardsFor(SHOWCASE, ["sales_meetings_from_conversation"]).filter((c) => c.domain === "docdinners.com");
    expect(doc.firstStep).toEqual({ label: "Positive reply", costPerReachUsd: 238.65 });
    expect(doc.counts).toEqual([
      { label: "Contacted", peopleReached: 15595 },
      { label: "Positive reply", peopleReached: 20 },
      { label: "Meeting booked", peopleReached: 3 },
    ]);
  });
  it("skips an unmeasured brand and a funnel with no return", () => {
    const unmeasured: ShowcaseBrand[] = [
      { ...SHOWCASE[0], measured: false },
      { ...SHOWCASE[2], funnels: [{ ...SHOWCASE[2].funnels[0], returnPerDollar: null }] },
    ];
    expect(proofCardsFor(unmeasured, ["sales_meetings_from_conversation"])).toEqual([]);
  });
});

describe("reassuranceFor: one fleet figure per question, the homepage hero's three", () => {
  const proof = { hotLeads: { hotLeads: 881, companies: 23, medianCostUsd: 6.2 }, medianReturnPerDollar: 5.2 };
  const fmt = (x: number) => `${x.toFixed(1)}x`;
  it("states the count, then the price, then the return", () => {
    expect(reassuranceFor("outcome", proof, fmt)).toEqual({ figure: "881", label: "hot leads for 23 companies" });
    expect(reassuranceFor("funnels", proof, fmt)).toEqual({ figure: "$6", label: "median cost per hot lead" });
    expect(reassuranceFor("returns", proof, fmt)).toEqual({ figure: "5.2x", label: "median ROI reported" });
  });
  it("falls back to nothing (the founders line) for a figure we do not hold", () => {
    expect(reassuranceFor("returns", { hotLeads: null, medianReturnPerDollar: null }, fmt)).toBeNull();
    expect(reassuranceFor("outcome", null, fmt)).toBeNull();
  });
});
