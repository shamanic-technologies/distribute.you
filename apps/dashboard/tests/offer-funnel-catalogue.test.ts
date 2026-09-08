import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  FUNNEL_BLURB,
  bestFleetEconomics,
  fleetFunnelState,
  undeclaredFunnels,
} from "../src/lib/offer-funnel-catalogue";
import { SALES_FUNNELS } from "../src/lib/sales-funnels";
import type { ChannelFunnelEconomicsPair } from "../src/lib/funnel-leg-price";

const read = (rel: string) =>
  fs.readFileSync(path.join(__dirname, "..", "src", rel), "utf8");

/** Source minus its comments: a guard about COPY must not read the prose about it. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const PAGE = read("components/funnels/offer-funnels-page.tsx");
const CARD = read("components/funnels/offer-funnel-catalogue.tsx");
const LIB = read("lib/offer-funnel-catalogue.ts");
const API = read("lib/api.ts");

/** A measured pair, shaped exactly as features-service serves one. */
function pair(
  channelSlug: string,
  funnelKey: string,
  economics: {
    returnPerDollar?: number | null;
    costPerSaleUsd?: number | null;
    brandCount?: number | null;
  } | null,
): ChannelFunnelEconomicsPair {
  return {
    channelSlug,
    funnelKey,
    funnelSteps: ["a", "b"],
    result: {
      measured: economics !== null,
      economics:
        economics === null
          ? null
          : {
              steps: [{ costPerStepUsd: 1 }, { costPerStepUsd: 2 }],
              returnPerDollar: economics.returnPerDollar ?? null,
              costPerSaleUsd: economics.costPerSaleUsd ?? null,
              evidence: { brandCount: economics.brandCount ?? null },
            },
    },
  };
}

describe("undeclaredFunnels", () => {
  it("subtracts what the offer already stated, in catalogue order", () => {
    const out = undeclaredFunnels(["reply_meeting"]);
    expect(out.map((f) => f.key)).toEqual(["visit_meeting", "visit_signup", "visit_form"]);
  });

  it("reads BOTH wire spellings of a key, so a rename never re-offers a declared funnel", () => {
    expect(undeclaredFunnels(["sales_meetings_from_conversation"]).map((f) => f.key)).toEqual(
      ["visit_meeting", "visit_signup", "visit_form"],
    );
    expect(undeclaredFunnels(["form_magnet"]).map((f) => f.key)).toEqual([
      "reply_meeting",
      "visit_meeting",
      "visit_signup",
    ]);
  });

  it("offers everything when the offer has stated nothing", () => {
    expect(undeclaredFunnels([])).toHaveLength(SALES_FUNNELS.length);
  });

  it("offers NOTHING once all four are declared, so the section disappears", () => {
    expect(undeclaredFunnels(SALES_FUNNELS.map((f) => f.key))).toEqual([]);
  });

  it("counts a declared funnel whether or not it is switched on", () => {
    // The set lists active and inactive alike. A funnel the customer priced and
    // paused is one they have answered about; offering it here would be false.
    expect(undeclaredFunnels(["visit_form"]).map((f) => f.key)).not.toContain("visit_form");
  });

  it("ignores a key this app cannot name rather than throwing the section down", () => {
    expect(() => undeclaredFunnels(["some_future_funnel"])).not.toThrow();
    expect(undeclaredFunnels(["some_future_funnel"])).toHaveLength(SALES_FUNNELS.length);
  });
});

describe("FUNNEL_BLURB", () => {
  it("states one line per catalogue funnel", () => {
    for (const def of SALES_FUNNELS) {
      expect(FUNNEL_BLURB[def.key]).toBeTruthy();
    }
  });

  it("carries no em-dash: it is user-facing copy", () => {
    for (const line of Object.values(FUNNEL_BLURB)) {
      expect(line).not.toContain("—");
    }
  });
});

