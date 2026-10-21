import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TOPIC_LABEL, topicLabel, type ResearchTopic } from "../src/lib/research/research";
import { TopicMark, topicLook } from "../src/components/v2/research-bits";

/**
 * RESEARCH-COUNTRY-1021-DASH: features-service serves "Which prospect country gets the most positive
 * replies / website visits / meetings, and at what cost?" under the new topic `country` (ordinary bars
 * charts, plus one meeting study with `pipe: null`). Every map keyed on the topic must name it, and a
 * topic this build does not know yet must fall back instead of crashing the whole Research page.
 */
const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("research: the country study", () => {
  it("every topic-keyed map names the country topic", () => {
    expect(TOPIC_LABEL.country).toBe("Country");
    expect(src("src/components/v2/research-bits.tsx")).toMatch(/\n {2}country: \{ color: "var\(--data-[a-z]+\)", Icon: GlobeIcon \}/);
    expect(src("src/components/v2/research-page.tsx")).toContain('country: "Winner"');
  });

  it("an unknown topic falls back instead of crashing the page", () => {
    expect(topicLabel("not-a-topic-yet" as ResearchTopic)).toBe("Study");
    const page = src("src/components/v2/research-page.tsx");
    expect(page).not.toMatch(/TOPIC_LOOK\[|TOPIC_LABEL\[/);
    expect(page).toContain('WINNER_LABEL[study.topic] ?? "Comparison"');
    expect(src("src/components/v2/research-catalog.tsx")).not.toMatch(/TOPIC_LOOK\[/);
    expect(src("src/components/v2/research-bits.tsx")).toContain("return TOPIC_LOOK[topic] ?? UNKNOWN_TOPIC_LOOK;");
  });

  it("a country study's mark renders, and so does an unknown topic's", () => {
    expect(topicLook("country").color).toMatch(/^var\(--data-[a-z]+\)$/);
    expect(renderToStaticMarkup(createElement(TopicMark, { topic: "country" }))).toContain("<svg");
    expect(renderToStaticMarkup(createElement(TopicMark, { topic: "not-a-topic-yet" as ResearchTopic }))).toContain("<svg");
  });
});
