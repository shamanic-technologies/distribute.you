import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { welcomeHeadline, welcomeDetail } from "../src/lib/welcome-offer-copy";

/**
 * The $400 welcome credits are ONE promise stated on several surfaces, and the
 * statement has to be identical everywhere or the product contradicts itself.
 *
 * What is true: an org gets $400 of free credits in total. $5 lands at signup;
 * the rest lands automatically once its CUMULATIVE PAYMENTS reach $400. When the
 * very first checkout is $800 or more, that $400 comes off the checkout as a
 * Stripe discount instead, and the buyer still pays $400, so the same sentence
 * holds in both branches.
 *
 * The offer was re-priced from $25 to $400 for NEW customers only (2026-07-31).
 * An org's entitlement and its payments threshold are FROZEN on its billing
 * account when that account is created, so every org that signed up under the
 * old offer keeps $25 / $25 forever and nothing here re-prices it. These guards
 * therefore describe the copy shown to a NEW signup, which is the only cohort
 * any of these surfaces is rendered to.
 *
 * Two claims are FALSE and stay banned:
 *   - a PER-DOLLAR match ("$1 for $1", "dollar for dollar"). That reads as
 *     proportional at any amount, so it promises $10 back on a $10 payment, and
 *     nothing pays out below the $400 threshold.
 *   - a SPEND trigger ("once your spend reaches $400"). The account is
 *     threshold-postpaid, so an org can consume on credit long before it pays
 *     anything; the gift is earned on money received, never on usage.
 *
 * "We will match your first $400 with $400 free credits" is ALLOWED, by owner
 * decision (2026-07-31). It names the $400 threshold and the $400 payout, the two
 * numbers that are true, and claims nothing about smaller amounts. The earlier
 * ban treated it as equivalent to the per-dollar claim; it is not, and the $5 that
 * lands up front does not change the concept the sentence describes. This is
 * marketing copy, not a contract. Do not re-add the pattern.
 *
 * These guards read the served files directly because the surfaces span two
 * apps and only the dashboard suite is a CI merge gate. `archive-blue.html` is
 * deliberately absent: it is the frozen `/v2` era snapshot and must keep its
 * period copy.
 */

const REPO = join(__dirname, "..", "..", "..");

const SURFACES = [
  "apps/dashboard/src/components/onboarding/onboarding.tsx",
  // The gift step's two sentences moved here when the referral launched, because
  // a referred signup is owed BOTH offers and the step has to say so. See the
  // referred-cohort block at the bottom of this file.
  "apps/dashboard/src/lib/welcome-offer-copy.ts",
  "apps/dashboard/src/lib/onboarding-content.ts",
  "apps/dashboard/src/instrumentation.ts",
  "apps/landing/public/landing/js/main.js",
  "apps/landing/public/landing/js/pricing-modal-v1.js",
  "apps/landing/public/landing/pricing.html",
  "apps/landing/public/llms.txt",
] as const;

// Each pattern is a claim we must never make again, with the reason it is false.
const FALSE_CLAIMS: ReadonlyArray<readonly [RegExp, string]> = [
  [/dollar for dollar/i, "not a per-dollar match: flat $400 gated at $400 of payments"],
  [/\$1 for \$1/, "not a per-dollar match: flat $400 gated at $400 of payments"],
  [/spend reaches \$400/i, "the trigger is payments received, not usage consumed"],
  [/\$400 (of )?spend(ing)? dollar/i, "the trigger is payments received, not usage consumed"],
  // The re-price is only honoured for orgs created after it shipped, so no
  // customer-facing surface may still quote the retired $25 figure.
  [/\$25 (in |of )?(free |welcome |matched )?credits/i, "the offer is $400, not the retired $25"],
  [/payments reach \$25\b/i, "the offer is $400, not the retired $25"],
];

// Surfaces whose copy is BUILT from figures rather than written out, so the claim
// lives in the rendered string and is asserted there instead of in the source.
const COMPUTED_SURFACES = new Set<string>([
  // Owns the sentences, but builds them from figures.
  "apps/dashboard/src/lib/welcome-offer-copy.ts",
  // Renders them. It no longer spells the promise out anywhere, so there is no
  // literal to match — but it stays in SURFACES so the false-claim sweep still
  // covers every other thing it says about the offer.
  "apps/dashboard/src/components/onboarding/onboarding.tsx",
]);

function read(rel: string): string {
  return readFileSync(join(REPO, rel), "utf8");
}

