import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { parseOfferSalesPaths } from "../src/lib/offer-sales-paths";
import { campaignsOfOffer, sourceCampaignsOfOffer } from "../src/lib/offer-campaigns";

/**
 * SOURCE campaigns (owner 2026-10-07): each lead source is its own campaign
 * "<Name> [Apollo Cold Filters] -> Lead found [On | Off] [Up to $X/day]"; the outreach
 * campaign it feeds reads "Lead found -> [Sales Cold Email] -> Positive reply".
 * Fixture: features-service v0.179.79, offer d5ecba00 (brand 75d7e3e8), real prod body.
 */
const read = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf-8");
const body = parseOfferSalesPaths(JSON.parse(read("tests/fixtures/offer-sales-paths-sources.prod.json")), "test");
const label = (r: string | null) => r;

describe("source campaigns read from the real prod body", () => {
  const sources = sourceCampaignsOfOffer(body.sourceCampaigns ?? [], label);

  it("one row per live source, named, with its provider mark and its served ROI", () => {
    expect(sources.map((s) => [s.name, s.channelName])).toEqual([
      ["Solstice", "Apollo Cold Filters"],
      ["Sovereign", "Apollo Buying Signals"],
      ["Sparkle", "LinkedIn Engagement Signals"],
      ["Spire", "Your CRM Contacts"],
    ]);
    expect(sources.every((s) => s.kind === "source" && !s.reactive && s.toLabel === "Lead found")).toBe(true);
    expect(sources[0]!.providerDomain).toBe("apollo.io");
    expect(sources[3]!.providerDomain).toBeNull();
    expect(sources[0]!.roi).toBeCloseTo(0.298, 2);
  });

  it("Jubilation keeps its own leg and reads as fed by Lead found", () => {
    const outreach = campaignsOfOffer(body.campaigns ?? [], body.paths, label);
    const jub = outreach.find((c) => c.name === "Jubilation")!;
    expect(jub.kind).toBe("outreach");
    expect(jub.legKey).toBe("start_to_conversation");
    expect(jub.fromLabel).toBeNull();
    expect(jub.fedByLabel).toBe("Lead found");
  });

  it("a retired source is never offered", () => {
    const retired = sourceCampaignsOfOffer(
      [{ ...body.sourceCampaigns![0]!, live: false }],
      label,
    );
    expect(retired).toEqual([]);
  });
});

describe("Sourcing page wiring (owner 2026-10-07: off the Sales path page, its own sidebar entry)", () => {
  const salesPath = read("src/components/v2/offer-sales-path-page.tsx");
  const sourcing = read("src/components/v2/offer-sourcing-page.tsx");
  const table = read("src/components/v2/offer-campaigns.tsx");
  const shell = read("src/components/v2/v2-shell.tsx");
  const setup = read("src/components/v2/setup-pages.tsx");

  it("the Sales path page lists no source campaign and no Sourcing section", () => {
    expect(salesPath).not.toContain("sourceCampaignsOfOffer");
    expect(salesPath).not.toContain("OfferSourcingSection");
  });

  it("the Sourcing page lists the source campaigns off the same sales-paths read", () => {
    expect(sourcing).toContain("sourceCampaignsOfOffer(paths.data?.sourceCampaigns ?? [], roiUnavailableLabel)");
    expect(sourcing).toContain('["offerSalesPaths", brandId, offerId, "catalogue"]');
    expect(sourcing).toContain("<OfferCampaigns");
  });

  it("the sidebar opens Sourcing; the brand Audience entry is gone (now Targeting's Lists tab)", () => {
    expect(shell).toContain('v2OfferHref(orgId, brandId, offerId, "sourcing")');
    expect(shell).not.toContain('v2Href(orgId, brandId, "audience")');
    expect(setup).toContain('{ label: "Lists", href: `${base}/lists`, active: view === "lists" }');
    expect(setup).toContain("<AudienceLists />");
  });

  it("a source campaign starts as a funded pair (no workflow), never through the workflow picker", () => {
    expect(table).toContain('} else if (campaign.reactive || campaign.kind === "source") {');
  });

  it("a source never takes or gives the proactive plan", () => {
    expect(table).toContain('const activeProactive = sorted.find((c) => c.kind === "outreach" && !c.reactive && running(c)) ?? null;');
    expect(table).toContain('replaces={c.kind === "outreach" && !c.reactive && activeProactive');
  });

  it("a source reads [logo name] -> Lead found; an outreach row shows its fed-by step", () => {
    expect(table).toContain("<ProviderLogo domain={campaign.providerDomain ?? null}");
    expect(table).toContain("<CampaignLeg campaign={campaign} showFedBy />");
  });
});
