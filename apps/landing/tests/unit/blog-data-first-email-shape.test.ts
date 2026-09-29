import { describe, expect, it } from "vitest";
import { layoutOf, openingOf, dashOf, LAYOUT, OPENING, DASH } from "../../scripts/blog-data/first-email-shape.mjs";

describe("first email layout", () => {
  it("names an empty line a double line break, a lone new line a single line break, and no break one block", () => {
    expect(layoutOf("Hallo Stephan,\n\nich schreibe")).toBe(LAYOUT.paragraphs);
    expect(layoutOf("Hi Anna,\r\n  \r\nquick one")).toBe(LAYOUT.paragraphs);
    expect(layoutOf("Hi Anna,\nquick one")).toBe(LAYOUT.lines);
    expect(layoutOf("Marie, la plupart des cabinets")).toBe(LAYOUT.block);
    expect(layoutOf("   ")).toBeNull();
  });
});

describe("first email opening", () => {
  it("reads a greeting word in any of our languages, whatever follows it", () => {
    for (const t of ["Hi Tom,", "Hallo Stephan,", "Bonjour Marie,", "Chère Élodie,", "Hola Ana,", "Ciao Luca,", "Hi there,", "Dear Dr. Smith,"]) {
      expect(openingOf(t, "Someone"), t).toBe(OPENING.greeting);
    }
  });
  it("reads the lead's own first name glued to the sentence as the name alone", () => {
    expect(openingOf("Marie, la plupart des cabinets", "Marie")).toBe(OPENING.name);
    expect(openingOf("élodie — vu que", "Élodie")).toBe(OPENING.name);
  });
  it("reads anything else as no greeting, and a word that merely starts like one is not one", () => {
    expect(openingOf("Quick question about ACME", "Bob")).toBe(OPENING.none);
    expect(openingOf("Hithere is our product", "Bob")).toBe(OPENING.none);
    expect(openingOf("Bob sent me", "Bob")).toBe(OPENING.none);
  });
  it("reads a capitalised word glued by a comma as a name even when no first name is on record", () => {
    expect(openingOf("Tony, I have noticed a trend", "")).toBe(OPENING.name);
    expect(openingOf("Jean-Pierre: quick thought", "")).toBe(OPENING.name);
    expect(openingOf("However, most brands", "")).toBe(OPENING.none);
    expect(openingOf("Most PR retainers are expensive", "")).toBe(OPENING.none);
    expect(openingOf("Hi Marie,", "")).toBe(OPENING.greeting);
    expect(openingOf("   ", "Marie")).toBeNull();
  });
});

describe("first email dashes", () => {
  it("tells an em dash, an en dash, both, and neither apart; a hyphen is not a dash", () => {
    expect(dashOf("Hi Tom, quick one \u2014 worth a call?")).toBe(DASH.em);
    expect(dashOf("Hours 9\u20135, Monday to Friday")).toBe(DASH.en);
    expect(dashOf("A \u2014 b \u2013 c")).toBe(DASH.both);
    expect(dashOf("A well-known clinic - no dash here")).toBe(DASH.none);
    expect(dashOf("  ")).toBeNull();
  });
});
