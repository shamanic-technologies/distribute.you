import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hotLeadBandHtml, hotLeadRowHtml, hotLeadStats } from "@/lib/static-html";

const LANDING = path.join(process.cwd(), "public/landing");
const html = readFileSync(path.join(LANDING, "index-v2.html"), "utf8");
const css = readFileSync(path.join(LANDING, "v2/styles.css"), "utf8");
const js = readFileSync(path.join(LANDING, "v2/main.js"), "utf8");

function brand(hotReplies: number, clicks: number, costCents: number) {
  return {
    stats: {
      recipientsRepliesPositive: hotReplies,
      recipientsClicked: clicks,
      totalCostInUsdCents: costCents,
    },
  };
}

describe("hotLeadStats", () => {
  it("counts a hot lead as a positive reply OR a website visit", () => {
    const stats = hotLeadStats([brand(2, 8, 5_000), brand(1, 9, 5_000)]);
    expect(stats?.hotLeads).toBe(20);
  });

  it("counts only the brands that carry a hot lead and recorded spend", () => {
    const stats = hotLeadStats([
      brand(1, 4, 2_000),
      brand(2, 3, 2_000),
      brand(0, 0, 90_000), // spent, produced nothing
      brand(0, 0, 0), // never ran
    ]);
    expect(stats?.companies).toBe(2);
  });

  it("prices each brand on its own hot leads, then takes the median", () => {
    // $10 / 2 = $5, $30 / 3 = $10, $90 / 9 = $10 -> median $10
    const stats = hotLeadStats([brand(2, 0, 1_000), brand(3, 0, 3_000), brand(9, 0, 9_000)]);
    expect(stats?.medianCostUsd).toBe(10);
  });

  it("averages the two middles on an even brand count", () => {
    // $2, $4, $6, $8 -> (4 + 6) / 2 = 5
    const stats = hotLeadStats([
      brand(1, 0, 200),
      brand(1, 0, 400),
      brand(1, 0, 600),
      brand(1, 0, 800),
    ]);
    expect(stats?.medianCostUsd).toBe(5);
  });

  it("excludes a brand with hot leads but no recorded spend rather than pricing it at $0", () => {
    const stats = hotLeadStats([brand(1, 0, 1_000), brand(1, 0, 3_000), brand(50, 0, 0)]);
    expect(stats?.companies).toBe(2);
    expect(stats?.medianCostUsd).toBe(20);
    // the unpriced brand's 50 leads are not counted either - all three figures
    // describe the same set of brands.
    expect(stats?.hotLeads).toBe(2);
  });

  it("states nothing when a single brand would decide the median", () => {
    expect(hotLeadStats([brand(4, 0, 4_000)])).toBeNull();
  });

  it("states nothing when the fleet has produced no hot lead", () => {
    expect(hotLeadStats([brand(0, 0, 5_000), brand(0, 0, 9_000)])).toBeNull();
  });

  it("states nothing for an empty fleet", () => {
    expect(hotLeadStats([])).toBeNull();
  });

  it("reads a missing stat as zero rather than throwing", () => {
    const stats = hotLeadStats([
      { stats: { recipientsClicked: 4, totalCostInUsdCents: 400 } },
      { stats: { recipientsRepliesPositive: 1, totalCostInUsdCents: 100 } },
    ]);
    expect(stats).toEqual({ hotLeads: 5, companies: 2, medianCostUsd: 1 });
  });
});

describe("hotLeadRowHtml", () => {
  it("states the count, the company count and a whole-dollar price", () => {
    const row = hotLeadRowHtml({ hotLeads: 740, companies: 21, medianCostUsd: 6.45 });
    expect(row).toContain(">740</b>");
    expect(row).toContain("hot leads for 21 companies");
    expect(row).toContain(">$6</b>");
    expect(row).toContain("median cost per hot lead");
  });

  it("reads as one inline line per stat: a mark, the number, the words", () => {
    const row = hotLeadRowHtml({ hotLeads: 740, companies: 21, medianCostUsd: 6 });
    // the mark belongs to the count, not to the price
    expect(row.indexOf("hstat-i")).toBeLessThan(row.indexOf("data-hot-leads"));
    expect(row.match(/hstat-i/g)).toHaveLength(1);
    // the number is wrapped so the floating +N has something to hang off
    expect(row).toContain('<span class="hstat-n"><b data-hot-leads');
    // the words are the quiet half
    expect(row).toContain('<span class="hstat-l">hot leads for 21 companies</span>');
  });

  it("rounds the price rather than flooring it", () => {
    expect(hotLeadRowHtml({ hotLeads: 10, companies: 3, medianCostUsd: 6.6 })).toContain(">$7</b>");
  });

  it("groups a large count for a reader", () => {
    expect(hotLeadRowHtml({ hotLeads: 84899, companies: 21, medianCostUsd: 9 })).toContain(
      ">84,899</b>",
    );
  });

  it("seeds the in-session nudge with the served count", () => {
    const row = hotLeadRowHtml({ hotLeads: 740, companies: 21, medianCostUsd: 6 });
    expect(row).toContain('data-hot-leads data-n="740"');
  });
});

