import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { keepLastGoodFields } from "../src/lib/keep-last-good";

// keep-last-good = the cache-write-boundary merge that stops a valid-but-degenerate refetch
// (a non-null field flipping to null on a 200) from collapsing UI derived off it. See the
// module header + CLAUDE.md "keep-last-good (cache-write boundary)".

let errSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  errSpy.mockRestore();
});

describe("keepLastGoodFields", () => {
  it("returns next unchanged when there is no prev (first fetch)", () => {
    const next = { a: 1, b: null };
    expect(keepLastGoodFields(undefined, next, ["a", "b"])).toEqual(next);
    expect(errSpy).not.toHaveBeenCalled();
  });

  it("keeps prev value when next nulls a listed field (suppressed downgrade)", () => {
    const prev = { cpc: 42, name: "x" };
    const next = { cpc: null as number | null, name: "x" };
    const merged = keepLastGoodFields(prev, next, ["cpc"]);
    expect(merged.cpc).toBe(42);
    expect(errSpy).toHaveBeenCalledTimes(1); // fail-loud on the suppressed downgrade
  });

  it("takes next value when next provides a (different) non-null value — real updates win", () => {
    const prev = { cpc: 42 };
    const next = { cpc: 7 };
    expect(keepLastGoodFields(prev, next, ["cpc"]).cpc).toBe(7);
    expect(errSpy).not.toHaveBeenCalled();
  });

  it("does NOT touch fields outside the allowlist", () => {
    const prev = { cpc: 42, other: 9 };
    const next = { cpc: 1, other: null as number | null };
    const merged = keepLastGoodFields(prev, next, ["cpc"]);
    expect(merged.other).toBeNull(); // 'other' not listed → next wins even when null
  });

  it("treats undefined like null", () => {
    const prev = { cpc: 5 };
    const next = { cpc: undefined as number | undefined };
    expect(keepLastGoodFields(prev, next, ["cpc"]).cpc).toBe(5);
  });
});

