import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TOPIC_LABEL } from "../src/lib/research/research";

/**
 * TTFPR-RESEARCH-STUDY-1021: features-service serves the "How long before a first positive reply?"
 * study under the new topic `delay`, a histogram whose chart carries a cumulative `curve`, and the
 * percentile tiles in `study.delay.stats`. An unknown topic crashes the whole Research page
 * (TOPIC_LOOK[topic] is read with no fallback), so every map keyed on the topic must name it.
 */
const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("research: the delay study", () => {
  it("every topic-keyed map names the delay topic", () => {
    expect(TOPIC_LABEL.delay).toBe("Time to reply");
    expect(src("src/components/v2/research-bits.tsx")).toMatch(/\n {2}delay: \{ color: "var\(--data-[a-z]+\)", Icon: HourglassIcon \}/);
    expect(src("src/components/v2/research-page.tsx")).toContain('delay: "Comparison"');
  });

  it("a chart with a served curve draws the histogram beside the curve, and the tiles come from study.delay", () => {
    const page = src("src/components/v2/research-page.tsx");
    expect(page).toContain("c.curve ? (");
    expect(page).toContain("<DelayRow key={c.title} chart={c} color={look.color} />");
    expect(page).toContain("study.delay.stats.map((s) =>");
    const bits = src("src/components/v2/research-bits.tsx");
    expect(bits).toContain("<DelayCurve points={chart.curve?.points ?? []} color={color} />");
  });

  it("a delay study's chart with no curve (the per-day bins) is drawn as vertical bars, never the ranked row list", () => {
    const page = src("src/components/v2/research-page.tsx");
    const at = page.indexOf("c.curve ? (");
    const hist = page.indexOf("study.delay ? (", at);
    const rows = page.indexOf("<BarsChart chart={c}", at);
    expect(at).toBeGreaterThan(-1);
    expect(hist).toBeGreaterThan(at);
    expect(page.slice(hist, rows)).toContain("<DelayHistogram key={c.title} chart={c} color={look.color} />");
    expect(rows).toBeGreaterThan(hist);
  });
});
