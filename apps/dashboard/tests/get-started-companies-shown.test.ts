import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CAMPAIGN_COMPANIES, GET_STARTED_STEPS, parseGetStartedSnapshot } from "../src/lib/v2/get-started";

// Owner 2026-11-25: step 9 read "10 found" under "Find 100 companies" (5 shown + 5 replacements
// for companies failing a Must have, the failing ones still listed), then "5" with "We could not
// find more companies just now" once back from the payment wall (the page read the list again).

const gs = readFileSync(new URL("../src/components/v2/get-started/get-started.tsx", import.meta.url), "utf8");
const base = {
  version: 2,
  website: "https://usetrilo.com.br",
  brandId: "55212ee9-8e05-4ea4-88ee-47f773c3b8ff",
  brandName: "Trilo",
  domain: "usetrilo.com.br",
  overview: "Wireless temperature monitoring.",
  facts: [],
  competitors: [],
  offer: null,
  audience: null,
  email: null,
};
const row = (index: number, domain: string) => ({
  index,
  company: { name: `Co ${index}`, domain },
  person: { firstName: "Ana", title: "Owner" },
});

describe("/get-started companies step: what it shows and keeps", () => {
  it("the step and its count name the same campaign size", () => {
    expect(GET_STARTED_STEPS.find((s) => s.key === "companies")?.label).toBe(`Find ${CAMPAIGN_COMPANIES} companies`);
    expect(gs).toContain("/> of {CAMPAIGN_COMPANIES}</>");
  });

  it("a company failing a Must have is replaced, never listed, unless none fits", () => {
    expect(gs).toContain("const shownCompanyRows = noneFits ? audRows : fittingRows.slice(0, PREVIEW_COMPANIES);");
    expect(gs).toContain("rows={shownCompanyRows}");
  });

  it("the snapshot keeps the companies shown and their answers", () => {
    const checks = { "a.com.br": { domain: "a.com.br", mustPass: { state: "fails", failed: [] } } };
    const s = parseGetStartedSnapshot(
      JSON.stringify({ ...base, companies: { audienceId: "aud-1", rows: [row(0, "a.com.br"), row(1, "b.com.br")], checks } }),
    )!;
    expect(s.companies?.audienceId).toBe("aud-1");
    expect(s.companies?.rows.map((r) => r.index)).toEqual([0, 1]);
    expect(s.companies?.checks).toEqual(checks);
  });

  it("drops a malformed companies list", () => {
    expect(parseGetStartedSnapshot(JSON.stringify({ ...base, companies: { audienceId: "aud-1", rows: [{ index: "x" }] } }))!.companies).toBeNull();
    expect(parseGetStartedSnapshot(JSON.stringify({ ...base, companies: { rows: [row(0, "a.com")] } }))!.companies).toBeNull();
  });

  it("back from the wall: the same list comes back, never read again", () => {
    expect(gs).toContain("if (shownCompanies) restoreCompanies(shownCompanies);");
    expect(gs).toContain('companies: shownCompanies ? "done" : s.audience ? "running" : "failed",');
    expect(gs).toContain("saveSnapshot({ companies: { audienceId: audience.audienceId, rows: shown, checks } });");
  });

  it("a later page failing keeps the companies shown, with no 'could not find more' line", () => {
    const at = gs.indexOf("async function loadCompanies(");
    const body = gs.slice(at, gs.indexOf("function checkCompanies(", at));
    expect(body.indexOf("if (!first) {")).toBeGreaterThan(-1);
    expect(body.indexOf("if (!first) {")).toBeLessThan(body.indexOf("We could not find more companies just now."));
  });
});
