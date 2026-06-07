import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getPromptAssignment, savePromptAssignment } from "../src/lib/api";

// Regression: the deployed content-generation-service PUT /prompt-assignments
// 200 response OMITS `isDefault` (GET returns it, PUT does not — confirmed
// against prod + staging api-registry). #1216 parsed the PUT response with the
// GET schema (isDefault required), so every successful fork threw
// "invalid response shape" and the operator saw a false error on a save that
// actually persisted. The fix: PUT has its own schema (no isDefault) and we
// return isDefault:false — definitionally true post-fork (an override now
// exists), not a masking fallback.

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

interface MockResponse {
  ok: boolean;
  status?: number;
  json: () => Promise<unknown>;
}

function jsonResponse(body: unknown, status = 200): MockResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const VARIABLES = [
  { name: "brand", description: "The brand(s) the pitch represents." },
  { name: "request", description: "The journalist's question." },
  { name: "additionalContext", description: "Any extra grounding." },
];

describe("savePromptAssignment — PUT response shape (no isDefault)", () => {
  const calls: { url: string; init?: FetchInit }[] = [];
  let fetchMock: ReturnType<typeof vi.fn>;
  let nextResponse: () => MockResponse;

  beforeEach(() => {
    calls.length = 0;
    fetchMock = vi.fn(async (input: FetchInput, init?: FetchInit) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push({ url, init });
      return nextResponse();
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("resolves with isDefault:false when the PUT 200 body omits isDefault", async () => {
    // Deployed PUT 200 shape — NO isDefault key.
    nextResponse = () =>
      jsonResponse({
        featureSlug: "pr-expert-quote-opportunities",
        promptType: "expert-quote-pitch-v2",
        prompt: "Edited {{brand}} {{request}} {{additionalContext}}",
        variables: VARIABLES,
      });

    const result = await savePromptAssignment({
      featureSlug: "pr-expert-quote-opportunities",
      prompt: "Edited {{brand}} {{request}} {{additionalContext}}",
      variables: VARIABLES,
    });

    expect(result.promptType).toBe("expert-quote-pitch-v2");
    expect(result.isDefault).toBe(false);
    expect(result.variables).toHaveLength(3);
  });

  it("PUTs {featureSlug,prompt,variables} to /content/prompt-assignments", async () => {
    nextResponse = () =>
      jsonResponse({
        featureSlug: "pr-expert-quote-opportunities",
        promptType: "expert-quote-pitch-v2",
        prompt: "Edited {{brand}}",
        variables: VARIABLES,
      });

    await savePromptAssignment({
      featureSlug: "pr-expert-quote-opportunities",
      prompt: "Edited {{brand}}",
      variables: VARIABLES,
    });

    expect(calls).toHaveLength(1);
    const { url, init } = calls[0];
    expect(url).toContain("/content/prompt-assignments");
    expect(init?.method).toBe("PUT");
    const sentBody = JSON.parse(String(init?.body));
    expect(sentBody).toEqual({
      featureSlug: "pr-expert-quote-opportunities",
      prompt: "Edited {{brand}}",
      variables: VARIABLES,
    });
  });

  it("propagates the backend 400 message naming the offending variable", async () => {
    nextResponse = () =>
      jsonResponse(
        { error: "Variable {{brand}} is missing from the submitted prompt" },
        400,
      );

    await expect(
      savePromptAssignment({
        featureSlug: "pr-expert-quote-opportunities",
        prompt: "no variables here",
        variables: VARIABLES,
      }),
    ).rejects.toThrow(/\{\{brand\}\}/);
  });
});

describe("getPromptAssignment — GET response shape unchanged (isDefault required)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () =>
      jsonResponse({
        featureSlug: "pr-expert-quote-opportunities",
        promptType: "expert-quote-pitch",
        prompt: "Default {{brand}} {{request}} {{additionalContext}}",
        variables: VARIABLES,
        isDefault: true,
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("preserves isDefault from the GET body", async () => {
    const result = await getPromptAssignment("pr-expert-quote-opportunities");
    expect(result.isDefault).toBe(true);
    expect(result.promptType).toBe("expert-quote-pitch");
  });
});
