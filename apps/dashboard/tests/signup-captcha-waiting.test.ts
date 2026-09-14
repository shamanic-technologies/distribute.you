import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Clerk's bot protection on this instance is a MANAGED Turnstile widget, not an
 * invisible one. Read off the deployed public config on 2026-09-14:
 *
 *   user_settings.sign_up.captcha_enabled     = true
 *   user_settings.sign_up.captcha_widget_type = "smart"
 *   display_config.captcha_provider           = "turnstile"
 *
 * "smart" means Cloudflare decides per client, and on anything it finds
 * suspicious it renders a real "Verify you are human" checkbox into
 * `#clerk-captcha`. `signUp.create` does not resolve until that box is ticked.
 *
 * The button said "Creating account..." for the whole of that wait, which
 * states that work is in progress rather than that the control is waiting on
 * the person. Reproduced in a real browser against production: the form sat on
 * "Creating account..." indefinitely with an unticked checkbox directly above
 * it, no error, no prompt. PostHog carries sessions that fire
 * `signup_email_started` and then nothing at all, which is what that looks like
 * from the outside.
 *
 * These guards pin the prompt and the honest busy label. They are
 * source-substring guards, so they prove the page is WIRED, never that the
 * widget renders -- that half is verified by rendering the real page.
 */

const PAGE = fs.readFileSync(
  path.join(
    process.cwd(),
    "src/app/(authed)/sign-up/[[...sign-up]]/page.tsx"
  ),
  "utf8"
);

describe("sign-up captcha waiting state", () => {
  it("gives Clerk's challenge container a ref so its rendered size can be read", () => {
    expect(PAGE).toContain('<div id="clerk-captcha" ref={captchaBoxRef} />');
  });

  it("keys the waiting state on the container having real height", () => {
    expect(PAGE).toContain("box.getBoundingClientRect().height <= 0");
  });

  it("waits before prompting, so a self-clearing widget never flashes the copy", () => {
    expect(PAGE).toContain("const CAPTCHA_PROMPT_DELAY_MS = 1500;");
    expect(PAGE).toContain(
      "Date.now() - shownSince >= CAPTCHA_PROMPT_DELAY_MS"
    );
  });

  it("polls as well as observes, since the widget is a cross-origin iframe", () => {
    expect(PAGE).toContain("new MutationObserver(read)");
    expect(PAGE).toContain("setInterval(read,");
  });

  it("clears the waiting state once the submit settles", () => {
    const effect = PAGE.slice(
      PAGE.indexOf("if (!submitting) {"),
      PAGE.indexOf("}, [submitting]);")
    );
    expect(effect).toContain("setCaptchaWaiting(false)");
  });

  it("tells the person what to do, rather than only that something is running", () => {
    expect(PAGE).toContain(
      "Check the box above to finish creating your account."
    );
  });

  it("announces that prompt to a screen reader", () => {
    const prompt = PAGE.slice(
      PAGE.indexOf("{captchaWaiting && ("),
      PAGE.indexOf("Check the box above to finish creating your account.")
    );
    expect(prompt).toContain('role="status"');
  });

  it("stops claiming the account is being created while the box is unticked", () => {
    expect(PAGE).toContain('? "Waiting for verification"');
    expect(PAGE).toContain(': "Creating account..."');
  });

  it("carries no em-dash in the copy it adds", () => {
    expect(
      "Check the box above to finish creating your account."
    ).not.toContain("—");
    expect("Waiting for verification").not.toContain("—");
  });
});
