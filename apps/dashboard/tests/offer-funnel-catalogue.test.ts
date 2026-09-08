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
import type { FleetFunnelReturnPair } from "../src/lib/api";

const read = (rel: string) =>
  fs.readFileSync(path.join(__dirname, "..", "src", rel), "utf8");

/** Source minus its comments: a guard about COPY must not read the prose about it. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const PAGE = read("components/funnels/offer-funnels-page.tsx");
const CARD = read("components/funnels/offer-funnel-catalogue.tsx");
const LIB = read("lib/offer-funnel-catalogue.ts");
const API = read("lib/api.ts");
const PERSIST = read("lib/persist-cache.ts");

/** A pair shaped exactly as features-service serves one on the median read. */
function pair(
  channelSlug: string,
  funnelKey: string,
  median: {
    medianReturnPerDollar?: number | null;
    medianCostPerPaidClientUsd?: number | null;
    brandCount?: number | null;
    channelName?: string | null;
  } | null,
): FleetFunnelReturnPair {
  // `median === null` is the producer's own unmeasured answer: every figure null, a
  // reason stated, and the brand count present even though it is too small to state one.
  return {
    channelSlug,
    channelName: median?.channelName ?? null,
    funnelKey,
    measured: median !== null,
    reason: median === null ? "not_enough_brands" : null,
    brandCount: median === null ? 2 : (median.brandCount ?? null),
    medianReturnPerDollar: median?.medianReturnPerDollar ?? null,
    medianCostPerPaidClientUsd: median?.medianCostPerPaidClientUsd ?? null,
    costPerPaidClientBrandCount: median === null ? 0 : (median.brandCount ?? 0),
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
      medianReturnPerDollar: 0.7,
      medianCostPerPaidClientUsd: 2551,
      brandCount: 27,
    }),
    pair("best-channel", "sales_meetings_from_conversation", {
      medianReturnPerDollar: 4.2,
      medianCostPerPaidClientUsd: 300,
      brandCount: 3,
      channelName: "Best Channel",
    }),
    pair("other-funnel", "form_magnet", {
      medianReturnPerDollar: 99,
      medianCostPerPaidClientUsd: 1,
      brandCount: 9,
    }),
  ];

  it("takes the BEST channel, never an average across them", () => {
    const best = bestFleetEconomics(pairs, "reply_meeting");
    expect(best?.channelSlug).toBe("best-channel");
    expect(best?.medianReturnPerDollar).toBe(4.2);
  });

  it("reads the price, the name and the count off the SAME pair as the return", () => {
    const best = bestFleetEconomics(pairs, "reply_meeting");
    // Not the other channel's $2551 / 27 clients: one card, one row.
    expect(best?.medianCostPerPaidClientUsd).toBe(300);
    expect(best?.brandCount).toBe(3);
    expect(best?.channelName).toBe("Best Channel");
  });

  it("matches the funnel under either wire spelling", () => {
    expect(bestFleetEconomics(pairs, "visit_form")?.channelSlug).toBe("other-funnel");
  });

  it("answers null when the fleet measured nothing for that funnel", () => {
    expect(bestFleetEconomics(pairs, "visit_signup")).toBeNull();
  });

  it("skips a pair the producer reports UNMEASURED, and never reads its nulls as zero", () => {
    // Too few clients past the spend floor. The pair still carries a brand count; a
    // median taken over it would describe nobody, which is why the producer withholds it.
    const only = [pair("x", "form_magnet", null)];
    expect(bestFleetEconomics(only, "visit_form")).toBeNull();
  });

  it("skips a measured pair carrying no median return, and never invents one", () => {
    const only = [
      pair("x", "sales_meetings_from_website", {
        medianReturnPerDollar: null,
        medianCostPerPaidClientUsd: null,
      }),
    ];
    expect(bestFleetEconomics(only, "visit_meeting")).toBeNull();
  });

  it("keeps a return whose cost per paying client the producer could not state", () => {
    // The cost needs one ingredient the return does not (the client's lifetime revenue
    // per customer), so it is stated on its own population and can legitimately be null.
    const only = [
      pair("x", "form_magnet", {
        medianReturnPerDollar: 2,
        medianCostPerPaidClientUsd: null,
        brandCount: 4,
      }),
    ];
    const best = bestFleetEconomics(only, "visit_form");
    expect(best?.medianReturnPerDollar).toBe(2);
    expect(best?.medianCostPerPaidClientUsd).toBeNull();
  });
});

