/**
 * The competitor landings we mirror, one entry per clone.
 *
 * These exist to be COPIED, not to be published: each one is served byte-for-byte as
 * its origin served it, logo included, so that a design conversation can happen against
 * the real thing rather than a description of it. Nothing about a clone is ours until
 * someone deliberately makes it ours, which is what `brandised` records.
 *
 * Two properties are load-bearing and enforced by `tests/unit/clone-serving.test.ts`:
 * a clone is reachable ONLY through the host named here (so nothing is discoverable by
 * guessing a path on distribute.you), and every entry has files on disk (so a host that
 * resolves cannot 404 its way through the whole site).
 */
export type Clone = {
  /** Directory under `apps/landing/clones/`, and the `lab-<slug>` half of the host. */
  readonly slug: string;
  /** The page this was taken from, verbatim, so a re-capture cannot drift. */
  readonly source: string;
  /** When it was captured. A clone is a photograph; the origin moves on. */
  readonly capturedAt: string;
  /**
   * FALSE means the bytes are still exactly the origin's, which is what every clone
   * starts as. Flip it when a clone stops being a copy and starts being ours — it is
   * what a future change reads before injecting anything of our own (analytics, CTAs,
   * our own marks), so that "identical at t=0" stays true by construction.
   */
  readonly brandised: boolean;
  /**
   * Third-party hosts whose assets were RAPATRIATED into `__external/<host>/…` and whose
   * references were rewritten to point there (`scripts/localise-clone.mjs`).
   *
   * Empty means the clone is a pure copy: every byte is the origin's and any cross-origin
   * asset still loads from wherever it always did. Non-empty is the ONE sanctioned
   * exception to leaving the bytes alone, and it exists because some sites host nothing
   * themselves — a Framer page keeps every image, font and bundle on
   * `framerusercontent.com`, so a same-origin capture yields the HTML and nothing else and
   * the "clone" would render entirely out of somebody else's CDN.
   *
   * Only REFERENCES are rewritten, never content, and only for asset hosts: analytics, tag
   * managers and embedded players are left pointing at their origin. Stated here rather
   * than inferred, so a clone can never quietly claim to be more local than it is.
   */
  readonly localisedHosts: readonly string[];
};

export const CLONES: readonly Clone[] = [
  { slug: "explee", source: "https://explee.com/", capturedAt: "2026-09-06", brandised: false, localisedHosts: [] },
  { slug: "revid", source: "https://www.revid.ai/", capturedAt: "2026-09-06", brandised: false, localisedHosts: [] },
  { slug: "outrank", source: "https://www.outrank.so/", capturedAt: "2026-09-06", brandised: false, localisedHosts: [] },
  { slug: "trustmrr", source: "https://trustmrr.com/", capturedAt: "2026-09-06", brandised: false, localisedHosts: [] },
  {
    slug: "gojiberry",
    source: "https://gojiberry.ai/",
    capturedAt: "2026-09-06",
    brandised: false,
    // Framer: the origin serves the HTML and nothing else, so without this the clone is a
    // shell rendering out of framerusercontent.com. 494 assets rapatriated.
    localisedHosts: [
      "app.framerstatic.com",
      // cdn.jsdelivr.net is referenced only from INSIDE files.tlt-cdn.com/tlt.js, a
      // third-party script the localiser copied verbatim without walking; nothing was
      // mirrored for it, so it is not claimed here (the guard checks the directory exists).
      "files.tlt-cdn.com",
      "fonts.gstatic.com",
      "framer.com",
      "framerusercontent.com",
      "visitor.app.gojiberry.ai",
    ],
  },
];

/**
 * The internal path `src/proxy.ts` rewrites a clone request onto, and the app-router
 * segment that serves it.
 *
 * NOT `_clone`: a leading underscore marks a PRIVATE folder in the app router, so such a
 * segment is excluded from routing and every rewrite onto it falls through to the 404
 * page. Being routable means it is also addressable, which is why the proxy 404s this
 * prefix on any host that is not a clone — otherwise it would be a second door onto the
 * clones with no password on it.
 */
export const CLONE_ROUTE_PREFIX = "/internal-clone";

/** `lab-<slug>.distribute.you` — one level, so Universal SSL already covers it. */
export const CLONE_HOST_PREFIX = "lab-";
export const CLONE_HOST_SUFFIX = ".distribute.you";

/**
 * The clone a request's Host belongs to, or null for every ordinary landing request.
 *
 * Resolved against the CATALOGUE rather than against the filesystem: a host is an
 * allowlist entry, so a made-up `lab-anything` cannot reach a directory read.
 */
export function cloneSlugForHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const hostname = host.split(":")[0].trim().toLowerCase();
  if (!hostname.startsWith(CLONE_HOST_PREFIX) || !hostname.endsWith(CLONE_HOST_SUFFIX)) return null;

  const slug = hostname.slice(CLONE_HOST_PREFIX.length, hostname.length - CLONE_HOST_SUFFIX.length);
  return CLONES.some((clone) => clone.slug === slug) ? slug : null;
}

export function cloneFor(slug: string): Clone | null {
  return CLONES.find((clone) => clone.slug === slug) ?? null;
}
