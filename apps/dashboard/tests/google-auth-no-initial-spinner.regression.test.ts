import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression test: Google auth button must NOT show a spinner on initial page load.
 *
 * Root cause: The button's icon was conditionally rendered with `{!isLoaded || loading ? <spinner> : <googleIcon>}`.
 * Since Clerk's `isLoaded` is false during initialization, the button appeared to be loading
 * before the user ever clicked it — making it look broken/unclickable.
 *
 * Fix: Only show the spinner when `loading` is true (user clicked the button),
 * then let the redirect effect wait for Clerk to finish loading.
 */
describe("Google auth button should not spinner on initial load", () => {
  const signInPath = path.join(
    __dirname,
    "../src/app/(authed)/sign-in/[[...sign-in]]/page.tsx"
  );
  const signUpPath = path.join(
    __dirname,
    "../src/app/(authed)/sign-up/[[...sign-up]]/page.tsx"
  );
  const signInContent = fs.readFileSync(signInPath, "utf-8");
  const signUpContent = fs.readFileSync(signUpPath, "utf-8");

  it("sign-in button should only show spinner based on loading state, not isLoaded", () => {
    expect(signInContent).not.toMatch(/!isLoaded.*\?\s*\(/);
    expect(signInContent).toContain("{loading ? (");
  });

  it("sign-up button should only show spinner based on loading state, not isLoaded", () => {
    expect(signUpContent).not.toMatch(/!isLoaded.*\?\s*\(/);
    expect(signUpContent).toContain("{loading ? (");
  });

  it("sign-in click should show loading immediately before Clerk is ready", () => {
    expect(signInContent).toMatch(
      /const handleGoogleSignIn = \(\) => \{[\s\S]*?if \(loading \|\| isSignedIn\) return;[\s\S]*?setLoading\(true\);/
    );
    expect(signInContent).toContain(
      "!loading ||\n      !isLoaded ||\n      isSignedIn ||\n      !signIn ||"
    );
  });

  it("sign-up click should show loading immediately before Clerk is ready", () => {
    expect(signUpContent).toMatch(
      /const handleGoogleSignUp = \(\) => \{[\s\S]*?if \(loading \|\| isSignedIn\) return;[\s\S]*?setLoading\(true\);/
    );
    expect(signUpContent).toContain(
      "!loading ||\n      !isLoaded ||\n      isSignedIn ||\n      !signUp ||"
    );
  });
});
