import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  channelStepCostUsd,
  legChannelPrice,
  legPriceLabel,
  type ChannelFunnelEconomicsPair,
} from "../src/lib/funnel-leg-price";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
const board = read("src/components/campaigns/funnel-leg-columns-board.tsx");
const page = read("src/components/campaigns/campaigns-page.tsx");
const api = read("src/lib/api.ts");
const persist = read("src/lib/persist-cache.ts");
const fmt = (usd: number) => `$${usd.toFixed(0)}`;

/** The reply funnel as features-service publishes it, priced. */
const measuredPair = (over: Partial<ChannelFunnelEconomicsPair> = {}): ChannelFunnelEconomicsPair => ({
  channelSlug: "sales-cold-email-outreach",
  funnelKey: "sales_meetings_from_conversation",
  funnelSteps: ["Positive reply", "Meeting booked", "Meeting attended", "Paid client"],
  result: {
    measured: true,
    economics: {
      steps: [
        { costPerStepUsd: 227.7 },
        { costPerStepUsd: 709.92 },
        { costPerStepUsd: null },
        { costPerStepUsd: 2555.73 },
      ],
    },
  },
  ...over,
});

const ask = (pairs: ChannelFunnelEconomicsPair[], stepIndex: number, channelSlug = "sales-cold-email-outreach") =>
  channelStepCostUsd({
    pairs,
    channelSlug,
    funnelKey: "sales_meetings_from_conversation",
    stepIndex,
    expectedStepCount: 4,
  });

describe("channelStepCostUsd", () => {
  it("prices the step the arrow lands on", () => {
    expect(ask([measuredPair()], 0)).toBe(227.7);
    expect(ask([measuredPair()], 1)).toBe(709.92);
  });

  it("answers null for a channel the fleet has never spent through", () => {
    const unmeasured = measuredPair({
      channelSlug: "ai-meeting-booking",
      result: { measured: false },
    });
    expect(ask([unmeasured], 1, "ai-meeting-booking")).toBeNull();
  });

  it("answers null for a step the producer could not price, never a zero", () => {
    // `rate_not_declared` — a real served state. A 0 would read as free.
    expect(ask([measuredPair()], 2)).toBeNull();
  });

  it("answers null for a pair it has no row for", () => {
    expect(ask([measuredPair()], 0, "cold-call-outreach")).toBeNull();
  });

  it("refuses the join when the two step lists disagree on length", () => {
    // A different funnel's steps under this funnel's key: an index across them points
    // at a different step, which is a plausible wrong number.
    const short = measuredPair({
      funnelSteps: ["Website visit", "Signup", "Paid client"],
      result: {
        measured: true,
        economics: { steps: [{ costPerStepUsd: 8.66 }, { costPerStepUsd: 157 }, { costPerStepUsd: 1005 }] },
      },
    });
    expect(ask([short], 1)).toBeNull();
  });

  it("answers null for an index past the end", () => {
    expect(ask([measuredPair()], 9)).toBeNull();
  });
});

describe("legChannelPrice", () => {
  it("reads Free for a channel the customer works themselves, measured or not", () => {
    // It needs no read at all, so it states itself on the first paint — `settled` false.
    expect(legChannelPrice({ operatedBy: "customer", costPerStepUsd: null, settled: false })).toEqual({
      kind: "free",
    });
    expect(legChannelPrice({ operatedBy: "customer", costPerStepUsd: 500, settled: true })).toEqual({
      kind: "free",
    });
  });

  it("reads Learning for a platform channel the fleet has not priced", () => {
    expect(legChannelPrice({ operatedBy: "platform", costPerStepUsd: null, settled: true })).toEqual({
      kind: "learning",
    });
    expect(legChannelPrice({ operatedBy: null, costPerStepUsd: null, settled: true })).toEqual({
      kind: "learning",
    });
  });

  it("states the price for a platform channel the fleet has measured", () => {
    expect(legChannelPrice({ operatedBy: "platform", costPerStepUsd: 227.7, settled: true })).toEqual({
      kind: "priced",
      usd: 227.7,
    });
  });

  it("waits before saying Learning — an unsettled read is not a verdict", () => {
    // Answering `learning` here would state something a price then replaces a moment
    // later: the surface contradicting itself. Null draws a skeleton instead.
    expect(legChannelPrice({ operatedBy: "platform", costPerStepUsd: null, settled: false })).toBeNull();
    // A price needs no settle check — having one IS the answer.
    expect(legChannelPrice({ operatedBy: "platform", costPerStepUsd: 227.7, settled: false })).toEqual({
      kind: "priced",
      usd: 227.7,
    });
  });

  it("never turns an absent price into a zero", () => {
    expect(legChannelPrice({ operatedBy: "platform", costPerStepUsd: 0, settled: true })).toEqual({
      kind: "priced",
      usd: 0,
    });
    expect(legChannelPrice({ operatedBy: "platform", costPerStepUsd: null, settled: true })).toEqual({
      kind: "learning",
    });
  });
});

