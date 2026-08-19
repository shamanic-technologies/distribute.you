import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

// The catalogue pages are ~150 generated documents whose entire content is
// served figures. What a source test can hold is the set of decisions that,
// undone, would silently turn them into a site that advertises numbers we do
// not charge — or into pages a scraper cannot read.

const app = path.resolve(__dirname, "../../src/app");
const read = (p: string) => fs.readFileSync(path.join(app, p), "utf8");

const INDEX = read("channels/page.tsx");
const CHANNEL = read("channels/[channel]/page.tsx");
const PAIR = read("channels/[channel]/[funnel]/page.tsx");
const FUNNEL = read("funnels/[funnel]/page.tsx");
const SITEMAP = read("sitemap.ts");
const ALL = [INDEX, CHANNEL, PAIR, FUNNEL];

describe("the pages are generated, not written", () => {
  it("prerenders every channel, funnel and pair", () => {
    // A scraper parses raw HTML only. A page that resolved its figures on the
    // client would be indexed empty, which is the one thing a catalogue
    // generated from live data must never be.
    for (const src of [CHANNEL, PAIR, FUNNEL]) {
      expect(src).toContain("export async function generateStaticParams");
    }
  });

  it("derives the pair list from the producer rather than crossing every combination", () => {
    // A funnel a channel cannot start has no product behind it, so it gets no
    // page. `allPairs` reads the producer's own derivation.
    expect(PAIR).toContain("allPairs(channels)");
    expect(PAIR).not.toMatch(/flatMap\(\s*\(\)\s*=>\s*allFunnels/);
  });

  it("404s an address the catalogue does not carry", () => {
    // An unknown slug must not render an empty page that reads as "this channel
    // sells nothing".
    for (const src of [CHANNEL, PAIR, FUNNEL]) {
      expect(src).toContain("notFound()");
    }
  });
});

describe("no page invents a figure", () => {
  it("never does arithmetic on a served number", () => {
    // Every figure is rendered as served. A page that divided or multiplied
    // would be computing a stat in the browser, which is how a public price
    // starts drifting from what we charge.
    for (const src of ALL) {
      const body = src.slice(src.indexOf("export default"));
      expect(body).not.toMatch(/\b\w+Usd\s*[*/]\s/);
      expect(body).not.toMatch(/\/\s*30\b/);
    }
  });

  it("says which ingredient is missing instead of rendering a blank", () => {
    // "We could not measure this" and "it costs nothing" are different
    // statements, and a blank cell cannot tell them apart.
    expect(PAIR).toContain("NOT_MEASURED_COPY[pair.result.reason]");
    expect(PAIR).toContain("UNPRICED_COPY[step.unpricedReason]");
  });

  it("ranks on return, never on what is cheapest", () => {
    for (const src of [INDEX, CHANNEL, FUNNEL]) {
      expect(src).toContain("sortPairsByReturn");
    }
  });
});

describe("the descent", () => {
  it("takes every page from the sky down to the soil", () => {
    for (const src of ALL) {
      for (const stratum of ["sky", "trunk", "soil"]) {
        expect(src).toContain(`strata="${stratum}"`);
      }
    }
  });

  it("marks the crossing exactly once per page", () => {
    for (const src of ALL) {
      expect(src.match(/horizon/g) ?? []).toHaveLength(1);
    }
  });

  it("ends in the ground, with the seed as the last thing a reader meets", () => {
    for (const src of ALL) {
      const soilAt = src.indexOf('strata="soil"');
      expect(soilAt).toBeGreaterThan(-1);
      expect(src.indexOf("<Seed")).toBeGreaterThan(soilAt);
    }
  });
});

describe("the sitemap", () => {
  it("derives the catalogue rather than listing it by hand", () => {
    // ~150 pages that grow every time a channel or a funnel is published. A
    // hardcoded list would be stale the day after it was written, which is
    // exactly how the static block in this file drifted before.
    expect(SITEMAP).toContain("fetchChannelCatalogue()");
    expect(SITEMAP).toContain("allPairs(channels)");
    expect(SITEMAP).toContain("allFunnels(channels)");
  });

  it("ships without the catalogue rather than aborting the whole prerender", () => {
    // An unreachable producer at build time would otherwise take every
    // unrelated page's sitemap row with it. Same carve-out the article rows
    // already take.
    const block = SITEMAP.slice(SITEMAP.indexOf("let catalogueEntries"));
    expect(block).toContain("catch");
    expect(block).toContain("console.error");
  });
});
