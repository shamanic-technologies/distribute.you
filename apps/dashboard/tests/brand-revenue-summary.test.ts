/**
 * MON-PAGE-SPEED-1111: the brand money read every page shares asks features-service for the COUNT of
 * the brand's companies (`?organizations=count`), never the 5 MB list, so it fits the persisted cache.
 * Only the pages drawing the list read the full body.
 */
import { readFileSync } from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";
import { parseBrandRevenueSummary, parseFeatureRevenue } from "../src/lib/revenue-parse";
import { MAX_PERSISTED_ENTRY_BYTES } from "../src/lib/persist-cache";

const fixture = JSON.parse(readFileSync(path.resolve(__dirname, "fixtures/ledger-p2-prod-1107.json"), "utf8"));
const full = fixture.bodies.brandRevenue as Record<string, unknown> & { organizations: unknown[] };
const read = (f: string) => readFileSync(path.resolve(__dirname, "..", f), "utf8");

describe("brand revenue summary (organizations=count)", () => {
  it("parses the served slim body: same money, the company count, no company list", () => {
    const { organizations, ...rest } = full;
    const slim = parseBrandRevenueSummary({ ...rest, organizationCount: organizations.length }, "test");
    const whole = parseFeatureRevenue(full, "test");
    expect(slim.organizationCount).toBe(organizations.length);
    expect("organizations" in slim).toBe(false);
    const { organizations: _o, ...wholeRest } = whole;
    const { organizationCount: _c, ...slimRest } = slim;
    expect(slimRest).toEqual(wholeRest);
    expect(JSON.stringify(slim).length).toBeLessThan(MAX_PERSISTED_ENTRY_BYTES);
  });

  it("refuses a body without the count (fail loud, never a 0)", () => {
    const { organizations: _o, ...rest } = full;
    expect(() => parseBrandRevenueSummary(rest, "test")).toThrow();
  });

  it("the shared read asks the count; only list pages and a typed search ask the list", () => {
    const api = read("src/lib/api.ts");
    expect(api).toContain('new URLSearchParams({ pricing: "net", organizations: "count" })');
    const data = read("src/components/v2/data.ts");
    expect(data).toContain('["brandRevenue", brandId, "brand", "summary"], () => getBrandRevenueSummary(brandId)');
    expect(read("src/components/v2/companies-page.tsx")).toContain("useBrandCompanies(brandId)");
    expect(read("src/components/v2/company-page.tsx")).toContain("useBrandCompanies(brandId)");
    expect(read("src/components/v2/sidebar-menus.tsx")).toContain('useBrandCompanies(brandId, q.trim() !== "")');
    expect(read("src/components/v2/v2-shell.tsx")).toContain("revenue?.organizationCount");
  });
});
