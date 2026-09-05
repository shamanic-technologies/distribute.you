import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..", "src");
const card = readFileSync(join(root, "components", "leads", "lead-location-map.tsx"), "utf8");
/**
 * The card's own doc comment EXPLAINS why there is no tile server and no hex, so
 * a whole-file `not.toContain` would fail on the prose that justifies the rule.
 * Assert against a comment-stripped copy — the guard is about the CODE.
 */
const cardCode = card.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const page = readFileSync(join(root, "components", "audiences", "engaged-leads-page.tsx"), "utf8");
const globals = readFileSync(join(root, "app", "globals.css"), "utf8");

function sliceToNextFunction(src: string, marker: string): string {
  const at = src.indexOf(marker);
  expect(at, `marker not found: ${marker}`).toBeGreaterThan(-1);
  const next = src.indexOf("\nfunction ", at + marker.length);
  return src.slice(at, next === -1 ? src.length : next);
}

describe("the lead panel's location map", () => {
  it("is MOUNTED by the leads page, not merely defined", () => {
    // A component perfectly able to draw a map is the feature entirely absent if
    // the page never renders it. Pin the CALL SITE, not only the component.
    expect(page).toContain('import { LeadLocationMap } from "@/components/leads/lead-location-map"');
    expect(page).toContain("<LeadLocationMap");
  });

  it("is fed the person AND the employer", () => {
    const at = page.indexOf("<LeadLocationMap");
    const call = page.slice(at, page.indexOf("/>", at));
    expect(call).toContain("person={selectedFull");
    expect(call).toContain("organization={selectedOrg");
  });

  it("sits AFTER the Organization card — it is about both halves, so it is inside neither", () => {
    const org = page.indexOf('uppercase tracking-wider mb-3">Organization<');
    const map = page.indexOf("<LeadLocationMap");
    expect(org).toBeGreaterThan(-1);
    expect(map).toBeGreaterThan(org);
  });

  it("renders every Leads page at once, because they are ONE component", () => {
    // brand / offer / funnel / campaign all mount EngagedLeadsPage, so there is
    // exactly one place to wire this and no second copy to drift.
    expect(page).toContain("export function EngagedLeadsPage");
  });
});

describe("the map itself", () => {
  it("makes NO network request — no tile server, no map key, no iframe", () => {
    expect(cardCode).not.toMatch(/https?:\/\//);
    expect(cardCode).not.toContain("<iframe");
    expect(cardCode).not.toContain("fetch(");
    expect(cardCode.toLowerCase()).not.toContain("googleapis");
    expect(cardCode.toLowerCase()).not.toContain("mapbox");
    // Deliberately NOT a `not.toContain("tile")` guard: `tone-tile` is a class
    // this card legitimately carries, so that predicate can only ever be red.
    expect(cardCode.toLowerCase()).not.toContain("tile.openstreetmap");
    expect(cardCode.toLowerCase()).not.toContain("staticmap");
  });

  it("draws nothing when neither country resolves", () => {
    // An empty world map claims we know nothing, which the panel's two text rows
    // above already say better.
    expect(card).toContain("if (pins.length === 0) return null;");
  });

  it("explains NOTHING about its own grain — the map is looked at, not read", () => {
    // A footnote under a two-dot picture is a sentence nobody asked for. Removed
    // on the owner's call; do not re-add one.
    expect(card).not.toContain("Pins are placed by");
    expect(card).not.toContain("coarsestGrain");
  });

  it('labels the second row "Organization", never the employer\'s own name', () => {
    // The row beside it reads "Lead"; naming one side and labelling the other
    // makes the pair read as two different kinds of thing.
    expect(card).toContain('term="Organization"');
    expect(card).not.toContain("organizationName");
  });

  it("says out loud when the lead and their employer are in different countries", () => {
    expect(card).toContain("differentCountries");
    expect(card).toContain("not in the same country as the company they work for");
  });

  it("colours every layer off `currentColor` or a remapped utility, never a hex", () => {
    // A hardcoded hex is the one control that stays OUR colour on a brand-tinted
    // dashboard, and an SVG attribute is reached by no `html.dark` remap.
    expect(cardCode).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(card).toContain('fill="currentColor"');
    // Every fill utility this card uses has to carry a dark rule of its own.
    for (const cls of ["fill-gray-50", "fill-gray-300"]) {
      expect(globals, cls).toContain(`html.dark .${cls} {`);
    }
  });

  it("wears the brand's PRIMARY on the person and its SECONDARY on the employer", () => {
    // One pair, one relationship — and both read off the brand's own ramp rather
    // than a literal, so a tinted dashboard rotates them together.
    expect(card).toContain('toneClassName="text-brand-600"');
    expect(card).toContain('dotClassName="bg-brand-600"');
    expect(card).toContain('toneClassName="tone-tile text-purple-600"');
    expect(card).toContain('dotClassName={merged ? "bg-brand-600" : "bg-purple-600"}');
    expect(card).not.toContain("orange");
  });

  it("puts `tone-tile` where each purple rotation can actually see it", () => {
    // `.tone-tile.text-purple-600` has a SELF selector, so the pin may carry both
    // classes; `bg-purple-600` only rotates as a DESCENDANT, so the legend dot's
    // tone-tile has to ride the row.
    const pin = sliceToNextFunction(card, "function Pin(");
    expect(pin).not.toContain("bg-purple-600");
    expect(card).toContain('rowClassName={merged ? undefined : "tone-tile"}');
    // Both halves of the dot's rotation, or a tinted dashboard shows the customer's
    // hue on the pin and ours on the dot naming it.
    expect(globals).toContain(":root[data-brand-tint] .tone-tile .bg-purple-600 {");
    expect(globals).toContain("html.dark:root[data-brand-tint] .tone-tile .bg-purple-600 {");
  });

  it("keeps the pin ring on a class that carries its own dark rule", () => {
    expect(card).toContain('className="fill-gray-50"');
    expect(globals).toContain("html.dark .fill-gray-50 { fill: var(--dy-bg-alt); }");
    expect(card).toContain('className="fill-gray-300"');
    expect(globals).toContain("html.dark .fill-gray-300 { fill: var(--dy-surface-hi); }");
  });

  it("merges two pins that would overlap rather than drawing one blob", () => {
    expect(card).toContain("PIN_MERGE_DISTANCE");
    expect(card).toContain("pinDistance(personPin.at, orgPin.at) < PIN_MERGE_DISTANCE");
  });

  it("recolours the legend when the two pins merged, so it names a dot that is on screen", () => {
    expect(card).toContain('dotClassName={merged ? "bg-brand-600" : "bg-purple-600"}');
  });

  it("reads the viewBox from the same module the projection comes from", () => {
    // A hand-typed viewBox is how the outline and the pins come to disagree.
    expect(card).toContain("viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}");
    expect(card).toContain('from "@/lib/country-geo"');
  });
});
