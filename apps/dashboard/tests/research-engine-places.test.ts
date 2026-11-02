import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseEnginePlaces, placesByCaller, replayFamiliesOf, selectedPlace } from "../src/lib/research/engine-places";
import { outcomeStudiesOf, pipesOutsideOutcomes, type ResearchFile } from "../src/lib/research/research";

const REPO = join(__dirname, "..", "..", "..");
const read = (p: string) => readFileSync(join(REPO, p), "utf8");

const cand = (id: string, share: number | null) => ({
  candidateId: id,
  workflowDynastySlug: `wf-${id}`,
  workflowName: `Wf ${id}`,
  channelName: "Cold email",
  sharePct: share,
  beliefRatePct: 3,
  costPerDecisionUsd: 0.4,
  fleetDecisions: 100,
  fleetOutcomes: 3,
});
const place = (outcome: string, consumer: string, campaigns: number, top: number | null) => ({
  key: `${outcome}|${consumer}`,
  outcome,
  outcomeName: outcome,
  consumer,
  consumerName: consumer.toUpperCase(),
  campaigns,
  favourite: top == null ? null : { ...cand("a", top), chancePct: top },
  clearWinner: (top ?? 0) >= 90,
  candidates: [cand("a", top), cand("b", top == null ? null : 100 - top)],
});
const body = {
  computedAt: "2026-11-02T08:00:00Z",
  clearWinnerPct: 90,
  summary: { places: 3, clearWinners: 1, campaigns: 4 },
  places: [place("conversation", "target", 2, 95), place("meeting_booked", "target", 3, 60), place("conversation", "meeting_booked", 1, null)],
  engines: [{ outcome: "conversation", outcomeName: "Conversation", callers: [{ consumer: "target", consumerName: "TARGET", best: "Wf a" }] }],
  replay: { computedAt: "2026-11-02T07:00:00Z", windowDays: 30, families: [{ family: "x", outcome: "conversation", outcomeName: "Conversation", todayRegret: 0.2, engineRegret: 0.1 }], failure: null },
};

describe("Research engine places (FACTORY-RESEARCH-1102)", () => {
  it("parses the served body and refuses a shape change loud", () => {
    expect(parseEnginePlaces(body).summary.clearWinners).toBe(1);
    expect(() => parseEnginePlaces({ ...body, places: "nope" })).toThrow();
  });

  it("groups places by caller in served order, never re-sorted", () => {
    const g = placesByCaller(parseEnginePlaces(body).places);
    expect(g.map((x) => x.consumer)).toEqual(["target", "meeting_booked"]);
    expect(g[0]!.places.map((p) => p.outcome)).toEqual(["conversation", "meeting_booked"]);
  });

  it("opens on the asked place, else the one most live campaigns hold", () => {
    const ps = parseEnginePlaces(body).places;
    expect(selectedPlace(ps, "conversation|meeting_booked")?.key).toBe("conversation|meeting_booked");
    expect(selectedPlace(ps, null)?.key).toBe("meeting_booked|target");
    expect(selectedPlace(ps, "gone")?.key).toBe("meeting_booked|target");
    expect(selectedPlace([], null)).toBeNull();
  });

  it("the value lost shown for a place is the replay's own families for its outcome", () => {
    expect(replayFamiliesOf(body, "conversation").map((f) => f.family)).toEqual(["x"]);
    expect(replayFamiliesOf({ replay: null }, "conversation")).toEqual([]);
  });

  it("the headline and the counts are the served summary, the chance the served favourite's, nothing divided in the browser", () => {
    const src = read("apps/dashboard/src/components/v2/research-engines.tsx");
    expect(src).toContain("{d.summary.clearWinners} of {d.summary.places} candidate places have a clear winner");
    expect(src).toContain("const chance = place.favourite?.chancePct ?? null;");
    expect(src).toContain("place.clearWinner ?");
    expect(src).not.toMatch(/\.reduce\(|\/ place\.campaigns|sharePct \//);
  });

  it("is read through the staff route only, never a client-bundled source", () => {
    const route = read("apps/dashboard/src/app/(authed)/api/research/[basis]/[part]/route.ts");
    expect(route).toContain('"engine-places"');
    expect(route).toContain("isAdminEmail(sessionClaims?.email)");
    expect(read("apps/dashboard/src/lib/research/live-file.ts")).toContain('"/v1/features/research/engine-places"');
  });
});

describe("Research studies are homed under their outcome (FACTORY-RESEARCH-1102)", () => {
  const study = (id: string, pipe: string | null, outcome?: string) => ({ id, pipe, outcome }) as unknown as ResearchFile["studies"][number];
  const file = {
    pipes: [
      { id: "p1", channel: "c", leg: "l", outcome: "Positive reply", description: "" },
      { id: "p2", channel: "c", leg: "l", outcome: "Lead", description: "" },
      { id: "p3", channel: "c", leg: "l", outcome: "Lead", description: "" },
    ],
    outcomes: [{ id: "positive-reply", outcome: "Lead interested", step: "conversation", pipes: ["p1", "gone"], description: "", population: "" }],
    studies: [study("positive-reply-cost-over-time", null, "positive-reply"), study("s1", "p1"), study("s2", "p2"), study("o2", null, "positive-reply")],
  } as unknown as ResearchFile;

  it("an outcome holds its own studies, price first, then its served pipes' studies; a pipe the file no longer serves is skipped", () => {
    const r = outcomeStudiesOf(file.outcomes![0]!, file);
    expect(r.pipes).toEqual(["p1"]);
    expect(r.studies.map((s) => s.id)).toEqual(["positive-reply-cost-over-time", "o2", "s1"]);
  });

  it("a pipe no outcome lists sits under its own served outcome words", () => {
    expect(pipesOutsideOutcomes(file)).toEqual([{ outcome: "Lead", pipes: ["p2", "p3"], studies: [file.studies[2]] }]);
  });
});
