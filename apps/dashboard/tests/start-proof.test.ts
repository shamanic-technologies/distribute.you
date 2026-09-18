import { describe, expect, it } from "vitest";
import {
  hotLeadStats,
  NO_COMMITMENT_TAG,
  proofCardsFor,
  reassuranceFor,
  SHOWCASE_PEOPLE,
  type ShowcaseBrand,
} from "../src/lib/start-proof";

// Fixtures are copied off the SERVED prod bodies (features-service v0.170.2,
// 2026-09-18): a showcase funnel's first rung is `contacted`, and the three
// consenting clients read 1.62x, 51.06x and 3.06x.

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

describe("the commitment tag", () => {
  it("is a constant: no path we sell carries a commitment, whatever the channel's 'minimum days' says", () => {
    expect(NO_COMMITMENT_TAG).toBe("No commitment");
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

describe("proofCardsFor: the top three named clients by return, floored at the fleet median", () => {
  it("orders by return across EVERY path, not the picked ones, and names the path", () => {
    const cards = proofCardsFor(SHOWCASE, { minReturnPerDollar: null });
    expect(cards.map((c) => [c.domain, c.returnPerDollar, c.funnelName])).toEqual([
      ["opsfolio.com", 51.06, "Form Magnet"],
      ["shockwavecenters.com", 3.0555, "Sales Meeting from Positive Reply"],
      ["docdinners.com", 1.6237, "Sales Meeting from Positive Reply"],
    ]);
    // the person is the map's, never the wire's brand name
    expect(cards[0].person).toBe(SHOWCASE_PEOPLE["opsfolio.com"]);
  });
  it("drops a card under the floor rather than re-ranking it: a 1.6x beside a '5.2x median' strip is the contradiction the floor exists to stop", () => {
    // prod 2026-09-18: fleet median 5.22x, so only Opsfolio clears it
    expect(proofCardsFor(SHOWCASE, { minReturnPerDollar: 5.22 }).map((c) => c.domain)).toEqual(["opsfolio.com"]);
    // a floor exactly at a card's return keeps it
    expect(proofCardsFor(SHOWCASE, { minReturnPerDollar: 3.0555 }).map((c) => c.domain)).toEqual([
      "opsfolio.com",
      "shockwavecenters.com",
    ]);
  });
  it("draws no card for a brand the people map does not name, whatever its return", () => {
    expect(proofCardsFor(SHOWCASE, { minReturnPerDollar: null }).map((c) => c.domain)).not.toContain("unnamed.example");
  });
  it("leads with the first rung after contact and drops rungs nobody reached", () => {
    const [doc] = proofCardsFor(SHOWCASE, { minReturnPerDollar: null }).filter((c) => c.domain === "docdinners.com");
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
    expect(proofCardsFor(unmeasured, { minReturnPerDollar: null })).toEqual([]);
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
