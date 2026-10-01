import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFeatureRevenue } from "../src/lib/revenue-parse";
import { NULL_PAIR } from "./fixtures/maturity";

const SRC = join(__dirname, "..", "src");

describe("the separator tier a chart axis draws from is remapped for dark", () => {
  it("globals maps text-gray-200, which is a SEPARATOR rather than text", () => {
    // Left unmapped it is the brightest thing on the dark surface — the documented gap
    // that already bit `text-gray-950` in the other direction. Fixed centrally, once, so
    // every future gridline or axis line drawn from `currentColor` inherits it.
    const globals = readFileSync(join(SRC, "app/globals.css"), "utf8");
    expect(globals).toMatch(/html\.dark \.text-gray-200 \{ color: var\(--dy-border-hi\); \}/);
  });
});

/**
 * The block EXACTLY as production served it — and deliberately from a brand whose scopes
 * CAN differ.
 *
 * The first fixture here came from a brand running ONE campaign identity, where the
 * campaign's spend and the brand's are the same number by construction. Every assertion
 * against it passed whether the producer scoped its spend leg or not, so it could not
 * distinguish a correct answer from an unscoped one — and it did not: features-service's
 * return curve was serving BRAND spend on a campaign-scoped read, which this card's own
 * curve inherited. On the brand below that was $1,342.38 against $369.32, so the card
 * would have drawn $16.57 under a stat row reading $4.56 for the same outcome.
 *
 * So this body comes from brand `f4d73dab` / campaign `647572d9` (2026-09-17 11:23 UTC,
 * after features-service v0.166.3), which runs SEVERAL campaign identities on one
 * feature. The reconciliation below is a real test there: it fails if the producer ever
 * widens the spend leg again.
 */
const PROD_BLOCK = {
  legKey: "start_to_website_visit",
  outcomeStep: {
    key: "website_visit",
    label: "Website visit",
    description: "A buyer lands on the brand's own website.",
  },
  outcomeObserved: true,
  datedOutcomes: 81,
  undatedOutcomes: 0,
  daily: [
    // The leading days carry NO price: spend had started, no outcome had landed, so there
    // was no denominator. Null, never 0 — and the card drops them rather than plotting a
    // free outcome.
    { date: "2026-04-14", costPerOutcomeUsd: null, cumulativeOutcomes: 0, cumulativeSpendUsd: 1.2693824999999999 },
    { date: "2026-04-17", costPerOutcomeUsd: null, cumulativeOutcomes: 0, cumulativeSpendUsd: 5.5512995 },
    { date: "2026-09-15", costPerOutcomeUsd: 4.348017346797751, cumulativeOutcomes: 80, cumulativeSpendUsd: 347.84138774382006 },
    { date: "2026-09-16", costPerOutcomeUsd: 4.367192346797751, cumulativeOutcomes: 80, cumulativeSpendUsd: 349.37538774382006 },
    { date: "2026-09-17", costPerOutcomeUsd: 4.561278270086667, cumulativeOutcomes: 81, cumulativeSpendUsd: 369.4635398770201 },
  ],
};

/** What the same production body reported on the stat row, in cents. */
const PROD_SERVED_COST_CENTS = 455.95061728395063;

/**
 * What that body reported as the CAMPAIGN's committed spend.
 *
 * The curve's final cumulative spend must be this and not the brand's $1,342.38 — the
 * one assertion the single-identity fixture was structurally unable to make.
 */
const PROD_CAMPAIGN_COMMITTED_USD = 369.32;

function revenueBody(extra: Record<string, unknown> = {}) {
  return {
    attributedOutcomes: [],
    featureSlug: "sales-cold-email-outreach",
    headline: { totalPipelineUsd: 2916.99 },
    costEconomics: {
      maturity: NULL_PAIR,
      committedCostUsd: 247.19,
      costOfAcquisitionPct: 8.5,
      roiMultiple: 11.8,
      costPerAcquisitionUsd: 247.19,
    },
    timeSeries: [],
    organizations: [],
    events: [],
    leads: [],
    ...extra,
  };
}

describe("the parser conforms to the body production actually sends", () => {
  it("parses the captured block whole", () => {
    const parsed = parseFeatureRevenue(
      revenueBody({ costPerOutcomeHistory: PROD_BLOCK }),
      "test",
    );
    expect(parsed.costPerOutcomeHistory).toEqual(PROD_BLOCK);
  });

  it("the curve's last point IS the price the stat row prints, as a reader sees it", () => {
    // The producer's own invariant, and the reason this could not be divided in a
    // browser. A reader sees both figures on one screen; they cannot disagree.
    //
    // They agree to the CENT and diverge in the fifth decimal — measured on the captured
    // body, $7.97397 against $7.97355. That is not drift: the stat row divides a spend
    // already rounded to whole cents (`outcomes.committedSpentCents`, 24718) while the
    // curve divides the exact figure (247.193124968638). Both print $7.97, which is the
    // only thing anyone reads — so the assertion is pinned at display precision. Do NOT
    // "fix" either side into the other: rounding the curve would make it disagree with
    // the spend the return curve beside it rides.
    const parsed = parseFeatureRevenue(
      revenueBody({ costPerOutcomeHistory: PROD_BLOCK }),
      "test",
    );
    const last = parsed.costPerOutcomeHistory?.daily.at(-1)?.costPerOutcomeUsd ?? 0;
    expect(last.toFixed(2)).toBe((PROD_SERVED_COST_CENTS / 100).toFixed(2));
    expect(last).toBeCloseTo(PROD_SERVED_COST_CENTS / 100, 2);
  });

  it("the curve divides the CAMPAIGN's spend, not its brand's", () => {
    // The assertion the old single-identity fixture could not make. On this brand the two
    // are $369.32 and $1,342.38; on a brand running one campaign they are the same number,
    // which is how a widened spend leg reached production unnoticed.
    const parsed = parseFeatureRevenue(
      revenueBody({ costPerOutcomeHistory: PROD_BLOCK }),
      "test",
    );
    const spend = parsed.costPerOutcomeHistory?.daily.at(-1)?.cumulativeSpendUsd ?? 0;
    expect(spend).toBeCloseTo(PROD_CAMPAIGN_COMMITTED_USD, 0);
    expect(spend).toBeLessThan(500);
  });

  it("an absent or null block parses, so a rollback does not take the page down", () => {
    expect(parseFeatureRevenue(revenueBody(), "test").costPerOutcomeHistory).toBeNull();
    expect(
      parseFeatureRevenue(revenueBody({ costPerOutcomeHistory: null }), "test")
        .costPerOutcomeHistory,
    ).toBeNull();
  });

  it("a rotten block throws rather than rendering half a curve", () => {
    // Fail loud: a point missing its denominator is a shape change, not a null day.
    expect(() =>
      parseFeatureRevenue(
        revenueBody({
          costPerOutcomeHistory: {
            ...PROD_BLOCK,
            daily: [{ date: "2026-09-11", costPerOutcomeUsd: 12.26 }],
          },
        }),
        "test",
      ),
    ).toThrow();
  });
});