describe("fleetFunnelState", () => {
  const measured = [
    pair("c", "form_magnet", {
      medianReturnPerDollar: 7,
      medianCostPerPaidClientUsd: 253,
      brandCount: 27,
    }),
  ];

  it("is null while the read is in flight, so the card draws a skeleton", () => {
    expect(
      fleetFunnelState({ pairs: undefined, funnelKey: "visit_form", settled: false, errored: false }),
    ).toBeNull();
  });

  it("says UNREAD on a failed read, never that the fleet has too little data", () => {
    expect(
      fleetFunnelState({ pairs: undefined, funnelKey: "visit_form", settled: true, errored: true }),
    ).toEqual({ kind: "unread" });
  });

  it("says THIN once the read settles with no measured pair for that funnel", () => {
    expect(
      fleetFunnelState({ pairs: [], funnelKey: "visit_form", settled: true, errored: false }),
    ).toEqual({ kind: "thin" });
  });

  it("says THIN on the producer's own unmeasured verdict", () => {
    expect(
      fleetFunnelState({
        pairs: [pair("c", "form_magnet", null)],
        funnelKey: "visit_form",
        settled: true,
        errored: false,
      }),
    ).toEqual({ kind: "thin" });
  });

  it("states the served medians when there is a measured pair", () => {
    expect(
      fleetFunnelState({ pairs: measured, funnelKey: "visit_form", settled: true, errored: false }),
    ).toEqual({
      kind: "measured",
      channelSlug: "c",
      channelName: null,
      medianReturnPerDollar: 7,
      medianCostPerPaidClientUsd: 253,
      brandCount: 27,
    });
  });
});

