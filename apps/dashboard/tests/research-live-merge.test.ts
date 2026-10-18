import { describe, expect, it } from "vitest";
import { mergeLiveResearch, type LiveResearchFile } from "../src/lib/research/live-merge";
import type { ResearchFile, ResearchStudy } from "../src/lib/research/research";

const study = (id: string, headline: string): ResearchStudy => ({
  id,
  pipe: "cold-email-website-visit",
  topic: "workflow",
  goal: "roi",
  question: id,
  status: "measured",
  headline,
  winner: null,
  crowned: false,
  result: null,
  charts: [],
  conclusion: [],
});

const snapshot = {
  generatedAt: "2026-10-18T14:18:25Z",
  allOrgs: true,
  window: { from: "2026-04-15", to: "2026-10-18" },
  readOn: "2026-10-18",
  volume: { emails: 100, orgs: 5, workflows: 3, linkedEmails: 40, byMonth: [] },
  maturation: { rule: "run_start", days: 21, cutoff: "2026-09-27", windowEnd: "2026-10-18", legs: {} as never, excludedEmails: 7, noRunStart: 2, note: "n" },
  pipes: [],
  studies: [study("a", "snap a"), study("b", "snap b")],
} as unknown as ResearchFile;

const live = {
  ...snapshot,
  generatedAt: "2026-10-18T15:30:00Z",
  computedAt: "2026-10-18T15:30:00Z",
  maturation: { rule: "run_start", days: 21, cutoff: "2026-09-27", windowEnd: "2026-10-18", legs: {} as never, note: "live" },
  studies: [study("a", "live a"), study("c", "live only")],
  unavailable: [{ id: "b", reason: "waits for content-generation" }],
} as unknown as LiveResearchFile;

describe("mergeLiveResearch", () => {
  it("serves a live study over its snapshot twin, the snapshot one marked with the live reason", () => {
    const m = mergeLiveResearch(live, snapshot);
    expect(m.studies.map((s) => [s.id, s.source, s.headline])).toEqual([
      ["a", "live", "live a"],
      ["b", "snapshot", "snap b"],
      ["c", "live", "live only"],
    ]);
    expect(m.studies[1].liveReason).toBe("waits for content-generation");
  });
  it("keeps the snapshot-only counts and its read day, the live build time beside them", () => {
    const m = mergeLiveResearch(live, snapshot);
    expect(m.volume.emails).toBe(100);
    expect(m.maturation.excludedEmails).toBe(7);
    expect(m.maturation.note).toBe("live");
    expect(m.readOn).toBe("2026-10-18");
    expect(m.computedAt).toBe("2026-10-18T15:30:00Z");
  });
});
