import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { keepLastGoodFields, keepLastGoodList } from "../src/lib/keep-last-good";

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

describe("keepLastGoodList", () => {
  const keyFn = (w: { slug: string; cpc: number | null }) => w.slug;

  it("returns a copy of next when prev is empty/undefined", () => {
    const next = [{ slug: "a", cpc: 1 }];
    expect(keepLastGoodList(undefined, next, { keyFn, fields: ["cpc"] })).toEqual(next);
    expect(keepLastGoodList([], next, { keyFn, fields: ["cpc"] })).toEqual(next);
  });

  it("per-item coalesces a nulled field against the matching prev item", () => {
    const prev = [{ slug: "a", cpc: 10 }, { slug: "b", cpc: 20 }];
    const next = [{ slug: "a", cpc: null }, { slug: "b", cpc: 25 }];
    const merged = keepLastGoodList(prev, next, { keyFn, fields: ["cpc"] });
    expect(merged.find((w) => w.slug === "a")?.cpc).toBe(10); // kept last-good
    expect(merged.find((w) => w.slug === "b")?.cpc).toBe(25); // real update wins
  });

  it("retains a prev item that vanished from next (transient empty payload)", () => {
    const prev = [{ slug: "a", cpc: 10 }, { slug: "b", cpc: 20 }];
    const next = [{ slug: "a", cpc: 11 }]; // 'b' dropped on this refetch
    const merged = keepLastGoodList(prev, next, { keyFn, fields: ["cpc"] });
    expect(merged.map((w) => w.slug).sort()).toEqual(["a", "b"]);
    expect(merged.find((w) => w.slug === "b")?.cpc).toBe(20); // last-good retained
    expect(errSpy).toHaveBeenCalled(); // fail-loud on the vanished item
  });

  it("adds a genuinely-new item from next", () => {
    const prev = [{ slug: "a", cpc: 10 }];
    const next = [{ slug: "a", cpc: 10 }, { slug: "c", cpc: 30 }];
    const merged = keepLastGoodList(prev, next, { keyFn, fields: ["cpc"] });
    expect(merged.map((w) => w.slug).sort()).toEqual(["a", "c"]);
  });
});