describe("bestFleetEconomics", () => {
  const pairs = [
    pair("cheap-channel", "sales_meetings_from_conversation", {
      returnPerDollar: 0.7,
      costPerSaleUsd: 2551,
      brandCount: 27,
    }),
    pair("best-channel", "sales_meetings_from_conversation", {
      returnPerDollar: 4.2,
      costPerSaleUsd: 300,
      brandCount: 3,
    }),
    pair("other-funnel", "form_magnet", {
      returnPerDollar: 99,
      costPerSaleUsd: 1,
      brandCount: 9,
    }),
  ];

  it("takes the BEST channel, never an average across them", () => {
    const best = bestFleetEconomics(pairs, "reply_meeting");
    expect(best?.channelSlug).toBe("best-channel");
    expect(best?.returnPerDollar).toBe(4.2);
  });

  it("reads the price and the count off the SAME pair as the return", () => {
    const best = bestFleetEconomics(pairs, "reply_meeting");
    // Not the cheaper channel's $2551 / 27 brands: one card, one row.
    expect(best?.costPerSaleUsd).toBe(300);
    expect(best?.brandCount).toBe(3);
  });

  it("matches the funnel under either wire spelling", () => {
    expect(bestFleetEconomics(pairs, "visit_form")?.channelSlug).toBe("other-funnel");
  });

  it("answers null when the fleet measured nothing for that funnel", () => {
    expect(bestFleetEconomics(pairs, "visit_signup")).toBeNull();
  });

  it("skips an unmeasured pair", () => {
    const only = [pair("x", "form_magnet", null)];
    expect(bestFleetEconomics(only, "visit_form")).toBeNull();
  });

  it("skips a measured pair carrying no return, and never invents one", () => {
    // Prod serves exactly this: measured at the step grain, returnPerDollar null.
    const only = [
      pair("x", "sales_meetings_from_website", { returnPerDollar: null, costPerSaleUsd: null }),
    ];
    expect(bestFleetEconomics(only, "visit_meeting")).toBeNull();
  });

  it("keeps a return whose sale price the producer could not state", () => {
    const only = [
      pair("x", "form_magnet", { returnPerDollar: 2, costPerSaleUsd: null, brandCount: 4 }),
    ];
    const best = bestFleetEconomics(only, "visit_form");
    expect(best?.returnPerDollar).toBe(2);
    expect(best?.costPerSaleUsd).toBeNull();
  });
});

describe("fleetFunnelState", () => {
  const measured = [
    pair("c", "form_magnet", { returnPerDollar: 7, costPerSaleUsd: 253, brandCount: 27 }),
  ];

  it("is null while the price list is in flight, so the card draws a skeleton", () => {
    expect(
      fleetFunnelState({ pairs: undefined, funnelKey: "visit_form", settled: false, errored: false }),
    ).toBeNull();
  });

  it("says UNREAD on a failed read, never that the fleet did not measure it", () => {
    expect(
      fleetFunnelState({ pairs: undefined, funnelKey: "visit_form", settled: true, errored: true }),
    ).toEqual({ kind: "unread" });
  });

  it("says UNMEASURED once the list settles with no measured pair", () => {
    expect(
      fleetFunnelState({ pairs: [], funnelKey: "visit_form", settled: true, errored: false }),
    ).toEqual({ kind: "unmeasured" });
  });

  it("states the served figures when there is a measured pair", () => {
    expect(
      fleetFunnelState({ pairs: measured, funnelKey: "visit_form", settled: true, errored: false }),
    ).toEqual({
      kind: "measured",
      channelSlug: "c",
      returnPerDollar: 7,
      costPerSaleUsd: 253,
      brandCount: 27,
    });
  });
});

describe("the offer funnels page mounts the catalogue", () => {
  it("renders it, and passes the scope plus the way to Offer Settings", () => {
    expect(PAGE).toContain("<OfferFunnelCatalogue");
    expect(PAGE).toContain("brandId={brandId}");
    expect(PAGE).toContain("offerId={offerId}");
    expect(PAGE).toContain("settingsHref={`${basePath}/settings`}");
  });
});

