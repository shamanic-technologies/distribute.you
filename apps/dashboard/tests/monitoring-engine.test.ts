import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MONITORING_PAGES, parseMonitoringPath } from "../src/lib/monitoring/monitoring";
import { FactoryShadowMonitoringSchema, enginePlaceRows, engineReasonWords, regretPct } from "../src/lib/factory-shadow";

/**
 * ENGINE-PER-OUTCOME-SHADOW (owner 2026-10-31, GTM Factory v10 "one Engine per outcome"): features-service's factory pass
 * serves, beside the plan, today's pick vs the Engine's Thompson pick per campaign place, a daily agreement series and a
 * 30-day replay regret (`engine` on `/internal/factory-shadow/monitoring`). Monitoring > Factory plan > Engine pick draws
 * it; red ONLY on the served engine verdict; nothing computed in the browser.
 */
const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");

const pick = { candidateId: "sales-cold-email-outreach|lead_found_to_positive_reply::wf", pipeId: "sales-cold-email-outreach|lead_found_to_positive_reply", channelName: "Email Sending", workflowDynastySlug: "wf", workflowDynastyName: "Nobelium" };
const body = {
  verdict: { red: false, reasons: [] },
  lastPass: null,
  everyHours: 3,
  series: [],
  campaigns: [
    {
      campaignId: "c1",
      orgId: "o1",
      brandId: "b1",
      salesFunnelName: "Email Meetings",
      status: "ok",
      failure: null,
      pickDiffers: false,
      planDiffers: false,
      engine: {
        status: "ok",
        failure: null,
        comparable: 1,
        agreed: 0,
        expectedAgreementPct: 12.5,
        places: [{ outcome: "positive_reply", outcomeName: "Positive reply", consumer: "campaign", consumerName: "Campaign", today: pick, todayUnavailableReason: null, engine: { ...pick, candidateId: "x", workflowDynastySlug: "wf2", workflowDynastyName: "Iridium" }, engineModal: pick, agrees: false, todayPickSharePct: 12.5, state: "ok", candidates: 4 }],
      },
    },
  ],
  engine: {
    verdict: { red: false, reasons: [] },
    last: { day: "2026-10-31", places: 1, agreed: 0, disagreed: 1, agreementPct: 0, expectedAgreementPct: 12.5, failed: 0 },
    series: [{ day: "2026-10-31", places: 1, agreed: 0, disagreed: 1, agreementPct: 0, expectedAgreementPct: 12.5, failed: 0 }],
    problems: [],
    replay: {
      computedAt: "2026-10-31T12:00:00Z",
      windowDays: 30,
      checkpoints: [],
      families: [{ outcome: "positive_reply", outcomeName: "Positive reply", candidates: 6, graded: 3, windowDecisions: 1200, bestValuePerDollar: 2.1, bestCandidateId: "x", todayRegret: 0.31, todayValuePerDollar: 1.4, todayUngradedPct: 5, engineRegret: 0.12, engineValuePerDollar: 1.8, engineUngradedPct: 9, regretGain: 0.19, reason: null }],
      totals: { todayRegret: 0.31, engineRegret: 0.12, regretGain: 0.19, families: 1 },
      caveats: [],
      failure: null,
    },
  },
};

describe("engine shadow: served shape", () => {
  it("parses the served body, and a body from before the Engine (no `engine`)", () => {
    const parsed = FactoryShadowMonitoringSchema.parse(body);
    expect(parsed.engine?.replay?.totals.engineRegret).toBe(0.12);
    expect(enginePlaceRows(parsed)).toHaveLength(1);
    const { engine: _e, ...before } = body;
    expect(FactoryShadowMonitoringSchema.parse({ ...before, campaigns: [] }).engine).toBeUndefined();
  });
  it("words served codes and regret without computing a figure", () => {
    expect(regretPct(0.31)).toBe("31%");
    expect(regretPct(null)).toBeNull();
    expect(engineReasonWords("replay_failed")).toBe("the 30-day replay failed");
  });
});

describe("engine shadow: Monitoring page and hub", () => {
  it("is a Monitoring page, mounted, its tile above the collapsible rows", () => {
    expect(MONITORING_PAGES).toContain("factory/engine");
    expect(parseMonitoringPath("/factory/engine")).toEqual({ view: "page", page: "factory/engine" });
    const page = read("components/v2/monitoring-page.tsx");
    expect(page).toContain('view.page === "factory/engine" && <EnginePage />');
    const hub = page.slice(page.indexOf("function Hub("), page.indexOf("function Section("));
    expect(hub.indexOf("<EngineTile")).toBeGreaterThan(-1);
    expect(hub.indexOf("<EngineTile")).toBeLessThan(hub.indexOf("<Section "));
  });
  it("turns red ONLY on the served engine verdict, and computes nothing", () => {
    const src = read("components/v2/monitoring-engine.tsx");
    const tile = src.slice(src.indexOf("export function EngineTile("));
    expect(tile).toContain("engine.verdict.red ? RED : undefined");
    expect(src).not.toMatch(/\.sort\(/);
    expect(src).not.toMatch(/\.reduce\(/);
    expect(src).not.toMatch(/places\s*-\s*/);
  });
});
