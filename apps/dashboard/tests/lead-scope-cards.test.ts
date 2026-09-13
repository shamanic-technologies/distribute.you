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
      // component rather than a `ScopeCard`.
      "<AudienceScopeCard audience={sole.audience} />",
      // The workflow that served this person comes last: the audience says who
      // was picked, the workflow says what ran on them.
      "<WorkflowScopeCard",
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

describe("the lead panel names the workflow that served this person", () => {
  it("draws the card from the LEAD's own frozen slug, only for a person with one campaign", () => {
    // `workflowSlug` sits on the lead ROW, not on the per-campaign cards, so with
    // several campaigns it belongs to one of them and nothing on the wire says which.
    // `panelScope.sole` is that condition. Widening it is a lead-service ask, never a
    // derivation here.
    expect(page).toContain(
      "const panelWorkflowSlug = panelScope.sole ? selectedLead?.workflowSlug ?? null : null;",
    );
    expect(page).toContain("workflow: panelWorkflow,");
  });

  it("reads the CARD's own channel, never the page's fallback feature slug", () => {
    // `featureSlug` from `useScopedFeatureSlug` falls back to the brand's sole channel
    // off a campaign route, which would list another channel's workflows for a person
    // contacted through this one.
    expect(page).toContain('const panelChannelSlug = panelScope.sole?.info?.featureSlug ?? null;');
    expect(page).toContain("listChannelWorkflows(panelChannelSlug as string)");
    expect(page).toContain("listChannelWorkflowDynasties(panelChannelSlug as string)");
  });

  it("fires nothing for a reader who is not on the beta", () => {
    expect(page).toContain(
      "const panelWorkflowReady = isBetaUserForPanel && Boolean(panelChannelSlug && panelWorkflowSlug);",
    );
    expect(page).toContain("enabled: panelWorkflowReady");
  });

  it("resolves through the shared rule and waits for BOTH reads", () => {
    // A superseded version is unnameable without the membership map, so resolving on
    // the catalogue alone would state "not one the channel currently offers" about a
    // workflow we simply have not finished looking up.
    expect(page).toContain("leadWorkflowIdentity(panelWorkflowSlug, panelWorkflowCatalogue, panelWorkflowDynasties)");
    expect(page).toContain("!panelWorkflowCatalogue || !panelWorkflowDynasties");
  });

  it("draws the SAME two cells the campaign Workflows table draws", () => {
    // One workflow cannot read one way here and another way on the page this links to.
    expect(cards).toContain("<WorkflowModelCell contentModel={workflow.contentModel} />");
    expect(cards).toContain("<WorkflowTemplateCell contentPromptType={workflow.contentPromptType} />");
    expect(cards).toContain('from "@/components/workflows/workflow-cells"');
  });

  it("badges the card, because a beta gate with no badge is a surface nobody can tell is beta", () => {
    expect(cards).toContain('<MaturityBadge level="beta" />');
  });

  it("says the model and the template are the workflow's, not this email's", () => {
    // workflow-service publishes them for each dynasty's CURRENT version only, so an
    // earlier version that served this person may have named a different model.
    const body = cards.slice(cards.indexOf("function WorkflowScopeCard("));
    expect(body).toContain("what this workflow runs today");
    // No em-dash in copy a customer reads.
    const copy = body.slice(body.indexOf("return ("));
    expect(copy).not.toContain("\u2014");
  });

  it("builds the link from the CARD's own offer and campaign, never the route", () => {
    // A brand-scoped reader has no offer segment, and building it from the route is
    // what sends them to a path that does not exist.
    const body = cards.slice(cards.indexOf("function WorkflowScopeCard("));
    expect(body).toContain("tenantBasePath(orgId, brandId, offerId)");
    expect(body).not.toContain("params.offerId");
    // `?workflow=` is what opens the panel on that workflow; no dynasty, no link.
    expect(body).toContain("/workflows?workflow=");
    expect(body).toContain("offerId && workflow.dynastySlug");
  });

  it("names an unresolvable version by the slug the row froze rather than hiding it", () => {
    const body = cards.slice(cards.indexOf("function WorkflowScopeCard("));
    expect(body).toContain("{workflow.dynastyName ?? workflow.workflowSlug}");
  });
});
