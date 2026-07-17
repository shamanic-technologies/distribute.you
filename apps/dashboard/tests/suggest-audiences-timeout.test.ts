import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The onboarding audience step's loaders clear only when the suggest call SETTLES
// (the prewarm `.finally`, `runSuggest`'s `finally`). A backend 502/partial failure
// that HANGS never settles, leaving an eternal "Generating…" / "Drafting…" spinner.
// Bounding the request with `withTimeout` turns a hang into a rejection so the
// existing catch/finally always clears the loader. Guard the wiring so a refactor
// can't silently drop the bound and re-introduce the infinite spinner.
const src = fs.readFileSync(
  path.join(__dirname, "..", "src", "lib", "api.ts"),
  "utf8",
);

describe("suggest calls are time-bounded (no infinite onboarding spinner)", () => {
  it("wraps suggestAudiences' request in withTimeout", () => {
    const body = src.slice(src.indexOf("export async function suggestAudiences"));
    const fnBody = body.slice(0, body.indexOf("\n}"));
    expect(fnBody).toMatch(/withTimeout\(/);
    expect(fnBody).toContain("SUGGEST_TIMEOUT_MS");
  });

  it("wraps suggestBrandIcp' request in withTimeout (prewarm awaits it first)", () => {
    const body = src.slice(src.indexOf("export async function suggestBrandIcp"));
    const fnBody = body.slice(0, body.indexOf("\n}"));
    expect(fnBody).toMatch(/withTimeout\(/);
    expect(fnBody).toContain("SUGGEST_TIMEOUT_MS");
  });

  it("defines a finite suggest timeout", () => {
    expect(src).toMatch(/const SUGGEST_TIMEOUT_MS = \d[\d_]*;/);
  });
});
