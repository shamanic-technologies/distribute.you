import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CapacityHistorySchema,
  OpsInfraSchema,
  ReconcileSchema,
  SendForecastSchema,
  byCountDesc,
  poolWord,
  signed,
  stackHeight,
  whole,
} from "../src/lib/monitoring/capacity";
import { LifecycleRulesSchema } from "../src/lib/monitoring/sending";

const fixture = (name: string) => JSON.parse(readFileSync(join(__dirname, "fixtures", `${name}-prod-2026-10-19.json`), "utf8"));
const src = readFileSync(join(__dirname, "../src/components/v2/monitoring-capacity.tsx"), "utf8");

describe("Monitoring > Emails > Capacity: the producers' reads parse as served in prod (2026-10-19)", () => {
  it("every read parses whole", () => {
    const infra = OpsInfraSchema.parse(fixture("ops-infra"));
    expect(infra.fleet.dailyCapacity).toBe(1004);
    expect(infra.pools.length).toBe(4);
    // a pool at zero capacity is served, and stays listed
    expect(infra.pools.some((p) => p.dailyCapacity === 0)).toBe(true);
    // a pool with nothing measured is null, never 0%
    expect(infra.pools.find((p) => p.pool === "unknown")?.inboxPctMean).toBeNull();
    const forecast = SendForecastSchema.parse(fixture("send-forecast"));
    expect(forecast.days.length).toBe(22);
    expect(forecast.days.filter((d) => d.isToday).length).toBe(1);
    expect(forecast.summary.observedDailyThroughput).toBe(573);
    expect(CapacityHistorySchema.parse(fixture("capacity-history")).series.length).toBe(90);
    expect(ReconcileSchema.parse(fixture("reconcile")).metrics.length).toBe(3);
  });

  it("the rules read parses with the rule order and the warmup budget (the Rules page needs both)", () => {
    const rules = LifecycleRulesSchema.parse(fixture("lifecycle-rules"));
    expect(rules.order[rules.order.length - 1].leadsTo).toBe("in_production");
    expect(rules.warmup.maxShareOfCap).toBe(0.3);
    // `null` = the limit is left unchanged, a different fact from 0
    expect(rules.states.find((s) => s.status === "deactivated_by_instantly")?.campaignDailyLimit).toBeNull();
    // the older fixture of the same route parses too
    expect(LifecycleRulesSchema.parse(fixture("ops-lifecycle-rules")).order.length).toBeGreaterThan(0);
  });

  it("the served summed total equals its served parts on every future day (so showing the parts apart loses nothing)", () => {
    const forecast = SendForecastSchema.parse(fixture("send-forecast"));
    for (const d of forecast.days.filter((x) => x.actualSent === null && x.total !== null)) {
      expect(stackHeight([d.inFlightSent, d.forecastNew]) - d.total!).toBe(0);
    }
  });

  it("helpers format and look up, never invent", () => {
    expect(whole(null)).toBeNull();
    expect(whole(651.556)).toBe("652");
    expect(whole(1004)).toBe("1,004");
    expect(signed(10285)).toBe("+10,285");
    expect(signed(-3)).toBe("-3");
    expect(signed(0)).toBe("0");
    expect(poolWord("gandi-relay")).toBe("Gandi relay");
    expect(poolWord("new-pool")).toBe("new-pool");
    expect(byCountDesc({ a: 1, b: 5 })[0][0]).toBe("b");
    expect(stackHeight([null, null])).toBe(0);
  });
});

describe("Monitoring > Emails > Capacity and Rules: the pages render served fields only", () => {
  it("exports the two pages", () => {
    expect(src).toContain("export function CapacityPage({ base");
    expect(src).toContain("export function RulesPage({ base");
  });

  it("the capacity tile and the chart's capacity line read the same served field", () => {
    expect(src.match(/fleet\.dailyCapacity/g)?.length).toBeGreaterThanOrEqual(2);
    expect(src).toContain("const capacity = infra.data?.fleet.dailyCapacity;");
  });

  it("never adds the two planned parts for display, and never sums a figure", () => {
    expect(src).not.toMatch(/inFlightSent\s*\?\?\s*0\)\s*\+/);
    expect(src).not.toContain("reduce(");
    expect(src).toContain('label: "Follow-ups planned", value: d.inFlightSent');
    expect(src).toContain('label: "New planned", value: d.forecastNew');
  });

  it("no em or en dash in copy, no open rate, no grey utilities", () => {
    expect(src).not.toMatch(/[–]/);
    expect(src.replace(/"—"/g, "")).not.toMatch(/>[^<]*—[^<]*</);
    expect(src.toLowerCase()).not.toContain("open rate");
    expect(src).not.toMatch(/text-gray-|bg-brand-50|rounded-lg border|shadow-2xl/);
  });

  it("the day-by-day table folds after its first rows", () => {
    expect(src).toContain("useShowAll(total, 10)");
  });
});
