import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MONITORING_PAGES, parseMonitoringPath } from "../src/lib/monitoring/monitoring";
import { VendorCreditSchema, hasCalls, outOfCreditVendors, vendorDays, vendorsRedFirst } from "../src/lib/monitoring/vendor-credit";

/**
 * VENDOR-CREDIT-1030: from 2026-10-29 ~16:00 UTC DeepSeek had no balance, every deepseek-flash call got a 402 and client
 * replies went unjudged, with nothing red anywhere. chat-service now stores "vendor out of credit" as a fact and serves
 * it (`GET /internal/vendor-credit?days=N`), read through api-service's staff passthrough onto Monitoring > AI vendors >
 * Credit; red on the hub is the alert.
 */
const read = (rel: string) => readFileSync(join(__dirname, "../src", rel), "utf8");
// CONTRACT-BUILT, not prod-captured: written from chat-service's agreed response shape before the route was live
// (DeepSeek out of credit since 2026-10-29 with 3 refused calls, the 5 others serving, 30 UTC days). Replace with a
// prod capture once the gateway serves the route.
const fixture = () => JSON.parse(readFileSync(join(__dirname, "fixtures", "chat-vendor-credit-contract-1030.json"), "utf8"));

describe("Monitoring > AI vendors > Credit: chat-service's read parses as served", () => {
  it("the contract body parses whole: DeepSeek red, 6 vendors, 30 days each", () => {
    const d = VendorCreditSchema.parse(fixture());
    expect(d.vendors.map((v) => v.provider)).toEqual(["deepseek", "zai", "moonshot", "openai", "anthropic", "google"]);
    for (const v of d.vendors) expect(vendorDays(d, v.provider)).toHaveLength(30);
    const reds = outOfCreditVendors(d);
    expect(reds.map((v) => v.provider)).toEqual(["deepseek"]);
    expect(reds[0]).toMatchObject({ refusedCalls: 3, fallbackLabel: "GLM-5.3 Flash", recoveredAt: null });
    expect(vendorDays(d, "deepseek").at(-1)).toMatchObject({ outOfCredit: true, refusedCalls: 1 });
    expect(hasCalls(vendorDays(d, "deepseek"))).toBe(true);
    expect(hasCalls(vendorDays(d, "openai"))).toBe(false);
  });

  it("puts red vendors first, each group in served order, never re-grading a verdict", () => {
    const raw = fixture();
    raw.vendors[4].outOfCredit = true; // anthropic
    const d = VendorCreditSchema.parse(raw);
    expect(vendorsRedFirst(d).map((v) => v.provider)).toEqual(["deepseek", "anthropic", "zai", "moonshot", "openai", "google"]);
    // A vendor with refused calls on record but served as having credit stays normal.
    expect(outOfCreditVendors(d).map((v) => v.provider)).toEqual(["deepseek", "anthropic"]);
  });

  it("accepts null timestamps, fallback and sentence", () => {
    const raw = fixture();
    raw.vendors[0] = { ...raw.vendors[0], since: null, lastSeenAt: null, fallbackModel: null, fallbackLabel: null, sentence: null };
    expect(VendorCreditSchema.safeParse(raw).success).toBe(true);
  });

  it("refuses a shape it does not know (a string verdict)", () => {
    const raw = fixture();
    raw.vendors[0].outOfCredit = "yes";
    expect(VendorCreditSchema.safeParse(raw).success).toBe(false);
  });
});

describe("Monitoring > AI vendors > Credit: page and hub", () => {
  it("reads the staff gateway route, never persisted to disk", () => {
    const api = read("lib/api.ts");
    expect(api).toContain('STAFF_VENDOR_CREDIT_PATH = "/chat/ops/vendor-credit"');
    expect(api).toContain("${STAFF_VENDOR_CREDIT_PATH}?days=${days}");
    const persist = read("lib/persist-cache.ts");
    const sensitive = persist.slice(persist.indexOf("export const SENSITIVE_QUERY_ROOTS"), persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
    expect(sensitive).toContain('"staffVendorCredit"');
    expect(read("components/v2/monitoring-vendor-credit.tsx")).toContain('["staffVendorCredit", VENDOR_CREDIT_DAYS]');
  });

  it("is a Monitoring page, mounted, with its red tile above the collapsible rows", () => {
    expect(MONITORING_PAGES).toContain("ai/credit");
    expect(parseMonitoringPath("/ai/credit")).toEqual({ view: "page", page: "ai/credit" });
    const page = read("components/v2/monitoring-page.tsx");
    expect(page).toContain('view.page === "ai/credit" && <VendorCreditPage />');
    const hub = page.slice(page.indexOf("function Hub("), page.indexOf("function Section("));
    expect(hub.indexOf('<VendorCreditTile href={href("ai/credit")} />')).toBeGreaterThan(-1);
    expect(hub.indexOf("<VendorCreditTile")).toBeLessThan(hub.indexOf("<Section "));
    expect(hub).toContain('<Section section="ai" count={1} grid={false}>');
  });

  it("draws the served verdicts, sentences and days: no client sort, no sum, no per-vendor case", () => {
    const src = read("components/v2/monitoring-vendor-credit.tsx");
    expect(src).toContain("v.outOfCredit");
    expect(src).toContain("v.sentence");
    expect(src).toContain("days.map");
    expect(src).not.toMatch(/\.sort\(/);
    expect(src).not.toMatch(/\.reduce\(/);
    expect(src).not.toMatch(/deepseek|moonshot|anthropic|openai/i);
  });
});
