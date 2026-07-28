import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  authFailureProps,
  clerkErrorCode,
  clerkErrorCodes,
  clerkErrorMessage,
  isGoogleOnlyAccountError,
  sanitizeVerificationCode,
  VERIFICATION_CODE_LENGTH,
} from "../src/lib/clerk-error";

const read = (rel: string) =>
  fs.readFileSync(path.resolve(__dirname, "..", rel), "utf-8");

const signUp = read("src/app/(authed)/sign-up/[[...sign-up]]/page.tsx");
const signIn = read("src/app/(authed)/sign-in/[[...sign-in]]/page.tsx");
const forgot = read("src/app/(authed)/forgot-password/[[...rest]]/page.tsx");

const clerkError = (...errors: Array<Record<string, string>>) => ({ errors });

describe("clerkErrorCode / clerkErrorCodes", () => {
  it("reads the first Clerk error code", () => {
    expect(clerkErrorCode(clerkError({ code: "form_code_incorrect" }))).toBe(
      "form_code_incorrect"
    );
  });

  it("joins every code when Clerk returns several", () => {
    expect(
      clerkErrorCodes(
        clerkError({ code: "form_code_incorrect" }, { code: "form_param_nil" })
      )
    ).toBe("form_code_incorrect,form_param_nil");
  });

  it("returns undefined for a non-Clerk error", () => {
    expect(clerkErrorCode(new Error("network down"))).toBeUndefined();
    expect(clerkErrorCodes(new Error("network down"))).toBeUndefined();
  });
});

describe("clerkErrorMessage", () => {
  it("prefers longMessage, then message, then a generic line", () => {
    expect(
      clerkErrorMessage(clerkError({ longMessage: "Long", message: "Short" }))
    ).toBe("Long");
    expect(clerkErrorMessage(clerkError({ message: "Short" }))).toBe("Short");
    expect(clerkErrorMessage(new Error("boom"))).toBe(
      "Something went wrong. Please try again."
    );
  });
});

describe("isGoogleOnlyAccountError", () => {
  it("matches the Clerk code", () => {
    expect(
      isGoogleOnlyAccountError(clerkError({ code: "strategy_for_user_invalid" }))
    ).toBe(true);
  });

  it("matches the message wording when the code is absent", () => {
    expect(
      isGoogleOnlyAccountError(
        clerkError({ message: "The verification strategy is not valid" })
      )
    ).toBe(true);
  });

  it("is false for an unrelated error", () => {
    expect(isGoogleOnlyAccountError(clerkError({ code: "form_code_incorrect" }))).toBe(
      false
    );
  });
});

describe("authFailureProps", () => {
  it("carries the Clerk code and every code", () => {
    expect(
      authFailureProps(
        clerkError({ code: "form_code_incorrect" }, { code: "form_param_nil" })
      )
    ).toEqual({
      code: "form_code_incorrect",
      codes: "form_code_incorrect,form_param_nil",
    });
  });

  it("merges caller context such as the failing stage", () => {
    expect(
      authFailureProps(clerkError({ code: "form_code_incorrect" }), {
        stage: "verify",
      })
    ).toEqual({
      stage: "verify",
      code: "form_code_incorrect",
      codes: "form_code_incorrect",
    });
  });

  it("reports an unknown code rather than dropping the event", () => {
    expect(authFailureProps(new Error("network down"))).toEqual({
      code: "unknown",
      codes: "unknown",
    });
  });

  it("never leaks PII from the Clerk error payload", () => {
    const props = authFailureProps({
      errors: [
        {
          code: "form_identifier_not_found",
          message: "Couldn't find your account for margaret@example.com",
          longMessage: "Couldn't find your account for margaret@example.com",
          meta: { paramName: "identifier", emailAddress: "margaret@example.com" },
        },
      ],
    });
    const serialized = JSON.stringify(props);
    expect(serialized).not.toContain("margaret@example.com");
    expect(serialized).not.toContain("Couldn't find");
    expect(Object.keys(props).sort()).toEqual(["code", "codes"]);
  });
});

