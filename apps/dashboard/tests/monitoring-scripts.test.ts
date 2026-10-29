import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MONITORING_PAGES, parseMonitoringPath } from "../src/lib/monitoring/monitoring";
import {
  ScriptsMonitoringSchema,
  brokenOutcomes,
  dollarsPerRun,
  guardStateWords,
  isBroken,
  outcomeName,
  problemsFirst,
  proofWords,
  switchStateWords,
  toPct,
} from "../src/lib/monitoring/scripts-monitoring";

/**
 * FACTORY-P3: workflow-service's stored scripts ("Engines") replace a service's own code for one outcome (first live:
 * `message_written/dy_template_writer_full`, every cold email of the fleet). `GET /v1/scripts/ops/monitoring?days=N`
 * (api-service byte passthrough of workflow-service `GET /internal/scripts/monitoring`) serves per outcome the script
 * path vs the service path per day, the proof, the two verdicts, and (once deployed) the roll-back guard. The body below
 * is the shape `readMonitoring` returns on workflow-service main plus the guard as locked by the brief.
 */
const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");

const pathDay = (day: string, runs: number | null, errorRate: number | null, avgCostCents: number | null) => ({
  day,
  runs,
  totalRuns: 1000,
  sample: 200,
  errorRate,
  avgCostCents,
  tasks: ["single-generation"],
});

const BODY = {
  since: "2026-09-29",
  outcomes: [
    {
      outcome: "message_written",
      servicePath: { serviceName: "content-generation-service", taskNames: ["single-generation"] },
      scripts: [{ scriptSlug: "message_written/dy_template_writer_full/v1", proof: { cases: 76, matches: 76 } }],
      red: false,
      readyToDelete: false,
      days: [
        { day: "2026-10-28", service: pathDay("2026-10-28", null, 0.01, 0.42), script: null },
        // Numbers may arrive as strings.
        { day: "2026-10-29", service: pathDay("2026-10-29", 120, 0.005, 0.4), script: { ...pathDay("2026-10-29", "300" as unknown as number, "0.004" as unknown as number, "0.31" as unknown as number), tasks: ["script:message_written/dy_template_writer_full"] } },
      ],
    },
  ],
};

const GUARD = {
  state: "rolled_back",
  windowMinutes: 60,
  lastHour: { runs: 140, failed: 22, errorRate: 0.157 },
  baselineErrorRate: 0.005,
  thresholdErrorRate: "0.05",
  minRuns: 20,
  rolledBackAt: "2026-10-29T09:12:00.000Z",
  reason: "22 of 140 runs failed in the last hour",
  switches: [{ workflowDynastySlug: "sales-cold-email-outreach-writer", fromVersion: 7, toVersion: 6, state: "rolled_back" }],
};

describe("Monitoring > Scripts: the served shape", () => {
  it("parses the body without a guard (workflow-service before the guard ships), strings coerced, nulls kept", () => {
    const d = ScriptsMonitoringSchema.parse(BODY);
    const o = d.outcomes[0];
    expect(o.guard).toBeUndefined();
    expect(o.days[0].service?.runs).toBeNull();
    expect(o.days[1].script?.runs).toBe(300);
    expect(o.days[1].script?.errorRate).toBe(0.004);
    expect(isBroken(o)).toBe(false);
    expect(brokenOutcomes(d)).toEqual([]);
  });

  it("parses a rolled-back guard and reads it as broken, problems first", () => {
    const d = ScriptsMonitoringSchema.parse({
      ...BODY,
      outcomes: [{ ...BODY.outcomes[0], outcome: "other_outcome" }, { ...BODY.outcomes[0], guard: GUARD }],
    });
    expect(d.outcomes[1].guard?.thresholdErrorRate).toBe(0.05);
    expect(brokenOutcomes(d).map((o) => o.outcome)).toEqual(["message_written"]);
    expect(problemsFirst(d).map((o) => o.outcome)).toEqual(["message_written", "other_outcome"]);
  });

  it("reads the served red verdict as broken even with a calm guard", () => {
    const d = ScriptsMonitoringSchema.parse({ ...BODY, outcomes: [{ ...BODY.outcomes[0], red: true, guard: { ...GUARD, state: "watching", rolledBackAt: null, reason: null, switches: [] } }] });
    expect(brokenOutcomes(d)).toHaveLength(1);
  });
});

