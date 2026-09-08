import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { welcomeHeadline, welcomeDetail } from "../src/lib/welcome-offer-copy";

/**
 * The welcome credits are ONE promise stated on several surfaces, and the
 * statement has to be identical everywhere or the product contradicts itself.
 *
 * What is true: a new org receives $30 of free credit the moment its account is
 * created. There is no threshold, no second instalment and nothing to claim.
 *
 * The offer used to be a MATCH — $5 up front and $395 more once cumulative
 * payments reached $400 — so most of what these guards used to enforce was about
 * naming that threshold correctly. There is no threshold left to name, which is
 * why the assertions here INVERT rather than move: a surface that still tells a
 * new signup to reach some figure before their credits land is now describing a
 * retired offer.
 *
 * The gift reaches the buyer through TWO sides of one $30, never two gifts:
 * billing grants the $30, and the first checkout charges the daily budget MINUS
 * that $30 (`planFirstCharge`). A $50/day signup pays $20 and starts with $50 of
 * balance; a $30/day signup pays nothing and starts with $30. The gift is exactly
 * $30 in both, which is the invariant `onboarding-charge.test.ts` holds.
 *
 * Re-pricing is grandfather-safe by construction: an org's entitlement is FROZEN
 * on its billing account at creation, so orgs that signed up under the $400 or
 * the $25 offer keep theirs forever and nothing here re-prices them. These guards
 * describe the copy shown to a NEW signup, which is the only cohort any of these
 * surfaces is rendered to.
 *
 * Three claims are FALSE and stay banned:
 *   - a PER-DOLLAR match ("$1 for $1", "dollar for dollar"). It reads as
 *     proportional at any amount and nothing about this offer is proportional.
 *   - a MATCH of any kind ("we will match your first…"). The $30 is given, not
 *     matched; a match names a payment the buyer must make first.
 *   - a THRESHOLD on the welcome credits ("once your payments reach…"). Only the
 *     REFERRAL credits are still earned that way, and their sentence names the
 *     referral explicitly.
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
  "apps/landing/public/llms.txt",
  "apps/landing/src/lib/v2-shell.ts",
  "apps/landing/src/lib/pages/about.ts",
  "apps/landing/src/app/terms/page.tsx",
  "apps/landing/src/app/layout.tsx",
  // The referred-signup banner injected into every static page. It stated the
  // whole retired offer ("$5 lands now, $400 once your payments reach $400") and
  // was outside this list, so nothing went red while it shipped to production.
  "apps/landing/src/lib/static-html.ts",
] as const;

// Each pattern is a claim we must never make again, with the reason it is false.
const FALSE_CLAIMS: [RegExp, string][] = [
  [/dollar for dollar/i, "the $30 is given outright, not matched per dollar"],
  [/\$1 for \$1/, "the $30 is given outright, not matched per dollar"],
  [/we will match your first/i, "the $30 is given at signup; a match names a payment first"],
  // The threshold belongs to the REFERRAL credits alone. A sentence that gates the
  // WELCOME credits on payments is describing the retired match.
  [/welcome credits (land|arrive)[^.]{0,40}payments reach/i, "the welcome credits land at signup, with no threshold"],
  [/rest lands[^.]{0,40}payments reach/i, "there is no second instalment left to land"],
  // Phrasing-independent: the welcome credits are not gated on ANY payment, so a
  // "$N once your payments reach $N" clause is the retired match whatever words
  // surround it. The referral sentence survives because its bar is the SUM, which
  // is never equal to itself on both sides.
  [/\$(\d[\d,]*) once your payments reach \$\1\b/i, "the welcome credits are not gated on a payment"],
  [/\$5 lands (now|at signup)/i, "the whole gift lands at signup; there is no up-front slice"],
  [/\$400 (in |of )?(free |welcome |matched )?credits/i, "the offer is $30, not the retired $400"],
  [/\$25 (in |of )?(free |welcome |matched )?credits/i, "the offer is $30, not the retired $25"],
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

  it("every surface states the credits are already there", () => {
    for (const rel of SURFACES) {
      // The gift step builds its two sentences from figures rather than spelling
      // them out, so its claim is checked against the RENDERED string below. The
      // rest of the surfaces are static copy and are read as source.
      if (COMPUTED_SURFACES.has(rel)) continue;
      expect(read(rel), `${rel} must name the $30`).toMatch(/\$30/);
    }
  });

  it("the gift step's rendered copy states no threshold on the welcome credits", () => {
    // Asserted on the output, not the source: welcome-offer-copy.ts is alias-free
    // precisely so the real sentence can be tested instead of its ingredients.
    // The plain signup states no threshold at all. The referred one states ONE, and
    // it belongs to the referral credits — which is why the sentence names them.
    expect(welcomeDetail(false)).not.toMatch(/payments reach/i);
    expect(welcomeDetail(true)).toMatch(/referral credits land once your payments reach/i);
  });

  it("the onboarding gift step states the whole $30 already banked", () => {
    // The whole gift, not a slice of it: there is no second instalment behind this
    // sentence any more, so naming a smaller up-front figure would understate it.
    expect(welcomeDetail(false)).toContain("$30 is in your account already.");
    expect(welcomeDetail(true)).toContain("$30 is in your account already.");
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
 * arrived through a referral link is owed TWO offers: $30 of welcome credits, given
 * at signup, and $500 of referral credits, still earned on payments. Their bars
 * STACK rather than overlap, so the referral one lands at the sum. Quoting the
 * welcome figure alone to that person understates what they get by $500, on the
 * screen where they decide to pay.
 *
 * The stacked figure is DERIVED from the two amounts and never written out: it is
 * billing's ladder, so a literal here would state a bar billing does not hold the
 * next time either offer is re-priced.
 *
 * It is shown only after the invite code has been VALIDATED against a real org, so
 * the larger figure is never promised on a code that resolves to nothing.
 */
