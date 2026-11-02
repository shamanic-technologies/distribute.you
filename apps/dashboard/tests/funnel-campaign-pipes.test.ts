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
    expect(fn).toContain("useFactoryShadow(campaign.brandId, campaign.id, true)");
    const order = ["<FactoryJourneys", "<FactoryMilestones", "<FactoryPlan", "<FactoryStrategies", "<FactoryScripts"].map((m) => fn.indexOf(m));
    expect(order.every((i) => i > -1)).toBe(true);
    expect([...order].sort((x, y) => x - y)).toEqual(order);
  });

  it("computes no figure in the browser: no division, sum or sort of served rows", () => {
    const code = factory.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/\.reduce\(|\.sort\(/);
    expect(code).not.toMatch(/Usd\s*\/|\/\s*\w+\.(outcomes|decisions)/);
  });
});

describe("the plan tree joins", () => {
  // Shape of a real prod body (Mixed Email Replies, 2026-11-02), trimmed.
  const cand = (id: string, name: string, share: number, engine: boolean, today: boolean) => ({
    candidateId: id, pipeId: "p", channelName: "Lead Sourcing", workflowDynastySlug: id, workflowDynastyName: name, fromStep: null, valueAddedUsd: 1,
    clientDecisions: 0, clientOutcomes: 0, fleetDecisions: 0, fleetOutcomes: 0, rateMeanPct: 99, costPerDecisionMeanUsd: 0.01, valuePerDollarMean: 70,
    pickSharePct: share, isToday: today, isEnginePick: engine,
  });
  const place = (outcome: string, outcomeName: string, consumer: string, candidates: ReturnType<typeof cand>[]) => ({
    outcome, outcomeName, consumer, consumerName: consumer, today: null, todayUnavailableReason: null, engine: null, agrees: null, state: "ok", candidates,
  });
  const leg = (legKey: string, channelName: string, costSource: string) => ({ legKey, pipeId: `${channelName}|${legKey}`, channelSlug: null, channelName, playId: null, strategyName: null, costSource });
  const shadow = {
    engine: { computedAt: "x", status: "ok", failure: null, places: [place("lead_found", "Lead", "conversation", [cand("a", "Lead Sourcing Alterf", 41.6, false, false), cand("b", "Lead Sourcing Inquill", 19, true, false)]), place("conversation", "Positive reply", "paid_client", [])] },
    plan: {
      target: "paid_client", targetSource: "campaign", mode: "proactive", triggerId: null, startStep: null, shadow: null, shadowUnavailableReason: null, planDiffers: false,
      running: {
        funnelId: "f", line: "l",
        legs: [leg("start_to_lead_found", "Lead Sourcing", "workflow"), leg("lead_found_to_conversation", "Sales Cold Email Outreach", "workflow"), leg("conversation_to_paid_client", "Your Team Reply Closing", "customer_team")],
        figures: { costPerTargetUsd: 3932.82, roi: 0, basis: "default", unavailableReason: null, targetValueUsd: 10, legs: [{ legKey: "start_to_lead_found", pipeId: null, ratePct: null, costPerOutcomeUsd: 0.08, outcomesNeededPerPayingClient: 11013.64, costSource: "workflow" }, { legKey: "lead_found_to_conversation", pipeId: null, ratePct: 0.18, costPerOutcomeUsd: 150.17, outcomesNeededPerPayingClient: 20, costSource: "workflow" }, { legKey: "conversation_to_paid_client", pipeId: null, ratePct: 5, costPerOutcomeUsd: 0, outcomesNeededPerPayingClient: 1, costSource: "customer_team" }] },
      },
    },
  };

  it("reads from the Target down: the team-made Target, then each outcome with its Engine place", async () => {
    const { planLegsFromTarget } = await import("../src/lib/factory-campaign");
    const { FactoryShadowPlanSchema } = await import("../src/lib/factory-shadow");
    const parsed = FactoryShadowPlanSchema.parse({ campaignId: "c", orgId: "o", brandId: "b", salesFunnelName: "n", brief: null, briefUpdatedAt: null, status: "ok", failure: null, picks: [], pickDiffers: false, computedAt: "x", pipeVerdicts: [], ...shadow });
    const nodes = planLegsFromTarget(parsed);
    expect(nodes.map((n) => n.outcome)).toEqual(["paid_client", "conversation", "lead_found"]);
    expect(nodes[0]).toMatchObject({ place: null, performedBy: "Done by your team", channelName: "Your Team Reply Closing" });
    expect(nodes[2].place?.candidates.map((c) => c.workflowDynastyName)).toEqual(["Lead Sourcing Alterf", "Lead Sourcing Inquill"]);
  });

  it("keeps and rules out ways per Engine from the served brief verdicts, by channel", async () => {
    const { strategyOfPlace } = await import("../src/lib/factory-campaign");
    const v = (channelName: string, toStep: string, excluded: boolean | null) => ({ pipeId: channelName, channelName, fromStep: null, toStep, inRunningFunnel: false, excluded });
    const s = strategyOfPlace({ outcome: "lead_found" }, [v("Lead Sourcing", "lead_found", false), v("Apollo Cold Filters", "lead_found", true), v("Founder Hello", "conversation", true)]);
    expect(s).toEqual({ kept: ["Lead Sourcing"], ruledOut: ["Apollo Cold Filters"] });
  });

  it("orders pipes by the funnel's step sequence, unknown legs last, ties served order", async () => {
    const { orderPipesByFunnel } = await import("../src/lib/sales-funnel-campaigns");
    const legs: Record<string, { fromKey: string | null; toKey: string }> = {
      close: { fromKey: "conversation", toKey: "paid_client" },
      source: { fromKey: null, toKey: "lead_found" },
      email: { fromKey: "lead_found", toKey: "conversation" },
      email2: { fromKey: "lead_found", toKey: "conversation" },
    };
    const served = ["close", "x", "source", "email", "email2"];
    expect(orderPipesByFunnel(served, (k) => legs[k] ?? null)).toEqual(["source", "email", "email2", "close", "x"]);
    // A funnel starting mid-way (reactive) still orders from its first served step.
    expect(orderPipesByFunnel(["close", "email"], (k) => legs[k] ?? null)).toEqual(["email", "close"]);
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
    expect(api).toContain("/sales-funnel-campaigns/${encodeURIComponent(salesFunnelCampaignId)}/milestones?pricing=net");
    expect(api).toContain("/sales-funnel-campaigns/${encodeURIComponent(salesFunnelCampaignId)}/people-journeys?pricing=net");
    const code = read("components/v2/factory-campaign.tsx");
    expect(code).not.toContain("figures.roi");
    expect(code).not.toContain("costPerTargetUsd");
  });
});
