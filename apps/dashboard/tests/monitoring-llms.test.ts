import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EngineLlmsSchema, allowedNames, enginesForcingOutside, evidenceBroken, forcedOutside, universeSourceWords } from "../src/lib/monitoring/engine-llms";

// LLM-RATING-PER-ENGINE-1112 (owner 2026-11-12): Monitoring > AI vendors > LLMs lists every Engine with the LLMs it may
// use, ranked by its Rating, and turns red when an Engine still calls an LLM outside its list (a script forcing Fable/Opus).

const day = (d: string, calls: number, spentUsd: number) => ({ day: d, calls, spentUsd });
const llm = (slug: string, name: string, over: Record<string, unknown> = {}) => ({
  llmDynastySlug: slug,
  name,
  provider: "anthropic",
  allowed: true,
  notPickableReason: null,
  rank: 1,
  shareOfDraws: 0.8,
  shareOfPicks: 0.5,
  picks: 4,
  calls: 78,
  decisions: 26,
  outcomes: 20,
  spentUsdToDate: 6.19,
  spentUsdPerDay: 1.2,
  dailySpend: [day("2026-11-11", 3, 1.2)],
  costPerOutcomeUsd: 0.31,
  costPerOutcomeUnavailableReason: null,
  outcomeRate: 0.77,
  firstCallDay: "2026-11-07",
  lastCallDay: "2026-11-11",
  ...over,
});
const body = {
  computedAt: "2026-11-12T10:40:00.000Z",
  evidenceComputedAt: "2026-11-12T10:35:00.000Z",
  evidenceUnavailableReason: null,
  evidenceCounts: { calls: 1000, callsWithNoEngine: 10, supportCalls: 3, decisionsAwaitingUnits: 2, lastCallAt: "2026-11-12T10:30:00.000Z" },
  engines: [
    {
      outcome: "x_post_published",
      name: "X post published",
      universe: { source: "fleet", allowed: ["claude-sonnet", "gemini-flash"], excluded: ["claude-fable", "claude-opus"], decidedBy: "owner", decidedAt: null, note: null },
      favourite: { llmDynastySlug: "claude-sonnet", name: "Claude Sonnet" },
      places: [{ place: "writer", picks: 4 }],
      llms: [llm("claude-sonnet", "Claude Sonnet")],
      outsideUniverse: [
        llm("claude-fable", "Claude Fable", { allowed: false, rank: null, shareOfDraws: null, dailySpend: [day("2026-11-11", 5, 1.9)] }),
        llm("claude-opus", "Claude Opus", { allowed: false, rank: null, shareOfDraws: null, dailySpend: [day("2026-11-11", 0, 0)] }),
      ],
      totals: { calls: 104, decisions: 30, outcomes: 21, spentUsdToDate: 14.5 },
    },
    {
      outcome: "conversation",
      name: "Conversation",
      universe: { source: "engine", allowed: ["claude-haiku"], excluded: [], decidedBy: null, decidedAt: null, note: null },
      favourite: null,
      places: [],
      llms: [llm("claude-haiku", "Claude Haiku")],
      outsideUniverse: [],
      totals: { calls: 2732, decisions: 2732, outcomes: 0, spentUsdToDate: 5.25 },
    },
  ],
  limits: [],
};

describe("Monitoring > LLMs per Engine reader", () => {
  const data = EngineLlmsSchema.parse(body);

  it("parses the served body", () => {
    expect(data.engines).toHaveLength(2);
  });

  it("flags an Engine that still CALLED an LLM outside its list in the last 30 days, not one with history only", () => {
    expect(forcedOutside(data.engines[0]).map((l) => l.name)).toEqual(["Claude Fable"]);
    expect(enginesForcingOutside(data).map((e) => e.outcome)).toEqual(["x_post_published"]);
  });

  it("is red when the Rating cannot read its evidence", () => {
    expect(evidenceBroken(data)).toBe(false);
    expect(evidenceBroken(EngineLlmsSchema.parse({ ...body, evidenceUnavailableReason: "runs_unreadable" }))).toBe(true);
    // The first build is a normal « not yet », never red (served by features-service before its first evidence build).
    expect(evidenceBroken(EngineLlmsSchema.parse({ ...body, engines: [], evidenceCounts: null, evidenceUnavailableReason: "evidence_not_built_yet" }))).toBe(false);
  });

  it("names the allowed list in served order, by served name when known", () => {
    expect(allowedNames(data.engines[0])).toEqual(["Claude Sonnet", "gemini-flash"]);
    expect(universeSourceWords("fleet")).toBe("Fleet list");
    expect(universeSourceWords("engine")).toBe("Its own list");
  });

  it("is wired: page registered, hub card + red tile, reader on the staff gateway path, LLMs through CatalogueName", () => {
    const page = readFileSync("src/components/v2/monitoring-page.tsx", "utf8");
    expect(page).toContain('"ai/llms": { section: "ai"');
    expect(page).toContain('view.page === "ai/llms" && <EngineLlmsPage />');
    expect(page).toContain('<EngineLlmsTile href={href("ai/llms")} />');
    const api = readFileSync("src/lib/api.ts", "utf8");
    expect(api).toContain('STAFF_ENGINE_LLMS_PATH = "/features/research/engine-llms"');
    const comp = readFileSync("src/components/v2/monitoring-llms.tsx", "utf8");
    expect(comp).toContain('<CatalogueName kind="llm"');
    expect(comp).not.toContain(".sort(");
    // One fixed grid across Engines (render check 2026-11-12: columns drifted per table), phone keeps 3 columns.
    expect(comp).toContain("table-fixed");
    expect(comp).toContain('const WIDE = "hidden md:table-cell"');
  });
});
