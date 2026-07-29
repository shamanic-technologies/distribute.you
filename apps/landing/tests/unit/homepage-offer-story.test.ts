import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const homepagePath = path.resolve(
  __dirname,
  "../../public/landing/index-v1.html",
);
const html = fs.readFileSync(homepagePath, "utf8");

describe("homepage social proof is real and attributed", () => {
  it("drops the unsourced ROI chip", () => {
    // `10.6x ROI` sat hardcoded beside the testimonials with no source and no
    // live token. The real figure belongs to a named client.
    expect(html).not.toContain("10.6");
  });

  it("carries the Doc Dinners numbers on the named testimonial", () => {
    expect(html).toContain("$50 per sales meeting");
    expect(html).toContain("10&times; ROI");
    expect(html).toContain("Ryan W.D. Parenti");
  });

  it("keeps both real testimonials and invents no others", () => {
    const names = html.match(/class="tm-name">([^<]+)</g) ?? [];
    expect(names).toHaveLength(2);
    expect(names.join(" ")).toContain("Katherine Fleishman");
    expect(names.join(" ")).toContain("Ryan W.D. Parenti");
  });
});

describe("homepage sells an acquisition agency, not a cold email tool", () => {
  // The product is bought as a done-for-you outcome. Describing it by its
  // channel in the machine-readable surfaces is what files it under the tooling
  // category for search engines and LLMs.
  const bannedCategoryStrings = [
    "cold email outreach. Add your website",
    "done-for-you B2B cold email outreach",
    "personalized cold emails",
    "research, cold email, follow-ups",
    "Cold email software",
    "another cold email tool",
    "Done-for-you B2B outbound.",
  ];

  for (const banned of bannedCategoryStrings) {
    it(`no longer describes itself as: ${banned}`, () => {
      expect(html).not.toContain(banned);
    });
  }

  it("names the offer", () => {
    expect(html).toContain("Autonomous Sales Meetings Acquisition");
  });
});

describe("homepage section story", () => {
  const sectionIds = [
    ...html.matchAll(/<section[^>]*id="([a-z-]+)"/g),
  ].map((m) => m[1]);

  it("runs the offer story in order", () => {
    // Dream, then the price of not having it, then how it is measured, then how
    // it is driven down, then how fast, then what it replaces, then the risk.
    const story = [
      "testimonials",
      "proof",
      "measure",
      "engine",
      "speed",
      "stack",
      "pricing",
    ];
    const present = sectionIds.filter((id) => story.includes(id));
    expect(present).toEqual(story);
  });

  it("drops the four-model comparison grid that carried no idea of its own", () => {
    expect(html).not.toContain('id="category"');
  });
});

describe("homepage value stack quotes market prices, not ours", () => {
  it("prices each replaced line item", () => {
    expect(html).toContain("stack-price");
    // The bands are documented market rates for the pieces we replace.
    expect(html).toContain("$1,500 to $5,000");
  });
});

describe("homepage guarantees the measurement, never the result", () => {
  it("states the measurement guarantee", () => {
    expect(html).toContain("We do not guarantee the result. We guarantee the measurement.");
  });

  it("never promises an outcome", () => {
    // The page is allowed to say it is NOT for people demanding guaranteed
    // meetings. It must never claim to deliver them.
    expect(html).not.toContain("guarantee you a meeting");
    expect(html).not.toContain("guaranteed sales meetings");
    expect(html).not.toContain("we guarantee results");
    expect(html).toContain("anyone demanding guaranteed meetings");
  });
});

describe("homepage copy discipline", () => {
  it("ships no em-dash", () => {
    expect(html).not.toContain("—");
  });

  it("keeps its CSS inline, so a style change needs no cache-buster bump", () => {
    // Sibling pages link `css/styles.css?v=N`, whose URL is its own edge cache
    // key: editing that file without moving N ships nothing to returning
    // visitors. This page carries its styles inline in the document, which is
    // revalidated every 300s, so the trap does not apply. If a stylesheet link
    // is ever added here, it must carry a `?v=` token and this guard changes.
    expect(html).not.toContain("css/styles.css");
    expect(html).toContain("<style>");
  });
});
