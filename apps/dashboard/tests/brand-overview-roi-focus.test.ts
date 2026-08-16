import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

/**
 * The brand Overview answers ONE question: what the whole brand returned.
 *
 * A brand runs several acquisition channels and several sales funnels at once, so
 * the surfaces that describe a single channel (the per-day outreach bars, which
 * count the emails cold outreach sends) or a single funnel (Website Visits, Sales
 * Meetings and their cost pairs) each state something narrower than the row they
 * sit in. They live on the campaign Overview, which runs exactly one channel and
 * sells exactly one funnel.
 */
describe("the brand Overview is scoped to the brand's money", () => {
  const overview = read(
    "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
  );
  const section = read("components/revenue/revenue-overview-section.tsx");
  const campaign = read("components/campaigns/campaign-overview-page.tsx");

  it("drops the channel-scoped Outreach-activity chart at brand level", () => {
    expect(overview).toContain("showActivityChart={false}");
    expect(section).toContain("showActivityChart?: boolean");
    // The chart labels a chain's steps, so it renders only when a chain is named — and
    // a brand names none.
    expect(section).toContain("{showActivityChart && optimizationGoal && (");
    // The chart itself stays — it is the campaign Overview's, and that page renders
    // it by taking the default rather than by opting in.
    expect(section).toContain("<PipelineActivityChart");
    expect(campaign).not.toContain("showActivityChart={false}");
  });

  it("shows the four money cards and no per-funnel step pair", () => {
    expect(overview).toContain("showEconomics");
    expect(overview).toContain("showFunnelMetrics={false}");
    expect(overview).toContain("totalPipelineUsd={revenueRevealed ? data?.totalPipelineUsd : null}");
    // The campaign Overview sells one funnel, so it keeps the step pairs.
    expect(campaign).not.toContain("showFunnelMetrics={false}");
  });

  it("reads every money figure off features-service, never dividing in the browser", () => {
    const cards = read("components/revenue/outreach-stat-cards.tsx");
    // $ CAC reads `costPerAcquisitionUsd`, served on the DEFAULT un-lensed brand read.
    // The lens-only `costPerConversionUsd` is absent on this response and left the card
    // on a dash; deriving it here instead (spend ÷ an outcome count, or pipeline ÷ ROI)
    // would put a number on screen that features-service never computed.
    expect(cards).not.toContain("actualCostUsd /");
    expect(cards).not.toContain("/ economics");
    expect(cards).toContain("formatUsd(economics?.costPerAcquisitionUsd)");
  });
});

/**
 * The Overview charts what came back per dollar, and ranks audiences by the same
 * question. Both figures are features-service's; the browser divides nothing.
 */
describe("the brand Overview charts return, and ranks audiences on it", () => {
  const overview = read(
    "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
  );
  const section = read("components/revenue/revenue-overview-section.tsx");
  const roi = read("components/revenue/roi-trend-card.tsx");
  const audiences = read("components/revenue/top-audiences-card.tsx");
  const campaign = read("components/campaigns/campaign-overview-page.tsx");

  it("swaps the one-funnel signal line for return on spend at brand level only", () => {
    expect(overview).toContain("showRoiTrend");
    expect(section).toContain("showRoiTrend = false");
    expect(section).toContain("<RoiTrendCard");
    // The campaign Overview sells exactly one funnel, so its own signal IS what that
    // campaign buys — it keeps the outcome line by taking the default.
    expect(section).toContain("<OutcomeTrendCard");
    expect(campaign).not.toContain("showRoiTrend");
  });

  it("charts the server's own cumulative series and fabricates no point", () => {
    expect(roi).toContain("history?.daily");
    // A day whose cumulative spend is still 0 carries a null ratio — dropped, never
    // plotted at 0, because 0 would read as "returned nothing".
    expect(roi).toContain("d.roiMultiple != null");
    // No browser math on the ratio: it is charted as served.
    expect(roi).not.toContain("cumulativePipelineUsd /");
    // Pipeline with no date sits on no day, so the line legitimately ends below the ROI
    // card above it. That gap is stated rather than left for a reader to find.
    expect(roi).toContain("undatedPipelineUsd");
    // The one horizontal that means something is break-even; a grid beside it would
    // make the meaningful line read as chrome.
    expect(roi).toContain("<ReferenceLine");
    expect(roi).not.toContain("CartesianGrid");
  });

  it("ranks audiences by return, highest first, with the cost it used to lead with beside it", () => {
    // Cost per outcome ranks by CHEAPNESS — an audience converting to nothing outranks
    // an expensive one that pays. The card leads with the return instead.
    expect(audiences).toContain("row.projection?.returnPerDollar");
    expect(audiences).toContain("const ranksByReturn =");
    expect(audiences).toContain("return br - ar;");
    // Displayed value and sort key are the same expression in both branches, or the
    // card shows one order and states another.
    expect(audiences).toContain("ranksByReturn ? formatReturn(rowReturn) : formatCents(costCents)");
    // Never computed here — lifetime revenue ÷ cost per paid client is the producer's.
    expect(audiences).not.toContain("lifetimeRevenueUsd /");
  });

  it("states no brand-wide return of its own, and no funnel cost at brand level", () => {
    // The card used to restate the brand's PROJECTED return under its heading, two
    // inches from the ROI stat card's REALIZED one — same word, two questions, so the
    // page read as contradicting itself (2.5x under 2.7x in prod). One return per page.
    expect(audiences).not.toContain("brandProjection");
    expect(audiences).not.toContain("per dollar overall");
    // A cost per outcome names one funnel's step; a brand runs several at once.
    expect(audiences).toContain("const brandLevelMoney = !campaignScoped");
    expect(audiences).toContain("const subtitle = brandLevelMoney");
    // The brand Overview takes the brand-level default; the campaign Overview opts out.
    const at = overview.indexOf("<TopAudiencesCard");
    expect(at).toBeGreaterThan(-1);
    expect(overview.slice(at, overview.indexOf("/>", at))).not.toContain("campaignScoped");
    expect(campaign).toContain("campaignScoped");
  });
});

