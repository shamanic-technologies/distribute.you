import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fleetReturnFromIndex, hotLeadBandHtml, hotLeadRowHtml, hotLeadStatsFromIndex, meetingCostFromIndex, stepMeetingCostHtml, stepReturnHtml } from "@/lib/static-html";
import type { IndexDetail } from "@/lib/fleet-indexes";

const LANDING = path.join(process.cwd(), "public/landing");
const html = readFileSync(path.join(LANDING, "index-v2.html"), "utf8");
const css = readFileSync(path.join(LANDING, "v2/styles.css"), "utf8");
const js = readFileSync(path.join(LANDING, "v2/main.js"), "utf8");

function indexDetail(value: number | null, inputs: Record<string, unknown>, over: Partial<IndexDetail["index"]> = {}): IndexDetail {
  return {
    statusRule: { signalMinOutcomes: 10, robustMinOutcomes: 30 },
    index: {
      slug: "cold-email-cost-per-engaged-lead", name: "Cold Email Cost Per Engaged Lead Index", channelSlug: "x", channelName: "x",
      outcome: "engaged_lead", metric: "cost_per_outcome", unit: "usd", valuePer: "per engaged lead", method: "m",
      day: "2026-10-19", value, status: "signal", outcomes: 28, contacted: null, workflowDynastySlug: null,
      workflowDynastyName: null, unavailableReason: null, recordedAt: null, ...over,
    },
    points: [
      { day: "2026-10-19", value, status: "signal", outcomes: 28, contacted: null, workflowDynastyName: null, unavailableReason: null, inputs } as IndexDetail["points"][number],
    ],
  };
}

describe("the hero states the engaged-lead and ROI indexes (2026-10-19)", () => {
  it("price = the index value, count and companies = its inputs", () => {
    expect(hotLeadStatsFromIndex(indexDetail(10.48, { engagedLeads: 886, clients: 28 }))).toEqual({ hotLeads: 886, companies: 28, medianCostUsd: 10.48 });
  });

  it("drops the row when the index has no value today, failed, or lacks its counts", () => {
    expect(hotLeadStatsFromIndex(null)).toBeNull();
    expect(hotLeadStatsFromIndex(indexDetail(null, { engagedLeads: 886, clients: 28 }))).toBeNull();
    expect(hotLeadStatsFromIndex(indexDetail(10.48, { clients: 28 }))).toBeNull();
  });

  it("the return is the ROI index value, dropped alone when absent", () => {
    expect(fleetReturnFromIndex(indexDetail(1.98, { clients: 5 }, { unit: "multiple" }))).toEqual({ medianReturnPerDollar: 1.98, brandCount: 5 });
    expect(fleetReturnFromIndex(indexDetail(null, {}))).toBeNull();
    expect(fleetReturnFromIndex(null)).toBeNull();
  });

  it("one read per index serves both surfaces, and nothing is recomputed here", () => {
    const src = readFileSync(path.resolve(__dirname, "../../src/lib/static-html.ts"), "utf8");
    expect(src.match(/fetchIndexDetail\(ENGAGED_LEAD_INDEX_SLUG\)/g)).toHaveLength(1);
    expect(src.match(/fetchIndexDetail\(ROI_INDEX_SLUG\)/g)).toHaveLength(1);
    expect(src.match(/fetchIndexDetail\(MEETING_INDEX_SLUG\)/g)).toHaveLength(1);
    expect(src).toContain('MEETING_INDEX_SLUG = "cold-email-cost-per-meeting"');
    expect(src).not.toContain("/v1/public/features/ranked?");
    expect(src).not.toContain("/v1/public/features/return-on-spend");
  });
});

describe("the hero price is the meeting index (owner 2026-10-19)", () => {
  it("reads the index value, and drops the price alone when it has none", () => {
    expect(meetingCostFromIndex(indexDetail(457.2, {}))).toBe(457.2);
    expect(meetingCostFromIndex(indexDetail(null, {}))).toBeNull();
    expect(meetingCostFromIndex(null)).toBeNull();
    const row = hotLeadRowHtml(null, { medianReturnPerDollar: 2.2, brandCount: 9 });
    expect(row).not.toContain("cost per booked meeting");
    expect(row.match(/class="hstat"/g)).toHaveLength(1);
  });

  it("never states the engaged-lead price nor calls the meeting figure a median", () => {
    const row = hotLeadRowHtml(457.2);
    const band = hotLeadBandHtml({ hotLeads: 740, companies: 21, medianCostUsd: 6 }, null, 457.2);
    for (const html of [row, band]) {
      expect(html).not.toContain("cost per engaged lead");
      expect(html).not.toContain("median cost per booked meeting");
    }
  });
});

describe("hotLeadRowHtml", () => {
  it("states a whole-dollar meeting price and no engaged-lead count (owner 2026-10-21)", () => {
    const row = hotLeadRowHtml(457.2);
    expect(row).toContain(">$457</b>");
    expect(row).toContain("cost per booked meeting");
    expect(row).not.toContain("engaged leads");
    expect(row).not.toContain("data-hot-leads");
    expect(row).not.toContain("hstat-i");
  });

  it("rounds the price rather than flooring it", () => {
    expect(hotLeadRowHtml(456.6)).toContain(">$457</b>");
  });

  it("states the fleet's median return after the price when one can be measured", () => {
    const row = hotLeadRowHtml(457.2, { medianReturnPerDollar: 2.1955731579141204, brandCount: 9 });
    expect(row).toContain("<b>2.2x</b>");
    expect(row).toContain('<span class="hstat-l">median ROI reported</span>');
    expect(row.indexOf("median ROI reported")).toBeGreaterThan(row.indexOf("cost per booked meeting"));
    expect(row.match(/class="hstat"/g)).toHaveLength(2);
  });

  it("drops the return alone when it cannot be stated", () => {
    const one = hotLeadRowHtml(457.2, null);
    expect(one).not.toContain("median ROI reported");
    expect(one.match(/class="hstat"/g)).toHaveLength(1);
  });

  it("renders nothing when neither figure can be read - never an empty strip", () => {
    expect(hotLeadRowHtml(null, null)).toBe("");
  });

  it("states the SAME median as the comparison band", () => {
    const fleetReturn = { medianReturnPerDollar: 2.1955731579141204, brandCount: 9 };
    const stats = { hotLeads: 740, companies: 21, medianCostUsd: 6 };
    expect(hotLeadRowHtml(457.2, fleetReturn)).toContain("2.2x");
    expect(hotLeadBandHtml(stats, fleetReturn)).toContain('data-count="2.2"');
  });
});

