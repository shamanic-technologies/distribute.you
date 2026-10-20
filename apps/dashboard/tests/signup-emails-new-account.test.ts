import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LAUNCH_OUTCOME_NOUN,
  NEW_ACCOUNT_WINDOW_MS,
  isGetStartedPath,
  isNewAccount,
  signupEmailsSentKey,
} from "../src/lib/new-account";

const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// GET-STARTED-NO-WELCOME-EMAIL-1020: the signup emails fired only behind a flag the
// /sign-up page set, so no /get-started signup got a welcome, and the launch email
// left with the v1 wizard (#4998).
describe("isNewAccount", () => {
  const now = Date.parse("2026-10-20T18:12:00Z");

  it("is true for an account made seconds ago, as a Date or a number", () => {
    expect(isNewAccount(new Date("2026-10-20T18:11:00Z"), now)).toBe(true);
    expect(isNewAccount(now - 5_000, now)).toBe(true);
    expect(isNewAccount(now - NEW_ACCOUNT_WINDOW_MS, now)).toBe(true);
  });

  it("is false for an account older than the window (no resend to past signups)", () => {
    expect(isNewAccount(now - NEW_ACCOUNT_WINDOW_MS - 1, now)).toBe(false);
    expect(isNewAccount(new Date("2026-10-07T09:00:00Z"), now)).toBe(false);
  });

  it("is false without a creation date, or one in the future", () => {
    expect(isNewAccount(null, now)).toBe(false);
    expect(isNewAccount(undefined, now)).toBe(false);
    expect(isNewAccount(new Date("invalid"), now)).toBe(false);
    expect(isNewAccount(now + 60_000, now)).toBe(false);
  });
});

describe("isGetStartedPath", () => {
  it("matches the wall, not a page that merely starts with the same letters", () => {
    expect(isGetStartedPath("/get-started")).toBe(true);
    expect(isGetStartedPath("/get-started/x")).toBe(true);
    expect(isGetStartedPath("/get-started-old")).toBe(false);
    expect(isGetStartedPath("/v2/orgs/org_1")).toBe(false);
  });
});

describe("signupEmailsSentKey", () => {
  it("is per user", () => {
    expect(signupEmailsSentKey("user_a")).not.toBe(signupEmailsSentKey("user_b"));
  });
});

describe("the signup emails", () => {
  const lib = src("src/lib/signup-emails.ts");

  it("send signup_notification and welcome, only for a new account", () => {
    expect(lib).toContain('sendAuthNotification("signup_notification"');
    expect(lib).toContain('sendAuthNotification("welcome")');
    expect(lib.indexOf("if (!isNewAccount(p.createdAt))")).toBeLessThan(lib.indexOf('sendAuthNotification("welcome")'));
  });

  it("latch only once the sends succeeded", () => {
    expect(lib.indexOf("await Promise.all(")).toBeLessThan(lib.indexOf('localStorage.setItem(key, "1")'));
  });

  it("are sent by the /get-started wall right after its claim", () => {
    const wall = src("src/components/v2/get-started/account-card-wall.tsx");
    const claimed = wall.indexOf('posthog.capture("get_started_claimed");');
    const send = wall.indexOf("sendSignupEmailsOnce({ userId: me.id, createdAt: me.createdAt })");
    expect(claimed).toBeGreaterThan(-1);
    expect(send).toBeGreaterThan(claimed);
  });
});

describe("the launch email", () => {
  it("is goal_launched, the template the dashboard registers", () => {
    expect(src("src/lib/signup-emails.ts")).toContain('sendAuthNotification("goal_launched", undefined, { outcomeNoun: LAUNCH_OUTCOME_NOUN })');
    expect(src("src/instrumentation.ts")).toContain('name: "goal_launched"');
    expect(LAUNCH_OUTCOME_NOUN).toBe("sales meetings");
  });

  it("is sent on both launch paths, after the launch and before the page changes", () => {
    for (const f of ["src/components/v2/get-started/account-card-wall.tsx", "src/components/v2/get-started/org-launch.tsx"]) {
      const s = src(f);
      const launched = s.indexOf("await launchFromPreview(");
      const send = s.indexOf("await sendLaunchEmail()");
      const leave = s.indexOf("window.location.assign(v2CampaignHref(");
      expect(launched).toBeGreaterThan(-1);
      expect(send).toBeGreaterThan(launched);
      expect(leave).toBeGreaterThan(send);
    }
  });
});

describe("PostHog signup tracking", () => {
  it("counts a new account as a signup, not only the /sign-up flag", () => {
    const t = src("src/components/posthog-auth-tracker.tsx");
    expect(t).toContain('=== "signup" || newAccount ? "signup" : "signin"');
    expect(t).toContain("isGetStartedPath(window.location.pathname)");
  });
});
