import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MONITORING_PAGES, parseMonitoringPath } from "../src/lib/monitoring/monitoring";
import { DRAINING_WORDS, PlanChangesSchema, PlanFollowingSchema, followsPlanWords, isDraining, planStateWords } from "../src/lib/plan-following";
import { SalesFunnelCampaignSchema } from "../src/lib/sales-funnel-campaigns";

/**
 * FACTORY-P1-PLAN-FOLLOWING-DASH (owner 2026-10-28): campaign-service #808 lets a funnel campaign FOLLOW ITS PLAN
 * (switch off by default). Staff see the switch read only on the campaign page with the last plan check and every
 * draining part ("Finishing its follow-ups"); Monitoring > Factory plan > Following its plan reads
 * `/v1/campaigns/ops/plan-following` (api-service #1409), red on the served status. The body below is the shape
 * `readPlanFollowing` returns (campaign-service src/lib/sales-funnel-plan.ts on main); no campaign is switched in
 * production yet, so no real red row exists to capture.
 */
const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");

const OPS = {
  status: "red",
  staleReason: null,
  following: 2,
  red: [
    {
      salesFunnelCampaignId: "c1",
      orgId: "o1",
      brandId: "b1",
      salesFunnelName: "Active Follow-up Replies",
      runningSalesFunnelId: "start_to_lead_found@lead-sourcing",
      state: "plan_outside_caps",
      detail: "pipe sourcing-crm-contacts|start_to_lead_found spends and is not on the campaign's funnel",
      checkedAt: "2026-10-29T08:10:00.000Z",
      planSalesFunnelId: "start_to_lead_found@sourcing-crm-contacts",
    },
  ],
  byDay: [{ day: "2026-10-29", following: 2, red: 1, changesApplied: 1, checkedAt: "2026-10-29T08:10:00.000Z" }],
};

describe("plan following: served shapes", () => {
  it("parses the real production read of 2026-10-29 (16 following, 1 red)", () => {
    const d = PlanFollowingSchema.parse(JSON.parse(readFileSync(join(__dirname, "fixtures", "plan-following-prod-1029.json"), "utf8")));
    expect(d.following).toBe(16);
    expect(d.red.map((r) => planStateWords(r.state).words)).toEqual(["plan not applied: we cannot run it"]);
  });

  it("parses the staff ops read", () => {
    const d = PlanFollowingSchema.parse(OPS);
    expect(d.status).toBe("red");
    expect(d.red[0].state).toBe("plan_outside_caps");
    expect(d.byDay[0].changesApplied).toBe(1);
  });

  it("parses a funnel campaign row with the switch, its last check and a draining part", () => {
    const c = SalesFunnelCampaignSchema.parse({
      id: "a", brandId: "b", offerId: "o", salesFunnelId: "f", salesFunnelName: "n", status: "ongoing", stopReason: null,
      createdAt: "x", updatedAt: "x", followsPlan: true, runningSalesFunnelId: "g",
      planCheck: { state: "applied", detail: "2 kept, 1 born, 1 draining", checkedAt: "2026-10-29T08:10:00Z" },
      units: [
        { campaignId: "u1", pipeId: "lead-sourcing|start_to_lead_found", featureSlug: "lead-sourcing", legKey: "start_to_lead_found", status: "ongoing", workflowSlug: null, name: "Lead Sourcing", salesFunnelId: "f", planRole: "draining" },
      ],
    });
    expect(c.followsPlan).toBe(true);
    expect(c.planCheck?.state).toBe("applied");
    expect(isDraining(c.units[0])).toBe(true);
  });

  it("still parses a row cached before the switch existed", () => {
    const c = SalesFunnelCampaignSchema.parse({ id: "a", brandId: "b", offerId: "o", salesFunnelId: "f", salesFunnelName: "n", status: "ongoing", stopReason: null, createdAt: "x", updatedAt: "x", units: [] });
    expect(c.followsPlan).toBeUndefined();
  });
});

describe("plan following: words", () => {
  it("says every red state in plain words, an unknown one as served", () => {
    expect(planStateWords("plan_outside_caps")).toEqual({ words: "plan not applied: it would spend outside the campaign's budget", red: true });
    for (const s of ["no_plan", "plan_unreadable", "plan_not_ready", "plan_not_runnable", "apply_failed"]) expect(planStateWords(s).red).toBe(true);
    for (const s of ["following", "applied", "stopped", "switched_off"]) expect(planStateWords(s).red).toBe(false);
    for (const s of ["plan_contradicts_brief", "restore_failed"]) expect(planStateWords(s).red).toBe(true);
    expect(planStateWords("brand_new").words).toBe("brand_new");
    expect(followsPlanWords(true)).toBe("Follows its plan");
    expect(followsPlanWords(false)).toBe("Fixed funnel");
    expect(DRAINING_WORDS).toBe("Finishing its follow-ups");
  });
});

