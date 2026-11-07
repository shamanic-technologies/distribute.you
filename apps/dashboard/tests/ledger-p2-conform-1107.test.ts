/**
 * LEDGER-P2-CONFORM-1107: every count the dashboard reads is the cost-accounting ledger's
 * Units since features-service LEDGER-ONLY-1107-P2 (#2315, #2324, #2328). A figure with no
 * ledger twin (people contacted, opened) or an outcome the ledger holds no Unit of is served
 * NULL. Owner 2026-11-07: never a fake 0, never a broken page.
 *
 * The fixture is the REAL prod body of each read, brand Distribute.you, captured inside the
 * features-service container (arrays trimmed). Each body goes through the REAL reader
 * (fetch stubbed), and every field served null must come out null (never 0).
 */
import { readFileSync } from "fs";
import * as path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchFeatureAudienceStats,
  getBrandRevenue,
  getCampaignRevenueWindow,
  getFeatureRevenueByCampaign,
  getFeatureRevenueByWorkflow,
  getFunnelCampaignPeopleJourneys,
  getFunnelCampaignSpendCharts,
  getOfferCompanyLifecycle,
  getOfferDealsLifecycle,
  getOfferOutcomeCostSeries,
  getOfferOutcomes,
  getOfferRevenue,
  getOfferRevenueWindow,
  getOfferSpendCharts,
  listFunnelCampaignCopies,
  listFunnelCampaignRows,
  FeatureAudienceStatsResponseSchema,
  OfferOutcomesSchema,
} from "../src/lib/api";
import { DealsLifecycleSchema } from "../src/lib/deals-board";
import { PeopleJourneysSchema } from "../src/lib/factory-campaign";
import { FeatureRevenueResponseSchema } from "../src/lib/revenue-parse";

const fixture = JSON.parse(readFileSync(path.resolve(__dirname, "fixtures/ledger-p2-prod-1107.json"), "utf8"));
const bodies: Record<string, unknown> = fixture.bodies;

const B = "f4d73dab-1f9d-49b2-b16e-63ecde76a5eb";
const OFF = "832126f3-f3f1-4601-885d-bc8e101e5680";
const SFC = "b26c3837-2d2e-4989-994b-366d19ce6090";
const SL = "sales-cold-email-outreach";
const C = "e9b5dce1-b66b-47bc-a4c5-ca173ac46881";

/** Which captured body answers a reader's URL. */
function bodyFor(url: string): unknown {
  const u = new URL(url, "http://x");
  const p = u.pathname;
  const q = u.searchParams;
  if (p.endsWith(`/brands/${B}/revenue`)) return bodies.brandRevenue;
  if (p.endsWith(`/offers/${OFF}/revenue`)) return q.get("windowDays") ? bodies.offerRevenueWindow : bodies.offerRevenue;
  if (p.endsWith(`/features/${SL}/revenue`)) {
    if (q.get("groupBy") === "campaignId") return bodies.featureRevenueByCampaign;
    if (q.get("groupBy") === "workflow") return bodies.featureRevenueByWorkflow;
    return bodies.campaignRevenueWindow;
  }
  if (p.endsWith("/spend-charts") && p.includes("sales-funnel-campaigns")) return bodies.funnelSpendCharts;
  if (p.endsWith("/people-journeys")) return bodies.peopleJourneys;
  if (p.endsWith(`/sales-funnel-campaigns`)) return q.get("fields") === "copy" ? bodies.funnelCopies : bodies.funnelRows;
  if (p.endsWith(`/offers/${OFF}/spend-charts`)) return bodies.offerSpendCharts;
  if (p.endsWith("/outcome-cost-series")) return bodies.offerOutcomeCostSeries;
  if (p.endsWith(`/offers/${OFF}/outcomes`)) return bodies.offerOutcomes;
  if (p.endsWith("/audience-stats")) return bodies.audienceStats;
  if (p.endsWith("/deals-value")) return q.get("columns") === "lifecycle" ? bodies.dealsLifecycle : bodies.companyLifecycle;
  throw new Error(`no captured body for ${url}`);
}

function stubProducer() {
  vi.stubGlobal("fetch", async (url: string) => new Response(JSON.stringify(bodyFor(url)), { status: 200, headers: { "content-type": "application/json" } }));
}
afterEach(() => vi.unstubAllGlobals());

