import { describe, it, expect } from "vitest";
import {
  DECK_SLIDES,
  deckVersion,
  deckFileName,
  deckVersionLine,
  formatGrowthRate,
  growthSpanLabel,
  growthConclusion,
} from "../src/lib/investor-deck";

describe("deck structure", () => {
  it("stays inside the 20-page ceiling DocSend measured", () => {
    expect(DECK_SLIDES.length).toBeLessThanOrEqual(20);
    expect(DECK_SLIDES.length).toBe(12);
  });

  it("carries the three slides the research says are expensive to omit", () => {
    const ids = DECK_SLIDES.map((s) => s.id);
    // Competition: the largest jump in investor attention DocSend measured.
    expect(ids).toContain("competition");
    // Team: the most-read slide at 22.8 seconds.
    expect(ids).toContain("team");
    expect(ids).toContain("market");
  });

  it("keeps the founder's own update as the spine", () => {
    const ids = DECK_SLIDES.map((s) => s.id);
    for (const id of ["what", "why", "traction", "ask", "use-of-funds", "thanks-and-needs"]) {
      expect(ids).toContain(id);
    }
  });

  it("opens on the title and closes on thanks and needs", () => {
    expect(DECK_SLIDES[0].id).toBe("title");
    expect(DECK_SLIDES[DECK_SLIDES.length - 1].id).toBe("thanks-and-needs");
  });

  it("puts the ask after the evidence for it", () => {
    const ids = DECK_SLIDES.map((s) => s.id);
    expect(ids.indexOf("ask")).toBeGreaterThan(ids.indexOf("traction"));
    expect(ids.indexOf("ask")).toBeGreaterThan(ids.indexOf("economics"));
  });

  it("has no duplicate slide", () => {
    const ids = DECK_SLIDES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("deckVersion", () => {
  const now = new Date("2026-08-02T09:30:00.000Z");

  it("labels the edition by the week the figures report on", () => {
    expect(deckVersion(19, now)).toEqual({ label: "Week #19", weekNumber: 19, date: "2026-08-02" });
  });

  it("refuses to stamp a week when no week has concluded — Week #0 would read as a real edition", () => {
    for (const weeks of [null, 0, -1]) {
      const v = deckVersion(weeks, now);
      expect(v.label).toBeNull();
      expect(v.weekNumber).toBeNull();
      expect(v.date).toBe("2026-08-02");
    }
  });

  it("advances with the data rather than a stored counter", () => {
    expect(deckVersion(19, now).weekNumber).toBe(19);
    expect(deckVersion(20, now).weekNumber).toBe(20);
  });
});

describe("deckFileName", () => {
  it("carries the week and the date so two editions are distinguishable in a mail client", () => {
    expect(deckFileName(deckVersion(19, new Date("2026-08-02T00:00:00.000Z")))).toBe(
      "distribute-investor-deck-week-19-2026-08-02.pdf"
    );
  });

  it("falls back to the date alone when there is no week to report", () => {
    expect(deckFileName(deckVersion(null, new Date("2026-08-02T00:00:00.000Z")))).toBe(
      "distribute-investor-deck-2026-08-02.pdf"
    );
  });

  it("is a pdf", () => {
    expect(deckFileName(deckVersion(3, new Date("2026-01-05T00:00:00.000Z")))).toMatch(/\.pdf$/);
  });
});

describe("deckVersionLine", () => {
  it("reads as a human date beside the week", () => {
    expect(deckVersionLine(deckVersion(19, new Date("2026-08-02T00:00:00.000Z")))).toBe(
      "Week #19 · 2 August 2026"
    );
  });

  it("drops the week when there is none", () => {
    expect(deckVersionLine(deckVersion(null, new Date("2026-08-02T00:00:00.000Z")))).toBe("2 August 2026");
  });
});

describe("formatGrowthRate", () => {
  it("renders a flat week as +0%, not as unmeasured — zero is a real, reportable number", () => {
    expect(formatGrowthRate(0)).toBe("+0%/week");
  });

  it("signs a positive rate", () => {
    expect(formatGrowthRate(32)).toBe("+32%/week");
  });

  it("keeps a negative rate negative rather than hiding it", () => {
    expect(formatGrowthRate(-4.2)).toBe("-4.2%/week");
  });

  it("rounds to one decimal", () => {
    expect(formatGrowthRate(31.96)).toBe("+32%/week");
    expect(formatGrowthRate(10.44)).toBe("+10.4%/week");
  });

  it("says so when there is nothing to measure", () => {
    expect(formatGrowthRate(null)).toBe("Not measured yet");
  });
});

describe("growthSpanLabel", () => {
  it("states the span a compound rate covers", () => {
    expect(growthSpanLabel(19)).toBe("over 19 weeks");
  });

  it("uses the singular for one week", () => {
    expect(growthSpanLabel(1)).toBe("over 1 week");
  });

  it("has no span to state when there is no rate", () => {
    expect(growthSpanLabel(null)).toBeNull();
    expect(growthSpanLabel(0)).toBeNull();
  });
});

describe("growthConclusion", () => {
  const base = { label: "Revenue", current: "$481", weeksUsed: 19 };

  it("states the conclusion in words rather than making the reader derive it", () => {
    expect(growthConclusion({ ...base, pct: 32 })).toBe(
      "Revenue compounding at +32%/week over 19 weeks."
    );
  });

  it("calls a flat metric what it is, and names it as the reason for the raise", () => {
    const text = growthConclusion({ ...base, label: "Signups", pct: 0 });
    expect(text).toContain("Signups flat");
    expect(text).toContain("raising to close");
  });

  it("does not dress up a decline", () => {
    expect(growthConclusion({ ...base, pct: -5 })).toContain("declining");
  });

  it("says nothing when the rate is unmeasured", () => {
    expect(growthConclusion({ ...base, pct: null })).toBeNull();
  });
});
