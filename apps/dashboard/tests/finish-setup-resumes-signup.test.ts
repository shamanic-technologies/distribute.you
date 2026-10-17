import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// "Finish setup" on a brand whose signup walk stopped at the wall (paid, never launched:
// CeXO AI 2026-10-17) resumes that walk and opens Launch, instead of re-walking from screen 1.
const src = readFileSync(join(__dirname, "../src/components/v2/get-started/get-started.tsx"), "utf8");

describe("Finish setup resumes the signup walk", () => {
  it("falls back to the signup snapshot of the same brand", () => {
    const at = src.indexOf("const resume = fits ? snap");
    expect(at).toBeGreaterThan(-1);
    const block = src.slice(at, src.indexOf("void startExisting(org.brandId)", at));
    expect(block).toContain("signupSnapshotFor(org.brandId)");
    expect(block).toContain("if (resume.campaignDone) setWallOpen(true)");
  });

  it("reads the signup key, only for that brand", () => {
    const at = src.indexOf("function signupSnapshotFor(");
    const body = src.slice(at, src.indexOf("function initialSteps(", at));
    expect(body).toContain("localStorage.getItem(GET_STARTED_SNAPSHOT_KEY)");
    expect(body).toContain("snap.brandId !== brandId");
  });
});
