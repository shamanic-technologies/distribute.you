import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MAP_HEIGHT,
  MAP_LAT_BOTTOM,
  MAP_LAT_TOP,
  MAP_WIDTH,
  countryPoint,
  locationLabel,
  locationPins,
  pinDistance,
  projectLatLon,
  sameCountry,
} from "../src/lib/country-geo";
import { COUNTRY_POINTS, COUNTRY_POINT_ALIASES } from "../src/lib/country-points";

/**
 * `country-geo.ts` imports only the two generated data modules beside it, which
 * import nothing — so these are REAL unit tests, not source-substring guards.
 * Keep it alias-free; a runtime `@/…` import here turns every one of these into a
 * resolution failure.
 */

describe("countryPoint", () => {
  it("resolves a canonical name", () => {
    const p = countryPoint("France");
    expect(p).not.toBeNull();
    expect(p!.lat).toBeGreaterThan(41);
    expect(p!.lat).toBeLessThan(52);
    expect(p!.lon).toBeGreaterThan(-6);
    expect(p!.lon).toBeLessThan(9);
  });

  it("resolves the spellings Apollo actually serves", () => {
    // Every one of these is a real value read out of the production leads table.
    for (const name of [
      "United States",
      "Czechia",
      "Czech Republic",
      "Tuerkiye",
      "Turkey",
      "Macao",
      "Macau",
      "North Macedonia",
      "Macedonia (FYROM)",
      "Myanmar (Burma)",
      "Republic of the Union of Myanmar",
      "Côte d'Ivoire",
      "Republic of Indonesia",
      "Serbia",
      "Tanzania",
      "Singapore",
      "Hong Kong",
      "Palestine",
      "The Bahamas",
      "U.S. Virgin Islands",
    ]) {
      expect(countryPoint(name), `no point for ${name}`).not.toBeNull();
    }
  });

  it("puts the United States on the contiguous mainland, not in the Pacific", () => {
    // The centroid of ALL US territory sits in the ocean between Alaska and
    // Hawaii. The point has to be the LARGEST landmass's, or the pin is at sea.
    const p = countryPoint("United States")!;
    expect(p.lat).toBeGreaterThan(30);
    expect(p.lat).toBeLessThan(50);
    expect(p.lon).toBeGreaterThan(-115);
    expect(p.lon).toBeLessThan(-85);
  });

  it("is case-insensitive and trims", () => {
    expect(countryPoint("  united kingdom  ")).toEqual(countryPoint("United Kingdom"));
    expect(countryPoint("FRANCE")).toEqual(countryPoint("France"));
  });

  it("answers null rather than guessing", () => {
    // A pin at a guessed coordinate states a place we were never told.
    expect(countryPoint(null)).toBeNull();
    expect(countryPoint(undefined)).toBeNull();
    expect(countryPoint("")).toBeNull();
    expect(countryPoint("   ")).toBeNull();
    expect(countryPoint("Wakanda")).toBeNull();
  });

  it("does not prefix-match one country onto another", () => {
    // "Guinea Bissau" must never resolve to Guinea's point.
    const guinea = countryPoint("Guinea");
    const bissau = countryPoint("Guinea Bissau");
    expect(guinea).not.toBeNull();
    expect(bissau).not.toBeNull();
    expect(bissau).not.toEqual(guinea);
  });
});

describe("COUNTRY_POINT_ALIASES", () => {
  it("every alias points at a name the table carries", () => {
    for (const [alias, canonical] of Object.entries(COUNTRY_POINT_ALIASES)) {
      expect(COUNTRY_POINTS[canonical], `${alias} -> ${canonical}`).toBeDefined();
    }
  });

  it("every alias key is lower-cased, since that is how it is looked up", () => {
    for (const alias of Object.keys(COUNTRY_POINT_ALIASES)) {
      expect(alias).toBe(alias.toLowerCase());
    }
  });

  it("every point is a real coordinate", () => {
    for (const [name, [lat, lon]] of Object.entries(COUNTRY_POINTS)) {
      expect(Number.isFinite(lat), name).toBe(true);
      expect(Number.isFinite(lon), name).toBe(true);
      expect(Math.abs(lat), name).toBeLessThanOrEqual(90);
      expect(Math.abs(lon), name).toBeLessThanOrEqual(180);
    }
  });
});

