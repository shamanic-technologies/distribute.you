import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { suggestAudiences, suggestBrandIcp, ApiError, SUGGEST_TIMEOUT_MS } from "../src/lib/api";

// The onboarding audience step (and its background prewarm) await suggestAudiences /
// suggestBrandIcp behind a spinner. A backend HANG left the promise pending forever
// → the loader spun with no error/finally ever firing. apiCall now bounds these with
// AbortSignal.timeout and translates the abort into a caught 408 ApiError, so the
// loader's catch/finally always runs (error shown, spinner cleared).
describe("suggest calls are client-timeout bounded", () => {
  const realFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    global.fetch = realFetch;
  });

  it("exposes a ~2min suggest timeout", () => {
    expect(SUGGEST_TIMEOUT_MS).toBe(120_000);
  });

  it("translates a fetch abort/timeout into a 408 ApiError (never a hang)", async () => {
    global.fetch = vi.fn(async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    }) as unknown as typeof fetch;

    await expect(suggestAudiences("brand_1", "heads of marketing")).rejects.toMatchObject({
      status: 408,
    });
    await expect(suggestAudiences("brand_1", "heads of marketing")).rejects.toBeInstanceOf(ApiError);
  });

  it("also bounds the ICP suggest (the prewarm chains ICP -> audiences)", async () => {
    global.fetch = vi.fn(async () => {
      throw new DOMException("Aborted", "AbortError");
    }) as unknown as typeof fetch;

    await expect(suggestBrandIcp("brand_1")).rejects.toMatchObject({ status: 408 });
  });

  it("passes SUGGEST_TIMEOUT_MS on both suggest calls (source guard)", () => {
    const src = fs.readFileSync(path.join(__dirname, "../src/lib/api.ts"), "utf-8");
    // Both suggest endpoints send timeoutMs so a hang can't outlive the bound.
    expect(src).toMatch(/audiences\/suggest[\s\S]{0,200}timeoutMs: SUGGEST_TIMEOUT_MS/);
    expect(src).toMatch(/icp\/suggest[\s\S]{0,200}timeoutMs: SUGGEST_TIMEOUT_MS/);
    // apiCall wires the option into an AbortSignal.timeout.
    expect(src).toContain("AbortSignal.timeout(timeoutMs)");
  });
});
