import { describe, it, expect } from "vitest";
import { INVITE_FORWARD_SCRIPT } from "../../src/lib/static-html";

/**
 * The referral code's journey across the subdomain gap, plus the banner that
 * tells the visitor what the link is worth.
 *
 * Behaviour was verified by reproduction (headless Chromium against a throwaway
 * page loading this exact string): with `?invite=acme` the banner is the body's
 * first child and a dashboard-bound link picks up `?invite=acme` on click; with
 * no code there is no banner and the link is untouched; with a malformed code
 * there is no banner. These guards pin the parts of that which are cheap to
 * assert statically.
 */

describe("INVITE_FORWARD_SCRIPT", () => {
  it("is valid JavaScript", () => {
    // It ships inline inside a <script> tag on every static page, so a syntax
    // error here silently kills the whole IIFE and the code stops travelling.
    expect(() => new Function(INVITE_FORWARD_SCRIPT)).not.toThrow();
  });

  it("cannot close its own script tag", () => {
    expect(INVITE_FORWARD_SCRIPT).not.toContain("</script");
  });

  it("validates the code before doing anything with it", () => {
    // The value comes off the address bar. A code that cannot be an org slug is
    // dropped rather than stored, forwarded or announced.
    expect(INVITE_FORWARD_SCRIPT).toContain("A-Za-z0-9._~-");
  });

  it("remembers the code on the landing domain, so it survives internal navigation", () => {
    expect(INVITE_FORWARD_SCRIPT).toContain("distribute_invite");
    expect(INVITE_FORWARD_SCRIPT).toContain("SameSite=Lax");
  });

  it("forwards it only to dashboard-bound links, and never overwrites one", () => {
    expect(INVITE_FORWARD_SCRIPT).toContain('a[href*="dashboard.distribute.you"]');
    expect(INVITE_FORWARD_SCRIPT).toContain("if(!u.searchParams.get('invite'))");
  });

  it("announces the real total, not the plain welcome figure", () => {
    // The link lands on a page that otherwise says $400 while this visitor is
    // being offered $900, which reads as the referrer's pitch being contradicted
    // by the first page their friend sees.
    expect(INVITE_FORWARD_SCRIPT).toContain("$900 in free credits instead of $400");
    expect(INVITE_FORWARD_SCRIPT).toContain("payments reach $400");
  });

  it("shows the banner at most once", () => {
    expect(INVITE_FORWARD_SCRIPT).toContain("getElementById('dy-invite-banner')");
  });

  it("uses no em-dash in the customer-facing sentence", () => {
    expect(INVITE_FORWARD_SCRIPT).not.toContain("—");
  });
});
