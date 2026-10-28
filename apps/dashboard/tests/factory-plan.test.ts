import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MONITORING_PAGES, parseMonitoringPath } from "../src/lib/monitoring/monitoring";
import {
  FactoryShadowMonitoringSchema,
  FactoryShadowPlanSchema,
  changingCampaigns,
  confidenceWords,
  failedCampaigns,
  isLowConfidence,
  pickSourceWords,
  pricedRunning,
  runningUnavailable,
  unavailableWords,
  verdictReasonWords,
} from "../src/lib/factory-shadow";
import { SalesFunnelCampaignSchema } from "../src/lib/sales-funnel-campaigns";

/**
 * FACTORY-P1-DASH (owner 2026-10-28): GTM Factory step 1, SHADOW ONLY. On a campaign page, staff mode only: the
 * campaign's Target, its brief (editable inline), and features-service's stored shadow pass (per pipe the play running
 * vs Jev's pick from the brief, the running line vs the best line to the Target, each with served $/Target and ROI).
 * On Monitoring: a Factory plan section, red when the served verdict is. Fixtures = real production reads of
 * 2026-10-28 (the 19:12 UTC pass: 36 live campaigns, 4 plan failures, 23 that would change).
 */
const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
const fixture = (name: string) => JSON.parse(readFileSync(join(__dirname, "fixtures", name), "utf8"));
const plans = () => fixture("factory-shadow-plans-prod-1028.json") as Record<string, unknown>;

describe("factory shadow: features-service's per-campaign read parses as served", () => {
  it("parses a proactive campaign whose best line differs from the running one", () => {
    const p = FactoryShadowPlanSchema.parse(plans().proactive);
    expect(p.salesFunnelName).toBe("Active Follow-up Replies");
    expect(p.plan?.planDiffers).toBe(true);
    const running = pricedRunning(p.plan!.running);
    expect(running?.figures.costPerTargetUsd).toBe(3473.72);
    expect(p.plan?.shadow?.figures.costPerTargetUsd).toBe(3369.3);
    expect(p.plan?.shadow?.figures.roi).toBe(0.15);
    expect(p.picks[0]).toMatchObject({ channelName: "Lead Sourcing", runningPlayName: "Lead follow-up due", pickedPlayName: "Valid only", differs: true });
  });

  it("parses a reactive one and a failed plan (no best line, the served reason)", () => {
    expect(FactoryShadowPlanSchema.parse(plans().reactive).plan?.mode).toBe("reactive");
    const failed = FactoryShadowPlanSchema.parse(plans().planFailed);
    expect(failed.status).toBe("plan_failed");
    expect(failed.plan?.shadow).toBeNull();
    expect(unavailableWords(failed.plan!.shadowUnavailableReason)).toBe("no line to the Target has a price yet");
    expect(unavailableWords(pricedRunning(failed.plan!.running)!.figures.unavailableReason)).toBe("the Target has no value");
    expect(FactoryShadowPlanSchema.parse(plans().other).status).toBe("ok");
  });

  it("reads a running funnel that does not reach the Target as its reason, never as figures", () => {
    const running = { funnelId: "x", reachesTarget: false, unavailableReason: "running_funnel_does_not_reach_target" };
    const p = FactoryShadowPlanSchema.parse({ ...(plans().planFailed as object), plan: { ...(plans().planFailed as { plan: object }).plan, running } });
    expect(pricedRunning(p.plan!.running)).toBeNull();
    expect(unavailableWords(runningUnavailable(p.plan!.running))).toBe("the running funnel does not reach the Target");
  });

  it("words: subjects named as served, unknown codes as served, confidence whole %", () => {
    expect(unavailableWords("pipe_unpriced:ai-instant-call|x")).toBe("a pipe has no price yet (ai-instant-call|x)");
    expect(unavailableWords("something_new")).toBe("something_new");
    expect(confidenceWords(0.824)).toBe("82%");
    expect(confidenceWords(null)).toBeNull();
    expect(isLowConfidence(0.31)).toBe(true);
    expect(isLowConfidence(0.9)).toBe(false);
    expect(isLowConfidence(null)).toBe(false);
    expect(pickSourceWords("empty_brief")).toBe("no brief: the default play");
    expect(pickSourceWords("jev")).toBeNull();
  });

  it("campaign-service's target, brief and type ride the funnel campaign read", () => {
    const c = SalesFunnelCampaignSchema.parse({
      id: "a", brandId: "b", offerId: "o", salesFunnelId: "f", salesFunnelName: "n", status: "ongoing", stopReason: null,
      createdAt: "x", updatedAt: "x", units: [], target: "paid_client", brief: "Only CTOs", briefUpdatedAt: "2026-10-28T10:00:00Z",
      briefUpdatedByUserId: "u", mode: "proactive", triggerId: null,
    });
    expect(c.target).toBe("paid_client");
    expect(c.brief).toBe("Only CTOs");
  });
});

