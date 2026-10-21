import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TOPIC_LABEL } from "../src/lib/research/research";

/**
 * RESEARCH-NICHE-1021: features-service serves "Do clients with a very specific B2B niche convert
 * better on cold email?" under the new topic `niche` (one bar per Jev niche grade). An unknown topic
 * crashes the whole Research page (TOPIC_LOOK[topic] is read with no fallback), so every map keyed
 * on the topic must name it.
 */
const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("research: the niche study", () => {
  it("every topic-keyed map names the niche topic", () => {
    expect(TOPIC_LABEL.niche).toBe("B2B niche");
    expect(src("src/components/v2/research-bits.tsx")).toMatch(/\n {2}niche: \{ color: "var\(--data-[a-z]+\)", Icon: TargetIcon \}/);
    expect(src("src/components/v2/research-page.tsx")).toContain('niche: "Winner"');
  });
});