/**
 * The brand Overview lists the campaigns behind its own numbers, and the brand
 * Audiences table states money rather than one funnel's steps. Both are the same rule
 * one level down: a brand runs several funnels, so a per-funnel figure on a brand
 * surface labels a sum with one member's vocabulary.
 */
describe("brand surfaces list campaigns and state money", () => {
  const overview = read(
    "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
  );
  const table = read("components/campaigns/campaigns-table.tsx");
  const campaignsPage = read("components/campaigns/campaigns-page.tsx");
  const audiences = read("components/audiences/customer-audiences-page.tsx");

  it("renders ONE campaigns table, on both surfaces", () => {
    // A component, never a second copy — two copies is how a campaign comes to read
    // one way on the Overview and another way one click over.
    expect(table).toContain("export function CampaignsTable(");
    expect(overview).toContain("<CampaignsTable");
    expect(campaignsPage).toContain("<CampaignsTable");
    // The page keeps only what the table does not answer: its header tiles.
    expect(campaignsPage).not.toContain("<thead>");
    expect(campaignsPage).toContain("StatTile");
  });

  it("prices the Campaigns page header off the un-lensed field, so its tile is not a dash", () => {
    // `costPerConversionUsd` is lens-only and absent on this brand-level call, which is
    // what left "Cost per acquisition" empty. Same defect, same fix as the Overview's.
    expect(campaignsPage).toContain("costEconomics.costPerAcquisitionUsd");
    expect(campaignsPage).not.toContain("costEconomics.costPerConversionUsd");
  });

  it("states ROI and $ CAC on the brand Audiences table, and no funnel step columns", () => {
    expect(audiences).toContain("const brandLevelMoney = !campaignScoped;");
    // Every funnel-scoped pair is off at brand level; the campaign route keeps them all.
    expect(audiences).toContain("showReplyColsForGoal && !brandLevelMoney");
    expect(audiences).toContain('optimizationGoal === "signups" && trackerSetUp && !brandLevelMoney');
    // The website-visit pair is funnel-scoped like the rest — it was the one pair the
    // first sweep missed, so it is pinned by name here rather than left to the goal.
    expect(audiences).toContain("const showVisitCols = !isPositiveReplies && !brandLevelMoney;");
    expect(audiences).not.toContain("{!isPositiveReplies && (");
    expect(audiences).toContain('label="ROI"');
    expect(audiences).toContain('label="% CAC"');
    expect(audiences).toContain('label="$ CAC"');
    // Read verbatim off the projection — and NOT inverted into a % CAC, which is the
    // banned browser division. That column waits on features-service.
    expect(audiences).toContain("stats?.projection?.returnPerDollar");
    expect(audiences).toContain("stats?.projection?.costPerPaidClientUsd");
    // % CAC is READ, never derived by inverting the return sitting beside it.
    expect(audiences).toContain("stats?.projection?.costOfAcquisitionPct");
    expect(audiences).not.toContain("100 /");
  });

  it("states what the audience has actually cost beside what it is projected to be worth", () => {
    // REALIZED spend, served ready-made by features-service on the same net basis
    // billing charges — the browser divides nothing to get it.
    expect(audiences).toContain('label="$ Invested"');
    expect(audiences).toContain("formatCents(stats.evidence.totalCostInUsdCents)");
    // Sorted on the field it renders, or the column shows one order and states another.
    expect(audiences).toContain('case "invested":');
    expect(audiences).toContain("return stats?.evidence.totalCostInUsdCents ?? null;");
    // Brand level: it sits beside $ CAC, which exists nowhere else.
    const money = audiences.slice(audiences.indexOf("{brandLevelMoney && ("));
    expect(money.slice(0, 2000)).toContain('label="$ Invested"');
    // Campaign level carries the same column, directly left of Outreach — which is
    // where the brand table already prints it, since every funnel pair above is off
    // there. Both read the same served field; neither divides anything.
    expect(audiences).toContain("{campaignScoped && (\n                    <SortHeader\n                      label=\"$ Invested\"");
    const outreachHeaderAt = audiences.indexOf('<SortHeader label="Outreach"');
    const campaignInvestedAt = audiences.indexOf('{campaignScoped && (\n                    <SortHeader');
    expect(campaignInvestedAt).toBeGreaterThan(-1);
    expect(campaignInvestedAt).toBeLessThan(outreachHeaderAt);
  });

  it("leads the brand Audiences table with the highest return, not the cheapest cost", () => {
    expect(audiences).toContain('brandLevelMoney\n    ? "roi"');
    expect(audiences).toContain('brandLevelMoney ? "desc" : "asc"');
    // Displayed value and sort key are one expression, or the table shows one order
    // and states another.
    expect(audiences).toContain("formatReturn(stats?.projection?.returnPerDollar)");
  });
});

