import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  DESKTOP_CONNECT_STORAGE_KEY,
  DESKTOP_CONNECT_TTL_MS,
  desktopCallbackUrl,
  parkDesktopConnect,
  parseDesktopConnect,
  readParkedDesktopConnect,
} from "../src/lib/desktop-connect";

const STATE = "abcDEF123_-abcDEF123";

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    raw: m,
  };
}

describe("desktop connect protocol", () => {
  it("accepts an unprivileged port and an opaque state only", () => {
    expect(parseDesktopConnect("53682", STATE)).toEqual({ port: 53682, state: STATE });
    expect(parseDesktopConnect("80", STATE)).toBeNull();
    expect(parseDesktopConnect("70000", STATE)).toBeNull();
    expect(parseDesktopConnect("53682", "short")).toBeNull();
    expect(parseDesktopConnect("53682", "evil.com/x?y=1&z=2zzzzzzzz")).toBeNull();
    expect(parseDesktopConnect(null, STATE)).toBeNull();
  });

  it("hands the key to 127.0.0.1 only, never a caller-supplied host", () => {
    const url = new URL(desktopCallbackUrl({ port: 53682, state: STATE }, "distrib.usr_x"));
    expect(url.origin).toBe("http://127.0.0.1:53682");
    expect(url.pathname).toBe("/callback");
    expect(url.searchParams.get("state")).toBe(STATE);
    expect(url.searchParams.get("key")).toBe("distrib.usr_x");
  });

  it("parks the request across a sign-in hop and drops it once stale", () => {
    const s = memoryStorage();
    parkDesktopConnect(s, { port: 53682, state: STATE }, 1_000);
    expect(readParkedDesktopConnect(s, 1_000 + 60_000)).toEqual({ port: 53682, state: STATE });
    expect(readParkedDesktopConnect(s, 1_000 + DESKTOP_CONNECT_TTL_MS + 1)).toBeNull();
    expect(s.raw.has(DESKTOP_CONNECT_STORAGE_KEY)).toBe(false);
  });
});

describe("desktop connect wiring", () => {
  const read = (p: string) => readFileSync(path.resolve(__dirname, "..", p), "utf8");

  it("is a public EXACT route, so the first-run gate cannot loop it through onboarding", () => {
    expect(read("src/proxy.ts")).toContain('  "/desktop/connect",\n');
  });

  it("resumes a parked request from every authed page", () => {
    const layout = read("src/app/(authed)/layout.tsx");
    expect(layout).toContain("<DesktopConnectResume />");
  });

  it("signs in with the dashboard's Google and email, then mints a key named for the app", () => {
    const page = read("src/app/(authed)/desktop/connect/desktop-connect.tsx");
    expect(page).toContain('strategy: "oauth_google"');
    expect(page).toContain("redirectUrlComplete: DESKTOP_CONNECT_PATH");
    expect(page).toContain('href="/sign-in"');
    expect(page).toContain("createApiKey(DESKTOP_KEY_NAME)");
    expect(page).toContain("treatPendingAsSignedOut: false");
  });
});
