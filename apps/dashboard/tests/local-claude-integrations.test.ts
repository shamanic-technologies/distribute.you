import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * LOCAL-CLAUDE-UI-1116: Integrations › Accounts and AI shows "AI on my Claude Code" (chat-service
 * GET/PUT /v1/local-llm) and, on the X accounts card, whether each account posts through the org's
 * own X app (social-service ORG-X-APP-1116). Every figure is served: the card renders, never computes.
 */
const read = (p: string) => readFileSync(path.resolve(__dirname, "..", p), "utf8");
const card = read("src/components/v2/local-claude-card.tsx");
const xCard = read("src/components/v2/x-accounts-card.tsx");
const pages = read("src/components/v2/setup-pages.tsx");
const api = read("src/lib/api.ts");

describe("AI on my Claude Code", () => {
  it("reads and writes the org's state through the gateway's /local-llm", () => {
    expect(api).toContain("apiCall<unknown>(`/local-llm`, { token })");
    expect(api).toContain('apiCall<unknown>(`/local-llm`, { token, method: "PUT", body: { enabled } })');
  });

  it("sits on the Accounts and AI view, under its own heading", () => {
    const ai = pages.slice(pages.indexOf('view === "ai" ? ('), pages.indexOf('view === "raw" ? ('));
    expect(ai).toContain("AI on my Claude Code");
    expect(ai).toContain("<LocalClaudeCard />");
  });

  it("prints the served figures and computes none", () => {
    for (const field of ["usage.calls", "usage.chargedUsd", "usage.notionalCostUsd", "state.pendingCalls", "state.runsLocally", "state.stillOnPlatform", "runner.lastSeenAt"]) {
      expect(card).toContain(field);
    }
    expect(card).not.toMatch(/\.reduce\(|Math\.(round|floor|ceil)|\* 30|\/ 30/);
  });

  it("reads a closed Mac app as a normal state, rose only while calls wait", () => {
    const runner = card.slice(card.indexOf("function RunnerLine"), card.indexOf("function Cell"));
    expect(runner).toContain("const waiting = pendingCalls > 0;");
    expect(runner).toMatch(/waiting \? "text-\[var\(--data-rose\)\]" : ""/);
  });

  it("writes the switch with the PUT and keeps the producer's answer", () => {
    expect(card).toContain("mutationFn: (enabled: boolean) => setLocalLlm(enabled)");
    expect(card).toContain("queryClient.setQueryData(queryKey, next)");
  });
});

describe("X accounts: the org's own X app", () => {
  it("parses xApp, ownApp and ownAppError as social-service serves them", () => {
    expect(api).toContain('xApp: z.enum(["own", "platform"])');
    expect(api).toContain("ownApp: XOwnAppSchema.nullable()");
    expect(api).toContain("ownAppError: z.string().nullable()");
  });

  it("marks each account with whose X app it posts through, and shows the served calls and error", () => {
    expect(xCard).toContain('account.xApp === "own" ? "Your X app" : "Our X app"');
    expect(xCard).toContain("app.calls.total");
    expect(xCard).toContain("{ownAppError}");
  });

  it("caches the new object shape under its own root (an old snapshot was an array)", () => {
    expect(xCard).toContain('["xAccountsState", brandId]');
    expect(read("src/lib/persist-cache.ts")).not.toMatch(/^\s*"xAccounts",/m);
  });
});
