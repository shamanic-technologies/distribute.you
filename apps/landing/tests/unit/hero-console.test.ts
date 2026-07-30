import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  formatCacPercent,
  formatMultiple,
  heroMonthlyOutcomes,
  heroRoiChain,
} from "../../src/lib/static-html";

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

describe("heroRoiChain", () => {
  // The shipped constants: $50/day, 31 days, the #roi calculator's own $2,500
  // lifetime revenue, 30-70% closing.
  const chain = (cost: number) => heroRoiChain(50, 31, cost, 2500, 30, 70);

  it("carries the whole chain from spend to cost of acquisition", () => {
    expect(chain(72)).toEqual({
      buyers: 22,
      salesLow: 7,
      salesHigh: 15,
      cacPctLow: "4%",
      cacPctHigh: "9%",
    });
  });

  it("reports the band low to high, which INVERTS against the sales band", () => {
    // Closing more of the same buyers earns more revenue for the same spend,
    // so the best case is the CHEAPEST percentage. Getting this backwards
    // would headline the worst case.
    const c = chain(72)!;
    expect(Number(c.cacPctLow.replace("%", ""))).toBeLessThan(
      Number(c.cacPctHigh.replace("%", "")),
    );
  });

  it("states a cost a reader can check against the numbers on screen", () => {
    // $1,550 spent against 7 × $2,500 of revenue is 8.9%, and against
    // 15 × $2,500 it is 4.1%. Deriving from the ROUNDED sales is what makes
    // the visible arithmetic hold; #roi does the exact version.
    const c = chain(72)!;
    expect(((50 * 31) / (c.salesLow * 2500)) * 100).toBeCloseTo(8.86, 1);
    expect(((50 * 31) / (c.salesHigh * 2500)) * 100).toBeCloseTo(4.13, 1);
  });

  it("never pairs the top of two bands", () => {
    // A $20,000 ticket does not close at 70%, so pairing both optimistic ends
    // describes a client who does not exist and prints a 0.5% acquisition cost
    // nobody believes. Only the win rate is banded.
    const c = chain(72)!;
    expect(Number(c.cacPctLow.replace("%", ""))).toBeGreaterThan(1);
  });

  it("follows the live rate: a cheaper reply lowers the cost of acquisition", () => {
    const dear = chain(150)!;
    const cheap = chain(40)!;
    expect(cheap.buyers).toBeGreaterThan(dear.buyers);
    expect(cheap.salesHigh).toBeGreaterThan(dear.salesHigh);
    expect(Number(cheap.cacPctHigh.replace("%", ""))).toBeLessThan(
      Number(dear.cacPctHigh.replace("%", "")),
    );
  });

  it("drops the chain rather than printing a band it cannot stand behind", () => {
    expect(chain(0)).toBeNull();
    expect(chain(Number.NaN)).toBeNull();
    // A rate so dear that the low end rounds to zero sales would print a 0x
    // return beside a running campaign. At $1,500 the budget buys one buyer a
    // month, and 30% of one rounds to none.
    expect(chain(1500)).toBeNull();
    expect(heroRoiChain(50, 31, 72, 0, 30, 70)).toBeNull();
    // A band whose high end sits below its low end is not a band.
    expect(heroRoiChain(50, 31, 72, 2500, 70, 30)).toBeNull();
  });
});

describe("formatMultiple", () => {
  it("keeps precision below ten and rounds above it", () => {
    expect(formatMultiple(24.19)).toBe("24×");
    expect(formatMultiple(3.44)).toBe("3.4×");
    expect(formatMultiple(Number.NaN)).toBeNull();
    expect(formatMultiple(-1)).toBeNull();
  });
});

describe("formatCacPercent", () => {
  it("rounds whole percents and keeps a decimal below one", () => {
    // Rounding 0.4% to "0%" would claim acquisition is free.
    expect(formatCacPercent(8.86)).toBe("9%");
    expect(formatCacPercent(4.13)).toBe("4%");
    expect(formatCacPercent(0.42)).toBe("0.4%");
    expect(formatCacPercent(0)).toBeNull();
    expect(formatCacPercent(Number.NaN)).toBeNull();
  });
});

