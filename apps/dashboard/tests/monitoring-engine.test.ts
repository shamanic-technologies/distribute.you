import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MONITORING_PAGES, parseMonitoringPath } from "../src/lib/monitoring/monitoring";
import { FactoryShadowMonitoringSchema, engineBrokenRows, enginePlaceRows, engineReasonWords, regretPct, resultStatusLook, unpickedReasonWords } from "../src/lib/factory-shadow";

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
    results: [
      { family: "lead_found|start|-", outcome: "lead_found", outcomeName: "Lead, from Start", todayRegret: 0.08, engineRegret: 0.01, status: "switched", units: 1, driving: 1, rolledBack: 0, switchedSince: "2026-11-01T12:00:00Z", heldDays: 0, fleetEligible: true, drives: [] },
      { family: "conversation|start|-", outcome: "conversation", outcomeName: "Positive reply, from Lead found", todayRegret: 0.15, engineRegret: 0.54, status: "shadow", units: 0, driving: 0, rolledBack: 0, switchedSince: null, heldDays: null, fleetEligible: false, drives: [] },
    ],
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
  it("reads each result's served status: Switched, Shadow, Rolled back (red only for a roll-back)", () => {
    expect(FactoryShadowMonitoringSchema.parse(body).engine?.results?.map((r) => r.status)).toEqual(["switched", "shadow"]);
    expect(resultStatusLook("rolled_back")).toEqual({ word: "Rolled back", tone: "var(--data-rose)" });
    expect(resultStatusLook("switched").tone).not.toContain("rose");
    expect(resultStatusLook("shadow").tone).not.toContain("rose");
    expect(engineReasonWords("rolled_back")).toContain("rolled back");
  });
  it("words served codes and regret without computing a figure", () => {
    expect(regretPct(0.31)).toBe("31%");
    expect(regretPct(null)).toBeNull();
    expect(engineReasonWords("replay_failed")).toBe("the 30-day replay failed");
  });
});

/**
 * ENGINE-FULL-MIGRATION-1102 (owner 2026-11-02, « mets sur tout partout pour tous les clients »): the Engine drives every
 * result of every live campaign. A result a live campaign works with no Engine pick is red with its campaigns named; a
 * switched result missing a pick on some campaigns shows that count; a rolled-back unit says when it re-tries;
 * `fleetEligible` is deprecated and may be absent.
 */
const result = (over: Record<string, unknown>) => ({
  family: "f",
  outcome: "o",
  outcomeName: "Positive reply, from Lead found",
  todayRegret: null,
  engineRegret: null,
  status: "switched",
  units: 3,
  driving: 3,
  rolledBack: 0,
  unpicked: 0,
  switchedSince: "2026-11-02T00:00:00Z",
  heldDays: 0,
  drives: [],
  unpickedCampaigns: [],
  ...over,
});
const withResults = (results: unknown[], reasons: string[] = []) => ({
  ...body,
  engine: { ...body.engine, verdict: { red: reasons.length > 0, reasons }, results },
});
const unpicked = (id: string, reason: string) => ({ funnelCampaignId: id, orgId: "o1", brandId: "b1", pipeId: "sales-cold-email-outreach|lead_found_to_positive_reply", unitCampaignId: null, reason });

describe("engine full migration: every result driven", () => {
  it("today's prod shape (all switched, green, fleetEligible served) parses with nothing broken", () => {
    const parsed = FactoryShadowMonitoringSchema.parse(withResults([result({ fleetEligible: true }), result({ family: "g", status: "shadow", units: 0, driving: 0, fleetEligible: false })]));
    expect(parsed.engine!.verdict.red).toBe(false);
    expect(parsed.engine!.results!.map((r) => resultStatusLook(r.status).word)).toEqual(["Switched", "Shadow"]);
    expect(engineBrokenRows(parsed.engine!)).toEqual([]);
  });
  it("a body WITHOUT fleetEligible parses", () => {
    const parsed = FactoryShadowMonitoringSchema.parse(withResults([result({})]));
    expect(parsed.engine!.results![0].status).toBe("switched");
  });
  it("a no_engine_pick result reads red with its campaigns listed and the reason in words", () => {
    const parsed = FactoryShadowMonitoringSchema.parse(
      withResults([result({ status: "no_engine_pick", units: 0, driving: 0, unpicked: 1, switchedSince: null, heldDays: null, unpickedCampaigns: [unpicked("c1", "no_candidate_priced")] })], ["results_without_engine"]),
    );
    expect(resultStatusLook("no_engine_pick")).toEqual({ word: "No Engine pick", tone: "var(--data-rose)" });
    expect(resultStatusLook("scripts")).toEqual({ word: "Scripts", tone: "var(--run)" });
    expect(unpickedReasonWords("no_script_kept")).toBe("the campaign's strategy keeps none of the scripts that make this result");
    expect(engineReasonWords("results_without_engine")).toBe("a result of a live campaign runs without an Engine pick");
    const rows = engineBrokenRows(parsed.engine!);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "unpicked", campaignId: "c1", outcomeName: "Positive reply, from Lead found" });
    expect(unpickedReasonWords("no_candidate_priced")).toBe("no workflow for this result has a price yet");
  });
  it("a switched result carrying unpicked: 2 shows the count and both campaigns", () => {
    const parsed = FactoryShadowMonitoringSchema.parse(withResults([result({ unpicked: 2, unpickedCampaigns: [unpicked("c1", "no_unit_campaign"), unpicked("c2", "no_candidate_on_pipe")] })], ["results_without_engine"]));
    expect(parsed.engine!.results![0].unpicked).toBe(2);
    expect(engineBrokenRows(parsed.engine!).map((r) => r.campaignId)).toEqual(["c1", "c2"]);
    const src = read("components/v2/monitoring-engine.tsx");
    expect(src).toContain("`No Engine pick on ${r.unpicked}`");
  });
  it("a rolled-back unit states when it re-tries", () => {
    const drive = { unitCampaignId: "u1", brandId: "b1", state: "rolled_back", workflowDynastySlug: "a", serviceDynastySlug: "b", switchedAt: "2026-10-20T00:00:00Z", rolledBackAt: "2026-11-01T00:00:00Z", guard: { verdict: "worse", rollBacks: 1, retryAt: "2026-11-15T00:00:00.000Z" } };
    const parsed = FactoryShadowMonitoringSchema.parse(withResults([result({ status: "rolled_back", rolledBack: 1, drives: [drive] })], ["rolled_back"]));
    expect(engineBrokenRows(parsed.engine!)[0]).toMatchObject({ kind: "rolled_back", rollBacks: 1, retryAt: "2026-11-15T00:00:00.000Z" });
    expect(read("components/v2/monitoring-engine.tsx")).toContain("re-tries ${");
  });
  it("shows nothing about a fleet gate", () => {
    const src = read("components/v2/monitoring-engine.tsx") + read("lib/factory-shadow.ts");
    expect(src).not.toMatch(/fleetEligible\s*:/);
    expect(src).not.toMatch(/after 7 days/i);
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
