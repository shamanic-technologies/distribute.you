import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM module, no types
import { outcomeCuts, emailOutcomeStudies, outcomeIdOf, meetingOutcomeEntry, meetingOutcomeStudies } from "../../scripts/blog-data/outcomes.mjs";

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

  it("splits an outcome's cost by pipe, channel and leg: every bar is its spend over EVERY outcome, so the bars add up", () => {
    const overall = byId.get("outcome-positive-reply-overall-roi");
    // spend 3+1+3+3+3+2+4+4 = 23 over 3 positive replies
    expect(overall.result.display).toBe("$7.67");
    const pipe = byId.get("outcome-positive-reply-pipe-roi");
    // pipe A 15 / 3, pipe B 8 / 3: never a pipe's spend over its own replies
    expect(pipe.charts[0].points.map((p: { label: string; display: string }) => `${p.label} ${p.display}`)).toEqual(["Dotterel $5.00", "Vireo $2.67"]);
    expect(pipe.result.display).toBe(overall.result.display);
    expect(pipe.verdict).toEqual(overall.verdict);
    expect(pipe.charts[0].note).toMatch(/^Each bar is that pipe's spend over every positive reply \(3\), so the bars add up/);
    const rate = byId.get("outcome-positive-reply-pipe-rate");
    expect(rate.charts[0].note).toMatch(/^Each bar is the share of the leads that entered that pipe who went on to a positive reply\./);
  });

  it("every cost split adds up to its outcome's average, within rounding", () => {
    for (const s of studies.filter((x: { goal: string; topic: string; status: string }) => x.goal === "roi" && ["pipe", "channel", "leg"].includes(x.topic) && x.status === "measured")) {
      const sum = s.charts[0].points.reduce((t: number, p: { value: number }) => t + p.value, 0);
      expect(Math.abs(sum - 23 / 3), s.id).toBeLessThan(0.01 * s.charts[0].points.length);
    }
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

// The Meeting booked row: two cold email pipes and the meeting booking leg on the brands that report
// meetings, one meeting after the booking step acted, one after a cold email only.
describe("research Meeting booked outcome row", () => {
  const read = {
    reporting: ["b1"],
    meetings: [
      { id: "m1", lead: "L1", brand: "b1", at: "2026-09-10 10:00:00.000" },
      { id: "m2", lead: "L3", brand: "b1", at: "2026-09-20 10:00:00.000" },
      { id: "m3", lead: null, brand: "b1", at: "2026-09-21 10:00:00.000" },
    ],
    spendByPipe: [
      { channel: "sales-cold-email-outreach", leg: "lead_found_to_conversation", spend: 500 },
      { channel: "sales-cold-email-outreach", leg: "", spend: 40 },
      { channel: "ai-meeting-booking", leg: "conversation_to_meeting_booked", spend: 60 },
    ],
    totalSpend: 600,
    acted: [
      { lead: "L1", brand: "b1", at: "2026-09-05 10:00:00.000", runId: "run-1" },
      { lead: "L2", brand: "b1", at: "2026-09-06 10:00:00.000", runId: null },
    ],
    outcomesRequired: 10,
    verdict: { kind: "noise", reason: "Learning: 3 meetings of the 10 a figure needs." },
  };
  const emailLeads = {
    "sales-cold-email-outreach|lead_found_to_conversation": [["L1", "2026-09-01 10:00:00"], ["L2", "2026-09-01 11:00:00"], ["L3", "2026-09-02 10:00:00"], ["L4", "2026-09-03 10:00:00"]],
  };
  const runs = [
    { run_id: "run-1", workflow_slug: "amb-rhodium-v2", campaign_id: "c-auk", cents: "4000" },
    { run_id: "run-2", workflow_slug: "amb-rhodium-v2", campaign_id: "c-auk", cents: "2000" },
  ];
  const entry = meetingOutcomeEntry({
    read, emailLeads, runs,
    dynastyOf: new Map([["amb-rhodium-v2", "amb-rhodium"]]),
    brandOfCampaign: new Map([["c-auk", "b1"]]),
    verdicts: new Map([["amb-rhodium-v2", new Map([["catch-all", false]])]]),
    strategyOf: () => ({ id: null }),
    step: "meeting_booked",
    meetingPipe: "ai-meeting-booking|conversation_to_meeting_booked",
  });
  const o = { id: "meeting-booked", noun: "booked meeting", nouns: "booked meetings", emailsNoun: "leads", required: 10, lastMonth: "2026-10", partialMonth: "2026-10", firstTouch: "a pipe first wrote to or acted on" };
  const words = {
    pipeLabel: (k: string) => ({ "sales-cold-email-outreach|lead_found_to_conversation": "Dotterel", "sales-cold-email-outreach|": "Sales Cold Email Outreach, no leg recorded", "ai-meeting-booking|conversation_to_meeting_booked": "Auk" })[k],
    channelName: (c: string) => ({ "sales-cold-email-outreach": "Sales Cold Email Outreach", "ai-meeting-booking": "AI Meeting Booking" })[c],
    legName: (l: string) => l || "No leg recorded",
    workflowLabel: (d: string) => `AI Meeting Booking · ${d}`,
    strategyLabel: (id: string) => id,
    tacticName: (id: string) => id,
  };
  const studies = meetingOutcomeStudies(o, entry, words, { costBasis: "user", verdict: read.verdict, strategyRecordedFrom: "2026-10-18" });
  const byId = new Map(studies.map((s: { id: string }) => [s.id, s]));

  it("splits the $200 average over every pipe the money went to: the bars add up to it", () => {
    for (const cut of ["pipe", "channel", "leg"]) {
      const s = byId.get(`outcome-meeting-booked-${cut}-roi`);
      expect(s.result.display, cut).toBe("$200");
      const sum = s.charts[0].points.reduce((t: number, p: { value: number }) => t + p.value, 0);
      expect(Math.abs(sum - 200), cut).toBeLessThan(0.02);
    }
    expect(byId.get("outcome-meeting-booked-pipe-roi").charts[0].points.map((p: { label: string; display: string }) => `${p.label} ${p.display}`)).toEqual([
      "Dotterel $167", "Auk $20", "Sales Cold Email Outreach, no leg recorded $13",
    ]);
  });

  it("reads each pipe's rate on its own leads, and the overall rate on every lead once", () => {
    // Dotterel: L1 and L3 of four booked after their first email; Auk: L1 of the two it acted on
    const rate = byId.get("outcome-meeting-booked-pipe-rate");
    expect(rate.charts[0].points.map((p: { label: string; display: string }) => `${p.label} ${p.display}`)).toEqual(["Dotterel 50.00%", "Auk 50.00%"]);
    expect(byId.get("outcome-meeting-booked-overall-rate").result.sample).toBe("2 of 4 leads");
  });

  it("files the meeting booking step's leads under the run that acted, and says how many carry none", () => {
    const wf = byId.get("outcome-meeting-booked-workflow-rate");
    expect(wf.charts[0].points[0].label).toBe("AI Meeting Booking · amb-rhodium");
    expect(wf.charts[0].points[0].note).toBe("1 of 1 lead went on to a booked meeting");
    expect(wf.conclusion[0]).toMatch(/1 of the 2 leads it acted on carry no such run/);
    // its spend: every run of the version on the reporting brands, $60, over the 1 meeting after it acted
    expect(byId.get("outcome-meeting-booked-workflow-roi").result.display).toBe("$60");
    expect(byId.get("outcome-meeting-booked-tactic-rate").winner ?? null).toBeNull();
    expect(byId.get("outcome-meeting-booked-strategy-rate").status).toBe("not_enough_data");
  });
});

