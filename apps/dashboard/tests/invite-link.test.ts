import { describe, it, expect } from "vitest";
import {
  INVITE_COOKIE,
  INVITE_PARAM,
  REFERRAL_CREDIT_USD,
  inviteLinkForCode,
  inviteCodeFromSearch,
  inviteCodeFromCookie,
  inviteCookieWrite,
  inviteCookieClear,
  isTerminalClaimRejection,
} from "../src/lib/invite-link";

// `invite-link.ts` is alias-free, so these are real unit tests rather than
// source-substring guards. Keep it that way.

describe("inviteLinkForCode", () => {
  it("points at the marketing site carrying the code", () => {
    expect(inviteLinkForCode("acme")).toBe("https://distribute.you?invite=acme");
  });

  it("percent-encodes a code that needs it", () => {
    expect(inviteLinkForCode("a~b.c_d-e")).toBe(
      "https://distribute.you?invite=a~b.c_d-e",
    );
  });

  it("returns null rather than a link with no code", () => {
    // A link with no code is not a referral link, so the card must render
    // nothing instead of a copyable URL that credits nobody.
    expect(inviteLinkForCode("")).toBeNull();
    expect(inviteLinkForCode("   ")).toBeNull();
    expect(inviteLinkForCode(null)).toBeNull();
    expect(inviteLinkForCode(undefined)).toBeNull();
  });

  it("refuses a code that cannot be an org slug", () => {
    expect(inviteLinkForCode("has space")).toBeNull();
    expect(inviteLinkForCode("has/slash")).toBeNull();
    expect(inviteLinkForCode("a".repeat(129))).toBeNull();
  });
});

describe("inviteCodeFromSearch", () => {
  it("reads the code off the query string", () => {
    expect(inviteCodeFromSearch("?invite=acme")).toBe("acme");
    expect(inviteCodeFromSearch("?utm_source=x&invite=acme&z=1")).toBe("acme");
  });

  it("decodes a percent-encoded code", () => {
    expect(inviteCodeFromSearch("?invite=a%2Eb")).toBe("a.b");
  });

  it("returns null when the parameter is absent or unusable", () => {
    expect(inviteCodeFromSearch("")).toBeNull();
    expect(inviteCodeFromSearch("?via=partner")).toBeNull();
    expect(inviteCodeFromSearch("?invite=")).toBeNull();
    expect(inviteCodeFromSearch("?invite=%20%20")).toBeNull();
    expect(inviteCodeFromSearch("?invite=has%20space")).toBeNull();
  });
});

describe("the cookie round trip", () => {
  it("survives write then read", () => {
    const written = inviteCookieWrite("acme");
    expect(inviteCodeFromCookie(written)).toBe("acme");
  });

  it("reads the code out of a cookie jar holding other cookies", () => {
    expect(
      inviteCodeFromCookie("partnero_via=KHV3; distribute_invite=acme; theme=dark"),
    ).toBe("acme");
  });

  it("is not confused by a cookie whose name merely ends in the same word", () => {
    expect(inviteCodeFromCookie("x_distribute_invite=wrong")).toBeNull();
  });

  it("returns null for an absent or empty cookie", () => {
    expect(inviteCodeFromCookie("")).toBeNull();
    expect(inviteCodeFromCookie("theme=dark")).toBeNull();
    expect(inviteCodeFromCookie("distribute_invite=")).toBeNull();
  });

  it("clears by expiring, not by writing an empty code that reads back", () => {
    const cleared = inviteCookieClear();
    expect(cleared).toContain("max-age=0");
    expect(inviteCodeFromCookie(cleared)).toBeNull();
  });

  it("carries the documented name and parameter", () => {
    expect(INVITE_COOKIE).toBe("distribute_invite");
    expect(INVITE_PARAM).toBe("invite");
    expect(inviteCookieWrite("acme")).toContain("SameSite=Lax");
    expect(inviteCookieWrite("acme")).toContain("path=/");
  });
});

describe("isTerminalClaimRejection", () => {
  it("drops the code only when the answer can never change", () => {
    expect(isTerminalClaimRejection(400)).toBe(true);
    expect(isTerminalClaimRejection(404)).toBe(true);
  });

  it("KEEPS the code on a 409, because the invite cap is being lifted", () => {
    // Re-claiming the same pair is idempotent downstream and answers 200, so the
    // only 409 that exists is "this inviter is capped". The cap is going away, so
    // dropping the code here would permanently cost two orgs $500 each for
    // signing up during the gap.
    expect(isTerminalClaimRejection(409)).toBe(false);
  });

  it("KEEPS the code on anything else that may succeed later", () => {
    // 401/403 in particular mean the Clerk session has not settled, not that the
    // code is bad.
    for (const status of [401, 403, 408, 429, 500, 502, 503, 504]) {
      expect(isTerminalClaimRejection(status)).toBe(false);
    }
  });
});

describe("the offer", () => {
  it("is $500 a side", () => {
    expect(REFERRAL_CREDIT_USD).toBe(500);
  });
});
