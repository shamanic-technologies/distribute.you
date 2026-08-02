import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const deck = read("src/components/investors/investor-deck-view.tsx");

/**
 * Strip comments before asserting an ABSENCE. This file's own doc comments
 * explain why the cap is withheld, and a whole-file `not.toContain("valuation
 * cap")` fires on that explanation rather than on rendered copy.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

const deckRendered = stripComments(deck);
const css = read("src/app/globals.css");
const sidebar = read("src/components/context-sidebar.tsx");

describe("deck nav", () => {
  it("sits in the Investors section", () => {
    const at = sidebar.indexOf("function AppLevelSidebar(");
    const block = sidebar.slice(at, sidebar.indexOf("\n// Org Level Sidebar", at));
    expect(block).toContain('href: "/investors/deck"');
    expect(block.indexOf('href: "/investors/deck"')).toBeGreaterThan(block.indexOf(">Investors<"));
  });
});

describe("deck figures", () => {
  it("reads every number from a served reader — a deck is the worst place for a hardcoded stat", () => {
    for (const reader of ["getFleetRevenue", "getActiveUsersHistory", "getCustomerSuccess"]) {
      expect(deck).toContain(reader);
    }
  });

  it("derives growth with the same helpers the metrics page uses, not a local formula", () => {
    expect(deck).toContain("compoundGrowthSummary");
    expect(deck).toContain("compoundGrowthSeries");
  });

  it("stamps the edition from the week the figures report on, so cover and chart cannot disagree", () => {
    expect(deck).toContain("deckVersion(figures.revenue.weeksUsed, now)");
  });

  it("names the filename from that same version", () => {
    expect(deck).toContain("deckFileName(version)");
  });

  it("states each chart's conclusion in words rather than making the reader derive it", () => {
    expect(deck).toContain("growthConclusion(");
  });
});

describe("the ask", () => {
  it("never prints a valuation cap — deal terms belong in the conversation, not a forwarded deck", () => {
    expect(deckRendered.toLowerCase()).not.toContain("valuation cap");
    expect(deckRendered).not.toContain("post-money valuation");
    // No "$7.5M"-shaped figure anywhere in the rendered copy.
    expect(deckRendered).not.toMatch(/\$\s?\d+(\.\d+)?\s?M\b/);
  });

  it("names the amount and the instrument", () => {
    expect(deck).toContain("RAISE_AMOUNT_USD");
    expect(deck).toContain("RAISE_INSTRUMENT");
  });

  it("carries the milestone the raise buys", () => {
    expect(deck).toContain("$100K MRR");
  });
});

describe("print rules", () => {
  it("prints one slide per page and never splits one across two", () => {
    expect(css).toContain("break-after: page");
    expect(css).toContain("break-inside: avoid");
  });

  it("does not emit a trailing blank page after the last slide", () => {
    expect(css).toContain(".deck-slide:last-child");
    expect(css).toMatch(/\.deck-slide:last-child\s*\{\s*break-after:\s*auto/);
  });

  it("drops the app chrome, so nothing the investor should not see reaches the PDF", () => {
    const at = css.indexOf("@media print");
    const printBlock = css.slice(at);
    expect(printBlock).toContain(".deck-chrome");
    expect(printBlock).toContain("aside");
  });

  it("keeps background colours, which Chrome and Safari drop in print unless asked", () => {
    expect(css).toContain("print-color-adjust: exact");
  });

  it("holds slides at 16:9 on screen, so what overflows in the browser overflows on the page", () => {
    expect(css).toContain("aspect-ratio: 16 / 9");
  });

  it("prints landscape with no page margin — the slide supplies its own padding", () => {
    expect(css).toContain("size: A4 landscape");
  });
});
