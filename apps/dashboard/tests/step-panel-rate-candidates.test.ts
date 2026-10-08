import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { candidateLines, type RateCandidate } from "../src/lib/rate-candidates";

const c = (over: Partial<RateCandidate> & Pick<RateCandidate, "basis" | "ratePct">): RateCandidate => ({
  fromReached: null,
  toReached: null,
  kept: false,
  ...over,
});

describe("candidateLines (owner 2026-10-08: every rate weighed, the kept one marked)", () => {
  it("words the owner's three lines, kept on the CRM", () => {
    const lines = candidateLines([
      c({ basis: "crm", ratePct: 65.1, fromReached: 43, toReached: 28, kept: true }),
      c({ basis: "our_leads", ratePct: 25, fromReached: 4, toReached: 1 }),
      c({ basis: "manual", ratePct: 32 }),
      c({ basis: "median", ratePct: 40 }),
      c({ basis: "default", ratePct: 20 }),
    ]);
    expect(lines).toEqual([
      { key: "crm", text: "Measured in your CRM: 28 of 43 (65%)", kept: true },
      { key: "our_leads", text: "Measured in our data: 1 of 4 (25%)", kept: false },
      { key: "manual", text: "Your value: 32%", kept: false },
    ]);
  });

  it("shows the median or the default only when it is the rate in use", () => {
    expect(candidateLines([c({ basis: "median", ratePct: 12, kept: true }), c({ basis: "default", ratePct: 20 })])).toEqual([
      { key: "median", text: "Median of our clients: 12%", kept: true },
    ]);
    expect(candidateLines([c({ basis: "default", ratePct: 4.5, kept: true })])[0].text).toBe("Industry average: 4.5%");
  });
});

describe("step panel wiring", () => {
  const panel = fs.readFileSync(path.join(__dirname, "../src/components/v2/today-roi-panel.tsx"), "utf-8");
  const api = fs.readFileSync(path.join(__dirname, "../src/lib/api.ts"), "utf-8");

  it("the panel draws the served candidates under each leg", () => {
    expect(panel).toContain("candidateLines(l.candidates)");
    expect(panel).toContain(">Kept<");
  });

  it("the reader keeps candidates (optional until served)", () => {
    expect(api).toContain("candidates: z.array(RateCandidateSchema).optional()");
  });

  it("the panel draws no % Conversion over time chart (owner 2026-10-08: removed)", () => {
    expect(panel).not.toContain("ConversionHistoryCard");
    expect(api).not.toContain('query.set("conversionHistory"');
  });
});