describe("sanitizeVerificationCode", () => {
  it("strips the spaces a mobile keyboard or a paste can insert", () => {
    expect(sanitizeVerificationCode("1 3 5 7 9 0")).toBe("135790");
    expect(sanitizeVerificationCode(" 135790 ")).toBe("135790");
  });

  it("strips a trailing newline from an email copy-paste", () => {
    expect(sanitizeVerificationCode("135790\n")).toBe("135790");
  });

  it("caps at six digits", () => {
    expect(sanitizeVerificationCode("1234567890")).toBe("123456");
  });

  it("drops letters and zero-width characters", () => {
    expect(sanitizeVerificationCode("12a34​5")).toBe("12345");
    expect(sanitizeVerificationCode("abcdef")).toBe("");
  });
});

describe("auth pages report the Clerk error code to PostHog", () => {
  it("sign-up tags both the create and the verify failure", () => {
    expect(signUp).toMatch(
      /signup_email_failed",\s*authFailureProps\(err,\s*\{\s*stage:\s*"create"/
    );
    expect(signUp).toMatch(
      /signup_email_failed",\s*authFailureProps\(err,\s*\{\s*stage:\s*"verify"/
    );
    expect(signUp).toMatch(/signup_google_oauth_failed",\s*authFailureProps\(/);
  });

  it("sign-in tags the email and Google failures", () => {
    expect(signIn).toMatch(/signin_email_failed",\s*authFailureProps\(err\)/);
    expect(signIn).toMatch(/signin_google_oauth_failed",\s*authFailureProps\(/);
  });

  it("forgot-password tags both the request and the reset failure", () => {
    expect(forgot).toMatch(
      /password_reset_failed",\s*authFailureProps\(err,\s*\{\s*stage:\s*"request"/
    );
    expect(forgot).toMatch(
      /password_reset_failed",\s*authFailureProps\(err,\s*\{\s*stage:\s*"reset"/
    );
  });
});

describe("auth pages share one Clerk error helper", () => {
  it("no page redeclares the helpers locally", () => {
    for (const src of [signUp, signIn, forgot]) {
      expect(src).not.toMatch(/function clerkErrorMessage/);
      expect(src).not.toMatch(/function clerkErrorCode/);
      expect(src).not.toMatch(/function isGoogleOnlyAccountError/);
    }
  });

  it("every page imports from lib/clerk-error", () => {
    for (const src of [signUp, signIn, forgot]) {
      expect(src).toMatch(/from "@\/lib\/clerk-error"/);
    }
  });
});

describe("verification code inputs are sanitized", () => {
  it("sign-up normalizes the typed code and caps the field at six", () => {
    expect(signUp).toMatch(/setCode\(sanitizeVerificationCode\(e\.target\.value\)\)/);
    expect(signUp).toMatch(/maxLength=\{VERIFICATION_CODE_LENGTH\}/);
  });

  it("forgot-password normalizes its reset code the same way", () => {
    expect(forgot).toMatch(/setCode\(sanitizeVerificationCode\(e\.target\.value\)\)/);
    expect(forgot).toMatch(/maxLength=\{VERIFICATION_CODE_LENGTH\}/);
  });

  it("pins the shared length constant at six", () => {
    expect(VERIFICATION_CODE_LENGTH).toBe(6);
  });
});

describe("verify screen offers a way out", () => {
  it("confirms a resend and blocks a second one for a cooldown window", () => {
    expect(signUp).toMatch(/resendNotice/);
    expect(signUp).toMatch(/resendCooldown/);
    expect(signUp).toMatch(/RESEND_COOLDOWN_SECONDS/);
  });

  it("tells the user which email carries the valid code", () => {
    expect(signUp).toMatch(/most recent email/i);
  });

  it("keeps the recovery copy free of em-dashes", () => {
    const copy = signUp.match(/"[^"\n]*most recent email[^"\n]*"/i)?.[0] ?? "";
    expect(copy).not.toContain("—");
  });
});

describe("auth analytics carry no credentials", () => {
  it("no capture payload references the email, password or typed code", () => {
    for (const src of [signUp, signIn, forgot]) {
      const captures = src.match(/posthog\.capture\([^;]*?\);/gs) ?? [];
      expect(captures.length).toBeGreaterThan(0);
      for (const call of captures) {
        expect(call).not.toMatch(/\bemail\b/);
        expect(call).not.toMatch(/\bpassword\b/);
        expect(call).not.toMatch(/\bcode:\s*code\b/);
      }
    }
  });
});
