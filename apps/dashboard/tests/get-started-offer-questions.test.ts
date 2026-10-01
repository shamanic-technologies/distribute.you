import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  GET_STARTED_STEPS,
  answerLines,
  leversLLMPrompt,
  parseGetStartedSnapshot,
  parseLifetimeRevenue,
  parseUsdEstimate,
  stepIndex,
} from "../src/lib/v2/get-started";

const PAGE = readFileSync(resolve(__dirname, "../src/components/v2/get-started/get-started.tsx"), "utf-8");
const LAUNCH = readFileSync(resolve(__dirname, "../src/components/v2/get-started/launch.ts"), "utf-8");
const API = readFileSync(resolve(__dirname, "../src/lib/api.ts"), "utf-8");

describe("onboarding v2: the offer questions come after the audience, before the companies", () => {
  it("orders offer, audience, value, sales steps, legs, paths, levers, gives, companies, email", () => {
    expect(GET_STARTED_STEPS.map((s) => s.key)).toEqual([
      "company",
      "competitors",
      "offer",
      "audience",
      "value",
      "salesSteps",
      "legs",
      "paths",
      "levers",
      "gives",
      "companies",
      "email",
    ]);
    expect(stepIndex("email")).toBe(GET_STARTED_STEPS.length - 1);
  });

});

describe("lifetime revenue", () => {
  it("reads a drafted estimate as whole dollars", () => {
    expect(parseUsdEstimate("2400")).toBe(2400);
    expect(parseUsdEstimate("$12,000")).toBe(12000);
    expect(parseUsdEstimate("about 1.5k")).toBe(1500);
    expect(parseUsdEstimate(["3000"])).toBe(3000);
    expect(parseUsdEstimate("Unknown")).toBeNull();
    expect(parseUsdEstimate(null)).toBeNull();
  });

  it("refuses a blank, a word or zero, never reading them as a valid amount", () => {
    expect(parseLifetimeRevenue("")).toEqual({ problem: "Enter what one client brings you." });
    expect("problem" in parseLifetimeRevenue("lots")).toBe(true);
    expect("problem" in parseLifetimeRevenue("0")).toBe(true);
    expect(parseLifetimeRevenue("$2,400")).toEqual({ usd: 2400 });
  });
});

describe("answers as bullets", () => {
  it("splits lines and drops list markers", () => {
    expect(answerLines("- one\n• two\n\n3) three")).toEqual(["one", "two", "three"]);
  });

  it("copies the six questions and answers for an LLM", () => {
    const p = leversLLMPrompt("Cold email", { dreamOutcome: "More meetings" });
    expect(p).toContain('I sell "Cold email"');
    expect(p).toContain("Dream outcome: What does your customer get, in their words?\n- More meetings");
    expect(p).toContain("Why now: Why should they start this week?\n- (not answered yet)");
  });
});

describe("snapshot", () => {
  it("restores the answers and tolerates an older snapshot without them", () => {
    const base = { version: 2, website: "https://a.com", brandId: "b1" };
    expect(parseGetStartedSnapshot(JSON.stringify(base))?.salesPath).toBeNull();
    const s = parseGetStartedSnapshot(
      JSON.stringify({ ...base, salesPath: { steps: ["conversation"], legs: ["start_to_conversation"] }, pathsDone: true, lifetimeRevenueUsd: 900, answered: true }),
    );
    expect(s).toMatchObject({ salesPath: { steps: ["conversation"], legs: ["start_to_conversation"] }, pathsDone: true, lifetimeRevenueUsd: 900, answered: true });
    // A retired "what you want" answer is ignored, never read as a path.
    expect(parseGetStartedSnapshot(JSON.stringify({ ...base, outcome: "meetings" }))?.salesPath).toBeNull();
  });
});

describe("the page's call sites", () => {
  it("writes no email before the answers exist, and holds the first companies' emails until then", () => {
    expect(PAGE).toContain("if (!answeredRef.current) return;");
    expect(PAGE).toContain("else pendingPrewrite.current = { aud, rows: got };");
    expect(PAGE).toContain("prewrite(held.aud, held.rows);");
  });

  it("saves the give lists under brand-service's keys", () => {
    expect(PAGE).toContain("giveForFree: answerLines(gives.giveForFree)");
    expect(PAGE).toContain("neverGive: answerLines(gives.neverGive)");
  });

  it("keeps the give lists OUT of USER_FIELD_KEYS, so a lever editor's save cannot clear them", () => {
    const keys = API.slice(API.indexOf("export const USER_FIELD_KEYS = ["), API.indexOf("] as const;", API.indexOf("export const USER_FIELD_KEYS = [")));
    expect(keys).not.toContain("giveForFree");
    expect(keys).not.toContain("neverGive");
  });

  it("launches every campaign the ranked paths need, and skips re-drafting answered levers", () => {
    expect(LAUNCH).toContain("for (const c of input.plan)");
    expect(LAUNCH).toContain("if (input.answered) progress.levers = true;");
  });
});
