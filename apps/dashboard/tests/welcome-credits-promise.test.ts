import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
      expect(read(rel), `${rel} must state the payments threshold`).toMatch(
        /payments reach \$400/i
      );
    }
  });

  it("the onboarding gift step states the $5 already banked", () => {
    const src = read("apps/dashboard/src/components/onboarding/onboarding.tsx");
    expect(src).toContain("$5 is in your account already.");
  });

  it("the landing JS surfaces bump their cache-buster past the fixed copy", () => {
    // A `public/landing/**` JS edit ships nothing visible unless every HTML that
    // links it bumps `?v=N`: the old query string is its own long-lived edge
    // cache key. main.js went to v9 and pricing-modal-v1.js (the homepage) to v6.
    const linked = [
      ["apps/landing/public/landing/index-v1.html", "js/pricing-modal-v1.js?v=6"],
      ["apps/landing/public/landing/pricing.html", "js/main.js?v=9"],
      ["apps/landing/public/landing/performance.html", "js/main.js?v=9"],
      ["apps/landing/public/landing/use-cases.html", "js/main.js?v=9"],
      ["apps/landing/public/landing/cold-email-cost-guide.html", "js/main.js?v=9"],
      ["apps/landing/public/landing/cold-email-vs-linkedin.html", "js/main.js?v=9"],
      ["apps/landing/public/landing/cold-email-for-saas-founders.html", "js/main.js?v=9"],
    ] as const;
    for (const [rel, expected] of linked) {
      expect(read(rel), `${rel} must link ${expected}`).toContain(expected);
    }
  });
});