describe("projectLatLon", () => {
  it("maps the map's own corners onto the viewBox's corners", () => {
    expect(projectLatLon({ lat: MAP_LAT_TOP, lon: -180 })).toEqual({ x: 0, y: 0 });
    const br = projectLatLon({ lat: MAP_LAT_BOTTOM, lon: 180 });
    expect(br.x).toBeCloseTo(MAP_WIDTH, 6);
    expect(br.y).toBeCloseTo(MAP_HEIGHT, 6);
  });

  it("keeps one degree of latitude the same size as one degree of longitude", () => {
    // Equirectangular: the outline is generated with this exact equality, so a pin
    // that scaled the two axes differently would land off the land it names.
    const a = projectLatLon({ lat: 0, lon: 0 });
    const dx = projectLatLon({ lat: 0, lon: 10 }).x - a.x;
    const dy = a.y - projectLatLon({ lat: 10, lon: 0 }).y;
    expect(dx).toBeCloseTo(dy, 6);
  });

  it("clamps rather than refusing, so Ushuaia sits on the bottom edge", () => {
    const p = projectLatLon({ lat: -80, lon: 0 });
    expect(p.y).toBeCloseTo(MAP_HEIGHT, 6);
    expect(projectLatLon({ lat: 90, lon: 0 }).y).toBe(0);
  });

  it("puts a known city where it belongs", () => {
    // Paris: roughly a fifth of the way down, just right of the middle.
    const paris = projectLatLon({ lat: 48.85, lon: 2.35 });
    expect(paris.x).toBeCloseTo(506.5, 0);
    expect(paris.y).toBeCloseTo(95, 0);
  });
});

describe("locationLabel", () => {
  it("prints the same parts the panel's existing text rows print", () => {
    expect(locationLabel({ city: "Austin", state: "TX", country: "United States" })).toBe(
      "Austin, TX, United States",
    );
  });

  it("drops the parts we do not have rather than printing gaps", () => {
    expect(locationLabel({ city: null, state: null, country: "France" })).toBe("France");
    expect(locationLabel({ city: "Paris", state: null, country: null })).toBe("Paris");
    expect(locationLabel(null)).toBe("");
    expect(locationLabel({})).toBe("");
  });
});

describe("locationPins", () => {
  it("produces one pin per side when both countries are known", () => {
    const pins = locationPins(
      { city: "Austin", state: "TX", country: "United States" },
      { city: "Paris", country: "France" },
    );
    expect(pins.map((p) => p.kind)).toEqual(["person", "organization"]);
    expect(pins[0].label).toBe("Austin, TX, United States");
    expect(pins[1].label).toBe("Paris, France");
  });

  it("produces NO pin for a location carrying a city and no country", () => {
    // The pin is a country-grain statement; a city alone has nowhere to sit.
    const pins = locationPins({ city: "Austin", state: "TX", country: null }, null);
    expect(pins).toEqual([]);
  });

  it("produces no pin for a country nobody recognises", () => {
    expect(locationPins({ country: "Wakanda" }, null)).toEqual([]);
  });

  it("produces the org pin alone when only the employer's country is known", () => {
    const pins = locationPins({ city: "Austin" }, { country: "France" });
    expect(pins).toHaveLength(1);
    expect(pins[0].kind).toBe("organization");
  });

  it("returns an empty list when there is nothing at all", () => {
    expect(locationPins(null, null)).toEqual([]);
    expect(locationPins(undefined, undefined)).toEqual([]);
  });
});

describe("sameCountry", () => {
  it("compares the resolved point, not the string", () => {
    // Two producers spelling one country differently must not read as a person
    // working abroad.
    expect(sameCountry({ country: "Czechia" }, { country: "Czech Republic" })).toBe(true);
    expect(sameCountry({ country: "Macao" }, { country: "Macau" })).toBe(true);
    expect(sameCountry({ country: "Tuerkiye" }, { country: "Turkey" })).toBe(true);
  });

  it("is false when they genuinely differ", () => {
    expect(sameCountry({ country: "France" }, { country: "Germany" })).toBe(false);
  });

  it("is false when either side is unknown — that is not a claim of sameness", () => {
    expect(sameCountry({ country: "France" }, { country: null })).toBe(false);
    expect(sameCountry(null, { country: "France" })).toBe(false);
    expect(sameCountry({ country: "Wakanda" }, { country: "Wakanda" })).toBe(false);
  });
});

describe("pinDistance", () => {
  it("is zero for one place and grows with separation", () => {
    const paris = projectLatLon(countryPoint("France")!);
    const berlin = projectLatLon(countryPoint("Germany")!);
    const tokyo = projectLatLon(countryPoint("Japan")!);
    expect(pinDistance(paris, paris)).toBe(0);
    expect(pinDistance(paris, berlin)).toBeLessThan(pinDistance(paris, tokyo));
  });
});

describe("the generated world outline", () => {
  const path = readFileSync(
    join(__dirname, "..", "src", "lib", "world-map-path.ts"),
    "utf8",
  );

  it("is one path in the same projection the pins use", () => {
    const d = path.match(/"(M[^"]+)"/)?.[1] ?? "";
    expect(d.length).toBeGreaterThan(1000);
    const coords = d.match(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/g) ?? [];
    expect(coords.length).toBeGreaterThan(500);
    for (const c of coords) {
      const [x, y] = c.split(",").map(Number);
      // Every point of the outline lies inside the viewBox the card declares, or
      // the map draws outside its own frame.
      expect(x).toBeGreaterThanOrEqual(-1);
      expect(x).toBeLessThanOrEqual(MAP_WIDTH + 1);
      expect(y).toBeGreaterThanOrEqual(-1);
      expect(y).toBeLessThanOrEqual(MAP_HEIGHT + 1);
    }
  });
});
