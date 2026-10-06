import { describe, it, expect } from "vitest";
import {
  isEarnedByReferral,
  promiseTitle,
  promiseSubtitle,
  promiseProgressLabel,
  promiseProgressSentence,
  promiseProgressWidth,
  promiseUnlockLine,
} from "../src/lib/free-credit-promise-view";

// Alias-free module, so these are real unit tests. Keep it that way.

describe("which kind of promise a row is", () => {
  it("reads a referral the org EARNED off the referred org id", () => {
    expect(isEarnedByReferral({ referredOrgId: "org-a" })).toBe(true);
  });

  it("a referrer id alone is not a referral credit (the referred org gets none)", () => {
    expect(isEarnedByReferral({ referrerOrgId: "org-b" })).toBe(false);
  });

  it("treats a promise with neither as the welcome one", () => {
    expect(isEarnedByReferral({})).toBe(false);
    expect(promiseTitle({})).toBe("Welcome credits");
  });
});

describe("promiseTitle", () => {
  it("names the org that earned it, so three pending referrals are distinguishable", () => {
    expect(promiseTitle({ referredOrgId: "org-a", referredOrgName: "Acme" })).toBe(
      "Referral credits from Acme",
    );
  });

  it("says nothing rather than printing a UUID when the name is missing", () => {
    // billing resolves the display identity in a follow-up, and it is absent for
    // good when the other org has no brand. A UUID is not an answer to "who is
    // this", and a fabricated label is worse.
    const t = promiseTitle({ referredOrgId: "3f1a-uuid-here" });
    expect(t).toBe("Referral credits");
    expect(t).not.toContain("3f1a");
  });

  it("ignores a blank name", () => {
    expect(promiseTitle({ referredOrgId: "org-a", referredOrgName: "   " })).toBe(
      "Referral credits",
    );
  });

  it("never titles a row as a referral credit for the referred org", () => {
    // Owner rule 2026-10-06: the referred org gets no referral credit.
    expect(promiseTitle({ referrerOrgId: "org-b" })).toBe("Welcome credits");
  });
});

describe("promiseSubtitle", () => {
  it("states what is LEFT to pay, not the bar", () => {
    expect(promiseSubtitle("$500.00")).toBe("Unlocks after $500.00 more in payments.");
  });

  it("degrades to a plain sentence when there is no figure", () => {
    expect(promiseSubtitle(null)).toBe("Unlocks with your next payments.");
  });

  it("keeps the welcome row on the org's own payments", () => {
    expect(promiseSubtitle("$70.00", {})).toBe("Unlocks after $70.00 more in payments.");
  });

  it("names the REFERRED org's payments on a referral row, never the referrer's", () => {
    // The referrer pays nothing: the promise lands on the referred org's payments.
    const s = promiseSubtitle("$300.00", { referredOrgId: "org-a", referredOrgName: "Acme" });
    expect(s).toBe("Lands once Acme has paid $300.00 more.");
    expect(s).not.toContain("in payments");
  });

  it("says 'your referral' when the referred org has no name", () => {
    expect(promiseSubtitle("$300.00", { referredOrgId: "org-a" })).toBe(
      "Lands once your referral has paid $300.00 more.",
    );
    expect(promiseSubtitle(null, { referredOrgId: "org-a", referredOrgName: "Acme" })).toBe(
      "Lands once Acme has paid us more.",
    );
  });
});

describe("promiseProgressWidth", () => {
  it("passes a served percentage through", () => {
    expect(promiseProgressWidth(44)).toBe(44);
    expect(promiseProgressWidth(0)).toBe(0);
    expect(promiseProgressWidth(100)).toBe(100);
  });

  it("clamps a value that would paint outside its track", () => {
    expect(promiseProgressWidth(140)).toBe(100);
    expect(promiseProgressWidth(-5)).toBe(0);
  });

  it("renders NO bar when progress is unmeasurable, rather than a zeroed one", () => {
    // A zeroed bar reads as "you have paid nothing", which is a different claim
    // from "we could not measure this".
    expect(promiseProgressWidth(null)).toBeNull();
    expect(promiseProgressWidth(undefined)).toBeNull();
    expect(promiseProgressWidth(Number.NaN)).toBeNull();
  });
});

