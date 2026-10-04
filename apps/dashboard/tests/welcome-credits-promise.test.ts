import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { SUBSCRIPTION_AMOUNT_OPTIONS_CENTS } from "../src/lib/subscription-plan";

/**
 * The welcome credits are ONE promise stated on several surfaces, and the
 * statement has to be identical everywhere or the product contradicts itself.
 *
 * Since 2026-10-03 the DEFAULT offer is the $99/month plan with a 3-day free trial
 * (owner: "we stop talking about $1/day"). Dashboard signup surfaces must not promise
 * the $30 or $1/day (block below); landing surfaces are no longer REQUIRED to name
 * the $30, only forbidden to name a retired figure. The $30 below is the
 * pay-as-you-go cohort's offer (a visitor whose `lp_variant` names another variant).
 *
 * What is true for that cohort: a new org receives $30 of free credit the moment its
 * account is created. There is no threshold, no second instalment and nothing to claim.
 *
 * The offer used to be a MATCH — $5 up front and $395 more once cumulative
 * payments reached $400 — so most of what these guards used to enforce was about
 * naming that threshold correctly. There is no threshold left to name, which is
 * why the assertions here INVERT rather than move: a surface that still tells a
 * new signup to reach some figure before their credits land is now describing a
 * retired offer.
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

function read(rel: string): string {
  return readFileSync(join(REPO, rel), "utf8");
}

/**
 * The $99/month plan is the default offer (owner 2026-10-03: "we stop talking about
 * $1/day"). Every signup-facing dashboard surface a visitor meets before choosing
 * sells it, so none of them may promise the pay-as-you-go $30 or $1/day. The
 * pay-as-you-go wall copy (`wallCopy({ subscription: false })`) is exempt: only a
 * visitor whose `lp_variant` cookie names another variant ever reads it.
 */
describe("signup-facing surfaces sell the $99/month plan", () => {
  const STATIC = [
    "apps/dashboard/src/components/auth/auth-brand-panel.tsx",
    "apps/dashboard/src/app/(authed)/sign-up/[[...sign-up]]/page.tsx",
  ];
  const RETIRED = [/\$30/, /\$1 ?\/ ?day/, /\$1 (a|per) day/, /from \$1\b/i];

  for (const rel of STATIC) {
    it(`${rel} promises no $30 and no $1/day`, () => {
      const src = read(rel);
      for (const pattern of RETIRED) expect(pattern.test(src), `${rel} still says ${pattern}`).toBe(false);
    });
  }

  it("the welcome email sells the 3-day trial, in both bodies", () => {
    const src = read("apps/dashboard/src/instrumentation.ts");
    const start = src.indexOf('name: "welcome"');
    const tpl = src.slice(start, src.indexOf('name: "goal_launched"'));
    expect(start).toBeGreaterThan(-1);
    for (const pattern of RETIRED) expect(pattern.test(tpl), `welcome still says ${pattern}`).toBe(false);
    expect(tpl.split("Your first 3 days are free").length - 1).toBe(2);
  });
});

describe("$400 welcome-credits promise", () => {
  for (const rel of SURFACES) {
    it(`${rel} makes no false claim about the gift`, () => {
      const src = read(rel);
      for (const [pattern, why] of FALSE_CLAIMS) {
        expect(pattern.test(src), `${rel} still claims ${pattern} (${why})`).toBe(false);
      }
    });
  }
});

describe("landing stylesheet version", () => {
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
 * a visitor sees. Since #3958 the landing serves ONE hand-written document
 * (`index-v2.html`); every other page (About, Contact, Developers, the 404, the
 * comparison cluster) is rendered from TypeScript under `apps/landing/src/lib`,
 * so the sweep reads those sources too: the copy is a string literal in them and
 * the same shape check applies.
 *
 * The ban is on the SHAPE (any figure qualifying "credits") rather than on the
 * retired amounts, so the next re-price does not need a new pattern; and the
 * REFERRAL credits are exempt by their own qualifier, because they are a
 * different offer with a different amount and are still earned on payments.
 */
describe("every served landing page states the gift at one figure", () => {
  const LANDING = join(REPO, "apps/landing/public/landing");
  const RENDERED = join(REPO, "apps/landing/src/lib");
  const ARCHIVES = new Set<string>();

  // "$30 in free credits", "$30 free credits", "$30 of free credit" — and the
  // same sentence with the markup taken out from under it.
  const CREDIT_FIGURE =
    /\$([\d,]+)\s*(?:in |of )?(?:free |welcome |matched |bonus )?credits?\b/gi;
  const REFERRAL_NEARBY = /referral/i;
  // The $30 (pay-as-you-go cohort, still served until the landing drops it) and the
  // $99/month plan's ladder: on the plan, the amount paid IS the campaign credit
  // ("$99 of credit"). Any other figure is a retired offer ($400, $25, $5).
  const ALLOWED_CREDIT_FIGURES = new Set<string>([
    "30",
    ...SUBSCRIPTION_AMOUNT_OPTIONS_CENTS.map((c) => String(c / 100)),
    ...SUBSCRIPTION_AMOUNT_OPTIONS_CENTS.map((c) => (c / 100).toLocaleString("en-US")),
  ]);

  function servedPages(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...servedPages(full));
      else if (entry.name.endsWith(".html") && !ARCHIVES.has(entry.name)) out.push(full);
    }
    return out;
  }

  /** The TypeScript that renders every page that is not the homepage. */
  function renderedPageSources(): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(join(RENDERED, "pages"))) {
      if (entry.endsWith(".ts")) out.push(join(RENDERED, "pages", entry));
    }
    for (const name of ["v2-shell.ts", "compare-page.ts", "competitors.ts"]) {
      out.push(join(RENDERED, name));
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
      if (!ALLOWED_CREDIT_FIGURES.has(m[1])) wrong.push(`$${m[1]} — "${context.trim()}"`);
    }
    return wrong;
  }

  const pages = [...servedPages(LANDING), ...renderedPageSources()];

  it("finds the pages to check", () => {
    // A sweep that walks nothing passes silently, which is the failure mode it
    // exists to remove: the homepage, four document pages, and the three modules
    // the comparison cluster is rendered from.
    expect(pages.length).toBeGreaterThanOrEqual(8);
    expect(pages.some((p) => p.endsWith("index-v2.html"))).toBe(true);
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

  it("passes the $99/month plan's credit, and still catches a retired figure beside it", () => {
    expect(wrongFigures("<p>$99 of credit each month. $1,999 of credit on the top plan.</p>")).toEqual([]);
    expect(wrongFigures("<p>$99 of credit, plus $25 in free credits.</p>")).toHaveLength(1);
  });

  it("leaves the referral credits alone — a different offer at a different amount", () => {
    expect(wrongFigures("<p>Your referral credits are $500 in free credits.</p>")).toEqual([]);
  });
});
