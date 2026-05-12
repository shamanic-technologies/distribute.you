import { describe, it, expect } from "vitest";
import { getDetailTabs } from "../src/lib/visibility-detail";
import { formatScore } from "../src/components/visibility/score-card";
import type {
  VisibilityRunByProvider,
  VisibilityRunDetail,
  VisibilityRunPrompt,
  VisibilityRunTopCompetitor,
  VisibilityRun,
} from "../src/lib/api";

function makeRun(overrides: Partial<VisibilityRun> = {}): VisibilityRun {
  return {
    id: "run-1",
    orgId: "org-1",
    brandId: "brand-1",
    parentRunId: null,
    runId: null,
    domain: "example.com",
    brandName: "Example",
    llmProvider: "aggregate",
    llmModel: "aggregate",
    promptGenModel: "x",
    extractionProvider: "x",
    extractionModel: "x",
    nPrompts: 0,
    weights: {
      brandMentionRate: 0,
      citationRate: 0,
      positionScore: 0,
      shareOfVoice: 0,
      sentiment: 0,
      brandAndUrlRate: 0,
    },
    visibilityScore: null,
    brandMentionRate: null,
    shareOfVoice: null,
    netSentiment: null,
    citationRate: null,
    avgPosition: null,
    status: "completed",
    startedAt: null,
    completedAt: null,
    createdAt: "2026-05-12T00:00:00Z",
    judgeKind: "aggregate",
    aggregateRunId: null,
    ...overrides,
  };
}

function makePrompt(id: string): VisibilityRunPrompt {
  return {
    id,
    promptIndex: 0,
    promptText: `prompt ${id}`,
    responseText: "",
    responseLengthChars: null,
    brandFound: null,
    brandCount: null,
    brandPosition: null,
    urlFound: null,
    urlCount: null,
    brandAndUrlCoOccurrence: null,
    maxBrandsInResponse: null,
    sentiment: null,
    sentimentScore: null,
    citationUrls: null,
    latencyMs: null,
    tokensInput: null,
    tokensOutput: null,
  };
}

function makeTopCompetitor(name: string): VisibilityRunTopCompetitor {
  return {
    name,
    url: null,
    mention_count: 1,
    avg_position: null,
    share_of_voice: 0,
    net_sentiment: 0,
  };
}

function makeByProvider(
  provider: string,
  model: string,
  promptIds: string[],
  topNames: string[],
): VisibilityRunByProvider {
  return {
    provider,
    model,
    run: makeRun({
      id: `${provider}-${model}-run`,
      judgeKind: "per_provider",
      aggregateRunId: "run-1",
      llmProvider: provider,
      llmModel: model,
    }),
    prompts: promptIds.map(makePrompt),
    competitors: [],
    top_competitors: topNames.map(makeTopCompetitor),
    citation_opportunities: [],
  };
}

function makeDetail(byProviders: VisibilityRunByProvider[]): VisibilityRunDetail {
  const unionTop = byProviders.flatMap((bp) => bp.top_competitors);
  return {
    run: makeRun(),
    by_provider: byProviders,
    top_competitors: unionTop,
    citation_opportunities: [],
  };
}

describe("getDetailTabs", () => {
  it("returns aggregate tab first, then one tab per provider", () => {
    const detail = makeDetail([
      makeByProvider("google", "pro", ["p1"], ["c-g"]),
      makeByProvider("anthropic", "opus", ["p2"], ["c-a"]),
    ]);
    const tabs = getDetailTabs(detail);
    expect(tabs.length).toBe(3);
    expect(tabs[0].key).toBe("aggregate");
    expect(tabs[1].key).toBe("google/pro");
    expect(tabs[2].key).toBe("anthropic/opus");
  });

  it("aggregate tab unions prompts across providers, tagging each with provider+model", () => {
    const detail = makeDetail([
      makeByProvider("google", "pro", ["p1", "p2"], []),
      makeByProvider("anthropic", "opus", ["p3"], []),
    ]);
    const [aggregate] = getDetailTabs(detail);
    expect(aggregate.prompts.map((p) => p.id)).toEqual(["p1", "p2", "p3"]);
    expect(aggregate.prompts[0]._provider).toBe("google");
    expect(aggregate.prompts[0]._model).toBe("pro");
    expect(aggregate.prompts[2]._provider).toBe("anthropic");
  });

  it("per-provider tab carries only that provider's prompts", () => {
    const detail = makeDetail([
      makeByProvider("google", "pro", ["p1"], []),
      makeByProvider("anthropic", "opus", ["p2", "p3"], []),
    ]);
    const tabs = getDetailTabs(detail);
    expect(tabs[1].prompts.map((p) => p.id)).toEqual(["p1"]);
    expect(tabs[2].prompts.map((p) => p.id)).toEqual(["p2", "p3"]);
  });

  it("aggregate tab top_competitors uses server-supplied union", () => {
    const detail = makeDetail([
      makeByProvider("google", "pro", [], ["c-g"]),
      makeByProvider("anthropic", "opus", [], ["c-a"]),
    ]);
    const [aggregate] = getDetailTabs(detail);
    expect(aggregate.top_competitors.map((c) => c.name)).toEqual(["c-g", "c-a"]);
  });

  it("per-provider tab top_competitors uses provider's own list", () => {
    const detail = makeDetail([
      makeByProvider("google", "pro", [], ["c-g"]),
      makeByProvider("anthropic", "opus", [], ["c-a1", "c-a2"]),
    ]);
    const tabs = getDetailTabs(detail);
    expect(tabs[1].top_competitors.map((c) => c.name)).toEqual(["c-g"]);
    expect(tabs[2].top_competitors.map((c) => c.name)).toEqual(["c-a1", "c-a2"]);
  });

  it("handles empty by_provider — aggregate tab still present with empty data", () => {
    const detail = makeDetail([]);
    const tabs = getDetailTabs(detail);
    expect(tabs.length).toBe(1);
    expect(tabs[0].key).toBe("aggregate");
    expect(tabs[0].prompts).toEqual([]);
  });
});

describe("formatScore (v0.4.1 scale: input is 0-1)", () => {
  it("formats 0.6473 as 64.7% (regression for double-% bug)", () => {
    expect(formatScore(0.6473)).toBe("64.7%");
  });

  it("formats 1 as 100.0%", () => {
    expect(formatScore(1)).toBe("100.0%");
  });

  it("formats 0 as 0.0%", () => {
    expect(formatScore(0)).toBe("0.0%");
  });

  it("formats null as em-dash", () => {
    expect(formatScore(null)).toBe("—");
  });
});