describe("the card states served figures and writes nothing", () => {
  it("has NO writer: declaring a funnel is Offer Settings' card and only that one", () => {
    expect(CARD).not.toContain("declareBrandSalesFunnel");
    expect(CARD).not.toContain("undeclareBrandSalesFunnel");
    expect(CARD).not.toContain("stateOfferSalesFunnels");
    expect(CARD).not.toContain("useMutation");
  });

  it("leads with the CTA onto Offer Settings", () => {
    expect(CARD).toContain("href={settingsHref}");
  });

  it("labels the fleet figure `Fleet return`, never `ROI`", () => {
    // The table above states this offer's REALIZED return. One word for two bases on
    // one screen is the surface contradicting itself.
    expect(CARD).toContain("Fleet return");
    expect(CARD).not.toContain(">ROI<");
  });

  it("formats the return through the ONE roi formatter and money through the adaptive one", () => {
    expect(CARD).toContain("formatRoi(state.returnPerDollar)");
    expect(CARD).toContain("formatUsdAdaptive(state.costPerSaleUsd)");
    expect(CARD).not.toContain("toFixed(");
  });

  it("explains BOTH figures: `$ CAC` carries its own (i), like the return beside it", () => {
    // A figure a reader has never seen on this surface needs its basis stated. The
    // return already carried one; the price it rests on did not, so the card explained
    // half of what it shows.
    expect(CARD).toContain("<InfoTooltip tip={RETURN_TIP} />");
    expect(CARD).toContain("<InfoTooltip tip={CAC_TIP} />");
    // The tip sits with the figure it explains, never in the other cell.
    const cacCell = CARD.slice(CARD.indexOf("$ CAC"), CARD.indexOf("via {channelName}"));
    expect(cacCell).toContain("<InfoTooltip tip={CAC_TIP} />");
  });

  it("says the CAC is the FLEET's price, not this offer's, and names no other basis", () => {
    const tip = CARD.slice(CARD.indexOf("const CAC_TIP"), CARD.indexOf("/**"));
    expect(tip).toContain("paying client");
    expect(tip).toContain("this funnel");
    expect(tip).toContain("not this offer's");
    expect(tip).not.toContain("—");
  });

  it("states `Not measured yet` and no number when the fleet has none", () => {
    expect(CARD).toContain("Not measured yet");
  });

  it("divides nothing: every money figure is read, never computed", () => {
    const body = stripComments(CARD);
    expect(body).not.toMatch(/returnPerDollar\s*\//);
    expect(body).not.toMatch(/costPerSaleUsd\s*\//);
    expect(body).not.toMatch(/Usd\s*\/\s*[a-zA-Z(]/);
    expect(LIB).not.toMatch(/returnPerDollar\s*\/\s*[a-zA-Z(]/);
  });

  it("carries no em-dash and no literal charter hex", () => {
    // Comment-stripped: an em-dash is banned in user-facing COPY, and code comments
    // are exempt, so a whole-file check would fail on the prose explaining the ban.
    expect(stripComments(CARD)).not.toContain("—");
    expect(CARD).not.toMatch(/#[0-9a-fA-F]{6}/);
    expect(CARD).not.toContain("2563eb");
  });

  it("reads the accent off the brand ramp, which rotates with the brand tint", () => {
    expect(CARD).toContain("border-brand-200");
    expect(CARD).toContain("bg-brand-50");
    expect(CARD).toContain("text-brand-600");
  });

  it("reuses the two existing query keys and adds no third", () => {
    expect(CARD).toContain('["offerSalesFunnels", brandId, offerId]');
    expect(CARD).toContain('["channelFunnelEconomics"]');
  });
});

describe("the economics reader declares what the card renders", () => {
  it("carries the pair's return, its sale price and the brand count behind them", () => {
    expect(API).toContain("returnPerDollar: z.number().nullish()");
    expect(API).toContain("costPerSaleUsd: z.number().nullish()");
    expect(API).toContain("evidence: z.object({ brandCount: z.number().nullish() }).nullish()");
  });
});
