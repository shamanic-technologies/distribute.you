import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, "..", rel), "utf-8");

const signUp = read("src/app/(authed)/sign-up/[[...sign-up]]/page.tsx");
const signIn = read("src/app/(authed)/sign-in/[[...sign-in]]/page.tsx");
const forgot = read(
  "src/app/(authed)/forgot-password/[[...rest]]/page.tsx"
);
const proxy = read("src/proxy.ts");

describe("sign-up email/password flow", () => {
  it("keeps the Google OAuth path", () => {
    expect(signUp).toMatch(/authenticateWithRedirect/);
    expect(signUp).toMatch(/oauth_google/);
  });

  it("creates the account + sends an email verification code", () => {
    expect(signUp).toMatch(/signUp\.create\(/);
    expect(signUp).toMatch(/prepareEmailAddressVerification/);
    expect(signUp).toMatch(/attemptEmailAddressVerification/);
    expect(signUp).toMatch(/strategy:\s*"email_code"/);
  });

  it("activates the session and renders a password field", () => {
    expect(signUp).toMatch(/setActive\(/);
    expect(signUp).toMatch(/type="password"/);
  });

  it("preserves the landing ?url= prefill on the email path", () => {
    expect(signUp).toMatch(/\/onboarding\?url=/);
    expect(signUp).toMatch(/signup_email_verified/);
  });
});

describe("sign-in email/password flow", () => {
  it("keeps the Google OAuth path", () => {
    expect(signIn).toMatch(/authenticateWithRedirect/);
    expect(signIn).toMatch(/oauth_google/);
  });

  it("signs in with identifier + password and activates the session", () => {
    expect(signIn).toMatch(/signIn\.create\(/);
    expect(signIn).toMatch(/identifier:/);
    expect(signIn).toMatch(/type="password"/);
    expect(signIn).toMatch(/setActive\(/);
  });

  it("links to the forgot-password page", () => {
    expect(signIn).toMatch(/href="\/forgot-password"/);
  });

  it("guides a Google-registered email away from the password box", () => {
    // A Google-OAuth account has no password factor -> Clerk returns
    // strategy_for_user_invalid; surface a Google hint, not the raw error.
    expect(signIn).toMatch(/strategy_for_user_invalid/);
    expect(signIn).toMatch(/registered with Google/);
    expect(signIn).toMatch(/isGoogleOnlyAccountError/);
  });
});

describe("forgot-password reset flow", () => {
  it("requests a reset code then completes the reset", () => {
    expect(forgot).toMatch(/reset_password_email_code/);
    expect(forgot).toMatch(/attemptFirstFactor/);
    expect(forgot).toMatch(/setActive\(/);
    expect(forgot).toMatch(/type="password"/);
  });

  it("routes a Google-registered email to Google instead of a reset code", () => {
    expect(forgot).toMatch(/strategy_for_user_invalid/);
    expect(forgot).toMatch(/registered with Google/);
    expect(forgot).toMatch(/isGoogleOnlyAccountError/);
  });
});

describe("proxy public routing", () => {
  it("treats /forgot-password as public + auth route", () => {
    // Public so signed-out users can reach it; auth so signed-in users bounce to /orgs.
    const matches = proxy.match(/\/forgot-password\(\.\*\)/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });
});
