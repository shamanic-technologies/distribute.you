import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  chainViews,
  costCoverageNote,
  summariseChains,
  unpricedChainReasonLabel,
  coverageIsPartial,
} from "../src/lib/offer-chains";
import type { OfferChainRow } from "@/lib/api";

function row(over: Partial<OfferChainRow> & { funnelKey: string; name: string }): OfferChainRow {
  return {
    steps: ["Positive reply", "Meeting booked", "Meeting attended", "Paid client"],
    campaignIds: ["c1"],
    channels: [{ slug: "sales-cold-email-outreach", name: "Sales Cold Email Outreach" }],
    priced: true,
    unpricedReason: null,
    headline: { totalPipelineUsd: 7000 },
    costEconomics: {
      committedCostUsd: 2670,
      costOfAcquisitionPct: 38.2,
      roiMultiple: 2.62,
      costPerAcquisitionUsd: 953,
    },
    customerCost: { declaredCostUsd: 0, statedCount: 0, unstatedCount: 0 },
    costCoverage: "platform_spend_only",
    combinedCostEconomics: {
      platformCommittedCostUsd: 2670,
      customerDeclaredCostUsd: 0,
      committedCostUsd: 2670,
      costOfAcquisitionPct: 38.2,
      roiMultiple: 2.62,
      costPerAcquisitionUsd: 953,
    },
    ...over,
  } as OfferChainRow;
}

describe("chainViews", () => {
  it("carries every served figure through without deriving one", () => {
    const [view] = chainViews([row({ funnelKey: "sales_meetings_from_conversation", name: "Sales Meeting from Conversation" })]);
    expect(view.roiMultiple).toBe(2.62);
    expect(view.pipelineUsd).toBe(7000);
    expect(view.investedUsd).toBe(2670);
    expect(view.costPerAcquisitionUsd).toBe(953);
    expect(view.costOfAcquisitionPct).toBe(38.2);
    expect(view.campaignCount).toBe(1);
    expect(view.channelNames).toEqual(["Sales Cold Email Outreach"]);
  });

  it("keeps the producer's order rather than ranking by return", () => {
    // A chain's place is a fact about the catalogue. Ordering by return would put an
    // unpriced chain somewhere arbitrary.
    const views = chainViews([
      row({ funnelKey: "a", name: "A", costEconomics: { roiMultiple: 0.5, costOfAcquisitionPct: null, costPerAcquisitionUsd: null } } as never),
      row({ funnelKey: "b", name: "B" }),
    ]);
    expect(views.map((v) => v.funnelKey)).toEqual(["a", "b"]);
  });

  it("falls back to the channel slug only when the producer named none", () => {
    const [view] = chainViews([
      row({ funnelKey: "a", name: "A", channels: [{ slug: "founder-led-closing", name: null }] } as never),
    ]);
    expect(view.channelNames).toEqual(["founder-led-closing"]);
  });

  it("leaves an unpriced chain's money null, never zero", () => {
    const [view] = chainViews([
      row({
        funnelKey: "a",
        name: "A",
        priced: false,
        unpricedReason: "no_economics_declared",
        headline: { totalPipelineUsd: null },
        costEconomics: { committedCostUsd: 120, costOfAcquisitionPct: null, roiMultiple: null, costPerAcquisitionUsd: null },
        combinedCostEconomics: {
          platformCommittedCostUsd: 120,
          customerDeclaredCostUsd: 0,
          committedCostUsd: 120,
          costOfAcquisitionPct: null,
          roiMultiple: null,
          costPerAcquisitionUsd: null,
        },
      } as never),
    ]);
    expect(view.priced).toBe(false);
    expect(view.roiMultiple).toBeNull();
    expect(view.pipelineUsd).toBeNull();
    // The SPEND is real in all three unpriced cases: the customer paid it.
    expect(view.investedUsd).toBe(120);
  });

  it("reads an absent committed cost as null rather than zero", () => {
    const [view] = chainViews([
      row({
        funnelKey: "a",
        name: "A",
        costEconomics: { costOfAcquisitionPct: null, roiMultiple: null, costPerAcquisitionUsd: null },
        combinedCostEconomics: null,
      } as never),
    ]);
    expect(view.investedUsd).toBeNull();
  });
});

