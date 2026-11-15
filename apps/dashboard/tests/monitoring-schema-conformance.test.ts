import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MONITORING_PAGES, parseMonitoringPath } from "../src/lib/monitoring/monitoring";
import { SchemaConformanceSchema, brokenModels, modelDays, windowDays } from "../src/lib/monitoring/schema-conformance";

/**
 * SCHEMA-HONOURED-1115: on 2026-11-15 GLM-5.3 Flash wrote "cold_email_followup" and "M3" as email bodies (6 reached real
 * prospects, every call counted as a success). chat-service now measures every schema'd answer against the caller's
 * schema and serves it (`GET /internal/schema-conformance?days=N`), read through api-service's staff passthrough onto
 * Monitoring > AI vendors > Answer shape; red on the hub (served `broken` only) is the alert.
 */
const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
// PROD-CAPTURED 2026-11-15 ~21:00 UTC from chat-service in-container (first hours of the measure: 5 models, one route).
const fixture = () => JSON.parse(readFileSync(join(__dirname, "fixtures", "chat-schema-conformance-prod-1115.json"), "utf8"));

describe("Monitoring > AI vendors > Answer shape: chat-service's read parses as served", () => {
  it("the prod body parses whole, verdicts as served, nothing broken", () => {
    const d = SchemaConformanceSchema.parse(fixture());
    expect(d.verdict).toBe("ok");
    expect(d.models.map((m) => m.verdict)).toContain("not_enough_answers");
    expect(brokenModels(d)).toEqual([]);
    for (const m of d.models) expect(modelDays(d, m).every((r) => r.provider === m.provider && r.model === m.model)).toBe(true);
  });

  it("reads a broken model from the served verdict only, in served order, never re-grading the counts", () => {
    const raw = fixture();
    raw.verdict = "broken";
    raw.models[3] = { ...raw.models[3], verdict: "broken", nonConformingCalls: 6, lastViolations: '(root) is missing required key "message"' };
    // Many misses but served ok: stays normal (the verdict is chat-service's).
    raw.models[0] = { ...raw.models[0], nonConformingCalls: 19 };
    const d = SchemaConformanceSchema.parse(raw);
    expect(brokenModels(d).map((m) => m.model)).toEqual([raw.models[3].model]);
  });

  it("accepts null last-miss fields and refuses an unknown verdict", () => {
    const raw = fixture();
    expect(raw.models[0].lastViolations).toBeNull();
    raw.models[0].verdict = "red";
    expect(SchemaConformanceSchema.safeParse(raw).success).toBe(false);
  });

  it("the chart's axis is the calendar window ending today (quiet days have no stored row)", () => {
    const axis = windowDays(30, new Date("2026-11-15T21:00:00Z"));
    expect(axis).toHaveLength(30);
    expect(axis[0]).toBe("2026-10-17");
    expect(axis.at(-1)).toBe("2026-11-15");
  });
});

describe("Monitoring > AI vendors > Answer shape: page and hub", () => {
  it("reads the staff gateway route, never persisted to disk", () => {
    const api = read("lib/api.ts");
    expect(api).toContain('STAFF_SCHEMA_CONFORMANCE_PATH = "/chat/ops/schema-conformance"');
    expect(api).toContain("${STAFF_SCHEMA_CONFORMANCE_PATH}?days=${days}");
    const persist = read("lib/persist-cache.ts");
    const sensitive = persist.slice(persist.indexOf("export const SENSITIVE_QUERY_ROOTS"), persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    expect(sensitive).toContain('"staffSchemaConformance"');
  });

  it("is a Monitoring page, mounted, with its tile above the collapsible rows and a chip in AI vendors", () => {
    expect(MONITORING_PAGES).toContain("ai/schema");
    expect(parseMonitoringPath("/ai/schema")).toEqual({ view: "page", page: "ai/schema" });
    const page = read("components/v2/monitoring-page.tsx");
    expect(page).toContain('view.page === "ai/schema" && <SchemaConformancePage />');
    const hub = page.slice(page.indexOf("function Hub("), page.indexOf("function Section("));
    expect(hub.indexOf('<SchemaConformanceTile href={href("ai/schema")} />')).toBeGreaterThan(-1);
    expect(hub.indexOf("<SchemaConformanceTile")).toBeLessThan(hub.indexOf("<Section "));
    expect(hub).toContain('href={href("ai/schema")} color={schemaConf.data?.verdict === "broken"');
  });

  it("draws the served verdicts and sentences: red only on broken, no client sort", () => {
    const src = read("components/v2/monitoring-schema-conformance.tsx");
    expect(src).toContain('data.verdict === "broken" ? RED');
    expect(src).toContain('const red = m.verdict === "broken"');
    expect(src).toContain("m.sentence");
    expect(src).toContain("m.lastViolations");
    expect(src).not.toMatch(/\.sort\(/);
    expect(src).not.toMatch(/glm|deepseek|kimi|gemini/i);
  });
});
