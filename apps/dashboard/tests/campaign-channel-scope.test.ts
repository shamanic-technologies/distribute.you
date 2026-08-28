import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

/**
 * A campaign is (offer x funnel x channel) and states its channel on its own row.
 * `useSoleFeatureSlug()` answers a DIFFERENT question — the brand's one GA feature —
 * and it is silently wrong for every campaign that is not on it: nothing errors, every
 * figure is real, and the surface describes a channel the reader is not looking at.
 *
 * Measured on the brand that surfaced it: a `feedback-request-cold-email-outreach`
 * campaign whose Leads page fetched `sales-cold-email-outreach` throughout. The campaign
 * was absent from the feature-filtered rows, so no funnel resolved and the lead panel
 * drew NO "Funnel progress" section on any lead, while the stat row above it stated the
 * other channel's money.
 */
describe("a campaign-scoped surface reads the CAMPAIGN's channel", () => {
  const scoped = read("lib/scoped-feature-slug.ts");

  it("narrows in ONE place, on the key every campaign surface already polls", () => {
    // The three surfaces share a screen. Three copies of the narrowing is how they come
    // to state different channels for one campaign.
    expect(scoped).toContain('["campaign", campaignId ?? "none"]');
    expect(scoped).toContain("campaignScoped ? campaign?.featureSlug ?? null : soleFeatureSlug");
  });

  it("answers NULL rather than the sole slug while a campaign read is in flight", () => {
    // A read fired under a guessed channel lands in that channel's cache entry and
    // answers about somebody else's money — worse than not firing at all.
    expect(scoped).not.toContain("?? soleFeatureSlug");
    // Reveal-on-settle: an ERRORED read is settled, so a one-shot latch cannot hang.
    expect(scoped).toContain("settled: campaignScoped ? !isPending || isError : true");
  });

  for (const rel of [
    "components/audiences/engaged-leads-page.tsx",
    "components/audiences/customer-audiences-page.tsx",
    "components/revenue/outreach-stat-cards-auto.tsx",
  ]) {
    it(`${rel} takes its channel from the narrowing`, () => {
      const src = read(rel);
      expect(src).toContain("useScopedFeatureSlug(campaignId)");
      // The sole slug survives ONLY where the question is genuinely brand-level, and it
      // is spelled apart from `featureSlug` so a campaign-scoped read cannot pick it up.
      expect(src).not.toContain("const featureSlug = useSoleFeatureSlug()");
    });
  }

  it("resolves the leads page's funnel from the campaign, not from feature-filtered rows", () => {
    const src = read("components/audiences/engaged-leads-page.tsx");
    // The rows are filtered by feature, so a campaign on any other channel is not among
    // them: asking them for its funnel is asking a list that cannot contain it.
    expect(src).toContain("? [scopedCampaign?.funnelKey ?? null]");
    expect(src).not.toContain("campaignRows.rows.filter((r) => r.campaign.id === campaignId)");
    // ...and the brand branch keeps the one feature the brand list has always used.
    expect(src).toContain("useCampaignRows(brandId, soleFeatureSlug)");
  });

  it("places the lead panel's leg with the campaign's OWN channel", () => {
    const src = read("components/audiences/engaged-leads-page.tsx");
    expect(src).toContain("acquisitionChannelForFeatureSlug(featureSlug, channels)");
    // The section renders off that walk — pin the CALL SITE, not only the component: a
    // component that handles a prop no page passes is the feature entirely absent.
    const at = src.indexOf("<LeadFunnelStageSection");
    expect(at).toBeGreaterThan(-1);
    const callSite = src.slice(at, at + 400);
    expect(callSite).toContain("stages={panelStages}");
    expect(callSite).toContain("laterStages={panelWalk.later}");
  });

  it("gates a campaign's money on the channel CATALOGUE, never the brand's GA set", () => {
    // `isRevenueFeature` is the brand's revenue-feature set. Gating a campaign on it
    // blanks every campaign that is not on the brand's one GA channel.
    for (const rel of [
      "components/audiences/engaged-leads-page.tsx",
      "components/audiences/customer-audiences-page.tsx",
      "components/revenue/outreach-stat-cards-auto.tsx",
    ]) {
      const src = read(rel);
      expect(src, `${rel} must gate a campaign on the catalogue`).toContain(
        "acquisitionChannelForFeatureSlug(featureSlug, channels) !== null",
      );
    }
  });

  it("asks the campaign's revenue with campaignId ALONE, byte-equal to the Overview", () => {
    // A campaign belongs to exactly one offer, so stating both is two answers to one
    // question — and it would make the args differ from the Overview's under the SAME
    // query key, which is how one campaign comes to show two numbers.
    const src = read("components/audiences/engaged-leads-page.tsx");
    expect(src).toContain("campaignId ? { campaignId } : { offerId }");
    expect(src).not.toContain("getFeatureRevenue(featureSlug, brandId, { campaignId, offerId })");
  });
});
