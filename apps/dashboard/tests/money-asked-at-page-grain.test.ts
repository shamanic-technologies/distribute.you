import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.join(__dirname, "../src");
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), "utf-8");

/**
 * Every surface asks for money at the grain it PRESENTS — the campaign when one is
 * open, else the offer, else the brand — and never of a single acquisition channel.
 *
 * A feature IS a channel in this fleet, so the per-feature read answers "what did
 * this return THROUGH THIS ONE CHANNEL". A surface that asks it and prints the
 * answer under a brand's or an offer's name is describing whichever channel it
 * happened to name and understating the subject by whatever the others did —
 * silently, since nothing errors and every figure is real.
 *
 * Measured on the brand that surfaced it, whose single offer runs four channels:
 * `sales-cold-email-outreach` alone answers $2,625.44 / 2.67x, while the brand and
 * that offer both answer $2,668.47 / 2.62x. The customer saw the second on the
 * Overview cards and the first in the table underneath, for one brand and one
 * offer, and read it as the product contradicting itself.
 *
 * #3468 fixed the brand Overview. These are its siblings.
 */
describe("money is asked at the grain the surface presents", () => {
  const overview = read("app/(authed)/(dashboard)/orgs/[orgId]/brands/[brandId]/page.tsx");
  const campaigns = read("components/campaigns/campaigns-page.tsx");
  const statCards = read("components/revenue/outreach-stat-cards-auto.tsx");

  it("the brand Overview asks the offer or the brand, never a channel", () => {
    expect(overview).toContain('["offerRevenue", brandId, offerId]');
    expect(overview).toContain('["brandRevenue", brandId]');
  });

  it("the Campaigns header asks the offer or the brand, never a channel", () => {
    // It called itself "brand-level" while asking the per-feature read.
    expect(campaigns).toContain("getOfferRevenue");
    expect(campaigns).toContain("getBrandRevenue");
    expect(campaigns).not.toContain("getFeatureRevenue(");
  });

  it("the Campaigns header shares the Overview's keys, so both dedupe and agree", () => {
    expect(campaigns).toContain('["offerRevenue", brandId, offerId]');
    expect(campaigns).toContain('["brandRevenue", brandId]');
  });

  it("the shared stat row keeps the per-feature read ONLY for a campaign", () => {
    // A campaign runs exactly one channel, so naming one there is correct.
    expect(statCards).toContain("getFeatureRevenue(featureSlug, brandId, { campaignId })");
    expect(statCards).toContain("getOfferRevenue(offerId, brandId)");
    expect(statCards).toContain("getBrandRevenue(brandId)");
  });

  it("the shared stat row's brand and offer branches carry no channel in their keys", () => {
    expect(statCards).toContain('["offerRevenue", brandId, offerId]');
    expect(statCards).toContain('["brandRevenue", brandId]');
    // The old un-scoped key named a channel while standing in for the brand.
    expect(statCards).not.toContain('["featureRevenue", brandId, featureSlug]');
  });

  it("no surface sums or averages the per-channel parts in the browser", () => {
    // Money adds across channels; people and ratios do not. features-service
    // combines them — a client sum would be wrong AND the banned client metric.
    for (const src of [overview, campaigns, statCards]) {
      expect(src).not.toContain("channels.reduce");
      expect(src).not.toContain(".channels.map");
    }
  });
});
