import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { MAX_CHECKED_COMPANIES, checkDomain, companiesWanted, unmetSignals } from "../src/lib/v2/get-started";

// Owner 2026-10-17: the signals picked in the walk run on the preview companies; a company
// failing a Must have shows the condition it misses (no person, no email) and the next company
// takes its place; the others' emails are written WITH the check results, as a campaign's are.

describe("signal check rules", () => {
  it("keys a company like lead-service does", () => {
    expect(checkDomain("https://www.Rafal.com.sa/en?x=1")).toBe("rafal.com.sa");
    expect(checkDomain("  ALTA.ae ")).toBe("alta.ae");
  });

  it("names a missed Must have by its title, else its question", () => {
    expect(
      unmetSignals([
        { title: "Units search on the site", question: "Does the website feature available units?" },
        { title: null, question: "Is it a real estate developer?" },
      ]),
    ).toBe("Units search on the site · Is it a real estate developer?");
  });

  it("asks one more company per failing one, up to lead-service's cap", () => {
    expect(companiesWanted(5, 0)).toBe(5);
    expect(companiesWanted(5, 2)).toBe(7);
    expect(companiesWanted(5, 9)).toBe(MAX_CHECKED_COMPANIES);
  });
});

const FLOW = fs.readFileSync(path.resolve(__dirname, "../src/components/v2/get-started/get-started.tsx"), "utf8");
const API = fs.readFileSync(path.resolve(__dirname, "../src/lib/api.ts"), "utf8");

describe("the walk checks the preview companies", () => {
  it("sends the company's check results with its example email, and skips a company failing a Must have", () => {
    const at = FLOW.indexOf("async function writeExample(");
    const body = FLOW.slice(at, FLOW.indexOf("// ── The stage", at));
    expect(body).toContain("check = await checkOf(r);");
    expect(body).toContain("qualification: check.qualification");
    expect(body).toContain('if (check?.mustPass.state !== "fails") {');
    // A listed company failing a Must have: one more company is listed in its place.
    const checks = FLOW.slice(FLOW.indexOf("function checkCompanies("), FLOW.indexOf("async function checkOf("));
    expect(checks).toContain("wantRows(aud, companiesWanted(PREVIEW_COMPANIES, failing.size))");
  });

  it("runs the checks only after the visitor's ticks are saved", () => {
    const at = FLOW.indexOf("function checkCompanies(");
    const body = FLOW.slice(at, FLOW.indexOf("async function checkOf(", at));
    const saved = body.indexOf("await saved;");
    expect(saved).toBeGreaterThan(-1);
    expect(body.indexOf("startQualificationPreview(", saved)).toBeGreaterThan(saved);
    expect(body).toContain("getQualificationPreview(");
  });

  it("checks companies as they are listed and after the signals are confirmed", () => {
    const load = FLOW.slice(FLOW.indexOf("async function loadCompanies("), FLOW.indexOf("function checkCompanies("));
    expect(load).toContain("void checkCompanies(got);");
    const confirm = FLOW.slice(FLOW.indexOf("async function confirmSignals("), FLOW.indexOf("async function confirmValue("));
    expect(confirm).toContain("signalsSaved.current = save;");
    expect(confirm).toContain("void checkCompanies(");
  });

  it("shows the missed condition on the companies step", () => {
    expect(FLOW.match(/unmet=\{unmetOf\}/g)?.length).toBe(1);
    expect(FLOW).toContain("{`Does not meet: ${text}`}");
  });

  it("stops writing and says why when no listed company meets every Must have", () => {
    const at = FLOW.indexOf("const noneFits =");
    const block = FLOW.slice(at, FLOW.indexOf("// ── Step 6: the emails", at));
    expect(block).toContain("listed.every((r) => failsMustHave(r))");
    expect(block).toContain('setStep("email", "failed")');
    expect(FLOW).toContain("noneFits={noneFits}");
    expect(FLOW).toContain("meets every Must have. Make one of them a Nice to have");
  });

  it("forwards the check results verbatim to content-generation", () => {
    const at = API.indexOf("export async function previewColdEmail(");
    const body = API.slice(at, API.indexOf("const PreviewEmailPrepareSchema", at));
    expect(body).toContain("...(input.qualification ? { qualification: input.qualification } : {})");
    const start = API.slice(API.indexOf("export async function startQualificationPreview("), API.indexOf("export async function getQualificationPreview("));
    expect(start).toContain("body: { companies },");
    expect(start).toContain('"x-run-id": globalThis.crypto.randomUUID()');
  });
});