describe("legPriceLabel", () => {
  it("does not spell Learning — the shared tag owns that word", () => {
    const src = readFileSync(join(__dirname, "..", "src/lib/funnel-leg-price.ts"), "utf8");
    const body = src.slice(src.indexOf("export function legPriceLabel"));
    expect(body).not.toContain('"Learning"');
  });

  it("names the step in THIS app's words, not the producer's", () => {
    expect(legPriceLabel({ kind: "priced", usd: 228 }, "Sales interest", fmt)).toBe(
      "$228 / Sales interest",
    );
    expect(legPriceLabel({ kind: "priced", usd: 710 }, "Meeting booked", fmt)).toBe(
      "$710 / Meeting booked",
    );
  });

  it("says Free with no step and no figure", () => {
    expect(legPriceLabel({ kind: "free" }, "Meeting booked", fmt)).toBe("Free");
  });
});

describe("the card states the price", () => {
  it("reads the fleet price list once for the whole board", () => {
    expect(board).toContain('useAuthQuery(["channelFunnelEconomics"]');
    expect(board).toContain("getChannelFunnelEconomics");
  });

  it("persists that read — it is the same answer for every tenant", () => {
    expect(persist).toContain('"channelFunnelEconomics"');
  });

  it("declares the reader narrowly and fails loud on a shape mismatch", () => {
    expect(api).toContain("getChannelFunnelEconomics");
    expect(api).toContain("/public/channel-funnel-economics");
    expect(api).toContain("invalid response shape");
    // No `.default()` / `?? 0` smuggling a price in for an unmeasured pair.
    const body = api.slice(api.indexOf("const ChannelFunnelEconomicsSchema"));
    expect(body.slice(0, 1200)).not.toContain(".default(");
  });

  it("joins by the arrow's own index and names the step from the funnel", () => {
    // Never by the producer's words: it calls the reply funnel's first step "Positive
    // reply" where this app reads "Sales interest".
    expect(board).toContain("stepIndex: toIndex");
    expect(board).toContain("expectedStepCount: funnel.steps.length");
    expect(board).toContain("stepLabel={funnel.steps[col.leg.toIndex]");
  });

  it("wears the brand's tertiary on a tone-tile, never a charter hex", () => {
    const tile = board.slice(board.indexOf("function LegChannelTile("));
    expect(tile).toContain("tone-tile");
    expect(tile).toContain("border-orange-200");
    expect(tile).toContain("bg-orange-50");
    expect(tile).toContain("text-orange-600");
    expect(tile).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  it("says Learning through the SHARED tag when there is no price to state", () => {
    const tile = board.slice(board.indexOf("function LegChannelTile("));
    expect(tile).toContain('price.kind === "learning"');
    expect(tile).toContain("<LearningTag");
    expect(board).toContain('from "@/components/learning-tag"');
    // Never a second spelling of the word: one component owns it everywhere.
    expect(tile).not.toContain('"Learning"');
  });

  it("draws a skeleton, never a verdict, until the price list settles", () => {
    const tile = board.slice(board.indexOf("function LegChannelTile("));
    expect(tile).toContain("price === null ? (");
    expect(tile).toContain("<Skeleton");
    expect(board).toContain("settled: economicsQ.data !== undefined || economicsQ.isError");
  });
});

describe("under ONE funnel the board answers alone", () => {
  it("drops the table there — the board above walks the same arrows", () => {
    expect(page).toContain("{!funnelKey && (");
  });

  it("keeps it at brand and offer grain, where there is no board", () => {
    // Those scopes span several funnels, so `FunnelLegColumnsBoard` never renders and
    // the table is the only answer they have.
    expect(page).toContain("{funnelKey && narrowedFunnel && (");
    expect(page).toContain("<CampaignsTable");
  });
});
