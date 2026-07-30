import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { heroMonthlyOutcomes } from "../../src/lib/static-html";

const homepagePath = path.resolve(
  __dirname,
  "../../public/landing/index-v1.html",
);
const html = fs.readFileSync(homepagePath, "utf-8");

const staticHtmlPath = path.resolve(__dirname, "../../src/lib/static-html.ts");
const staticHtmlSrc = fs.readFileSync(staticHtmlPath, "utf-8");

// The three-letter squares are only wrong ABOVE THE FOLD, where they re-told
// the pipeline story instead of selling. The #stack section further down uses
// the same acronyms deliberately, so a file-wide guard would assert something
// this change does not mean.
const heroStart = html.indexOf('<section class="hero">');
const hero = html.slice(heroStart, html.indexOf("</section>", heroStart));

describe("heroMonthlyOutcomes", () => {
  it("buys a whole month of the daily budget at the live rate", () => {
    // $50 a day for 31 days is $1,550; at $72 a reply that is 21.5, rounded.
    expect(heroMonthlyOutcomes(50, 31, 72)).toBe(22);
  });

  it("follows the live rate down", () => {
    const dearer = heroMonthlyOutcomes(50, 31, 120);
    const cheaper = heroMonthlyOutcomes(50, 31, 40);
    expect(dearer).toBe(13);
    expect(cheaper).toBe(39);
    expect(cheaper!).toBeGreaterThan(dearer!);
  });

  it("returns null rather than a number we did not measure", () => {
    // An ungradable rate is not a cheap campaign. The row is dropped instead.
    expect(heroMonthlyOutcomes(50, 31, 0)).toBeNull();
    expect(heroMonthlyOutcomes(50, 31, Number.NaN)).toBeNull();
    expect(heroMonthlyOutcomes(50, 31, -10)).toBeNull();
    expect(heroMonthlyOutcomes(0, 31, 72)).toBeNull();
    expect(heroMonthlyOutcomes(50, 0, 72)).toBeNull();
  });

  it("returns null when the budget cannot buy even one outcome", () => {
    // Rounding to zero would print "0 per month" beside a running campaign.
    expect(heroMonthlyOutcomes(50, 31, 10_000)).toBeNull();
  });
});

describe("hero console markup", () => {
  it("finds the hero section it guards", () => {
    expect(heroStart).toBeGreaterThan(-1);
    expect(hero).toContain("console-body");
  });

  it("reads both numbers from the live rate, never a literal", () => {
    expect(hero).toContain("__HERO_BUDGET__");
    expect(hero).toContain("__HERO_OUTCOME_ROW__");
    // The old card stated a budget and an outcome that came from nowhere and
    // could not move when the live cost per reply moved.
    expect(hero).not.toContain("$10 / day");
    expect(hero).not.toContain("126 positive replies");
  });

  it("drops the five three-letter pipeline squares", () => {
    // The pipeline is what #how and #engine are for. Above the fold it re-told
    // their story worse, and on a phone it collapsed into a 2+2+1 grid of
    // orphan boxes once the connecting arrows were hidden.
    expect(hero).not.toContain(">RCH<");
    expect(hero).not.toContain(">SND<");
    expect(hero).not.toContain(">INT<");
    // The rules went too, so nothing can quietly render them again.
    expect(html).not.toContain("flow-icon");
    expect(html).not.toContain("flow-step");
    expect(html).not.toContain("flow-label");
  });

  it("drops the rows the analyzed check already states", () => {
    expect(hero).not.toContain("Likely buyers");
    expect(hero).not.toContain("Primary objective");
    expect(html).not.toContain("analysis-card");
    expect(html).not.toContain("analysis-row");
  });

  it("names the visitor's own site as they type it", () => {
    expect(html).toContain("data-hero-domain");
    expect(html).toContain('document.getElementById(\'website-url\')');
  });

  it("keeps the placeholder when the typed value is not yet a domain", () => {
    // A half-typed host would otherwise render as the visitor's broken domain.
    expect(html).toContain("hostOf(input.value)||placeholder");
  });

  it("shows every whole number rather than easing past most of them", () => {
    // An eased ramp renders 0, 3, 7, 12, 16 and calls it a count. The clock has
    // to pick the integer, so each one gets its own beat on screen.
    expect(html).toContain("Math.floor((now-start)/hold)");
    expect(html).not.toContain("Math.pow(1-p,3)");
  });

  it("lets a newer count take the element from the one still running", () => {
    // Typing re-triggers the count, and two loops writing the same node race.
    expect(html).toContain("if(run!==countRun)return;");
  });

  it("honours a reduced-motion preference", () => {
    expect(html).toContain("prefers-reduced-motion: reduce");
    expect(html).toContain("if(reduce){countEl.textContent=String(target);return;}");
  });
});

describe("hero console server render", () => {
  it("writes the real count into the text, not only the animation attribute", () => {
    // A scraper and a reader with JS off both get the figure; the attribute is
    // only what the count-up animates towards.
    expect(staticHtmlSrc).toContain(
      '<i data-hero-outcome="${count}">${count}</i>',
    );
  });

  it("omits the whole row when the rate cannot be graded", () => {
    expect(staticHtmlSrc).toContain("if (count === null) return \"\";");
  });

  it("names the buyer the product actually finds", () => {
    expect(staticHtmlSrc).toContain("<span>Interested B2B buyers</span>");
  });

  it("derives the budget label from the same constant as the count", () => {
    expect(staticHtmlSrc).toContain(
      "`$${HERO_DAILY_BUDGET_USD} / day`",
    );
    expect(staticHtmlSrc).toContain("heroOutcomeRow(boot.best)");
  });
});
