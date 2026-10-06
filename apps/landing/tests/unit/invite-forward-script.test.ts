import { describe, it, expect } from "vitest";
import { INVITE_FORWARD_SCRIPT } from "../../src/lib/static-html";

/**
 * The referral code's journey across the subdomain gap: with `?invite=acme` a
 * dashboard-bound link picks up `?invite=acme` on click; with no code the link is
 * untouched. These guards pin the parts of that which are cheap to assert
 * statically.
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

  it("injects no banner: a referred visitor sees the ordinary page", () => {
    // Owner 2026-10-06: the "You were invited" banner is removed completely.
    expect(INVITE_FORWARD_SCRIPT).not.toContain("dy-invite-banner");
    expect(INVITE_FORWARD_SCRIPT).not.toContain("createElement");
    expect(INVITE_FORWARD_SCRIPT).not.toContain("free credits");
  });
});
