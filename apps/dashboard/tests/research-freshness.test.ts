import { describe, expect, it } from "vitest";
import { ageWords, staleText, type ResearchFreshness } from "../src/lib/research/freshness";

const base: ResearchFreshness = {
  computedAt: "2026-10-23T20:30:00.000Z",
  refreshEveryMinutes: 15,
  staleAfterMinutes: 30,
  ageMinutes: 495,
  stale: true,
  rebuilding: false,
};

describe("Research freshness line (RESEARCH-STALE-1024-DASH)", () => {
  it("fresh figures keep the usual line", () => {
    expect(staleText({ ...base, ageMinutes: 10, stale: false })).toBeNull();
  });

  it("reads the served stale flag, never the age", () => {
    // an age past the threshold the producer did not call stale stays fresh here
    expect(staleText({ ...base, ageMinutes: 999, stale: false })).toBeNull();
  });

  it("stale figures say how old they are, in words", () => {
    expect(staleText(base)).toBe("Out of date: figures from 8 hours ago (Oct 23, 20:30 UTC).");
  });

  it("stale and rebuilding adds the last sentence", () => {
    expect(staleText({ ...base, rebuilding: true })).toBe("Out of date: figures from 8 hours ago (Oct 23, 20:30 UTC). Rebuilding now.");
  });

  it("an older build with no freshness keeps today's rendering", () => {
    expect(staleText(undefined)).toBeNull();
    expect(staleText(null)).toBeNull();
  });

  it("age words", () => {
    expect(ageWords(1)).toBe("1 minute ago");
    expect(ageWords(45)).toBe("45 minutes ago");
    expect(ageWords(60)).toBe("1 hour ago");
    expect(ageWords(47 * 60)).toBe("47 hours ago");
    expect(ageWords(72 * 60)).toBe("3 days ago");
  });
});
