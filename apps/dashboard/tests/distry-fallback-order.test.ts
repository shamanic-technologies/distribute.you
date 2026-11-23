import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DistryFallbackOrder, type DistryFallbackCandidate } from "../src/components/v2/distry-fallback-order";

// DISTRY-THINKING-1122 (owner 2026-11-22): Monitoring > Chat > Distry shows where Distry answers when its
// model cannot serve, and the order, exactly as chat-service serves it (nothing ranked in the browser).
const c = (displayName: string, level: string | null, ipd: number | null): DistryFallbackCandidate => ({
  provider: "p",
  model: displayName.toLowerCase(),
  modelId: displayName.toLowerCase().replace(/ /g, "-"),
  displayName,
  level,
  score: ipd === null ? null : 20,
  intelligencePerDollar: ipd,
});
const served = {
  nextFallback: "If GPT-6.1 Terra cannot serve a turn, Distry answers on Claude Haiku 5.5 at low.",
  // Served order on purpose not sorted by the figure: the browser must keep it.
  order: [c("Claude Haiku 5.5", "low", 425), c("Gemini 4 Hydrogen", "xhigh", 1080), c("GLM-5.3", "none", 120), c("Kimi K3", null, null), c("A", "high", 10), c("B", "low", 5)],
};

describe("Distry fallback order", () => {
  it("renders the served sentence and the order with rank, model and level in words", () => {
    const html = renderToStaticMarkup(createElement(DistryFallbackOrder, served));
    expect(html).toContain(served.nextFallback);
    const haiku = html.indexOf("Claude Haiku 5.5");
    const gemini = html.indexOf("Gemini 4 Hydrogen");
    expect(haiku).toBeGreaterThan(-1);
    expect(gemini).toBeGreaterThan(haiku);
    expect(html).toContain("Xhigh");
    expect(html).toContain("Reasoning off");
    expect(html).toContain("Model default");
    expect(html).toContain("Not scored");
    expect(html).toContain("1,080 index / $");
    // First 5 shown, the rest behind one button.
    expect(html).not.toContain(">B<");
    expect(html).toContain("Show 1 more");
  });

  it("keeps a candidate that cannot answer now in its served place, muted and tagged, never dropped (DISTRY-FALLBACK-ABSOLUTE-1123)", () => {
    const order = [
      { ...c("GPT-6.1 Sol", "high", 900), availability: { runsNow: false, reason: "OpenAI is out of credit." } },
      { ...c("Claude Haiku 5.5", "low", 425), availability: { runsNow: true, reason: null } },
      c("GLM-5.3", "none", 120),
    ];
    const html = renderToStaticMarkup(createElement(DistryFallbackOrder, { nextFallback: null, order }));
    expect(html.indexOf("GPT-6.1 Sol")).toBeGreaterThan(-1);
    expect(html.indexOf("GPT-6.1 Sol")).toBeLessThan(html.indexOf("Claude Haiku 5.5"));
    expect(html.match(/Skipped now/g)).toHaveLength(1);
    expect(html).not.toMatch(/rose|text-red/);
    const comp = readFileSync(join(__dirname, "..", "src", "components", "v2", "distry-fallback-order.tsx"), "utf8");
    expect(comp).toContain("c.availability?.runsNow === false");
    expect(comp).toContain("<InfoTooltip tip={c.availability.reason}");
    const api = readFileSync(join(__dirname, "..", "src", "lib", "api.ts"), "utf8");
    expect(api).toContain("availability: z.object({ runsNow: z.boolean(), reason: z.string().nullable() }).optional()");
  });

  it("says plainly when no other model can serve", () => {
    const html = renderToStaticMarkup(createElement(DistryFallbackOrder, { nextFallback: null, order: [] }));
    expect(html).toContain("No other model can serve Distry right now.");
  });

  it("is wired into the models table off the served fields, never sorted here", () => {
    const view = readFileSync(join(__dirname, "..", "src", "components", "v2", "monitoring-distry.tsx"), "utf8");
    expect(view).toContain("<DistryFallbackOrder nextFallback={d.nextFallback ?? null} order={d.fallbackOrder} />");
    const comp = readFileSync(join(__dirname, "..", "src", "components", "v2", "distry-fallback-order.tsx"), "utf8");
    expect(comp).not.toContain(".sort(");
    // DISTRY-FALLBACK-ABSOLUTE-1123: the label carries an (i) stating every criterion that orders a row.
    expect(comp).toContain("<InfoTooltip tip={FALLBACK_ORDER_TIP}");
    expect(comp).toContain(
      '"One row per model and thinking level Distry can run, best index per $ first (Artificial Analysis run cost; a model without one is ranked after, on our blended 1M-token price). Models with no index come last. Distry takes the first row that can answer now."',
    );
  });
});