describe("step 03 prices a meeting with the hero's figure (owner 2026-10-21)", () => {
  it("states the same whole-dollar price as the hero row, with the mock's downward trend", () => {
    const tile = stepMeetingCostHtml(67.6);
    expect(tile).toContain('<div class="v">$68</div>');
    expect(hotLeadRowHtml(67.6)).toContain(">$68</b>");
    expect(tile).toContain("Cost / meeting booked");
    // Owner 2026-10-21: keep "↓ from $X", at the ratio the mock shipped with ($600 from $740).
    expect(tile).toContain('<span class="ok">↓ from $83</span>');
    expect(stepMeetingCostHtml(600)).toContain("↓ from $740");
  });

  it("states the same ROI as the hero row", () => {
    const fleetReturn = { medianReturnPerDollar: 1.94, brandCount: 9 };
    expect(stepReturnHtml(fleetReturn)).toContain('<div class="k">ROI</div><div class="v">1.9x</div>');
    expect(hotLeadRowHtml(67.6, fleetReturn)).toContain("<b>1.9x</b>");
  });

  it("drops a tile when its index cannot be read", () => {
    expect(stepMeetingCostHtml(null)).toBe("");
    expect(stepReturnHtml(null)).toBe("");
  });

  it("is a server-rendered token on both homepage arms, no hardcoded price left", () => {
    for (const file of ["index-v2.html", "index-v2-subscription.html"]) {
      const page = readFileSync(path.join(LANDING, file), "utf8");
      expect(page).toContain("__STEP_MEETING_COST__");
      expect(page).toContain("__STEP_RETURN__");
      expect(page).not.toContain("from $740");
      expect(page).not.toContain('<div class="v">2.2x</div>');
    }
  });
});

describe("hotLeadBandHtml", () => {
  const band = hotLeadBandHtml({ hotLeads: 760, companies: 21, medianCostUsd: 6.4 }, null, 457.2);

  it("states the same two figures as the hero row, as a two-stat dark band", () => {
    expect(band).toContain('<section class="framed dark">');
    expect(band).toContain('class="stats two"');
    expect(band).toContain('data-count="760"');
    expect(band).toContain("engaged leads for 21 companies");
    expect(band).toContain('<span class="u">$</span><span data-count="457">0</span>');
    expect(band).toContain("cost per booked meeting");
  });

  it("states the fleet's median return as a third figure when one can be measured", () => {
    const withReturn = hotLeadBandHtml(
      { hotLeads: 760, companies: 21, medianCostUsd: 6.4 },
      { medianReturnPerDollar: 3.7, brandCount: 9 },
      457.2,
    );
    expect(withReturn).toContain("median ROI of our clients");
    // One decimal under 10x, counted up by main.js like its two neighbours.
    expect(withReturn).toContain('<span data-count="3.7" data-decimals="1">0</span>');
    expect(withReturn).toContain('<span class="u">x</span>');
    // Three figures are the base .stats grid; `two` only ever centres a 2-up band.
    expect(withReturn).toContain('<div class="stats">');
    expect(withReturn).not.toContain('class="stats two"');
    // The pair it closes on is untouched.
    expect(withReturn).toContain("engaged leads for 21 companies");
    expect(withReturn).toContain("cost per booked meeting");
  });

  it("reads a return of 10x and up as a whole number - a decimal there is precision we do not have", () => {
    const big = hotLeadBandHtml(
      { hotLeads: 760, companies: 21, medianCostUsd: 6.4 },
      { medianReturnPerDollar: 41.4, brandCount: 9 },
    );
    expect(big).toContain('<span data-count="41" data-decimals="0">0</span>');
  });

  it("drops the return alone when it cannot be stated, and keeps the other two", () => {
    // Absent return === the band as it shipped: two figures, never a third slot
    // holding a dash. `null` is the default, so a caller that knows nothing renders it.
    expect(hotLeadBandHtml({ hotLeads: 760, companies: 21, medianCostUsd: 6.4 }, null, 457.2)).toBe(band);
    expect(band).not.toContain("median ROI of our clients");
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
    expect(html).not.toContain("cost per booked meeting");
  });

  it("sits ABOVE the headline - the proof you walk past on the way to it", () => {
    expect(html.indexOf("__HOT_LEAD_ROW__")).toBeLessThan(html.indexOf("<h1>"));
    expect(html.indexOf("__HOT_LEAD_ROW__")).toBeGreaterThan(html.indexOf('class="hero-inner"'));
  });

  it("bumps the asset cache-busters, or the edge keeps serving the old css and js", () => {
    expect(html).toContain('href="/landing/v2/styles.css?v=18"');
    expect(html).toContain('src="/landing/v2/main.js?v=9"');
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
    expect(js).toContain("if (!hotEl || document.hidden) return true;");
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