describe("plan following: surfaces", () => {
  it("campaign card shows the switch read only, inside the staff-only section", () => {
    const card = read("components/v2/factory-plan-card.tsx");
    const body = card.slice(card.indexOf("function FactoryPlanBody("), card.indexOf("function PlanSwitchRow("));
    expect(body).toContain("<PlanSwitchRow campaign={campaign} />");
    const row = card.slice(card.indexOf("function PlanSwitchRow("), card.indexOf("// ─── Plan changes"));
    expect(row).toContain("followsPlanWords(follows)");
    expect(row).toContain("DRAINING_WORDS");
    expect(row).not.toMatch(/onClick|onChange|useMutation/);
  });

  it("is a Monitoring page with its red tile above the rows, on the staff gateway route, never persisted", () => {
    expect(MONITORING_PAGES).toContain("factory/following");
    expect(parseMonitoringPath("/factory/following")).toEqual({ view: "page", page: "factory/following" });
    const page = read("components/v2/monitoring-page.tsx");
    expect(page).toContain('view.page === "factory/following" && <PlanFollowingPage />');
    const hub = page.slice(page.indexOf("function Hub("), page.indexOf("function Section("));
    expect(hub.indexOf("<PlanFollowingTile")).toBeGreaterThan(-1);
    expect(hub.indexOf("<PlanFollowingTile")).toBeLessThan(hub.indexOf("<Section "));
    expect(read("lib/api.ts")).toContain('planFollowing: "/campaigns/ops/plan-following"');
    const persist = read("lib/persist-cache.ts");
    const sensitive = persist.slice(persist.indexOf("export const SENSITIVE_QUERY_ROOTS"), persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    expect(sensitive).toContain('"staffPlanFollowing"');
    const view = read("components/v2/monitoring-factory.tsx");
    expect(view).toContain('data.status === "red"');
  });
});

/**
 * FACTORY-P1-PLAN-CHANGES: the campaign card lists the plan changes a funnel campaign applied (campaign-service #808
 * `GET /sales-funnel-campaigns/{id}/plan-changes`, api-service #1411). Body = campaign-service openapi `SalesFunnelPlanChange`.
 */
describe("plan changes", () => {
  const BODY = {
    salesFunnelCampaignId: "c1",
    followsPlan: true,
    salesFunnelId: "start_to_lead_found@lead-sourcing+lead_found_to_positive_reply@sales-cold-email-outreach",
    runningSalesFunnelId: "start_to_lead_found@lead-sourcing+lead_found_to_positive_reply@sales-cold-email-outreach~s2",
    planCheck: null,
    changes: [
      {
        id: "pc1",
        fromSalesFunnelId: "start_to_lead_found@lead-sourcing+lead_found_to_positive_reply@sales-cold-email-outreach",
        toSalesFunnelId: "start_to_lead_found@lead-sourcing+lead_found_to_positive_reply@sales-cold-email-outreach~s2",
        planComputedAt: null,
        appliedAt: "2026-10-28T10:00:00.000Z",
        units: [{ campaignId: "u1", pipeId: "sales-cold-email-outreach|lead_found_to_positive_reply", action: "born" }],
      },
    ],
  };

  it("parses the served body, empty list included", () => {
    expect(PlanChangesSchema.parse(BODY).changes[0].toSalesFunnelId).toContain("~s2");
    expect(PlanChangesSchema.parse({ ...BODY, changes: [] }).changes).toEqual([]);
  });

  it("is read through the /v1 relay, never persisted, inside the staff-only card, nothing drawn when empty", () => {
    const api = read("lib/api.ts");
    const reader = api.slice(api.indexOf("export async function getSalesFunnelCampaignPlanChanges("));
    expect(reader.slice(0, 400)).toContain("/sales-funnel-campaigns/${encodeURIComponent(id)}/plan-changes");
    expect(reader.slice(0, 400)).toContain("PlanChangesSchema");
    const persist = read("lib/persist-cache.ts");
    const sensitive = persist.slice(persist.indexOf("export const SENSITIVE_QUERY_ROOTS"), persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    expect(sensitive).toContain('"salesFunnelPlanChanges"');
    const card = read("components/v2/factory-plan-card.tsx");
    const body = card.slice(card.indexOf("function FactoryPlanBody("), card.indexOf("function PlanSwitchRow("));
    expect(body).toContain("<PlanChangesRow campaignId={campaign.id} />");
    const row = card.slice(card.indexOf("function PlanChangesRow("), card.indexOf("function PlanChangeLine("));
    expect(row).toContain('["salesFunnelPlanChanges", campaignId]');
    expect(row).toContain("if (changes.length === 0) return null;");
    const pipes = card.slice(card.indexOf("function FunnelPipes("), card.indexOf("// ─── Brief: text"));
    expect(pipes).toContain('useStaffCatalogueObject("sales-funnels", salesFunnelId)');
    expect(pipes).toContain("<ServedPipeMark pipeId={l.pipe.id}");
  });
});
