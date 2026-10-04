import { describe, it, expect } from "vitest";
import { creditGrantLabel } from "../src/lib/credit-grant-label";

// The module is alias-free, so these are real unit tests. Keep it that way.

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
