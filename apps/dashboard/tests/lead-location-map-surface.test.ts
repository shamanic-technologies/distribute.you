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

  it("is fed the person AND the employer, and the employer's name for the legend", () => {
    const at = page.indexOf("<LeadLocationMap");
    const call = page.slice(at, page.indexOf("/>", at));
    expect(call).toContain("person={selectedFull");
    expect(call).toContain("organization={selectedOrg");
    expect(call).toContain("organizationName={selectedOrg?.name");
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

  it("states its own grain rather than letting a dot imply a street address", () => {
    expect(card).toContain("Pins are placed by country, not by city.");
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

  it("puts `tone-tile` where each orange rotation can actually see it", () => {
    // `.tone-tile.text-orange-600` has a SELF selector, so the pin may carry both
    // classes; `bg-orange-600` only rotates as a DESCENDANT, so the legend dot's
    // tone-tile has to ride the row.
    const pin = sliceToNextFunction(card, "function Pin(");
    expect(pin).not.toContain("bg-orange-600");
    expect(card).toContain('toneClassName="tone-tile text-orange-600"');
    expect(card).toContain('dotClassName={merged ? "bg-brand-600" : "bg-orange-600"}');
    expect(card).toContain('rowClassName={merged ? undefined : "tone-tile"}');
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
    expect(card).toContain('dotClassName={merged ? "bg-brand-600" : "bg-orange-600"}');
  });

  it("reads the viewBox from the same module the projection comes from", () => {
    // A hand-typed viewBox is how the outline and the pins come to disagree.
    expect(card).toContain("viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}");
    expect(card).toContain('from "@/lib/country-geo"');
  });
});
