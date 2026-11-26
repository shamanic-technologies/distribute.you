import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MONITORING_PAGES, parseMonitoringPath } from "../src/lib/monitoring/monitoring";
import { AiMessageModelsSchema, dayOf, healthSentence, modelWords, reasonWords } from "../src/lib/monitoring/ai-message-models";

/**
 * MODEL-TAG-EVERY-AI-MESSAGE-1126 (owner 2026-11-26): every message our AI wrote names the model that wrote it.
 * features-service stores per UTC day the AI messages with vs without a model named (`GET /internal/stats/ai-message-models`),
 * read through api-service's staff route onto Monitoring > AI vendors > Model named; red = the served `health.broken`.
 */
const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
const fixture = () => JSON.parse(readFileSync(join(__dirname, "fixtures", "features-ai-message-models-1126.json"), "utf8"));

describe("Monitoring > AI vendors > Model named: features-service's read parses as served", () => {
  it("the served body parses whole, days newest first, names by chat-service's served name", () => {
    const d = AiMessageModelsSchema.parse(fixture());
    expect(d.days.length).toBeGreaterThan(0);
    const latest = d.days[0];
    expect(dayOf(d, latest.day.slice(0, 10))).toBe(latest);
    for (const id of Object.keys(latest.fleet.byModel)) expect(modelWords(d, id)).toBe(d.modelNames[id]?.name ?? id);
  });

  it("reads red from the served health only, in its words", () => {
    const raw = fixture();
    raw.health = { broken: true, unnamedOnRecentSends: 3, lastComputedAt: raw.health.lastComputedAt, reason: "ai_messages_with_no_model_named" };
    expect(healthSentence(AiMessageModelsSchema.parse(raw))).toBe("3 AI messages sent today or yesterday with no model named.");
    raw.health = { broken: true, unnamedOnRecentSends: 0, lastComputedAt: null, reason: "series_not_rebuilt" };
    expect(healthSentence(AiMessageModelsSchema.parse(raw))).toContain("stopped");
    raw.health = { broken: false, unnamedOnRecentSends: 0, lastComputedAt: null, reason: null };
    expect(healthSentence(AiMessageModelsSchema.parse(raw))).toContain("Every AI message");
  });

  it("names a reason in words, an unknown one as served", () => {
    expect(reasonWords("no_llm_billed")).toBe("No AI model billed in the writing run");
    expect(reasonWords("no_writing_in_ledger")).toBe("No writing in the ledger");
    expect(reasonWords("brand_new_reason")).toBe("brand new reason");
  });
});

describe("Monitoring > AI vendors > Model named: page and hub", () => {
  it("reads the staff gateway route, never persisted to disk", () => {
    const api = read("lib/api.ts");
    expect(api).toContain('STAFF_AI_MESSAGE_MODELS_PATH = "/features/audit/ai-message-models"');
    expect(api).toContain("${STAFF_AI_MESSAGE_MODELS_PATH}?days=${days}");
    const persist = read("lib/persist-cache.ts");
    const sensitive = persist.slice(persist.indexOf("export const SENSITIVE_QUERY_ROOTS"), persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    expect(sensitive).toContain('"staffAiMessageModels"');
  });

  it("is a Monitoring page, mounted, with its tile, its card and a chip in AI vendors", () => {
    expect(MONITORING_PAGES).toContain("ai/models");
    expect(parseMonitoringPath("/ai/models")).toEqual({ view: "page", page: "ai/models" });
    const hub = read("components/v2/monitoring-page.tsx");
    expect(hub).toContain('view.page === "ai/models" && <AiMessageModelsPage />');
    expect(hub).toContain('<AiMessageModelsTile href={href("ai/models")} />');
    expect(hub).toContain('href={href("ai/models")} color={aiModels.data?.health.broken');
    expect(hub).toContain('page="ai/models"');
  });

  it("draws served counts, never a ratio, and names each model through CatalogueName", () => {
    const src = read("components/v2/monitoring-ai-message-models.tsx");
    expect(src).toContain("flexGrow: d.fleet.withoutModel");
    expect(src).toContain("flexGrow: d.fleet.withModel");
    expect(src).toContain('<CatalogueName kind="llm"');
    expect(src).not.toMatch(/withModel \/|\/ d\.fleet\.messages/);
  });
});
