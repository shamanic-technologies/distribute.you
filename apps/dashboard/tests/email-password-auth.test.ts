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
// The Clerk error helpers were extracted out of the three auth pages into one
// shared module, so the codes they key on now live here, not in the pages.
const clerkErrorLib = read("src/lib/clerk-error.ts");

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

describe("sign-up submit is gated on both inputs being valid", () => {
  // The button used to be `disabled={submitting}` only, so on an empty or
  // half-filled form it looked live and the click did nothing visible (native
  // `required` blocks the submit silently). A control that looks available and
  // is not is a dead affordance.
  const gate = signUp.slice(
    signUp.indexOf("const canSubmitEmail"),
    signUp.indexOf("const handleEmailSignUp"),
  );

  it("disables the submit until both fields are valid", () => {
    expect(signUp).toContain("disabled={submitting || !canSubmitEmail}");
  });

  it("derives the gate live from the two fields rather than latching it", () => {
    // A `useState<boolean>` flipped true on first edit stays true after the user
    // clears a field, so the compare has to read the values on every render.
    expect(gate).toContain("const canSubmitEmail =");
    expect(gate).toContain("email.trim()");
    expect(gate).toContain("password.length");
    expect(signUp).not.toContain("setCanSubmitEmail");
  });

  it("names the password floor instead of inlining the number twice", () => {
    expect(signUp).toContain("const MIN_PASSWORD_LENGTH = 8");
    expect(gate).toContain("MIN_PASSWORD_LENGTH");
  });

  it("tells the user what the gate wants, so the disabled state is explained", () => {
    // Clerk rejects a shorter password anyway; the point of the hint is that a
    // greyed-out button with no stated reason reads as broken.
    expect(signUp).toContain("MIN_PASSWORD_LENGTH} characters");
  });

  it("fades only the genuinely-unavailable state, never the in-flight label", () => {
    // `Creating account...` must stay full-opacity: fade means unavailable, and
    // a faded working label reads as a dead button.
    expect(signUp).toContain("!submitting && !canSubmitEmail ? { opacity:");
  });

  it("leaves the Google button and the verification step ungated", () => {
    // Google carries no form input, and the code field has its own length cap.
    expect(signUp).toContain("disabled={loading}");
    expect(signUp).toContain("disabled={submitting}");
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
    expect(clerkErrorLib).toMatch(/strategy_for_user_invalid/);
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
    expect(clerkErrorLib).toMatch(/strategy_for_user_invalid/);
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
