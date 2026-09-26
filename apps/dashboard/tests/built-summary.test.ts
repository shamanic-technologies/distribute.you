import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { builtSubtitle, builtSummary, type BuiltInput } from "../src/lib/built-summary";

/** Real unit tests: the module is alias-free and names nothing of its own. */

const full: BuiltInput = {
  services: ["Fractional CFO", "Bookkeeping"],
  campaigns: [
    {
      key: "start_to_conversation::sales-cold-email-outreach",
      label: "Positive reply",
      channelName: "Sales Cold Email Outreach",
    },
  ],
  targetAudience: "Owners of US dental clinics with 2 to 10 chairs.",
  levers: [{ key: "dreamOutcome", label: "Dream outcome", value: "Books closed by the 5th" }],
};

describe("what the summary states", () => {
  it("reads in the order the visitor built it", () => {
    expect(builtSummary(full).sections.map((s) => s.kind)).toEqual([
      "services",
      "campaigns",
      "targetAudience",
      "offer",
    ]);
  });

  it("DROPS a section with nothing in it rather than rendering it empty", () => {
    const s = builtSummary({ ...full, targetAudience: "", levers: [] });
    expect(s.sections.map((x) => x.kind)).toEqual(["services", "campaigns"]);
    expect(s.isEmpty).toBe(false);
  });

  it("says so when it has nothing at all, instead of a blank card", () => {
    const s = builtSummary({ services: [], campaigns: [], targetAudience: null, levers: [] });
    expect(s.sections).toEqual([]);
    expect(s.isEmpty).toBe(true);
  });

  it("drops a lever nobody answered — an empty lever is not one we drafted", () => {
    const s = builtSummary({
      ...full,
      levers: [
        { key: "a", label: "A", value: "  " },
        { key: "b", label: "B", value: "real" },
      ],
    });
    const offer = s.sections.find((x) => x.kind === "offer");
    expect(offer && offer.items).toHaveLength(1);
  });

  it("drops a blank service and a whitespace-only target audience", () => {
    const s = builtSummary({
      ...full,
      services: ["Real", "   ", ""],
      targetAudience: "   ",
    });
    const services = s.sections.find((x) => x.kind === "services");
    expect(services && services.items).toEqual(["Real"]);
    expect(s.sections.some((x) => x.kind === "targetAudience")).toBe(false);
  });

  it("states the target audience TRIMMED, as prose, never as an audience list", () => {
    // The audiences are built by hand after payment from this text; the summary
    // must not read as if any had been assembled.
    const s = builtSummary({ ...full, targetAudience: "  CFOs at Series B fintechs  " });
    const target = s.sections.find((x) => x.kind === "targetAudience");
    expect(target && target.kind === "targetAudience" && target.text).toBe("CFOs at Series B fintechs");
    expect(s.sections.some((x) => (x.kind as string) === "audiences")).toBe(false);
  });

  it("survives a missing input rather than throwing on the payoff screen", () => {
    expect(() => builtSummary({} as BuiltInput)).not.toThrow();
    expect(builtSummary({} as BuiltInput).isEmpty).toBe(true);
  });
});

describe("the line under the heading", () => {
  it("states counts the visitor can check against the sections", () => {
    // The target audience is prose, not a quantity, so it is never counted.
    expect(builtSubtitle(builtSummary(full))).toBe("2 services and 1 campaign");
  });

  it("is singular when there is one of something", () => {
    const one = builtSummary({ ...full, services: ["Only one"] });
    expect(builtSubtitle(one)).toBe("1 service and 1 campaign");
  });

  it("counts only what is shown", () => {
    const s = builtSummary({ ...full, campaigns: [] });
    expect(builtSubtitle(s)).toBe("2 services");
  });

  it("is null with nothing to count, so no sentence of zeroes is printed", () => {
    expect(builtSubtitle(builtSummary({ services: [], campaigns: [], targetAudience: "", levers: [] }))).toBeNull();
  });

  it("never counts the OFFER — its levers are prose, not a quantity", () => {
    expect(builtSubtitle(builtSummary(full))).not.toContain("lever");
  });
});

describe("the file itself", () => {
  const src = fs.readFileSync(path.join(__dirname, "../src/lib/built-summary.ts"), "utf8");

  it("stays alias-free so these are real unit tests", () => {
    expect(src).not.toMatch(/from\s+"@\//);
  });

  it("carries no em-dash in the strings it renders", () => {
    const rendered = src.match(/parts\.push\(`[^`]*`\)/g) ?? [];
    for (const r of rendered) expect(r).not.toContain("—");
  });
});
