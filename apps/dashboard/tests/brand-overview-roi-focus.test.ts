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
    expect(section).toContain("{showActivityChart && (");
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
    // $ CAC is `costPerConversionUsd`, which features-service documents as LENS ONLY
    // and does not serve on the default response — so this card reads "—" until that
    // lands. Deriving it here (spend ÷ an outcome count, or pipeline ÷ ROI) would put
    // a number on screen that features-service never computed, which is the
    // compute-in-the-browser bug the fleet already pays for elsewhere.
    expect(cards).not.toContain("actualCostUsd /");
    expect(cards).not.toContain("/ economics");
    expect(cards).toContain("formatUsd(economics?.costPerConversionUsd)");
  });
});