describe("unpricedChainReasonLabel", () => {
  it("says each reason the producer can send, in words a customer reads", () => {
    for (const reason of ["no_channel_funnel", "no_economics_declared", "chain_not_declared"]) {
      const label = unpricedChainReasonLabel(reason);
      expect(label).not.toBe(reason);
      expect(label.length).toBeGreaterThan(15);
    }
  });

  it("renders a reason we have not met verbatim rather than blank", () => {
    expect(unpricedChainReasonLabel("brand_new")).toBe("brand_new");
    expect(unpricedChainReasonLabel(null)).toBe("Not priced");
  });
});

describe("costCoverageNote", () => {
  it("says the funnel reads cheap when nothing of the customer's is recorded", () => {
    const note = costCoverageNote("platform_spend_only");
    expect(note).toContain("your own team");
    expect(note).toContain("cheaper");
  });

  it("calls a partly-recorded funnel a floor rather than the whole figure", () => {
    const note = costCoverageNote("platform_and_partial_customer_spend");
    expect(note).toContain("floor");
  });

  it("says plainly what a fully-recorded funnel is made of", () => {
    const note = costCoverageNote("platform_and_customer_spend");
    expect(note).toContain("plus what you recorded");
    expect(note).not.toContain("cheaper");
  });

  it("says nothing about a coverage it does not know", () => {
    expect(costCoverageNote("something_else")).toBeNull();
    expect(costCoverageNote(null)).toBeNull();
  });

  it("flags only the partial case as incompletely costed", () => {
    expect(coverageIsPartial("platform_and_partial_customer_spend")).toBe(true);
    expect(coverageIsPartial("platform_and_customer_spend")).toBe(false);
    expect(coverageIsPartial("platform_spend_only")).toBe(false);
    expect(coverageIsPartial(null)).toBe(false);
  });
});

describe("the combined basis is what a customer's own return divides by", () => {
  it("reads the ratios off the combined block, not the charged one", () => {
    // What we charged is not the customer's answer to "what did this funnel cost me":
    // a funnel whose last legs they run themselves would read far cheaper than it is.
    const [view] = chainViews([
      row({
        funnelKey: "a",
        name: "A",
        combinedCostEconomics: {
          platformCommittedCostUsd: 2670,
          customerDeclaredCostUsd: 1330,
          committedCostUsd: 4000,
          costOfAcquisitionPct: 57.1,
          roiMultiple: 1.75,
          costPerAcquisitionUsd: 1428,
        },
      } as never),
    ]);
    expect(view.investedUsd).toBe(4000);
    expect(view.roiMultiple).toBe(1.75);
    expect(view.costPerAcquisitionUsd).toBe(1428);
    // Both halves readable without inferring one from the other.
    expect(view.platformCostUsd).toBe(2670);
    expect(view.customerCostUsd).toBe(1330);
  });

  it("reads the charged block when the producer sends no combined one", () => {
    // Not a fallback that MIXES the two: with nothing declared the producer makes them
    // identical by construction, so this is the same figure and simply keeps working
    // against a body that predates the block.
    const [view] = chainViews([
      row({ funnelKey: "a", name: "A", combinedCostEconomics: null, costCoverage: null } as never),
    ]);
    expect(view.investedUsd).toBe(2670);
    expect(view.roiMultiple).toBe(2.62);
    expect(view.customerCostUsd).toBeNull();
  });

  it("carries the row's own coverage, so a table can mark a floor", () => {
    const [view] = chainViews([
      row({ funnelKey: "a", name: "A", costCoverage: "platform_and_partial_customer_spend" } as never),
    ]);
    expect(view.coverage).toBe("platform_and_partial_customer_spend");
    expect(view.partiallyCosted).toBe(true);
  });
});