describe("Monitoring > Scripts: words and formatting", () => {
  it("names outcomes, guard and switch states in plain words, an unknown one as served", () => {
    expect(outcomeName("message_written")).toBe("Cold emails written");
    expect(outcomeName("brand_new")).toBe("brand_new");
    expect(guardStateWords("rolled_back")).toEqual({ words: "Rolled back", tone: "red" });
    expect(guardStateWords("watching").words).toBe("Watching");
    expect(guardStateWords("off").words).toBe("Off");
    expect(switchStateWords("rolled_back")).toBe("Back on the old version");
    expect(proofWords("message_written", { cases: 76, matches: 76 })).toBe("76 of 76 recorded emails replayed the same");
    expect(proofWords("message_written", null)).toBe("Not proven yet");
  });

  it("only converts units", () => {
    expect(toPct(0.005)).toBeCloseTo(0.5);
    expect(toPct(null)).toBeNull();
    expect(dollarsPerRun(0.31)).toBe("$0.0031");
    expect(dollarsPerRun(250)).toBe("$2.50");
    expect(dollarsPerRun(null)).toBeNull();
  });
});

describe("Monitoring > Scripts: page and hub", () => {
  it("reads the staff gateway route, never persisted to disk", () => {
    const api = read("lib/api.ts");
    expect(api).toContain('scriptsMonitoring: "/scripts/ops/monitoring"');
    expect(api).toContain("STAFF_MONITORING_PATHS.scriptsMonitoring");
    expect(api).toContain('parseStaff("getStaffScriptsMonitoring", ScriptsMonitoringSchema');
    const persist = read("lib/persist-cache.ts");
    const sensitive = persist.slice(persist.indexOf("export const SENSITIVE_QUERY_ROOTS"), persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    expect(sensitive).toContain('"staffScriptsMonitoring"');
    expect(read("components/v2/monitoring-scripts.tsx")).toContain('["staffScriptsMonitoring", SCRIPTS_DAYS]');
  });

  it("is a Monitoring page, mounted, with its red tile above the collapsible rows and its card in its section", () => {
    expect(MONITORING_PAGES).toContain("scripts/engines");
    expect(parseMonitoringPath("/scripts/engines")).toEqual({ view: "page", page: "scripts/engines" });
    const page = read("components/v2/monitoring-page.tsx");
    expect(page).toContain('view.page === "scripts/engines" && <ScriptsPage />');
    const hub = page.slice(page.indexOf("function Hub("), page.indexOf("function Section("));
    expect(hub.indexOf('<ScriptsTile href={href("scripts/engines")} />')).toBeGreaterThan(-1);
    expect(hub.indexOf("<ScriptsTile")).toBeLessThan(hub.indexOf("<Section "));
    expect(hub).toContain('<Section section="scripts" count={1} grid={false}>');
    expect(hub).toContain('page="scripts/engines"');
  });

  it("draws the three charts per outcome, the guard, the proof, problems first, no sum", () => {
    const src = read("components/v2/monitoring-scripts.tsx");
    const block = src.slice(src.indexOf("function OutcomeBlock("), src.indexOf("export function ScriptsView("));
    for (const t of ["pair((p) => p.runs)", "pair((p) => toPct(p.errorRate))", "pair((p) => p.avgCostCents)", "<GuardRow guard={o.guard} />", "proofWords(o.outcome, s.proof)", "o.readyToDelete &&"]) {
      expect(block).toContain(t);
    }
    expect(src).toContain("problemsFirst(data).map");
    expect(src).not.toMatch(/\.reduce\(/);
    expect(src).not.toMatch(/\.sort\(/);
  });
});