describe("referred-signup promise", () => {
  const copy = read("apps/dashboard/src/lib/welcome-offer-copy.ts");

  it("derives the stacked bar instead of hardcoding it", () => {
    // Writing the sum as a literal is how the two drift apart the next time
    // either offer is re-priced — which is exactly what this change is.
    expect(copy).toContain("WELCOME_CREDIT_USD + REFERRAL_CREDIT_USD");
    expect(copy).not.toContain("$900");
    expect(copy).not.toContain("$530");
  });

  it("names the referral bar, since that half really is gated", () => {
    expect(copy).toContain("referral credits land once your");
  });

  it("is gated on a validated code, never on the cookie alone", () => {
    const src = read("apps/dashboard/src/components/onboarding/onboarding.tsx");
    expect(src).toContain("validateInvite");
    expect(src).toContain("if (cancelled || !res.valid) return;");
  });

  it("the homepage and every rendered page read the same stylesheet version", () => {
    // A `public/landing/v2/**` edit ships nothing visible unless every page that
    // links it bumps `?v=N`: the old query string is its own long-lived edge cache
    // key. The rendered pages read the constant; the hand-written homepage carries
    // the literal, so the two are pinned equal here.
    const shellSrc = read("apps/landing/src/lib/v2-shell.ts");
    const version = /export const V2_STYLES_VERSION = (\d+);/.exec(shellSrc)?.[1];
    expect(version).toBeTruthy();
    const home = read("apps/landing/public/landing/index-v2.html");
    expect(home).toContain(`/landing/v2/styles.css?v=${version}`);
  });
});

