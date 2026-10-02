import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { installStaleChunkReload, isChunkLoadError, reloadOnceForStaleChunk } from "../src/lib/stale-chunk-reload";

const read = (p: string) => readFileSync(resolve(__dirname, "../../..", p), "utf8");

// PostHog 2026-09-30: `ChunkLoadError: Failed to load chunk /_next/static/chunks/0htqbfqy_b6bk.js
// from module 802177`, caught by the dashboard's global-error.tsx, which stayed on
// "Something went wrong".
const stale = Object.assign(new Error("Failed to load chunk /_next/static/chunks/0htqbfqy_b6bk.js from module 802177"), {
  name: "ChunkLoadError",
});

function harness() {
  const store = new Map<string, string>();
  const handlers: Record<string, (e: { reason?: unknown; error?: unknown }) => void> = {};
  const env = {
    sessionStorage: () => ({ getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }),
    location: { reload: vi.fn() },
    clock: 1_000_000,
    now: () => env.clock,
    addEventListener: (t: string, fn: (e: { reason?: unknown; error?: unknown }) => void) => void (handlers[t] = fn),
  };
  return { env, handlers };
}

describe("a chunk missing after a deploy", () => {
  it("is byte-equal to the landing's", () => {
    expect(read("apps/dashboard/src/lib/stale-chunk-reload.ts")).toBe(read("apps/landing/src/lib/stale-chunk-reload.ts"));
  });

  it("is recognised, and nothing else is", () => {
    expect(isChunkLoadError(stale)).toBe(true);
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: /_next/x.js"))).toBe(true);
    expect(isChunkLoadError(new Error("Failed to fetch"))).toBe(false);
    expect(isChunkLoadError(Object.assign(new Error("x"), { name: "UnrecognizedActionError" }))).toBe(false);
  });

  it("reloads the tab once, then not again within a minute", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { env } = harness();
    expect(reloadOnceForStaleChunk(env, stale)).toBe(true);
    env.clock += 10_000;
    expect(reloadOnceForStaleChunk(env, stale)).toBe(false);
    expect(env.location.reload).toHaveBeenCalledTimes(1);
    env.clock += 60_000;
    expect(reloadOnceForStaleChunk(env, stale)).toBe(true);
    expect(env.location.reload).toHaveBeenCalledTimes(2);
    err.mockRestore();
  });

  it("reloads on a chunk failure outside React, and ignores other failures", () => {
    const { env, handlers } = harness();
    installStaleChunkReload(env);
    handlers.unhandledrejection({ reason: new Error("Failed to fetch") });
    handlers.error({ error: new TypeError("x is undefined") });
    expect(env.location.reload).not.toHaveBeenCalled();
    handlers.error({ error: stale });
    expect(env.location.reload).toHaveBeenCalledTimes(1);
  });

  it("is installed by the client instrumentation", () => {
    expect(read("apps/dashboard/src/instrumentation-client.ts")).toContain("installStaleChunkReload({");
  });

  it.each(["apps/dashboard/src/app/global-error.tsx", "apps/dashboard/src/app/(authed)/v2/error.tsx"])(
    "%s reloads on a chunk error, after reporting it to PostHog",
    (p) => {
      const src = read(p);
      const report = src.indexOf("posthog.captureException(error");
      const reload = src.indexOf("if (isChunkLoadError(error)) reloadOnceForStaleChunk(browserChunkReloadEnv(), error);");
      expect(report).toBeGreaterThan(-1);
      expect(reload).toBeGreaterThan(report);
    },
  );
});
