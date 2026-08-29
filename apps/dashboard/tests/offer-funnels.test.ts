import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  funnelViews,
  costCoverageNote,
  summariseFunnels,
  unpricedFunnelReasonLabel,
} from "../src/lib/offer-funnels";
import type { OfferFunnelRow } from "@/lib/api";

function row(over: Partial<OfferFunnelRow> & { funnelKey: string; name: string }): OfferFunnelRow {
  return {
    steps: ["Positive reply", "Meeting booked", "Meeting attended", "Paid client"],
    campaignIds: ["c1"],
    channels: [{ featureSlug: "sales-cold-email-outreach", campaignIds: ["c1"] }],
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
  } as OfferFunnelRow;
}

describe("funnelViews", () => {
  it("carries every served figure through without deriving one", () => {
    const [view] = funnelViews([row({ funnelKey: "sales_meetings_from_conversation", name: "Sales Meeting from Conversation" })]);
    expect(view.roiMultiple).toBe(2.62);
    expect(view.pipelineUsd).toBe(7000);
    expect(view.investedUsd).toBe(2670);
    expect(view.costPerAcquisitionUsd).toBe(953);
    expect(view.costOfAcquisitionPct).toBe(38.2);
    expect(view.campaignCount).toBe(1);
    expect(view.channelSlugs).toEqual(["sales-cold-email-outreach"]);
  });

  it("keeps the producer's order rather than ranking by return", () => {
    // A funnel's place is a fact about the catalogue. Ordering by return would put an
    // unpriced funnel somewhere arbitrary.
    const views = funnelViews([
      row({ funnelKey: "a", name: "A", costEconomics: { roiMultiple: 0.5, costOfAcquisitionPct: null, costPerAcquisitionUsd: null } } as never),
      row({ funnelKey: "b", name: "B" }),
    ]);
    expect(views.map((v) => v.funnelKey)).toEqual(["a", "b"]);
  });

  it("carries the channel SLUG, because the name is the catalogue's to state", () => {
    // Asking the producer for a second copy of a channel's name is how the two come to
    // disagree about one channel. Every other surface resolves it from the catalogue.
    const [view] = funnelViews([
      row({
        funnelKey: "a",
        name: "A",
        channels: [{ featureSlug: "founder-led-closing", campaignIds: [] }],
      } as never),
    ]);
    expect(view.channelSlugs).toEqual(["founder-led-closing"]);
  });

  it("leaves an unpriced funnel's money null, never zero", () => {
    const [view] = funnelViews([
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
    const [view] = funnelViews([
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

describe("unpricedFunnelReasonLabel", () => {
  it("says each reason the producer can send, in words a customer reads", () => {
    for (const reason of [
      "no_channel_funnel",
      "no_economics_declared",
      "funnel_not_declared",
    ]) {
      const label = unpricedFunnelReasonLabel(reason);
      expect(label).not.toBe(reason);
      expect(label.length).toBeGreaterThan(15);
    }
  });

  it("renders a reason we have not met verbatim rather than blank", () => {
    expect(unpricedFunnelReasonLabel("brand_new")).toBe("brand_new");
    expect(unpricedFunnelReasonLabel(null)).toBe("Not priced");
  });
});

describe("costCoverageNote", () => {
  it("says the funnel reads cheap when nothing of the customer's is recorded", () => {
    const note = costCoverageNote("platform_spend_only");
    expect(note).toContain("your own team");
    expect(note).toContain("cheaper");
  });

  it("says nothing extra about a partly-recorded funnel", () => {
    // There WAS a sentence calling the figure a floor. It explained an accounting
    // nuance nobody had asked about, in the middle of a table of numbers.
    expect(costCoverageNote("platform_and_partial_customer_spend")).toBeNull();
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

});

describe("the combined basis is what a customer's own return divides by", () => {
  it("reads the ratios off the combined block, not the charged one", () => {
    // What we charged is not the customer's answer to "what did this funnel cost me":
    // a funnel whose last legs they run themselves would read far cheaper than it is.
    const [view] = funnelViews([
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
    const [view] = funnelViews([
      row({ funnelKey: "a", name: "A", combinedCostEconomics: null, costCoverage: null } as never),
    ]);
    expect(view.investedUsd).toBe(2670);
    expect(view.roiMultiple).toBe(2.62);
    expect(view.customerCostUsd).toBeNull();
  });

});

describe("summariseFunnels", () => {
  it("counts the rows on screen, deriving no metric", () => {
    const views = funnelViews([
      row({ funnelKey: "a", name: "A" }),
      row({ funnelKey: "b", name: "B", priced: false, unpricedReason: "no_channel_funnel" } as never),
    ]);
    expect(summariseFunnels(views)).toEqual({ total: 2, priced: 1 });
  });
});

describe("the page renders served fields and states the gap", () => {
  const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
  const PAGE = read("src/components/funnels/offer-funnels-page.tsx");
  const API = read("src/lib/api.ts");
  const SIDEBAR = read("src/components/context-sidebar.tsx");

  it("reads the one live gateway path", () => {
    // features-service serves this grain under one name, at one path, with one body
    // key. There is nothing left to tolerate: no second path, no 404 fallback.
    expect(API).toContain("`/offers/${offerId}/funnels?${query.toString()}`");
    expect(API).not.toContain("OFFER_FUNNELS_PATHS");
    expect(API).not.toContain("err.status !== 404) throw err");
    expect(API).toContain('query.set("pricing", "net")');
  });

  it("lets every cell sit on the row's middle", () => {
    // The identity cell is the tallest thing in the row (a 32px mark beside two
    // lines, plus the unpriced note when there is one), so it sets the row's
    // height. `align-top` on the <tr> is inherited by every <td>, which parked
    // each figure ~18px above the row's centre while the funnel it belongs to
    // read centred beside it. Dropping it returns the cells to the `middle` a
    // <tr> gives them by default; measured 17.6px off before, 0.3px after, with
    // the row height unchanged.
    expect(PAGE).not.toContain("align-top");
  });

  it("requires the rows under the producer's own key", () => {
    // REQUIRED, not optional: the producer marks `funnels` required, so a body
    // without it is a producer break the parse must state rather than a blank table.
    expect(API).toContain("funnels: z.array(OfferFunnelRowSchema),");
  });

  it("calls this grain a sales funnel and nothing else", () => {
    // One concept, one word, in identifiers and in prose alike.
    const surface = PAGE + read("src/lib/offer-funnels.ts");
    expect(surface).not.toMatch(/chain/i);
  });

  it("renders money through the shared formatters and divides nothing", () => {
    // The return goes through the SAME `RoiCell` the Campaigns table renders, so
    // it is formatted AND coloured one way across both tables rather than by a
    // second copy of the rule here.
    expect(PAGE).toContain("<RoiCell multiple={row.roiMultiple} />");
    expect(PAGE).toContain('import { RoiCell, useCampaignRows }');
    expect(PAGE).not.toMatch(/roiMultiple\s*[*/]/);
    expect(PAGE).not.toMatch(/pipelineUsd\s*\//);
  });

  it("reveals on SETTLE so a failed read cannot skeleton it forever", () => {
    expect(PAGE).toContain("funnels.isPending && !funnels.isError");
  });

  it("states the cost coverage rather than hiding it", () => {
    // The return here counts only platform spend. A page that showed it without saying
    // so would present an optimistic figure as the whole answer.
    expect(PAGE).toContain("costCoverageNote(funnels.data?.costCoverage)");
    expect(PAGE).toContain("{coverage && ");
  });

  it("states the platform / customer split where there is one", () => {
    expect(PAGE).toContain("us · ");
    expect(PAGE).toContain("row.customerCostUsd !== null && row.customerCostUsd > 0");
    // No "At least" marker beside it: it was a word nobody could read.
    expect(PAGE).not.toContain("At least");
  });


  it("walks DOWN to a funnel's own page, which is where its campaigns live", () => {
    // Offer > Funnel > Campaign. The offer no longer lists campaigns at all: it sells
    // through funnels, and a campaign buys one leg of one of them.
    expect(PAGE).toContain("`${basePath}/funnels/${encodeURIComponent(row.funnelKey)}`");
  });

  it("is BOTH the offer Overview's table and a page of its own", () => {
    // The Overview answers "what does this offer return, per funnel" inline; the
    // sidebar entry is how a reader gets to the same table deliberately rather than
    // by scrolling the Overview. One component, two mounts, never two tables.
    const OVERVIEW = read("src/app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx");
    expect(OVERVIEW).toContain("<OfferFunnelsPage embedded />");
    expect(SIDEBAR).toContain('label: "Sales funnels"');
    expect(SIDEBAR).toContain("`${basePath}/funnels`");
  });
});

describe("the campaigns list IS a funnel's page, narrowed by the route", () => {
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

  it("says which funnel it narrowed to, and offers the way back", () => {
    // A list silently showing a third of itself reads as an offer with fewer
    // campaigns than it has.
    expect(CAMPAIGNS_PAGE).toContain("Showing the campaigns carrying");
    expect(CAMPAIGNS_PAGE).toContain("All sales funnels");
  });

  it("lists every campaign when no funnel was named", () => {
    expect(TABLE).toContain("const rows = narrowed");
    expect(TABLE).toContain(": allRows;");
  });
});