describe("summariseChains", () => {
  it("counts the rows on screen, deriving no metric", () => {
    const views = chainViews([
      row({ funnelKey: "a", name: "A" }),
      row({ funnelKey: "b", name: "B", priced: false, unpricedReason: "no_channel_funnel" } as never),
    ]);
    expect(summariseChains(views)).toEqual({ total: 2, priced: 1 });
  });
});

describe("the page renders served fields and states the gap", () => {
  const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
  const PAGE = read("src/components/chains/offer-chains-page.tsx");
  const API = read("src/lib/api.ts");
  const SIDEBAR = read("src/components/context-sidebar.tsx");

  it("reads the offer-chains endpoint at the byte-equal gateway path", () => {
    expect(API).toContain("`/offers/${offerId}/chains?${query.toString()}`");
    expect(API).toContain('query.set("pricing", "net")');
  });

  it("renders money through the shared formatters and divides nothing", () => {
    expect(PAGE).toContain("formatRoi(row.roiMultiple)");
    expect(PAGE).not.toMatch(/roiMultiple\s*[*/]/);
    expect(PAGE).not.toMatch(/pipelineUsd\s*\//);
  });

  it("reveals on SETTLE so a failed read cannot skeleton it forever", () => {
    expect(PAGE).toContain("chains.isPending && !chains.isError");
  });

  it("states the cost coverage rather than hiding it", () => {
    // The return here counts only platform spend. A page that showed it without saying
    // so would present an optimistic figure as the whole answer.
    expect(PAGE).toContain("costCoverageNote(chains.data?.costCoverage)");
    expect(PAGE).toContain("{coverage && ");
  });

  it("states the platform / customer split where there is one", () => {
    expect(PAGE).toContain("us · ");
    expect(PAGE).toContain("row.customerCostUsd !== null && row.customerCostUsd > 0");
    expect(PAGE).toContain("row.partiallyCosted");
  });

  it("says the rows do not add up to the offer", () => {
    expect(PAGE).toContain("do not add up to the offer");
  });

  it("walks DOWN to the campaigns carrying a chain, as a narrowing not a route", () => {
    // Campaigns live under the OFFER. Re-homing them under a funnel segment would
    // break every link that already points at one, so the walk down is a query.
    expect(PAGE).toContain("`${basePath}/campaigns?funnel=${encodeURIComponent(row.funnelKey)}`");
  });

  it("is reachable from the offer sidebar", () => {
    expect(SIDEBAR).toContain('label: "Sales funnels"');
    expect(SIDEBAR).toContain("`${basePath}/chains`");
  });
});

describe("the campaigns list narrows to one chain when it was walked into", () => {
  const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
  const CAMPAIGNS_PAGE = read("src/components/campaigns/campaigns-page.tsx");
  const TABLE = read("src/components/campaigns/campaigns-table.tsx");

  it("filters rows the hook ALREADY fetched, so the walk costs no request", () => {
    // Same query key either way, so the two surfaces cannot disagree about a campaign.
    expect(TABLE).toContain("const { rows: allRows, settled } = useCampaignRows(");
    expect(TABLE).toContain("allRows.filter(");
  });

  it("normalises the funnel key on BOTH sides of the comparison", () => {
    // A funnel key travels under two spellings while the fleet migrates; comparing
    // them raw would silently show nothing and read as an offer with no campaigns.
    expect(TABLE).toContain("normalizeSalesFunnelKey(funnelKey as SalesFunnelKeyWire)");
    expect(TABLE).toContain("normalizeSalesFunnelKey(r.campaign.funnelKey)");
  });

  it("says which chain it narrowed to, and offers the way back", () => {
    // A list silently showing a third of itself reads as an offer with fewer
    // campaigns than it has.
    expect(CAMPAIGNS_PAGE).toContain("Showing the campaigns carrying");
    expect(CAMPAIGNS_PAGE).toContain("Show every campaign");
  });

  it("lists every campaign when no chain was named", () => {
    expect(TABLE).toContain("const rows = narrowed");
    expect(TABLE).toContain(": allRows;");
  });
});
