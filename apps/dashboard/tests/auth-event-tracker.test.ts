import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const trackerPath = path.resolve(
  __dirname,
  "../src/components/auth-event-tracker.tsx"
);
const signUpPath = path.resolve(
  __dirname,
  "../src/app/sign-up/[[...sign-up]]/page.tsx"
);
const layoutPath = path.resolve(
  __dirname,
  "../src/app/(dashboard)/layout.tsx"
);
const apiPath = path.resolve(__dirname, "../src/lib/api.ts");

describe("AuthEventTracker component", () => {
  const content = fs.readFileSync(trackerPath, "utf-8");

  it("should exist", () => {
    expect(fs.existsSync(trackerPath)).toBe(true);
  });

  it("should use Clerk useAuth hook", () => {
    expect(content).toContain("useAuth");
    expect(content).toContain("isSignedIn");
  });

  it("should fire only once per visit (hasFired ref)", () => {
    expect(content).toContain("hasFired");
    expect(content).toContain("useRef(false)");
  });

  it("should check sessionStorage for signup intent", () => {
    expect(content).toContain("distribute_auth_intent");
    expect(content).toContain('sessionStorage.getItem');
  });

  it("should send signup_notification when signup intent is present", () => {
    expect(content).toContain("signup_notification");
    expect(content).toContain("sendAuthNotification");
  });

  it("should remove signup intent flag after firing", () => {
    expect(content).toContain("sessionStorage.removeItem");
  });

  it("should send signin_notification as fallback", () => {
    expect(content).toContain("signin_notification");
  });

  it("should dedup signin per browser session via sessionStorage", () => {
    expect(content).toContain("distribute_signin_tracked");
    expect(content).toContain("sessionStorage.setItem");
  });

  it("should be best-effort (catch errors silently)", () => {
    expect(content).toContain(".catch(");
  });

  it("should read and forward promo code from sessionStorage on signup", () => {
    expect(content).toContain("distribute_promo_code");
    expect(content).toContain("promoCode");
  });
});

describe("Sign-up page sets auth intent flag", () => {
  const content = fs.readFileSync(signUpPath, "utf-8");

  it("should set sessionStorage distribute_auth_intent before OAuth redirect", () => {
    expect(content).toContain('sessionStorage.setItem("distribute_auth_intent"');
    // The flag must be set BEFORE authenticateWithRedirect
    const flagIndex = content.indexOf("distribute_auth_intent");
    const redirectIndex = content.indexOf("authenticateWithRedirect");
    expect(flagIndex).toBeLessThan(redirectIndex);
  });
});

describe("sendAuthNotification in api.ts", () => {
  const content = fs.readFileSync(apiPath, "utf-8");

  it("should export sendAuthNotification function", () => {
    expect(content).toContain("export async function sendAuthNotification");
  });

  it("should call POST /emails/send", () => {
    const fnStart = content.indexOf("export async function sendAuthNotification");
    const fnBody = content.slice(fnStart, fnStart + 400);
    expect(fnBody).toContain('"/emails/send"');
    expect(fnBody).toContain('"POST"');
  });

  it("should include timestamp in metadata", () => {
    const fnStart = content.indexOf("export async function sendAuthNotification");
    const fnBody = content.slice(fnStart, fnStart + 400);
    expect(fnBody).toContain("timestamp");
    expect(fnBody).toContain("new Date().toISOString()");
  });

  it("should accept optional extra metadata and spread it", () => {
    const fnStart = content.indexOf("export async function sendAuthNotification");
    const fnBody = content.slice(fnStart, fnStart + 400);
    expect(fnBody).toContain("extra");
    expect(fnBody).toContain("...extra");
  });
});

describe("Dashboard layout includes AuthEventTracker", () => {
  const content = fs.readFileSync(layoutPath, "utf-8");

  it("should import AuthEventTracker", () => {
    expect(content).toContain("AuthEventTracker");
    expect(content).toContain("@/components/auth-event-tracker");
  });

  it("should render <AuthEventTracker /> in the layout", () => {
    expect(content).toContain("<AuthEventTracker");
  });
});
