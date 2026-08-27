import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  chainViews,
  costCoverageNote,
  summariseChains,
  unpricedChainReasonLabel,
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
      row({ funnelKey: "a", name: "A", costEconomics: { costOfAcquisitionPct: null, roiMultiple: null, costPerAcquisitionUsd: null } } as never),
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
  it("states that a self-finished funnel reads cheaper than it is", () => {
    // The platform spends nothing on a leg the customer's own team works, so a chain
    // whose last legs are manual is understated here. Saying it is the alternative to
    // presenting an optimistic return as the whole answer.
    const note = costCoverageNote("platform_spend_only");
    expect(note).toContain("your own team");
    expect(note).toContain("cheaper");
  });

  it("says nothing about a coverage it does not know", () => {
    expect(costCoverageNote("something_else")).toBeNull();
    expect(costCoverageNote(null)).toBeNull();
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

  it("says the rows do not add up to the offer", () => {
    expect(PAGE).toContain("do not add up to the offer");
  });

  it("is reachable from the offer sidebar", () => {
    expect(SIDEBAR).toContain('label: "Sales funnels"');
    expect(SIDEBAR).toContain("`${basePath}/chains`");
  });
});
