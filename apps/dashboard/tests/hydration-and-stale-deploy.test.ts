import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { installStaleServerActionReload, isStaleServerActionError } from "../src/lib/stale-server-action";

const read = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

// PostHog 2026-10-01: `UnrecognizedActionError: Server Action "00…" was not found on the
// server` from tabs opened before a deploy, and React #418 on v2 Today.
describe("stale Server Action after a deploy", () => {
  const stale = Object.assign(
    new Error('Server Action "007ecf111a0f937baa400a53119d8f2b13e3fb03ca" was not found on the server. \nRead more: https://nextjs.org/docs/messages/failed-to-find-server-action'),
    { name: "UnrecognizedActionError" },
  );

  it("recognises Next's error by name or by message", () => {
    expect(isStaleServerActionError(stale)).toBe(true);
    expect(isStaleServerActionError(new Error(stale.message))).toBe(true);
    expect(isStaleServerActionError(new Error("Failed to fetch"))).toBe(false);
    expect(isStaleServerActionError("Server Action")).toBe(false);
    expect(isStaleServerActionError(undefined)).toBe(false);
  });

  function harness(startAt = 1_000_000) {
    let handler: (e: { reason?: unknown }) => void = () => {};
    const store = new Map<string, string>();
    const env = {
      addEventListener: (_: "unhandledrejection", fn: typeof handler) => {
        handler = fn;
      },
      sessionStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) },
      location: { reload: vi.fn() },
      clock: startAt,
      now: () => env.clock,
    };
    installStaleServerActionReload(env);
    return { env, fire: (reason: unknown) => handler({ reason }) };
  }

  it("reloads the tab once, and not again within a minute", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { env, fire } = harness();
    fire(stale);
    expect(env.location.reload).toHaveBeenCalledTimes(1);
    env.clock += 5_000;
    fire(stale);
    expect(env.location.reload).toHaveBeenCalledTimes(1);
    expect(err).toHaveBeenCalled();
    env.clock += 60_000;
    fire(stale);
    expect(env.location.reload).toHaveBeenCalledTimes(2);
    err.mockRestore();
  });

  it("ignores every other rejection", () => {
    const { env, fire } = harness();
    fire(new Error("Failed to fetch"));
    fire("Error: loading script");
    expect(env.location.reload).not.toHaveBeenCalled();
  });

  it("is installed by the dashboard's client instrumentation", () => {
    expect(read("src/instrumentation-client.ts")).toContain("installStaleServerActionReload({");
  });
});

describe("v2 Today prints the clock only after mount", () => {
  const src = read("src/components/v2/today-page.tsx");
  it("greeting, date and time read useClientClock, not the render-time Date", () => {
    expect(src).toContain("const clock = useClientClock();");
    expect(src).toContain("clock ? greeting(clock)");
    expect(src).toContain('clock?.toLocaleDateString("en-US"');
    expect(src).toContain('clock?.toLocaleTimeString("en-US"');
    expect(src).not.toContain("greeting(now)");
    expect(src).not.toContain("now.toLocaleDateString");
    expect(src).not.toContain("now.toLocaleTimeString");
  });
  it("the hook sets the date in an effect, so the server render has none", () => {
    const hook = read("src/lib/use-client-clock.ts");
    expect(hook).toContain("useState<Date | null>(null)");
    expect(hook).toContain("setNow(new Date())");
  });
});