describe("hotLeadBandHtml", () => {
  const band = hotLeadBandHtml({ hotLeads: 760, companies: 21, medianCostUsd: 6.4 });

  it("states the same two figures as the hero row, as a two-stat dark band", () => {
    expect(band).toContain('<section class="framed dark">');
    expect(band).toContain('class="stats two"');
    expect(band).toContain('data-count="760"');
    expect(band).toContain("hot leads for 21 companies");
    expect(band).toContain('<span class="u">$</span><span data-count="6">0</span>');
    expect(band).toContain("median cost per hot lead");
  });

  it("is what every comparison page closes on", () => {
    const compare = readFileSync(path.resolve(__dirname, "../../src/lib/compare-page.ts"), "utf8");
    expect(compare).toContain('return "__HOT_LEAD_BAND__";');
    const css = readFileSync(path.resolve(__dirname, "../../public/landing/v2/styles.css"), "utf8");
    expect(css).toContain(".stats.two { grid-template-columns: repeat(2, 1fr);");
  });
});

describe("the hero proof row on the homepage", () => {
  it("is a server-rendered token, so a failed read drops the row instead of freezing a number", () => {
    expect(html).toContain("__HOT_LEAD_ROW__");
    // No hardcoded twin: the figures exist in exactly one place.
    expect(html).not.toContain("median cost per hot lead");
  });

  it("sits ABOVE the headline - the proof you walk past on the way to it", () => {
    expect(html.indexOf("__HOT_LEAD_ROW__")).toBeLessThan(html.indexOf("<h1>"));
    expect(html.indexOf("__HOT_LEAD_ROW__")).toBeGreaterThan(html.indexOf('class="hero-inner"'));
  });

  it("bumps the asset cache-busters, or the edge keeps serving the old css and js", () => {
    expect(html).toContain('href="/landing/v2/styles.css?v=11"');
    expect(html).toContain('src="/landing/v2/main.js?v=8"');
  });
});

describe("the live nudge", () => {
  it("has ONE implementation, called by the cards and by the proof row", () => {
    expect(js).toContain("function bump(el, add, value)");
    expect(js).toContain("bump(el, add, steps[idx]);");
    expect(js).toContain("bump(hotEl, 1, next);");
    // the card tick must not carry its own copy of the flash
    const tick = js.slice(js.indexOf("function tick()"), js.indexOf("function schedule()"));
    expect(tick).not.toContain('d.className = "delta"');
  });

  it("moves the hot-lead count and nothing else on the row", () => {
    const row = js.slice(js.indexOf("var hotEl"), js.indexOf("/* Hero line art"));
    expect(row).toContain('document.querySelector("[data-hot-leads]")');
    // no company count, no price
    expect(row).not.toContain("companies");
    expect(row).not.toContain("median");
  });

  it("is slower than the showcase cards - a hot lead is rarer than a contact", () => {
    expect(js).toContain("8000 + Math.random() * 12000");
  });

  it("stands down for a hidden tab and for reduced motion", () => {
    expect(js).toContain("if (!hotEl || document.hidden) return;");
    expect(js).toContain("if (hotEl && !reduced) hotSchedule();");
  });

  it("reuses the cards' flash and float rather than a second animation", () => {
    expect(css).toContain(".sf b.up, .hstat b.up");
    expect(css).toContain(".sf .delta, .hstat-n .delta");
    expect(css.match(/@keyframes lp-delta-flash/g)).toHaveLength(1);
  });

  it("gives the floating +N a positioned parent to sit in", () => {
    expect(css).toContain(".hstat-n { position: relative;");
  });

  it("floats the +N clear of the number instead of on top of it", () => {
    // The cards' offsets (left:0, top:-2px) sit above a left-aligned 15px number.
    // This row's number is 26px and centred, so the same offsets land the "+1" ON
    // the digits - measured, then corrected. `margin-left` rather than a transform:
    // lp-delta-flash animates transform, so a translateX here is overwritten mid-flight.
    expect(css).toContain(".hstat-n .delta { left: 50%; top: -13px; margin-left: -5px; }");
    expect(css).not.toMatch(/\.hstat-n \.delta \{[^}]*transform:/);
  });
});
