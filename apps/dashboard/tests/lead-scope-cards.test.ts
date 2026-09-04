import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * The lead panel states the hierarchy ONE CARD PER LEVEL, stacked — Brand, Offer,
 * Sales funnel, Funnel leg, Acquisition channel, Audience — for every level the
 * person's campaigns agree on, and nests only what varies underneath.
 *
 * Source-substring, because both files import through the `@` alias. The pure rule that
 * decides WHICH levels those are carries real unit tests in `lead-campaign-tree.test.ts`.
 */
const cards = readFileSync(
  join(__dirname, "..", "src", "components", "audiences", "lead-scope-cards.tsx"),
  "utf8",
);
const page = readFileSync(
  join(__dirname, "..", "src", "components", "audiences", "engaged-leads-page.tsx"),
  "utf8",
);
const sections = readFileSync(
  join(__dirname, "..", "src", "components", "audiences", "lead-campaign-sections.tsx"),
  "utf8",
);

describe("the lead panel states its hierarchy one card per level", () => {
  it("draws a card for every level, in hierarchy order", () => {
    // Brand > Offer > Funnel > Funnel leg > Channel > Audience is how the product is
    // sold, so it is the order the cards stack in.
    const order = [
      'heading="Brand"',
      'heading="Offer"',
      'heading="Sales funnel"',
      'heading="Funnel leg"',
      'heading="Acquisition channel"',
      // The audience card carries its own avatar and deep link, so it is its own
      // component rather than a `ScopeCard` — it still comes last.
      "<AudienceScopeCard audience={sole.audience} />",
    ];
    let at = -1;
    for (const marker of order) {
      const next = cards.indexOf(marker);
      expect(next, `${marker} is missing or out of order`).toBeGreaterThan(at);
      at = next;
    }
  });

  it("wears the same marks every other surface wears for those levels", () => {
    // A second icon definition is how two surfaces come to disagree about what an
    // offer, a funnel, a leg or a channel looks like.
    expect(cards).toContain("<BrandLogo");
    expect(cards).toContain("<OfferMark");
    expect(cards).toContain("<SalesFunnelMark");
    expect(cards).toContain("<FunnelLegMark");
    expect(cards).toContain("<AcquisitionChannelMark");
  });

  it("resolves the leg with the campaign's own statement first, exactly as the top bar does", () => {
    // Same precedence as `CampaignIdentity`, or one campaign reads as one leg here and
    // another in the crumb two inches above it.
    expect(cards).toContain("statedCampaignLeg(funnel, sole.legKey, legIndex) ?? campaignLegFor(funnel, channel?.legs)");
  });

  it("never throws on a funnel key it does not carry", () => {
    // `salesFunnelByKey` throws; the key here comes off a campaign row, so a funnel we
    // cannot name must render no card rather than take the panel down.
    expect(cards).not.toContain("salesFunnelByKey");
    expect(cards).toContain("SALES_FUNNELS.find((f) => f.key === funnelKey)");
  });

  it("is threaded from the page, not merely defined", () => {
    // The CALL SITE: a panel that renders no <LeadScopeCards> ships a correct component
    // and no feature.
    expect(page).toContain("<LeadScopeCards");
    expect(page).toContain("offer={panelScope.offer}");
    expect(page).toContain("funnelKey={panelScope.funnelKey}");
    expect(page).toContain("const panelScope = useMemo(() => leadPanelScope(leadCampaignTree)");
  });

  it("does not repeat a level the cards above already state", () => {
    // A band naming the offer two inches under a card naming the offer is noise, not
    // hierarchy.
    expect(page).toContain("showOffers={!panelScope.offer}");
    expect(page).toContain("showFunnels={panelScope.funnelKey ? false : undefined}");
    expect(sections).toContain("showOffers = true");
    expect(sections).toContain("const funnelBands = showFunnels ?? tree.showFunnels;");
  });

  it("drops the nested list entirely when the person has one campaign", () => {
    // Every level is its own card there, so there is nothing to nest and nothing to
    // switch between — the timeline is the whole of what is left to say.
    expect(page).toContain("{panelScope.sole ? (");
    // The sole card's history is the one read for, and it draws the timeline directly.
    expect(page).toContain("const openHistoryRowId = panelScope.sole?.rowId ?? openCampaignRowId;");
    expect(page).toContain("<LeadHistoryTimeline");
  });
});