/**
 * The two guards above are the ones that let a retired figure reach production,
 * and they failed for two INDEPENDENT reasons — either one alone was enough.
 *
 * The first is that `SURFACES` is a hand-written list, so it says what somebody
 * remembered rather than what the site serves. Two SEO pages under
 * `apps/landing/public/landing/**` stated "$400 in free credits, granted at
 * signup" for as long as the re-price had shipped, and `FALSE_CLAIMS` already
 * carried a pattern that matches that sentence exactly. It never ran on them.
 *
 * The second is worse, because it survives any surface list: the claim was SPLIT
 * ACROSS TWO ELEMENTS — `<span>$400</span><span>in free credits…</span>` — and a
 * regex over source can only see one line at a time, so the figure and the words
 * it qualifies never appeared in the same string. A tile, a stat row and a
 * definition list all have this shape; prose is the exception, not the rule.
 *
 * So this sweep does the two things the enumerated guard cannot: it walks every
 * page the landing actually serves rather than a list, and it strips the markup
 * first, so a claim assembled out of neighbouring elements reads as the sentence
 * a visitor sees. `archive-blue.html` is excluded by name — it is the frozen /v2
 * era snapshot and keeps its period copy, which is the one place a retired figure
 * is correct.
 *
 * The ban is on the SHAPE (any figure qualifying "credits") rather than on the
 * retired amounts, so the next re-price does not need a new pattern; and the
 * REFERRAL credits are exempt by their own qualifier, because they are a
 * different offer with a different amount and are still earned on payments.
 */
describe("every served landing page states the gift at one figure", () => {
  const LANDING = join(REPO, "apps/landing/public/landing");
  const ARCHIVES = new Set(["archive-blue.html"]);

  // "$30 in free credits", "$30 free credits", "$30 of free credit" — and the
  // same sentence with the markup taken out from under it.
  const CREDIT_FIGURE =
    /\$([\d,]+)\s*(?:in |of )?(?:free |welcome |matched |bonus )?credits?\b/gi;
  const REFERRAL_NEARBY = /referral/i;

  function servedPages(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...servedPages(full));
      else if (entry.name.endsWith(".html") && !ARCHIVES.has(entry.name)) out.push(full);
    }
    return out;
  }

  /** What a visitor reads, with the elements the claim was hiding between removed. */
  function visibleText(html: string): string {
    return html
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");
  }

  function wrongFigures(html: string): string[] {
    const text = visibleText(html);
    const wrong: string[] = [];
    for (const m of text.matchAll(CREDIT_FIGURE)) {
      const context = text.slice(Math.max(0, m.index! - 60), m.index! + m[0].length + 20);
      if (REFERRAL_NEARBY.test(context)) continue;
      if (m[1] !== "30") wrong.push(`$${m[1]} — "${context.trim()}"`);
    }
    return wrong;
  }

  const pages = servedPages(LANDING);

  it("finds the pages to check", () => {
    // A sweep that walks nothing passes silently, which is the failure mode it
    // exists to remove.
    expect(pages.length).toBeGreaterThan(20);
  });

  for (const page of pages) {
    const rel = page.slice(REPO.length + 1);
    it(`${rel} names no gift figure but $30`, () => {
      expect(wrongFigures(readFileSync(page, "utf8"))).toEqual([]);
    });
  }

  // Both directions, per the rule that a ban is only trustworthy once it has been
  // shown to catch the copy that shipped AND to pass the copy replacing it.
  it("catches the retired claim, split across elements exactly as it shipped", () => {
    const shipped =
      '<div class="guide-callout guide-callout-green">\n' +
      '  <span class="guide-callout-n">$400</span>\n' +
      '  <span class="guide-callout-l">in free credits, granted at signup</span>\n' +
      "</div>";
    expect(wrongFigures(shipped)).toHaveLength(1);
  });

  it("passes the copy that replaced it", () => {
    const fixed =
      '<div class="guide-callout guide-callout-green">\n' +
      '  <span class="guide-callout-n">$30</span>\n' +
      '  <span class="guide-callout-l">in free credits, granted at signup</span>\n' +
      "</div>";
    expect(wrongFigures(fixed)).toEqual([]);
  });

  it("leaves the referral credits alone — a different offer at a different amount", () => {
    expect(wrongFigures("<p>Your referral credits are $500 in free credits.</p>")).toEqual([]);
  });
});