describe("$400 welcome-credits promise", () => {
  for (const rel of SURFACES) {
    it(`${rel} makes no false claim about the gift`, () => {
      const src = read(rel);
      for (const [pattern, why] of FALSE_CLAIMS) {
        expect(pattern.test(src), `${rel} still claims ${pattern} (${why})`).toBe(false);
      }
    });
  }

  it("every surface names PAYMENTS as the trigger", () => {
    for (const rel of SURFACES) {
      // The gift step builds its two sentences from figures rather than spelling
      // them out, so its claim is checked against the RENDERED string below. The
      // rest of the surfaces are static copy and are read as source.
      if (COMPUTED_SURFACES.has(rel)) continue;
      expect(read(rel), `${rel} must state the payments threshold`).toMatch(
        /payments reach \$400/i
      );
    }
  });

  it("the gift step's rendered copy names PAYMENTS as the trigger", () => {
    // Asserted on the output, not the source: welcome-offer-copy.ts is alias-free
    // precisely so the real sentence can be tested instead of its ingredients.
    expect(welcomeDetail(false)).toMatch(/payments reach \$400/i);
    expect(welcomeDetail(true)).toMatch(/payments reach \$400/i);
  });

  it("the onboarding gift step states the $5 already banked", () => {
    expect(welcomeDetail(false)).toContain("$5 is in your account already.");
    expect(welcomeDetail(true)).toContain("$5 is in your account already.");
  });

  it("the gift step makes no false claim once rendered", () => {
    for (const sentence of [
      welcomeHeadline(false),
      welcomeHeadline(true),
      welcomeDetail(false),
      welcomeDetail(true),
    ]) {
      for (const [pattern, why] of FALSE_CLAIMS) {
        expect(pattern.test(sentence), `"${sentence}" claims ${pattern} (${why})`).toBe(false);
      }
    }
  });
});

/**
 * The REFERRED cohort states a different total, and that is not a contradiction.
 *
 * The guards above describe one promise made identically everywhere. A signup that
 * arrived through a referral link is owed TWO offers, $400 of welcome credits and
 * $500 of referral credits, and their payment bars STACK rather than overlap, so
 * the second lands at $900. Quoting $400 alone to that person understates what
 * they get by $500 on the screen where they decide to pay.
 *
 * It is shown only after the invite code has been VALIDATED against a real org, so
 * the larger figure is never promised on a code that resolves to nothing.
 */
describe("$900 referred-signup promise", () => {
  const copy = read("apps/dashboard/src/lib/welcome-offer-copy.ts");

  it("derives the stacked bar instead of hardcoding it", () => {
    // $900 is $400 + $500. Writing it as a literal is how the two drift apart the
    // next time either offer is re-priced.
    expect(copy).toContain("WELCOME_CREDIT_USD + REFERRAL_CREDIT_USD");
    expect(copy).not.toContain("$900");
  });

  it("names both bars, since the referral is gated on the second", () => {
    expect(copy).toContain("referral credits at");
  });

  it("is gated on a validated code, never on the cookie alone", () => {
    const src = read("apps/dashboard/src/components/onboarding/onboarding.tsx");
    expect(src).toContain("validateInvite");
    expect(src).toContain("if (cancelled || !res.valid) return;");
  });

  it("the landing JS surfaces bump their cache-buster past the fixed copy", () => {
    // A `public/landing/**` JS edit ships nothing visible unless every HTML that
    // links it bumps `?v=N`: the old query string is its own long-lived edge
    // cache key. main.js is at v11 and pricing-modal-v1.js (the homepage) at v7.
    const linked = [
      ["apps/landing/public/landing/index-v1.html", "js/pricing-modal-v1.js?v=7"],
      ["apps/landing/public/landing/pricing.html", "js/main.js?v=11"],
      ["apps/landing/public/landing/performance.html", "js/main.js?v=11"],
      ["apps/landing/public/landing/use-cases.html", "js/main.js?v=11"],
      ["apps/landing/public/landing/cold-email-cost-guide.html", "js/main.js?v=11"],
      ["apps/landing/public/landing/cold-email-vs-linkedin.html", "js/main.js?v=11"],
      ["apps/landing/public/landing/cold-email-for-saas-founders.html", "js/main.js?v=11"],
    ] as const;
    for (const [rel, expected] of linked) {
      expect(read(rel), `${rel} must link ${expected}`).toContain(expected);
    }
  });
});