describe("hero console markup", () => {
  it("finds the hero section it guards", () => {
    expect(heroStart).toBeGreaterThan(-1);
    expect(hero).toContain("console-body");
  });

  it("reads every number from the live rate, never a literal", () => {
    // One token now, so the budget and everything derived from it are built in
    // a single place and cannot be edited apart.
    expect(hero).toContain("__HERO_CONSOLE__");
    expect(hero).not.toContain("__HERO_BUDGET__");
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

  it("keeps the typed site in the window chrome, not in a row of its own", () => {
    // A full row restated the URL field sitting inches to its left: a duplicate
    // label costing a whole row. The title bar keeps the personalisation free.
    expect(hero).toContain('class="console-title"');
    expect(html).not.toContain("console-url");
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

  it("collapses the chain rows instead of hiding them in place", () => {
    // An invisible row still occupies its space, which stretched the card to
    // full height and left a tall blank under the counter while it counted.
    expect(html).toContain('.console-chain[data-reveal]>*{display:none}');
    expect(html).not.toContain('[data-reveal="pending"]{opacity:0}');
  });

  it("grows the card one row at a time", () => {
    expect(html).toContain("el.classList.add('is-in');},idx*140);");
  });

  it("does not replay the reveal when the count re-runs", () => {
    expect(html).toContain("chainEl.getAttribute('data-reveal')==='done')return;");
  });

  it("honours a reduced-motion preference", () => {
    expect(html).toContain("prefers-reduced-motion: reduce");
    expect(html).toContain("if(reduce){countEl.textContent=String(target);revealChain();return;}");
  });
});

describe("hero console server render", () => {
  it("writes the real count into the text, not only the animation attribute", () => {
    // A scraper and a reader with JS off both get the figure; the attribute is
    // only what the count-up animates towards.
    expect(staticHtmlSrc).toContain(
      '<i data-hero-outcome="${chain.buyers}">${chain.buyers}</i>',
    );
  });

  it("keeps only the budget when the rate cannot be graded", () => {
    // The budget is true whatever the rate does, but with nothing to hand over
    // there are no two zones to name.
    expect(staticHtmlSrc).toContain("if (chain === null) return budgetRow;");
  });

  it("names the buyer the product actually finds", () => {
    expect(staticHtmlSrc).toContain("<span>Interested B2B buyers</span>");
  });

  it("says who does which half", () => {
    expect(staticHtmlSrc).toContain('<p class="zone-label">distribute.you handles</p>');
    expect(staticHtmlSrc).toContain('<p class="zone-label">You handle</p>');
    // The cost of acquisition gets no third label: it is already the arrival
    // point, and naming it would restate what its own treatment says.
    expect(staticHtmlSrc).not.toContain("zone-label\">Together");
  });

  it("groups the zones with whitespace, never a nested box", () => {
    // A boundary is the stronger grouping, but it is the right tool only when
    // whitespace is unavailable; a second border inside a bordered card is ink
    // carrying no data.
    const zone = html.slice(html.indexOf(".zone-label{"), html.indexOf(".zone-label{") + 260);
    expect(zone).not.toMatch(/border|background/);
    expect(zone).toContain("margin:20px 0 9px");
    // Scoped to the body: the second label is the first child of the chain
    // block, and an unscoped :first-child strips the gap between the halves.
    expect(html).toContain(".console-body>.zone-label:first-child{margin-top:0}");
    expect(html).not.toContain("\n    .zone-label:first-child{margin-top:0}");
  });

  it("explains why the budget buys that many buyers", () => {
    // The one link the chain never showed. Every step is checkable now.
    expect(staticHtmlSrc).toContain("per interested buyer");
    expect(staticHtmlSrc).toContain("usdSmart(costPerOutcomeUsd)");
  });

  it("labels the two chain figures as the reader's own", () => {
    // "Your sales" and "Your return", under arrows that state the assumption
    // being applied, so neither reads as a result we are claiming for them.
    expect(staticHtmlSrc).toContain("<span>Your sales</span>");
    expect(staticHtmlSrc).toContain("<span>Your cost of acquisition</span>");
    // The label and the arrow above it already give the denominator. Spelling
    // out "of revenue" pushed the headline figure onto a second line at 320px.
    expect(staticHtmlSrc).not.toContain("of revenue");
    expect(staticHtmlSrc).toContain("% of them become customers");
    expect(staticHtmlSrc).toContain("lifetime value each");
  });

  it("spends the same lifetime revenue the ROI calculator defaults to", () => {
    // Two surfaces telling different stories about the same brand is the bug
    // this whole card exists to avoid.
    expect(staticHtmlSrc).toContain("ROI_DEFAULT_LTR_USD,");
  });

  it("derives the budget label from the same constant as the count", () => {
    expect(staticHtmlSrc).toContain("heroChainRows(boot.best)");
    expect(staticHtmlSrc).toContain("$${HERO_DAILY_BUDGET_USD} / day");
  });
});