/**
 * The retired brand goal never reaches features-service from a brand-level surface.
 *
 * features-service v0.129.0 made "name NEITHER a funnel NOR a goal" a first-class
 * request: it prices every audience through the best-returning funnel the brand
 * declared and sorts on return descending. That is the only honest answer at brand
 * level — naming one funnel would denominate the whole table in one chain's terms,
 * and the goal that used to pick it is a server-defaulted retired column.
 */
describe("brand-level audience reads name neither a funnel nor a goal", () => {
  const overview = read(
    "app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx",
  );
  const audiences = read("components/audiences/customer-audiences-page.tsx");
  const campaign = read("components/campaigns/campaign-overview-page.tsx");
  const api = read("lib/api.ts");

  it("sends only the brandId from the Overview's Top-audiences card", () => {
    expect(overview).toContain("fetchFeatureAudienceStats(featureSlug, { brandId })");
    // The goal mapping is gone from this page entirely.
    expect(overview).not.toContain("goalForOptimizationGoal");
    expect(overview).not.toContain("audienceStatsGoal");
  });

  it("omits both params at brand level and names the FUNNEL under a campaign", () => {
    expect(audiences).toContain("brandLevelMoney");
    expect(audiences).toContain("funnel: campaignFunnelKey");
    // A campaign that predates the funnel model still has its goal to fall back on.
    expect(audiences).toContain("goal: audienceStatsGoal");
    expect(campaign).toContain("funnel: campaignFunnelKey");
  });

  it("makes both params optional on the reader, so omitting them is expressible", () => {
    expect(api).toContain("funnel?: SalesFunnelKeyWire;");
    expect(api).toContain("goal?: FeatureAudienceStatsGoal;");
    // Neither is written unless the caller asked for it — an empty string would be a
    // named-but-unrecognised value, which features-service 400s.
    expect(api).toContain('if (params.funnel) query.set("funnel", params.funnel);');
    expect(api).toContain('else if (params.goal) query.set("goal", params.goal);');
  });

  it("reads the brand-level answer shape: null goal, return-sorted", () => {
    expect(api).toContain('z.literal("returnPerDollar")');
    // `goal` is null on the brand read — a strict union would throw on every one.
    expect(api).toContain('z.literal("formSubmission"),\n  ]).nullable(),');
    // Each row names the chain it was priced through: an audience's best chain is
    // routinely not the brand's.
    expect(api).toContain("basisFunnelKey");
  });
});
