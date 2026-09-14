/**
 * REAL unit tests — `lib/observed-picks` is alias-free so vitest can import it.
 *
 * What is pinned: the running workflow is READ off the producer's ledger block, every
 * honest absence answers `null` rather than the campaign's configured slug, and the
 * audience mark is a SET over the served window rather than `last.audienceId`.
 *
 * The fixture is the shape prod serves (measured 2026-09-14, brand `75d7e3e8` /
 * campaign `f7b1b610`): the 50-pick window spans 26 minutes, ONE workflow and SIX
 * audiences, while campaign-service's own row named a seventh workflow that had never
 * served a lead there.
 */
import fs from "fs";
import path from "path";
import { describe, it, expect } from "vitest";
import {
  runningFromObservedPicks,
  observedAudienceIds,
  lastPickAt,
  type ObservedPick,
  type ObservedPicks,
} from "../src/lib/observed-picks";

function pick(audienceId: string | null, startedAt: string): ObservedPick {
  return {
    campaignId: "f7b1b610-4fa1-4b54-8fec-f7be124dc32b",
    workflowSlug: "sales-cold-email-outreach-lithium-v6",
    workflowDynastySlug: "sales-cold-email-outreach-lithium",
    workflowDynastyName: "Sales Cold Email Outreach Lithium",
    audienceId,
    startedAt,
  };
}

/** The window prod served on 2026-09-14: one workflow, six audiences, 26 minutes. */
const PROD: ObservedPicks = {
  last: pick("23b2da6f", "2026-09-14T04:07:30.548Z"),
  recent: [
    pick("23b2da6f", "2026-09-14T04:07:30.548Z"),
    pick("1099fee2", "2026-09-14T04:06:48.878Z"),
    pick("68d1aa78", "2026-09-14T04:06:18.401Z"),
    pick("6a767f2f", "2026-09-14T04:04:42.611Z"),
    pick("08be2291", "2026-09-14T04:03:15.100Z"),
    pick("ce5c7dc0", "2026-09-14T04:01:29.665Z"),
    pick("23b2da6f", "2026-09-14T03:41:00.444Z"),
  ],
  truncated: true,
};

describe("the running workflow is what RAN, never what the campaign is configured with", () => {
  it("names the dynasty of the most recent pick", () => {
    expect(runningFromObservedPicks(PROD)).toEqual({
      dynastySlug: "sales-cold-email-outreach-lithium",
      dynastyName: "Sales Cold Email Outreach Lithium",
    });
  });

  it("a campaign that has never triggered marks NOTHING", () => {
    // `last: null` is the producer's real, empty answer — not a licence to fall back.
    expect(runningFromObservedPicks({ last: null, recent: [], truncated: false })).toBeNull();
  });

  it("an unreadable ledger marks NOTHING, never the configured workflow", () => {
    // NULL is the producer saying it could not read the runs ledger. The configured
    // slug is the bug this block replaces, so it must never surface on that branch.
    expect(runningFromObservedPicks(null)).toBeNull();
  });

  it("a body carrying no block at all marks NOTHING", () => {
    // Absent on a funnel- or goal-keyed answer, which this page never asks for.
    expect(runningFromObservedPicks(undefined)).toBeNull();
  });

  it("carries a dynasty the catalogue cannot name rather than dropping it", () => {
    // A RETIRED lineage is exactly what a "what actually ran" question is about.
    const retired: ObservedPicks = {
      last: { ...pick("23b2da6f", "2026-09-14T04:07:30.548Z"), workflowDynastyName: null },
      recent: [],
      truncated: false,
    };
    expect(runningFromObservedPicks(retired)).toEqual({
      dynastySlug: "sales-cold-email-outreach-lithium",
      dynastyName: null,
    });
  });
});

describe("the audience mark is a SET over the window, never one id", () => {
  it("marks every audience the window saw a send for", () => {
    // SIX, inside 26 minutes — which is why `last.audienceId` alone would be arbitrary.
    expect([...observedAudienceIds(PROD)].sort()).toEqual([
      "08be2291",
      "1099fee2",
      "23b2da6f",
      "68d1aa78",
      "6a767f2f",
      "ce5c7dc0",
    ]);
  });

  it("a pick that states no audience contributes nothing rather than a guess", () => {
    const older: ObservedPicks = {
      last: pick(null, "2026-07-01T00:00:00.000Z"),
      recent: [pick(null, "2026-07-01T00:00:00.000Z"), pick("23b2da6f", "2026-07-01T00:00:01.000Z")],
      truncated: false,
    };
    expect([...observedAudienceIds(older)]).toEqual(["23b2da6f"]);
  });

  it("an empty window marks nothing", () => {
    expect(observedAudienceIds({ last: null, recent: [], truncated: false }).size).toBe(0);
    expect(observedAudienceIds(null).size).toBe(0);
    expect(observedAudienceIds(undefined).size).toBe(0);
  });

  it("still marks the one pick we were given when the window is zero-length", () => {
    const only: ObservedPicks = {
      last: pick("23b2da6f", "2026-09-14T04:07:30.548Z"),
      recent: [],
      truncated: true,
    };
    expect([...observedAudienceIds(only)]).toEqual(["23b2da6f"]);
  });
});

describe("the tag can say how fresh it is", () => {
  it("states the last pick's instant", () => {
    expect(lastPickAt(PROD)).toBe("2026-09-14T04:07:30.548Z");
  });
  it("states nothing when there is no pick", () => {
    expect(lastPickAt({ last: null, recent: [], truncated: false })).toBeNull();
    expect(lastPickAt(null)).toBeNull();
  });
});

describe("the module stays importable by vitest", () => {
  it("carries no @ alias import, so these remain REAL unit tests", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../src/lib/observed-picks.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/from "@\//);
  });

  it("derives no figure and reads no other producer", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../src/lib/observed-picks.ts"),
      "utf8",
    );
    expect(src).not.toContain("workflowSlug ??");
    expect(src).not.toContain("costPerOutcomeUsd");
  });
});
