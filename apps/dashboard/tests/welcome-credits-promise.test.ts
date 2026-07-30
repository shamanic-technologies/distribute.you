import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The $25 welcome credits are ONE promise stated on several surfaces, and the
 * statement has to be identical everywhere or the product contradicts itself.
 *
 * What is true: an org gets $25 of free credits in total. $5 lands at signup;
 * the rest lands automatically once its CUMULATIVE PAYMENTS reach $25. When the
 * very first checkout is $50 or more, that $25 comes off the checkout as a
 * Stripe discount instead, and the buyer still pays $25, so the same sentence
 * holds in both branches.
 *
 * Two claims that were live for months and are FALSE:
 *   - a per-dollar match ("we match it, $1 for $1"). It is a flat $25 gated at a
 *     $25 threshold, so paying $10 earns nothing at all, let alone $10.
 *   - a SPEND trigger ("once your spend reaches $25"). The account is
 *     threshold-postpaid, so an org can consume on credit long before it pays
 *     anything; the gift is earned on money received, never on usage.
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
  [/dollar for dollar/i, "not a per-dollar match: flat $25 gated at $25 of payments"],
  [/\$1 for \$1/, "not a per-dollar match: flat $25 gated at $25 of payments"],
  [/we match (it|your first)/i, "not a match at all, it is a fixed gift"],
  [/spend reaches \$25/i, "the trigger is payments received, not usage consumed"],
  [/\$25 (of )?spend(ing)? dollar/i, "the trigger is payments received, not usage consumed"],
];

function read(rel: string): string {
  return readFileSync(join(REPO, rel), "utf8");
}

describe("$25 welcome-credits promise", () => {
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
        /payments reach \$25/i
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
    // cache key. main.js went to v8 and pricing-modal-v1.js (the homepage) to v5.
    const linked = [
      ["apps/landing/public/landing/index-v1.html", "js/pricing-modal-v1.js?v=5"],
      ["apps/landing/public/landing/pricing.html", "js/main.js?v=8"],
      ["apps/landing/public/landing/performance.html", "js/main.js?v=8"],
      ["apps/landing/public/landing/use-cases.html", "js/main.js?v=8"],
      ["apps/landing/public/landing/cold-email-cost-guide.html", "js/main.js?v=8"],
      ["apps/landing/public/landing/cold-email-vs-linkedin.html", "js/main.js?v=8"],
      ["apps/landing/public/landing/cold-email-for-saas-founders.html", "js/main.js?v=8"],
    ] as const;
    for (const [rel, expected] of linked) {
      expect(read(rel), `${rel} must link ${expected}`).toContain(expected);
    }
  });
});
