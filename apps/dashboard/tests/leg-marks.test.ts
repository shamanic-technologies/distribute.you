import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LEG_MARKS,
  LEG_TONE,
  legMarkFor,
  legMarkKey,
} from "../src/lib/leg-marks";
import { OWN_CHANNEL_TONE } from "../src/lib/acquisition-channels";

const read = (rel: string) => readFileSync(join(__dirname, "..", "src", rel), "utf8");

/**
 * Every leg features-service publishes across all 41 channels, read off the deployed
 * `GET /public/channels` (2026-08-28): four entry legs and six internal conversions.
 *
 * Pinned as a fixture so a leg the producer adds shows up here as a FAILING test rather
 * than as a row that silently draws no tile. It is NOT the whole catalogue: a brand
 * can be shown legs no channel performs, and those are rows too (see below).
 */
const PUBLISHED_LEGS: [string | null, string][] = [
  [null, "conversation"],
  [null, "website_visit"],
  [null, "form_submitted"],
  [null, "meeting_booked"],
  ["conversation", "meeting_booked"],
  ["website_visit", "meeting_booked"],
  ["meeting_booked", "meeting_attended"],
  ["meeting_attended", "paid_client"],
  ["signup", "paid_client"],
  ["form_submitted", "paid_client"],
];

/**
 * Legs a brand can be shown that no channel performs today: two conversions worked
 * elsewhere, and two that skip a step a longer path inserts.
 */
const UNPERFORMED_LEGS: [string | null, string][] = [
  ["website_visit", "signup"],
  ["website_visit", "form_submitted"],
  ["conversation", "paid_client"],
  ["website_visit", "paid_client"],
];

describe("leg marks — one tile per leg, unique fleet-wide", () => {
  it("draws every leg the fleet publishes, including ones no brand funds yet", () => {
    for (const [from, to] of PUBLISHED_LEGS) {
      expect(legMarkFor(from, to), `${from ?? "∅"} -> ${to}`).not.toBeNull();
    }
    // The catalogue is exactly the published legs PLUS the legs no channel performs
    // today; an entry beyond that union is a tile for a leg nobody can be shown.
    const wanted = new Set(
      [...PUBLISHED_LEGS, ...UNPERFORMED_LEGS].map(([f, t]) => legMarkKey(f, t)),
    );
    expect(Object.keys(LEG_MARKS).sort()).toEqual([...wanted].sort());
  });

  it("gives each leg its OWN glyph — no two legs wear the same mark", () => {
    const glyphs = Object.values(LEG_MARKS).map((m) => m.glyph);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  it("never reuses a CHANNEL's glyph, so a leg tile and a channel tile stay apart", () => {
    // The two marks sit on the same row — the leg leads, the channel follows behind
    // "Via" — so a shared glyph would read as the same thing said twice.
    const channelGlyphs = new Set(["envelope", "chat-circle", "chat-teardrop"]);
    for (const mark of Object.values(LEG_MARKS)) {
      expect(channelGlyphs.has(mark.glyph)).toBe(false);
    }
  });

  it("keys an ENTRY leg apart from the first step's own conversion", () => {
    // `from: null` is "onto a step from nothing", which is not index 0 of anything.
    expect(legMarkKey(null, "conversation")).toBe("->conversation");
    expect(legMarkKey("conversation", "meeting_booked")).toBe(
      "conversation->meeting_booked",
    );
  });

  it("answers null for a leg it has not drawn rather than borrowing another's tile", () => {
    expect(legMarkFor("signup", "meeting_booked")).toBeNull();
    expect(legMarkFor(null, "something_new")).toBeNull();
    expect(legMarkFor(null, null)).toBeNull();
  });

  it("tints only from the `html.dark` remapped set the other marks draw from", () => {
    // A tint outside the remap renders its light-mode near-white on the dark surface.
    const allowed = new Set(["blue", "purple", "indigo", "orange"]);
    for (const mark of Object.values(LEG_MARKS)) {
      const bg = /^bg-([a-z]+)-50$/.exec(mark.tone.iconBg);
      const text = /^text-([a-z]+)-600$/.exec(mark.tone.iconText);
      expect(bg, mark.tone.iconBg).not.toBeNull();
      expect(text, mark.tone.iconText).not.toBeNull();
      expect(allowed.has(bg![1])).toBe(true);
      // One hue per tile: a fill and a stroke from two families is two marks in one.
      expect(bg![1]).toBe(text![1]);
    }
  });

  it("keeps the catalogue alias-free so it carries real unit tests", () => {
    const src = read("lib/leg-marks.ts");
    expect(src).not.toMatch(/^import .*from "@\//m);
  });

  it("renders each glyph through ONE icon map, and imports per-icon", () => {
    const mark = read("components/marks/leg-mark.tsx");
    for (const glyph of Object.values(LEG_MARKS).map((m) => m.glyph)) {
      expect(mark, glyph).toMatch(new RegExp(`["']?${glyph}["']?\\s*:`));
    }
    // The package root is a ~190KB barrel; every icon comes from its own csr entry
    // (the `Icon` TYPE off the root is erased at build and costs nothing).
    expect(mark).toContain("@phosphor-icons/react/dist/csr/");
    expect(mark).toContain('weight="duotone"');
    // The tile rotates with the brand like every other mark on the product.
    expect(mark).toContain("tone-tile");
  });
});

/**
 * ONE tone for every leg: the charter's secondary.
 *
 * A table walking legs one by one is a SEQUENCE, and four colours down a
 * sequence read as four kinds of thing rather than as four steps of one. The GLYPH is
 * what tells the legs apart, which is the whole reason the catalogue is keyed on a glyph
 * token; the tone is free to say "this is a leg" instead.
 */
describe("one tone for every leg", () => {
  it("wears the shared secondary and nothing else", () => {
    const tones = new Set(
      Object.values(LEG_MARKS).map((m) => `${m.tone.iconBg}|${m.tone.iconText}`),
    );
    expect(tones.size).toBe(1);
    expect([...tones][0]).toBe(`${LEG_TONE.iconBg}|${LEG_TONE.iconText}`);
  });

  it("is purple, the charter's own secondary", () => {
    // ~44 degrees off the primary blue, a relationship globals.css preserves under the
    // tone-tile rotation, so on a customer's dashboard this is THEIR secondary.
    expect(LEG_TONE.iconBg).toBe("bg-purple-50");
    expect(LEG_TONE.iconText).toBe("text-purple-600");
  });

  it("carries the tint through a tone-tile so it rotates with the brand", () => {
    const mark = readFileSync(
      join(__dirname, "..", "src", "components/marks/leg-mark.tsx"),
      "utf8",
    );
    expect(mark).toContain("tone-tile");
    expect(mark).toContain("mark.tone.iconBg");
    expect(mark).toContain("mark.tone.iconText");
  });

  it("differs from the tone the channels wear, so a row reads two KINDS of thing", () => {
    expect(LEG_TONE.iconText).not.toBe(OWN_CHANNEL_TONE.iconText);
  });
});
