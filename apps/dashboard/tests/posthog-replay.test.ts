import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { HEADLESS_SCANNER_JS, looksLikeHeadlessScanner, type ScreenEnv } from "../src/lib/posthog-replay";

// Email-link scanners were 86% of recorded sessions and burned the free replay quota.
// This suite gates CI for both apps: the twins stay byte-equal, every PostHog init skips
// the scanners' replays, and the TS predicate and the inline snippet agree both ways.
const read = (p: string) => readFileSync(resolve(__dirname, "../../..", p), "utf8");

const WIN_CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const MAC_SAFARI = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

const env = (over: Partial<ScreenEnv>): ScreenEnv => ({
  userAgent: WIN_CHROME,
  webdriver: false,
  maxTouchPoints: 0,
  screenWidth: 1920,
  screenHeight: 1080,
  innerWidth: 1920,
  innerHeight: 937,
  ...over,
});

// Runs the inline snippet against a fake browser, the way the static landing pages run it.
function runSnippet(e: ScreenEnv): boolean {
  const fn = new Function("navigator", "window", `return ${HEADLESS_SCANNER_JS};`);
  return fn(
    { userAgent: e.userAgent, webdriver: e.webdriver, maxTouchPoints: e.maxTouchPoints },
    { screen: { width: e.screenWidth, height: e.screenHeight }, innerWidth: e.innerWidth, innerHeight: e.innerHeight },
  );
}

const SCANNERS: [string, ScreenEnv][] = [
  ["a headless Edge whose window is the whole screen", env({ innerHeight: 1080 })],
  ["an automated browser announcing itself", env({ webdriver: true })],
];
const HUMANS: [string, ScreenEnv][] = [
  ["a desktop window with browser chrome", env({})],
  ["a desktop window as wide as the screen but shorter", env({ innerWidth: 1920, innerHeight: 970 })],
  ["a phone (no chrome in some views)", env({ userAgent: IPHONE, maxTouchPoints: 5, screenWidth: 390, screenHeight: 844, innerWidth: 390, innerHeight: 844 })],
  ["an iPad that reports a Mac user agent", env({ userAgent: MAC_SAFARI, maxTouchPoints: 5, screenWidth: 1024, screenHeight: 1366, innerWidth: 1024, innerHeight: 1366 })],
];

describe("PostHog replay skips email-link scanners", () => {
  it("is byte-equal to the landing's", () => {
    expect(read("apps/dashboard/src/lib/posthog-replay.ts")).toBe(read("apps/landing/src/lib/posthog-replay.ts"));
  });

  it.each(SCANNERS)("skips %s (TS and inline snippet)", (_, e) => {
    expect(looksLikeHeadlessScanner(e)).toBe(true);
    expect(runSnippet(e)).toBe(true);
  });

  it.each(HUMANS)("records %s (TS and inline snippet)", (_, e) => {
    expect(looksLikeHeadlessScanner(e)).toBe(false);
    expect(runSnippet(e)).toBe(false);
  });

  it.each(["dashboard", "landing"])("%s wires it into posthog.init", (app) => {
    expect(read(`apps/${app}/src/instrumentation-client.ts`)).toContain(
      "disable_session_recording: looksLikeHeadlessScanner(browserScreenEnv()),",
    );
  });

  it("the static landing pages' snippet wires it too", () => {
    expect(read("apps/landing/src/lib/static-html.ts")).toContain("disable_session_recording:${HEADLESS_SCANNER_JS}");
  });

  it("the staff-only admin console records no replay", () => {
    expect(read("apps/admin/src/instrumentation-client.ts")).toContain("disable_session_recording: true,");
  });

  it("the dashboard stops recording once a staff account is identified", () => {
    const src = read("apps/dashboard/src/components/posthog-auth-tracker.tsx");
    expect(src).toContain("if (isStaffEmail(email)) posthog.stopSessionRecording();");
  });
});
