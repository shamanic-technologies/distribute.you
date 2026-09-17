import { describe, expect, it } from "vitest";
import {
  hiddenWorkflowNote,
  hiddenWorkflowSlugs,
  type EligibilityLadderRow,
  type EligibilityObservedPicks,
} from "../src/lib/workflow-eligibility";

function row(
  slug: string,
  opts: {
    /** The producer's cascade grain. `campaign`/`audience` = this campaign's own spend. */
    grain?: string;
    eligible?: boolean | null;
    tier?: "cheap" | "strong" | "frontier";
  } = {},
): EligibilityLadderRow {
  const base = {
    workflow: { workflowDynastySlug: slug },
    resolved: { grain: opts.grain ?? "crossOrg" },
  };
  if (opts.eligible === null) return base;
  return {
    ...base,
    modelEligibility: {
      modelAlias: "flash",
      modelTier: opts.tier ?? "cheap",
      eligible: opts.eligible ?? false,
      ineligibleReason: opts.eligible === false ? "the cheap tier does not sell a conversation" : null,
      unknownTierReason: null,
    },
  };
}

const NEVER_RAN: EligibilityObservedPicks = { last: null, recent: [] };

describe("hiddenWorkflowSlugs", () => {
  it("hides a dynasty that is excluded on every row, measured nowhere, and never picked", () => {
    const hidden = hiddenWorkflowSlugs({
      rows: [row("dawn", { eligible: false }), row("dawn", { eligible: false })],
      observedPicks: NEVER_RAN,
    });
    expect([...hidden]).toEqual(["dawn"]);
  });

  it("KEEPS an excluded dynasty this campaign spent through — its money is the campaign's history", () => {
    const hidden = hiddenWorkflowSlugs({
      rows: [row("dawn", { eligible: false }), row("dawn", { eligible: false, grain: "campaign" })],
      observedPicks: NEVER_RAN,
    });
    expect(hidden.size).toBe(0);
  });

  it("KEEPS an excluded dynasty the ledger recorded a pick for, even with no evidence yet", () => {
    const hidden = hiddenWorkflowSlugs({
      rows: [row("dawn", { eligible: false })],
      observedPicks: { last: { workflowDynastySlug: "dawn" }, recent: [] },
    });
    expect(hidden.size).toBe(0);
  });

  it("reads the whole window, not only the last pick", () => {
    const hidden = hiddenWorkflowSlugs({
      rows: [row("dawn", { eligible: false })],
      observedPicks: {
        last: { workflowDynastySlug: "lithium" },
        recent: [{ workflowDynastySlug: "lithium" }, { workflowDynastySlug: "dawn" }],
      },
    });
    expect(hidden.size).toBe(0);
  });

  it("KEEPS an eligible dynasty", () => {
    const hidden = hiddenWorkflowSlugs({
      rows: [row("lithium", { eligible: true, tier: "strong" })],
      observedPicks: NEVER_RAN,
    });
    expect(hidden.size).toBe(0);
  });

  it("KEEPS a dynasty the producer stated no verdict for — an older body is not an exclusion", () => {
    const hidden = hiddenWorkflowSlugs({
      rows: [row("dawn", { eligible: null })],
      observedPicks: NEVER_RAN,
    });
    expect(hidden.size).toBe(0);
  });

  it("KEEPS a dynasty with one excluded row and one eligible row", () => {
    const hidden = hiddenWorkflowSlugs({
      rows: [row("dawn", { eligible: false }), row("dawn", { eligible: true, tier: "strong" })],
      observedPicks: NEVER_RAN,
    });
    expect(hidden.size).toBe(0);
  });

  it("hides NOTHING when the ledger could not be read — absence of proof is not proof", () => {
    const rows = [row("dawn", { eligible: false }), row("osprey", { eligible: false })];
    expect(hiddenWorkflowSlugs({ rows, observedPicks: null }).size).toBe(0);
    expect(hiddenWorkflowSlugs({ rows, observedPicks: undefined }).size).toBe(0);
  });

  it("hides only the excluded dynasties of a mixed catalogue", () => {
    const hidden = hiddenWorkflowSlugs({
      rows: [
        row("dawn", { eligible: false }),
        row("osprey", { eligible: false }),
        row("lithium", { eligible: true, tier: "strong" }),
        row("alioth", { eligible: true, tier: "frontier" }),
      ],
      observedPicks: NEVER_RAN,
    });
    expect([...hidden].sort()).toEqual(["dawn", "osprey"]);
  });

  it("a crossOrg grain is NOT this campaign's evidence — the fleet's spend hides nothing", () => {
    // The bug this replaced: `measured` is true for nearly every row, because the cascade
    // falls back to the fleet. Measured in prod on campaign f7b1b610: all 9 excluded
    // dynasties read measured, of which 8 sat at crossOrg and had never run there.
    const hidden = hiddenWorkflowSlugs({
      rows: [row("dawn", { eligible: false, grain: "crossOrg" })],
      observedPicks: NEVER_RAN,
    });
    expect([...hidden]).toEqual(["dawn"]);
  });

  it("a brand grain is somebody else's campaign, so it hides too", () => {
    const hidden = hiddenWorkflowSlugs({
      rows: [row("dawn", { eligible: false, grain: "brand" })],
      observedPicks: NEVER_RAN,
    });
    expect([...hidden]).toEqual(["dawn"]);
  });

  it("an audience grain keeps it — that is this campaign's own money", () => {
    const hidden = hiddenWorkflowSlugs({
      rows: [row("cerulean", { eligible: false, grain: "audience" })],
      observedPicks: NEVER_RAN,
    });
    expect(hidden.size).toBe(0);
  });

  it("reproduces the prod catalogue: 9 excluded, 8 hidden, cerulean kept", () => {
    const excluded = ["rampart", "lyonesse", "allegro", "pelican", "dawn", "rudder", "osprey", "maelstrom"];
    const hidden = hiddenWorkflowSlugs({
      rows: [
        ...excluded.map((s) => row(s, { eligible: false, grain: "crossOrg" })),
        // The one excluded dynasty this campaign has spent through.
        row("cerulean", { eligible: false, grain: "campaign" }),
        row("cerulean", { eligible: false, grain: "audience" }),
        row("lithium", { eligible: true, tier: "strong", grain: "campaign" }),
        row("alioth", { eligible: true, tier: "frontier", grain: "crossOrg" }),
      ],
      observedPicks: { last: { workflowDynastySlug: "lithium" }, recent: [{ workflowDynastySlug: "lithium" }] },
    });
    expect([...hidden].sort()).toEqual([...excluded].sort());
    expect(hidden.has("cerulean")).toBe(false);
    expect(hidden.has("lithium")).toBe(false);
  });

  it("is empty on an empty ladder", () => {
    expect(hiddenWorkflowSlugs({ rows: [], observedPicks: NEVER_RAN }).size).toBe(0);
  });
});

describe("hiddenWorkflowNote", () => {
  it("says nothing when nothing is hidden", () => {
    expect(hiddenWorkflowNote(0, "Positive reply")).toBeNull();
    expect(hiddenWorkflowNote(-1, "Positive reply")).toBeNull();
  });

  it("names the outcome the leg sells, in the producer's own word", () => {
    const note = hiddenWorkflowNote(6, "Positive reply");
    expect(note).toContain("6 workflows are hidden");
    expect(note).toContain("positive reply");
    expect(note).toContain("wrong tier");
  });

  it("agrees with itself on one", () => {
    expect(hiddenWorkflowNote(1, "Website visit")).toContain("1 workflow is hidden");
  });

  it("states no outcome when the producer named none", () => {
    const note = hiddenWorkflowNote(2, null);
    expect(note).toContain("2 workflows are hidden");
    expect(note).not.toContain("selling");
  });
});
