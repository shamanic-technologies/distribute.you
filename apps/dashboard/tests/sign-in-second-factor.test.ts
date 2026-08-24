import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * This Clerk instance requires an emailed code as a SECOND factor after a
 * correct password, so `signIn.create({ identifier, password })` returns
 * `needs_second_factor` on the happy path and never `complete`. The page used
 * to treat every non-complete status as one dead end that printed "Additional
 * verification required. Try Google sign-in." and captured nothing, so email +
 * password sign-in could not succeed for anyone, and the failure was invisible
 * in the funnel.
 *
 * Verified against the production Clerk instance before writing this:
 *   password (correct)                     -> 200 needs_second_factor
 *                                             supported_second_factors [email_code]
 *   prepare_second_factor  {email_code}    -> 200 verification_otp sent
 *   attempt_second_factor  {email_code, x} -> 422 form_code_incorrect
 */

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, "..", rel), "utf-8");

const signIn = read("src/app/(authed)/sign-in/[[...sign-in]]/page.tsx");
const signUp = read("src/app/(authed)/sign-up/[[...sign-up]]/page.tsx");
const forgot = read("src/app/(authed)/forgot-password/[[...rest]]/page.tsx");

describe("sign-in second factor", () => {
  it("prepares the emailed code when Clerk asks for a second factor", () => {
    expect(signIn).toContain('result.status === "needs_second_factor"');
    expect(signIn).toMatch(
      /prepareSecondFactor\(\{\s*strategy:\s*"email_code"\s*\}\)/
    );
  });

  it("submits the code and activates the session", () => {
    expect(signIn).toMatch(/attemptSecondFactor\(\{/);
    expect(signIn).toContain('strategy: "email_code"');
    expect(signIn).toMatch(/activate\(\{\s*session:\s*result\.createdSessionId/);
  });

  it("reads the code through the shared sanitizer, capped at its length", () => {
    expect(signIn).toContain("sanitizeVerificationCode(e.target.value)");
    expect(signIn).toContain("maxLength={VERIFICATION_CODE_LENGTH}");
  });

  it("offers a cooldown-gated resend that confirms it sent", () => {
    expect(signIn).toContain("RESEND_COOLDOWN_SECONDS");
    expect(signIn).toContain("handleResendSecondFactor");
    expect(signIn).toContain("New code sent to");
  });

  it("prepares once per pending step, so a resend cannot be fired by an attempt", () => {
    // A second `prepare` mails a fresh code and invalidates the one the user is
    // already typing, which reads as "the code never works".
    expect(signIn).toContain("if (!secondFactorPending) {");
  });

  it("never sends the user to Google for a status Google cannot answer", () => {
    // The account that reported this has a password and NO Google identity, so
    // the old copy pointed at a door that does not exist for them.
    expect(signIn).not.toContain(
      "Additional verification required. Try Google sign-in."
    );
    // The `strategy_for_user_invalid` copy is the one case where naming Google
    // is correct (that code means the account carries no password at all).
    expect(signIn).toContain("This email is registered with Google");
  });

  it("drops the claim that these statuses cannot happen here", () => {
    expect(signIn).not.toContain("not enabled on this\n    // instance");
    expect(signIn).not.toContain("are not enabled on this instance");
  });

  it("names every remaining status instead of one generic dead end", () => {
    expect(signIn).toContain("SIGN_IN_STATUS_MESSAGE");
    expect(signIn).toContain("needs_new_password");
    expect(signIn).toContain("needs_first_factor");
    expect(signIn).toContain("needs_client_trust");
  });
});

describe("a non-complete status is reported, not only displayed", () => {
  // The whole reason this bug survived a month: the branch that handled it
  // captured nothing, so PostHog held `signin_email_started` with no matching
  // outcome and the funnel looked like the user simply walked away.
  it("captures the sign-in statuses", () => {
    expect(signIn).toContain('posthog.capture("signin_email_incomplete"');
    expect(signIn).toContain('posthog.capture("signin_second_factor_started"');
    // Wrapped across lines by the formatter, so match the event name alone.
    expect(signIn).toContain('"signin_second_factor_failed"');
  });

  it("captures the sign-up verify status", () => {
    expect(signUp).toContain('posthog.capture("signup_email_incomplete"');
  });

  it("captures the password-reset status", () => {
    expect(forgot).toContain('posthog.capture("password_reset_incomplete"');
  });

  it("carries the status itself, which is the only diagnostic there is", () => {
    for (const src of [signIn, signUp, forgot]) {
      expect(src).toContain('status: result.status ?? "unknown"');
    }
  });
});
