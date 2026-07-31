import { describe, it, expect } from "vitest";
import { creditGrantLabel } from "../src/lib/credit-grant-label";
import {
  WELCOME_CREDIT_USD,
  REFERRAL_CREDIT_USD,
  welcomeHeadline,
  welcomeDetail,
  referredByLine,
} from "../src/lib/welcome-offer-copy";

// Both modules are alias-free, so these are real unit tests. Keep them that way.

describe("creditGrantLabel", () => {
  it("names the two reasons the referral offer actually issues", () => {
    // These landed in the `Promo: <code>` default before, so the first $500 a
    // customer ever earned would have read `Promo: referral_reward` in the ledger
    // at the exact moment the feature paid off.
    expect(creditGrantLabel("referral_reward")).toBe("Referral credits");
    expect(creditGrantLabel("welcome_completion")).toBe("Welcome credits");
  });

  it("keeps the existing names", () => {
    expect(creditGrantLabel("welcome")).toBe("Welcome gift");
    expect(creditGrantLabel("admin_grant")).toBe("Bonus credit");
  });

  it("still names the legacy invite reasons, whose rows exist", () => {
    expect(creditGrantLabel("invite_welcome")).toBe("Referral credits");
    expect(creditGrantLabel("invite_reward")).toBe("Referral credits");
  });

  it("is honest about a code it does not recognise", () => {
    // Inventing a friendly name for something we cannot describe is worse than
    // showing the code.
    expect(creditGrantLabel("black_friday_2027")).toBe("Promo: black_friday_2027");
  });

  it("never prints a raw known reason", () => {
    for (const reason of ["referral_reward", "welcome_completion", "welcome", "admin_grant"]) {
      expect(creditGrantLabel(reason)).not.toContain(reason);
    }
  });
});

describe("the onboarding gift copy", () => {
  it("promises the plain welcome offer to an ordinary signup", () => {
    expect(welcomeHeadline(false)).toBe("We will match your first $400 with $400 free credits.");
    expect(welcomeDetail(false)).toBe(
      "$5 is in your account already. The rest lands automatically once your payments reach $400.",
    );
  });

  it("tells a REFERRED signup the full amount it is owed", () => {
    // Quoting $400 to someone who is actually getting $900 understates the offer
    // by $500 at the screen where they decide to pay, and contradicts the invite
    // link that brought them here.
    expect(welcomeHeadline(true)).toBe("You have $900 in free credits waiting.");
  });

  it("states BOTH bars for a referred signup, because they stack", () => {
    const detail = welcomeDetail(true);
    expect(detail).toContain("$400 lands once your payments reach $400");
    expect(detail).toContain("$500 referral credits at $900");
  });

  it("keeps the up-front $5 true in both cases", () => {
    expect(welcomeDetail(false)).toContain("$5 is in your account already");
    expect(welcomeDetail(true)).toContain("$5 is in your account already");
  });

  it("derives the stacked bar rather than hardcoding it", () => {
    expect(welcomeHeadline(true)).toContain(
      `$${(WELCOME_CREDIT_USD + REFERRAL_CREDIT_USD).toLocaleString("en-US")}`,
    );
  });

  it("uses no em-dash in customer-facing copy", () => {
    for (const s of [welcomeHeadline(true), welcomeHeadline(false), welcomeDetail(true), welcomeDetail(false)]) {
      expect(s).not.toContain("—");
    }
  });
});

describe("referredByLine", () => {
  it("names the inviter when the invite told us", () => {
    expect(referredByLine("Acme")).toBe("Acme invited you.");
  });

  it("says nothing rather than something empty", () => {
    expect(referredByLine(null)).toBeNull();
    expect(referredByLine("")).toBeNull();
    expect(referredByLine("   ")).toBeNull();
  });
});
