import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(__dirname, "..", "src", p), "utf8");

// Owner 2026-10-11: a campaign page reads one block per pipe, up to 3 columns on desktop
// (figures, per day, steps), every figure served.
// FACTORY-USER-DASHBOARD-1102 (owner 2026-11-02): every client's campaign page reads like the GTM Factory's: its Goal,
// its milestones, the Plan of Engines and the scripts each one picks, the strategy per Engine. The per-pipe blocks
// (figures / per day / steps per pipe) and the per-pipe Results table are gone: no compatibility mode beside them.
describe("sales-funnel campaign page: the GTM Factory anatomy", () => {
  const page = read("components/v2/funnel-campaigns.tsx");
  const factory = read("components/v2/factory-campaign.tsx");
  const body = page.slice(page.indexOf("function FunnelCampaignPageCurrent("), page.indexOf("export function useFunnelCampaignById("));

  it("draws the Factory sections for every client, after This campaign, and no per-pipe block", () => {
    expect(body).toContain("<FactoryCampaignSections campaign={campaign} />");
    expect(body.indexOf("<FactoryCampaignSections")).toBeGreaterThan(body.indexOf(">This campaign</SectionTitle>"));
    expect(body).not.toContain("<PipeSections");
    expect(body).not.toContain("<FunnelResults");
    expect(factory).not.toMatch(/useStaffMode|StaffOnly|useIsAdminUser/);
    expect(body).toContain("const units = orderPipesByFunnel(campaign.units,");
    expect(body).toContain("tabs={tabs}");
  });

  it("draws What its people went through, Milestones, Plan, Strategy per Engine, Scripts per Engine in that order", () => {
    const at = factory.indexOf("export function FactoryCampaignSections(");
    const fn = factory.slice(at, factory.indexOf("// ─── Milestones"));
    expect(fn).toContain("useCampaignEngineScripts(campaign.brandId, campaign.id)");
    const order = ["<FactoryJourneys", "<CampaignMilestoneCards", "<FactoryPlan", "<FactoryStrategies", "<FactoryScripts"].map((m) => fn.indexOf(m));
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
  });

  it("computes no figure in the browser: no division, sum or sort of served rows", () => {
    const code = factory.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/\.reduce\(|\.sort\(/);
    expect(code).not.toMatch(/Usd\s*\/|\/\s*\w+\.(outcomes|decisions)/);
  });
});

describe("milestones and people journeys (features-service, served measured-or-expected)", () => {
  it("parse the served bodies; a figure carries its basis or its reason", async () => {
    const { CampaignMilestonesSchema, PeopleJourneysSchema } = await import("../src/lib/factory-campaign");
    const none = { value: null, basis: null, unavailableReason: "start_is_the_market" };
    const m = CampaignMilestonesSchema.parse({
      salesFunnelCampaignId: "c", brandId: "b", pricing: "net", target: "paid_client", planComputedAt: "x", milestonesUnavailableReason: null,
      milestones: [
        { step: "start", label: "Start", isTarget: false, outcomes: null, outcomesUnavailableReason: "start_is_the_market", costPerOutcomeUsd: none, costFromStartUsd: { value: 0, basis: "measured", unavailableReason: null }, conversionFromAbovePct: none, attemptsPerTarget: none },
        { step: "paid_client", label: "Paid client", isTarget: true, outcomes: 2, outcomesUnavailableReason: null, costPerOutcomeUsd: { value: 0, basis: "expected", unavailableReason: null }, costFromStartUsd: { value: 412.5, basis: "measured", unavailableReason: null }, conversionFromAbovePct: { value: 5, basis: "expected", unavailableReason: null }, attemptsPerTarget: { value: 1, basis: "expected", unavailableReason: null } },
      ],
    });
    expect(m.milestones[1].costFromStartUsd.basis).toBe("measured");
    const j = PeopleJourneysSchema.parse({ salesFunnelCampaignId: "c", brandId: "b", pricing: "net", transitions: [{ pipeId: "p", fromStep: "start", fromLabel: "Start", toStep: "lead_found", toLabel: "Lead", people: 23, shareBasis: "spend", scripts: [{ workflowDynastySlug: "s", workflowName: "Lead Sourcing Alterf", sharePct: 86 }], scriptsUnavailableReason: null }] });
    expect(j.transitions[0].scripts[0].sharePct).toBe(86);
  });
  it("the page reads both through the gateway on net pricing, and never shows the planner's internal ROI", () => {
    const api = read("lib/api.ts");
    // Milestones: the campaign-targets row of ONE campaign, counted from produced Units (LEAD-GENERIC-1106).
    expect(api).toContain("/campaign-targets?pricing=net&salesFunnelCampaignId=${encodeURIComponent(salesFunnelCampaignId)}");
    expect(api).toContain("/sales-funnel-campaigns/${encodeURIComponent(salesFunnelCampaignId)}/people-journeys?pricing=net");
    const code = read("components/v2/factory-campaign.tsx");
    expect(code).not.toContain("figures.roi");
    expect(code).not.toContain("costPerTargetUsd");
  });
});

describe("a part's own page is staff only (FACTORY-USER-DASHBOARD-1102)", () => {
  it("a client opening a part lands on the campaign it belongs to, same tab; staff keep the part page", () => {
    const src = read("components/v2/campaign-page.tsx");
    const fn = src.slice(src.indexOf("export function V2CampaignPage("));
    expect(fn).toContain("const partHref = partOfId && !staffMode ? v2CampaignHref(orgId, brandId, partOfId, tab) : null;");
    expect(fn).toContain("if (partHref) router.replace(partHref);");
    // The redirect is decided before any page body renders.
    expect(fn.indexOf("if (partHref) {")).toBeLessThan(fn.indexOf("if (settled && !campaign && !funnelListSettled)"));
  });
});

describe("a journey with no script share says why, in words", () => {
  it("names both served reasons", async () => {
    const { milestoneReasonWords } = await import("../src/lib/factory-campaign");
    expect(milestoneReasonWords("no_spend_yet")).toBe("Nobody yet");
    expect(milestoneReasonWords("spend_recorded_under_another_pipe")).toBe("Its cost is counted on the next step");
    expect(milestoneReasonWords("done_by_your_team")).toBe("Done by your team");
  });
});
