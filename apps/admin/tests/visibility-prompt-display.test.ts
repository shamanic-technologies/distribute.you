import { describe, it, expect } from "vitest";
import {
  mergeBrandIntoCompetitors,
  getPromptDebugFields,
  getRunDebugFields,
  DEBUG_FIELD_PLACEHOLDER,
  type PromptWithProvider,
} from "../src/lib/visibility-detail";
import { formatProviderModelName } from "../src/components/visibility/provider-label";
import type {
  VisibilityRun,
  VisibilityRunPrompt,
  VisibilityRunTopCompetitor,
} from "../src/lib/api";

function makeRun(overrides: Partial<VisibilityRun> = {}): VisibilityRun {
  return {
    id: "run-1",
    orgId: "org-1",
    brandId: "brand-1",
    parentRunId: null,
    runId: null,
    domain: "example.com",
    brandName: "ExampleBrand",
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
    shareOfVoice: "0.30",
    netSentiment: "0.50",
    citationRate: null,
    avgPosition: "2.5",
    status: "completed",
    startedAt: null,
    completedAt: null,
    createdAt: "2026-05-12T00:00:00Z",
    judgeKind: "aggregate",
    aggregateRunId: null,
    promptGenSystemPrompt: null,
    promptGenUserMessage: null,
    ...overrides,
  };
}

function makePrompt(brandFound: boolean, overrides: Partial<VisibilityRunPrompt> = {}): PromptWithProvider {
  const base: VisibilityRunPrompt = {
    id: "p1",
    promptIndex: 0,
    promptText: "p",
    responseText: "",
    responseLengthChars: null,
    brandFound,
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
    judgeSystemPrompt: null,
    judgeUserMessage: null,
    extractorSystemPrompt: null,
    extractorUserMessage: null,
    ...overrides,
  };
  return { ...base, _provider: "google", _model: "pro" };
}

function makeCompetitor(
  name: string,
  share_of_voice: number,
): VisibilityRunTopCompetitor {
  return {
    name,
    url: null,
    mention_count: 1,
    avg_position: null,
    share_of_voice,
    net_sentiment: 0,
  };
}

describe("formatProviderModelName", () => {
  it("maps google/pro to Gemini Pro", () => {
    expect(formatProviderModelName("google", "pro")).toBe("Gemini Pro");
  });

  it("maps anthropic/opus to Claude Opus", () => {
    expect(formatProviderModelName("anthropic", "opus")).toBe("Claude Opus");
  });

  it("maps openai/gpt-5 to GPT-5", () => {
    expect(formatProviderModelName("openai", "gpt-5")).toBe("GPT-5");
  });

  it("falls back to raw provider/model for unmapped pairs", () => {
    expect(formatProviderModelName("foo", "bar")).toBe("foo/bar");
  });
});

