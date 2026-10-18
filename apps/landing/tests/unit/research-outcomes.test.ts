import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM module, no types
import { outcomeCuts, emailOutcomeStudies, outcomeIdOf } from "../../scripts/blog-data/outcomes.mjs";

// Emails as derive.mjs hands them over: two pipes landing on ONE step (the positive reply), so
// the outcome row pools them. Lead L1 gets two emails on pipe A and one on pipe B (two campaigns),
// and replies on pipe B: one lead, reached once.
const row = (o: Partial<Record<string, unknown>>) => ({
  workflow: "wf-a-v1", dynasty: "wf-a", strategy: null, strategyState: "unattributed",
  orgId: "org-1", month: "2026-08", chartMonth: "2026-08", cost: 1, hit: false, ...o,
});
const pipeA = [
  row({ leadId: "L1", cost: 3 }),
  row({ leadId: "L1", cost: 1 }),
  row({ leadId: "L2", cost: 3, hit: true }),
  row({ leadId: "L3", cost: 3, month: "2026-09", chartMonth: "2026-09" }),
  // an email whose run carries a lead strategy (recorded since Oct 18)
  row({ leadId: "L4", cost: 3, strategy: "valid-only", strategyState: "resolved", hit: true }),
  // no lead record: in the cost, out of the rate
  row({ leadId: null, cost: 2 }),
];
const pipeB = [
  row({ leadId: "L1", cost: 4, workflow: "wf-b-v2", dynasty: "wf-b", hit: true, orgId: "org-2" }),
  row({ leadId: "L5", cost: 4, workflow: "wf-b-v2", dynasty: "wf-b", orgId: "org-2" }),
];
const sets = [
  { pipe: "pipe-a", channel: "chan-1", leg: "lead_found_to_conversation", step: "conversation", emailsNoun: "emails", rows: pipeA },
  { pipe: "pipe-b", channel: "chan-2", leg: "lead_found_to_conversation", step: "conversation", emailsNoun: "emails", rows: pipeB },
];
// Jev's verdicts per workflow VERSION: wf-a-v1 follows "catch-all", wf-b-v2 does not.
const verdicts = new Map([
  ["wf-a-v1", new Map([["catch-all", true]])],
  ["wf-b-v2", new Map([["catch-all", false]])],
]);

const o = { id: "positive-reply", noun: "positive reply", nouns: "positive replies", emailsNoun: "emails", required: 1, lastMonth: "2026-09", partialMonth: "2026-09" };
const words = {
  pipeName: (p: string) => ({ "pipe-a": "Dotterel", "pipe-b": "Vireo" })[p],
  channelName: (c: string) => ({ "chan-1": "Sales Cold Email Outreach", "chan-2": "Feedback Request" })[c],
  legName: () => "Lead → Positive reply",
  workflowLabel: (d: string) => ({ "wf-a": "Gemini 3 Flash · Cold email v1", "wf-b": "GLM 5.2 Pro · Cold email v2" })[d],
  strategyLabel: (id: string) => ({ "valid-only": "Valid only (default)" })[id],
  tacticName: (id: string) => ({ "catch-all": "Catch-all" })[id],
};

describe("research outcome studies", () => {
  const [entry] = outcomeCuts(sets, verdicts);
  const studies = emailOutcomeStudies(o, entry, words, { note: "rule", visitLine: null, strategyRecordedFrom: "2026-10-18" });
  const byId = new Map(studies.map((s: { id: string }) => [s.id, s]));

  it("pools every pipe landing on the step into one outcome row", () => {
    expect(entry.step).toBe("conversation");
    expect(entry.pipes.map((p: { pipe: string }) => p.pipe)).toEqual(["pipe-a", "pipe-b"]);
    expect(outcomeIdOf("Positive reply")).toBe("positive-reply");
    expect(studies.map((s: { id: string }) => s.id)).toContain("outcome-positive-reply-pipe-roi");
    expect(studies).toHaveLength(14);
  });

  it("counts a conversion rate in LEADS, never emails: one lead on two campaigns counts once", () => {
    // leads L1..L5 entered, L1 L2 L4 reached; the email with no lead stays out of the rate
    expect(entry.scope.leads).toBe(5);
    expect(entry.scope.noLead).toBe(1);
    const overall = byId.get("outcome-positive-reply-overall-rate");
    expect(overall.result.display).toBe("60.00%");
    expect(overall.result.sample).toBe("3 of 5 leads");
    // by pipe, a lead counts in each pipe it entered: pipe A 2 of 4, pipe B 1 of 2
    const pipe = byId.get("outcome-positive-reply-pipe-rate");
    expect(pipe.charts[0].points.map((p: { label: string; display: string }) => `${p.label} ${p.display}`)).toEqual(["Dotterel 50.00%", "Vireo 50.00%"]);
  });

  it("prices an outcome on the emails' spend over the outcomes they earned, the pipes' own count", () => {
    const overall = byId.get("outcome-positive-reply-overall-roi");
    // spend 3+1+3+3+3+2+4+4 = 23 over 3 positive replies
    expect(overall.result.display).toBe("$7.67");
    const pipe = byId.get("outcome-positive-reply-pipe-roi");
    expect(pipe.charts[0].points.map((p: { label: string; display: string }) => `${p.label} ${p.display}`)).toEqual(["Dotterel $7.50", "Vireo $8.00"]);
    expect(pipe.verdict.kind).toBe("noise");
  });

  it("leaves a pre-attribution email out of the strategy cut, never under the default", () => {
    const st = byId.get("outcome-positive-reply-strategy-roi");
    expect(st.charts[0].points).toHaveLength(1);
    expect(st.charts[0].points[0].label).toBe("Valid only (default)");
    expect(st.headline).toMatch(/is the only lead strategy/);
    expect(st.conclusion[0]).toMatch(/recorded since Oct 18, 2026: the 7 emails that carry no record/);
  });

  it("files each email under its workflow version's tactic verdict, the side not following it stated beside", () => {
    const t = byId.get("outcome-positive-reply-tactic-rate");
    expect(t.charts[0].points).toHaveLength(1);
    expect(t.winner).toBe("Catch-all");
    // followed: pipe A's leads (L1 L2 L3 L4: 2 reached); not followed: pipe B's (L1 L5: 1 reached)
    expect(t.charts[0].points[0].note).toBe("Followed: 50.00%, 2 of 4 leads went on to a positive reply · Not followed: 50.00%, 1 of 2 leads went on to a positive reply");
    expect(t.conclusion.join(" ")).toMatch(/re-judges it in place when that text changes/);
  });

  it("states a verdict on every study, and a cut with no outcome reads not enough data", () => {
    for (const s of studies) expect(["conclusion", "signal", "noise"], s.id).toContain(s.verdict.kind);
    const [dry] = outcomeCuts([{ ...sets[0], rows: pipeA.map((r) => ({ ...r, hit: false })) }], verdicts);
    const none = emailOutcomeStudies(o, dry, words, { note: "rule", visitLine: null, strategyRecordedFrom: "2026-10-18" });
    expect(none.find((s: { id: string }) => s.id === "outcome-positive-reply-workflow-roi").status).toBe("not_enough_data");
  });
});
