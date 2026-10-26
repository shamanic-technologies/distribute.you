import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { stageMove, stepRunningBefore } from "../src/lib/v2/get-started";

// 2026-10-26, pg@guimsit.com (Windows, clock 107s behind): both "Save my card and launch"
// clicks read the sign-in page instead of the API, and "Set up my campaign" did nothing
// for ~65s while the 100 companies were still being found.
const read = (p: string) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

describe("a session refused because the browser clock is behind", () => {
  it("apiCall mints a fresh token and tries once more on a 401", () => {
    const src = read("src/lib/api.ts");
    const at = src.indexOf("async function apiCall<T>");
    const body = src.slice(at, src.indexOf("\n}\n", at));
    expect(body).toContain("response.status === SESSION_REFUSED_STATUS) response = await send(true)");
    // The retry runs before the error is thrown.
    expect(body.indexOf("SESSION_REFUSED_STATUS")).toBeLessThan(body.indexOf("if (!response.ok)"));
  });

  it("an /api call without a session is answered 401 JSON, never redirected to the sign-in page", () => {
    const src = read("src/proxy.ts");
    const guard = src.indexOf("if (!isPublicRoute(req) && !userId)");
    const json = src.indexOf('NextResponse.json({ error: "Unauthorized" }, { status: 401 })', guard);
    const signIn = src.indexOf('new URL("/sign-in", req.url)', guard);
    expect(json).toBeGreaterThan(guard);
    expect(json).toBeLessThan(signIn);
    expect(src.slice(guard, json)).toContain("isApiRoute(req)");
  });

  it("the claim tries once more after a fresh token", () => {
    const src = read("src/components/v2/get-started/account-card-wall.tsx");
    const at = src.indexOf('let res = await fetch("/api/anon/claim"');
    expect(at).toBeGreaterThan(-1);
    const retry = src.slice(at, src.indexOf("if (!res.ok)", at));
    expect(retry).toContain("res.status === 401");
    expect(retry).toContain("getToken({ skipCache: true })");
  });
});

describe("the card form opens fast", () => {
  it("the monthly limit is saved while the card form is fetched, not before it", () => {
    const src = read("src/components/v2/get-started/account-card-wall.tsx");
    expect(src).toContain("Promise.all([createEmbeddedCardSetup(), firstSaved])");
    const at = src.indexOf("function startPostpaid()");
    const body = src.slice(at, src.indexOf("async function afterPostpaidCardSaved", at));
    expect(body).not.toContain("await saveMonthlyLimit(");
    expect(body).toContain("openCardSave(() => void afterPostpaidCardSaved(), limitSaved)");
  });
});

describe("Set up my campaign while the companies are still being found", () => {
  it("knows a step before the campaign is running", () => {
    expect(stepRunningBefore(["done", "running", "waiting"], 2)).toBe(true);
    expect(stepRunningBefore(["done", "done", "choose"], 2)).toBe(false);
    expect(stepRunningBefore(["done", "done", "running"], 2)).toBe(false);
    // The same condition makes the stage walk back, which is why the press is held.
    expect(stageMove(["done", "running", "choose"], 2)).toEqual({ to: 1, dwell: false });
  });

  it("holds the press, says so on the button, and opens the campaign once it settles", () => {
    const src = read("src/components/v2/get-started/get-started.tsx");
    const at = src.indexOf("function openCampaign()");
    const body = src.slice(at, src.indexOf("function changeCampaign", at));
    expect(body).toContain("setCampaignAsked(true)");
    expect(body.indexOf("setCampaignAsked(true)")).toBeLessThan(body.indexOf("setStageIdx("));
    expect(src).toContain('{campaignAsked ? "Finding your companies..." : "Set up my campaign"}');
    expect(src).toContain('if (campaignAsked && !stepRunningBefore(phases, stepIndex("campaign"))) openCampaign();');
  });
});
