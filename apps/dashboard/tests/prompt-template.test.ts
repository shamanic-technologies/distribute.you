import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  extractTemplateVariableNames,
  checkVariableIntegrity,
  variableIntegrityMessage,
} from "../src/lib/prompt-template";

describe("prompt-template variable parsing + integrity", () => {
  it("extracts distinct variable names, tolerating whitespace", () => {
    const names = extractTemplateVariableNames(
      "Hi {{brand}}, re {{ request }} — see {{brand}} again {{additionalContext}}",
    );
    expect(names.sort()).toEqual(["additionalContext", "brand", "request"]);
  });

  it("ok when edited text references exactly the declared set", () => {
    const r = checkVariableIntegrity(
      "{{brand}} {{request}} {{additionalContext}}",
      ["brand", "request", "additionalContext"],
    );
    expect(r).toEqual({ ok: true, missing: [], extra: [] });
  });

  it("flags a dropped variable as missing", () => {
    const r = checkVariableIntegrity("{{brand}} {{request}}", [
      "brand",
      "request",
      "additionalContext",
    ]);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(["additionalContext"]);
    expect(r.extra).toEqual([]);
  });

  it("flags an added variable as extra", () => {
    const r = checkVariableIntegrity(
      "{{brand}} {{request}} {{additionalContext}} {{foo}}",
      ["brand", "request", "additionalContext"],
    );
    expect(r.ok).toBe(false);
    expect(r.extra).toEqual(["foo"]);
  });

  it("treats a rename as one missing + one extra", () => {
    const r = checkVariableIntegrity("{{brand}} {{req}} {{additionalContext}}", [
      "brand",
      "request",
      "additionalContext",
    ]);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(["request"]);
    expect(r.extra).toEqual(["req"]);
  });

  it("builds an explicit message naming the offending variables, null when ok", () => {
    expect(variableIntegrityMessage({ ok: true, missing: [], extra: [] })).toBeNull();
    const msg = variableIntegrityMessage({
      ok: false,
      missing: ["request"],
      extra: ["req"],
    });
    expect(msg).toContain("{{request}}");
    expect(msg).toContain("{{req}}");
  });
});

describe("prompt-assignment data layer + UI wiring (source contract)", () => {
  const read = (rel: string) =>
    fs.readFileSync(path.join(__dirname, rel), "utf-8");

  it("api.ts exposes getPromptAssignment (GET + safeParse) and savePromptAssignment (PUT)", () => {
    const api = read("../src/lib/api.ts");
    expect(api).toContain("export async function getPromptAssignment");
    expect(api).toContain("export async function savePromptAssignment");
    expect(api).toContain("/content/prompt-assignments");
    // GET wrapper guards the wire shape (DIS-74 rule).
    expect(api).toContain("PromptAssignmentSchema");
    expect(api).toContain("safeParse");
    const saveStart = api.indexOf("export async function savePromptAssignment");
    const saveBlock = api.slice(saveStart, saveStart + 600);
    expect(saveBlock).toContain('method: "PUT"');
  });

  // The campaign-prompt-panel + the campaign-sidebar Prompt button were removed
  // with the campaign concept (the per-campaign Prompt slide-over lived on the
  // deleted campaign sidebar). The api.ts prompt-assignment data layer above is
  // the surviving contract.
});
