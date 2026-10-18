import { describe, expect, it } from "vitest";
// @ts-expect-error plain ESM module, no types
import { jevStudies } from "../../scripts/blog-data/jev.mjs";

const window = { from: "2026-04-15", to: "2026-10-13" };
const runs = [
  { month: "2026-09", route: "judgments", asker: "lead-service", judgments: "1000", orgs: "3", tokens: "500000", cents: "10" },
  { month: "2026-10", route: "judgments", asker: "lead-service", judgments: "3000", orgs: "4", tokens: "1500000", cents: "30" },
  { month: "2026-10", route: "platform-judgments", asker: "", judgments: "1000", orgs: "0", tokens: "400000", cents: "8" },
];
const screens = [
  { screen: "human-service", month: "2026-09", bucket: "lt20", verdict: "decline", people: "2000" },
  { screen: "human-service", month: "2026-09", bucket: "lt50", verdict: "decline", people: "500" },
  // turned away under the old 0.8 bar: a pass at today's bar, never a decline
  { screen: "human-service", month: "2026-09", bucket: "lt80", verdict: "decline", people: "300" },
  { screen: "human-service", month: "2026-09", bucket: "lt80", verdict: "pass", people: "200" },
  { screen: "lead-service", month: "2026-10", bucket: "ge80", verdict: "pass", people: "1000" },
];
const reach = [
  { org_id: "a", audience_id: "1" },
  { org_id: "b", audience_id: "2" },
  { org_id: "b", audience_id: "3" },
];
const replyKinds = [
  { kind: "lead_out_of_office", replies: "30" },
  { kind: "auto_reply_received", replies: "20" },
  { kind: "lead_interested", replies: "50" },
  { kind: "", replies: "9" },
];
const base = { runs, runOrgs: [{ org_id: "a" }, { org_id: "b" }], screens, reach, reveal: { credits: "100", cents: "1000" }, replyKinds, replyOrgs: [{ org_id: "a" }, { org_id: "b" }], window };

describe("typed judgment studies (jev.mjs)", () => {
  const { studies, outcomes } = jevStudies(base);
  const by = (id: string) => studies.find((s: { id: string }) => s.id === id);

  it("sits every study in the Typed judgment outcome section", () => {
    expect(outcomes.map((o: { id: string }) => o.id)).toEqual(["judgment"]);
    for (const s of studies) {
      expect(s.pipe).toBeNull();
      expect(s.outcome).toBe("judgment");
      expect(s.topic).toBe("judgment");
      for (const c of s.charts) expect(c.note).toBeTruthy();
    }
  });

  it("counts every judgment and draws the read's month dotted", () => {
    const v = by("jev-volume");
    expect(v.result.display).toBe("5,000");
    const months = v.charts[0].points;
    expect(months.map((p: { label: string }) => p.label)).toEqual(["Sep", "Oct"]);
    expect(months[1].partial).toBe(true);
    expect(months[0].partial).toBeUndefined();
  });

  it("declines at today's bar only: the old 0.8 bar's declines count as passes", () => {
    const d = by("jev-screen-decline");
    // 2,500 at or under 0.5, of 4,000 screened
    expect(d.result.display).toBe("63%");
    expect(d.result.sample).toContain("2,500 of 4,000 people");
    expect(d.conclusion.join(" ")).toContain("300 people between 50% and 80%");
    // 4,000 screened, 1,500 kept: the same budget reaches 2.7x more people who fit
    expect(d.conclusion.join(" ")).toContain("reaches 2.7x more people who fit");
    expect(d.verdict.kind).toBe("conclusion");
  });

  it("prices a screen against a reveal on the screening runs only", () => {
    const p = by("jev-screen-price");
    // screen: 40 cents / 4,000 = $0.0001; reveal: 1,000 cents / 100 = $0.10
    expect(p.result.display).toBe("1,000x");
  });

  it("counts machine replies and leaves unlabelled ones out", () => {
    const m = by("jev-machine-replies");
    expect(m.result.display).toBe("50%");
    expect(m.result.sample).toBe("50 of 100 replies");
  });

  it("says signal, not conclusion, on one client", () => {
    const one = jevStudies({ ...base, reach: [{ org_id: "a", audience_id: "1" }], replyOrgs: [{ org_id: "a" }] });
    expect(one.studies.find((s: { id: string }) => s.id === "jev-screen-decline").verdict.kind).toBe("signal");
    expect(one.studies.find((s: { id: string }) => s.id === "jev-machine-replies").headline).toContain("A signal to confirm");
  });
});
