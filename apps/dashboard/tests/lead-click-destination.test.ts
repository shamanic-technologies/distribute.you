import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { clickDestination, type LeadHistoryEvent } from "../src/lib/lead-history";

/**
 * The timeline names the page a prospect opened, on the row that says they opened one.
 *
 * `lead-history.ts` is alias-free, so the rule itself carries REAL unit tests. What a
 * substring guard is for is the CALL SITE: a reader perfectly able to select a
 * destination is the feature entirely absent if the timeline never asks it for one.
 */

const TIMELINE = readFileSync(
  join(__dirname, "../src/components/audiences/lead-history-timeline.tsx"),
  "utf8",
);

function clickEvent(destination?: LeadHistoryEvent["destination"]): LeadHistoryEvent {
  return {
    id: "delivery:c1:clicked",
    at: "2026-09-17T13:20:38.858Z",
    type: "delivery",
    evidence: "observed",
    source: "delivery",
    campaignId: "c1",
    direction: "inbound",
    milestone: "clicked",
    destination,
  };
}

describe("clickDestination", () => {
  it("names the page when the producer could say where the click went", () => {
    expect(
      clickDestination(
        clickEvent({ state: "known", href: "https://docdinners.com/?utm_source=x", resolution: "deduced" }),
      ),
    ).toBe("https://docdinners.com/?utm_source=x");
  });

  it("reads an observed destination exactly as it reads a deduced one", () => {
    // The two are different facts on the wire and the schema keeps them apart. What
    // the panel prints is the same sentence either way: this is where they went.
    expect(
      clickDestination(clickEvent({ state: "known", href: "https://acme.com/pricing", resolution: "observed" })),
    ).toBe("https://acme.com/pricing");
  });

  it("names nothing when the copy pointed at several places", () => {
    expect(clickDestination(clickEvent({ state: "ambiguous", href: null, resolution: null }))).toBeNull();
  });

  it("names nothing when nothing was resolvable", () => {
    expect(clickDestination(clickEvent({ state: "unknown", href: null, resolution: null }))).toBeNull();
  });

  it("names nothing on an event the producer stated no destination for", () => {
    expect(clickDestination(clickEvent(undefined))).toBeNull();
  });

  it("refuses a state this build does not know rather than guessing at the nearest one", () => {
    // lead-service owns this vocabulary and widens it. An unknown word renders
    // nothing, which is the same honest degrade the rest of this reader takes.
    expect(clickDestination(clickEvent({ state: "partial", href: "https://acme.com", resolution: null }))).toBeNull();
  });

  it("refuses a href in any scheme but http and https", () => {
    // It lands in an anchor, and a script URL there is execution on click.
    expect(
      clickDestination(clickEvent({ state: "known", href: "javascript:alert(1)", resolution: "deduced" })),
    ).toBeNull();
    expect(clickDestination(clickEvent({ state: "known", href: "mailto:a@b.com", resolution: "deduced" }))).toBeNull();
  });

  it("refuses an empty href stated as known", () => {
    expect(clickDestination(clickEvent({ state: "known", href: "   ", resolution: "deduced" }))).toBeNull();
    expect(clickDestination(clickEvent({ state: "known", href: null, resolution: "deduced" }))).toBeNull();
  });
});

describe("the reader declares what the producer serves", () => {
  const READER = readFileSync(join(__dirname, "../src/lib/lead-history.ts"), "utf8");

  it("declares every field of the destination, or zod strips the ones it omits", () => {
    const at = READER.indexOf("destination: z");
    const block = READER.slice(at, READER.indexOf(".optional(),", at));
    expect(block).toContain("state: z.string()");
    expect(block).toContain("href: z.string().nullable()");
    expect(block).toContain("resolution: z.string().nullable()");
  });

  it("reads the producer's vocabulary as plain strings", () => {
    // A closed set here throws the whole panel the day lead-service gains a word,
    // which is the rot that took an earlier surface down.
    const at = READER.indexOf("destination: z");
    const block = READER.slice(at, READER.indexOf(".optional(),", at));
    expect(block).not.toContain("z.enum");
  });
});

describe("the timeline renders it", () => {
  it("asks the reader for a destination per row", () => {
    expect(TIMELINE).toContain("const destination = clickDestination(e);");
  });

  it("draws a real link a reader can follow and check", () => {
    const at = TIMELINE.indexOf("{destination && (");
    expect(at).toBeGreaterThan(-1);
    // Bounded by the block that FOLLOWS it rather than by a measured length: a
    // number expires on the next comment anybody adds.
    const block = TIMELINE.slice(at, TIMELINE.indexOf("{/* THE WORDS"));
    expect(block).toContain("href={destination}");
    expect(block).toContain('target="_blank"');
    expect(block).toContain('rel="noopener noreferrer"');
    // The whole URL behind the label that drops its query.
    expect(block).toContain("title={destination}");
    expect(block).toContain("{linkDisplayText(destination)}");
  });

  it("colours the link from the brand ramp, never a charter literal", () => {
    // `:root[data-brand-tint]` re-declares the ramp at the open brand's hue, so an
    // arbitrary-value hex is the one control that stays our blue on a tinted board.
    const at = TIMELINE.indexOf("{destination && (");
    const block = TIMELINE.slice(at, TIMELINE.indexOf("{/* THE WORDS"));
    expect(block).toContain("text-brand-600");
    expect(block).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  it("states the destination outside the copy gate", () => {
    // GA: the page is the customer's OWN, not the words we wrote, so reading it is
    // not what a sales interest earns.
    const at = TIMELINE.indexOf("{destination && (");
    const block = TIMELINE.slice(at, TIMELINE.indexOf("{/* THE WORDS"));
    expect(block).not.toContain("canReadEmailCopy");
  });

  it("derives no destination of its own", () => {
    // Joining a click to the messages around it is the merge the history read owns.
    // Rebuilding it here is the bug that read replaced, one layer up.
    expect(TIMELINE).not.toContain("links.find");
    expect(TIMELINE).not.toContain("destination =  ");
  });
});
