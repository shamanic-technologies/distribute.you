import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
const API = read("src/lib/api.ts");
const PAGE = read("src/components/funnels/funnel-overview-page.tsx");

describe("a sales funnel answers at its OWN grain", () => {
  it("reads the funnel-grain routes, byte-equal to the deployed gateway paths", () => {
    expect(API).toContain(
      "`/offers/${offerId}/funnels/${encodeURIComponent(funnelKey)}/revenue?${query.toString()}`",
    );
    expect(API).toContain(
      "`/offers/${offerId}/funnels/${encodeURIComponent(funnelKey)}/pipeline-activity?${query.toString()}`",
    );
  });

  it("asks for the NET basis, like every other money read on this app", () => {
    const block = API.slice(API.indexOf("export async function getOfferFunnelRevenue"));
    expect(block.slice(0, 900)).toContain('query.set("pricing", "net")');
  });

  it("shares the ONE revenue parser rather than declaring a second shape", () => {
    // The payload carries no `featureSlug` — a funnel spans the channels carrying its
    // legs — which is exactly the field that must not be required in a parser shared
    // across grains. A second parser here is a second place for that to be re-learned.
    expect(API).toContain('parseFeatureRevenue(raw, "getOfferFunnelRevenue")');
  });

  it("no longer reads the offer's per-funnel ROW for this page", () => {
    // That row is lean by design: no spend breakdown, no return history, no series.
    // Reading it here is what left the page with four figures and no chart.
    expect(PAGE).not.toContain("getOfferFunnels");
    expect(PAGE).toContain("getOfferFunnelRevenue");
  });

  it("charts the RETURN and states no outreach", () => {
    // Outreach is what a CHANNEL does and a funnel carries several; the return is what
    // the whole funnel is judged on.
    expect(PAGE).toContain("showRoiTrend");
    expect(PAGE).toContain("showActivityChart={false}");
    expect(PAGE).toContain("showOutreach={false}");
  });

  // Money is funded per (funnel, channel, offer), so a funnel HAS a ceiling — it is just
  // the one grain the producer does not total, which is why it is summed from the served
  // campaign rows rather than read. The page used to claim none at all, and a bare figure
  // with no denominator reads as a total beside a card whose neighbour really is one.
  it("states the funnel's own running ceiling, narrowed to this offer", () => {
    expect(PAGE).toContain("useRunningDailyBudgetCents(brandId, {");
    expect(PAGE).toContain("funnelKey: rawKey || null");
    expect(PAGE).toContain("dailyBudgetCents={funnelDailyBudgetCents}");
    // The offer is load-bearing: billing's per-pair figure spans every offer selling it.
    const at = PAGE.indexOf("useRunningDailyBudgetCents(brandId, {");
    expect(PAGE.slice(at, at + 200)).toContain("offerId,");
    // No note explaining an absent denominator, because there is no longer one absent.
    expect(PAGE).not.toContain("budgetNote=");
  });

  it("gates the ratios on the campaigns carrying THIS funnel", () => {
    expect(PAGE).toContain("scopeIsLearning(funnelRows)");
    expect(PAGE).toContain("normalizeSalesFunnelKey(r.campaign.funnelKey) === wanted");
  });

  it("reveals on SETTLE, so a failed read cannot skeleton it forever", () => {
    expect(PAGE).toContain("revenue.isPending && !revenue.isError");
    expect(PAGE).toContain("activity.isPending && !activity.isError");
  });

  it("states a funnel this offer does not sell rather than borrowing the offer's numbers", () => {
    expect(PAGE).toContain("revenue.isError");
    expect(PAGE).toContain("does not\n          sell answers with nothing");
  });
});