describe("promiseUnlockLine", () => {
  it("names the amount the next payments open, not just the bar", () => {
    // The sidebar heading states what is coming, so the line under the bar has to
    // say WHICH slice of it lands next, or a customer holding three promises
    // reads the bar as progress toward the whole.
    expect(promiseUnlockLine("$347", "$376")).toBe(
      "Unlock $347 free credits after $376 more in payments.",
    );
  });

  it("degrades to the next payments rather than inventing a bar", () => {
    expect(promiseUnlockLine("$500", null)).toBe(
      "Unlock $500 free credits with your next payments.",
    );
  });

  it("keeps the Billing row's own wording untouched", () => {
    // Billing rows carry their amount on the right, so they need no second copy
    // of it in the sentence. One vocabulary, two sentences, both here.
    expect(promiseSubtitle("$376.00")).toBe("Unlocks after $376.00 more in payments.");
  });

  it("says what the money IS, so two figures in one sentence cannot be confused", () => {
    // Without "free credits" the first amount reads as something else the
    // customer owes rather than as the gift the second one buys.
    expect(promiseUnlockLine("$347", "$376")).toContain("free credits");
  });

  it("names the referred org's payments on a referral row", () => {
    expect(promiseUnlockLine("$500", "$300", { referredOrgId: "org-a", referredOrgName: "Acme" })).toBe(
      "Get $500 free credits once Acme has paid $300 more.",
    );
    expect(promiseUnlockLine("$500", "$300", { referredOrgId: "org-a" })).toBe(
      "Get $500 free credits once your referral has paid $300 more.",
    );
  });

  it("uses no em-dash", () => {
    expect(promiseUnlockLine("$1", "$2")).not.toContain("\u2014");
  });
});

describe("promiseProgressLabel", () => {
  it("states the served progress as a whole percentage", () => {
    expect(promiseProgressLabel(44)).toBe("44%");
    expect(promiseProgressLabel(43.6)).toBe("44%");
    expect(promiseProgressLabel(0)).toBe("0%");
  });

  it("never rounds an unfinished promise up to a claim it has unlocked", () => {
    // 100% says the money is there. Rounding 99.6 into it on the one surface
    // whose job is to say how close you are would be a lie the reader acts on.
    expect(promiseProgressLabel(99.6)).toBe("99%");
    expect(promiseProgressLabel(100)).toBe("100%");
    expect(promiseProgressLabel(140)).toBe("100%");
  });

  it("never states 0% for a promise that has real payments behind it", () => {
    expect(promiseProgressLabel(0.3)).toBe("1%");
  });

  it("says nothing when the bar says nothing", () => {
    // The label and the bar read one served value, so they cannot disagree
    // about whether progress is measurable at all.
    expect(promiseProgressLabel(null)).toBeNull();
    expect(promiseProgressLabel(undefined)).toBeNull();
    expect(promiseProgressLabel(Number.NaN)).toBeNull();
  });
});

describe("promiseProgressSentence", () => {
  it("states where the promise stands and asks for the rest", () => {
    expect(promiseProgressSentence(18)).toBe("18% achieved. Keep going 💪");
    expect(promiseProgressSentence(0.3)).toBe("1% achieved. Keep going 💪");
    expect(promiseProgressSentence(99.6)).toBe("99% achieved. Keep going 💪");
  });

  it("drops the ask once the bar is full", () => {
    // Asking for more payments beside a full bar contradicts the number it
    // sits under: there is nothing left to keep going toward.
    expect(promiseProgressSentence(100)).toBe("100% achieved 🎉");
    expect(promiseProgressSentence(140)).toBe("100% achieved 🎉");
  });

  it("says nothing when the bar says nothing", () => {
    expect(promiseProgressSentence(null)).toBeNull();
    expect(promiseProgressSentence(undefined)).toBeNull();
    expect(promiseProgressSentence(Number.NaN)).toBeNull();
  });

  it("names the referred org's payments on a referral row", () => {
    expect(promiseUnlockLine("$500", "$300", { referredOrgId: "org-a", referredOrgName: "Acme" })).toBe(
      "Get $500 free credits once Acme has paid $300 more.",
    );
    expect(promiseUnlockLine("$500", "$300", { referredOrgId: "org-a" })).toBe(
      "Get $500 free credits once your referral has paid $300 more.",
    );
  });

  it("uses no em-dash", () => {
    expect(promiseProgressSentence(18)).not.toContain("\u2014");
  });
});