describe("factory shadow: Monitoring read parses as served", () => {
  it("parses the verdict, the series per org and the last pass's campaigns", () => {
    const d = FactoryShadowMonitoringSchema.parse(fixture("factory-shadow-monitoring-prod-1028.json"));
    expect(d.verdict.red).toBe(true);
    expect(d.verdict.reasons.map(verdictReasonWords)).toContain("no line to the Target could be priced for a campaign");
    expect(d.series[0]).toMatchObject({ day: "2026-10-28", campaigns: 36, differs: 23, planFailed: 4 });
    expect(failedCampaigns(d)).toHaveLength(4);
    expect(changingCampaigns(d).length).toBeGreaterThan(0);
    expect(verdictReasonWords("brand_new")).toBe("brand_new");
  });
});

describe("factory shadow: the campaign page (staff mode only)", () => {
  const card = read("components/v2/factory-plan-card.tsx");
  it("renders nothing, and reads nothing, outside staff mode", () => {
    const section = card.slice(card.indexOf("export function FactoryPlanSection("), card.indexOf("function FactoryPlanBody("));
    expect(section).toContain("useStaffMode()");
    expect(section).toContain("if (!staffMode) return null;");
    // The read lives in the body, mounted only past the gate.
    expect(section).not.toContain("useFactoryShadow(");
  });

  it("is mounted on the funnel campaign page above This campaign", () => {
    const page = read("components/v2/funnel-campaigns.tsx");
    const at = page.indexOf("<FactoryPlanSection");
    expect(at).toBeGreaterThan(-1);
    expect(at).toBeLessThan(page.indexOf(">This campaign</SectionTitle>"));
  });

  it("edits the brief through the funnel campaign PATCH, never a Save button", () => {
    const api = read("lib/api.ts");
    const writer = api.slice(api.indexOf("export async function setSalesFunnelCampaignBrief("), api.indexOf("/** One funnel campaign with its units. */"));
    expect(writer).toContain('method: "PATCH"');
    expect(writer).toContain("body: { brief }");
    expect(card).toContain("setSalesFunnelCampaignBrief(");
    expect(card).toContain('e.key === "Escape"');
    expect(card).toContain("onBlur={commit}");
    expect(card).not.toMatch(/>\s*Save\s*</);
  });

  it("draws served figures only: no client sort or sum", () => {
    expect(card).toContain("f.costPerTargetUsd");
    expect(card).toContain("formatRoi(f.roi)");
    expect(card).not.toMatch(/\.sort\(/);
    expect(card).not.toMatch(/\.reduce\(/);
  });
});

describe("factory shadow: Monitoring page and hub", () => {
  it("reads the staff gateway route, never persisted to disk", () => {
    const api = read("lib/api.ts");
    expect(api).toContain('factoryShadow: "/features/audit/factory-shadow/monitoring"');
    const persist = read("lib/persist-cache.ts");
    const sensitive = persist.slice(persist.indexOf("export const SENSITIVE_QUERY_ROOTS"), persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    expect(sensitive).toContain('"staffFactoryShadow"');
    expect(sensitive).toContain('"factoryShadowPlan"');
  });

  it("is a Monitoring page, mounted, its tile above the collapsible rows", () => {
    expect(MONITORING_PAGES).toContain("factory/plan");
    expect(parseMonitoringPath("/factory/plan")).toEqual({ view: "page", page: "factory/plan" });
    const page = read("components/v2/monitoring-page.tsx");
    expect(page).toContain('view.page === "factory/plan" && <FactoryShadowPage />');
    const hub = page.slice(page.indexOf("function Hub("), page.indexOf("function Section("));
    expect(hub.indexOf("<FactoryShadowTile")).toBeGreaterThan(-1);
    expect(hub.indexOf("<FactoryShadowTile")).toBeLessThan(hub.indexOf("<Section "));
  });

  it("turns red on the served verdict, draws served series in served order", () => {
    const src = read("components/v2/monitoring-factory.tsx");
    expect(src).toContain("data.verdict.red");
    expect(src).not.toMatch(/\.sort\(/);
    expect(src).not.toMatch(/\.reduce\(/);
  });
});
