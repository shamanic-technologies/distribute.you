/**
 * The face of a sales path combination: a cute manga animal head per NAME, drawn once
 * and served from `public/sales-path-avatars/<name in lower case>.jpg`. The NAME is
 * features-service's (shared by every client, never changed); the face is a look, so it
 * is ours, like a crew's colour was. A name with no face drawn yet is listed nowhere
 * here: the caller says so loudly and shows its initial.
 *
 * Alias-free so it carries real unit tests.
 */
export const SALES_PATH_AVATAR_NAMES: ReadonlySet<string> = new Set([
  "Victory", "Sol", "Herald", "Epiphany", "Triumph", "Zenith", "Summit", "Glory",
  "Aurora", "Bounty", "Jubilee", "Radiance", "Apex", "Laurel", "Harvest", "Eureka",
  "Halo", "Crown", "Pinnacle", "Ascent", "Bliss", "Splendor", "Fortune", "Valor",
  "Anthem", "Beacon", "Comet", "Dawn", "Elation", "Encore", "Euphoria", "Fanfare",
  "Flourish", "Gala", "Gleam", "Golden", "Grace", "Honor", "Horizon", "Jackpot",
  "Joy", "Jubilation", "Lumen", "Luster", "Majesty", "Marvel", "Meridian", "Miracle",
  // Campaign names (one channel on one leg, features-service campaignName), same pool and look.
  "Nova", "Oasis", "Opulence", "Ovation", "Paragon", "Plenty", "Prism", "Prodigy",
  "Rapture", "Regal", "Rise", "Rhapsody", "Riches", "Soar",
]);

/** The face's URL, or null when nobody drew one for this name yet. */
export function salesPathAvatarSrc(name: string): string | null {
  return SALES_PATH_AVATAR_NAMES.has(name) ? `/sales-path-avatars/${name.toLowerCase()}.jpg` : null;
}
