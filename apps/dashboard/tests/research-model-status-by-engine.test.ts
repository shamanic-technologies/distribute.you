import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getContentModelStatuses } from "../src/lib/api";
import { contentDeprecation, modelsByTab } from "../src/lib/research/content-status";

// LLM-STATUS-PER-PIPE-1023 (owner 2026-10-23) set a writer model's status per channel x leg. RESEARCH-BY-ENGINE-1113
// (owner 2026-11-13: no pipe anywhere in Research) leaves Research no such grain: Research READS a model's fleet status
// (content generation's top-level `status`, read without a channel) and never WRITES one. The per-channel write stays a
// content-generation API (tested below at the API layer) that no Research surface calls.

const VISIT = { featureSlug: "sales-cold-email-outreach", legKey: "lead_found_to_website_visit" };
const WHY = "Too expensive, too smart for clicks";

// Prod, 2026-10-23: glm-pro and opus deprecated on one channel x leg only; their fleet status stays active.
const deprecatedOnVisit = (model: string) => ({
  model,
  provider: "x",
  status: "active",
  statusReason: null,
  statusChangedBy: null,
  statusChangedAt: null,
  pipeStatuses: [{ ...VISIT, status: "deprecated", statusReason: WHY, statusChangedBy: "kevin.lourd@gmail.com", statusChangedAt: "2026-10-23T06:40:55.218Z" }],
});
const PROD = [deprecatedOnVisit("glm-pro"), deprecatedOnVisit("opus"), { model: "sonnet", provider: "anthropic", status: "active", pipeStatuses: [] }];

describe("Research reads a model's fleet status, by Engine (RESEARCH-BY-ENGINE-1113)", () => {
  it("a status stated on one channel only never reads Deprecated on an Engine page", () => {
    const rows = ["glm-pro", "opus", "sonnet"].map((k) => ({ key: k, aliases: [k], aliasesUnavailableReason: null }));
    const map = new Map(PROD.map((m) => [m.model, m.status]));
    const tabs = modelsByTab(rows, { answered: true, map })!;
    expect(tabs.deprecated).toEqual([]);
    expect(tabs.active.map((r) => r.key)).toEqual(["glm-pro", "opus", "sonnet"]);
    // Its fleet row carries no why while active.
    expect(contentDeprecation(PROD[0])).toBeNull();
  });

  it("a model no alias serves (retired) reads Deprecated: it cannot write", () => {
    const tabs = modelsByTab([{ key: "glm-5.2", aliases: [], aliasesUnavailableReason: "no_alias_serves_it" as const }], { answered: true, map: new Map() })!;
    expect(tabs.deprecated.map((r) => r.key)).toEqual(["glm-5.2"]);
  });
});

describe("the dashboard reads a model's statuses and holds no model status write", () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  beforeEach(() => {
    calls.length = 0;
    globalThis.fetch = vi.fn(async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      calls.push({ url: String(input), init });
      const body = String(input).endsWith("/content/models") ? { models: PROD } : {};
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
  });
  afterEach(() => vi.restoreAllMocks());

  it("no model status write is left in the API module: Research had the only caller (RESEARCH-BY-ENGINE-1113)", () => {
    const api = readFileSync(join(__dirname, "../src/lib/api.ts"), "utf8");
    expect(api).not.toContain("export async function setContentModelStatus");
    expect(api).not.toContain("/content/models/${encodeURIComponent(model)}/status");
  });

  it("reads each model's fleet status, its per-channel entries passed through untouched", async () => {
    const models = await getContentModelStatuses();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/content/models");
    expect(models.find((m) => m.model === "glm-pro")?.status).toBe("active");
    expect(models.find((m) => m.model === "glm-pro")?.pipeStatuses?.[0]).toMatchObject({ ...VISIT, status: "deprecated", statusReason: WHY });
  });
});

describe("Research never writes a model status, and reads it without a channel", () => {
  const read = (p: string) => readFileSync(join(__dirname, "../src", p), "utf8");
  const status = read("components/v2/research-status.tsx");
  const list = read("components/v2/research-catalog.tsx");

  it("never names another grain's status, on the list or the LLM page (owner 2026-10-23: « je m'en fous »)", () => {
    for (const src of [list, status]) {
      expect(src).not.toContain("Deprecated on <");
      expect(src).not.toContain("Deprecated on other");
      expect(src).not.toContain("elsewhere(");
    }
  });

  it("every model status read is the fleet one: no channel, no leg", () => {
    expect(list).toContain("useModelStatuses()");
    expect(list).not.toContain("useContentPipe");
    expect(status).toContain("export function useModelStatuses() {");
    expect(status).toContain("new Map((q.data ?? []).map((m) => [m.model, m.status]))");
    expect(status).not.toContain("pipeStatuses");
  });

  it("no Research surface writes a model status; only a template's status is written there", () => {
    for (const src of [list, status]) expect(src).not.toContain("setContentModelStatus");
    expect(status).toContain('await setContentTemplateStatus(t.key, { status: "active" });');
    expect(read("lib/research/content-status.ts")).toContain('export type ContentTarget = { kind: "template"; key: string; label: string };');
  });
});
