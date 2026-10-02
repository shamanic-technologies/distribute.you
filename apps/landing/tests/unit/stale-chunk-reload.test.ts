import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { installStaleChunkReload, isChunkLoadError, reloadOnceForStaleChunk } from "@/lib/stale-chunk-reload";

const read = (p: string) => readFileSync(resolve(__dirname, "../..", p), "utf8");

// PostHog 2026-10-01: three ChunkLoadErrors on /blog/flash-vs-pro-llm-cold-email, each
// caught by global-error.tsx, which then showed "Something went wrong" for good.
const turbopack = Object.assign(new Error("Failed to load chunk /_next/static/chunks/15ffn.klp0~6y.js from module 656877"), {
  name: "ChunkLoadError",
});

function harness(startAt = 1_000_000) {
  const store = new Map<string, string>();
  const env = {
    sessionStorage: () => ({ getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }),
    location: { reload: vi.fn() },
    clock: startAt,
    now: () => env.clock,
  };
  return env;
}

describe("isChunkLoadError", () => {
  it("recognises every browser's chunk and dynamic-import failure", () => {
    expect(isChunkLoadError(turbopack)).toBe(true);
    expect(isChunkLoadError(new Error(turbopack.message))).toBe(true);
    expect(isChunkLoadError(Object.assign(new Error("Loading chunk 4821 failed."), { name: "ChunkLoadError" }))).toBe(true);
    expect(isChunkLoadError(new Error("Loading CSS chunk 12 failed."))).toBe(true);
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: https://distribute.you/_next/x.js"))).toBe(true);
    expect(isChunkLoadError(new TypeError("error loading dynamically imported module"))).toBe(true);
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
  });
  it("leaves every other error to the normal error page", () => {
    expect(isChunkLoadError(new TypeError("x.map is not a function"))).toBe(false);
    expect(isChunkLoadError(new Error("Failed to fetch"))).toBe(false);
    expect(isChunkLoadError(new Error("We failed to load chunk of data"))).toBe(false);
    expect(isChunkLoadError("Failed to load chunk /x.js")).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe("reloadOnceForStaleChunk", () => {
  it("reloads once, not again within a minute, and again after", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const env = harness();
    expect(reloadOnceForStaleChunk(env, turbopack)).toBe(true);
    env.clock += 5_000;
    expect(reloadOnceForStaleChunk(env, turbopack)).toBe(false);
    expect(env.location.reload).toHaveBeenCalledTimes(1);
    expect(err).toHaveBeenCalled();
    env.clock += 60_000;
    expect(reloadOnceForStaleChunk(env, turbopack)).toBe(true);
    expect(env.location.reload).toHaveBeenCalledTimes(2);
    err.mockRestore();
  });
  it("does not reload when sessionStorage is blocked, since nothing could stop a loop", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const env = {
      ...harness(),
      sessionStorage: () => {
        throw new DOMException("denied", "SecurityError");
      },
    };
    expect(reloadOnceForStaleChunk(env, turbopack)).toBe(false);
    expect(env.location.reload).not.toHaveBeenCalled();
    err.mockRestore();
  });
});

describe("installStaleChunkReload", () => {
  function listening() {
    const handlers: Record<string, (e: { reason?: unknown; error?: unknown }) => void> = {};
    const env = { ...harness(), addEventListener: (t: string, fn: (e: { reason?: unknown; error?: unknown }) => void) => void (handlers[t] = fn) };
    installStaleChunkReload(env);
    return { env, handlers };
  }
  it("reloads on a chunk failure thrown or rejected outside React", () => {
    const a = listening();
    a.handlers.unhandledrejection({ reason: turbopack });
    expect(a.env.location.reload).toHaveBeenCalledTimes(1);
    const b = listening();
    b.handlers.error({ error: turbopack });
    expect(b.env.location.reload).toHaveBeenCalledTimes(1);
  });
  it("ignores every other failure", () => {
    const { env, handlers } = listening();
    handlers.unhandledrejection({ reason: new Error("Failed to fetch") });
    handlers.error({ error: new TypeError("x is undefined") });
    expect(env.location.reload).not.toHaveBeenCalled();
  });
});

describe("the landing wires it", () => {
  it("in the client instrumentation, for failures outside React", () => {
    expect(read("src/instrumentation-client.ts")).toContain("installStaleChunkReload({");
  });
  it("in global-error.tsx, after reporting the error to PostHog", () => {
    const src = read("src/app/global-error.tsx");
    const report = src.indexOf("posthog.captureException(error");
    const reload = src.indexOf("if (isChunkLoadError(error)) reloadOnceForStaleChunk(browserChunkReloadEnv(), error);");
    expect(report).toBeGreaterThan(-1);
    expect(reload).toBeGreaterThan(report);
  });
});
