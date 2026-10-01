import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { parseFeatureRevenue } from "../src/lib/revenue-parse";
import { NULL_PAIR } from "./fixtures/maturity";

/**
 * The money on the brand / offer Overview is asked at the grain the PAGE is.
 *
 * A feature IS an acquisition channel in this fleet, so the per-feature read answers
 * "what did this return THROUGH THIS ONE CHANNEL". While a brand ran one channel that
 * was the same answer as the brand's; it stopped being so the day a second was funded,
 * and the page then paired one channel's spend with billing's brand-wide ceiling and
 * read `$40 / 50` for a brand whose channels had spent $40.07 and $10.32 against their
 * own $40 and $10 — both halves real, about different things, nothing erroring.
 */
describe("the brand revenue reader answers its own grain, not one channel's", () => {
  const api = fs.readFileSync(path.join(__dirname, "../src/lib/api.ts"), "utf-8");

  it("the brand reader exists and shares the ONE parser", () => {
    expect(api).toContain("export async function getBrandRevenue");
    // The money block a consumer renders is identical at every grain, so a second
    // parser would be a second place for it to drift.
    expect(api).toContain('parseFeatureRevenue(raw, "getBrandRevenue")');
  });

  it("asks for the NET basis, like every other money read", () => {
    // Coherent with the NET-paced budget, so `spent today / budget` cannot exceed
    // 100% for a discounted org.
    const at = api.indexOf("export async function getBrandRevenue");
    expect(api.slice(at, at + 400)).toContain('pricing: "net"');
  });

  it("never sums the per-channel breakdown in the browser", () => {
    // features-service combines the parts because most of them do not add — a lead
    // worked through two channels is one lead, and a ratio of sums is neither the sum
    // nor the average of ratios. Bounded to the brand reader's own body: a
    // not-toContain slice running past it reads neighbouring code.
    const at = api.indexOf("export async function getBrandRevenue");
    expect(at).toBeGreaterThan(-1);
    const readers = api.slice(at, api.indexOf("\n}\n", at));
    expect(readers).not.toContain("reduce");
    expect(readers).not.toContain("+=");
  });

  it("the root is persistable, or the money block cold-skeletons every visit", () => {
    const persist = fs.readFileSync(path.join(__dirname, "../src/lib/persist-cache.ts"), "utf-8");
    expect(persist).toContain('"brandRevenue"');
  });
});

/**
 * Sharing the parser across three grains means the parser must accept all three
 * BODIES, and the one field they disagree on is the channel's name. A feature IS an
 * acquisition channel here, so the brand and offer bodies carry no `featureSlug` by
 * construction — that is the entire reason those reads exist. Required, it threw on
 * every brand and offer Overview from the moment #3468 repointed them: real numbers
 * on the wire, a failed parse, and a section rendered as headings with nothing under
 * them. Verified against prod on the brand that surfaced it — pipeline $7,000, ROI
 * 2.62x, $953 CAC served, zero of it on screen.
 *
 * Real unit tests rather than source-substring: `revenue-parse.ts` imports only zod
 * and a type, so it is runtime-importable. Keep it that way.
 */
describe("the shared parser accepts every grain's body", () => {
  // The three bodies differ ONLY in how they name their subject.
  const body = (subject: Record<string, unknown>) => ({
    ...subject,
    headline: { totalPipelineUsd: 7000 },
    costEconomics: {
      maturity: NULL_PAIR,
      committedCostUsd: 2668.62,
      costOfAcquisitionPct: 38.12,
      roiMultiple: 2.62,
      costPerAcquisitionUsd: 953.08,
    },
    timeSeries: [],
    organizations: [],
    leads: [],
    events: [],
    // Required on the wire from features-service v0.153.0 — which outcomes the read
    // could attribute, a fact about the READ (features-service#873).
    attributedOutcomes: [],
  });

  it("parses a BRAND body, which names no channel", () => {
    const view = parseFeatureRevenue(
      body({ brandId: "75d7e3e8-6926-4f85-a557-976895400666", channels: [] }),
      "getBrandRevenue",
    );
    expect(view.totalPipelineUsd).toBe(7000);
    expect(view.costEconomics.roiMultiple).toBe(2.62);
    expect(view.costEconomics.costPerAcquisitionUsd).toBe(953.08);
    expect(view.featureSlug).toBeUndefined();
  });

  it("parses an OFFER body, which names no channel either", () => {
    const view = parseFeatureRevenue(
      body({ offerId: "o-1", brandId: "b-1", channels: [] }),
      "getOfferRevenue",
    );
    expect(view.totalPipelineUsd).toBe(7000);
    expect(view.costEconomics.committedCostUsd).toBe(2668.62);
    expect(view.featureSlug).toBeUndefined();
  });

  it("still carries the per-feature body's own channel name through", () => {
    // Optional must not mean stripped: the per-feature read does name one.
    const view = parseFeatureRevenue(
      body({ featureSlug: "sales-cold-email-outreach" }),
      "getFeatureRevenue",
    );
    expect(view.featureSlug).toBe("sales-cold-email-outreach");
  });

  it("still throws on a genuinely rotten body", () => {
    // Loosening one field must not turn the parser fail-soft — a missing headline is
    // shape rot and has to keep failing loud.
    expect(() => parseFeatureRevenue({ brandId: "b-1" }, "getBrandRevenue")).toThrow();
  });
});