/** Every path where the producer served null and the parsed value is a number: a fake 0. */
function fakeZeros(raw: unknown, parsed: unknown, at = ""): string[] {
  if (raw === null && typeof parsed === "number") return [at];
  if (Array.isArray(raw) && Array.isArray(parsed)) return raw.flatMap((r, i) => fakeZeros(r, parsed[i], `${at}[${i}]`));
  if (raw && typeof raw === "object" && parsed && typeof parsed === "object")
    return Object.keys(parsed).flatMap((k) => fakeZeros((raw as Record<string, unknown>)[k], (parsed as Record<string, unknown>)[k], `${at}.${k}`));
  return [];
}

describe("every v2 reader parses the CURRENT prod body (LEDGER-ONLY-1107-P2)", () => {
  const readers: Array<[string, () => Promise<unknown>]> = [
    ["getBrandRevenue", () => getBrandRevenue(B)],
    ["getOfferRevenue", () => getOfferRevenue(OFF, B)],
    ["getOfferRevenueWindow", () => getOfferRevenueWindow(OFF, B, "all" as never)],
    ["getCampaignRevenueWindow", () => getCampaignRevenueWindow(SL, B, C, "all" as never)],
    ["getFeatureRevenueByCampaign", () => getFeatureRevenueByCampaign(SL, B)],
    ["getFeatureRevenueByWorkflow", () => getFeatureRevenueByWorkflow(SL, B, null)],
    ["listFunnelCampaignRows", () => listFunnelCampaignRows(B, OFF)],
    ["listFunnelCampaignCopies", () => listFunnelCampaignCopies(B, OFF)],
    ["getFunnelCampaignSpendCharts", () => getFunnelCampaignSpendCharts(B, SFC)],
    ["getFunnelCampaignPeopleJourneys", () => getFunnelCampaignPeopleJourneys(B, SFC)],
    ["getOfferSpendCharts", () => getOfferSpendCharts(OFF, B)],
    ["getOfferOutcomeCostSeries", () => getOfferOutcomeCostSeries(OFF, B)],
    ["getOfferOutcomes", () => getOfferOutcomes(OFF, B)],
    ["fetchFeatureAudienceStats", () => fetchFeatureAudienceStats(SL, { brandId: B, offerId: OFF })],
    ["getOfferDealsLifecycle", () => getOfferDealsLifecycle(OFF, B, null)],
    ["getOfferCompanyLifecycle", () => getOfferCompanyLifecycle(OFF, B)],
  ];
  for (const [name, read] of readers) {
    it(`${name} parses`, async () => {
      stubProducer();
      await expect(read()).resolves.toBeTruthy();
    });
  }
});

describe("a null served by the ledger stays null, never 0", () => {
  const schemas: Array<[string, { safeParse: (v: unknown) => { success: boolean; data?: unknown } }]> = [
    ["brandRevenue", FeatureRevenueResponseSchema],
    ["offerRevenue", FeatureRevenueResponseSchema],
    ["offerOutcomes", OfferOutcomesSchema],
    ["audienceStats", FeatureAudienceStatsResponseSchema],
    ["dealsLifecycle", DealsLifecycleSchema],
    ["peopleJourneys", PeopleJourneysSchema],
  ];
  for (const [key, schema] of schemas) {
    it(`${key}: no fake 0`, () => {
      const r = schema.safeParse(bodies[key]);
      expect(r.success).toBe(true);
      expect(fakeZeros(bodies[key], r.data)).toEqual([]);
    });
  }

  it("the fixture really carries the nulls this guards (people contacted, Paid client won, deals rung people)", () => {
    const o = bodies.offerOutcomes as { pipeline: { peopleContacted: unknown; customersWon: { count: unknown } } };
    expect(o.pipeline.peopleContacted).toBeNull();
    expect(o.pipeline.customersWon.count).toBeNull();
    const d = bodies.dealsLifecycle as { rungs: Array<{ leadCount: unknown }> };
    expect(d.rungs.every((r) => r.leadCount === null)).toBe(true);
    const a = bodies.audienceStats as { audiences: Array<{ evidence: { contacted: unknown } }> };
    expect(a.audiences[0].evidence.contacted).toBeNull();
    const b = bodies.brandRevenue as { recipientsContacted: unknown; purchased: unknown };
    expect(b.recipientsContacted).toBeNull();
    expect(b.purchased).toBeNull();
  });
});