describe("mergeBrandIntoCompetitors", () => {
  it("inserts brand row sorted by share_of_voice descending", () => {
    const competitors = [
      makeCompetitor("CompA", 0.5),
      makeCompetitor("CompB", 0.1),
    ];
    const prompts = [makePrompt(true), makePrompt(false)];
    const rows = mergeBrandIntoCompetitors(competitors, makeRun(), prompts);
    expect(rows.map((r) => r.name)).toEqual(["CompA", "ExampleBrand", "CompB"]);
  });

  it("marks brand row with _isBrand=true and competitors with _isBrand=false", () => {
    const rows = mergeBrandIntoCompetitors(
      [makeCompetitor("CompA", 0.1)],
      makeRun(),
      [],
    );
    const brandRow = rows.find((r) => r._isBrand);
    expect(brandRow?.name).toBe("ExampleBrand");
    expect(rows.filter((r) => r._isBrand)).toHaveLength(1);
    expect(rows.find((r) => r.name === "CompA")?._isBrand).toBe(false);
  });

  it("counts brand mentions from prompts where brandFound=true", () => {
    const prompts = [
      makePrompt(true),
      makePrompt(true),
      makePrompt(false),
      makePrompt(true),
    ];
    const rows = mergeBrandIntoCompetitors([], makeRun(), prompts);
    expect(rows[0].mention_count).toBe(3);
  });

  it("uses run.shareOfVoice / netSentiment / avgPosition for brand row", () => {
    const run = makeRun({
      shareOfVoice: "0.42",
      netSentiment: "0.7",
      avgPosition: "3.14",
    });
    const rows = mergeBrandIntoCompetitors([], run, []);
    const brandRow = rows[0];
    expect(brandRow.share_of_voice).toBeCloseTo(0.42);
    expect(brandRow.net_sentiment).toBeCloseTo(0.7);
    expect(brandRow.avg_position).toBeCloseTo(3.14);
  });

  it("falls back to 0 share_of_voice / net_sentiment when run values null", () => {
    const run = makeRun({ shareOfVoice: null, netSentiment: null, avgPosition: null });
    const rows = mergeBrandIntoCompetitors([makeCompetitor("X", 0.1)], run, []);
    const brandRow = rows.find((r) => r._isBrand)!;
    expect(brandRow.share_of_voice).toBe(0);
    expect(brandRow.net_sentiment).toBe(0);
    expect(brandRow.avg_position).toBeNull();
  });

  it("sets brand url from run.domain", () => {
    const run = makeRun({ domain: "distribute.you" });
    const rows = mergeBrandIntoCompetitors([], run, []);
    expect(rows[0].url).toBe("https://distribute.you");
  });
});

describe("getPromptDebugFields (v0.5.2 debug payload surfacing)", () => {
  it("returns judge + extractor strings verbatim when all 4 present", () => {
    const prompt = makePrompt(false, {
      judgeSystemPrompt: "JUDGE-SYS",
      judgeUserMessage: "JUDGE-USER",
      extractorSystemPrompt: "EXTRACT-SYS",
      extractorUserMessage: "EXTRACT-USER",
    });
    const fields = getPromptDebugFields(prompt);
    expect(fields).toEqual([
      { label: "Judge system prompt", value: "JUDGE-SYS" },
      { label: "Judge user message", value: "JUDGE-USER" },
      { label: "Extractor system prompt", value: "EXTRACT-SYS" },
      { label: "Extractor user message", value: "EXTRACT-USER" },
    ]);
  });

  it("returns null values for all 4 fields when run predates v0.5.2", () => {
    const prompt = makePrompt(false);
    const fields = getPromptDebugFields(prompt);
    expect(fields.map((f) => f.value)).toEqual([null, null, null, null]);
    expect(fields.map((f) => f.label)).toEqual([
      "Judge system prompt",
      "Judge user message",
      "Extractor system prompt",
      "Extractor user message",
    ]);
  });

  it("preserves newlines + whitespace in returned strings", () => {
    const multiline = "line1\nline2\n  indented";
    const prompt = makePrompt(false, { judgeUserMessage: multiline });
    const fields = getPromptDebugFields(prompt);
    expect(fields[1].value).toBe(multiline);
  });
});

describe("getRunDebugFields (v0.5.2 prompt-gen payload surfacing)", () => {
  it("returns prompt-gen strings verbatim when both present", () => {
    const run = makeRun({
      promptGenSystemPrompt: "PG-SYS",
      promptGenUserMessage: "PG-USER",
    });
    const fields = getRunDebugFields(run);
    expect(fields).toEqual([
      { label: "Prompt-gen system prompt", value: "PG-SYS" },
      { label: "Prompt-gen user message", value: "PG-USER" },
    ]);
  });

  it("returns null values when run predates v0.5.2", () => {
    const fields = getRunDebugFields(makeRun());
    expect(fields.map((f) => f.value)).toEqual([null, null]);
  });
});

describe("DEBUG_FIELD_PLACEHOLDER", () => {
  it("is the canonical 'not recorded' fallback string used by both panels", () => {
    expect(DEBUG_FIELD_PLACEHOLDER).toBe("Not recorded for this run.");
  });
});
