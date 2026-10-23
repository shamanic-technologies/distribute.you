import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createLiveMemory } from "../src/lib/research/live-cache";

// RESEARCH-INSTANT-1023 (owner 2026-10-23, « les rendre instantanées »): the Research route answers
// from a short memory, and the browser paints the billed-basis file and Performance from disk.

const SRC = join(__dirname, "..", "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

function clock() {
  let t = 0;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("the Research route's memory", () => {
  it("serves a fresh entry without reading again", async () => {
    const c = clock();
    const m = createLiveMemory({ freshMs: 60, maxAgeMs: 300, now: c.now });
    const load = vi.fn().mockResolvedValue("v1");
    expect(await m.read("k", load)).toBe("v1");
    c.advance(59);
    expect(await m.read("k", load)).toBe("v1");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("serves a stale entry at once and re-reads it in the background", async () => {
    const c = clock();
    const m = createLiveMemory({ freshMs: 60, maxAgeMs: 300, now: c.now });
    const load = vi.fn().mockResolvedValueOnce("v1").mockResolvedValueOnce("v2");
    await m.read("k", load);
    c.advance(100);
    expect(await m.read("k", load)).toBe("v1");
    await flush();
    expect(load).toHaveBeenCalledTimes(2);
    expect(await m.read("k", load)).toBe("v2");
  });

  it("never serves an entry past its max age: the request waits on the live read and its failure", async () => {
    const c = clock();
    const m = createLiveMemory({ freshMs: 60, maxAgeMs: 300, now: c.now });
    await m.read("k", vi.fn().mockResolvedValue("v1"));
    c.advance(300);
    await expect(m.read("k", vi.fn().mockRejectedValue(new Error("down")))).rejects.toThrow("down");
  });

  it("a failed background re-read drops the entry, so the next request shows the failure", async () => {
    const c = clock();
    const m = createLiveMemory({ freshMs: 60, maxAgeMs: 300, now: c.now });
    await m.read("k", vi.fn().mockResolvedValue("v1"));
    c.advance(100);
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = vi.fn().mockRejectedValue(new Error("down"));
    expect(await m.read("k", failing)).toBe("v1");
    await flush();
    await expect(m.read("k", failing)).rejects.toThrow("down");
    err.mockRestore();
  });

  it("concurrent callers share one live read", async () => {
    const m = createLiveMemory();
    const load = vi.fn().mockResolvedValue("v");
    await Promise.all([m.read("k", load), m.read("k", load), m.read("k", load)]);
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe("the route reads every part through the memory", () => {
  const route = read("app/(authed)/api/research/[basis]/[part]/route.ts");
  it("file, catalog, performance and texts", () => {
    for (const k of ["`${b}/file`", "`${b}/catalog`", "`${b}/performance`", '"texts"']) expect(route).toContain(`memory.read(${k}`);
  });
});

describe("the browser paints Research from disk on the billed basis only", () => {
  const persist = read("lib/persist-cache.ts");
  const sensitive = persist.slice(persist.indexOf("export const SENSITIVE_QUERY_ROOTS"), persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
  const persistable = persist.slice(persist.indexOf("export const PERSISTABLE_QUERY_ROOTS"));
  const source = read("lib/research/research-source.tsx");
  it("billed roots persisted, actual roots never", () => {
    for (const root of ["researchFile", "researchPerformance"]) {
      expect(persistable).toContain(`"${root}",`);
      expect(sensitive).not.toContain(`"${root}",`);
    }
    for (const root of ["researchFileActual", "researchPerformanceActual"]) expect(sensitive).toContain(`"${root}",`);
    expect(source).toContain('basis === "actual" ? ["researchFileActual"]');
    expect(source).toContain('basis === "actual" ? ["researchPerformanceActual"]');
  });
  it("the file is re-read after a restore (no infinite staleTime) and the hub prefetches Performance and texts", () => {
    const fileQuery = source.slice(source.indexOf("function researchFileQuery("), source.indexOf("function researchPerformanceQuery("));
    expect(fileQuery).not.toContain("ONCE");
    expect(fileQuery).not.toContain("Infinity");
    expect(source).toContain("prefetchQuery(researchPerformanceQuery(basis))");
    expect(source).toContain("prefetchQuery(TEXTS_QUERY)");
  });
});
