import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, "..", rel), "utf8");

const signUp = read("src/app/(authed)/sign-up/[[...sign-up]]/page.tsx");
const signIn = read("src/app/(authed)/sign-in/[[...sign-in]]/page.tsx");
const forgot = read("src/app/(authed)/forgot-password/[[...rest]]/page.tsx");

const sliceFrom = (src: string, marker: string, length: number) => {
  const at = src.indexOf(marker);
  expect(at, `marker not found: ${marker}`).toBeGreaterThan(-1);
  return src.slice(at, at + length);
};

/**
 * A failure that renders nothing is indistinguishable from a click that never
 * registered — so the same click just gets repeated. Both Google buttons used
 * to revert silently to "Continue with Google" and set no error anywhere.
 */
describe("OAuth failures say what happened", () => {
  it("sign-up reports a Google failure in its own slot, not the email form's", () => {
    expect(signUp).toContain("const [googleError, setGoogleError] = useState");
    expect(signUp).toContain("setGoogleError(clerkErrorMessage(error))");
    expect(signUp).toContain("{googleError && (");
    // Cleared when the button is pressed again, or a stale failure sits under a
    // button that is now working.
    expect(signUp).toContain('setGoogleError("")');
  });

  it("sign-in reports a Google failure", () => {
    expect(signIn).toContain("const [googleError, setGoogleError] = useState");
    expect(signIn).toContain("setGoogleError(clerkErrorMessage(error))");
    expect(signIn).toContain("{googleError && (");
    expect(signIn).toContain('setGoogleError("")');
  });

  it("renders the message through the shared helper, never the raw error", () => {
    for (const src of [signUp, signIn]) {
      expect(src).not.toContain("setGoogleError(error.message)");
      expect(src).not.toContain("setGoogleError(String(error))");
    }
  });
});

/**
 * The resend was the one interactive step on any auth page with no in-flight
 * state at all: the label stayed "Send me a new code" for the whole round-trip,
 * so the control read as dead exactly when someone is already stuck.
 */
describe("resend code reports that it is working", () => {
  it("carries a pending flag, disables and relabels while in flight", () => {
    expect(signUp).toContain("const [resending, setResending] = useState(false)");
    expect(signUp).toContain("disabled={resendCooldown > 0 || resending}");
    expect(signUp).toContain("aria-busy={resending}");
    expect(signUp).toContain("Sending a new code...");
  });

  it("keeps the in-flight label at the live colour", () => {
    // Greying it out while it works reads as unavailable at the moment it is
    // doing the thing — the same trap the submit buttons already avoid.
    const slice = sliceFrom(signUp, "onClick={handleResendCode}", 1200);
    expect(slice).toContain("!resending && resendCooldown > 0");
  });

  it("clears the pending flag on both paths", () => {
    const slice = sliceFrom(signUp, "const handleResendCode = async", 900);
    expect(slice).toContain("setResending(true)");
    expect(slice).toContain("setResending(false)");
    expect(slice).toContain("} finally {");
  });
});

/**
 * `canSubmitEmail` greys the submit out on a malformed email, and the only hint
 * on screen named the PASSWORD rule — so an invalid address produced a dead
 * button with no stated reason.
 */
describe("the email gate states its own rule", () => {
  it("names the email rule once something has been typed", () => {
    expect(signUp).toContain("Enter a full email address, like you@company.com");
    expect(signUp).toContain("email.trim().length > 0 && !EMAIL_SHAPE.test(email.trim())");
  });

  it("says nothing on an empty field", () => {
    // An empty field is not yet a mistake, so the shape check is gated behind a
    // length test rather than standing alone.
    const slice = sliceFrom(signUp, "Enter a full email address", 400);
    expect(slice).toBeTruthy();
    expect(signUp).toContain("email.trim().length > 0 &&");
  });
});

/**
 * Every error render was a bare coloured <p>, so a screen reader never
 * announced a failed sign-in.
 */
describe("errors are announced", () => {
  it("every auth page marks its error renders as live regions", () => {
    expect(signUp.match(/role="alert"/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(signIn.match(/role="alert"/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(forgot.match(/role="alert"/g)?.length ?? 0).toBe(2);
  });

  it("the resend confirmation is a status, not an alert", () => {
    // It reports something that went right; alert is for the failure beside it.
    expect(signUp).toContain('role="status"');
  });
});
