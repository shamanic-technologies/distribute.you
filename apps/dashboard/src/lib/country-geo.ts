/**
 * Where a country sits on the world map the lead panel draws.
 *
 * The panel already STATES a lead's location and their employer's, as text, in
 * two separate cards. This module is what lets a third surface SHOW it: it turns
 * a country name a producer spelled however it liked into a point, and a point
 * into a coordinate inside the map's own viewBox.
 *
 * Alias-free on purpose (its only imports are the two generated data modules
 * beside it, which import nothing), so it carries real unit tests rather than
 * source-substring guards. Keep it that way.
 */
import { COUNTRY_POINTS, COUNTRY_POINT_ALIASES } from "./country-points";

/**
 * The map's own coordinate space. Equirectangular at 1000 units of width, so one
 * degree of longitude is `MAP_WIDTH / 360` units and one degree of latitude is
 * the SAME number of units — that equality is what makes the projection below a
 * single multiply, and what makes the generated outline and a computed pin agree.
 *
 * Cropped at the top and bottom to the latitudes people actually live at.
 * Antarctica is dropped from the outline for the same reason: it carries no
 * leads and only costs vertical space in a 480px-wide panel.
 */
export const MAP_WIDTH = 1000;
export const MAP_LAT_TOP = 83;
export const MAP_LAT_BOTTOM = -56;
export const MAP_DEGREES_PER_UNIT = 360 / MAP_WIDTH;
export const MAP_HEIGHT = (MAP_LAT_TOP - MAP_LAT_BOTTOM) / MAP_DEGREES_PER_UNIT;

/** A place on the globe, before it is projected. */
export interface GeoPoint {
  lat: number;
  lon: number;
}

/** A place on the map, in the viewBox's own units. */
export interface MapPoint {
  x: number;
  y: number;
}

/**
 * Resolve a producer's country string to a point, or null when we do not
 * recognise it. Null is the honest answer for an unknown country — a pin
 * dropped at a guessed coordinate says something we do not know.
 *
 * Matching is case-insensitive and whitespace-trimmed because the same country
 * reaches us in several shapes; anything beyond that (fuzzy matching, prefix
 * matching) would put a pin on Guinea for "Guinea Bissau".
 */
export function countryPoint(country: string | null | undefined): GeoPoint | null {
  if (!country) return null;
  const trimmed = country.trim();
  if (!trimmed) return null;

  const direct = COUNTRY_POINTS[trimmed];
  if (direct) return { lat: direct[0], lon: direct[1] };

  const key = trimmed.toLowerCase();
  const canonical = COUNTRY_POINT_ALIASES[key];
  if (canonical) {
    const aliased = COUNTRY_POINTS[canonical];
    if (aliased) return { lat: aliased[0], lon: aliased[1] };
  }

  // Last resort before giving up: a case-insensitive pass over the canonical
  // names, so "UNITED KINGDOM" resolves without needing its own alias row.
  for (const name of Object.keys(COUNTRY_POINTS)) {
    if (name.toLowerCase() === key) {
      const found = COUNTRY_POINTS[name];
      return { lat: found[0], lon: found[1] };
    }
  }
  return null;
}

/**
 * Project a place onto the map. Clamped to the map's own crop rather than
 * refused: a lead in Ushuaia belongs at the bottom edge, not nowhere.
 */
export function projectLatLon(point: GeoPoint): MapPoint {
  const lat = Math.min(MAP_LAT_TOP, Math.max(MAP_LAT_BOTTOM, point.lat));
  const lon = Math.min(180, Math.max(-180, point.lon));
  return {
    x: (lon + 180) / MAP_DEGREES_PER_UNIT,
    y: (MAP_LAT_TOP - lat) / MAP_DEGREES_PER_UNIT,
  };
}

/** One pin the map draws. */
export interface LocationPin {
  /** Which of the two things this pin is — the person, or where they work. */
  kind: "person" | "organization";
  /** What the panel already prints as text for this pin, e.g. "Austin, TX, United States". */
  label: string;
  /** The country the pin is placed by, stated so a reader knows the grain. */
  country: string;
  at: MapPoint;
}

/** The two locations a lead panel can state, before either is resolved. */
export interface LocationInput {
  city?: string | null;
  state?: string | null;
  country?: string | null;
}

/** The text the panel's existing `Location:` rows print, from the same parts. */
export function locationLabel(input: LocationInput | null | undefined): string {
  if (!input) return "";
  return [input.city, input.state, input.country].filter(Boolean).join(", ");
}

/**
 * Everything the map card needs, or null when there is nothing to draw.
 *
 * A pin is only produced for a location whose COUNTRY we recognise: the pin is a
 * country-grain statement, so a row carrying a city and no country has a label
 * and no place to sit. Both pins absent means the card must not render at all —
 * an empty map states that we know nothing, which is worse than the text rows
 * saying so on their own.
 */
export function locationPins(
  person: LocationInput | null | undefined,
  organization: LocationInput | null | undefined,
): LocationPin[] {
  const pins: LocationPin[] = [];
  const personPoint = countryPoint(person?.country);
  if (personPoint && person?.country) {
    pins.push({
      kind: "person",
      label: locationLabel(person),
      country: person.country.trim(),
      at: projectLatLon(personPoint),
    });
  }
  const orgPoint = countryPoint(organization?.country);
  if (orgPoint && organization?.country) {
    pins.push({
      kind: "organization",
      label: locationLabel(organization),
      country: organization.country.trim(),
      at: projectLatLon(orgPoint),
    });
  }
  return pins;
}

/**
 * Are the two pins on the same country? Compared on the RESOLVED point rather
 * than on the strings, so "Czechia" and "Czech Republic" are one country and the
 * card does not claim a person works abroad because two producers disagreed
 * about how to spell where they live.
 */
export function sameCountry(
  person: LocationInput | null | undefined,
  organization: LocationInput | null | undefined,
): boolean {
  const a = countryPoint(person?.country);
  const b = countryPoint(organization?.country);
  if (!a || !b) return false;
  return a.lat === b.lat && a.lon === b.lon;
}

/**
 * How far apart two pins are IN MAP UNITS. The card uses it to decide whether
 * two pins would overlap into one blob: at country grain, Belgium and the
 * Netherlands are a few units apart, and two circles drawn there read as one.
 */
export function pinDistance(a: MapPoint, b: MapPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