describe("the shape features-service actually serves", () => {
  // Captured verbatim from prod through the gateway on 2026-09-08, the day the read
  // shipped: GET /v1/public/features/funnel-return-on-spend. Pinned because a reader is
  // only ever as right as the body it was written against, and every pair was UNMEASURED
  // that day (the snapshot warms off the read), so the branch a customer sees first is
  // exactly the one no hand-written fixture would have thought to cover.
  const PROD_UNMEASURED = {
    channelSlug: "sales-cold-email-outreach",
    channelName: "Sales Cold Email Outreach",
    funnelKey: "sales_meetings_from_conversation",
    funnelName: "Sales Meeting from Conversation",
    funnelSteps: ["Positive reply", "Meeting booked", "Meeting attended", "Paid client"],
    computedAt: null,
    measured: false,
    reason: "no_snapshot_yet",
    minSpendUsd: 100,
    brandCount: 0,
    medianReturnPerDollar: null,
    p25ReturnPerDollar: null,
    p75ReturnPerDollar: null,
    minReturnPerDollar: null,
    maxReturnPerDollar: null,
    medianCostPerPaidClientUsd: null,
    costPerPaidClientBrandCount: 0,
  } as unknown as FleetFunnelReturnPair;

  it("states THIN on the real body, and never a zero return from its nulls", () => {
    const state = fleetFunnelState({
      pairs: [PROD_UNMEASURED],
      funnelKey: "reply_meeting",
      settled: true,
      errored: false,
    });
    expect(state).toEqual({ kind: "thin" });
  });

  it("reads a pair carrying the fields the producer serves beside the ones we declare", () => {
    // p25 / p75 / min / max / computedAt / funnelName are the producer's own and are
    // deliberately not mirrored. Carrying them must not disturb the reader.
    const measuredPair = {
      ...PROD_UNMEASURED,
      measured: true,
      reason: null,
      brandCount: 9,
      medianReturnPerDollar: 2.4,
      p25ReturnPerDollar: 0.4,
      p75ReturnPerDollar: 8.1,
      medianCostPerPaidClientUsd: 1240,
      costPerPaidClientBrandCount: 6,
      computedAt: "2026-09-08T21:00:00.000Z",
    } as unknown as FleetFunnelReturnPair;
    expect(bestFleetEconomics([measuredPair], "reply_meeting")).toEqual({
      channelSlug: "sales-cold-email-outreach",
      channelName: "Sales Cold Email Outreach",
      medianReturnPerDollar: 2.4,
      medianCostPerPaidClientUsd: 1240,
      brandCount: 9,
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

  it("labels the figure `Median return`, never `ROI` and never a mean", () => {
    // The table above states this offer's REALIZED return. One word for two bases on
    // one screen is the surface contradicting itself. And the statistic is the MIDDLE
    // client, so a label that reads as an average would describe a figure we do not have.
    expect(CARD).toContain("Median return");
    expect(CARD).not.toContain(">ROI<");
    expect(stripComments(CARD)).not.toMatch(/\b(average|mean|avg)\b/i);
  });

  it("reads the MEDIAN endpoint, never the projected price list beside it", () => {
    // The old read prices a funnel through the fleet's MEAN declared rates and its MEAN
    // lifetime revenue, so it describes no client. It still exists for the leg price tag;
    // this surface must not go back to it.
    expect(CARD).toContain("getFleetFunnelReturn");
    expect(CARD).not.toContain("getChannelFunnelEconomics");
    expect(CARD).not.toContain("returnPerDollar");
    expect(CARD).not.toContain("costPerSaleUsd");
  });

  it("states a TAG when the fleet has too little behind a funnel, and no figure", () => {
    expect(CARD).toContain("Not enough data yet");
    // The refusal is the whole statement. Naming the floor, or how many clients are
    // behind it, answers a question nobody asked and invites the reader to do our
    // bookkeeping for us.
    const body = stripComments(CARD);
    const tag = body.slice(body.indexOf('state.kind === "thin"'), body.indexOf("const channel ="));
    expect(tag).not.toMatch(/brandCount|minSpendUsd|spend floor|\$100|clients/);
    // A pill, bordered on every side: a side-only accent is banned repo-wide.
    expect(tag).toContain("rounded-full border border-brand-200");
  });

  it("explains BOTH figures: `$ CAC` carries its own (i), like the return beside it", () => {
    expect(CARD).toContain("<InfoTooltip tip={RETURN_TIP} />");
    expect(CARD).toContain("<InfoTooltip tip={CAC_TIP} />");
    const cacCell = CARD.slice(CARD.indexOf("$ CAC"), CARD.indexOf("via {channelName}"));
    expect(cacCell).toContain("<InfoTooltip tip={CAC_TIP} />");
  });

  it("says both tips are the fleet's MEDIAN and neither is a quote for this offer", () => {
    const tips = CARD.slice(CARD.indexOf("const RETURN_TIP"), CARD.indexOf("/**"));
    expect(tips).toContain("median across our clients");
    expect(tips).toContain("median across those clients");
    expect(tips).not.toContain("—");
    // No floor, no client count, no bookkeeping of ours in copy a customer reads.
    expect(tips).not.toMatch(/\$100|spend floor|at least \d+ client/i);
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

  it("polls the offer's declaration and the fleet median, and nothing else", () => {
    expect(CARD).toContain('["offerSalesFunnels", brandId, offerId]');
    expect(CARD).toContain('["fleetFunnelReturn"]');
  });
});

describe("the median reader declares what the card renders", () => {
  it("carries the verdict, both medians and the client count behind the return", () => {
    expect(API).toContain("measured: z.boolean()");
    expect(API).toContain("medianReturnPerDollar: z.number().nullish()");
    expect(API).toContain("medianCostPerPaidClientUsd: z.number().nullish()");
    expect(API).toContain("brandCount: z.number().nullish()");
  });

  it("declares every figure `.nullish()`, because the producer MEANS to send the nulls", () => {
    // Required-and-nullable on the wire: `.optional()` parses every body except the
    // unmeasured ones, which are exactly the bodies those fields exist for.
    const reader = API.slice(
      API.indexOf("const FleetFunnelReturnSchema"),
      API.indexOf("export async function getFleetFunnelReturn"),
    );
    expect(reader).not.toContain(".optional()");
  });

  it("keeps the projected price list, whose leg price tag still reads it", () => {
    expect(API).toContain("export async function getChannelFunnelEconomics");
  });
});

describe("the fleet median is cached to disk like every other public fleet read", () => {
  it("allowlists its root, or the cards cold-skeleton on every visit", () => {
    expect(PERSIST).toContain('"fleetFunnelReturn"');
  });
});
