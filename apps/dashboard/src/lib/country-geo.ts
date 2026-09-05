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
import { COUNTRY_ISO2, REGION_POINTS } from "./region-points";

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

/**
 * How precisely we were able to place a pin. The card STATES this rather than
 * letting a dot imply a precision the data does not carry.
 */
export type LocationGrain = "region" | "country";

/**
 * Resolve a whole location to its finest available point: the region (state,
 * province, Land, département) when the producer gave us one we recognise,
 * otherwise the country.
 *
 * ⚠️ CITY grain is deliberately NOT done here, and the reason is a size one
 * rather than a taste one. Placing a pin on "Littleton" needs a coordinate per
 * city; the smallest table that contains a 45,000-person American suburb is
 * every settlement over ~15,000 people, which is 34,135 rows — 894KB, 387KB
 * gzipped, several times this whole page's payload, for a card in a side panel.
 * The right home for a city coordinate is the LEAD ROW: whoever enriches the
 * lead already resolves the place and can store its latitude and longitude, at
 * which point this module renders it with no table at all. Until then a region
 * pin is the finest thing that is honest, and it is what separates two American
 * leads in different states — which a country pin could not.
 */
export function locationPoint(
  input: LocationInput | null | undefined,
): { point: GeoPoint; grain: LocationGrain } | null {
  const country = countryPoint(input?.country);
  if (!country) return null;

  const region = regionPoint(input);
  if (region) return { point: region, grain: "region" };
  return { point: country, grain: "country" };
}

/**
 * Fold a region name to the shape REGION_POINTS is keyed on: lower-cased, accents
 * stripped, whitespace collapsed. Producers send the same region accented and
 * unaccented in the same table ("Québec" beside "Quebec", "Franche-Comté" beside
 * "Franche-Comte"), so comparing raw strings would give one of them a pin and the
 * other a country fallback.
 */
export function foldRegionName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Wrappers a producer puts in front of a region's actual name. Stripped on the
 * QUERY side only — the set is unambiguous ("State of Bahia" is Bahia and nothing
 * else) and doing it here costs no rows in the table.
 */
const REGION_NAME_PREFIX = /^(state of |province of |region of |community of |principado de |the )/;

/** The region's own point, or null when we do not carry one for it. */
function regionPoint(input: LocationInput | null | undefined): GeoPoint | null {
  const state = input?.state?.trim();
  if (!state) return null;

  const iso = countryIso2(input?.country);
  if (!iso) return null;

  const folded = foldRegionName(state);
  const found =
    REGION_POINTS[`${iso}|${folded}`] ??
    REGION_POINTS[`${iso}|${folded.replace(REGION_NAME_PREFIX, "")}`];
  return found ? { lat: found[0], lon: found[1] } : null;
}

/**
 * The ISO 3166-1 alpha-2 the region table is keyed on. Resolved through the SAME
 * alias pass a country point goes through, so "Czechia" and "Czech Republic"
 * both reach the Czech regions rather than one of them silently falling back to
 * a country pin.
 */
export function countryIso2(country: string | null | undefined): string | null {
  const canonical = canonicalCountryName(country);
  return canonical ? COUNTRY_ISO2[canonical] ?? null : null;
}

/** The name COUNTRY_POINTS is keyed on, for whatever a producer sent us. */
export function canonicalCountryName(country: string | null | undefined): string | null {
  if (!country) return null;
  const trimmed = country.trim();
  if (!trimmed) return null;
  if (COUNTRY_POINTS[trimmed]) return trimmed;

  const key = trimmed.toLowerCase();
  const aliased = COUNTRY_POINT_ALIASES[key];
  if (aliased && COUNTRY_POINTS[aliased]) return aliased;

  for (const name of Object.keys(COUNTRY_POINTS)) {
    if (name.toLowerCase() === key) return name;
  }
  return null;
}

/** One pin the map draws. */
export interface LocationPin {
  /** Which of the two things this pin is — the person, or where they work. */
  kind: "person" | "organization";
  /** What the panel already prints as text for this pin, e.g. "Austin, TX, United States". */
  label: string;
  /** The country the pin is placed by, stated so a reader knows the grain. */
  country: string;
  /** How precisely it was placed — the card states the coarsest grain it used. */
  grain: LocationGrain;
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
  const personPoint = locationPoint(person);
  if (personPoint && person?.country) {
    pins.push({
      kind: "person",
      label: locationLabel(person),
      country: person.country.trim(),
      grain: personPoint.grain,
      at: projectLatLon(personPoint.point),
    });
  }
  const orgPoint = locationPoint(organization);
  if (orgPoint && organization?.country) {
    pins.push({
      kind: "organization",
      label: locationLabel(organization),
      country: organization.country.trim(),
      grain: orgPoint.grain,
      at: projectLatLon(orgPoint.point),
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
