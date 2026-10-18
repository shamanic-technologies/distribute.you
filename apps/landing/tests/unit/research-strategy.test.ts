import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM module, no types
import { attributionIndex, bySourceStrategy, strategyLabels, strategyPopulation } from "../../scripts/blog-data/strategy.mjs";

// The rows extract.sh dumps (play-attributions.csv, source-handoffs.csv, strategies.json), as derive.mjs reads them.
const attributions = [
  // two outreach runs on the default play, one on another strategy
  { run_id: "out-1", run_kind: "execution", caller_run_id: "", play_state: "resolved", strategy_id: "valid-only", play_is_default: "true", recorded_at: "2026-10-18 13:42:40.317" },
  { run_id: "out-2", run_kind: "execution", caller_run_id: "", play_state: "resolved", strategy_id: "valid-only", play_is_default: "true", recorded_at: "2026-10-18 13:50:00.000" },
  { run_id: "out-3", run_kind: "execution", caller_run_id: "", play_state: "resolved", strategy_id: "valid-catch-all", play_is_default: "false", recorded_at: "2026-10-18 13:55:00.000" },
  // a run recorded with no play
  { run_id: "out-4", run_kind: "execution", caller_run_id: "", play_state: "no_play", strategy_id: "", play_is_default: "", recorded_at: "2026-10-18 13:56:00.000" },
  // sourcing: a scheduled run that handed its lead over, and an on_demand run asked by out-3
  { run_id: "src-1", run_kind: "execution", caller_run_id: "", play_state: "resolved", strategy_id: "valid-catch-all-unknown", play_is_default: "false", recorded_at: "2026-10-18 13:42:34.562" },
  { run_id: "src-2", run_kind: "on_demand", caller_run_id: "out-3", play_state: "resolved", strategy_id: "warm-never-converted", play_is_default: "false", recorded_at: "2026-10-18 13:54:00.000" },
];
const handoffs = [{ lead_id: "lead-1", platform_campaign_id: "camp-a", source_run_id: "src-1" }];
const strategies = [
  { id: "valid-only", name: "Valid only" },
  { id: "valid-catch-all", name: "Valid + Catch-all" },
  { id: "valid-catch-all-unknown", name: "Valid + Catch-all + Unknown" },
  { id: "warm-never-converted", name: "Warm, never converted" },
];
// One row per email, as derive.mjs builds them: its generation run, lead and outreach campaign.
const emails = [
  { runId: "out-1", leadId: "lead-1", campaign: "camp-a" },
  { runId: "out-2", leadId: "lead-2", campaign: "camp-a" },
  { runId: "out-3", leadId: "lead-3", campaign: "camp-a" },
  { runId: "out-4", leadId: "lead-4", campaign: "camp-a" },
  // sent before 2026-10-18: its run carries no attribution
  { runId: "old-run", leadId: "lead-1", campaign: "camp-old" },
];

function tag() {
  const idx = attributionIndex({ attributions, handoffs, strategies });
  const rows = emails.map((e) => {
    const st = idx.strategyOf(e.runId);
    return { ...e, strategy: st.id, strategyState: st.state, strategyDefault: st.isDefault, sourceStrategies: st.state === "unattributed" ? [] : idx.sourcesOf(e.runId, e.leadId, e.campaign) };
  });
  return { idx, rows };
}

describe("research lead strategy attribution", () => {
  it("files each email under the strategy its run was served under", () => {
    const { rows } = tag();
    expect(rows.map((r) => r.strategy)).toEqual(["valid-only", "valid-only", "valid-catch-all", null, null]);
    expect(rows[3].strategyState).toBe("no_play");
  });

  it("leaves a pre-attribution email out, never under the default", () => {
    const { rows } = tag();
    const old = rows[4];
    expect(old.strategyState).toBe("unattributed");
    expect(old.strategy).toBeNull();
    expect(old.sourceStrategies).toEqual([]);
    expect(rows.filter((r) => r.strategy === "valid-only")).toHaveLength(2);
  });

  it("marks the default play in the label and names strategies as served", () => {
    const { idx, rows } = tag();
    expect(strategyLabels(rows, (r: { strategy: string }) => r.strategy, (r: { strategyDefault: boolean }) => r.strategyDefault, idx.nameOf)).toEqual({
      "valid-only": "Valid only (default)",
      "valid-catch-all": "Valid + Catch-all",
    });
  });

  it("finds the sourcing strategy by the handoff and by the on_demand caller", () => {
    const { rows } = tag();
    expect(rows[0].sourceStrategies.map((s: { id: string }) => s.id)).toEqual(["valid-catch-all-unknown"]);
    expect(rows[2].sourceStrategies.map((s: { id: string }) => s.id)).toEqual(["warm-never-converted"]);
    expect(rows[1].sourceStrategies).toEqual([]);
    const sourced = bySourceStrategy(rows);
    expect(sourced.map((r: { sourceStrategy: string }) => r.sourceStrategy)).toEqual(["valid-catch-all-unknown", "warm-never-converted"]);
  });

  it("throws on a strategy the catalogue does not name", () => {
    expect(() => strategyLabels([{ strategy: "ghost" }], (r: { strategy: string }) => r.strategy, () => false, new Map())).toThrow(/ghost/);
  });

  it("states who is in and who is out, with the day recording began", () => {
    const o = { noun: "positive reply", emailsNoun: "emails" };
    const scope = { recordedFrom: "2026-10-18", emails: 5, attributed: 3, noPlay: 1, unattributed: 1, sourced: 2, waiting: 0 };
    const line = strategyPopulation(scope, o, "strategy", 21);
    expect(line).toContain("the 3 emails a lead strategy is recorded for, out of 5 emails");
    expect(line).toContain("since Oct 18, 2026: the 1 email that carries no record (every email before that day) is left out");
    expect(line).toContain("never counted under the default");
    expect(line).toContain("the 1 email whose run was served under no strategy");
    const sourcing = strategyPopulation({ ...scope, waiting: 40 }, o, "sourcing", 21);
    expect(sourcing).toContain("the 2 emails whose lead a recorded sourcing strategy found");
    expect(sourcing).toContain("40 emails already carry one and wait for the 21-day rule");
    expect(sourcing).toContain("Rate only");
    expect(strategyPopulation({ ...scope, recordedFrom: null }, o, "strategy", 21)).toContain("No run's strategy was recorded yet");
  });
});
