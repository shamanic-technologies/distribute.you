import { describe, it, expect } from "vitest";
import {
  INVITE_COOKIE_NAME,
  INVITE_COOKIE_MAX_AGE_SECONDS,
  isValidInviteSlug,
  resolveCookieDomain,
} from "../../src/lib/invite-cookie";

describe("invite-cookie constants", () => {
  it("uses stable cookie name shared with dashboard", () => {
    expect(INVITE_COOKIE_NAME).toBe("dyu_invite");
  });

  it("has 90-day max age", () => {
    expect(INVITE_COOKIE_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 90);
  });
});

describe("isValidInviteSlug", () => {
  it("accepts typical Clerk org slugs", () => {
    expect(isValidInviteSlug("stripe-com")).toBe(true);
    expect(isValidInviteSlug("acme")).toBe(true);
    expect(isValidInviteSlug("acme-marketing-agency")).toBe(true);
    expect(isValidInviteSlug("abc123")).toBe(true);
  });

  it("rejects nulls + non-strings", () => {
    expect(isValidInviteSlug(null)).toBe(false);
    expect(isValidInviteSlug(undefined)).toBe(false);
    expect(isValidInviteSlug(123 as unknown as string)).toBe(false);
  });

  it("rejects uppercase + spaces + punctuation", () => {
    expect(isValidInviteSlug("Stripe")).toBe(false);
    expect(isValidInviteSlug("stripe com")).toBe(false);
    expect(isValidInviteSlug("stripe.com")).toBe(false);
    expect(isValidInviteSlug("stripe_com")).toBe(false);
    expect(isValidInviteSlug("/stripe")).toBe(false);
  });

  it("rejects leading or trailing hyphens", () => {
    expect(isValidInviteSlug("-stripe")).toBe(false);
    expect(isValidInviteSlug("stripe-")).toBe(false);
  });

  it("rejects too-short and too-long slugs", () => {
    expect(isValidInviteSlug("a")).toBe(false);
    expect(isValidInviteSlug("a".repeat(65))).toBe(false);
    expect(isValidInviteSlug("ab")).toBe(true);
  });
});

describe("resolveCookieDomain", () => {
  it("returns .distribute.you for distribute.you and subdomains", () => {
    expect(resolveCookieDomain("distribute.you")).toBe(".distribute.you");
    expect(resolveCookieDomain("www.distribute.you")).toBe(".distribute.you");
    expect(resolveCookieDomain("distribute-staging.distribute.you")).toBe(".distribute.you");
  });

  it("returns undefined for localhost + unknown hosts", () => {
    expect(resolveCookieDomain("localhost:3000")).toBeUndefined();
    expect(resolveCookieDomain("127.0.0.1")).toBeUndefined();
    expect(resolveCookieDomain(null)).toBeUndefined();
  });
});
