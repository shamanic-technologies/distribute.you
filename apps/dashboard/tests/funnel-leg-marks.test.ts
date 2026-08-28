import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FUNNEL_LEG_MARKS,
  funnelLegMarkFor,
  funnelLegMarkKey,
} from "../src/lib/funnel-leg-marks";
import { SALES_FUNNELS } from "../src/lib/sales-funnels";
import { funnelLegs } from "../src/lib/campaign-leg";

const read = (rel: string) => readFileSync(join(__dirname, "..", "src", rel), "utf8");

/**
 * Every leg features-service publishes across all 41 channels, read off the deployed
 * `GET /public/channels` (2026-08-28): four entry legs and six internal conversions.
 *
 * Pinned as a fixture so a leg the producer adds shows up here as a FAILING test rather
 * than as a row that silently draws no tile. It is NOT the whole catalogue: a funnel we
 * sell has arrows no channel performs, and those are rows too (see below).
 */
const PUBLISHED_LEGS: [string | null, string][] = [
  [null, "conversation"],
  [null, "website_visit"],
  [null, "in_ad_form_submission"],
  [null, "in_ad_booked_meeting"],
  ["conversation", "meeting_booked"],
  ["website_visit", "meeting_booked"],
  ["meeting_booked", "meeting_attended"],
  ["meeting_attended", "paid_client"],
  ["signup", "paid_client"],
  ["form_filled", "paid_client"],
];

describe("funnel leg marks — one tile per leg, unique fleet-wide", () => {
  it("draws every leg the fleet publishes, including ones no brand funds yet", () => {
    for (const [from, to] of PUBLISHED_LEGS) {
      expect(funnelLegMarkFor(from, to), `${from ?? "∅"} -> ${to}`).not.toBeNull();
    }
    // The catalogue is exactly the published legs PLUS the arrows of the funnels we
    // sell — an entry beyond that union is a tile for an arrow nobody can be shown.
    const wanted = new Set(PUBLISHED_LEGS.map(([f, t]) => funnelLegMarkKey(f, t)));
    for (const funnel of SALES_FUNNELS) {
      for (const leg of funnelLegs(funnel)) wanted.add(funnelLegMarkKey(leg.fromKey, leg.toKey));
    }
    expect(Object.keys(FUNNEL_LEG_MARKS).sort()).toEqual([...wanted].sort());
  });

  it("gives each leg its OWN glyph — no two legs wear the same mark", () => {
    const glyphs = Object.values(FUNNEL_LEG_MARKS).map((m) => m.glyph);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  it("never reuses a CHANNEL's glyph, so a leg tile and a channel tile stay apart", () => {
    // The two marks sit on the same row — the leg leads, the channel follows behind
    // "Via" — so a shared glyph would read as the same thing said twice.
    const channelGlyphs = new Set(["envelope", "chat-circle", "chat-teardrop"]);
    for (const mark of Object.values(FUNNEL_LEG_MARKS)) {
      expect(channelGlyphs.has(mark.glyph)).toBe(false);
    }
  });

  it("never reuses a FUNNEL's glyph either — the leg tile stands in for it", () => {
    // Where a leg cannot be placed, `CampaignIdentity` falls back to the FUNNEL's mark
    // in the same slot, so a shared icon reads as the funnel where an arrow was meant.
    // Compared as the icons each mark file actually imports, which is the real surface:
    // a collision introduced from either side fails here.
    const iconsOf = (rel: string) => {
      const src = read(rel);
      return new Set(
        [...src.matchAll(/dist\/csr\/([A-Za-z]+)"/g)].map((m) => m[1]),
      );
    };
    const legIcons = iconsOf("components/marks/funnel-leg-mark.tsx");
    const funnelIcons = iconsOf("components/marks/sales-funnel-mark.tsx");
    expect(legIcons.size).toBeGreaterThan(0);
    expect(funnelIcons.size).toBeGreaterThan(0);
    const shared = [...legIcons].filter((i) => funnelIcons.has(i));
    expect(shared).toEqual([]);
  });

  it("covers every arrow of every funnel we sell", () => {
    for (const funnel of SALES_FUNNELS) {
      for (const leg of funnelLegs(funnel)) {
        expect(funnelLegMarkFor(leg.fromKey, leg.toKey), `${funnel.key}: ${leg.label}`).not.toBeNull();
      }
    }
  });

  it("keys an ENTRY leg apart from the first step's own conversion", () => {
    // `from: null` is "onto the funnel from nothing", which is not index 0 of anything.
    expect(funnelLegMarkKey(null, "conversation")).toBe("->conversation");
    expect(funnelLegMarkKey("conversation", "meeting_booked")).toBe(
      "conversation->meeting_booked",
    );
  });

  it("answers null for a leg it has not drawn rather than borrowing another's tile", () => {
    expect(funnelLegMarkFor("conversation", "paid_client")).toBeNull();
    expect(funnelLegMarkFor(null, "something_new")).toBeNull();
    expect(funnelLegMarkFor(null, null)).toBeNull();
  });

  it("tints only from the `html.dark` remapped set the other marks draw from", () => {
    // A tint outside the remap renders its light-mode near-white on the dark surface.
    const allowed = new Set(["blue", "purple", "indigo", "orange"]);
    for (const mark of Object.values(FUNNEL_LEG_MARKS)) {
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
    const src = read("lib/funnel-leg-marks.ts");
    expect(src).not.toMatch(/^import .*from "@\//m);
  });

  it("renders each glyph through ONE icon map, and imports per-icon", () => {
    const mark = read("components/marks/funnel-leg-mark.tsx");
    for (const glyph of Object.values(FUNNEL_LEG_MARKS).map((m) => m.glyph)) {
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
